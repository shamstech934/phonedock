import type { BuyingIntent, PreferenceKey } from './intent';
import type { Phone } from '@/components/shared/types';
import { getAdvisorScore, type AdvisorUseCase } from './phone-advisor';

export interface RecommendationCandidate {
  id: string; slug: string; modelName: string; pricePKR: number; ptaApproved: boolean;
  active?: boolean; status?: string; brandName?: string; brandSlug?: string;
  cameraScore?: number; performanceScore?: number; batteryScore?: number;
  displayScore?: number; valueScore?: number; overallRating?: number;
  specs?: { display?: string; charging?: string; ram?: string; storage?: string; chipset?: string; battery?: string };
  lastVerifiedAt?: Date | string | null; dataConfidence?: string;
}

export interface RecommendationAlternative {
  type: 'cheaper' | 'upgrade' | 'balanced';
  phone: RecommendationCandidate;
  reason: string;
  priceDifference: number;
}

export interface RecommendationResult {
  phone: RecommendationCandidate;
  matchPercentage: number;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  compromises: string[];
  sourceData: string[];
  dataFreshness: string;
  missingData: string[];
  alternatives: RecommendationAlternative[];
  verdict: string;
}

const field: Record<PreferenceKey, keyof RecommendationCandidate> = {
  camera: 'cameraScore', gaming: 'performanceScore', battery: 'batteryScore',
  performance: 'performanceScore', display: 'displayScore', value: 'valueScore',
};
const label: Record<PreferenceKey, string> = {
  camera: 'camera', gaming: 'gaming performance', battery: 'battery',
  performance: 'performance', display: 'display', value: 'value',
};
const finiteScore = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 100 ? value : null;
const safeScore = (value: unknown) => finiteScore(value) ?? 0;


function deviceClass(phone: RecommendationCandidate) {
  const haystack = `${phone.modelName} ${phone.specs?.display || ''}`.toLowerCase();
  return /tablet|tab|ipad/.test(haystack) ? 'tablet' : 'phone';
}

function weightedScore(phone: RecommendationCandidate, preferences: PreferenceKey[]) {
  const values = preferences.map(pref => safeScore(phone[field[pref]])).filter(Boolean);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : safeScore(phone.overallRating);
}

function findAlternatives(current: RecommendationCandidate, ranked: RecommendationCandidate[], preferences: PreferenceKey[]): RecommendationAlternative[] {
  const currentScore = weightedScore(current, preferences);
  const currentClass = deviceClass(current);
  const others = ranked.filter(item => item.id !== current.id && item.slug !== current.slug && item.pricePKR > 0 && deviceClass(item) === currentClass);
  const cheaper = others
    .filter(item => item.pricePKR < current.pricePKR && weightedScore(item, preferences) >= currentScore - 7)
    .sort((a, b) => weightedScore(b, preferences) - weightedScore(a, preferences) || b.pricePKR - a.pricePKR)[0];
  const upgrade = others
    .filter(item => item.pricePKR > current.pricePKR && item.pricePKR <= current.pricePKR * 1.35 && weightedScore(item, preferences) >= currentScore + 4)
    .sort((a, b) => weightedScore(b, preferences) - weightedScore(a, preferences) || a.pricePKR - b.pricePKR)[0];
  const balanced = others
    .filter(item => Math.abs(item.pricePKR - current.pricePKR) <= Math.max(5000, current.pricePKR * 0.12))
    .sort((a, b) => safeScore(b.valueScore) + safeScore(b.overallRating) - safeScore(a.valueScore) - safeScore(a.overallRating))[0];

  const result: RecommendationAlternative[] = [];
  if (cheaper) result.push({ type: 'cheaper', phone: cheaper, reason: 'Similar priorities at a lower price', priceDifference: cheaper.pricePKR - current.pricePKR });
  if (upgrade) result.push({ type: 'upgrade', phone: upgrade, reason: 'Meaningful upgrade within 35% more budget', priceDifference: upgrade.pricePKR - current.pricePKR });
  if (balanced && !result.some(item => item.phone.id === balanced.id)) result.push({ type: 'balanced', phone: balanced, reason: 'Balanced alternative in a similar price range', priceDifference: balanced.pricePKR - current.pricePKR });
  return result.slice(0, 3);
}

