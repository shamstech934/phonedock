// Data Quality — barrel export
export { startScan, executeScan, executeAutoFix, calculateHealthScore } from './scanner';
export { ALL_QUALITY_RULES, getRuleById, getRulesForEntityType } from './rules';
export type { DetectedIssue, FixResult, FixContext, DetectionContext, HealthCategory, Severity, IssueStatus, EntityType } from './types';
export { HEALTH_CATEGORIES } from './types';