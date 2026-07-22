import type { BuyingIntent, PreferenceKey } from './intent';
import type { Phone } from '@/components/shared/types';
import { getAdvisorScore, type AdvisorUseCase } from './phone-advisor';

export interface RecommendationCandidate { id: string; slug: string; modelName: string; pricePKR: number; ptaApproved: boolean; active?: boolean; status?: string; cameraScore?: number; performanceScore?: number; batteryScore?: number; displayScore?: number; valueScore?: number; overallRating?: number; specs?: { display?: string; charging?: string; ram?: string; storage?: string }; lastVerifiedAt?: Date | string | null; dataConfidence?: string }
export interface RecommendationResult { phone: RecommendationCandidate; matchPercentage: number; confidence: 'high' | 'medium' | 'low'; reasons: string[]; compromises: string[]; sourceData: string[]; dataFreshness: string; missingData: string[] }

const field: Record<PreferenceKey, keyof RecommendationCandidate> = { camera: 'cameraScore', gaming: 'performanceScore', battery: 'batteryScore', performance: 'performanceScore', display: 'displayScore', value: 'valueScore' };
const label: Record<PreferenceKey, string> = { camera: 'camera', gaming: 'gaming performance', battery: 'battery', performance: 'performance', display: 'display', value: 'value' };
const finiteScore = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 100 ? value : null;

export function recommendPhones(candidates: RecommendationCandidate[], intent: BuyingIntent, limit = 5): RecommendationResult[] {
  const preferences = intent.preferences.length ? intent.preferences : ['value', 'performance'] as PreferenceKey[];
  const seen = new Set<string>();
  return candidates.filter(phone => { if (seen.has(phone.id) || seen.has(phone.slug)) return false; seen.add(phone.id); seen.add(phone.slug); return true; })
    .filter(phone => phone.active !== false && (!phone.status || phone.status === 'published'))
    .filter(phone => !intent.budgetMax || (phone.pricePKR > 0 && phone.pricePKR <= intent.budgetMax))
    .filter(phone => !intent.ptaRequired || phone.ptaApproved)
    .map(phone => {
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
      if (intent.wantsAmoled) { const matches = /amoled|oled/i.test(phone.specs?.display || ''); values.push(matches ? 95 : 35); if (matches) reasons.push('AMOLED/OLED display is verified in specifications'); else compromises.push('AMOLED display is not confirmed'); if (!phone.specs?.display) missingData.push('display specification'); }
      if (intent.wantsFastCharging && !phone.specs?.charging) missingData.push('charging specification');
      const base = values.reduce((sum, value) => sum + value, 0) / values.length;
      const missingPenalty = Math.min(25, missingData.length * 6);
      const matchPercentage = Math.max(1, Math.min(99, Math.round(base - missingPenalty)));
      if (phone.pricePKR > 0) { sourceData.push(`pricePKR=${phone.pricePKR}`); if (intent.budgetMax) reasons.push(`Within PKR ${intent.budgetMax.toLocaleString()} budget`); }
      if (intent.ptaRequired) reasons.push('PTA approved');
      const verified = phone.lastVerifiedAt ? new Date(phone.lastVerifiedAt) : null;
      const ageDays = verified && Number.isFinite(verified.getTime()) ? Math.floor((Date.now() - verified.getTime()) / 86_400_000) : null;
      const confidence: RecommendationResult['confidence'] = missingData.length === 0 && phone.dataConfidence === 'verified' ? 'high' : missingData.length <= 2 ? 'medium' : 'low';
      return { phone, matchPercentage, confidence, reasons: reasons.slice(0, 4), compromises: compromises.slice(0, 3), sourceData, dataFreshness: ageDays === null ? 'Verification date unavailable' : `Verified ${Math.max(0, ageDays)} days ago`, missingData };
    }).sort((a, b) => b.matchPercentage - a.matchPercentage || b.phone.valueScore! - a.phone.valueScore! || a.phone.slug.localeCompare(b.phone.slug)).slice(0, Math.max(1, Math.min(limit, 20)));
}
