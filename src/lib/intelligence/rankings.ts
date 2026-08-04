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
        ? budgetScore(phone)
        : getAdvisorScore(phone, category);
      return { phone, score: result.score, confidence: result.confidence };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence || a.phone.pricePKR - b.phone.pricePKR)
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
  return `This ranking uses PhoneDock's weighted ${categoryLabels[category]} score. Missing signals are ignored rather than treated as zero, and confidence reflects how much verified score data is available.`;
}
