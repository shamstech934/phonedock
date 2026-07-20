import type { Phone } from '@/components/shared/types';

export type AdvisorUseCase = 'overall' | 'gaming' | 'camera' | 'battery' | 'value';

const useCaseLabels: Record<AdvisorUseCase, string> = {
  overall: 'best all-rounder',
  gaming: 'gaming',
  camera: 'camera',
  battery: 'battery life',
  value: 'value for money',
};

function scoreFor(phone: Phone, useCase: AdvisorUseCase) {
  if (useCase === 'gaming') return phone.performanceScore || 0;
  if (useCase === 'camera') return phone.cameraScore || 0;
  if (useCase === 'battery') return phone.batteryScore || 0;
  if (useCase === 'value') return phone.valueScore || 0;
  return Math.round(((phone.overallRating || 0) * 10 + (phone.cameraScore || 0) + (phone.performanceScore || 0) + (phone.batteryScore || 0) + (phone.displayScore || 0) + (phone.valueScore || 0)) / 6);
}

export function getBestPhone(phones: Phone[], useCase: AdvisorUseCase) {
  return [...phones].sort((a, b) => scoreFor(b, useCase) - scoreFor(a, useCase))[0] || null;
}

export function buildComparisonSummary(phones: Phone[]) {
  if (phones.length < 2) return null;
  const overall = getBestPhone(phones, 'overall');
  const gaming = getBestPhone(phones, 'gaming');
  const camera = getBestPhone(phones, 'camera');
  const battery = getBestPhone(phones, 'battery');
  const value = getBestPhone(phones, 'value');
  const cheapest = [...phones].filter(p => p.pricePKR > 0).sort((a, b) => a.pricePKR - b.pricePKR)[0] || null;

  const winners = [
    { label: 'Best overall', phone: overall },
    { label: 'Best for gaming', phone: gaming },
    { label: 'Best camera', phone: camera },
    { label: 'Best battery', phone: battery },
    { label: 'Best value', phone: value },
    { label: 'Lowest price', phone: cheapest },
  ];

  const distinctWins = new Map<string, number>();
  winners.forEach(item => {
    if (item.phone) distinctWins.set(item.phone.id, (distinctWins.get(item.phone.id) || 0) + 1);
  });
  const recommendation = [...distinctWins.entries()].sort((a, b) => b[1] - a[1])[0];
  const recommendedPhone = phones.find(p => p.id === recommendation?.[0]) || overall;

  return {
    winners,
    recommendedPhone,
    verdict: recommendedPhone
      ? `${recommendedPhone.modelName} is the strongest all-round choice in this comparison. Choose a different winner below only when your priority is specifically ${winners.filter(w => w.phone && w.phone.id !== recommendedPhone.id).map(w => w.label.toLowerCase()).slice(0, 2).join(' or ')}.`
      : 'There is not enough score data to produce a reliable recommendation.',
  };
}

export function explainPhoneStrength(phone: Phone, useCase: AdvisorUseCase) {
  const score = scoreFor(phone, useCase);
  return `${phone.modelName} scores ${score}/100 for ${useCaseLabels[useCase]}.`;
}
