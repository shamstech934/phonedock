import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import Papa from 'papaparse';
import { createProvider } from '@/lib/collectors';
import { Phone, CollectorSource, CollectedPhone, CollectorJob, ActivityLog } from '@/lib/models';
import { connectDB } from '@/lib/mongodb';
import mongoose from 'mongoose';
import { validateCollectedPhone, detectDuplicates, detectConflicts, suggestCategory, suggestSEO, buildFieldProvenance } from '@/lib/collectors/services';

// ============ FILE UPLOAD HANDLER ============
export async function handleCollectorFileUpload(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await connectDB();
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const sourceId = formData.get('sourceId') as string;

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!['json', 'csv', 'xlsx', 'xls'].includes(ext)) {
      return NextResponse.json({ error: 'Unsupported file type. Use .json, .csv, or .xlsx' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let records: any[];

    if (ext === 'json' || ext === 'xlsx' || ext === 'xls') {
      const text = buffer.toString('utf-8');
      const parsed = JSON.parse(text);
      records = Array.isArray(parsed) ? parsed : [parsed];
      // Try wrapper keys
      if (!Array.isArray(records[0])) {
        for (const wrapper of ['phones', 'data', 'records', 'results', 'items']) {
          if (Array.isArray(records[wrapper])) { records = records[wrapper]; break; }
        }
      }
    } else if (ext === 'csv') {
      const text = buffer.toString('utf-8');
      const result = await new Promise<{ data: any[] }>((resolve, reject) => {
        Papa.parse(text, { header: true, skipEmptyLines: true, complete: resolve });
      });
      records = result.data;
    }

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'No phone records found in file' }, { status: 400 });
    }

    // Create a temporary source for provenance
    let sourceName = `Upload: ${file.name}`;
    let resolvedSourceId = sourceId;

    if (!resolvedSourceId) {
      const slug = file.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().slice(0, 30);
      const existing = await CollectorSource.findOne({ name: new RegExp(`^${slug}`, 'i') }).lean();
      if (existing) {
        resolvedSourceId = (existing._id as string).toString();
        sourceName = existing.name;
      } else {
        const source = await CollectorSource.create({
          name: `Upload ${file.name}`,
          type: ext === 'csv' ? 'csv_url' : 'json_url',
          endpoint: '',
          enabled: true,
          totalCollected: 0,
        });
        resolvedSourceId = (source._id as string).toString();
        sourceName = source.name;
      }
    }

    // Validate all records first
    const issues: string[] = [];
    const validRecords: any[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const brand = String(r.brand || r.brandName || '').trim();
      const model = String(r.model || r.modelName || r.name || '').trim();
      if (!brand || !model) { issues.push(`Row ${i + 1}: missing brand or model`); continue; }
      const slug = `${brand} ${model}`.toLowerCase().replace(/[^a-z0-9\s-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      if (!/^[a-z0-9-]+$/.test(slug)) { issues.push(`Row ${i + 1}: invalid slug "${slug}"`); continue; }
      const phone: any = { brandName: brand, model, slug, ...r };
      const vIssues = validateCollectedPhone(phone);
      for (const iss of vIssues) issues.push(`Row ${i + 1}: ${iss.severity}: ${iss.field} — ${iss.message}`);
      validRecords.push(phone);
    }

    // Fetch existing phones ONCE
    const allExisting = await Phone.find(
      { active: true, status: 'published' },
      { modelName: 1, slug: 1, brandId: 1, pricePKR: 1, battery: 1, display: 1, chipset: 1, os: 1, weight: 1 }
    ).populate({ path: 'brand', select: 'name' }).lean();
    const existingMap = new Map<string, any>();
    for (const p of allExisting) {
      existingMap.set(`${(p.brand as any)?.name || ''}|${p.modelName}`.toLowerCase(), {
        _id: p._id, modelName: p.modelName, slug: p.slug,
        brand: p.brand ? { name: p.brand.name } : undefined,
        weight: String(p.weight || ''), battery: String(p.battery || ''),
        display: String(p.display || ''), chipset: String(p.chipset || ''), os: String(p.os || ''),
        pricePKR: p.pricePKR || 0,
      });
    }

    // Process each record
    let inserted = 0, updated = 0, skipped = 0;
    const batchDocs: any[] = [];

    for (const phone of validRecords) {
      const phoneNorm: any = { ...phone, brandName: String(phone.brandName), model: String(phone.model), slug };
      phoneNorm.releaseDate = String(phoneNorm.releaseDate || '');

      // Detect duplicates
      const dupResult = detectDuplicates(phoneNorm, allExisting);
      const hasExact = dupResult.matches.some(m => m.confidence >= 0.95);
      if (hasExact) { skipped++; continue; }

      // Detect conflicts
      const conflicts = detectConflicts(phoneNorm, existingMap.get(`${phoneNorm.brandName}|${phoneNorm.model}`.toLowerCase()) || [], sourceName);
      const isNew = dupResult.matches.length === 0 && conflicts.length === 0;
      if (isNew) { inserted++; } else { updated++; }

      // Suggest category & SEO
      const categories = suggestCategory(phoneNorm);
      const seo = suggestSEO(phoneNorm);

      // Build provenance
      const provenance = buildFieldProvenance(phoneNorm, resolvedSourceId, sourceName, '', 0.85);

      batchDocs.push({
        status: isNew ? 'pending' : 'needs_review',
        brandName: phoneNorm.brandName,
        model: phoneNorm.model,
        slug: phoneNorm.slug,
        releaseDate: phoneNorm.releaseDate || '',
        announcedDate: String(phoneNorm.announcedDate || ''),
        availability: String(phoneNorm.availability || ''),
        deviceStatus: String(phoneNorm.deviceStatus || ''),
        deviceType: String(phoneNorm.deviceType || ''),
        display: phoneNorm.display || {},
        processor: phoneNorm.processor || {},
        memory: phoneNorm.memory || {},
        camera: phoneNorm.camera || {},
        battery: phoneNorm.battery || {},
        body: phoneNorm.body || {},
        connectivity: phoneNorm.connectivity || {},
        software: phoneNorm.software || {},
        audio: phoneNorm.audio || {},
        sensors: phoneNorm.sensors || {},
        benchmarks: phoneNorm.benchmarks || {},
        images: phoneNorm.images || [],
        thumbnail: phoneNorm.thumbnail || '',
        suggestedCategory: categories.join(', '),
        suggestedSeoTitle: seo.title,
        suggestedSeoDescription: seo.description,
        suggestedKeywords: seo.keywords,
        sourceId: new mongoose.Types.ObjectId(resolvedSourceId),
        sourceName,
        sourceUrl: '',
        providerRecordId: phoneNorm.slug,
        fieldProvenance: provenance,
        duplicateMatches: dupResult.matches.map(m => ({
          type: m.type, phoneId: m.phoneId || '', modelName: m.modelName || '',
          brandName: m.brandName || '', slug: m.slug || '', confidence: m.confidence,
        })),
        hasExactDuplicate: hasExact,
        duplicatePhoneId: dupResult.matches[0]?.phoneId || '',
        conflicts,
        conflictCount: conflicts.length,
        validationIssues: issues.filter(i => i.includes(String(i + 1))).length > 0 ? issues.filter(i => i.includes(String(i + 1))) : [],
        isValid: issues.filter(i => i.includes('error')).length === 0,
        sourceReliability: 1.0,
      });
    }

    // Batch insert into MongoDB
    if (batchDocs.length > 0) {
      await CollectedPhone.insertMany(batchDocs);
    }

    // Update source stats
    await CollectorSource.updateOne({ _id: new mongoose.Types.ObjectId(resolvedSourceId) }, {
      $inc: { totalCollected: inserted + updated, totalFailed: issues.length },
      $set: { lastSyncAt: new Date(), lastSyncStatus: issues.length > 0 ? 'partial' : 'success' },
    });

    await ActivityLog.create({
      action: 'collector_upload',
      details: `Uploaded ${file.name}: ${inserted} new, ${updated} existing, ${skipped} duplicates, ${issues.length} issues`,
      entityType: 'collector',
    });

    return NextResponse.json({
      success: true,
      filename: file.name,
      totalRecords: records.length,
      validRecords: validRecords.length,
      inserted,
      updated,
      skipped,
      issues,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}