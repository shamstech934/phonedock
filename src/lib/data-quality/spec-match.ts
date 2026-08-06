// ─── Shared local-dataset spec matching + apply logic ──────────────────────
// Used by:
//  - POST /api/admin/data-quality/spec-enrichment/batch-apply (manual "Auto match" buttons)
//  - PHONE_MISSING_SPECS.autoFix (Data Quality "Fix All" / "Auto-fix" engine)
// Single source of truth so both call paths behave identically and stay in sync.

import { Types } from 'mongoose';
import { Phone, PhoneSpecs, DeviceSpecDataset } from '@/lib/models';
import { DEVICE_SPEC_TEXT_FIELDS } from '@/lib/models/DeviceSpecDataset';

export interface SpecMatchResult {
  phoneId: string;
  modelName: string;
  status: 'applied' | 'needs_review' | 'not_found' | 'failed';
  score?: number;
  margin?: number;
  candidate?: string;
  message?: string;
  update?: Record<string, unknown>;
}

const normalize = (v: unknown) => String(v ?? '').toLowerCase()
  .replace(/\b(dual sim|single sim|standard edition|premium edition|td-lte|cn|global|us|eu)\b/g, ' ')
  .replace(/\b\d{5,}[a-z0-9-]*\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ').trim();
const modelTokens = (value: string) => value.split(' ').filter(Boolean);
const variantTokens = (value: string) => new Set(modelTokens(value).filter(token => /^(?:5g|4g|lte|pro|max|plus|ultra|mini|fe|se|fold|flip|note|play|lite|neo|prime|zoom|active)$/.test(token)));
const modelNumberTokens = (value: string) => new Set(modelTokens(value).filter(token => /\d/.test(token)));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isCompatibleCandidate(queryModel: string, queryBrand: string, candidate: any): boolean {
  const candidateBrand = String(candidate.normalizedBrand || '');
  const candidateModel = String(candidate.normalizedModel || '');
  if (queryBrand && candidateBrand && candidateBrand !== queryBrand) return false;
  const queryNumbers = modelNumberTokens(queryModel);
  const candidateNumbers = modelNumberTokens(candidateModel);
  if (queryNumbers.size && ![...queryNumbers].some(token => candidateNumbers.has(token))) return false;
  const qVariants = variantTokens(queryModel);
  const cVariants = variantTokens(candidateModel);
  for (const token of qVariants) if (!cVariants.has(token)) return false;
  for (const token of cVariants) if (!qVariants.has(token)) return false;
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scoreCandidate(queryModel: string, queryBrand: string, candidate: any): number {
  if (!isCompatibleCandidate(queryModel, queryBrand, candidate)) return 0;
  const a = new Set(modelTokens(queryModel));
  const b = new Set(modelTokens(String(candidate.normalizedModel || '')));
  const common = [...a].filter(x => b.has(x)).length;
  const union = new Set([...a, ...b]).size || 1;
  let value = Math.round((common / union) * 85);
  if (queryBrand && candidate.normalizedBrand === queryBrand) value += 15;
  if (candidate.normalizedModel === queryModel) value = 100;
  return Math.min(100, value);
}

const clean = (value: unknown, max = 700) => String(value ?? '').trim().slice(0, max);
const numeric = (value: unknown, pattern: RegExp) => { const match = String(value || '').match(pattern); return match ? Number(match[1]) : null; };

/**
 * Finds the best local-dataset spec match for a single phone and, if the match is
 * confident enough, writes it (upserts PhoneSpecs, updates Phone provenance fields).
 * Ambiguous matches are returned as 'needs_review' and never written automatically.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function matchAndApplySpecsForPhone(phone: any, threshold: number, adminId: string, dryRun = false): Promise<SpecMatchResult> {
  const modelName = phone.modelName;
  try {
    const queryModel = normalize(phone.modelName);
    const queryBrand = normalize(phone.brandId?.name || phone.brandName || '');
    const tokens = queryModel.split(' ').filter((t: string) => t.length > 1);
    const regex = tokens.length ? new RegExp(tokens.slice(0, 5).map((t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*'), 'i') : /.^/;
    const candidateQuery = queryBrand
      ? { normalizedBrand: queryBrand, normalizedModel: regex }
      : { normalizedModel: regex };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rows = await DeviceSpecDataset.find(candidateQuery).limit(100).lean() as any[];
    if (!rows.length && queryBrand) {
      rows = await DeviceSpecDataset.find({ normalizedBrand: queryBrand }).limit(100).lean() as any[];
    }
    const ranked = rows.map(row => ({ row, score: scoreCandidate(queryModel, queryBrand, row) })).sort((a, b) => b.score - a.score);
    const best = ranked[0];
    const second = ranked[1];
    if (!best || best.score < 25) {
      return { phoneId: String(phone._id), modelName, status: 'not_found' };
    }
    const margin = second ? best.score - second.score : best.score;
    const source = best.row;
    const update: Record<string, unknown> = {};
    for (const field of DEVICE_SPEC_TEXT_FIELDS) update[field] = clean(source[field], field === 'fiveG' ? 20 : 700);
    const populatedFields = Object.values(update).filter(Boolean).length;
    if (best.score < threshold || margin < 8 || populatedFields < 3) {
      return { phoneId: String(phone._id), modelName, status: 'needs_review', score: best.score, margin, candidate: `${source.brand || ''} ${source.model || ''}`.trim() };
    }
    const numbers = {
      ramGB: numeric(update.ram, /(\d+(?:\.\d+)?)\s*gb/i), storageGB: numeric(update.storage, /(\d+(?:\.\d+)?)\s*gb/i),
      batteryMAh: numeric(update.battery, /(\d+(?:\.\d+)?)\s*mah/i), mainCameraMP: numeric(update.mainCamera, /(\d+(?:\.\d+)?)\s*mp/i),
      screenSizeInch: numeric(update.display, /(\d+(?:\.\d+)?)\s*(?:inch|inches|\")/i),
    };
    Object.entries(numbers).forEach(([key, value]) => { if (value) update[key] = value; });

    if (!dryRun) {
      await PhoneSpecs.updateOne({ phoneId: phone._id }, { $set: update, $setOnInsert: { phoneId: phone._id } }, { upsert: true });
      await Phone.updateOne({ _id: phone._id }, { $set: {
        sourceName: clean(source.sourceName, 120) || 'SpecsDekh local dataset', sourceUrl: clean(source.sourceUrl, 1000),
        lastVerifiedAt: new Date(), dataConfidence: 'auto-imported', updatedBy: new Types.ObjectId(adminId),
      } });
    }
    return { phoneId: String(phone._id), modelName, status: 'applied', score: best.score, candidate: `${source.brand || ''} ${source.model || ''}`.trim(), update };
  } catch (error) {
    return { phoneId: String(phone._id), modelName, status: 'failed', message: error instanceof Error ? error.message : 'Unknown error' };
  }
}
