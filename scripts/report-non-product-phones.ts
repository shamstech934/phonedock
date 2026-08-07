import connectDB from '../src/lib/mongodb';
import { Phone, PhoneSpecs, PhoneImage, PhonePrice, PhoneBenchmark, Review, PriceHistory, PhoneRetailListing, PriceTrackerHistory, PriceMatchCandidate, DataQualityIssue, CollectedPhone } from '../src/lib/models';
import { classifyCollectorPage } from '../src/lib/collectors/page-classifier';
import { writeFile } from 'node:fs/promises';

function csv(value: unknown): string { const s = String(value ?? ''); return `"${s.replace(/"/g, '""')}"`; }

await connectDB();
const rows = await Phone.find({ deletedAt: null }, { modelName: 1, slug: 1, sourceName: 1, sourceUrl: 1, brandId: 1 }).populate({ path: 'brand', select: 'name' }).lean();
const suspects = [] as Array<Record<string, unknown>>;
for (const phone of rows) {
  const brand = String((phone.brand as { name?: string } | undefined)?.name || phone.sourceName || '');
  const classification = classifyCollectorPage({ url: phone.sourceUrl, title: phone.modelName, sourceName: `${phone.sourceName || ''} ${brand}` });
  if (!['catalog', 'brand_listing', 'price_range', 'article', 'navigation'].includes(classification.kind)) continue;
  const phoneId = phone._id.toString();
  const [specs, images, prices, benchmarks, reviews, histories, listings, trackerHistory, candidates, issues, collected] = await Promise.all([
    PhoneSpecs.countDocuments({ phoneId }), PhoneImage.countDocuments({ phoneId }), PhonePrice.countDocuments({ phoneId }), PhoneBenchmark.countDocuments({ phoneId }),
    Review.countDocuments({ phoneId }), PriceHistory.countDocuments({ phoneId }), PhoneRetailListing.countDocuments({ phoneId }), PriceTrackerHistory.countDocuments({ phoneId }),
    PriceMatchCandidate.countDocuments({ phoneId }), DataQualityIssue.countDocuments({ entityId: phoneId }), CollectedPhone.countDocuments({ approvedPhoneId: phoneId }),
  ]);
  suspects.push({ phoneId, brand, model: phone.modelName, slug: phone.slug, sourceUrl: phone.sourceUrl || '', classification: classification.kind, reasons: classification.reasons.join('; '), specs, images, prices, benchmarks, reviews, histories, listings, trackerHistory, candidates, issues, collected, suggestedAction: 'REVIEW_THEN_DELETE' });
}
const columns = ['phoneId','brand','model','slug','sourceUrl','classification','reasons','specs','images','prices','benchmarks','reviews','histories','listings','trackerHistory','candidates','issues','collected','suggestedAction'];
const output = [columns.map(csv).join(','), ...suspects.map(row => columns.map(key => csv(row[key])).join(','))].join('\n');
const path = process.argv.find(arg => arg.startsWith('--output='))?.slice(9) || 'non-product-phone-review.csv';
await writeFile(path, output, 'utf8');
console.log(`Wrote ${suspects.length} suspect records to ${path}. No records were deleted.`);
