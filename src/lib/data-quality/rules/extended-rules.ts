import { RuleDefinition, DetectedIssue, DetectionContext } from '../types';
import { PriceSource, PhoneRetailListing, Phone } from '@/lib/models';

// ─── Helper ───────────────────────────────────────────────────────
function issueKey(ruleId: string, entityType: string, entityId: string, field?: string): string {
  return `${ruleId}:${entityType}:${entityId}${field ? `:${field}` : ''}`;
}

// ═══════════════════════════════════════════════════════════════════
// BRAND RULES
// ═══════════════════════════════════════════════════════════════════

export const BRAND_DUPLICATE_NORMALIZED: RuleDefinition = {
  ruleId: 'BRAND_DUPLICATE_NORMALIZED',
  title: 'Duplicate Brand Name',
  description: 'Two brands have the same normalized name (case-insensitive)',
  severity: 'high',
  entityType: 'brand',
  canAutoFix: false,
  async detect(_ctx: DetectionContext): Promise<DetectedIssue[]> {
    // Brand duplicates are detected via a dedicated scan in the scanner
    return [];
  },
};

export const BRAND_MISSING_LOGO: RuleDefinition = {
  ruleId: 'BRAND_MISSING_LOGO',
  title: 'Brand Missing Logo',
  description: 'Brand has no logo set',
  severity: 'low',
  entityType: 'brand',
  canAutoFix: false,
  async detect(_ctx: DetectionContext): Promise<DetectedIssue[]> {
    // Detected in scanner
    return [];
  },
};

// ═══════════════════════════════════════════════════════════════════
// PRICE TRACKER RULES (real implementations)
// ═══════════════════════════════════════════════════════════════════

export const PRICE_STALE_TRACKED: RuleDefinition = {
  ruleId: 'PRICE_STALE_TRACKED',
  title: 'Stale Tracked Price',
  description: 'Retail listing price has not been checked in over 14 days',
  severity: 'low',
  entityType: 'retail_listing',
  canAutoFix: false,
  async detect(_ctx: DetectionContext): Promise<DetectedIssue[]> {
    // Detected via the dedicated price scan in scanner.ts (scanPriceTrackerIssues)
    return [];
  },
};

export const PRICE_SOURCE_INACTIVE: RuleDefinition = {
  ruleId: 'PRICE_SOURCE_INACTIVE',
  title: 'Inactive Price Source',
  description: 'A price source that was previously active is now disabled or failed',
  severity: 'info',
  entityType: 'price_source',
  canAutoFix: false,
  async detect(_ctx: DetectionContext): Promise<DetectedIssue[]> {
    // Detected via the dedicated price scan in scanner.ts
    return [];
  },
};

export const PRICE_OUTLIER: RuleDefinition = {
  ruleId: 'PRICE_OUTLIER',
  title: 'Price Outlier',
  description: 'Retail listing price is significantly different from phone price (>50% deviation)',
  severity: 'medium',
  entityType: 'retail_listing',
  canAutoFix: false,
  async detect(_ctx: DetectionContext): Promise<DetectedIssue[]> {
    // Detected via the dedicated price scan in scanner.ts
    return [];
  },
};

export const PRICE_MISMATCH: RuleDefinition = {
  ruleId: 'PRICE_MISMATCH',
  title: 'Price Mismatch',
  description: 'Lowest retail listing price is significantly lower than phone price but phone is not updated',
  severity: 'medium',
  entityType: 'retail_listing',
  canAutoFix: false,
  async detect(_ctx: DetectionContext): Promise<DetectedIssue[]> {
    // Detected via the dedicated price scan in scanner.ts
    return [];
  },
};

// ═══════════════════════════════════════════════════════════════════
// IMPORT RULES
// ═══════════════════════════════════════════════════════════════════

