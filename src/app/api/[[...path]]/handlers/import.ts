import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import mongoose from 'mongoose';
import { Phone, CollectorSource, CollectedPhone, ActivityLog } from '@/lib/models';
import {
  connectDB, getAdminFromRequest, requirePermission, sanitizeCsvValue,
  MAX_UPLOAD_SIZE, MAX_UPLOAD_RECORDS, ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES,
} from './helpers';
import { validateCollectedPhone, detectDuplicates, detectConflicts, suggestCategory, suggestSEO, buildFieldProvenance } from '@/lib/collectors/services';

// ============ IMPORT GET ============

export async function handleImportGet(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/import/history ----
  if (segments.length === 2 && segments[0] === 'import' && segments[1] === 'history') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'imports:read'); if (permCheck) return permCheck;
    await connectDB();
    const { ImportHistory } = await import('@/lib/models/ImportHistory');
    const history = await ImportHistory.find().sort({ createdAt: -1 }).limit(50).lean();
    return NextResponse.json(history);
  }

  return undefined;
}

// ============ IMPORT POST ============

export async function handleImportPost(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/import (file upload) ----
  if (segments.length === 1 && segments[0] === 'import') {
    return handleFileUpload(req);
  }

  // ---- /api/import/validate ----
  if (segments.length === 2 && segments[0] === 'import' && segments[1] === 'validate') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'imports:read'); if (permCheck) return permCheck;
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext || '')) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    let records: any[] = [];
    try {
      if (ext === 'json') {
        records = JSON.parse(buffer.toString('utf-8'));
        if (!Array.isArray(records)) records = [records];
      } else if (ext === 'csv') {
        const result = await new Promise<{ data: any[] }>((resolve) => {
          Papa.parse(buffer.toString('utf-8'), { header: true, skipEmptyLines: true, complete: resolve });
        });
        records = result.data;
      } else if (ext === 'xlsx' || ext === 'xls') {
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (sheetName) {
          records = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false });
        }
      }
    } catch (e: any) {
      return NextResponse.json({ error: `Parse error: ${e.message}` }, { status: 400 });
    }
    return NextResponse.json({ valid: true, totalRecords: records.length, sample: records.slice(0, 3) });
  }

  // ---- /api/import/rollback ----
  if (segments.length === 2 && segments[0] === 'import' && segments[1] === 'rollback') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'imports:execute'); if (permCheck) return permCheck;
    const body = await req.json();
    return NextResponse.json({ success: false, error: 'Rollback not yet implemented. Use /api/import/history to track imports.' }, { status: 501 });
  }

  return undefined;
}

// ============ FILE UPLOAD HANDLER (SECURED) ============

