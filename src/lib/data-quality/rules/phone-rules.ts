import { RuleDefinition, DetectedIssue, DetectionContext, FixContext, FixResult } from '../types';
import { Types } from 'mongoose';
import { PhoneSpecs, PhoneImage } from '@/lib/models';

// ─── Helper: build stable issue key ───────────────────────────────
function issueKey(ruleId: string, entityType: string, entityId: string, field?: string): string {
  return `${ruleId}:${entityType}:${entityId}${field ? `:${field}` : ''}`;
}

// ═══════════════════════════════════════════════════════════════════
// PHONE CORE DATA RULES
// ═══════════════════════════════════════════════════════════════════

export const PHONE_MISSING_SPECS: RuleDefinition = {
  ruleId: 'PHONE_MISSING_SPECS',
  title: 'Missing PhoneSpecs Document',
  description: 'Phone has no associated PhoneSpecs document',
  severity: 'high',
  entityType: 'phone',
  canAutoFix: false,
  async detect(ctx): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    for (const phone of ctx.entities) {
      const id = phone._id?.toString();
      if (!id) continue;
      if (!ctx.lookups.specs.has(id)) {
        issues.push({
          issueKey: issueKey(this.ruleId, 'phone', id),
          entityType: 'phone',
          entityId: id,
          issueType: this.ruleId,
          severity: this.severity,
          field: 'specs',
          currentValue: null,
          suggestedValue: 'Create PhoneSpecs document',
          source: 'system',
          confidence: 1,
          importId: ctx.importId,
        });
      }
    }
    return issues;
  },
};

export const PHONE_DUPLICATE_SLUG: RuleDefinition = {
  ruleId: 'PHONE_DUPLICATE_SLUG',
  title: 'Duplicate Slug',
  description: 'Multiple phones share the same slug (should be unique)',
  severity: 'critical',
  entityType: 'phone',
  canAutoFix: false,
  async detect(ctx): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    const slugCount = new Map<string, string[]>();
    for (const phone of ctx.entities) {
      const slug = phone.slug;
      const id = phone._id?.toString();
      if (!slug || !id) continue;
      if (!slugCount.has(slug)) slugCount.set(slug, []);
      slugCount.get(slug)!.push(id);
    }
    for (const [slug, ids] of slugCount) {
      if (ids.length > 1) {
        for (const id of ids) {
          issues.push({
            issueKey: issueKey(this.ruleId, 'phone', id, 'slug'),
            entityType: 'phone',
            entityId: id,
            issueType: this.ruleId,
            severity: this.severity,
            field: 'slug',
            currentValue: slug,
            suggestedValue: null,
            source: 'system',
            confidence: 1,
            metadata: { duplicateIds: ids, slug },
          });
        }
      }
    }
    return issues;
  },
};

export const PHONE_INVALID_PRICE: RuleDefinition = {
  ruleId: 'PHONE_INVALID_PRICE',
  title: 'Invalid Price',
  description: 'Phone has a negative, zero, or extreme outlier price',
  severity: 'high',
  entityType: 'phone',
  canAutoFix: false,
  async detect(ctx): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    // Calculate median price for outlier detection
    const prices: number[] = [];
    for (const phone of ctx.entities) {
      if (phone.pricePKR > 0) prices.push(phone.pricePKR);
    }
    prices.sort((a, b) => a - b);
    const median = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : 0;
    const upperBound = median * 10;

    for (const phone of ctx.entities) {
      const id = phone._id?.toString();
      if (!id) continue;
      const price = phone.pricePKR;
      if (price < 0) {
        issues.push({
          issueKey: issueKey(this.ruleId, 'phone', id, 'pricePKR'),
          entityType: 'phone', entityId: id, issueType: this.ruleId,
          severity: 'critical', field: 'pricePKR', currentValue: price,
          suggestedValue: 'Remove or set to 0', source: 'system', confidence: 1,
        });
      } else if (price === 0 && phone.status === 'published') {
        issues.push({
          issueKey: issueKey(this.ruleId, 'phone', id, 'pricePKR'),
          entityType: 'phone', entityId: id, issueType: this.ruleId,
          severity: 'medium', field: 'pricePKR', currentValue: price,
          suggestedValue: 'Set correct price', source: 'system', confidence: 0.8,
        });
      } else if (median > 0 && price > upperBound) {
        issues.push({
          issueKey: issueKey(this.ruleId, 'phone', id, 'pricePKR'),
          entityType: 'phone', entityId: id, issueType: this.ruleId,
          severity: 'high', field: 'pricePKR', currentValue: price,
          suggestedValue: `Review — median is PKR ${median.toLocaleString()}`, source: 'system', confidence: 0.6,
          metadata: { median, upperBound },
        });
      }
    }
    return issues;
  },
};

