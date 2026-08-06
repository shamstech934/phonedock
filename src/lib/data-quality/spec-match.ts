// ─── Shared local-dataset spec matching + apply logic ──────────────────────
// Used by:
//  - POST /api/admin/data-quality/spec-enrichment/batch-apply (manual "Auto match" buttons)
//  - PHONE_MISSING_SPECS.autoFix (Data Quality "Fix All" / "Auto-fix" engine)
// Single source of truth so both call paths behave identically and stay in sync.

import { Types } from 'mongoose';
import { Phone, PhoneSpecs, DeviceSpecDataset } from '@/lib/models';

export interface SpecDatasetCandidate {
  _id?: unknown;
  brand?: string;
  model?: string;
  normalizedBrand?: string;
  normalizedModel?: string;
  display?: string;
  chipset?: string;
  ram?: string;
  storage?: string;
  battery?: string;
  mainCamera?: string;
  fiveG?: string;
  sourceName?: string;
  sourceUrl?: string;
}

export interface SpecMatchResult {
  phoneId: string;
  modelName: string;
  status: 'applied' | 'needs_review' | 'not_found' | 'invalid_phone' | 'failed';
  score?: number;
  margin?: number;
  candidate?: string;
  message?: string;
  update?: Record<string, unknown>;
}

const GENERIC_PAGE_WORDS = /\b(?:mobiles?|mobile phones?|smartphones?|phones? prices?|price list|latest phones?|all phones?|catalog(?:ue)?|compare phones?|whatmobile|specifications?|reviews?)\b/i;
const VARIANT_RE = /^(?:5g|4g|lte|pro|max|plus|ultra|mini|fe|se|fold|flip|note|play|lite|neo|prime|zoom|active)$/;