export const IMPORT_FAILED_ROWS: RuleDefinition = {
  ruleId: 'IMPORT_FAILED_ROWS',
  title: 'Failed Import Rows',
  description: 'Import job had rows that failed to process',
  severity: 'medium',
  entityType: 'import',
  canAutoFix: false,
  async detect(_ctx: DetectionContext): Promise<DetectedIssue[]> {
    return []; // Detected via importId association in scanner.ts
  },
};

export const IMPORT_LOW_CONFIDENCE: RuleDefinition = {
  ruleId: 'IMPORT_LOW_CONFIDENCE',
  title: 'Low-Confidence Imported Data',
  description: 'Phone was imported with auto-imported data confidence',
  severity: 'info',
  entityType: 'phone',
  canAutoFix: false,
  async detect(ctx: DetectionContext): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    for (const phone of ctx.entities) {
      const id = phone._id?.toString();
      if (!id) continue;
      if (phone.dataConfidence === 'auto-imported') {
        issues.push({
          issueKey: issueKey(this.ruleId, 'phone', id),
          entityType: 'phone', entityId: id, issueType: this.ruleId,
          severity: 'info', field: 'dataConfidence',
          currentValue: 'auto-imported', suggestedValue: 'Verify and mark as verified',
          source: 'system', confidence: 0.8,
          importId: ctx.importId,
        });
      }
    }
    return issues;
  },
};

// ═══════════════════════════════════════════════════════════════════
// ADDITIONAL PHONE DATA RULES
// ═══════════════════════════════════════════════════════════════════

export const PHONE_EMPTY_DESCRIPTION: RuleDefinition = {
  ruleId: 'PHONE_EMPTY_DESCRIPTION',
  title: 'Empty Description',
  description: 'Published phone has no description set',
  severity: 'low',
  entityType: 'phone',
  canAutoFix: false,
  async detect(ctx: DetectionContext): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    for (const phone of ctx.entities) {
      const id = phone._id?.toString();
      if (!id || phone.status !== 'published') continue;
      if (!phone.description || !phone.description.trim()) {
        issues.push({
          issueKey: issueKey(this.ruleId, 'phone', id, 'description'),
          entityType: 'phone', entityId: id, issueType: this.ruleId,
          severity: this.severity, field: 'description',
          currentValue: '', suggestedValue: 'Add a phone description',
          source: 'system', confidence: 0.9,
        });
      }
    }
    return issues;
  },
};

export const PHONE_MISSING_RELEASE_DATE: RuleDefinition = {
  ruleId: 'PHONE_MISSING_RELEASE_DATE',
  title: 'Missing Release Date',
  description: 'Published phone has no release date',
  severity: 'low',
  entityType: 'phone',
  canAutoFix: false,
  async detect(ctx: DetectionContext): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    for (const phone of ctx.entities) {
      const id = phone._id?.toString();
      if (!id || phone.status !== 'published') continue;
      if (!phone.releaseDate) {
        issues.push({
          issueKey: issueKey(this.ruleId, 'phone', id, 'releaseDate'),
          entityType: 'phone', entityId: id, issueType: this.ruleId,
          severity: this.severity, field: 'releaseDate',
          currentValue: null, suggestedValue: 'Set a release date',
          source: 'system', confidence: 0.8,
        });
      }
    }
    return issues;
  },
};