export const PHONE_MISSING_PRIMARY_IMAGE: RuleDefinition = {
  ruleId: 'PHONE_MISSING_PRIMARY_IMAGE',
  title: 'Missing Primary Image',
  description: 'Published phone has no thumbnail or images',
  severity: 'medium',
  entityType: 'phone',
  canAutoFix: false,
  async detect(ctx): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    for (const phone of ctx.entities) {
      const id = phone._id?.toString();
      if (!id || phone.status !== 'published') continue;
      const images = ctx.lookups.images.get(id) || [];
      if (!phone.thumbnail && images.length === 0) {
        issues.push({
          issueKey: issueKey(this.ruleId, 'phone', id, 'thumbnail'),
          entityType: 'phone', entityId: id, issueType: this.ruleId,
          severity: this.severity, field: 'thumbnail',
          currentValue: null, suggestedValue: 'Add at least one image',
          source: 'system', confidence: 1,
        });
      }
    }
    return issues;
  },
};

export const PHONE_MISSING_PRICE: RuleDefinition = {
  ruleId: 'PHONE_MISSING_PRICE',
  title: 'Missing Price',
  description: 'Published phone has no price set',
  severity: 'high',
  entityType: 'phone',
  canAutoFix: false,
  async detect(ctx): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    for (const phone of ctx.entities) {
      const id = phone._id?.toString();
      if (!id || phone.status !== 'published') continue;
      if (!phone.pricePKR || phone.pricePKR <= 0) {
        issues.push({
          issueKey: issueKey(this.ruleId, 'phone', id, 'pricePKR'),
          entityType: 'phone', entityId: id, issueType: this.ruleId,
          severity: this.severity, field: 'pricePKR',
          currentValue: phone.pricePKR || 0, suggestedValue: 'Set a valid price',
          source: 'system', confidence: 1,
        });
      }
    }
    return issues;
  },
};

export const PHONE_STALE_PRICE: RuleDefinition = {
  ruleId: 'PHONE_STALE_PRICE',
  title: 'Stale Price',
  description: 'Phone price has not been checked in over 30 days',
  severity: 'low',
  entityType: 'phone',
  canAutoFix: false,
  async detect(ctx): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    for (const phone of ctx.entities) {
      const id = phone._id?.toString();
      if (!id || phone.status !== 'published') continue;
      const checkedAt = phone.lastPriceCheckedAt ? new Date(phone.lastPriceCheckedAt) : null;
      if (!checkedAt || checkedAt < thirtyDaysAgo) {
        issues.push({
          issueKey: issueKey(this.ruleId, 'phone', id, 'lastPriceCheckedAt'),
          entityType: 'phone', entityId: id, issueType: this.ruleId,
          severity: this.severity, field: 'lastPriceCheckedAt',
          currentValue: checkedAt?.toISOString() || 'never',
          suggestedValue: 'Run price check', source: 'system', confidence: 0.9,
        });
      }
    }
    return issues;
  },
};

export const PHONE_INVALID_RELEASE_DATE: RuleDefinition = {
  ruleId: 'PHONE_INVALID_RELEASE_DATE',
  title: 'Invalid Release Date',
  description: 'Phone has a future date beyond sensible range or malformed date',
  severity: 'medium',
  entityType: 'phone',
  canAutoFix: false,
  async detect(ctx): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    const maxDate = new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000); // 3 years ahead
    for (const phone of ctx.entities) {
      const id = phone._id?.toString();
      if (!id) continue;
      const rd = phone.releaseDate;
      if (!rd) continue;
      const d = new Date(rd);
      if (isNaN(d.getTime())) {
        issues.push({
          issueKey: issueKey(this.ruleId, 'phone', id, 'releaseDate'),
          entityType: 'phone', entityId: id, issueType: this.ruleId,
          severity: 'high', field: 'releaseDate', currentValue: rd,
          suggestedValue: 'Set a valid date', source: 'system', confidence: 1,
        });
      } else if (d > maxDate) {
        issues.push({
          issueKey: issueKey(this.ruleId, 'phone', id, 'releaseDate'),
          entityType: 'phone', entityId: id, issueType: this.ruleId,
          severity: 'medium', field: 'releaseDate', currentValue: rd,
          suggestedValue: 'Review — date is more than 3 years in the future',
          source: 'system', confidence: 0.7,
        });
      }
    }
    return issues;
  },
};

