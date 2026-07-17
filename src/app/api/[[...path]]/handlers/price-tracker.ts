import { NextRequest, NextResponse } from 'next/server';
import { Phone, Brand, ActivityLog, PriceHistory } from '@/lib/models';
import { PriceSource, PhoneRetailListing, PriceTrackerHistory } from '@/lib/models/PriceTracker';
import { connectDB, getAdminFromRequest, requirePermission } from './helpers';

// ============ PRICE TRACKER GET ============

export async function handlePriceTrackerGet(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/admin/price-tracker/stats ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'stats') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:read'); if (permCheck) return permCheck;
    await connectDB();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalPhonesWithPrices,
      manualCount,
      automaticCount,
      priceDropsToday,
      priceIncreasesToday,
      pendingReview,
      failedChecks,
      lastSuccessfulUpdate,
      totalSources,
      enabledSources,
    ] = await Promise.all([
      Phone.countDocuments({ currentPrice: { $gt: 0 } }),
      Phone.countDocuments({ priceMode: 'manual', currentPrice: { $gt: 0 } }),
      Phone.countDocuments({ priceMode: 'automatic', currentPrice: { $gt: 0 } }),
      PriceTrackerHistory.countDocuments({ changeType: 'decrease', capturedAt: { $gte: todayStart } }),
      PriceTrackerHistory.countDocuments({ changeType: 'increase', capturedAt: { $gte: todayStart } }),
      PriceTrackerHistory.countDocuments({ verificationStatus: 'pending' }),
      PriceSource.countDocuments({ status: 'failed' }),
      PriceTrackerHistory.findOne({ verificationStatus: { $ne: 'pending' } }).sort({ capturedAt: -1 }).lean(),
      PriceSource.countDocuments({}),
      PriceSource.countDocuments({ enabled: true, status: 'active' }),
    ]);

    return NextResponse.json({
      totalPhonesWithPrices,
      manualCount,
      automaticCount,
      priceDropsToday,
      priceIncreasesToday,
      pendingReview,
      failedChecks,
      lastSuccessfulUpdate: lastSuccessfulUpdate?.capturedAt || null,
      totalSources,
      enabledSources,
    });
  }

  // ---- /api/admin/price-tracker/phones ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'phones') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:read'); if (permCheck) return permCheck;
    await connectDB();

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;
    const search = (url.searchParams.get('search') || '').trim();
    const mode = url.searchParams.get('mode') || 'all';
    const status = url.searchParams.get('status');
    const sort = url.searchParams.get('sort') || 'lastPriceChangedAt';

    const filter: any = { active: true, currentPrice: { $gt: 0 } };

    // Mode filter
    if (mode === 'manual') filter.priceMode = 'manual';
    else if (mode === 'automatic') filter.priceMode = 'automatic';

    // Status filter
    if (status === 'locked') filter.manualLock = true;
    else if (status === 'unlocked') filter.manualLock = false;
    else if (status === 'price-drop') filter.priceChange = { $lt: 0 };
    else if (status === 'price-increase') filter.priceChange = { $gt: 0 };

    // Search
    if (search.length >= 2) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const brandMatches = await Brand.find({ name: { $regex: safe, $options: 'i' } }).select('_id').lean();
      const brandIds = brandMatches.map((b: any) => b._id);
      const searchOr: any[] = [{ modelName: { $regex: safe, $options: 'i' } }, { slug: { $regex: safe, $options: 'i' } }];
      if (brandIds.length > 0) searchOr.push({ brandId: { $in: brandIds } });
      filter.$or = searchOr;
    }

    // Sort
    let sortObj: any = { lastPriceChangedAt: -1 };
    if (sort === 'currentPrice') sortObj = { currentPrice: 1 };
    else if (sort === 'currentPrice-desc') sortObj = { currentPrice: -1 };
    else if (sort === 'lastPriceChangedAt') sortObj = { lastPriceChangedAt: -1 };
    else if (sort === 'priceChange') sortObj = { priceChange: -1 };
    else if (sort === 'percentageChange') sortObj = { percentageChange: -1 };

    const [phones, total] = await Promise.all([
      Phone.find(filter).sort(sortObj).skip(skip).limit(limit).populate('brand').lean(),
      Phone.countDocuments(filter),
    ]);

    return NextResponse.json({
      phones: phones.map((p: any) => ({
        id: p._id?.toString(),
        modelName: p.modelName,
        slug: p.slug,
        brand: p.brand ? { id: p.brand._id?.toString(), name: p.brand.name } : undefined,
        thumbnail: p.thumbnail || '',
        currentPrice: p.currentPrice || 0,
        previousPrice: p.previousPrice || 0,
        lowestPrice: p.lowestPrice || 0,
        highestPrice: p.highestPrice || 0,
        priceChange: p.priceChange || 0,
        percentageChange: p.percentageChange || 0,
        lastPriceCheckedAt: p.lastPriceCheckedAt || null,
        lastPriceChangedAt: p.lastPriceChangedAt || null,
        priceMode: p.priceMode || 'manual',
        manualLock: p.manualLock || false,
        manualLockReason: p.manualLockReason || '',
      })),
      total, page, limit, totalPages: Math.ceil(total / limit),
    });
  }

  // ---- /api/admin/price-tracker/sources ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'sources') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:read'); if (permCheck) return permCheck;
    await connectDB();

    const sources = await PriceSource.find().sort({ priority: -1, createdAt: 1 }).lean();
    return NextResponse.json({
      sources: sources.map((s: any) => ({
        id: s._id?.toString(),
        name: s.name,
        sourceType: s.sourceType,
        enabled: s.enabled,
        trusted: s.trusted,
        baseUrl: s.baseUrl || '',
        allowedDomains: s.allowedDomains || [],
        priority: s.priority || 0,
        lastCheckedAt: s.lastCheckedAt || null,
        lastSuccessAt: s.lastSuccessAt || null,
        failureCount: s.failureCount || 0,
        status: s.status || 'active',
        notes: s.notes || '',
      })),
    });
  }

  // ---- /api/admin/price-tracker/changes ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'changes') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:read'); if (permCheck) return permCheck;
    await connectDB();

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;
    const changeType = url.searchParams.get('changeType');
    const sourceType = url.searchParams.get('sourceType');

    const filter: any = {};
    if (changeType && ['increase', 'decrease', 'unchanged', 'correction'].includes(changeType)) {
      filter.changeType = changeType;
    }
    if (sourceType && ['manual', 'retailer', 'correction'].includes(sourceType)) {
      filter.sourceType = sourceType;
    }

    const [changes, total] = await Promise.all([
      PriceTrackerHistory.find(filter).sort({ capturedAt: -1 }).skip(skip).limit(limit).populate('phoneId', 'modelName slug thumbnail brand').populate('sourceId', 'name sourceType').populate('changedByAdminId', 'name email').lean(),
      PriceTrackerHistory.countDocuments(filter),
    ]);

    return NextResponse.json({
      changes: changes.map((c: any) => ({
        id: c._id?.toString(),
        phoneId: c.phoneId?._id?.toString(),
        phoneName: (c.phoneId as any)?.modelName || '',
        phoneSlug: (c.phoneId as any)?.slug || '',
        phoneThumbnail: (c.phoneId as any)?.thumbnail || '',
        brandName: (c.phoneId as any)?.brand?.name || '',
        oldPrice: c.oldPrice || 0,
        newPrice: c.newPrice || 0,
        difference: c.difference || 0,
        percentageChange: c.percentageChange || 0,
        changeType: c.changeType || 'unchanged',
        sourceType: c.sourceType || 'manual',
        sourceName: (c.sourceId as any)?.name || '',
        sourceUrl: c.sourceUrl || '',
        verificationStatus: c.verificationStatus || 'confirmed',
        capturedAt: c.capturedAt || c.createdAt || null,
        changedBy: c.changedByAdminId ? { name: (c.changedByAdminId as any).name, email: (c.changedByAdminId as any).email } : undefined,
      })),
      total, page, limit, totalPages: Math.ceil(total / limit),
    });
  }

  // ---- /api/admin/price-tracker/pending ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'pending') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:read'); if (permCheck) return permCheck;
    await connectDB();

    const pending = await PriceTrackerHistory.find({ verificationStatus: 'pending' })
      .sort({ capturedAt: -1 })
      .populate('phoneId', 'modelName slug thumbnail currentPrice brand')
      .populate('sourceId', 'name sourceType')
      .lean();

    return NextResponse.json({
      pending: pending.map((c: any) => ({
        id: c._id?.toString(),
        phoneId: c.phoneId?._id?.toString(),
        phoneName: (c.phoneId as any)?.modelName || '',
        phoneSlug: (c.phoneId as any)?.slug || '',
        phoneThumbnail: (c.phoneId as any)?.thumbnail || '',
        phoneCurrentPrice: (c.phoneId as any)?.currentPrice || 0,
        brandName: (c.phoneId as any)?.brand?.name || '',
        oldPrice: c.oldPrice || 0,
        newPrice: c.newPrice || 0,
        difference: c.difference || 0,
        percentageChange: c.percentageChange || 0,
        changeType: c.changeType || 'unchanged',
        sourceType: c.sourceType || 'manual',
        sourceName: (c.sourceId as any)?.name || '',
        sourceUrl: c.sourceUrl || '',
        capturedAt: c.capturedAt || c.createdAt || null,
      })),
    });
  }

  // ---- /api/admin/price-tracker/history/:phoneId ----
  if (segments.length === 4 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'history') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:read'); if (permCheck) return permCheck;
    await connectDB();

    const phoneId = segments[3];
    if (!phoneId) return NextResponse.json({ error: 'Phone ID required' }, { status: 400 });

    const history = await PriceTrackerHistory.find({ phoneId })
      .sort({ capturedAt: -1 })
      .populate('sourceId', 'name sourceType')
      .populate('changedByAdminId', 'name email')
      .lean();

    return NextResponse.json({
      history: history.map((h: any) => ({
        id: h._id?.toString(),
        oldPrice: h.oldPrice || 0,
        newPrice: h.newPrice || 0,
        difference: h.difference || 0,
        percentageChange: h.percentageChange || 0,
        changeType: h.changeType || 'unchanged',
        sourceType: h.sourceType || 'manual',
        sourceName: (h.sourceId as any)?.name || '',
        sourceUrl: h.sourceUrl || '',
        verificationStatus: h.verificationStatus || 'confirmed',
        capturedAt: h.capturedAt || h.createdAt || null,
        changedBy: h.changedByAdminId ? { name: (h.changedByAdminId as any).name, email: (h.changedByAdminId as any).email } : undefined,
      })),
    });
  }

  // ---- /api/admin/price-tracker/listings/:phoneId ----
  if (segments.length === 4 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'listings') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:read'); if (permCheck) return permCheck;
    await connectDB();

    const phoneId = segments[3];
    if (!phoneId) return NextResponse.json({ error: 'Phone ID required' }, { status: 400 });

    const listings = await PhoneRetailListing.find({ phoneId })
      .sort({ createdAt: -1 })
      .populate('sourceId', 'name sourceType baseUrl allowedDomains')
      .lean();

    return NextResponse.json({
      listings: listings.map((l: any) => ({
        id: l._id?.toString(),
        sourceId: l.sourceId?._id?.toString(),
        sourceName: (l.sourceId as any)?.name || '',
        sourceType: (l.sourceId as any)?.sourceType || '',
        productUrl: l.productUrl || '',
        ram: l.ram || '',
        storage: l.storage || '',
        ptaStatus: l.ptaStatus || '',
        warrantyType: l.warrantyType || '',
        currentSourcePrice: l.currentSourcePrice || 0,
        previousSourcePrice: l.previousSourcePrice || 0,
        availability: l.availability || 'unknown',
        lastCheckedAt: l.lastCheckedAt || null,
        lastChangedAt: l.lastChangedAt || null,
        enabled: l.enabled ?? true,
        verificationStatus: l.verificationStatus || 'pending',
      })),
    });
  }

  return undefined;
}