export const SPECS_RAM_STORAGE_MISMATCH: RuleDefinition = {
  ruleId: 'SPECS_RAM_STORAGE_MISMATCH',
  title: 'RAM/Storage Numeric Mismatch',
  description: 'The numeric ramGB or storageGB does not match the string ram/storage field',
  severity: 'medium',
  entityType: 'phone_specs',
  canAutoFix: false,
  async detect(ctx: DetectionContext): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    for (const phone of ctx.entities) {
      const id = phone._id?.toString();
      if (!id) continue;
      const specs = ctx.lookups.specs.get(id);
      if (!specs) continue;

      // Check RAM
      if (specs.ramGB > 0 && specs.ram) {
        const ramStr = specs.ram.replace(/[^0-9]/g, '');
        const ramNum = parseInt(ramStr, 10);
        if (ramNum > 0 && ramNum !== specs.ramGB) {
          issues.push({
            issueKey: issueKey(this.ruleId, 'phone', id, 'ramGB'),
            entityType: 'phone_specs', entityId: id, issueType: this.ruleId,
            severity: 'medium', field: 'ramGB',
            currentValue: specs.ramGB, suggestedValue: ramNum,
            source: 'system', confidence: 0.7,
            metadata: { stringField: 'ram', stringValue: specs.ram, numericValue: specs.ramGB, extractedValue: ramNum },
          });
        }
      }

      // Check Storage
      if (specs.storageGB > 0 && specs.storage) {
        const storageStr = specs.storage.replace(/[^0-9]/g, '');
        const storageNum = parseInt(storageStr, 10);
        if (storageNum > 0 && storageNum !== specs.storageGB) {
          issues.push({
            issueKey: issueKey(this.ruleId, 'phone', id, 'storageGB'),
            entityType: 'phone_specs', entityId: id, issueType: this.ruleId,
            severity: 'medium', field: 'storageGB',
            currentValue: specs.storageGB, suggestedValue: storageNum,
            source: 'system', confidence: 0.7,
            metadata: { stringField: 'storage', stringValue: specs.storage, numericValue: specs.storageGB, extractedValue: storageNum },
          });
        }
      }
    }
    return issues;
  },
};

export const PHONE_NO_BENCHMARK: RuleDefinition = {
  ruleId: 'PHONE_NO_BENCHMARK',
  title: 'Missing Benchmark Data',
  description: 'Published phone has no benchmark scores recorded',
  severity: 'info',
  entityType: 'phone',
  canAutoFix: false,
  async detect(ctx: DetectionContext): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    for (const phone of ctx.entities) {
      const id = phone._id?.toString();
      if (!id || phone.status !== 'published') continue;
      if (!ctx.lookups.benchmarks.has(id)) {
        issues.push({
          issueKey: issueKey(this.ruleId, 'phone', id, 'benchmarks'),
          entityType: 'phone', entityId: id, issueType: this.ruleId,
          severity: 'info', field: 'benchmarks',
          currentValue: null, suggestedValue: 'Add benchmark scores',
          source: 'system', confidence: 0.6,
        });
      }
    }
    return issues;
  },
};

export const PHONE_NO_PRICES: RuleDefinition = {
  ruleId: 'PHONE_NO_PRICES',
  title: 'No Retail Price Listings',
  description: 'Phone has no retail price listings from price tracker sources',
  severity: 'info',
  entityType: 'phone',
  canAutoFix: false,
  async detect(ctx: DetectionContext): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    for (const phone of ctx.entities) {
      const id = phone._id?.toString();
      if (!id || phone.status !== 'published') continue;
      const prices = ctx.lookups.prices.get(id) || [];
      if (prices.length === 0) {
        issues.push({
          issueKey: issueKey(this.ruleId, 'phone', id, 'prices'),
          entityType: 'phone', entityId: id, issueType: this.ruleId,
          severity: 'info', field: 'prices',
          currentValue: 0, suggestedValue: 'Add retail price listings',
          source: 'system', confidence: 0.5,
        });
      }
    }
    return issues;
  },
};

// ═══════════════════════════════════════════════════════════════════
// ALL EXTENDED RULES
// ═══════════════════════════════════════════════════════════════════

export const EXTENDED_RULES: RuleDefinition[] = [
  BRAND_DUPLICATE_NORMALIZED,
  BRAND_MISSING_LOGO,
  PRICE_STALE_TRACKED,
  PRICE_SOURCE_INACTIVE,
  PRICE_OUTLIER,
  PRICE_MISMATCH,
  IMPORT_FAILED_ROWS,
  IMPORT_LOW_CONFIDENCE,
  PHONE_EMPTY_DESCRIPTION,
  PHONE_MISSING_RELEASE_DATE,
  SPECS_RAM_STORAGE_MISMATCH,
  PHONE_NO_BENCHMARK,
  PHONE_NO_PRICES,
];