export const PHONE_MISSING_PTA_STATUS: RuleDefinition = {
  ruleId: 'PHONE_MISSING_PTA_STATUS',
  title: 'Missing PTA Status',
  description: 'Published phone has no PTA status set',
  severity: 'low',
  entityType: 'phone',
  canAutoFix: false,
  async detect(ctx): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    for (const phone of ctx.entities) {
      const id = phone._id?.toString();
      if (!id || phone.status !== 'published') continue;
      if (!phone.ptaStatus || phone.ptaStatus === 'Unknown') {
        issues.push({
          issueKey: issueKey(this.ruleId, 'phone', id, 'ptaStatus'),
          entityType: 'phone', entityId: id, issueType: this.ruleId,
          severity: this.severity, field: 'ptaStatus',
          currentValue: phone.ptaStatus || 'Unknown',
          suggestedValue: 'PTA Approved, PTA Non-Approved, or PTA Pending',
          source: 'system', confidence: 0.7,
        });
      }
    }
    return issues;
  },
};

// ═══════════════════════════════════════════════════════════════════
// SPECS RULES
// ═══════════════════════════════════════════════════════════════════

export const SPECS_DUPLICATE: RuleDefinition = {
  ruleId: 'SPECS_DUPLICATE',
  title: 'Duplicate PhoneSpecs Documents',
  description: 'Multiple PhoneSpecs documents exist for the same phone',
  severity: 'high',
  entityType: 'phone_specs',
  canAutoFix: true,
  async detect(ctx): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    const seen = new Map<string, number>();
    for (const phone of ctx.entities) {
      const id = phone._id?.toString();
      if (!id) continue;
      seen.set(id, (seen.get(id) || 0) + 1);
    }
    // This rule works differently — it's detected from specs side
    return issues;
  },
  async autoFix(issue: DetectedIssue, ctx: FixContext): Promise<FixResult> {
    return { success: false, changes: [], error: 'Manual review required' };
  },
};

export const SPECS_EMPTY: RuleDefinition = {
  ruleId: 'SPECS_EMPTY',
  title: 'Empty PhoneSpecs Document',
  description: 'PhoneSpecs document exists but all key fields are empty',
  severity: 'medium',
  entityType: 'phone_specs',
  canAutoFix: false,
  async detect(ctx): Promise<DetectedIssue[]> {
    // Detected per phone — if specs exist but are empty
    const issues: DetectedIssue[] = [];
    const keyFields = ['chipset', 'ram', 'storage', 'display', 'battery'];
    for (const phone of ctx.entities) {
      const id = phone._id?.toString();
      if (!id) continue;
      const specs = ctx.lookups.specs.get(id);
      if (!specs) continue;
      const filledCount = keyFields.filter(f => specs[f] && specs[f].trim()).length;
      if (filledCount === 0) {
        issues.push({
          issueKey: issueKey(this.ruleId, 'phone', id, 'specs'),
          entityType: 'phone', entityId: id, issueType: this.ruleId,
          severity: this.severity, field: 'specs',
          currentValue: 'empty', suggestedValue: 'Fill in key specification fields',
          source: 'system', confidence: 1,
        });
      }
    }
    return issues;
  },
};

