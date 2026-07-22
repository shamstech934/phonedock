export type ReviewInput = {
  modelName: string;
  pricePKR?: number;
  cameraScore?: number;
  performanceScore?: number;
  batteryScore?: number;
  displayScore?: number;
  valueScore?: number;
  specs?: Record<string, unknown> | null;
};

export type ReviewAward =
  | 'Best Camera'
  | 'Best Gaming'
  | 'Best Battery'
  | 'Best Value'
  | 'Best Display'
  | 'Performance King'
  | "Editor's Choice";

export type GeneratedReview = {
  scores: {
    performance: number;
    camera: number;
    battery: number;
    display: number;
    software: number;
    value: number;
    repairability: number;
    overall: number;
  };
  pros: string[];
  cons: string[];
  bestFor: string[];
  avoidIf: string[];
  quickSummary: string;
  fullSummary: string;
  verdict: string;
  recommendation: 'buy' | 'consider' | 'skip';
  awards: ReviewAward[];
  confidence: number;
  engineVersion: 'review-v2';
};

const clamp = (n: number, min = 0, max = 10) => Math.max(min, Math.min(max, n));
const round1 = (n: number) => Math.round(n * 10) / 10;
const text = (value: unknown) => String(value ?? '').trim();

function numberFrom(value: unknown, pattern: RegExp): number | null {
  const match = text(value).match(pattern);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

function inferScores(input: ReviewInput) {
  const specs = input.specs || {};
  const refresh = numberFrom(specs.refreshRate, /(\d{2,3})\s*hz/i) ?? numberFrom(specs.display, /(\d{2,3})\s*hz/i);
  const batteryMah = Number(specs.batteryMAh) || numberFrom(specs.battery, /(\d{3,5})\s*mah/i);
  const chargingW = numberFrom(specs.chargingSpeed, /(\d{1,3})\s*w/i) ?? numberFrom(specs.charging, /(\d{1,3})\s*w/i);
  const cameraMp = Number(specs.mainCameraMP) || numberFrom(specs.mainCamera, /(\d{1,3})\s*mp/i);
  const displayType = text(specs.displayType || specs.display).toLowerCase();
  const chipset = text(specs.chipset).toLowerCase();
  const os = text(specs.os || specs.osVersion).toLowerCase();
  const updatePolicy = text(specs.updatePolicy).toLowerCase();
  const ipRating = text(specs.ipRating).toLowerCase();

  let performance = input.performanceScore || 0;
  if (!performance) {
    performance = 5.2;
    if (/snapdragon\s*8|dimensity\s*9|apple\s*a1[6-9]|tensor\s*g[34]/i.test(chipset)) performance += 3;
    else if (/snapdragon\s*7|dimensity\s*[78]|exynos\s*1[45]/i.test(chipset)) performance += 1.8;
    else if (/helio\s*g|snapdragon\s*6/i.test(chipset)) performance += 0.8;
    if ((Number(specs.ramGB) || 0) >= 12) performance += 0.5;
  }

  let camera = input.cameraScore || 0;
  if (!camera) {
    camera = 5.1;
    if ((cameraMp || 0) >= 50) camera += 1;
    if (text(specs.ois).toLowerCase().includes('yes') || text(specs.mainCamera).toLowerCase().includes('ois')) camera += 1.2;
    if (text(specs.telephoto) || text(specs.zoom)) camera += 1;
    if (text(specs.ultrawide)) camera += 0.5;
  }

  let battery = input.batteryScore || 0;
  if (!battery) {
    battery = 5;
    if ((batteryMah || 0) >= 6000) battery += 2.2;
    else if ((batteryMah || 0) >= 5000) battery += 1.5;
    else if ((batteryMah || 0) >= 4500) battery += 0.8;
    if ((chargingW || 0) >= 80) battery += 1;
    else if ((chargingW || 0) >= 45) battery += 0.6;
  }

  let display = input.displayScore || 0;
  if (!display) {
    display = 5;
    if (/amoled|oled|ltpo/.test(displayType)) display += 1.8;
    if ((refresh || 0) >= 144) display += 1.3;
    else if ((refresh || 0) >= 120) display += 1;
    else if ((refresh || 0) >= 90) display += 0.5;
    if (text(specs.brightness)) display += 0.3;
  }

  let software = 5.5;
  if (/android\s*1[45]|ios\s*1[78]/.test(os)) software += 1.2;
  if (/4|5|6|7/.test(updatePolicy)) software += 1.4;
  if (/pixel|one ui|ios/.test(`${input.modelName} ${text(specs.osUI)}`.toLowerCase())) software += 0.5;

  let repairability = 5;
  if (ipRating) repairability -= 0.3;
  if (text(specs.cardSlot)) repairability += 0.5;
  if (text(specs.battery).toLowerCase().includes('removable')) repairability += 2;

  let value = input.valueScore || 0;
  if (!value) {
    const capability = (performance + camera + battery + display + software) / 5;
    const price = input.pricePKR || 0;
    value = capability;
    if (price > 0 && price <= 50000) value += 1.2;
    else if (price <= 100000) value += 0.6;
    else if (price >= 250000) value -= 0.6;
  }

  return {
    performance: round1(clamp(performance)),
    camera: round1(clamp(camera)),
    battery: round1(clamp(battery)),
    display: round1(clamp(display)),
    software: round1(clamp(software)),
    value: round1(clamp(value)),
    repairability: round1(clamp(repairability)),
  };
}

export function generatePhoneReview(input: ReviewInput): GeneratedReview {
  const scores = inferScores(input);
  const overall = round1(clamp(
    scores.performance * 0.21 +
    scores.camera * 0.18 +
    scores.battery * 0.16 +
    scores.display * 0.16 +
    scores.software * 0.12 +
    scores.value * 0.14 +
    scores.repairability * 0.03,
  ));

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const pros = ranked.filter(([, score]) => score >= 7.2).slice(0, 4).map(([key, score]) => `${key[0].toUpperCase()}${key.slice(1)} is a strong point (${score}/10)`);
  const cons = ranked.filter(([, score]) => score < 6).slice(-3).map(([key, score]) => `${key[0].toUpperCase()}${key.slice(1)} is below the strongest rivals (${score}/10)`);
  if (!pros.length) pros.push('Balanced specification package with no major single weakness');
  if (!cons.length) cons.push('Final buying value still depends on the verified Pakistan market price');

  const bestFor: string[] = [];
  if (scores.performance >= 7.5) bestFor.push('gaming and demanding apps');
  if (scores.camera >= 7.5) bestFor.push('photos and social media video');
  if (scores.battery >= 7.5) bestFor.push('long daily battery life');
  if (scores.display >= 7.5) bestFor.push('media consumption');
  if (scores.value >= 7.5) bestFor.push('value-focused buyers');
  if (!bestFor.length) bestFor.push('general everyday use');

  const avoidIf: string[] = [];
  if (scores.performance < 6) avoidIf.push('you need flagship-level gaming');
  if (scores.camera < 6) avoidIf.push('camera quality is your first priority');
  if (scores.battery < 6) avoidIf.push('you need exceptional endurance');
  if (scores.value < 6) avoidIf.push('you are buying strictly for value');
  if (!avoidIf.length) avoidIf.push('you require a category-leading result in every area');

  const awards: ReviewAward[] = [];
  if (scores.camera >= 8.8) awards.push('Best Camera');
  if (scores.performance >= 8.8) awards.push('Performance King', 'Best Gaming');
  if (scores.battery >= 8.8) awards.push('Best Battery');
  if (scores.display >= 8.8) awards.push('Best Display');
  if (scores.value >= 8.8) awards.push('Best Value');
  if (overall >= 8.5 && scores.value >= 7.5) awards.push("Editor's Choice");

  const populatedSignals = [
    input.pricePKR, input.cameraScore, input.performanceScore, input.batteryScore,
    input.displayScore, input.valueScore,
    ...Object.values(input.specs || {}),
  ].filter(v => v !== null && v !== undefined && text(v) !== '').length;
  const confidence = Math.min(98, Math.max(35, 35 + populatedSignals * 3));

  const recommendation: GeneratedReview['recommendation'] = overall >= 7.7 && scores.value >= 6.5 ? 'buy' : overall >= 6.3 ? 'consider' : 'skip';
  const quickSummary = `${input.modelName} scores ${overall}/10 overall, led by ${ranked[0][0]} and ${ranked[1][0]}. It is best suited for ${bestFor.slice(0, 2).join(' and ')}.`;
  const fullSummary = `${input.modelName} offers a ${overall >= 8 ? 'strong' : overall >= 6.5 ? 'balanced' : 'limited'} overall package. Its highest-rated areas are ${ranked.slice(0, 3).map(([k, v]) => `${k} (${v}/10)`).join(', ')}. The result is generated only from available PhoneDock specifications and existing editorial scores; missing data lowers confidence and is not fabricated.`;
  const verdict = recommendation === 'buy'
    ? `Buy it when the verified Pakistan price is competitive with similarly scored alternatives.`
    : recommendation === 'consider'
      ? `Consider it after comparing price and the weaker categories with two close alternatives.`
      : `Skip it unless a major discount directly addresses its current value disadvantage.`;

  return {
    scores: { ...scores, overall }, pros, cons, bestFor, avoidIf,
    quickSummary, fullSummary, verdict, recommendation, awards,
    confidence, engineVersion: 'review-v2',
  };
}
