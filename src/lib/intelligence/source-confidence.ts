export type ConfidenceBand = 'high' | 'medium' | 'low';

const OFFICIAL_PATTERNS = [
  /news\.samsung\.com/i, /apple\.com\/newsroom/i, /blog\.google\/products\/pixel/i,
  /oneplus\.com\/press/i, /mi\.com\/global\/event/i, /oppo\.com\/en\/newsroom/i,
  /vivo\.com\/en\/about-vivo\/news/i, /realme\.com\/global\/newsroom/i,
  /motorola\.com\/blog/i, /honor\.com\/global\/news/i,
];
const TRUSTED_PATTERNS = [
  /gsmarena\.com/i, /androidauthority\.com/i, /androidcentral\.com/i,
  /phonearena\.com/i, /notebookcheck\.net/i, /sammobile\.com/i,
  /9to5google\.com/i, /9to5mac\.com/i,
];

export interface SourceConfidenceResult {
  score: number;
  band: ConfidenceBand;
  label: string;
  reason: string;
}

export function scoreSourceConfidence(sourceUrl = '', sourceName = ''): SourceConfidenceResult {
  const haystack = `${sourceUrl} ${sourceName}`;
  if (OFFICIAL_PATTERNS.some(pattern => pattern.test(haystack))) {
    return { score: 0.98, band: 'high', label: 'Official source', reason: 'Manufacturer-owned newsroom or product source.' };
  }
  if (TRUSTED_PATTERNS.some(pattern => pattern.test(haystack))) {
    return { score: 0.9, band: 'high', label: 'Trusted publication', reason: 'Established technology publication with editorial review.' };
  }
  if (/fcc\.gov|bluetooth\.com|wi-fi\.org|geekbench\.com/i.test(haystack)) {
    return { score: 0.86, band: 'high', label: 'Certification or benchmark', reason: 'Structured certification or benchmark evidence.' };
  }
  if (/reddit|x\.com|twitter|facebook|instagram|youtube/i.test(haystack)) {
    return { score: 0.42, band: 'low', label: 'Community source', reason: 'Useful as a lead only; independent verification is required.' };
  }
  return { score: 0.62, band: 'medium', label: 'Unclassified source', reason: 'Source is not yet in the curated trust registry.' };
}
