import type { Phone } from '@/components/shared/types';

export type AdvisorUseCase = 'overall' | 'gaming' | 'camera' | 'battery' | 'value';

type ScoredPhone = {
  phone: Phone;
  score: number;
  confidence: number;
  availableSignals: number;
};

const useCaseLabels: Record<AdvisorUseCase, string> = {
  overall: 'best all-rounder',
  gaming: 'gaming',
  camera: 'camera',
  battery: 'battery life',
  value: 'value for money',
};

const clampScore = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
};

function scoreSignals(phone: Phone) {
  return {
    rating: clampScore((phone.overallRating || 0) * 10),
    camera: clampScore(phone.cameraScore),
    performance: clampScore(phone.performanceScore),
    battery: clampScore(phone.batteryScore),
    display: clampScore(phone.displayScore),
    value: clampScore(phone.valueScore),
  };
}

/**
 * Scores only the signals that are actually available. Missing values never become
 * artificial zeroes, which previously made incomplete imports lose comparisons.
 */
export function getAdvisorScore(phone: Phone, useCase: AdvisorUseCase): ScoredPhone {
  const signals = scoreSignals(phone);
  const weightedSignals: Array<[number, number]> = useCase === 'gaming'
    ? [[signals.performance, 0.65], [signals.display, 0.2], [signals.battery, 0.15]]
    : useCase === 'camera'
      ? [[signals.camera, 0.8], [signals.display, 0.1], [signals.rating, 0.1]]
      : useCase === 'battery'
        ? [[signals.battery, 0.8], [signals.value, 0.1], [signals.rating, 0.1]]
        : useCase === 'value'
          ? [[signals.value, 0.7], [signals.rating, 0.15], [signals.performance, 0.15]]
          : [
              [signals.rating, 0.25],
              [signals.camera, 0.15],
              [signals.performance, 0.2],
              [signals.battery, 0.15],
              [signals.display, 0.1],
              [signals.value, 0.15],
            ];

  const available = weightedSignals.filter(([value]) => value > 0);
  const availableWeight = available.reduce((sum, [, weight]) => sum + weight, 0);
  const score = availableWeight > 0
    ? Math.round(available.reduce((sum, [value, weight]) => sum + value * weight, 0) / availableWeight)
    : 0;

  return {
    phone,
    score,
    availableSignals: available.length,
    confidence: Math.round(availableWeight * 100),
  };
}

export function getBestPhone(phones: Phone[], useCase: AdvisorUseCase) {
  const ranked = phones
    .map(phone => getAdvisorScore(phone, useCase))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence || a.phone.pricePKR - b.phone.pricePKR);

  return ranked[0]?.phone || null;
}

export function buildComparisonSummary(phones: Phone[]) {
  if (phones.length < 2) return null;

  const categories: Array<{ label: string; useCase: AdvisorUseCase }> = [
    { label: 'Best overall', useCase: 'overall' },
    { label: 'Best for gaming', useCase: 'gaming' },
    { label: 'Best camera', useCase: 'camera' },
    { label: 'Best battery', useCase: 'battery' },
    { label: 'Best value', useCase: 'value' },
  ];

  const winners = categories.map(({ label, useCase }) => {
    const ranked = phones
      .map(phone => getAdvisorScore(phone, useCase))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || b.confidence - a.confidence);
    const top = ranked[0];
    const runnerUp = ranked[1];
    const isTie = Boolean(top && runnerUp && Math.abs(top.score - runnerUp.score) <= 1);
    return {
      label,
      phone: isTie ? null : top?.phone || null,
      score: top?.score || 0,
      confidence: top?.confidence || 0,
      isTie,
    };
  });

  const cheapest = [...phones]
    .filter(phone => Number.isFinite(phone.pricePKR) && phone.pricePKR > 0)
    .sort((a, b) => a.pricePKR - b.pricePKR)[0] || null;
  winners.push({ label: 'Lowest price', phone: cheapest, score: 0, confidence: cheapest ? 100 : 0, isTie: false });

  const winCounts = new Map<string, { phone: Phone; wins: number; confidence: number }>();
  winners.forEach(item => {
    if (!item.phone || item.label === 'Lowest price') return;
    const current = winCounts.get(item.phone.id) || { phone: item.phone, wins: 0, confidence: 0 };
    current.wins += 1;
    current.confidence += item.confidence;
    winCounts.set(item.phone.id, current);
  });

  const recommendation = [...winCounts.values()]
    .sort((a, b) => b.wins - a.wins || b.confidence - a.confidence)[0];
  const recommendedPhone = recommendation?.phone || null;
  const reliableCategoryCount = winners.filter(item => item.phone && item.label !== 'Lowest price' && item.confidence >= 45).length;

  let verdict = 'There is not enough score data to produce a reliable recommendation.';
  if (recommendedPhone && reliableCategoryCount >= 2) {
    const otherPriorities = winners
      .filter(item => item.phone && item.phone.id !== recommendedPhone.id && item.label !== 'Lowest price')
      .map(item => item.label.toLowerCase())
      .slice(0, 2);
    verdict = `${recommendedPhone.modelName} is the strongest all-round choice based on the available comparison data.${otherPriorities.length ? ` Consider another winner only when your priority is specifically ${otherPriorities.join(' or ')}.` : ''}`;
  } else if (recommendedPhone) {
    verdict = `${recommendedPhone.modelName} leads the available data, but some specifications or scores are missing. Treat this as a provisional recommendation.`;
  }

  return {
    winners,
    recommendedPhone,
    verdict,
    dataConfidence: reliableCategoryCount >= 4 ? 'high' : reliableCategoryCount >= 2 ? 'medium' : 'low',
    reliableCategoryCount,
  };
}

export function explainPhoneStrength(phone: Phone, useCase: AdvisorUseCase) {
  const result = getAdvisorScore(phone, useCase);
  if (!result.score) return `${phone.modelName} does not have enough data for ${useCaseLabels[useCase]}.`;
  return `${phone.modelName} scores ${result.score}/100 for ${useCaseLabels[useCase]} (${result.confidence}% data confidence).`;
}