export const normalizeSpecName = (v: unknown) => String(v ?? '').toLowerCase()
  .replace(/&(?:#8211|ndash|mdash);?/g, ' ')
  .replace(/\b(dual sim|single sim|standard edition|premium edition|td-lte|cn|global|us|eu)\b/g, ' ')
  .replace(/\b(?:mobile phones?|mobiles?|smartphones?|phones?)\s+prices?(?:\s+\d{4})?\b/g, ' ')
  .replace(/\b(?:whatmobile|priceoye|gsmarena)\b/g, ' ')
  .replace(/\b\d{5,}[a-z0-9-]*\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ').trim();

const modelTokens = (value: string) => value.split(' ').filter(Boolean);
const variantTokens = (value: string) => new Set(modelTokens(value).filter(token => VARIANT_RE.test(token)));
const modelNumberTokens = (value: string) => new Set(modelTokens(value).filter(token => /\d/.test(token) && !/^20\d{2}$/.test(token)));
const clean = (value: unknown, max = 700) => String(value ?? '').trim().slice(0, max);
const numeric = (value: unknown, pattern: RegExp) => { const match = String(value || '').match(pattern); return match ? Number(match[1]) : null; };

function stripBrand(model: string, brand: string): string {
  if (!brand) return model;
  const brandTokens = new Set(modelTokens(brand));
  return modelTokens(model).filter(token => !brandTokens.has(token)).join(' ').trim();
}

function populatedSpecCount(candidate: SpecDatasetCandidate): number {
  return [candidate.display, candidate.chipset, candidate.ram, candidate.storage, candidate.battery, candidate.mainCamera, candidate.fiveG]
    .filter(value => clean(value).length > 0).length;
}

export function looksLikeCatalogOrCategoryRecord(model: unknown, sourceUrl: unknown = ''): boolean {
  const rawModel = String(model ?? '').replace(/&(?:#8211|ndash|mdash);?/g, ' ').trim();
  const normalized = normalizeSpecName(rawModel);
  if (!normalized) return true;
  if (GENERIC_PAGE_WORDS.test(rawModel)) return true;
  // A real phone model almost always contains a model family/number. Brand landing
  // pages often contain only a brand plus a year or generic marketing words.
  const meaningfulNumbers = modelNumberTokens(normalized);
  const meaningfulTokens = modelTokens(normalized).filter(token => token.length > 1 && !/^20\d{2}$/.test(token));
  if (!meaningfulNumbers.size && meaningfulTokens.length <= 2 && /(?:mobiles?|phones?|prices?|catalog)/i.test(rawModel)) return true;
  try {
    const url = new URL(String(sourceUrl || ''));
    const path = url.pathname.toLowerCase();
    if (/\/(?:mobiles?|phones?|brands?|price-list|mobile-prices)\/?$/.test(path)) return true;
  } catch { /* source URL is optional */ }
  return false;
}

function isUsableCandidate(candidate: SpecDatasetCandidate): boolean {
  if (looksLikeCatalogOrCategoryRecord(candidate.model, candidate.sourceUrl)) return false;
  return populatedSpecCount(candidate) >= 2;
}

function isCompatibleCandidate(queryModel: string, queryBrand: string, candidate: SpecDatasetCandidate): boolean {
  if (!isUsableCandidate(candidate)) return false;
  const candidateBrand = normalizeSpecName(candidate.normalizedBrand || candidate.brand || '');
  const candidateModel = stripBrand(normalizeSpecName(candidate.normalizedModel || candidate.model || ''), candidateBrand);
  const queryModelWithoutBrand = stripBrand(queryModel, queryBrand);
  if (queryBrand && candidateBrand && candidateBrand !== queryBrand) return false;

  const queryNumbers = modelNumberTokens(queryModelWithoutBrand);
  const candidateNumbers = modelNumberTokens(candidateModel);
  if (queryNumbers.size && ![...queryNumbers].every(token => candidateNumbers.has(token))) return false;

  const qVariants = variantTokens(queryModelWithoutBrand);
  const cVariants = variantTokens(candidateModel);
  for (const token of qVariants) if (!cVariants.has(token)) return false;
  for (const token of cVariants) if (!qVariants.has(token)) return false;
  return true;
}

function scoreCandidate(queryModel: string, queryBrand: string, candidate: SpecDatasetCandidate): number {
  if (!isCompatibleCandidate(queryModel, queryBrand, candidate)) return 0;
  const qModel = stripBrand(queryModel, queryBrand);
  const cBrand = normalizeSpecName(candidate.normalizedBrand || candidate.brand || '');
  const cModel = stripBrand(normalizeSpecName(candidate.normalizedModel || candidate.model || ''), cBrand);
  const a = new Set(modelTokens(qModel));
  const b = new Set(modelTokens(cModel));
  const common = [...a].filter(x => b.has(x)).length;
  const union = new Set([...a, ...b]).size || 1;
  let value = Math.round((common / union) * 82);
  if (queryBrand && cBrand === queryBrand) value += 12;
  if (cModel === qModel) value = 100;
  else if (cModel.startsWith(qModel) || qModel.startsWith(cModel)) value += 4;
  if (populatedSpecCount(candidate) >= 5) value += 2;
  return Math.min(100, value);
}

function rankCandidates(phone: any, candidates: SpecDatasetCandidate[]) {
  const queryBrand = normalizeSpecName(phone.brandId?.name || phone.brandName || '');
  const queryModel = normalizeSpecName(phone.modelName);
  return candidates
    .map(row => ({ row, score: scoreCandidate(queryModel, queryBrand, row) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || populatedSpecCount(b.row) - populatedSpecCount(a.row));
}

/**
 * Finds the best local-dataset spec match for a single phone and, if the match is
 * confident enough, writes it. When preloadedCandidates are supplied the function
 * performs no DeviceSpecDataset query, allowing bulk matching to use one query per
 * batch instead of one query per phone.
 */
export async function matchAndApplySpecsForPhone(
  phone: any,
  threshold: number,
  adminId: string,
  dryRun = false,
  preloadedCandidates?: SpecDatasetCandidate[],
): Promise<SpecMatchResult> {
  const modelName = String(phone.modelName || '').trim();
  try {
    if (looksLikeCatalogOrCategoryRecord(modelName, phone.sourceUrl)) {
      return {
        phoneId: String(phone._id), modelName, status: 'invalid_phone',
        message: 'This catalog record looks like a brand/category page rather than an individual phone model.',
      };
    }

    const queryModel = normalizeSpecName(modelName);
    const queryBrand = normalizeSpecName(phone.brandId?.name || phone.brandName || '');
    let rows: SpecDatasetCandidate[];
    if (preloadedCandidates) {
      rows = preloadedCandidates;
    } else {
      const queryModelWithoutBrand = stripBrand(queryModel, queryBrand);
      const tokens = queryModelWithoutBrand.split(' ').filter((t: string) => t.length > 1);
      const regex = tokens.length
        ? new RegExp(tokens.slice(0, 5).map((t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*'), 'i')
        : /.^/;
      const candidateQuery = queryBrand
        ? { normalizedBrand: queryBrand, normalizedModel: regex }
        : { normalizedModel: regex };
      rows = await DeviceSpecDataset.find(candidateQuery)
        .select('brand model normalizedBrand normalizedModel display chipset ram storage battery mainCamera fiveG sourceName sourceUrl')
        .limit(120).maxTimeMS(5000).lean() as unknown as SpecDatasetCandidate[];
      if (!rows.length && queryBrand) {
        rows = await DeviceSpecDataset.find({ normalizedBrand: queryBrand })
          .select('brand model normalizedBrand normalizedModel display chipset ram storage battery mainCamera fiveG sourceName sourceUrl')
          .limit(500).maxTimeMS(5000).lean() as unknown as SpecDatasetCandidate[];
      }
    }

    const ranked = rankCandidates(phone, rows);
    const best = ranked[0];
    const second = ranked[1];
    if (!best || best.score < 25) {
      return { phoneId: String(phone._id), modelName, status: 'not_found' };
    }
    const margin = second ? best.score - second.score : best.score;
    const source = best.row;
    const update: Record<string, unknown> = {
      display: clean(source.display), chipset: clean(source.chipset), ram: clean(source.ram), storage: clean(source.storage),
      battery: clean(source.battery), mainCamera: clean(source.mainCamera), fiveG: clean(source.fiveG, 20),
    };
    const populatedFields = Object.values(update).filter(Boolean).length;
    if (best.score < threshold || margin < 8 || populatedFields < 3) {
      return {
        phoneId: String(phone._id), modelName, status: 'needs_review', score: best.score, margin,
        candidate: `${source.brand || ''} ${source.model || ''}`.trim(),
        message: populatedFields < 3 ? 'Candidate does not contain enough specification fields.' : undefined,
      };
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
