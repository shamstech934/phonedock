import type { Phone } from '@/components/shared/types';
import { getAdvisorScore, type AdvisorUseCase } from './phone-advisor';

export type CompareCategory = 'overall' | 'gaming' | 'camera' | 'battery' | 'display' | 'value';

export interface ComparisonWinner {
  category: CompareCategory;
  label: string;
  phone: Phone | null;
  score: number;
  confidence: number;
  tie: boolean;
  reason: string;
}

export interface PhoneComparisonInsight {
  phone: Phone;
  wins: number;
  strengths: string[];
  tradeoffs: string[];
  dataConfidence: number;
}

const labels: Record<CompareCategory, string> = {
  overall: 'Best overall',
  gaming: 'Best for gaming',
  camera: 'Best camera',
  battery: 'Best battery',
  display: 'Best display',
  value: 'Best value',
};

const scoreFor = (phone: Phone, category: CompareCategory) => {
  if (category === 'display') {
    const score = Number(phone.displayScore) || 0;
    return { score, confidence: score > 0 ? (phone.compareScoresEstimated ? 60 : 90) : 0 };
  }
  const result = getAdvisorScore(phone, category as AdvisorUseCase);
  return { score: result.score, confidence: result.confidence };
};

const validPrice = (phone: Phone) => Number.isFinite(phone.pricePKR) && phone.pricePKR > 0;

function reasonFor(category: CompareCategory, phone: Phone, score: number) {
  const suffix = phone.compareScoresEstimated ? ' Estimated from available specifications.' : '';
  if (category === 'value' && validPrice(phone)) return `${score}/100 value score at the listed price.${suffix}`;
  if (category === 'gaming') return `${score}/100 gaming-weighted score using performance, display and battery data.${suffix}`;
  if (category === 'camera') return `${score}/100 camera-weighted score using camera, display and overall rating.${suffix}`;
  if (category === 'battery') return `${score}/100 battery-weighted score.${suffix}`;
  if (category === 'display') return `${score}/100 display score.${suffix}`;
  return `${score}/100 balanced score across the available categories.${suffix}`;
}

export function rankComparisonCategory(phones: Phone[], category: CompareCategory): ComparisonWinner {
  const ranked = phones
    .map(phone => ({ phone, ...scoreFor(phone, category) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence || ((a.phone.pricePKR || Infinity) - (b.phone.pricePKR || Infinity)));

  const top = ranked[0];
  const second = ranked[1];
  if (!top) return { category, label: labels[category], phone: null, score: 0, confidence: 0, tie: false, reason: 'Not enough data.' };
  const tie = Boolean(second && top.score === second.score && top.confidence === second.confidence);
  return {
    category,
    label: labels[category],
    phone: tie ? null : top.phone,
    score: top.score,
    confidence: top.confidence,
    tie,
    reason: tie ? `Top phones are tied at ${top.score}/100.` : reasonFor(category, top.phone, top.score),
  };
}

export function buildSmartComparison(phones: Phone[]) {
  if (phones.length < 2) return null;
  const categories: CompareCategory[] = ['overall', 'gaming', 'camera', 'battery', 'display', 'value'];
  const winners = categories.map(category => rankComparisonCategory(phones, category));

  const winMap = new Map<string, number>();
  winners.forEach(winner => {
    if (winner.phone && winner.confidence >= 40) winMap.set(winner.phone.id, (winMap.get(winner.phone.id) || 0) + 1);
  });

  const insights: PhoneComparisonInsight[] = phones.map(phone => {
    const strengths = winners.filter(w => w.phone?.id === phone.id).map(w => w.label.replace('Best ', ''));
    const availableScores = categories.map(c => scoreFor(phone, c)).filter(v => v.score > 0);
    const confidence = availableScores.length
      ? Math.round(availableScores.reduce((sum, v) => sum + v.confidence, 0) / availableScores.length)
      : 0;
    const tradeoffs: string[] = [];
    if (!validPrice(phone)) tradeoffs.push('Current price is unavailable');
    if (!phone.ptaApproved) tradeoffs.push('PTA approval is not confirmed');
    if (!phone.specs?.storage) tradeoffs.push('Storage data is missing');
    if (!phone.specs?.battery) tradeoffs.push('Battery data is missing');
    if (phone.compareScoresEstimated) tradeoffs.push('Some scores are estimated');
    return { phone, wins: winMap.get(phone.id) || 0, strengths, tradeoffs, dataConfidence: confidence };
  });

  const recommended = [...insights].sort((a, b) => b.wins - a.wins || b.dataConfidence - a.dataConfidence || ((a.phone.pricePKR || Infinity) - (b.phone.pricePKR || Infinity)))[0];
  const reliableWinners = winners.filter(w => w.phone && w.confidence >= 50).length;
  const dataConfidence = reliableWinners >= 5 ? 'high' : reliableWinners >= 3 ? 'medium' : 'low';

  let verdict = 'There is not enough reliable score data to choose a clear winner.';
  if (recommended?.wins) {
    verdict = `${recommended.phone.modelName} is the strongest all-round option, winning ${recommended.wins} of ${categories.length} scored categories. ` +
      (dataConfidence === 'low' ? 'The verdict is provisional because some comparison data is missing or estimated.' : 'Choose a different category winner only when that specific priority matters more to you.');
  }

  return { winners, insights, recommendedPhone: recommended?.wins ? recommended.phone : null, verdict, dataConfidence, reliableWinners };
}

export function getLowestPriceWinner(phones: Phone[]) {
  return [...phones].filter(validPrice).sort((a, b) => a.pricePKR - b.pricePKR)[0] || null;
}
