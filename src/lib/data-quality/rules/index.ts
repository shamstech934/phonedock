// Data Quality Rules — barrel export
import { RuleDefinition } from '../types';
import { ALL_RULES, getRulesForEntityType } from './phone-rules';
import { EXTENDED_RULES } from './extended-rules';

export const ALL_QUALITY_RULES = [...ALL_RULES, ...EXTENDED_RULES];

// FIX #12: getRuleById now searches BOTH phone rules AND extended rules
export function getRuleById(ruleId: string): RuleDefinition | undefined {
  return ALL_QUALITY_RULES.find(r => r.ruleId === ruleId);
}

export { getRulesForEntityType };

// Re-export rule definitions by ID for direct import
export {
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
} from './phone-rules';

export {
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
} from './extended-rules';