export const SPECS_MISSING_KEY_FIELDS: RuleDefinition = {
  ruleId: 'SPECS_MISSING_KEY_FIELDS',
  title: 'Missing Key Spec Fields',
  description: 'PhoneSpecs document is missing important fields like chipset, RAM, storage',
  severity: 'medium',
  entityType: 'phone_specs',
  canAutoFix: false,
  async detect(ctx): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    const importantFields = [
      { field: 'chipset', label: 'Chipset' },
      { field: 'ram', label: 'RAM' },
      { field: 'storage', label: 'Storage' },
      { field: 'display', label: 'Display' },
      { field: 'battery', label: 'Battery' },
    ];
    for (const phone of ctx.entities) {
      const id = phone._id?.toString();
      if (!id) continue;
      const specs = ctx.lookups.specs.get(id);
      if (!specs) continue; // PHONE_MISSING_SPECS covers this
      for (const { field, label } of importantFields) {
        if (!specs[field] || !specs[field].trim()) {
          issues.push({
            issueKey: issueKey(this.ruleId, 'phone', id, field),
            entityType: 'phone', entityId: id, issueType: this.ruleId,
            severity: 'low', field,
            currentValue: '', suggestedValue: `Add ${label}`,
            source: 'system', confidence: 0.9,
          });
        }
      }
    }
    return issues;
  },
};

