import { NormalizedPhone, ConflictInfo, FieldProvenance, PhoneCategory } from './types';

// ============ VALIDATION ============
export interface ValidationIssue {
  field: string;
  severity: 'error' | 'warning';
  message: string;
}

export function validateCollectedPhone(phone: NormalizedPhone): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!phone.brandName || !phone.brandName.trim()) {
    issues.push({ field: 'brandName', severity: 'error', message: 'Brand name is required' });
  }

  if (!phone.model || !phone.model.trim()) {
    issues.push({ field: 'model', severity: 'error', message: 'Model name is required' });
  }

  if (!phone.slug || !/^[a-z0-9-]+$/.test(phone.slug)) {
    issues.push({ field: 'slug', severity: 'error', message: 'Slug must contain only a-z, 0-9, and hyphens' });
  }

  if (phone.releaseDate) {
    const d = new Date(phone.releaseDate);
    if (isNaN(d.getTime())) {
      issues.push({ field: 'releaseDate', severity: 'warning', message: 'Invalid date format' });
    }
  }

  if (phone.announcedDate) {
    const d = new Date(phone.announcedDate);
    if (isNaN(d.getTime())) {
      issues.push({ field: 'announcedDate', severity: 'warning', message: 'Invalid date format' });
    }
  }

  // Validate URLs
  const urlFields = [...(phone.images || []), phone.thumbnail].filter((u): u is string => Boolean(u));
  for (const url of urlFields) {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        issues.push({ field: 'images', severity: 'warning', message: `Invalid URL protocol: ${url}` });
      }
    } catch {
      issues.push({ field: 'images', severity: 'warning', message: `Invalid URL: ${url}` });
    }
  }

  // Validate battery capacity is numeric
  if (phone.battery?.capacity) {
    const cap = parseInt(phone.battery.capacity.replace(/[^0-9]/g, ''));
    if (isNaN(cap) || cap < 500 || cap > 25000) {
      issues.push({ field: 'battery.capacity', severity: 'warning', message: `Unusual battery capacity: ${phone.battery.capacity}` });
    }
  }

  // Validate display size
  if (phone.display?.size) {
    const size = parseFloat(phone.display.size.replace(/[^0-9.]/g, ''));
    if (isNaN(size) || size < 1 || size > 15) {
      issues.push({ field: 'display.size', severity: 'warning', message: `Unusual display size: ${phone.display.size}` });
    }
  }

  // Validate weight
  if (phone.body?.weight) {
    const w = parseFloat(phone.body.weight.replace(/[^0-9.]/g, ''));
    if (isNaN(w) || w < 50 || w > 500) {
      issues.push({ field: 'body.weight', severity: 'warning', message: `Unusual weight: ${phone.body.weight}` });
    }
  }

  // Validate RAM
  if (phone.memory?.ram) {
    const ram = parseInt(phone.memory.ram.replace(/[^0-9]/g, ''));
    if (isNaN(ram) || ram < 1 || ram > 64) {
      issues.push({ field: 'memory.ram', severity: 'warning', message: `Unusual RAM: ${phone.memory.ram}` });
    }
  }

  return issues;
}

// ============ DUPLICATE DETECTION ============
export interface DuplicateResult {
  isDuplicate: boolean;
  matches: Array<{
    type: 'exact_slug' | 'brand_model' | 'normalized_name' | 'provider_record' | 'fuzzy';
    phoneId?: string;
    modelName?: string;
    brandName?: string;
    slug?: string;
    confidence: number;
  }>;
}

function normalizeForComparison(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/\s+/g, '');
}

