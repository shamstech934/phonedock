import { RuleDefinition, DetectedIssue, DetectionContext } from '../types';

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
// PRICE TRACKER RULES
// ═══════════════════════════════════════════════════════════════════

export const PRICE_STALE_TRACKED: RuleDefinition = {
  ruleId: 'PRICE_STALE_TRACKED',
  title: 'Stale Tracked Price',
  description: 'Retail listing price has not been checked recently',
  severity: 'low',
  entityType: 'retail_listing',
  canAutoFix: false,
  async detect(_ctx: DetectionContext): Promise<DetectedIssue[]> {
    return []; // Detected in scanner
  },
};

export const PRICE_SOURCE_INACTIVE: RuleDefinition = {
  ruleId: 'PRICE_SOURCE_INACTIVE',
  title: 'Inactive Price Source',
  description: 'A price source that was previously active is now disabled',
  severity: 'info',
  entityType: 'price_source',
  canAutoFix: false,
  async detect(_ctx: DetectionContext): Promise<DetectedIssue[]> {
    return [];
  },
};

export const PRICE_OUTLIER: RuleDefinition = {
  ruleId: 'PRICE_OUTLIER',
  title: 'Price Outlier',
  description: 'Retail listing price is significantly different from phone price',
  severity: 'medium',
  entityType: 'retail_listing',
  canAutoFix: false,
  async detect(_ctx: DetectionContext): Promise<DetectedIssue[]> {
    return []; // Detected in scanner
  },
};

export const PRICE_MISMATCH: RuleDefinition = {
  ruleId: 'PRICE_MISMATCH',
  title: 'Price Mismatch',
  description: 'Lowest retail listing price is lower than phone price but phone is not updated',
  severity: 'medium',
  entityType: 'retail_listing',
  canAutoFix: false,
  async detect(_ctx: DetectionContext): Promise<DetectedIssue[]> {
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
    return []; // Detected via importId association
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
];