export function recommendPhones(candidates: RecommendationCandidate[], intent: BuyingIntent, limit = 5): RecommendationResult[] {
  const preferences = intent.preferences.length ? intent.preferences : ['value', 'performance'] as PreferenceKey[];
  const seen = new Set<string>();
  const eligible = candidates
    .filter(phone => { if (seen.has(phone.id) || seen.has(phone.slug)) return false; seen.add(phone.id); seen.add(phone.slug); return true; })
    .filter(phone => phone.active !== false && (!phone.status || phone.status === 'published'))
    .filter(phone => !intent.budgetMax || (phone.pricePKR > 0 && phone.pricePKR <= intent.budgetMax))
    .filter(phone => !intent.ptaRequired || phone.ptaApproved);

  const scored = eligible.map(phone => {
    const reasons: string[] = [], compromises: string[] = [], missingData: string[] = [], sourceData: string[] = [];
    const values = preferences.map(pref => {
      const useCase: AdvisorUseCase | null = pref === 'display' ? null : pref === 'performance' ? 'gaming' : pref;
      const advisor = useCase ? getAdvisorScore(phone as unknown as Phone, useCase) : null;
      const value = advisor?.score || finiteScore(phone[field[pref]]);
      if (value === null) { missingData.push(`${label[pref]} score`); return 35; }
      sourceData.push(advisor ? `phone-advisor:${useCase}=${value};confidence=${advisor.confidence}` : `${String(field[pref])}=${value}`);
      if (value >= 80) reasons.push(`Strong ${label[pref]} score (${value}/100)`);
      else if (value < 60) compromises.push(`Below-average ${label[pref]} score (${value}/100)`);
      return value;
    });

    if (intent.wantsAmoled) {
      const matches = /amoled|oled/i.test(phone.specs?.display || '');
      values.push(matches ? 95 : 35);
      if (matches) reasons.push('AMOLED/OLED display is verified in specifications');
      else compromises.push('AMOLED display is not confirmed');
      if (!phone.specs?.display) missingData.push('display specification');
    }
    if (intent.wantsFastCharging) {
      const charging = phone.specs?.charging || '';
      if (!charging) missingData.push('charging specification');
      else if (/\b(?:[4-9]\d|1\d{2,})\s*w\b/i.test(charging)) reasons.push(`Fast charging listed (${charging})`);
      else compromises.push('High-speed charging is not confirmed');
    }

    const base = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    const missingPenalty = Math.min(25, missingData.length * 6);
    const freshnessPenalty = phone.lastVerifiedAt && Date.now() - new Date(phone.lastVerifiedAt).getTime() > 365 * 86_400_000 ? 4 : 0;
    const matchPercentage = Math.max(1, Math.min(99, Math.round(base - missingPenalty - freshnessPenalty)));
    if (phone.pricePKR > 0) { sourceData.push(`pricePKR=${phone.pricePKR}`); if (intent.budgetMax) reasons.push(`Within PKR ${intent.budgetMax.toLocaleString()} budget`); }
    if (intent.ptaRequired) reasons.push('PTA approved');
    const verified = phone.lastVerifiedAt ? new Date(phone.lastVerifiedAt) : null;
    const ageDays = verified && Number.isFinite(verified.getTime()) ? Math.floor((Date.now() - verified.getTime()) / 86_400_000) : null;
    const confidence: RecommendationResult['confidence'] = missingData.length === 0 && phone.dataConfidence === 'verified' && (ageDays === null || ageDays <= 180) ? 'high' : missingData.length <= 2 ? 'medium' : 'low';
    const verdict = confidence === 'high'
      ? `${phone.modelName} is a strong verified match for your priorities.`
      : confidence === 'medium'
        ? `${phone.modelName} matches well, but some data should be checked before buying.`
        : `${phone.modelName} is a provisional match because important data is missing.`;
    return { phone, matchPercentage, confidence, reasons: [...new Set(reasons)].slice(0, 5), compromises: [...new Set(compromises)].slice(0, 4), sourceData, dataFreshness: ageDays === null ? 'Verification date unavailable' : `Verified ${Math.max(0, ageDays)} days ago`, missingData: [...new Set(missingData)], alternatives: [], verdict };
  });

  scored.sort((a, b) => b.matchPercentage - a.matchPercentage || safeScore(b.phone.valueScore) - safeScore(a.phone.valueScore) || a.phone.slug.localeCompare(b.phone.slug));

  // Avoid a top list dominated by one brand when comparable options exist.
  const diverse: typeof scored = [];
  const overflow: typeof scored = [];
  const brandCount = new Map<string, number>();
  for (const item of scored) {
    const brand = item.phone.brandSlug || item.phone.brandName || 'unknown';
    const count = brandCount.get(brand) || 0;
    if (count < 2) { diverse.push(item); brandCount.set(brand, count + 1); }
    else overflow.push(item);
  }
  const selected = [...diverse, ...overflow].slice(0, Math.max(1, Math.min(limit, 20)));
  const candidatePool = eligible.sort((a, b) => weightedScore(b, preferences) - weightedScore(a, preferences));
  return selected.map(item => ({ ...item, alternatives: findAlternatives(item.phone, candidatePool, preferences) }));
}