function levenshtein(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;
  const matrix: number[][] = Array.from({ length: aLen + 1 }, () => new Array(bLen + 1).fill(0));
  for (let i = 0; i <= aLen; i++) matrix[i][0] = i;
  for (let j = 0; j <= bLen; j++) matrix[0][j] = j;
  for (let i = 1; i <= aLen; i++) {
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[aLen][bLen];
}

export function detectDuplicates(
  phone: NormalizedPhone,
  existingPhones: Array<{ _id: string; modelName: string; slug: string; brandId?: string; brand?: { name: string } }>,
  providerRecordId?: string
): DuplicateResult {
  const matches: DuplicateResult['matches'] = [];
  const phoneNorm = normalizeForComparison(`${phone.brandName} ${phone.model}`);
  const existingBrandName = phone.brandName.toLowerCase().trim();
  const existingModelName = phone.model.toLowerCase().trim();

  for (const existing of existingPhones) {
    const existingPhoneName = (existing.modelName || '').toLowerCase().trim();
    const existingBrand = existing.brand?.name?.toLowerCase().trim() || '';
    const existingNorm = normalizeForComparison(`${existingBrand} ${existingPhoneName}`);

    // Exact slug match
    if (existing.slug === phone.slug) {
      matches.push({ type: 'exact_slug', phoneId: existing._id.toString(), modelName: existing.modelName, brandName: existingBrand, slug: existing.slug, confidence: 1.0 });
      continue;
    }

    // Brand + model exact match
    if (existingBrand === existingBrandName && existingPhoneName === existingModelName) {
      matches.push({ type: 'brand_model', phoneId: existing._id.toString(), modelName: existing.modelName, brandName: existingBrand, slug: existing.slug, confidence: 0.95 });
      continue;
    }

    // Normalized name match
    if (phoneNorm === existingNorm) {
      matches.push({ type: 'normalized_name', phoneId: existing._id.toString(), modelName: existing.modelName, brandName: existingBrand, slug: existing.slug, confidence: 0.9 });
      continue;
    }

    // Fuzzy match (brand must match, model similarity > 80%)
    if (existingBrand === existingBrandName) {
      const dist = levenshtein(existingModelName, existingPhoneName);
      const maxLen = Math.max(existingModelName.length, existingPhoneName.length, 1);
      const similarity = 1 - dist / maxLen;
      if (similarity >= 0.8) {
        matches.push({ type: 'fuzzy', phoneId: existing._id.toString(), modelName: existing.modelName, brandName: existingBrand, slug: existing.slug, confidence: Math.round(similarity * 100) / 100 });
      }
    }
  }

  // Sort by confidence descending
  matches.sort((a, b) => b.confidence - a.confidence);

  return {
    isDuplicate: matches.length > 0 && matches[0].confidence >= 0.8,
    matches,
  };
}

// ============ CONFLICT DETECTION ============
interface ExistingPhoneData {
  modelName: string;
  slug: string;
  pricePKR: number;
  [key: string]: any;
}

export function detectConflicts(
  phone: NormalizedPhone,
  existing: ExistingPhoneData,
  sourceName: string,
  existingSource?: string
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];

  // Map normalized fields to flat existing fields for comparison
  const comparisons: Array<{ field: string; newValue: any; existingValue: any }> = [
    { field: 'modelName', newValue: phone.model, existingValue: existing.modelName },
  ];

  if (phone.body?.weight && existing.weight) {
    comparisons.push({ field: 'weight', newValue: phone.body.weight, existingValue: existing.weight });
  }
  if (phone.battery?.capacity && existing.battery) {
    comparisons.push({ field: 'battery', newValue: phone.battery.capacity, existingValue: existing.battery });
  }
  if (phone.display?.size && existing.display) {
    comparisons.push({ field: 'display', newValue: phone.display.size, existingValue: existing.display });
  }
  if (phone.processor?.chipset && existing.chipset) {
    comparisons.push({ field: 'chipset', newValue: phone.processor.chipset, existingValue: existing.chipset });
  }
  if (phone.software?.os && existing.os) {
    comparisons.push({ field: 'os', newValue: `${phone.software.os} ${phone.software.osVersion || ''}`.trim(), existingValue: existing.os });
  }

  for (const c of comparisons) {
    const newStr = String(c.newValue).toLowerCase().trim();
    const existStr = String(c.existingValue).toLowerCase().trim();
    if (newStr && existStr && newStr !== existStr) {
      conflicts.push({
        field: c.field,
        existingValue: c.existingValue,
        newValue: c.newValue,
        existingSource: existingSource || 'existing',
        newSource: sourceName,
        confidence: 0.7,
      });
    }
  }

  return conflicts;
}

// ============ AUTO-CATEGORIZE ============
export function suggestCategory(phone: NormalizedPhone): PhoneCategory[] {
  const categories: PhoneCategory[] = [];
  const weight = parseFloat(phone.body?.weight?.replace(/[^0-9.]/g, '') || '0');
  const displaySize = parseFloat(phone.display?.size?.replace(/[^0-9.]/g, '') || '0');
  const batteryCap = parseInt(phone.battery?.capacity?.replace(/[^0-9.]/g, '') || '0');
  const ram = parseInt(phone.memory?.ram?.replace(/[^0-9.]/g, '') || '0');
  const modelLower = (phone.model || '').toLowerCase();

  if (modelLower.includes('fold') || modelLower.includes('flip')) categories.push('Foldable');
  if (modelLower.includes('tab') || modelLower.includes('tablet') || displaySize >= 10) categories.push('Tablet');
  if (modelLower.includes('rugged') || phone.body?.waterResistance?.includes('IP68') || phone.body?.waterResistance?.includes('IP69')) categories.push('Rugged');
  if (weight > 0 && weight < 160 && displaySize < 6) categories.push('Compact');
  if (ram >= 12 || modelLower.includes('gaming') || modelLower.includes('rog') || modelLower.includes('redmagic')) categories.push('Gaming');

  // Price-based (only if Pakistan price is set from a Pakistan-specific source)
  const price = phone.pakistanPrice || 0;
  if (price > 0) {
    if (price <= 30000) categories.push('Budget');
    else if (price <= 65000) categories.push('Mid Range');
    else if (price <= 130000) categories.push('Premium');
    else if (price <= 280000) categories.push('Flagship');
    else categories.push('Ultra Flagship');
  }

  // Spec-based hints
  if (batteryCap >= 5500) categories.push('Battery');
  if (phone.camera?.rearModules?.toLowerCase().includes('200') || phone.camera?.rearModules?.toLowerCase().includes('leica')) categories.push('Camera');

  if (categories.length === 0) categories.push('Mid Range');
  return [...new Set(categories)];
}

