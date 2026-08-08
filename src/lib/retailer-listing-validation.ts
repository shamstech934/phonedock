export type RetailListingValidationInput = {
  html: string;
  phoneModel: string;
  brandName?: string;
  expectedRam?: string;
  expectedStorage?: string;
  expectedPtaStatus?: string;
};

export type RetailListingValidationResult = {
  valid: boolean;
  title: string;
  reasons: string[];
};

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractRetailPageTitle(html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["'][^>]*>/i);
  if (og?.[1]) return decodeHtml(og[1]);

  const twitter = html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:title["'][^>]*>/i);
  if (twitter?.[1]) return decodeHtml(twitter[1]);

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title?.[1] ? decodeHtml(title[1].replace(/<[^>]+>/g, ' ')) : '';
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(5g|4g|lte|dual sim|pta approved|official warranty|smartphone|mobile phone|mobile)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function significantTokens(value: string, brandName?: string): string[] {
  const brandTokens = new Set(normalize(brandName || '').split(' ').filter(Boolean));
  return normalize(value)
    .split(' ')
    .filter(token => token.length >= 2 && !brandTokens.has(token));
}

function modelMatches(title: string, phoneModel: string, brandName?: string): boolean {
  const titleNormalized = normalize(title);
  const modelNormalized = normalize(phoneModel);
  if (!titleNormalized || !modelNormalized) return true;

  const titleTokens = titleNormalized.split(' ');
  const brandTokens = normalize(brandName || '').split(' ').filter(Boolean);
  const brandMatches = brandTokens.length === 0 || brandTokens.some(token => titleTokens.includes(token));
  if (!brandMatches) return false;

  // Never validate an obvious non-phone product just because a model number
  // such as "14" appears in its title (e.g. a 14-inch laptop).
  if (/\b(laptop|notebook|monitor|desktop|television)\b/i.test(title)) return false;

  if (titleNormalized.includes(modelNormalized)) return true;
  const tokens = significantTokens(phoneModel, brandName);
  if (tokens.length === 0) return false;
  const matched = tokens.filter(token => titleTokens.includes(token)).length;
  const alphaTokens = tokens.filter(token => /[a-z]/.test(token));
  const alphaMatched = alphaTokens.length === 0 || alphaTokens.some(token => titleTokens.includes(token));
  return alphaMatched && matched / tokens.length >= 0.75;
}

function capacityTokens(value?: string): string[] {
  if (!value) return [];
  const matches = value.toLowerCase().match(/\b\d+(?:\.\d+)?\s*(?:gb|tb)\b/g) || [];
  return matches.map(match => match.replace(/\s+/g, ''));
}

function expectedCapacityPresent(title: string, expected?: string): boolean {
  const expectedTokens = capacityTokens(expected);
  if (expectedTokens.length === 0) return true;
  const normalizedTitle = title.toLowerCase().replace(/\s+/g, '');
  return expectedTokens.some(token => normalizedTitle.includes(token));
}

export function validateRetailListingPage(input: RetailListingValidationInput): RetailListingValidationResult {
  const title = extractRetailPageTitle(input.html);
  const reasons: string[] = [];

  // Missing titles are not rejected because some retailer pages expose only
  // structured product data. Validation then falls back to the existing manual
  // verification status and price extraction safeguards.
  if (title) {
    if (!modelMatches(title, input.phoneModel, input.brandName)) {
      reasons.push(`Product title does not match ${input.phoneModel}`);
    }
    if (!expectedCapacityPresent(title, input.expectedRam)) {
      reasons.push(`RAM variant ${input.expectedRam} is not present in the product title`);
    }
    if (!expectedCapacityPresent(title, input.expectedStorage)) {
      reasons.push(`Storage variant ${input.expectedStorage} is not present in the product title`);
    }

    const pta = (input.expectedPtaStatus || '').toLowerCase();
    const titleLower = title.toLowerCase();
    if (pta.includes('non') && /\bpta\s*approved\b/i.test(title)) {
      reasons.push('Expected non-PTA listing but product title says PTA approved');
    } else if (pta && !pta.includes('non') && pta.includes('approved') && /\bnon[-\s]?pta\b/i.test(titleLower)) {
      reasons.push('Expected PTA-approved listing but product title says non-PTA');
    }
  }

  return { valid: reasons.length === 0, title, reasons };
}