// ============ PRICE TRACKER POST ============

export async function handlePriceTrackerPost(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/admin/price-tracker/update-price ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'update-price') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const body = await req.json();
    const { phoneId, newPrice, reason, ptaStatus, warrantyType } = body;

    if (!phoneId) return NextResponse.json({ error: 'phoneId is required' }, { status: 400 });
    if (!newPrice || newPrice <= 0 || typeof newPrice !== 'number') {
      return NextResponse.json({ error: 'newPrice must be a positive number' }, { status: 400 });
    }

    const phone = await Phone.findById(phoneId);
    if (!phone) return NextResponse.json({ error: 'Phone not found' }, { status: 404 });

    const oldPrice = (phone as any).currentPrice || 0;
    const difference = newPrice - oldPrice;
    const percentageChange = oldPrice > 0 ? Math.round((difference / oldPrice) * 10000) / 100 : 0;

    let changeType: 'increase' | 'decrease' | 'unchanged' | 'correction' = 'unchanged';
    if (difference > 0) changeType = 'increase';
    else if (difference < 0) changeType = 'decrease';
    else if (oldPrice === 0 && newPrice > 0) changeType = 'correction';

    // Update Phone document
    const updates: any = {
      currentPrice: newPrice,
      previousPrice: oldPrice,
      priceChange: difference,
      percentageChange: percentageChange,
      lastPriceChangedAt: new Date(),
      priceMode: 'manual',
      lastPriceCheckedAt: new Date(),
    };

    // Track lowest/highest
    const lowest = (phone as any).lowestPrice || 0;
    const highest = (phone as any).highestPrice || 0;
    if (newPrice < lowest || lowest === 0) updates.lowestPrice = newPrice;
    if (newPrice > highest) updates.highestPrice = newPrice;

    if (ptaStatus) updates.ptaStatus = ptaStatus;
    if (warrantyType) updates.warrantyType = warrantyType;

    // Also update the legacy pricePKR field
    updates.pricePKR = newPrice;

    await Phone.findByIdAndUpdate(phoneId, { $set: updates });

    // Create PriceTrackerHistory record
    try {
      await PriceTrackerHistory.create({
        phoneId: phone._id,
        oldPrice,
        newPrice,
        difference,
        percentageChange,
        changeType,
        sourceType: 'manual',
        changedByAdminId: admin._id,
        verificationStatus: 'confirmed',
        capturedAt: new Date(),
      });
    } catch (e) { console.error('[PriceTrackerHistory]', e); }

    // Create legacy PriceHistory record for backward compat
    try {
      await PriceHistory.create({ phoneId: phone._id, storeName: null, price: newPrice });
    } catch (e) { console.error('[PriceHistory]', e); }

    // Create ActivityLog
    try {
      await ActivityLog.create({
        adminId: admin._id,
        action: 'update_price',
        details: `${changeType === 'unchanged' ? 'Set' : changeType === 'increase' ? 'Increased' : changeType === 'decrease' ? 'Decreased' : 'Corrected'} price for ${phone.modelName}: PKR ${oldPrice.toLocaleString()} → PKR ${newPrice.toLocaleString()}${reason ? ` (${reason})` : ''}`,
        entityType: 'phone',
        entityId: phone._id?.toString(),
      });
    } catch (e) { console.error('[ActivityLog]', e); }

    const updated = await Phone.findById(phoneId).lean();
    return NextResponse.json({
      success: true,
      id: phone._id?.toString(),
      currentPrice: (updated as any)?.currentPrice || newPrice,
      previousPrice: (updated as any)?.previousPrice || oldPrice,
      difference,
      percentageChange,
      changeType,
    });
  }

  // ---- /api/admin/price-tracker/sources ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'sources') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const body = await req.json();
    const { name, sourceType, baseUrl, allowedDomains, priority } = body;

    if (!name || !name.trim()) return NextResponse.json({ error: 'Source name is required' }, { status: 400 });

    // Check uniqueness
    const existing = await PriceSource.findOne({ name: name.trim() });
    if (existing) return NextResponse.json({ error: 'Source name already exists' }, { status: 409 });

    // Validate baseUrl must be HTTPS
    if (baseUrl && !baseUrl.startsWith('https://')) {
      return NextResponse.json({ error: 'baseUrl must use HTTPS' }, { status: 400 });
    }

    const source = await PriceSource.create({
      name: name.trim(),
      sourceType: sourceType || 'retailer',
      baseUrl: baseUrl || '',
      allowedDomains: allowedDomains || [],
      priority: typeof priority === 'number' ? priority : 0,
    });

    try {
      await ActivityLog.create({
        adminId: admin._id,
        action: 'create_price_source',
        details: `Created price source: ${name.trim()}`,
        entityType: 'price_source',
        entityId: source._id?.toString(),
      });
    } catch (e) { console.error('[ActivityLog]', e); }

    return NextResponse.json({
      success: true,
      id: source._id?.toString(),
      name: source.name,
      sourceType: source.sourceType,
      enabled: source.enabled,
      trusted: source.trusted,
    });
  }

  // ---- /api/admin/price-tracker/listings ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'listings') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const body = await req.json();
    const { phoneId, sourceId, productUrl, ram, storage, ptaStatus, warrantyType } = body;

    if (!phoneId) return NextResponse.json({ error: 'phoneId is required' }, { status: 400 });
    if (!sourceId) return NextResponse.json({ error: 'sourceId is required' }, { status: 400 });
    if (!productUrl) return NextResponse.json({ error: 'productUrl is required' }, { status: 400 });

    // Validate URL: must be HTTPS
    if (!productUrl.startsWith('https://')) {
      return NextResponse.json({ error: 'productUrl must use HTTPS' }, { status: 400 });
    }
    // No localhost
    if (/localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/i.test(productUrl)) {
      return NextResponse.json({ error: 'productUrl must not point to localhost' }, { status: 400 });
    }
    // No private IPs
    if (/(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})/.test(productUrl)) {
      return NextResponse.json({ error: 'productUrl must not use private IP addresses' }, { status: 400 });
    }

    // Verify phone exists
    const phone = await Phone.findById(phoneId);
    if (!phone) return NextResponse.json({ error: 'Phone not found' }, { status: 404 });

    // Verify source exists and get allowed domains
    const source = await PriceSource.findById(sourceId);
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });

    // Validate domain is in source's allowedDomains
    let urlDomain = '';
    try {
      urlDomain = new URL(productUrl).hostname;
    } catch {
      return NextResponse.json({ error: 'Invalid productUrl' }, { status: 400 });
    }

    if (source.allowedDomains && source.allowedDomains.length > 0) {
      const domainAllowed = source.allowedDomains.some((d: string) => {
        const clean = d.replace(/^\./, '');
        return urlDomain === clean || urlDomain.endsWith('.' + clean);
      });
      if (!domainAllowed) {
        return NextResponse.json({ error: `Domain "${urlDomain}" is not in the source's allowed domains` }, { status: 400 });
      }
    }

    const listing = await PhoneRetailListing.create({
      phoneId,
      sourceId,
      productUrl,
      ram: ram || '',
      storage: storage || '',
      ptaStatus: ptaStatus || '',
      warrantyType: warrantyType || '',
      verificationStatus: 'pending',
    });

    try {
      await ActivityLog.create({
        adminId: admin._id,
        action: 'create_retail_listing',
        details: `Added retail listing for ${phone.modelName} from ${source.name}`,
        entityType: 'phone',
        entityId: phone._id?.toString(),
      });
    } catch (e) { console.error('[ActivityLog]', e); }

    return NextResponse.json({
      success: true,
      id: listing._id?.toString(),
      verificationStatus: listing.verificationStatus,
    });
  }

  // ---- /api/admin/price-tracker/test-source ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'test-source') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const body = await req.json();
    const { url, sourceId } = body;

    if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 });

    // SSRF protection: validate URL safety
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      return NextResponse.json({ error: 'URL must use HTTP or HTTPS' }, { status: 400 });
    }
    if (/localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/i.test(url)) {
      return NextResponse.json({ error: 'URL must not point to localhost' }, { status: 400 });
    }
    if (/(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})/.test(url)) {
      return NextResponse.json({ error: 'URL must not use private IP addresses' }, { status: 400 });
    }

    let reachable = false;
    let title = '';
    let detectedPrice: number | null = null;
    let availability = 'unknown' as string;
    let matched = false;
    let safeToEnable = false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'PhoneDock-PriceChecker/1.0 (compatible; bot)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
      });
      clearTimeout(timeout);

      reachable = response.ok;

      if (response.ok) {
        const html = await response.text();

        // Extract title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) title = titleMatch[1].trim().slice(0, 200);

        // Try to extract price in PKR — look for common patterns
        const pricePatterns = [
          /(?:PKR|Rs\.?|₨)\s*([\d,]+(?:\.\d{1,2})?)/i,
          /price[^>]*>\s*(?:PKR|Rs\.?|₨)?\s*([\d,]+(?:\.\d{1,2})?)/i,
          /"price"\s*:\s*"?([\d,]+(?:\.\d{1,2})?)"?/i,
          /data-price="([\d,]+(?:\.\d{1,2})?)"/i,
        ];

        for (const pattern of pricePatterns) {
          const m = html.match(pattern);
          if (m) {
            const parsed = parseFloat(m[1].replace(/,/g, ''));
            if (parsed > 0) {
              detectedPrice = parsed;
              break;
            }
          }
        }

        // Check availability
        if (/out\s*of\s*stock|unavailable|sold\s*out/i.test(html)) {
          availability = 'unavailable';
        } else if (/add\s*to\s*cart|buy\s*now|in\s*stock|available/i.test(html)) {
          availability = 'available';
        }
      }
    } catch {
      reachable = false;
    }

    // Determine if the source is matched and safe to enable
    matched = detectedPrice !== null;
    safeToEnable = reachable && matched && availability !== 'unavailable';

    // If sourceId provided, verify domain match
    if (sourceId) {
      const source = await PriceSource.findById(sourceId).lean();
      if (source) {
        try {
          const urlDomain = new URL(url).hostname;
          if (source.allowedDomains && source.allowedDomains.length > 0) {
            const domainAllowed = source.allowedDomains.some((d: string) => {
              const clean = d.replace(/^\./, '');
              return urlDomain === clean || urlDomain.endsWith('.' + clean);
            });
            if (!domainAllowed) safeToEnable = false;
          }
        } catch { /* ignore URL parse error */ }
      }
    }

    return NextResponse.json({
      reachable,
      title: title || null,
      detectedPrice,
      availability,
      matched,
      safeToEnable,
    });
  }

  // ---- /api/admin/price-tracker/approve/:historyId ----
  if (segments.length === 4 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'approve') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const historyId = segments[3];
    if (!historyId) return NextResponse.json({ error: 'History ID required' }, { status: 400 });

    const history = await PriceTrackerHistory.findById(historyId);
    if (!history) return NextResponse.json({ error: 'History record not found' }, { status: 404 });
    if (history.verificationStatus !== 'pending') {
      return NextResponse.json({ error: `History record is already ${history.verificationStatus}` }, { status: 400 });
    }

    history.verificationStatus = 'confirmed';
    history.approvedByAdminId = admin._id;
    await history.save();

    // Apply the price change to the Phone if not already applied
    const phone = await Phone.findById(history.phoneId);
    if (phone && history.newPrice > 0) {
      const oldPrice = (phone as any).currentPrice || 0;
      // Only apply if the price hasn't already been updated to this value
      if (oldPrice !== history.newPrice) {
        const difference = history.newPrice - oldPrice;
        const percentageChange = oldPrice > 0 ? Math.round((difference / oldPrice) * 10000) / 100 : 0;

        const updates: any = {
          currentPrice: history.newPrice,
          previousPrice: oldPrice,
          priceChange: difference,
          percentageChange: percentageChange,
          lastPriceChangedAt: new Date(),
          lastPriceCheckedAt: new Date(),
          pricePKR: history.newPrice,
        };

        const lowest = (phone as any).lowestPrice || 0;
        const highest = (phone as any).highestPrice || 0;
        if (history.newPrice < lowest || lowest === 0) updates.lowestPrice = history.newPrice;
        if (history.newPrice > highest) updates.highestPrice = history.newPrice;

        await Phone.findByIdAndUpdate(history.phoneId, { $set: updates });

        // Legacy PriceHistory
        try {
          await PriceHistory.create({ phoneId: phone._id, storeName: null, price: history.newPrice });
        } catch (e) { console.error('[PriceHistory]', e); }
      }
    }

    try {
      const phoneDoc = phone || await Phone.findById(history.phoneId).select('modelName').lean();
      await ActivityLog.create({
        adminId: admin._id,
        action: 'approve_price_change',
        details: `Approved price change for ${(phoneDoc as any)?.modelName || 'unknown'}: PKR ${history.oldPrice} → PKR ${history.newPrice}`,
        entityType: 'phone',
        entityId: history.phoneId?.toString(),
      });
    } catch (e) { console.error('[ActivityLog]', e); }

    return NextResponse.json({ success: true, id: history._id?.toString(), verificationStatus: 'confirmed' });
  }

  // ---- /api/admin/price-tracker/reject/:historyId ----
  if (segments.length === 4 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'reject') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const historyId = segments[3];
    if (!historyId) return NextResponse.json({ error: 'History ID required' }, { status: 400 });

    const history = await PriceTrackerHistory.findById(historyId);
    if (!history) return NextResponse.json({ error: 'History record not found' }, { status: 404 });
    if (history.verificationStatus !== 'pending') {
      return NextResponse.json({ error: `History record is already ${history.verificationStatus}` }, { status: 400 });
    }

    history.verificationStatus = 'rejected';
    history.approvedByAdminId = admin._id;
    await history.save();

    try {
      const phoneDoc = await Phone.findById(history.phoneId).select('modelName').lean();
      await ActivityLog.create({
        adminId: admin._id,
        action: 'reject_price_change',
        details: `Rejected price change for ${(phoneDoc as any)?.modelName || 'unknown'}: PKR ${history.oldPrice} → PKR ${history.newPrice}`,
        entityType: 'phone',
        entityId: history.phoneId?.toString(),
      });
    } catch (e) { console.error('[ActivityLog]', e); }

    return NextResponse.json({ success: true, id: history._id?.toString(), verificationStatus: 'rejected' });
  }

  // ---- /api/admin/price-tracker/toggle-lock/:phoneId ----
  if (segments.length === 4 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'toggle-lock') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const phoneId = segments[3];
    if (!phoneId) return NextResponse.json({ error: 'Phone ID required' }, { status: 400 });

    const body = await req.json();
    const { lock, reason } = body;

    if (typeof lock !== 'boolean') return NextResponse.json({ error: 'lock must be a boolean' }, { status: 400 });

    const phone = await Phone.findById(phoneId);
    if (!phone) return NextResponse.json({ error: 'Phone not found' }, { status: 404 });

    await Phone.findByIdAndUpdate(phoneId, {
      $set: {
        manualLock: lock,
        manualLockReason: lock ? (reason || '').trim().slice(0, 500) : '',
      },
    });

    try {
      await ActivityLog.create({
        adminId: admin._id,
        action: lock ? 'lock_price' : 'unlock_price',
        details: `${lock ? 'Locked' : 'Unlocked'} price for ${phone.modelName}${lock && reason ? `: ${reason}` : ''}`,
        entityType: 'phone',
        entityId: phone._id?.toString(),
      });
    } catch (e) { console.error('[ActivityLog]', e); }

    return NextResponse.json({ success: true, manualLock: lock });
  }

  return undefined;
}