export const SPECS_OBJECT_IN_STRING: RuleDefinition = {
  ruleId: 'SPECS_OBJECT_IN_STRING',
  title: 'Object Stored as String in Specs',
  description: 'A spec field contains [object Object] instead of actual data',
  severity: 'high',
  entityType: 'phone_specs',
  canAutoFix: true,
  async detect(ctx): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    const specStringFields = [
      'display','displayType','resolution','refreshRate','protection','brightness',
      'chipset','cpu','gpu','process','ram','ramType','storage','cardSlot',
      'mainCamera','mainCameraSensor','aperture','ois','eis','ultrawide','telephoto','zoom','cameraFeatures','videoRecording',
      'selfieCamera','selfieSensor','selfieVideo',
      'battery','charging','chargingSpeed','wirelessCharge','wirelessSpeed','reverseCharge',
      'weight','dimensions','build','sim','ipRating','network','fiveG','wifi','bluetooth','nfc','usb','infrared',
      'fingerprint','faceUnlock','sensors','colors',
      'os','osVersion','osUI','updatePolicy','specialFeatures',
    ];
    for (const phone of ctx.entities) {
      const id = phone._id?.toString();
      if (!id) continue;
      const specs = ctx.lookups.specs.get(id);
      if (!specs) continue;
      for (const field of specStringFields) {
        const val = specs[field];
        if (typeof val === 'object' && val !== null) {
          issues.push({
            issueKey: issueKey(this.ruleId, 'phone', id, field),
            entityType: 'phone', entityId: id, issueType: this.ruleId,
            severity: this.severity, field,
            currentValue: '[object Object]', suggestedValue: 'Convert to string representation',
            source: 'system', confidence: 1,
          });
        }
      }
    }
    return issues;
  },
  async autoFix(issue: DetectedIssue, ctx: FixContext): Promise<FixResult> {
    if (ctx.dryRun) {
      return {
        success: true,
        changes: [{ field: issue.field, oldValue: '[object Object]', newValue: '(would convert to JSON string)' }],
      };
    }
    try {
      const specs = await PhoneSpecs.findOne({ phoneId: issue.entityId });
      if (!specs) return { success: false, changes: [], error: 'PhoneSpecs not found' };
      const val = specs.get(issue.field);
      if (typeof val === 'object' && val !== null) {
        const newStr = JSON.stringify(val);
        specs.set(issue.field, newStr);
        await specs.save();
        return {
          success: true,
          changes: [{ field: issue.field, oldValue: '[object Object]', newValue: newStr }],
        };
      }
      return { success: false, changes: [], error: 'Value is no longer an object (may have been fixed already)' };
    } catch (e: unknown) {
      return { success: false, changes: [], error: e instanceof Error ? e.message : 'Fix failed' };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════
// ORPHAN RULES
// ═══════════════════════════════════════════════════════════════════

export const ORPHAN_SPECS: RuleDefinition = {
  ruleId: 'ORPHAN_SPECS',
  title: 'Orphan PhoneSpecs',
  description: 'PhoneSpecs document references a non-existent phone',
  severity: 'high',
  entityType: 'phone_specs',
  canAutoFix: false,
  async detect(ctx): Promise<DetectedIssue[]> {
    // Orphan specs are detected in scanner by comparing specs against phones
    return [];
  },
};

export const ORPHAN_IMAGE: RuleDefinition = {
  ruleId: 'ORPHAN_IMAGE',
  title: 'Orphan PhoneImage',
  description: 'PhoneImage references a non-existent phone',
  severity: 'medium',
  entityType: 'phone_image',
  canAutoFix: false,
  async detect(_ctx): Promise<DetectedIssue[]> {
    return []; // Detected in scanner via cross-reference
  },
};

export const ORPHAN_PRICE: RuleDefinition = {
  ruleId: 'ORPHAN_PRICE',
  title: 'Orphan PhonePrice',
  description: 'PhonePrice references a non-existent phone',
  severity: 'medium',
  entityType: 'phone_price',
  canAutoFix: false,
  async detect(_ctx): Promise<DetectedIssue[]> {
    return []; // Detected in scanner
  },
};

export const ORPHAN_BENCHMARK: RuleDefinition = {
  ruleId: 'ORPHAN_BENCHMARK',
  title: 'Orphan PhoneBenchmark',
  description: 'PhoneBenchmark references a non-existent phone',
  severity: 'medium',
  entityType: 'phone_benchmark',
  canAutoFix: false,
  async detect(_ctx): Promise<DetectedIssue[]> {
    return [];
  },
};

// ═══════════════════════════════════════════════════════════════════
// BRAND RULES
// ═══════════════════════════════════════════════════════════════════

export const PHONE_MISSING_BRAND: RuleDefinition = {
  ruleId: 'PHONE_MISSING_BRAND',
  title: 'Phone Missing Brand',
  description: 'Phone references a brandId that does not exist',
  severity: 'critical',
  entityType: 'phone',
  canAutoFix: false,
  async detect(ctx): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    for (const phone of ctx.entities) {
      const id = phone._id?.toString();
      if (!id) continue;
      const brandId = phone.brandId?.toString();
      if (!brandId || !ctx.lookups.brands.has(brandId)) {
        issues.push({
          issueKey: issueKey(this.ruleId, 'phone', id, 'brandId'),
          entityType: 'phone', entityId: id, issueType: this.ruleId,
          severity: this.severity, field: 'brandId',
          currentValue: brandId || null, suggestedValue: 'Assign a valid brand',
          source: 'system', confidence: 1,
        });
      }
    }
    return issues;
  },
};

// ═══════════════════════════════════════════════════════════════════
// DUPLICATE PHONE RULES
// ═══════════════════════════════════════════════════════════════════

export const PHONE_DUPLICATE_NORMALIZED: RuleDefinition = {
  ruleId: 'PHONE_DUPLICATE_NORMALIZED',
  title: 'Possible Duplicate Phone',
  description: 'Two phones share the same brand + normalized model name',
  severity: 'medium',
  entityType: 'phone',
  canAutoFix: false,
  async detect(ctx): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    const normMap = new Map<string, { id: string; brandId: string; model: string }[]>();
    for (const phone of ctx.entities) {
      const id = phone._id?.toString();
      if (!id) continue;
      const brandId = phone.brandId?.toString() || '';
      const brandName = ctx.lookups.brands.get(brandId)?.name?.toLowerCase() || '';
      const modelNorm = phone.modelName?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
      if (!modelNorm) continue;
      const key = `${brandName}:${modelNorm}`;
      if (!normMap.has(key)) normMap.set(key, []);
      normMap.get(key)!.push({ id, brandId, model: phone.modelName });
    }
    for (const [, entries] of normMap) {
      if (entries.length > 1) {
        for (const entry of entries) {
          issues.push({
            issueKey: issueKey(this.ruleId, 'phone', entry.id),
            entityType: 'phone', entityId: entry.id, issueType: this.ruleId,
            severity: this.severity, field: 'modelName',
            currentValue: entry.model,
            suggestedValue: null,
            source: 'system', confidence: 0.5,
            metadata: { candidateIds: entries.map(e => e.id) },
          });
        }
      }
    }
    return issues;
  },
};

// ═══════════════════════════════════════════════════════════════════
// BENCHMARK RULES
// ═══════════════════════════════════════════════════════════════════

