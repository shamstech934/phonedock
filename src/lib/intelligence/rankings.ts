import type { Phone } from '@/components/shared/types';
import { getAdvisorScore, type AdvisorUseCase } from './phone-advisor';

export type RankingCategory = AdvisorUseCase | 'budget';

export interface RankedPhone {
  phone: Phone;
  score: number;
  confidence: number;
  rank: number;
  reason: string;
}

const CURRENT_YEAR = new Date().getFullYear();

function releaseYear(phone: Phone): number {
  const raw = String(phone.releaseDate || phone.availableFrom || phone.pakistanLaunchAt || '');
  const match = raw.match(/(?:19|20)\d{2}/);
  if (match) return Number(match[0]);
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).getFullYear() : 0;
}

function isEligibleForRanking(phone: Phone, category: RankingCategory, confidence: number, availableSignals: number): boolean {
  const year = releaseYear(phone);
  const minYear = category === 'budget' ? CURRENT_YEAR - 6 : CURRENT_YEAR - 4;
  if (!year || year < minYear || year > CURRENT_YEAR + 1) return false;
  if (phone.upcoming || phone.availabilityStatus === 'discontinued') return false;
  if (confidence < (category === 'budget' ? 55 : 45)) return false;
  if (category === 'overall' && availableSignals < 3) return false;
  if (category === 'gaming' && !Number(phone.performanceScore || 0)) return false;
  if (category === 'camera' && !Number(phone.cameraScore || 0)) return false;
  if (category === 'battery' && !Number(phone.batteryScore || 0)) return false;
  if ((category === 'value' || category === 'budget') && (!Number(phone.valueScore || 0) || !Number(phone.pricePKR || 0))) return false;
  if (category === 'budget' && Number(phone.pricePKR || 0) > 150000) return false;
  return true;
}

const categoryLabels: Record<RankingCategory, string> = {
  overall: 'all-round performance',
  gaming: 'gaming performance',
  camera: 'camera quality',
  battery: 'battery life',
  value: 'value for money',
  budget: 'budget value',
};

function budgetScore(phone: Phone): { score: number; confidence: number } {
  const price = Number(phone.pricePKR || 0);
  if (price <= 0) return { score: 0, confidence: 0 };
  const value = Number(phone.valueScore || 0);
  const performance = Number(phone.performanceScore || 0);
  const camera = Number(phone.cameraScore || 0);
  const available = [value, performance, camera].filter(v => v > 0);
  if (!available.length) return { score: 0, confidence: 25 };
  const quality = available.reduce((sum, item) => sum + item, 0) / available.length;
  const pricePenalty = Math.min(35, Math.max(0, (price - 30000) / 5000));
  return {
    score: Math.max(1, Math.min(100, Math.round(quality - pricePenalty))),
    confidence: Math.round((available.length / 3) * 100),
  };
}

export function rankPhones(phones: Phone[], category: RankingCategory, limit = 10): RankedPhone[] {
  const ranked = phones
    .map(phone => {
      const result = category === 'budget'
        ? { ...budgetScore(phone), availableSignals: [phone.valueScore, phone.performanceScore, phone.cameraScore].filter(value => Number(value) > 0).length }
        : getAdvisorScore(phone, category);
      return { phone, score: result.score, confidence: result.confidence, availableSignals: result.availableSignals };
    })
    .filter(item => item.score > 0 && isEligibleForRanking(item.phone, category, item.confidence, item.availableSignals))
    .sort((a, b) => {
      const scoreGap = b.score - a.score;
      if (scoreGap) return scoreGap;
      const confidenceGap = b.confidence - a.confidence;
      if (confidenceGap) return confidenceGap;
      const yearGap = releaseYear(b.phone) - releaseYear(a.phone);
      if (yearGap) return yearGap;
      return Number(a.phone.pricePKR || Number.MAX_SAFE_INTEGER) - Number(b.phone.pricePKR || Number.MAX_SAFE_INTEGER);
    })
    .slice(0, limit);

  return ranked.map((item, index) => ({
    ...item,
    rank: index + 1,
    reason: `${item.phone.modelName} ranks #${index + 1} for ${categoryLabels[category]} with a ${item.score}/100 score and ${item.confidence}% data confidence.`,
  }));
}

export function getRankingMethodology(category: RankingCategory): string {
  if (category === 'budget') {
    return 'Budget rankings balance value, performance and camera scores against current Pakistan pricing. Phones with missing price data are excluded.';
  }
  return `This ranking uses SpecsDekh's weighted ${categoryLabels[category]} score. Missing signals are ignored rather than treated as zero, and confidence reflects how much verified score data is available.`;
}
