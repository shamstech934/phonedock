import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { DataQualityIssue, ScanJob, ActivityLog, Phone, PhoneSpecs, PhoneImage, PhonePrice, PhoneBenchmark, Brand, AIResearchDraft, AIResearchJob } from '@/lib/models';
import { getAdminFromRequest, requirePermission } from './helpers';
import { startScan, executeScan, executeAutoFix, calculateHealthScore } from '@/lib/data-quality/scanner';
import { parseBoundedInt } from '@/lib/http';
import { activeAIProvider, aiEnrichmentConfigured, generateEnrichmentSuggestions } from '@/lib/ai-enrichment';

// ═══════════════════════════════════════════════════════════════════
// GET HANDLERS
// ═══════════════════════════════════════════════════════════════════

export async function handleDataQualityGet(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // GET /api/admin/data-quality/ai-status
  // Returns booleans only; secrets are never exposed to the browser.
  if (segments.length >= 3 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'ai-status') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:read');
    if (permCheck) return permCheck;
    const openAI = Boolean(process.env.OPENAI_API_KEY || process.env.AI_ENRICHMENT_API_KEY);
    const openRouter = Boolean(process.env.OPENROUTER_API_KEY);
    const tavily = Boolean(process.env.TAVILY_API_KEY);
    const imageSearch = Boolean(process.env.AI_IMAGE_SEARCH_URL);
    const selectedProvider = activeAIProvider();
    const selectedReady = selectedProvider === 'openrouter' ? openRouter : selectedProvider === 'openai' ? openAI : false;
    return NextResponse.json({
      configured: { specs: selectedReady && tavily, prices: selectedReady && tavily, images: selectedReady && (tavily || imageSearch) },
      providers: { openAI, openRouter, tavily, imageSearch },
      activeProvider: selectedProvider === 'openrouter' ? 'OpenRouter' : selectedProvider === 'openai' ? 'OpenAI' : 'None',
      requestedProvider: String(process.env.AI_PROVIDER || 'openrouter').toLowerCase(),
      model: selectedProvider === 'openrouter' ? (process.env.OPENROUTER_MODEL || process.env.AI_MODEL || 'openrouter/free') : (process.env.OPENAI_MODEL || process.env.AI_ENRICHMENT_MODEL || 'gpt-4.1-mini'),
      maxJobPhones: parseBoundedInt(process.env.AI_RESEARCH_MAX_JOB_PHONES || '10', 10, 1, 10),
    }, { headers: { 'Cache-Control': 'no-store' } });
  }
  // GET /api/admin/data-quality/ai-drafts?type=specs&status=pending_review&page=1&limit=20&q=
  if (segments.length >= 3 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'ai-drafts') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:read');
    if (permCheck) return permCheck;
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status') || 'pending_review';
    const page = parseBoundedInt(searchParams.get('page'), 1, 1, 100000);
    const limit = parseBoundedInt(searchParams.get('limit'), 20, 1, 100);
    const q = (searchParams.get('q') || '').trim();
    const query: Record<string, unknown> = { status };
    if (type && ['specs','images','prices'].includes(type)) query.type = type;
    if (q) query.$or = [
      { brand: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      { model: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
    ];
    const [drafts, total] = await Promise.all([
      AIResearchDraft.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('phoneId', 'modelName slug thumbnail pricePKR dataConfidence').lean(),
      AIResearchDraft.countDocuments(query),
    ]);
    return NextResponse.json({ drafts, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  }

  // GET /api/admin/data-quality/ai-jobs
  if (segments.length >= 3 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'ai-jobs') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:read');
    if (permCheck) return permCheck;
    const { searchParams } = new URL(req.url);
    const includeHistory = searchParams.get('history') === '1';
    const query = includeHistory
      ? {}
      : { status: { $nin: ['completed', 'completed_with_errors', 'cancelled'] } };
    const jobs = await AIResearchJob.find(query).select('-phoneIds').sort({ createdAt: -1 }).limit(includeHistory ? 50 : 25).lean();
    return NextResponse.json({ jobs, includeHistory }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  }
  // GET /api/admin/data-quality/summary
  if (segments.length >= 3 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'summary') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:read');
    if (permCheck) return permCheck;

    const { searchParams } = new URL(req.url);
    const includeHealth = searchParams.get('health') !== 'false';

    const [totalPhones, publishedPhones, draftPhones, archivedPhones, totalBrands] = await Promise.all([
      Phone.countDocuments({ deletedAt: null }),
      Phone.countDocuments({ deletedAt: null, status: 'published' }),
      Phone.countDocuments({ deletedAt: null, status: { $in: ['draft', 'pending'] } }),
      Phone.countDocuments({ deletedAt: null, status: 'archived' }),
      Brand.countDocuments({}),
    ]);

    // Open issues by severity
    const [critical, high, medium, low, info] = await Promise.all([
      DataQualityIssue.countDocuments({ status: 'open', severity: 'critical' }),
      DataQualityIssue.countDocuments({ status: 'open', severity: 'high' }),
      DataQualityIssue.countDocuments({ status: 'open', severity: 'medium' }),
      DataQualityIssue.countDocuments({ status: 'open', severity: 'low' }),
      DataQualityIssue.countDocuments({ status: 'open', severity: 'info' }),
    ]);

    const totalOpen = critical + high + medium + low + info;

    // Live catalog completeness counts. These must be computed from the source
    // collections, not from DataQualityIssue, because the issue table can be empty
    // before a scan finishes (or when a large serverless scan times out).
    const publishedPhoneIds = await Phone.find({ deletedAt: null, status: 'published' }).distinct('_id');
    const [phonesWithSpecs, phonesWithImages] = await Promise.all([
      PhoneSpecs.distinct('phoneId', { phoneId: { $in: publishedPhoneIds } }),
      PhoneImage.distinct('phoneId', { phoneId: { $in: publishedPhoneIds } }),
    ]);

    const specPhoneIdSet = new Set(phonesWithSpecs.map(id => id.toString()));
    const imagePhoneIdSet = new Set(phonesWithImages.map(id => id.toString()));

    const [publishedPhoneRows, duplicates, orphans, stalePrices] = await Promise.all([
      Phone.find({ _id: { $in: publishedPhoneIds } })
        .select('_id thumbnail pricePKR')
        .lean(),
      DataQualityIssue.countDocuments({ status: 'open', issueType: { $in: ['PHONE_DUPLICATE_SLUG', 'PHONE_DUPLICATE_NORMALIZED', 'BRAND_DUPLICATE_NORMALIZED', 'SPECS_DUPLICATE'] } }),
      DataQualityIssue.countDocuments({ status: 'open', issueType: { $in: ['ORPHAN_SPECS', 'ORPHAN_IMAGE', 'ORPHAN_PRICE', 'ORPHAN_BENCHMARK'] } }),
      DataQualityIssue.countDocuments({ status: 'open', issueType: 'PHONE_STALE_PRICE' }),
    ]);

    const missingSpecs = publishedPhoneRows.filter(phone => !specPhoneIdSet.has(phone._id.toString())).length;
    const missingImages = publishedPhoneRows.filter(phone => {
      const thumbnail = typeof phone.thumbnail === 'string' ? phone.thumbnail.trim() : '';
      return !thumbnail && !imagePhoneIdSet.has(phone._id.toString());
    }).length;
    const missingPrices = publishedPhoneRows.filter(phone => {
      const price = Number(phone.pricePKR || 0);
      return !Number.isFinite(price) || price <= 0;
    }).length;

    // Specs completeness
    const specsComplete = phonesWithSpecs.length;

    // Phones with complete specs (key fields filled)
    const keySpecPhones = await PhoneSpecs.find({
      $or: [
        { chipset: { $ne: '' } },
        { ram: { $ne: '' } },
        { storage: { $ne: '' } },
      ],
    }).lean();
    const completeSpecs = keySpecPhones.filter(s => s.chipset?.trim() && s.ram?.trim() && s.storage?.trim()).length;

    // Trend data
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [discoveredToday, fixedToday, newLast7Days] = await Promise.all([
      DataQualityIssue.countDocuments({ detectedAt: { $gte: todayStart } }),
      DataQualityIssue.countDocuments({ resolvedAt: { $gte: todayStart } }),
      DataQualityIssue.countDocuments({ detectedAt: { $gte: sevenDaysAgo } }),
    ]);

    // Failed imports needing review
    const failedImports = await DataQualityIssue.countDocuments({ status: 'open', entityType: 'import' });

    let health = null;
    if (includeHealth) {
      try {
        health = await calculateHealthScore();
      } catch (e) {
        console.error('[DataQuality] Health score error:', e);
      }
    }

    return NextResponse.json({
      health,
      totals: { totalPhones, publishedPhones, draftPhones, archivedPhones, totalBrands },
      specs: { withSpecs: specsComplete, completeSpecs, publishedPhones },
      queues: { missingSpecs, missingImages, missingPrices, duplicates, orphans, stalePrices, failedImports },
      severity: { critical, high, medium, low, info, total: totalOpen },
      trends: { discoveredToday, fixedToday, newLast7Days },
    });
  }

  // GET /api/admin/data-quality/live-queue.csv?type=specs|images|prices&q=
  // Exports the complete live repair queue, not only the currently visible page.
  // This is intentionally read-only: the CSV is a review work pack and does not
  // auto-publish generated or unverified data.
  if (segments.length >= 3 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'live-queue.csv') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:read');
    if (permCheck) return permCheck;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'specs';
    if (!['specs', 'images', 'prices'].includes(type)) {
      return NextResponse.json({ error: 'type must be specs, images, or prices' }, { status: 400 });
    }
    const q = (searchParams.get('q') || '').trim();
    const baseQuery: Record<string, unknown> = { deletedAt: null, status: 'published' };
    if (q) baseQuery.modelName = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

    if (type === 'specs') {
      const withSpecs = await PhoneSpecs.distinct('phoneId');
      baseQuery._id = { $nin: withSpecs.map(id => new Types.ObjectId(id)) };
    } else if (type === 'images') {
      const withImages = await PhoneImage.distinct('phoneId');
      baseQuery.$and = [
        { $or: [{ thumbnail: '' }, { thumbnail: null }, { thumbnail: { $exists: false } }] },
        { _id: { $nin: withImages.map(id => new Types.ObjectId(id)) } },
      ];
    } else {
      baseQuery.$or = [
        { pricePKR: { $exists: false } },
        { pricePKR: null },
        { pricePKR: { $lte: 0 } },
      ];
    }

    const rows = await Phone.find(baseQuery)
      .select('_id modelName slug brandId thumbnail pricePKR ptaStatus dataConfidence updatedAt')
      .populate('brandId', 'name slug')
      .sort({ brandId: 1, modelName: 1 })
      .lean();

    const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const repairColumns = type === 'specs'
      ? ['Display', 'Chipset', 'RAM', 'Storage', 'Battery', 'Main Camera', '5G']
      : type === 'images'
        ? ['Thumbnail URL']
        : ['New Price PKR', 'Source Name', 'Source URL'];
    const header = ['Phone ID', 'Brand', 'Model', 'Slug', 'Missing', ...repairColumns, 'PTA Status', 'Data Confidence', 'Last Verified At', 'Admin Editor'];
    const csvRows = rows.map((row: any) => [
      row._id.toString(),
      row.brandId?.name || 'Unknown brand',
      row.modelName || 'Unnamed phone',
      row.slug || '',
      type,
      ...repairColumns.map(() => ''),
      row.ptaStatus || 'Unknown',
      row.dataConfidence || 'unverified',
      '',
      `/admin/phones/${row._id.toString()}/edit`,
    ]);
    const csv = '\uFEFF' + [header, ...csvRows].map(row => row.map(quote).join(',')).join('\n');
    const filename = `phonedock-missing-${type}-all.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  // GET /api/admin/data-quality/live-queue?type=specs|images|prices&page=1&limit=50&q=
  // Lists incomplete phone records directly from source collections. This does
  // not depend on a completed DataQualityIssue scan, so large catalogs remain
  // reviewable even when a serverless scan is interrupted.
  if (segments.length >= 3 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'live-queue') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:read');
    if (permCheck) return permCheck;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'specs';
    if (!['specs', 'images', 'prices'].includes(type)) {
      return NextResponse.json({ error: 'type must be specs, images, or prices' }, { status: 400 });
    }
    const page = parseBoundedInt(searchParams.get('page'), 1, { min: 1, max: 100000 });
    const limit = parseBoundedInt(searchParams.get('limit'), 50, { min: 1, max: 100 });
    const q = (searchParams.get('q') || '').trim();

    const baseQuery: Record<string, unknown> = { deletedAt: null, status: 'published' };
    if (q) baseQuery.modelName = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

    let missingIds: Types.ObjectId[] | null = null;
    if (type === 'specs') {
      const withSpecs = await PhoneSpecs.distinct('phoneId');
      missingIds = withSpecs.map(id => new Types.ObjectId(id));
      baseQuery._id = { $nin: missingIds };
    } else if (type === 'images') {
      const withImages = await PhoneImage.distinct('phoneId');
      missingIds = withImages.map(id => new Types.ObjectId(id));
      baseQuery.$and = [
        { $or: [{ thumbnail: '' }, { thumbnail: null }, { thumbnail: { $exists: false } }] },
        { _id: { $nin: missingIds } },
      ];
    } else {
      baseQuery.$or = [
        { pricePKR: { $exists: false } },
        { pricePKR: null },
        { pricePKR: { $lte: 0 } },
      ];
    }

    const [rows, total] = await Promise.all([
      Phone.find(baseQuery)
        .select('_id modelName slug brandId thumbnail pricePKR ptaStatus dataConfidence updatedAt')
        .populate('brandId', 'name slug')
        .sort({ updatedAt: -1, modelName: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Phone.countDocuments(baseQuery),
    ]);

    const items = rows.map((row: any) => ({
      id: row._id.toString(),
      modelName: row.modelName || 'Unnamed phone',
      slug: row.slug || '',
      brandName: row.brandId?.name || 'Unknown brand',
      thumbnail: row.thumbnail || '',
      pricePKR: Number(row.pricePKR || 0),
      ptaStatus: row.ptaStatus || 'Unknown',
      dataConfidence: row.dataConfidence || 'unverified',
      updatedAt: row.updatedAt,
      missing: type,
    }));

    return NextResponse.json({ items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), type });
  }

  // GET /api/admin/data-quality/scans/:id
  if (segments.length >= 4 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'scans') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:read');
    if (permCheck) return permCheck;

    const scanId = segments[3];
    const scan = await ScanJob.findOne({ scanId }).lean();
    if (!scan) return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    return NextResponse.json({ scan });
  }

  // GET /api/admin/data-quality/scans (list)
  if (segments.length >= 3 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'scans') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:read');
    if (permCheck) return permCheck;

    const { searchParams } = new URL(req.url);
    const page = parseBoundedInt(searchParams.get('page'), 1);
    const limit = parseBoundedInt(searchParams.get('limit'), 20, { max: 50 });
    const skip = (page - 1) * limit;

    const [scans, total] = await Promise.all([
      ScanJob.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ScanJob.countDocuments({}),
    ]);

    return NextResponse.json({ scans, total, page, pages: Math.ceil(total / limit) });
  }

  // GET /api/admin/data-quality/issues/:id
  if (segments.length >= 4 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'issues') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:read');
    if (permCheck) return permCheck;

    const issue = await DataQualityIssue.findById(segments[3]).lean();
    if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    return NextResponse.json({ issue });
  }

  // GET /api/admin/data-quality/issues
  if (segments.length >= 3 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'issues') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:read');
    if (permCheck) return permCheck;

    const { searchParams } = new URL(req.url);
    const page = parseBoundedInt(searchParams.get('page'), 1);
    const limit = parseBoundedInt(searchParams.get('limit'), 50, { max: 100 });
    const skip = (page - 1) * limit;
    const severity = searchParams.get('severity') || '';
    const issueType = searchParams.get('issueType') || '';
    const status = searchParams.get('status') || 'open';
    const entityType = searchParams.get('entityType') || '';
    const search = searchParams.get('search') || '';
    const importId = searchParams.get('importId') || '';
    const sortBy = searchParams.get('sortBy') || 'detectedAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;

    const query: Record<string, unknown> = {};
    if (severity) query.severity = severity;
    if (issueType) {
      // Support comma-separated issue types for $in queries
      const types = issueType.split(',').map(t => t.trim()).filter(Boolean);
      query.issueType = types.length > 1 ? { $in: types } : issueType;
    }
    if (status && status !== 'all') query.status = status;
    if (entityType) query.entityType = entityType;
    if (importId) query.importId = importId;

    // Search by entity ID or field content
    if (search) {
      query.$or = [
        { entityId: { $regex: search, $options: 'i' } },
        { field: { $regex: search, $options: 'i' } },
        { issueType: { $regex: search, $options: 'i' } },
      ];
    }

    const sort: Record<string, 1 | -1> = {};
    sort[sortBy] = sortOrder;

    const [issues, total] = await Promise.all([
      DataQualityIssue.find(query).sort(sort).skip(skip).limit(limit).lean(),
      DataQualityIssue.countDocuments(query),
    ]);

    // Enrich issues with entity names
    const phoneIds = [...new Set(issues.filter((i: Record<string, unknown>) => i.entityType === 'phone').map((i: Record<string, unknown>) => i.entityId as string))];
    const brandIds = [...new Set(issues.filter((i: Record<string, unknown>) => i.entityType === 'brand').map((i: Record<string, unknown>) => i.entityId as string))];
    const phoneNames = new Map<string, string>();
    const brandNames = new Map<string, string>();

    if (phoneIds.length > 0) {
      const phones = await Phone.find({ _id: { $in: phoneIds } }).select('modelName slug thumbnail').lean();
      for (const p of phones) phoneNames.set(p._id.toString(), p.modelName || '');
    }
    if (brandIds.length > 0) {
      const brands = await Brand.find({ _id: { $in: brandIds } }).select('name').lean();
      for (const b of brands) brandNames.set(b._id.toString(), b.name || '');
    }

    const enriched = issues.map((issue: Record<string, unknown>) => {
      const entityName = issue.entityType === 'phone'
        ? phoneNames.get(issue.entityId as string) || ''
        : issue.entityType === 'brand'
          ? brandNames.get(issue.entityId as string) || ''
          : '';
      return { ...issue, entityName, id: (issue._id as { toString(): string } | undefined)?.toString() };
    });

    return NextResponse.json({
      issues: enriched,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  }

  // GET /api/admin/data-quality/duplicates
  if (segments.length >= 3 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'duplicates') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:read');
    if (permCheck) return permCheck;

    const dupIssues = await DataQualityIssue.find({
      status: 'open',
      issueType: { $in: ['PHONE_DUPLICATE_SLUG', 'PHONE_DUPLICATE_NORMALIZED', 'BRAND_DUPLICATE_NORMALIZED', 'SPECS_DUPLICATE'] },
    }).lean();

    // Group by candidate group
    const groups = new Map<string, Record<string, unknown>[]>();
    for (const issue of dupIssues) {
      const key = issue.metadata?.candidateIds?.join(',') || issue.issueKey;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(issue);
    }

    // For each group, fetch the actual phone/brand data
    const resultGroups: Record<string, unknown>[] = [];
    for (const [, issues] of groups) {
      const entityIds = [...new Set(issues.map((i: Record<string, unknown>) => i.entityId as string))];
      const entityType = issues[0]?.entityType;

      let entities: Record<string, unknown>[] = [];
      if (entityType === 'phone' && entityIds.length > 0) {
        entities = (await Phone.find({ _id: { $in: entityIds } }).select('modelName slug pricePKR status thumbnail brandId').lean()) as unknown as Record<string, unknown>[];
        // Attach brand names
        const bIds = [...new Set(entities.map((e) => (e.brandId as { toString(): string } | undefined)?.toString()).filter(Boolean))];
        if (bIds.length > 0) {
          const brands = (await Brand.find({ _id: { $in: bIds } }).select('name').lean()) as unknown as Record<string, unknown>[];
          const bMap = new Map(brands.map((b) => [(b._id as { toString(): string }).toString(), b.name as string]));
          const bMapGet = (k: string | undefined) => (k !== undefined ? bMap.get(k) : undefined);
          entities = entities.map((e) => ({ ...e, brandName: bMapGet((e.brandId as { toString(): string } | undefined)?.toString()) || '' }));
        }
      } else if (entityType === 'brand' && entityIds.length > 0) {
        entities = (await Brand.find({ _id: { $in: entityIds } }).lean()) as unknown as Record<string, unknown>[];
      }

      resultGroups.push({
        type: issues[0]?.issueType || 'unknown',
        entities: entities.map((e: Record<string, unknown>) => ({ ...e, id: (e._id as { toString(): string } | undefined)?.toString() })),
        issues: issues.map((i: Record<string, unknown>) => ({ ...i, id: (i._id as { toString(): string } | undefined)?.toString() })),
      });
    }

    return NextResponse.json({ groups: resultGroups, total: resultGroups.length });
  }

  // GET /api/admin/data-quality/rules
  if (segments.length >= 3 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'rules') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:read');
    if (permCheck) return permCheck;

    const { ALL_QUALITY_RULES } = await import('@/lib/data-quality/rules');
    const rules = ALL_QUALITY_RULES.map(r => ({
      ruleId: r.ruleId,
      title: r.title,
      description: r.description,
      severity: r.severity,
      entityType: r.entityType,
      canAutoFix: r.canAutoFix,
    }));
    return NextResponse.json({ rules, total: rules.length });
  }

  // GET /api/admin/data-quality/stats
  if (segments.length >= 3 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'stats') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:read');
    if (permCheck) return permCheck;

    const [totalIssues, openIssues, resolvedToday, autoFixed] = await Promise.all([
      DataQualityIssue.countDocuments({}),
      DataQualityIssue.countDocuments({ status: 'open' }),
      DataQualityIssue.countDocuments({ resolvedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
      DataQualityIssue.countDocuments({ status: 'auto_fixed' }),
    ]);

    const byType = await DataQualityIssue.aggregate([
      { $match: { status: 'open' } },
      { $group: { _id: '$issueType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    return NextResponse.json({
      totalIssues, openIssues, resolvedToday, autoFixed,
      byType: byType.map((b: { _id: string; count: number }) => ({ issueType: b._id, count: b.count })),
    });
  }

  // FIX #11: Removed 2 duplicate copies of /rules and /stats handlers (were dead code)

  // GET /api/admin/data-quality/export.csv
  if (segments.length >= 3 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'export.csv') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:read');
    if (permCheck) return permCheck;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'open';
    const issueType = searchParams.get('issueType') || '';
    const severity = searchParams.get('severity') || '';

    const query: Record<string, unknown> = {};
    if (status && status !== 'all') query.status = status;
    if (issueType) query.issueType = issueType;
    if (severity) query.severity = severity;

    const issues = await DataQualityIssue.find(query)
      .sort({ severity: 1, detectedAt: -1 })
      .limit(10000)
      .lean();

    const header = 'Issue Key,Entity Type,Entity ID,Issue Type,Severity,Field,Current Value,Suggested Value,Status,Detected At,Confidence,Import ID';
    const rows = issues.map((i: Record<string, unknown>) => [
      csvSafe(i.issueKey as string),
      csvSafe(i.entityType as string),
      csvSafe(i.entityId as string),
      csvSafe(i.issueType as string),
      csvSafe(i.severity as string),
      csvSafe(i.field as string),
      csvSafe(typeof i.currentValue === 'object' ? JSON.stringify(i.currentValue) : String(i.currentValue ?? '')),
      csvSafe(typeof i.suggestedValue === 'object' ? JSON.stringify(i.suggestedValue) : String(i.suggestedValue ?? '')),
      csvSafe(i.status as string),
      csvSafe(String(i.detectedAt)),
      csvSafe(String(i.confidence)),
      csvSafe((i.importId as string) || ''),
    ].join(','));

    const csv = [header, ...rows].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="data-quality-issues-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return undefined;
}

function csvSafe(val: string): string {
  if (!val) return '""';
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return `"${val}"`;
}

// ═══════════════════════════════════════════════════════════════════
// POST HANDLERS
// ═══════════════════════════════════════════════════════════════════

export async function handleDataQualityPost(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {

  // POST /api/admin/data-quality/ai-drafts/action
  // Review, edit and publish AI drafts. Only explicit approval writes to live data.
  if (segments.length >= 4 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'ai-drafts' && segments[3] === 'action') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:fix');
    if (permCheck) return permCheck;
    const body = await req.json();
    const action = String(body.action || '');
    const draftIds = Array.isArray(body.draftIds) ? body.draftIds.map(String).filter(Types.ObjectId.isValid).slice(0, 100) : [];
    if (!['approve', 'reject', 'save'].includes(action) || !draftIds.length) return NextResponse.json({ error: 'Valid action and draftIds are required' }, { status: 400 });
    const edits = body.edits && typeof body.edits === 'object' ? body.edits : {};
    let approved = 0, rejected = 0, saved = 0, failed = 0;
    const results: Array<{ draftId: string; ok: boolean; message: string }> = [];
    const clean = (value: unknown, max = 1500) => String(value ?? '').trim().slice(0, max);
    const isHttpUrl = (value: unknown) => { try { const u = new URL(clean(value)); return ['http:', 'https:'].includes(u.protocol); } catch { return false; } };

    for (const draftId of draftIds) {
      try {
        const draft: any = await AIResearchDraft.findById(draftId);
        if (!draft) { failed++; results.push({ draftId, ok: false, message: 'Draft not found' }); continue; }
        if (draft.status !== 'pending_review' && action !== 'save') { failed++; results.push({ draftId, ok: false, message: 'Draft already reviewed' }); continue; }
        const patch = edits[draftId] || (draftIds.length === 1 ? edits : {});
        if (patch && typeof patch === 'object') {
          if (draft.type === 'specs') {
            draft.specs = { ...draft.specs?.toObject?.() || draft.specs || {},
              display: clean(patch.display ?? draft.specs?.display), chipset: clean(patch.chipset ?? draft.specs?.chipset),
              ram: clean(patch.ram ?? draft.specs?.ram), storage: clean(patch.storage ?? draft.specs?.storage),
              battery: clean(patch.battery ?? draft.specs?.battery), mainCamera: clean(patch.mainCamera ?? draft.specs?.mainCamera),
              fiveG: clean(patch.fiveG ?? draft.specs?.fiveG, 50),
            };
          } else if (draft.type === 'images' && patch.imageUrl) {
            if (!isHttpUrl(patch.imageUrl)) throw new Error('Image URL must be http(s)');
            draft.images = [{ url: clean(patch.imageUrl), sourceUrl: clean(patch.sourceUrl), title: clean(patch.title, 300) }];
          } else if (draft.type === 'prices' && patch.valuePKR) {
            const price = Number(patch.valuePKR); if (!Number.isFinite(price) || price <= 0 || price > 10000000) throw new Error('Invalid PKR price');
            if (patch.sourceUrl && !isHttpUrl(patch.sourceUrl)) throw new Error('Source URL must be http(s)');
            draft.price = { valuePKR: price, sourceName: clean(patch.sourceName, 200), sourceUrl: clean(patch.sourceUrl) };
          }
          draft.editedAt = new Date();
        }
        if (action === 'save') { await draft.save(); saved++; results.push({ draftId, ok: true, message: 'Draft edits saved' }); continue; }
        if (action === 'reject') {
          draft.status = 'rejected'; draft.reviewedBy = authResult.admin._id; draft.reviewedAt = new Date();
          await draft.save(); rejected++; results.push({ draftId, ok: true, message: 'Draft rejected' }); continue;
        }

        const phone: any = await Phone.findOne({ _id: draft.phoneId, deletedAt: null });
        if (!phone) throw new Error('Phone not found');
        if (draft.type === 'specs') {
          const values = draft.specs || {};
          const update: Record<string, unknown> = {
            display: clean(values.display), chipset: clean(values.chipset), ram: clean(values.ram), storage: clean(values.storage),
            battery: clean(values.battery), mainCamera: clean(values.mainCamera), fiveG: clean(values.fiveG, 50),
          };
          if (!Object.values(update).some(Boolean)) throw new Error('Draft has no usable specifications');
          const numberFrom = (v: unknown, re: RegExp) => { const m = clean(v).match(re); return m ? Number(m[1]) : null; };
          const ramGB = numberFrom(update.ram, /(\d+(?:\.\d+)?)\s*gb/i); if (ramGB) update.ramGB = ramGB;
          const storageGB = numberFrom(update.storage, /(\d+(?:\.\d+)?)\s*gb/i); if (storageGB) update.storageGB = storageGB;
          const batteryMAh = numberFrom(update.battery, /(\d+(?:\.\d+)?)\s*mah/i); if (batteryMAh) update.batteryMAh = batteryMAh;
          const mainCameraMP = numberFrom(update.mainCamera, /(\d+(?:\.\d+)?)\s*mp/i); if (mainCameraMP) update.mainCameraMP = mainCameraMP;
          await PhoneSpecs.updateOne({ phoneId: phone._id }, { $set: update, $setOnInsert: { phoneId: phone._id } }, { upsert: true });
          draft.publishResult = { specs: true, image: false, price: false, message: 'Specifications published' };
        } else if (draft.type === 'images') {
          const candidate = draft.images?.[0]; if (!candidate?.url || !isHttpUrl(candidate.url)) throw new Error('No valid image candidate');
          phone.thumbnail = clean(candidate.url); draft.publishResult = { specs: false, image: true, price: false, message: 'Primary image published' };
        } else {
          const value = Number(draft.price?.valuePKR); if (!Number.isFinite(value) || value <= 0) throw new Error('No valid price suggestion');
          const previous = Number(phone.pricePKR || 0); phone.previousPrice = previous; phone.pricePKR = value; phone.currentPrice = value;
          phone.lowestPrice = Number(phone.lowestPrice || 0) > 0 ? Math.min(Number(phone.lowestPrice), value) : value;
          phone.highestPrice = Math.max(Number(phone.highestPrice || 0), value); phone.priceChange = previous > 0 ? value - previous : 0;
          phone.percentageChange = previous > 0 ? ((value - previous) / previous) * 100 : 0;
          phone.sourceName = clean(draft.price?.sourceName, 200) || phone.sourceName; phone.sourceUrl = clean(draft.price?.sourceUrl) || phone.sourceUrl;
          phone.lastPriceCheckedAt = new Date(); if (previous !== value) phone.lastPriceChangedAt = new Date();
          draft.publishResult = { specs: false, image: false, price: true, message: 'Price published' };
        }
        phone.dataConfidence = draft.confidence >= 0.85 ? 'verified' : 'user-submitted'; phone.updatedBy = authResult.admin._id; await phone.save();
        draft.status = 'approved'; draft.reviewedBy = authResult.admin._id; draft.reviewedAt = new Date(); await draft.save();
        approved++; results.push({ draftId, ok: true, message: draft.publishResult?.message || 'Approved' });
      } catch (error) { failed++; results.push({ draftId, ok: false, message: error instanceof Error ? error.message : 'Action failed' }); }
    }
    try { await ActivityLog.create({ adminId: authResult.admin._id, action: `ai_drafts_${action}`, details: `${action}: ${approved + rejected + saved} successful, ${failed} failed`, entityType: 'data_quality', entityId: '' }); } catch {}
    return NextResponse.json({ action, approved, rejected, saved, failed, results });
  }

  // POST /api/admin/data-quality/ai-jobs/cleanup - remove finished history only.
  if (segments.length === 4 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'ai-jobs' && segments[3] === 'cleanup') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:fix'); if (permCheck) return permCheck;
    const result = await AIResearchJob.deleteMany({ status: { $in: ['completed', 'completed_with_errors', 'cancelled'] } });
    return NextResponse.json({ deleted: result.deletedCount || 0 });
  }

  // POST /api/admin/data-quality/ai-jobs - create a persistent bulk research job.
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'ai-jobs') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:fix'); if (permCheck) return permCheck;
    const body = await req.json(); const type = String(body.type || '');
    if (!['specs','images','prices'].includes(type)) return NextResponse.json({ error: 'Invalid job type' }, { status: 400 });
    if (!aiEnrichmentConfigured(type as any)) return NextResponse.json({ error: 'AI research providers are not configured' }, { status: 503 });
    const requested = Array.isArray(body.phoneIds) ? body.phoneIds.map(String).filter(Types.ObjectId.isValid) : [];
    const maxPhones = parseBoundedInt(String(body.maxPhones || process.env.AI_RESEARCH_MAX_JOB_PHONES || 10), 10, 1, 10);
    let phoneIds: any[] = requested.slice(0, maxPhones).map((id: string) => new Types.ObjectId(id));
    if (!phoneIds.length) {
      const base: any = { deletedAt: null, status: 'published' };
      if (type === 'specs') { const existing = await PhoneSpecs.distinct('phoneId'); base._id = { $nin: existing }; }
      else if (type === 'images') { const existing = await PhoneImage.distinct('phoneId'); base.$and = [{ $or: [{ thumbnail: '' }, { thumbnail: null }, { thumbnail: { $exists: false } }] }, { _id: { $nin: existing } }]; }
      else base.$or = [{ pricePKR: { $exists: false } }, { pricePKR: null }, { pricePKR: { $lte: 0 } }];
      phoneIds = (await Phone.find(base).select('_id').sort({ updatedAt: 1 }).limit(maxPhones).lean()).map((p: any) => p._id);
    }
    if (!phoneIds.length) return NextResponse.json({ error: 'No matching phones found' }, { status: 400 });
    const job = await AIResearchJob.create({ type, phoneIds, total: phoneIds.length, batchSize: parseBoundedInt(String(body.batchSize || 5), 5, 1, 10), createdBy: authResult.admin._id });
    return NextResponse.json({ jobId: job._id.toString(), total: job.total, status: job.status });
  }

  // POST /api/admin/data-quality/ai-jobs/:id/run|retry|cancel
  if (segments.length >= 5 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'ai-jobs') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:fix'); if (permCheck) return permCheck;
    const jobId = segments[3]; const command = segments[4];
    if (!Types.ObjectId.isValid(jobId)) return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    const job: any = await AIResearchJob.findById(jobId); if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (command === 'cancel') { job.status = 'cancelled'; job.completedAt = new Date(); await job.save(); return NextResponse.json({ job }); }
    if (command === 'retry') {
      const failedIds = (job.failures || []).map((f: any) => f.phoneId).filter(Boolean); if (!failedIds.length) return NextResponse.json({ error: 'No failed phones to retry' }, { status: 400 });
      job.phoneIds = failedIds; job.cursor = 0; job.total = failedIds.length; job.processed = 0; job.generated = 0; job.failed = 0; job.failures = []; job.status = 'queued'; job.completedAt = null; await job.save();
      return NextResponse.json({ job });
    }
    if (command !== 'run') return NextResponse.json({ error: 'Unsupported command' }, { status: 400 });
    if (['completed','cancelled'].includes(job.status)) return NextResponse.json({ job, done: true });
    const ids = job.phoneIds.slice(job.cursor, job.cursor + job.batchSize); if (!ids.length) { job.status = job.failed ? 'completed_with_errors' : 'completed'; job.completedAt = new Date(); await job.save(); return NextResponse.json({ job, done: true }); }
    job.status = 'running'; job.startedAt ||= new Date(); job.lastRunAt = new Date(); await job.save();
    const phones = await Phone.find({ _id: { $in: ids }, deletedAt: null }).select('_id modelName slug brandId').populate('brandId', 'name').lean();
    for (const phone of phones as any[]) {
      try {
        const [suggestion] = await generateEnrichmentSuggestions(job.type, [{ id: phone._id.toString(), brand: phone.brandId?.name || 'Unknown', model: phone.modelName || '', slug: phone.slug || '' }]);
        if (!suggestion) throw new Error('No suggestion returned');
        await AIResearchDraft.updateMany({ phoneId: phone._id, type: job.type, status: 'pending_review' }, { $set: { status: 'rejected', reviewedAt: new Date() } });
        await AIResearchDraft.create({ ...suggestion, phoneId: phone._id, type: job.type, jobId: job._id, status: 'pending_review', createdBy: authResult.admin._id });
        job.generated += 1;
      } catch (error) { job.failed += 1; job.failures.push({ phoneId: phone._id, message: error instanceof Error ? error.message : 'Research failed', attempts: 1 }); }
      job.processed += 1; job.cursor += 1;
    }
    if (job.cursor >= job.total) { job.status = job.failed ? 'completed_with_errors' : 'completed'; job.completedAt = new Date(); }
    else job.status = 'paused';
    await job.save();
    return NextResponse.json({ job: { _id: job._id, type: job.type, status: job.status, total: job.total, processed: job.processed, generated: job.generated, failed: job.failed }, done: ['completed','completed_with_errors'].includes(job.status) });
  }
  // POST /api/admin/data-quality/ai-enrich
  // Creates review-only draft suggestions. Nothing is written to Phone/PhoneSpecs.
  if (segments.length >= 3 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'ai-enrich') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:fix');
    if (permCheck) return permCheck;

    const body = await req.json();
    const type = String(body.type || '') as 'specs' | 'images' | 'prices';
    const phoneIds = Array.isArray(body.phoneIds) ? body.phoneIds.map((id: unknown) => String(id)).filter((id: string) => Types.ObjectId.isValid(id)).slice(0, 10) : [];
    if (!['specs', 'images', 'prices'].includes(type)) return NextResponse.json({ error: 'type must be specs, images, or prices' }, { status: 400 });
    if (!phoneIds.length) return NextResponse.json({ error: 'Select between 1 and 10 phones' }, { status: 400 });
    if (!aiEnrichmentConfigured(type)) {
      return NextResponse.json({
        error: type === 'images'
          ? 'Configure OPENAI_API_KEY plus TAVILY_API_KEY or AI_IMAGE_SEARCH_URL.'
          : 'Configure OPENAI_API_KEY and TAVILY_API_KEY.',
      }, { status: 503 });
    }

    const phones = await Phone.find({ _id: { $in: phoneIds }, deletedAt: null })
      .select('_id modelName slug brandId')
      .populate('brandId', 'name')
      .lean();
    const input = phones.map((phone: any) => ({ id: phone._id.toString(), brand: phone.brandId?.name || 'Unknown', model: phone.modelName || '', slug: phone.slug || '' }));
    try {
      const suggestions = await generateEnrichmentSuggestions(type, input);
      const storedDrafts = [];
      for (const suggestion of suggestions) {
        await AIResearchDraft.updateMany({ phoneId: suggestion.phoneId, type, status: 'pending_review' }, { $set: { status: 'rejected', reviewedAt: new Date(), reviewedBy: authResult.admin._id } });
        storedDrafts.push(await AIResearchDraft.create({ ...suggestion, phoneId: suggestion.phoneId, type, status: 'pending_review', createdBy: authResult.admin._id }));
      }
      try {
        await ActivityLog.create({ adminId: authResult.admin._id, action: 'ai_enrichment_draft', details: `Generated and stored ${suggestions.length} review-only ${type} drafts`, entityType: 'data_quality', entityId: '' });
      } catch (e) { console.error('[ActivityLog]', e); }
      return NextResponse.json({ type, requested: input.length, generated: suggestions.length, suggestions, draftIds: storedDrafts.map((draft: any) => draft._id.toString()), reviewOnly: true, persisted: true });
    } catch (error) {
      console.error('[AI enrichment]', error);
      return NextResponse.json({ error: error instanceof Error ? error.message : 'AI enrichment failed' }, { status: 502 });
    }
  }
  // POST /api/admin/data-quality/repair-import
  // Applies a reviewed repair work pack. No row is accepted without a valid
  // existing Phone ID, and a dry run is supported before any database write.
  if (segments.length >= 3 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'repair-import') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:fix');
    if (permCheck) return permCheck;

    const body = await req.json();
    const type = String(body.type || '');
    const dryRun = body.dryRun !== false;
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!['specs', 'images', 'prices'].includes(type)) {
      return NextResponse.json({ error: 'type must be specs, images, or prices' }, { status: 400 });
    }
    if (rows.length === 0 || rows.length > 500) {
      return NextResponse.json({ error: 'Provide between 1 and 500 repair rows' }, { status: 400 });
    }

    const isHttpUrl = (value: unknown) => {
      try {
        const url = new URL(String(value || '').trim());
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch { return false; }
    };
    const clean = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max);
    const results: Array<{ row: number; phoneId: string; status: 'ready' | 'updated' | 'skipped' | 'error'; message: string }> = [];
    let ready = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index] || {};
      const phoneId = clean(row.phoneId || row['Phone ID'], 40);
      if (!Types.ObjectId.isValid(phoneId)) {
        failed++; results.push({ row: index + 2, phoneId, status: 'error', message: 'Invalid Phone ID' }); continue;
      }
      const phone = await Phone.findOne({ _id: phoneId, deletedAt: null });
      if (!phone) {
        failed++; results.push({ row: index + 2, phoneId, status: 'error', message: 'Phone not found' }); continue;
      }

      try {
        if (type === 'prices') {
          const price = Number(row.newPricePKR ?? row['New Price PKR'] ?? row.pricePKR ?? row['Price PKR']);
          if (!Number.isFinite(price) || price <= 0 || price > 10000000) {
            skipped++; results.push({ row: index + 2, phoneId, status: 'skipped', message: 'Valid New Price PKR is required' }); continue;
          }
          const sourceName = clean(row.sourceName || row['Source Name'], 120);
          const sourceUrl = clean(row.sourceUrl || row['Source URL'], 1000);
          if (sourceUrl && !isHttpUrl(sourceUrl)) {
            failed++; results.push({ row: index + 2, phoneId, status: 'error', message: 'Source URL must be http(s)' }); continue;
          }
          if (!dryRun) {
            const previous = Number(phone.pricePKR || 0);
            phone.previousPrice = previous;
            phone.pricePKR = price;
            phone.currentPrice = price;
            phone.lowestPrice = phone.lowestPrice > 0 ? Math.min(phone.lowestPrice, price) : price;
            phone.highestPrice = Math.max(Number(phone.highestPrice || 0), price);
            phone.priceChange = previous > 0 ? price - previous : 0;
            phone.percentageChange = previous > 0 ? ((price - previous) / previous) * 100 : 0;
            phone.sourceName = sourceName || phone.sourceName;
            phone.sourceUrl = sourceUrl || phone.sourceUrl;
            phone.lastPriceCheckedAt = new Date();
            phone.lastPriceChangedAt = previous !== price ? new Date() : phone.lastPriceChangedAt;
            phone.dataConfidence = 'user-submitted';
            phone.updatedBy = authResult.admin._id;
            await phone.save();
          }
        } else if (type === 'images') {
          const thumbnail = clean(row.thumbnailUrl || row['Thumbnail URL'] || row.thumbnail, 1500);
          if (!isHttpUrl(thumbnail)) {
            skipped++; results.push({ row: index + 2, phoneId, status: 'skipped', message: 'Valid Thumbnail URL is required' }); continue;
          }
          if (!dryRun) {
            phone.thumbnail = thumbnail;
            phone.dataConfidence = 'user-submitted';
            phone.updatedBy = authResult.admin._id;
            await phone.save();
          }
        } else {
          const specInput: Record<string, string> = {
            display: clean(row.display || row.Display),
            chipset: clean(row.chipset || row.Chipset),
            ram: clean(row.ram || row.RAM),
            storage: clean(row.storage || row.Storage),
            battery: clean(row.battery || row.Battery),
            mainCamera: clean(row.mainCamera || row['Main Camera']),
            fiveG: clean(row.fiveG || row['5G']),
          };
          const populated = Object.entries(specInput).filter(([, value]) => value);
          if (populated.length === 0) {
            skipped++; results.push({ row: index + 2, phoneId, status: 'skipped', message: 'At least one specification value is required' }); continue;
          }
          const numericFrom = (value: string, pattern: RegExp) => {
            const match = value.match(pattern); return match ? Number(match[1]) : null;
          };
          if (!dryRun) {
            const update: Record<string, unknown> = { ...specInput };
            const ramGB = numericFrom(specInput.ram, /(\d+(?:\.\d+)?)\s*gb/i);
            const storageGB = numericFrom(specInput.storage, /(\d+(?:\.\d+)?)\s*gb/i);
            const batteryMAh = numericFrom(specInput.battery, /(\d+(?:\.\d+)?)\s*mah/i);
            const mainCameraMP = numericFrom(specInput.mainCamera, /(\d+(?:\.\d+)?)\s*mp/i);
            if (ramGB) update.ramGB = ramGB;
            if (storageGB) update.storageGB = storageGB;
            if (batteryMAh) update.batteryMAh = batteryMAh;
            if (mainCameraMP) update.mainCameraMP = mainCameraMP;
            await PhoneSpecs.updateOne({ phoneId }, { $set: update, $setOnInsert: { phoneId } }, { upsert: true });
            phone.dataConfidence = 'user-submitted';
            phone.updatedBy = authResult.admin._id;
            await phone.save();
          }
        }

        if (dryRun) { ready++; results.push({ row: index + 2, phoneId, status: 'ready', message: 'Validated and ready to apply' }); }
        else { updated++; results.push({ row: index + 2, phoneId, status: 'updated', message: 'Repair applied' }); }
      } catch (error) {
        failed++;
        results.push({ row: index + 2, phoneId, status: 'error', message: error instanceof Error ? error.message : 'Update failed' });
      }
    }

    if (!dryRun && updated > 0) {
      try {
        await ActivityLog.create({
          adminId: authResult.admin._id,
          action: 'data_quality_repair_import',
          details: `Applied ${updated} ${type} repairs from reviewed CSV (${failed} failed, ${skipped} skipped)`,
          entityType: 'data_quality',
          entityId: '',
        });
      } catch (e) { console.error('[ActivityLog]', e); }
    }

    return NextResponse.json({ dryRun, type, total: rows.length, ready, updated, skipped, failed, results: results.slice(0, 100) });
  }
  // POST /api/admin/data-quality/scans
  if (segments.length >= 3 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'scans') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:scan');
    if (permCheck) return permCheck;

    const body = await req.json();
    const { type, entityIds, entityType, importId, dryRun, rules, execute: shouldExecute } = body;

    const scanType = type || 'full';
    const validTypes = ['full', 'incremental', 'entity', 'import', 'manual'];
    if (!validTypes.includes(scanType)) {
      return NextResponse.json({ error: 'Invalid scan type' }, { status: 400 });
    }

    const { scanId } = await startScan({
      type: scanType as 'full' | 'incremental' | 'entity' | 'import' | 'manual',
      adminId: authResult.admin._id.toString(),
      entityIds: entityIds || [],
      entityType: entityType || '',
      importId: importId || '',
      dryRun: dryRun || false,
      rules: rules || [],
    });

    // Execute scan asynchronously (fire and forget for large scans)
    if (shouldExecute !== false) {
      executeScan(scanId).catch(e => {
        console.error(`[DataQuality] Scan ${scanId} failed:`, e);
      });
    }

    return NextResponse.json({ scanId, status: 'queued' });
  }

  // POST /api/admin/data-quality/issues/:id/resolve
  if (segments.length >= 5 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'issues' && segments[4] === 'resolve') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:fix');
    if (permCheck) return permCheck;

    const issueId = segments[3];
    const body = await req.json();
    const resolution = (body.resolution || 'Manually resolved').slice(0, 500);

    const issue = await DataQualityIssue.findById(issueId);
    if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });

    await DataQualityIssue.updateOne(
      { _id: issueId },
      {
        $set: {
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedBy: authResult.admin._id,
          resolution,
        },
      },
    );

    try {
      await ActivityLog.create({
        adminId: authResult.admin._id,
        action: 'data_quality_resolve',
        details: `Resolved issue ${(issue as unknown as { issueKey: string }).issueKey}: ${resolution}`,
        entityType: 'data_quality',
        entityId: issueId,
      });
    } catch (e) { console.error('[ActivityLog]', e); }

    return NextResponse.json({ success: true });
  }

  // POST /api/admin/data-quality/issues/:id/ignore
  if (segments.length >= 5 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'issues' && segments[4] === 'ignore') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:fix');
    if (permCheck) return permCheck;

    const issueId = segments[3];
    await DataQualityIssue.updateOne(
      { _id: issueId },
      { $set: { status: 'ignored' } },
    );

    return NextResponse.json({ success: true });
  }

  // POST /api/admin/data-quality/issues/:id/fix
  if (segments.length >= 5 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'issues' && segments[4] === 'fix') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:fix');
    if (permCheck) return permCheck;

    const issueId = segments[3];
    const body = await req.json();
    const dryRun = body.dryRun === true;

    try {
      const result = await executeAutoFix(issueId, authResult.admin._id.toString(), dryRun);
      return NextResponse.json({ ...result, dryRun });
    } catch (e: unknown) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Auto-fix failed' }, { status: 400 });
    }
  }

  // POST /api/admin/data-quality/bulk-fix
  if (segments.length >= 3 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'bulk-fix') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:fix');
    if (permCheck) return permCheck;

    const body = await req.json();
    const { issueIds, action, dryRun } = body;

    if (!Array.isArray(issueIds) || issueIds.length === 0) {
      return NextResponse.json({ error: 'issueIds array is required' }, { status: 400 });
    }

    if (!['resolve', 'ignore', 'fix'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Use resolve, ignore, or fix' }, { status: 400 });
    }

    if (issueIds.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 issues per bulk operation' }, { status: 400 });
    }

    const results = { total: issueIds.length, succeeded: 0, failed: 0, errors: [] as string[] };

    for (const issueId of issueIds) {
      try {
        if (action === 'resolve') {
          await DataQualityIssue.updateOne(
            { _id: issueId },
            { $set: { status: 'resolved', resolvedAt: new Date(), resolvedBy: authResult.admin._id, resolution: 'Bulk resolved' } },
          );
          results.succeeded++;
        } else if (action === 'ignore') {
          await DataQualityIssue.updateOne({ _id: issueId }, { $set: { status: 'ignored' } });
          results.succeeded++;
        } else if (action === 'fix') {
          if (dryRun) {
            results.succeeded++;
          } else {
            await executeAutoFix(issueId, authResult.admin._id.toString(), false);
            results.succeeded++;
          }
        }
      } catch (e: unknown) {
        results.failed++;
        results.errors.push(`${issueId}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    try {
      await ActivityLog.create({
        adminId: authResult.admin._id,
        action: 'data_quality_bulk_' + action,
        details: `Bulk ${action} on ${results.succeeded} issues (${results.failed} failed)${dryRun ? ' (dry run)' : ''}`,
        entityType: 'data_quality',
        entityId: '',
      });
    } catch (e) { console.error('[ActivityLog]', e); }

    return NextResponse.json(results);
  }

  // POST /api/admin/data-quality/re-scan
  if (segments.length >= 3 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 're-scan') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:scan');
    if (permCheck) return permCheck;

    const body = await req.json();
    const { entityIds } = body;

    if (!Array.isArray(entityIds) || entityIds.length === 0) {
      return NextResponse.json({ error: 'entityIds array is required' }, { status: 400 });
    }

    if (entityIds.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 entities per re-scan' }, { status: 400 });
    }

    const { scanId } = await startScan({
      type: 'entity',
      adminId: authResult.admin._id.toString(),
      entityIds,
      entityType: 'phone',
    });

    executeScan(scanId).catch(e => console.error('[DataQuality] Re-scan failed:', e));

    return NextResponse.json({ scanId, status: 'queued' });
  }

  // POST /api/admin/data-quality/duplicates/:id/merge
  if (segments.length >= 5 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'duplicates' && segments[4] === 'merge') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:fix');
    if (permCheck) return permCheck;

    const _groupId = segments[3]; // Used as URL path segment identifier
    const body = await req.json();
    const { keepId, mergeIntoId, dryRun } = body;

    if (!keepId || !mergeIntoId) {
      return NextResponse.json({ error: 'keepId and mergeIntoId are required' }, { status: 400 });
    }

    if (keepId === mergeIntoId) {
      return NextResponse.json({ error: 'Cannot merge into itself' }, { status: 400 });
    }

    if (dryRun) {
      // Preview what would happen
      const keepPhone = await Phone.findById(keepId).lean();
      const mergePhone = await Phone.findById(mergeIntoId).lean();
      if (!keepPhone || !mergePhone) {
        return NextResponse.json({ error: 'One or both phones not found' }, { status: 404 });
      }

      const [keepSpecs, mergeSpecs, , mergeImages, keepBench, mergeBench] = await Promise.all([
        PhoneSpecs.findOne({ phoneId: keepId }).lean(),
        PhoneSpecs.findOne({ phoneId: mergeIntoId }).lean(),
        PhoneImage.find({ phoneId: mergeIntoId }).lean(),
        PhonePrice.find({ phoneId: mergeIntoId }).lean(),
        PhoneBenchmark.findOne({ phoneId: keepId }).lean(),
        PhoneBenchmark.findOne({ phoneId: mergeIntoId }).lean(),
      ]);

      return NextResponse.json({
        dryRun: true,
        keep: { id: keepId, modelName: keepPhone.modelName, hasSpecs: !!keepSpecs, hasBench: !!keepBench },
        merge: {
          id: mergeIntoId, modelName: mergePhone.modelName, hasSpecs: !!mergeSpecs,
          imageCount: mergeImages.length, priceCount: mergeImages.length, hasBench: !!mergeBench,
          wouldMoveImages: mergeImages.length,
          wouldMovePrices: (await PhonePrice.find({ phoneId: mergeIntoId }).lean()).length,
          wouldMoveBench: !!mergeBench,
          wouldDelete: true,
        },
      });
    }

    // Actual merge — move child records
    try {
      const [movedImages, movedPrices] = await Promise.all([
        PhoneImage.updateMany({ phoneId: mergeIntoId }, { $set: { phoneId: new Types.ObjectId(keepId) } }),
        PhonePrice.updateMany({ phoneId: mergeIntoId }, { $set: { phoneId: new Types.ObjectId(keepId) } }),
        PhoneBenchmark.updateOne({ phoneId: mergeIntoId }, { $set: { phoneId: new Types.ObjectId(keepId) } }),
      ]);

      // Merge specs if keep doesn't have them but merge does
      const keepSpecs = await PhoneSpecs.findOne({ phoneId: keepId });
      const mergeSpecs = await PhoneSpecs.findOne({ phoneId: mergeIntoId });
      if (!keepSpecs && mergeSpecs) {
        mergeSpecs.phoneId = new Types.ObjectId(keepId);
        await mergeSpecs.save();
      } else if (mergeSpecs) {
        await PhoneSpecs.deleteOne({ phoneId: mergeIntoId });
      }

      // Soft-delete the merged phone
      await Phone.updateOne(
        { _id: mergeIntoId },
        { $set: { deletedAt: new Date(), status: 'archived' } },
      );

      // Resolve duplicate issues
      await DataQualityIssue.updateMany(
        { entityId: { $in: [keepId, mergeIntoId] }, issueType: { $in: ['PHONE_DUPLICATE_SLUG', 'PHONE_DUPLICATE_NORMALIZED'] }, status: 'open' },
        { $set: { status: 'resolved', resolvedAt: new Date(), resolvedBy: authResult.admin._id, resolution: `Merged ${mergeIntoId} into ${keepId}` } },
      );

      try {
        await ActivityLog.create({
          adminId: authResult.admin._id,
          action: 'data_quality_merge',
          details: `Merged phone ${mergeIntoId} into ${keepId}`,
          entityType: 'phone',
          entityId: keepId,
        });
      } catch (e) { console.error('[ActivityLog]', e); }

      return NextResponse.json({ success: true, movedImages: movedImages.modifiedCount, movedPrices: movedPrices.modifiedCount });
    } catch (e: unknown) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Merge failed' }, { status: 500 });
    }
  }

  // POST /api/admin/data-quality/scans/:id/execute
  if (segments.length >= 5 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'scans' && segments[4] === 'execute') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:scan');
    if (permCheck) return permCheck;

    const scanId = segments[3];
    const job = await ScanJob.findOne({ scanId });
    if (!job) return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    if (job.status === 'running') return NextResponse.json({ error: 'Scan already running' }, { status: 409 });
    if (job.status === 'completed' || job.status === 'completed_with_errors') {
      return NextResponse.json({ error: 'Scan already completed. Start a new scan.' }, { status: 400 });
    }

    executeScan(scanId).catch(e => {
      console.error(`[DataQuality] Scan ${scanId} execute failed:`, e);
    });

    return NextResponse.json({ scanId, status: 'running' });
  }

  // POST /api/admin/data-quality/cleanup
  if (segments.length >= 3 && segments[0] === 'admin' && segments[1] === 'data-quality' && segments[2] === 'cleanup') {
    const authResult = await getAdminFromRequest(req);
    if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'data-quality:delete');
    if (permCheck) return permCheck;

    const body = await req.json();
    const { olderThanDays, status: targetStatus } = body;
    const days = Math.max(1, Math.min(365, olderThanDays || 30));
    const status = targetStatus || 'resolved';
    const validStatuses = ['resolved', 'auto_fixed', 'false_positive'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await DataQualityIssue.deleteMany({
      status,
      $or: [
        { resolvedAt: { $lt: cutoff } },
        { resolvedAt: null, updatedAt: { $lt: cutoff } },
      ],
    });

    try {
      await ActivityLog.create({
        adminId: authResult.admin._id,
        action: 'data_quality_cleanup',
        details: `Cleaned up ${result.deletedCount} ${status} issues older than ${days} days`,
        entityType: 'data_quality',
        entityId: '',
      });
    } catch (e) { console.error('[ActivityLog]', e); }

    return NextResponse.json({ deleted: result.deletedCount, status, olderThanDays: days });
  }

  return undefined;
}