// ============ SEO SUGGESTION ============
export function suggestSEO(phone: NormalizedPhone): { title: string; description: string; keywords: string } {
  const brand = phone.brandName;
  const model = phone.model;
  const specs: string[] = [];
  if (phone.display?.size) specs.push(phone.display.size);
  if (phone.memory?.ram) specs.push(phone.memory.ram + ' RAM');
  if (phone.memory?.storage) specs.push(phone.memory.storage);
  if (phone.processor?.chipset) specs.push(phone.processor.chipset);
  if (phone.battery?.capacity) specs.push(phone.battery.capacity);

  const specsStr = specs.length > 0 ? ` (${specs.join(', ')})` : '';
  const priceStr = phone.pakistanPrice ? ` Price in Pakistan ${phone.pakistanPrice.toLocaleString()} PKR` : '';

  const title = `${brand} ${model} - Full Specs & Price${specsStr ? ` | ${specs.slice(0, 2).join(', ')}` : ''} | PhoneDock`;

  const description = `${brand} ${model} complete specifications${specsStr ? `: ${specs.join(', ')}` : ''}.${priceStr ? ` ${brand} ${model} price in Pakistan is ${(phone.pakistanPrice ?? 0).toLocaleString()} PKR.` : ''} Compare specs, read reviews, and find the best deals on PhoneDock.`;

  const keywords = [
    `${brand} ${model}`, `${model} price in Pakistan`, `${model} specs`,
    `${model} review`, `${brand} phones Pakistan`,
  ].join(', ');

  return { title, description, keywords };
}

// ============ BUILD FIELD PROVENANCE ============
export function buildFieldProvenance(
  phone: NormalizedPhone,
  sourceId: string,
  sourceName: string,
  sourceUrl: string,
  confidence: number = 0.8
): FieldProvenance[] {
  const provenance: FieldProvenance[] = [];
  const now = new Date().toISOString();

  const add = (field: string, value: any, conf = confidence) => {
    if (value !== undefined && value !== null && value !== '') {
      provenance.push({ field, value, sourceName, sourceUrl, collectedAt: now, providerId: sourceId, confidence: conf });
    }
  };

  add('brandName', phone.brandName, 0.95);
  add('model', phone.model, 0.95);
  add('slug', phone.slug, 0.9);
  add('releaseDate', phone.releaseDate, 0.9);
  add('thumbnail', phone.thumbnail, 0.7);

  if (phone.display) Object.entries(phone.display).forEach(([k, v]) => add(`display.${k}`, v, 0.8));
  if (phone.processor) Object.entries(phone.processor).forEach(([k, v]) => add(`processor.${k}`, v, 0.85));
  if (phone.memory) Object.entries(phone.memory).forEach(([k, v]) => add(`memory.${k}`, v, 0.8));
  if (phone.camera) Object.entries(phone.camera).forEach(([k, v]) => add(`camera.${k}`, v, 0.8));
  if (phone.battery) Object.entries(phone.battery).forEach(([k, v]) => add(`battery.${k}`, v, 0.8));
  if (phone.body) Object.entries(phone.body).forEach(([k, v]) => add(`body.${k}`, v, 0.8));
  if (phone.connectivity) Object.entries(phone.connectivity).forEach(([k, v]) => add(`connectivity.${k}`, v, 0.8));
  if (phone.software) Object.entries(phone.software).forEach(([k, v]) => add(`software.${k}`, v, 0.8));
  if (phone.audio) Object.entries(phone.audio).forEach(([k, v]) => add(`audio.${k}`, v, 0.7));
  if (phone.sensors) Object.entries(phone.sensors).forEach(([k, v]) => add(`sensors.${k}`, v, 0.7));
  if (phone.benchmarks) Object.entries(phone.benchmarks).forEach(([k, v]) => add(`benchmarks.${k}`, v, 0.7));

  return provenance;
}