async function handleFileUpload(req: NextRequest): Promise<NextResponse> {
  const authResult = await getAdminFromRequest(req);
  if (authResult.error) return authResult.error as NextResponse;
  const admin = authResult.admin!;
  const permCheck = requirePermission(admin, 'imports:execute');
  if (permCheck) return permCheck;
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const sourceId = formData.get('sourceId') as string;

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    // File size check
    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: `File too large (max ${MAX_UPLOAD_SIZE / 1024 / 1024}MB)` }, { status: 400 });
    }

    // Extension check
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: 'Unsupported file type. Use .json, .csv, or .xlsx' }, { status: 400 });
    }

    // MIME type check
    if (!ALLOWED_MIME_TYPES.has(file.type) && ext !== 'xls') {
      return NextResponse.json({ error: 'Invalid file MIME type' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let records: any[] = [];

    // Parse based on file type
    if (ext === 'json') {
      try {
        const text = buffer.toString('utf-8');
        const parsed = JSON.parse(text);
        records = Array.isArray(parsed) ? parsed : [parsed];
        // Check wrapper keys on the original parsed object, not the wrapped array
        if (!Array.isArray(parsed)) {
          for (const wrapper of ['phones', 'data', 'records', 'results', 'items'] as const) {
            const candidate = (parsed as Record<string, unknown>)[wrapper];
            if (Array.isArray(candidate)) { records = candidate as any[]; break; }
          }
        }
      } catch (e: any) {
        return NextResponse.json({ error: `Invalid JSON: ${e.message}` }, { status: 400 });
      }
    } else if (ext === 'xlsx' || ext === 'xls') {
      // Use xlsx package correctly — NOT JSON.parse
      try {
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          return NextResponse.json({ error: 'Excel file has no sheets' }, { status: 400 });
        }
        const sheet = workbook.Sheets[sheetName];
        records = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      } catch (e: any) {
        return NextResponse.json({ error: `Excel parsing error: ${e.message}` }, { status: 400 });
      }
    } else if (ext === 'csv') {
      try {
        const text = buffer.toString('utf-8');
        const result = await new Promise<{ data: any[] }>((resolve, reject) => {
          Papa.parse(text, { header: true, skipEmptyLines: true, complete: resolve, error: (err: Error) => reject(err) });
        });
        records = result.data;
        // CSV formula injection protection
        records = records.map((row: any) => {
          const sanitized: any = {};
          for (const [key, value] of Object.entries(row)) {
            sanitized[key] = typeof value === 'string' ? sanitizeCsvValue(value) : value;
          }
          return sanitized;
        });
      } catch (e: any) {
        return NextResponse.json({ error: `CSV parsing error: ${e.message}` }, { status: 400 });
      }
    }

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'No phone records found in file' }, { status: 400 });
    }

    // Record count check
    if (records.length > MAX_UPLOAD_RECORDS) {
      return NextResponse.json({ error: `Too many records (max ${MAX_UPLOAD_RECORDS})` }, { status: 400 });
    }

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
          name: `Upload ${file.name}`, type: ext === 'csv' ? 'csv_url' : 'json_url',
          endpoint: '', enabled: true, totalCollected: 0,
        });
        resolvedSourceId = (source._id as string).toString();
        sourceName = source.name;
      }
    }

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
      const recordIssues: string[] = [];
      for (const iss of vIssues) {
        const msg = `Row ${i + 1}: ${iss.severity}: ${iss.field} - ${iss.message}`;
        issues.push(msg);
        recordIssues.push(msg);
      }
      phone._recordIssues = recordIssues;
      validRecords.push(phone);
    }

    const allExisting: any[] = await Phone.find(
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

    let inserted = 0, updated = 0, skipped = 0;
    const batchDocs: any[] = [];

    for (const phone of validRecords) {
      const phoneNorm: any = { ...phone, brandName: String(phone.brandName), model: String(phone.model), slug: phone.slug };
      phoneNorm.releaseDate = String(phoneNorm.releaseDate || '');
      const dupResult = detectDuplicates(phoneNorm, allExisting);
      const hasExact = dupResult.matches.some(m => m.confidence >= 0.95);
      if (hasExact) { skipped++; continue; }
      const conflicts = detectConflicts(phoneNorm, existingMap.get(`${phoneNorm.brandName}|${phoneNorm.model}`.toLowerCase()) || [], sourceName);
      const isNew = dupResult.matches.length === 0 && conflicts.length === 0;
      if (isNew) { inserted++; } else { updated++; }
      const categories = suggestCategory(phoneNorm);
      const seo = suggestSEO(phoneNorm);
      const provenance = buildFieldProvenance(phoneNorm, resolvedSourceId, sourceName, '', 0.85);
      batchDocs.push({
        status: isNew ? 'pending' : 'needs_review',
        brandName: phoneNorm.brandName, model: phoneNorm.model, slug: phoneNorm.slug,
        releaseDate: phoneNorm.releaseDate || '',
        announcedDate: String(phoneNorm.announcedDate || ''),
        availability: String(phoneNorm.availability || ''),
        deviceStatus: String(phoneNorm.deviceStatus || ''),
        deviceType: String(phoneNorm.deviceType || ''),
        display: phoneNorm.display || {}, processor: phoneNorm.processor || {},
        memory: phoneNorm.memory || {}, camera: phoneNorm.camera || {},
        battery: phoneNorm.battery || {}, body: phoneNorm.body || {},
        connectivity: phoneNorm.connectivity || {}, software: phoneNorm.software || {},
        audio: phoneNorm.audio || {}, sensors: phoneNorm.sensors || {},
        benchmarks: phoneNorm.benchmarks || {}, images: phoneNorm.images || [],
        thumbnail: phoneNorm.thumbnail || '',
        suggestedCategory: categories.join(', '),
        suggestedSeoTitle: seo.title, suggestedSeoDescription: seo.description,
        suggestedKeywords: seo.keywords,
        sourceId: new mongoose.Types.ObjectId(resolvedSourceId),
        sourceName, sourceUrl: '', providerRecordId: phoneNorm.slug,
        fieldProvenance: provenance,
        duplicateMatches: dupResult.matches.map(m => ({
          type: m.type, phoneId: m.phoneId || '', modelName: m.modelName || '',
          brandName: m.brandName || '', slug: m.slug || '', confidence: m.confidence,
        })),
        hasExactDuplicate: hasExact,
        duplicatePhoneId: dupResult.matches[0]?.phoneId || '',
        conflicts, conflictCount: conflicts.length,
        validationIssues: (phoneNorm._recordIssues || []),
        isValid: !(phoneNorm._recordIssues || []).some((ri: string) => ri.includes('error')),
        sourceReliability: 1.0,
      });
    }

    if (batchDocs.length > 0) {
      await CollectedPhone.insertMany(batchDocs);
    }

    await CollectorSource.updateOne({ _id: new mongoose.Types.ObjectId(resolvedSourceId) }, {
      $inc: { totalCollected: inserted + updated, totalFailed: issues.length },
      $set: { lastSyncAt: new Date(), lastSyncStatus: issues.length > 0 ? 'partial' : 'success' },
    });

    await ActivityLog.create({
      adminId: admin._id,
      action: 'collector_upload',
      details: `Uploaded ${file.name}: ${inserted} new, ${updated} existing, ${skipped} duplicates, ${issues.length} issues`,
      entityType: 'collector',
    });

    return NextResponse.json({
      success: true, filename: file.name, totalRecords: records.length,
      validRecords: validRecords.length, inserted, updated, skipped, issues,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}