// ============ PRICE TRACKER PUT ============

export async function handlePriceTrackerPut(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/admin/price-tracker/sources/:id ----
  if (segments.length === 4 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'sources') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const sourceId = segments[3];
    if (!sourceId) return NextResponse.json({ error: 'Source ID required' }, { status: 400 });

    const source = await PriceSource.findById(sourceId);
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });

    const body = await req.json();
    const { name, sourceType, baseUrl, allowedDomains, priority, enabled, trusted, status, notes } = body;

    const updates: any = {};

    if (name !== undefined) {
      if (!name.trim()) return NextResponse.json({ error: 'Source name cannot be empty' }, { status: 400 });
      // Check uniqueness if name is changing
      if (name.trim() !== source.name) {
        const existing = await PriceSource.findOne({ name: name.trim(), _id: { $ne: sourceId } });
        if (existing) return NextResponse.json({ error: 'Source name already exists' }, { status: 409 });
      }
      updates.name = name.trim();
    }
    if (sourceType !== undefined) updates.sourceType = sourceType;
    if (baseUrl !== undefined) {
      if (baseUrl && !baseUrl.startsWith('https://')) {
        return NextResponse.json({ error: 'baseUrl must use HTTPS' }, { status: 400 });
      }
      updates.baseUrl = baseUrl;
    }
    if (allowedDomains !== undefined) updates.allowedDomains = allowedDomains;
    if (typeof priority === 'number') updates.priority = priority;
    if (typeof enabled === 'boolean') updates.enabled = enabled;
    if (typeof trusted === 'boolean') updates.trusted = trusted;
    if (status !== undefined && ['active', 'paused', 'failed'].includes(status)) updates.status = status;
    if (notes !== undefined) updates.notes = (notes || '').trim().slice(0, 1000);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    await PriceSource.findByIdAndUpdate(sourceId, { $set: updates });

    try {
      await ActivityLog.create({
        adminId: admin._id,
        action: 'update_price_source',
        details: `Updated price source: ${source.name}`,
        entityType: 'price_source',
        entityId: sourceId,
      });
    } catch (e) { console.error('[ActivityLog]', e); }

    return NextResponse.json({ success: true, id: sourceId });
  }

  // ---- /api/admin/price-tracker/listings/:id ----
  if (segments.length === 4 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'listings') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const listingId = segments[3];
    if (!listingId) return NextResponse.json({ error: 'Listing ID required' }, { status: 400 });

    const listing = await PhoneRetailListing.findById(listingId);
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });

    const body = await req.json();
    const { productUrl, ram, storage, ptaStatus, warrantyType, enabled, verificationStatus } = body;

    const updates: any = {};

    if (productUrl !== undefined) {
      if (!productUrl.startsWith('https://')) {
        return NextResponse.json({ error: 'productUrl must use HTTPS' }, { status: 400 });
      }
      if (/localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/i.test(productUrl)) {
        return NextResponse.json({ error: 'productUrl must not point to localhost' }, { status: 400 });
      }
      if (/(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})/.test(productUrl)) {
        return NextResponse.json({ error: 'productUrl must not use private IP addresses' }, { status: 400 });
      }
      updates.productUrl = productUrl;
    }
    if (ram !== undefined) updates.ram = ram;
    if (storage !== undefined) updates.storage = storage;
    if (ptaStatus !== undefined) updates.ptaStatus = ptaStatus;
    if (warrantyType !== undefined) updates.warrantyType = warrantyType;
    if (typeof enabled === 'boolean') updates.enabled = enabled;
    if (verificationStatus !== undefined && ['pending', 'verified', 'rejected', 'failed'].includes(verificationStatus)) {
      updates.verificationStatus = verificationStatus;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    await PhoneRetailListing.findByIdAndUpdate(listingId, { $set: updates });

    try {
      await ActivityLog.create({
        adminId: admin._id,
        action: 'update_retail_listing',
        details: `Updated retail listing ${listingId}`,
        entityType: 'retail_listing',
        entityId: listingId,
      });
    } catch (e) { console.error('[ActivityLog]', e); }

    return NextResponse.json({ success: true, id: listingId });
  }

  return undefined;
}