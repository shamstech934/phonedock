// ─── Data Quality Rule & Issue Types ───────────────────────────────

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type EntityType = 'phone' | 'brand' | 'phone_specs' | 'phone_image' | 'phone_price' | 'phone_benchmark' | 'review' | 'video' | 'import' | 'price_source' | 'retail_listing';
export type IssueStatus = 'open' | 'ignored' | 'resolved' | 'auto_fixed' | 'needs_review' | 'false_positive';
export type IssueSeverity = Severity;

export interface DetectedIssue {
  issueKey: string;
  entityType: EntityType;
  entityId: string;
  issueType: string;
  severity: Severity;
  field: string;
  currentValue: unknown;
  suggestedValue: unknown;
  source: string;
  confidence: number;
  importId?: string;
  metadata?: Record<string, unknown>;
}

export interface RuleDefinition {
  ruleId: string;
  title: string;
  description: string;
  severity: Severity;
  entityType: EntityType;
  /** Run detection on a batch of entities. Returns array of detected issues. */
  detect: (ctx: DetectionContext) => Promise<DetectedIssue[]>;
  /** Generate a suggested fix value for an issue */
  suggest?: (issue: DetectedIssue, ctx: DetectionContext) => Promise<unknown>;
  /** Whether this rule supports safe auto-fix */
  canAutoFix: boolean;
  /** Execute a safe auto-fix. Must be deterministic and idempotent. Returns changes made. */
  autoFix?: (issue: DetectedIssue, ctx: FixContext) => Promise<FixResult>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRecord = Record<string, any>;

export interface DetectionContext {
  /** Batch of raw Mongoose documents (already .lean()) */
  entities: AnyRecord[];
  /** Pre-fetched lookup maps for cross-referencing */
  lookups: {
    brands: Map<string, AnyRecord>;
    specs: Map<string, AnyRecord>;
    images: Map<string, AnyRecord[]>;
    prices: Map<string, AnyRecord[]>;
    benchmarks: Map<string, AnyRecord>;
  };
  /** Import ID if this is an import-specific scan */
  importId?: string;
}

export interface FixContext {
  adminId: string;
  dryRun: boolean;
}

export interface FixResult {
  success: boolean;
  changes: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
  error?: string;
}

/** Health score category weights and calculation */
export interface HealthCategory {
  name: string;
  weight: number;
  maxDeduction: number;
  description: string;
}

export const HEALTH_CATEGORIES: HealthCategory[] = [
  { name: 'Core Identity', weight: 20, maxDeduction: 20, description: 'Phone, brand, slug, status completeness' },
  { name: 'Specifications', weight: 25, maxDeduction: 25, description: 'PhoneSpecs document and key fields' },
  { name: 'Images', weight: 15, maxDeduction: 15, description: 'Phone images and primary image' },
  { name: 'Prices', weight: 15, maxDeduction: 15, description: 'Price validity and freshness' },
  { name: 'Relationships', weight: 10, maxDeduction: 10, description: 'Orphan records and broken references' },
  { name: 'Duplicates', weight: 10, maxDeduction: 10, description: 'Duplicate phones and brands' },
  { name: 'Verification', weight: 5, maxDeduction: 5, description: 'Data confidence and verification status' },
];