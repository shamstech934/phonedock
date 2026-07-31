import { Brand, LaunchCandidate, Phone } from '@/lib/models';

const BRAND_ALIASES: Array<[RegExp, string]> = [
  [/\bapple\b|\biphone\b/i, 'Apple'], [/\bsamsung\b|\bgalaxy\b/i, 'Samsung'],
  [/\bgoogle\b|\bpixel\b/i, 'Google'], [/\boneplus\b/i, 'OnePlus'],
  [/\bxiaomi\b/i, 'Xiaomi'], [/\bredmi\b/i, 'Redmi'], [/\bpoco\b/i, 'Poco'],
  [/\boppo\b/i, 'Oppo'], [/\bvivo\b/i, 'Vivo'], [/\brealme\b/i, 'Realme'],
  [/\bmotorola\b|\bmoto\b/i, 'Motorola'], [/\bhonor\b/i, 'Honor'],
  [/\bhuawei\b/i, 'Huawei'], [/\bnothing\b/i, 'Nothing'], [/\bsony\b|\bxperia\b/i, 'Sony'],
  [/\basus\b|\brog phone\b|\bzenfone\b/i, 'Asus'], [/\btecno\b/i, 'Tecno'],
  [/\binfinix\b/i, 'Infinix'], [/\bzte\b/i, 'ZTE'], [/\bnubia\b|\bredmagic\b|\bred magic\b/i, 'Nubia'],
  [/\bhmd\b|\bnokia\b/i, 'HMD'], [/\blenovo\b/i, 'Lenovo'],
];

const NON_PHONE_TERMS = /\b(watch|buds|earbuds|tablet|pad|laptop|chip|processor|tv|headphones|headset|charger|case)\b/i;
const STATUS_ANNOUNCED = /\b(announc(?:e|ed|ement)|official|unveil(?:ed)?|launch(?:ed)?|debut(?:ed)?)\b/i;
const STATUS_COMING = /\b(coming soon|pre-?order|release date|goes on sale|availability)\b/i;
const RUMOUR_WORDS = /\b(rumou?r|leak(?:ed|s)?|reportedly|expected|tipped|prototype|certification)\b/i;

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function cleanModelTitle(title: string, brandName: string): string {
  let value = title
    .replace(/\s*[|–—:-]\s*(price|specs?|launch|release|leak|rumou?r|report|review|hands-on|images?).*$/i, '')
    .replace(/\b(pricing|price|specifications?|specs?|launch date|release date|leaks?|rumou?rs?|officially|announced|unveiled|expected|reportedly|tipped)\b.*$/i, '')
    .replace(/^[^:]{0,40}:\s*/, '')
    .replace(/[“”"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const brandRegex = new RegExp(`^${brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i');
  if (!brandRegex.test(value) && brandName !== 'Google' && brandName !== 'Apple') value = `${brandName} ${value}`;
  return value.slice(0, 100);
}

export function extractLaunchCandidate(title: string, description = '') {
  const searchable = `${title} ${description}`;
  if (NON_PHONE_TERMS.test(title)) return null;
  const brandName = BRAND_ALIASES.find(([pattern]) => pattern.test(searchable))?.[1];
  if (!brandName) return null;

  const modelName = cleanModelTitle(title, brandName);
  if (modelName.length < 4 || modelName.split(' ').length > 10) return null;

  const availabilityStatus = STATUS_COMING.test(searchable) ? 'coming_soon'
    : STATUS_ANNOUNCED.test(searchable) && !RUMOUR_WORDS.test(searchable) ? 'announced' : 'rumored';
  const reasons = [`Brand detected: ${brandName}`, `Lifecycle signal: ${availabilityStatus}`];
  let confidence = 0.58;
  if (new RegExp(`\\b${brandName}\\b`, 'i').test(title)) confidence += 0.12;
  if (/\b(?:Galaxy|Pixel|iPhone|Redmi|Poco|OnePlus|Xperia|Moto|Magic|Find|Reno|GT|Note|Fold|Flip)\b/i.test(title)) confidence += 0.12;
  if (STATUS_ANNOUNCED.test(searchable)) confidence += 0.08;
  if (RUMOUR_WORDS.test(searchable)) confidence -= 0.05;

  return { brandName, modelName, availabilityStatus, confidence: Math.max(0.35, Math.min(0.95, confidence)), reasons };
}

export async function stageLaunchCandidate(input: {
  title: string; description?: string; sourceNewsId?: unknown; sourceName?: string; sourceUrl?: string; sourcePublishedAt?: Date | null;
}) {
  const extracted = extractLaunchCandidate(input.title, input.description || '');
  if (!extracted) return { created: false, reason: 'No phone launch candidate detected' };
  const normalizedKey = normalize(`${extracted.brandName} ${extracted.modelName}`);
  const existingPhone = await Phone.findOne({
    deletedAt: null,
    $or: [
      { modelName: { $regex: `^${extracted.modelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
      { slug: normalizedKey.replace(/\s+/g, '-') },
    ],
  }).select('_id').lean();

  const update: Record<string, unknown> = {
    ...extracted,
    normalizedKey,
    sourceNewsId: input.sourceNewsId || null,
    sourceName: input.sourceName || '',
    sourceUrl: input.sourceUrl || '',
    sourceTitle: input.title,
    sourcePublishedAt: input.sourcePublishedAt || null,
  };
  if (existingPhone) {
    update.status = 'duplicate';
    update.linkedPhoneId = existingPhone._id;
  }
  const result = await LaunchCandidate.updateOne(
    { normalizedKey },
    { $setOnInsert: { status: existingPhone ? 'duplicate' : 'pending' }, $set: update },
    { upsert: true },
  );
  return { created: Boolean(result.upsertedCount), extracted, duplicate: Boolean(existingPhone) };
}

export async function approveLaunchCandidate(candidateId: string, adminId: unknown, notes = '') {
  const candidate = await LaunchCandidate.findById(candidateId);
  if (!candidate) throw new Error('Launch candidate not found');
  if (candidate.status === 'approved' && candidate.linkedPhoneId) return candidate;

  let brand = await Brand.findOne({ name: { $regex: `^${candidate.brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
  if (!brand) {
    const slug = normalize(candidate.brandName).replace(/\s+/g, '-');
    brand = await Brand.create({ name: candidate.brandName, slug, description: `${candidate.brandName} mobile phones` });
  }

  const slugBase = normalize(candidate.modelName).replace(/\s+/g, '-');
  const duplicate = await Phone.findOne({ brandId: brand._id, modelName: { $regex: `^${candidate.modelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }, deletedAt: null });
  const phone = duplicate || await Phone.create({
    brandId: brand._id,
    modelName: candidate.modelName,
    slug: await Phone.exists({ slug: slugBase }) ? `${slugBase}-${Date.now().toString(36)}` : slugBase,
    availabilityStatus: candidate.availabilityStatus,
    upcoming: true,
    status: 'draft',
    active: true,
    sourceName: candidate.sourceName,
    sourceUrl: candidate.sourceUrl,
    dataConfidence: 'auto-imported',
    description: `Launch intelligence draft created from ${candidate.sourceName || 'a monitored source'}. Verify all specifications before publishing.`,
  });

  candidate.status = duplicate ? 'duplicate' : 'approved';
  candidate.linkedPhoneId = phone._id;
  candidate.reviewedBy = adminId;
  candidate.reviewedAt = new Date();
  candidate.reviewNotes = notes;
  await candidate.save();
  return candidate;
}
