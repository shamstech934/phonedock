import connectDB from '../src/lib/mongodb';
import { readFile } from 'node:fs/promises';
import { Types } from 'mongoose';
import { Phone, PhoneSpecs, PhoneImage, PhonePrice, PhoneBenchmark, Review, PriceHistory, PhoneRetailListing, PriceTrackerHistory, PriceMatchCandidate, DataQualityIssue, CollectedPhone, ActivityLog } from '../src/lib/models';
import { classifyCollectorPage } from '../src/lib/collectors/page-classifier';

const confirmFile = process.argv.find(arg => arg.startsWith('--confirm-file='))?.slice(15);
const execute = process.argv.includes('--execute');
if (!confirmFile) throw new Error('Provide --confirm-file=confirmed-phone-ids.txt. One reviewed Phone ID per line.');
const ids = (await readFile(confirmFile, 'utf8')).split(/\r?\n/).map(v => v.trim()).filter(Boolean);
if (!ids.length || ids.some(id => !Types.ObjectId.isValid(id))) throw new Error('Confirmation file contains no valid MongoDB Phone IDs.');
await connectDB();
for (const id of ids) {
  const phone = await Phone.findById(id).populate({ path: 'brand', select: 'name' }).lean();
  if (!phone) { console.log(`SKIP ${id}: not found`); continue; }
  const brand = String((phone.brand as { name?: string } | undefined)?.name || phone.sourceName || '');
  const classification = classifyCollectorPage({ url: phone.sourceUrl, title: phone.modelName, sourceName: `${phone.sourceName || ''} ${brand}` });
  if (!['catalog','brand_listing','price_range','article','navigation'].includes(classification.kind)) {
    console.log(`BLOCK ${id}: classifier=${classification.kind}; manual confirmation alone is not enough.`); continue;
  }
  if (!execute) { console.log(`DRY RUN DELETE ${id}: ${brand} ${phone.modelName} [${classification.kind}]`); continue; }
  await Promise.all([
    PhoneSpecs.deleteMany({ phoneId: id }), PhoneImage.deleteMany({ phoneId: id }), PhonePrice.deleteMany({ phoneId: id }), PhoneBenchmark.deleteMany({ phoneId: id }),
    Review.deleteMany({ phoneId: id }), PriceHistory.deleteMany({ phoneId: id }), PhoneRetailListing.deleteMany({ phoneId: id }), PriceTrackerHistory.deleteMany({ phoneId: id }),
    PriceMatchCandidate.deleteMany({ phoneId: id }), DataQualityIssue.deleteMany({ entityId: id }), CollectedPhone.updateMany({ approvedPhoneId: id }, { $set: { approvedPhoneId: null, status: 'rejected' } }),
  ]);
  await Phone.deleteOne({ _id: id });
  await ActivityLog.create({ action: 'delete_non_product_phone', entityType: 'phone', entityId: id, details: `Deleted confirmed ${classification.kind}: ${brand} ${phone.modelName}. ${classification.reasons.join('; ')}` });
  console.log(`DELETED ${id}: ${brand} ${phone.modelName}`);
}
if (!execute) console.log('Dry run only. Re-run with --execute after reviewing every listed ID.');