export const BENCHMARK_IMPOSSIBLE_SCORE: RuleDefinition = {
  ruleId: 'BENCHMARK_IMPOSSIBLE_SCORE',
  title: 'Impossible Benchmark Score',
  description: 'Benchmark has a negative score which is impossible',
  severity: 'high',
  entityType: 'phone_benchmark',
  canAutoFix: false,
  async detect(ctx): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    for (const phone of ctx.entities) {
      const id = phone._id?.toString();
      if (!id) continue;
      const bench = ctx.lookups.benchmarks.get(id);
      if (!bench) continue;
      const scoreFields = ['antutu', 'geekbenchSingle', 'geekbenchMulti', 'gamingScore'];
      for (const field of scoreFields) {
        if (typeof bench[field] === 'number' && bench[field] < 0) {
          issues.push({
            issueKey: issueKey(this.ruleId, 'phone', id, field),
            entityType: 'phone_benchmark', entityId: id, issueType: this.ruleId,
            severity: this.severity, field,
            currentValue: bench[field], suggestedValue: 'Set to 0 or correct value',
            source: 'system', confidence: 1,
          });
        }
      }
    }
    return issues;
  },
};

// ═══════════════════════════════════════════════════════════════════
// IMAGE RULES
// ═══════════════════════════════════════════════════════════════════

export const IMAGE_MULTIPLE_PRIMARY: RuleDefinition = {
  ruleId: 'IMAGE_MULTIPLE_PRIMARY',
  title: 'Multiple Primary Images',
  description: 'Phone has multiple images with the same lowest sortOrder (duplicate primaries)',
  severity: 'low',
  entityType: 'phone_image',
  canAutoFix: true,
  async detect(ctx): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    for (const phone of ctx.entities) {
      const id = phone._id?.toString();
      if (!id) continue;
      const images = ctx.lookups.images.get(id) || [];
      const withOrder0 = images.filter((img: Record<string, unknown>) => img.sortOrder === 0);
      if (withOrder0.length > 1) {
        issues.push({
          issueKey: issueKey(this.ruleId, 'phone', id, 'images'),
          entityType: 'phone_image', entityId: id, issueType: this.ruleId,
          severity: this.severity, field: 'sortOrder',
          currentValue: `${withOrder0.length} images with sortOrder 0`,
          suggestedValue: 'Set unique sortOrder values',
          source: 'system', confidence: 0.9,
        });
      }
    }
    return issues;
  },
  async autoFix(issue: DetectedIssue, ctx: FixContext): Promise<FixResult> {
    if (ctx.dryRun) {
      return {
        success: true,
        changes: [{ field: 'sortOrder', oldValue: 'multiple 0', newValue: 'sequential 0,1,2...' }],
      };
    }
    try {
      const images = await PhoneImage.find({ phoneId: issue.entityId }).sort({ sortOrder: 1 }).lean();
      if (images.length <= 1) return { success: false, changes: [], error: 'No duplicate primaries found' };
      const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img.sortOrder !== i) {
          changes.push({ field: 'sortOrder', oldValue: img.sortOrder, newValue: i });
          await PhoneImage.updateOne({ _id: img._id }, { $set: { sortOrder: i } });
        }
      }
      if (changes.length === 0) return { success: false, changes: [], error: 'Already sequential' };
      return { success: true, changes };
    } catch (e: unknown) {
      return { success: false, changes: [], error: e instanceof Error ? e.message : 'Fix failed' };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════
// ALL RULES REGISTRY
// ═══════════════════════════════════════════════════════════════════

export const ALL_RULES: RuleDefinition[] = [
  PHONE_MISSING_SPECS,
  PHONE_DUPLICATE_SLUG,
  PHONE_INVALID_PRICE,
  PHONE_MISSING_PRIMARY_IMAGE,
  PHONE_MISSING_PRICE,
  PHONE_STALE_PRICE,
  PHONE_INVALID_RELEASE_DATE,
  PHONE_MISSING_PTA_STATUS,
  SPECS_EMPTY,
  SPECS_MISSING_KEY_FIELDS,
  SPECS_OBJECT_IN_STRING,
  PHONE_MISSING_BRAND,
  PHONE_DUPLICATE_NORMALIZED,
  BENCHMARK_IMPOSSIBLE_SCORE,
  IMAGE_MULTIPLE_PRIMARY,
  SPECS_DUPLICATE,
  ORPHAN_SPECS,
  ORPHAN_IMAGE,
  ORPHAN_PRICE,
  ORPHAN_BENCHMARK,
];

export function getRuleById(ruleId: string): RuleDefinition | undefined {
  return ALL_RULES.find(r => r.ruleId === ruleId);
}

export function getRulesForEntityType(entityType: string): RuleDefinition[] {
  return ALL_RULES.filter(r => r.entityType === entityType);
}