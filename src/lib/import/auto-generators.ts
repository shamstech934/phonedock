import { RawPhoneRecord, PhoneCategory } from './types';

// ============ AUTO CATEGORIZE ============
export function categorizePhone(phone: RawPhoneRecord): PhoneCategory[] {
  const categories: PhoneCategory[] = [];
  const price = Number(phone.pricePKR) || 0;
  const hasScores = Number(phone.cameraScore || 0) > 0 || Number(phone.performanceScore || 0) > 0 || Number(phone.batteryScore || 0) > 0;
  const ram = extractRamGB(phone.ram);
  const modelName = (phone.modelName || '').toLowerCase();

  // Foldable detection
  if (modelName.includes('fold') || modelName.includes('flip')) {
    categories.push('Foldable');
  }

  // Tablet detection
  if (modelName.includes('tab') || modelName.includes('tablet') || modelName.includes('pad')) {
    categories.push('Tablet');
  }

  // Price-based categories
  if (price > 0) {
    if (price <= 25000) {
      categories.push('Budget');
    } else if (price <= 60000) {
      categories.push('Mid Range');
    } else if (price <= 120000) {
      categories.push('Premium');
    } else if (price <= 250000) {
      categories.push('Flagship');
    } else {
      categories.push('Ultra Flagship');
    }
  }

  // Score-based specialty categories
  if (hasScores) {
    if (Number(phone.cameraScore || 0) >= 85) {
      categories.push('Camera');
    }
    if (Number(phone.performanceScore || 0) >= 85) {
      categories.push('Gaming');
    }
    if (Number(phone.batteryScore || 0) >= 85) {
      categories.push('Battery');
    }
  }

  // RAM-based gaming detection
  if (ram >= 12 && !categories.includes('Gaming')) {
    categories.push('Gaming');
  }

  // Default category if none matched
  if (categories.length === 0) {
    categories.push('Mid Range');
  }

  return [...new Set(categories)];
}

function extractRamGB(ram: string | undefined): number {
  if (!ram) return 0;
  const match = ram.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

// ============ AUTO SEO GENERATOR ============
export function generateSEO(phone: RawPhoneRecord): { seoTitle: string; seoDescription: string; keywords: string } {
  const brand = phone.brand || '';
  const model = phone.modelName || '';
  const price = Number(phone.pricePKR) || 0;
  const priceStr = price > 0 ? ` Price in Pakistan ${price.toLocaleString()} PKR` : '';
  const ram = phone.ram || '';
  const storage = phone.storage || '';
  const specs = [ram, storage].filter(Boolean).join(', ');
  const specsStr = specs ? ` (${specs})` : '';

  const seoTitle = `${brand} ${model} - Full Specs${priceStr} | PhoneDock`.trim();

  let seoDescription = `Get the latest ${brand} ${model} complete specifications, features, and reviews.`;
  if (price > 0) {
    seoDescription += ` Expected price in Pakistan is ${price.toLocaleString()} PKR.`;
  }
  if (specs) {
    seoDescription += ` Key specs: ${specs}.`;
  }
  seoDescription += ' Compare and buy at the best price on PhoneDock.';

  const keywordsArr = [
    `${brand} ${model}`,
    `${model} price in Pakistan`,
    `${model} specs`,
    `${model} review`,
    `${brand} phones`,
  ];
  if (price > 0) keywordsArr.push(`${model} price ${price.toLocaleString()} PKR`);
  if (ram) keywordsArr.push(`${model} ${ram}`);
  if (phone.chipset) keywordsArr.push(`${model} ${phone.chipset}`);

  const keywords = keywordsArr.join(', ');

  return { seoTitle, seoDescription, keywords };
}

// ============ AUTO REVIEW TEMPLATE ============
export function generateReviewTemplate(phone: RawPhoneRecord): { pros: string; cons: string; reviewSummary: string; reviewVerdict: string } {
  const brand = phone.brand || '';
  const model = phone.modelName || '';
  const price = Number(phone.pricePKR) || 0;
  const ram = phone.ram || '';
  const battery = phone.battery || '';
  const camera = phone.mainCamera || '';
  const display = phone.display || '';
  const chipset = phone.chipset || '';

  const prosArr: string[] = [];
  const consArr: string[] = [];

  // Auto-generate pros
  if (display) prosArr.push(`${display}`);
  if (chipset) prosArr.push(`Powerful ${chipset}`);
  if (camera) prosArr.push(`Impressive ${camera} camera system`);
  if (battery && !battery.includes('3000')) prosArr.push(`Long-lasting ${battery} battery`);
  if (ram && parseInt(ram) >= 8) prosArr.push(`Generous ${ram} RAM for smooth multitasking`);
  if (phone.fiveG === 'Yes' || phone.fiveG === 'yes') prosArr.push('5G connectivity support');

  // Auto-generate cons
  if (price > 200000) consArr.push('Premium pricing may not suit all budgets');
  if (!phone.nfc || phone.nfc === 'No') consArr.push('No NFC support');
  if (!phone.wirelessCharge || phone.wirelessCharge === 'No') consArr.push('No wireless charging');
  if (!phone.cardSlot || phone.cardSlot === 'No') consArr.push('No expandable storage via microSD');
  if (battery && parseInt(battery) < 4000) consArr.push('Battery capacity could be larger');

  // Default fallbacks
  if (prosArr.length === 0) {
    prosArr.push('Good build quality', 'Decent everyday performance', 'Reliable brand');
  }
  if (consArr.length === 0) {
    consArr.push('Could offer better value for money');
  }

  const pros = prosArr.join('\n');
  const cons = consArr.join('\n');

  const reviewSummary = `The ${brand} ${model} is a solid offering${price > 0 ? ` at ${price.toLocaleString()} PKR` : ''}. ${display ? `It features a ${display},` : ''} ${chipset ? `powered by the ${chipset},` : ''} ${battery ? `with a ${battery} battery.` : '.'} ${camera ? `The camera setup includes ${camera}.` : ''} Overall, it delivers a well-rounded experience for its price segment.`;

  const score = Number(phone.overallRating || 0);
  let verdict = 'A solid choice for most users looking for a reliable smartphone.';
  if (score >= 90) verdict = 'An exceptional smartphone that excels in nearly every category. Highly recommended.';
  else if (score >= 80) verdict = 'An excellent phone that offers great value. One of the best in its segment.';
  else if (score >= 70) verdict = 'A good phone with strong fundamentals. Recommended for its price range.';
  else if (score >= 50) verdict = 'A decent phone with some compromises. Consider alternatives in the same range.';

  return { pros, cons, reviewSummary, reviewVerdict: verdict };
}