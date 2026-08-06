import { DeviceSpecDataset, Phone, PhoneSpecs, SpecsIntelligenceSignal } from '@/lib/models';

const FIELDS = ['display','chipset','ram','storage','battery','mainCamera','fiveG'] as const;
const CRITICAL = new Set(['display','chipset','ram','storage','battery']);
const normalize = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export async function scanSpecsIntelligence({ limit = 200 }: { limit?: number } = {}) {
  const safeLimit = Math.min(500, Math.max(1, limit));
  const phones: any[] = await Phone.find({ deletedAt: null, active: true }).select('_id modelName brandId status').populate('brandId', 'name').sort({ updatedAt: -1 }).limit(safeLimit).lean();
  let scanned = 0, opened = 0, withRecommendation = 0;
  for (const phone of phones) {
    scanned++;
    const specs: any = await PhoneSpecs.findOne({ phoneId: phone._id }).lean();
    const brand = String(phone.brandId?.name || '');
    const model = String(phone.modelName || '');
    const dataset: any = await DeviceSpecDataset.findOne({ normalizedModel: normalize(model), ...(brand ? { normalizedBrand: normalize(brand) } : {}) }).lean()
      || await DeviceSpecDataset.findOne({ normalizedModel: normalize(model) }).lean();
    for (const field of FIELDS) {
      const current = String(specs?.[field] || '').trim();
      if (current) {
        await SpecsIntelligenceSignal.updateOne({ phoneId: phone._id, field }, { $set: { status: 'resolved', resolvedAt: new Date(), resolutionNotes: 'Field is now populated.' } }).catch(() => {});
        continue;
      }
      const recommended = String(dataset?.[field] || '').trim();
      if (recommended) withRecommendation++;
      await SpecsIntelligenceSignal.findOneAndUpdate(
        { phoneId: phone._id, field },
        { $set: {
          status: 'open', severity: CRITICAL.has(field) ? 'critical' : 'warning', currentValue: '', recommendedValue: recommended,
          sourceName: String(dataset?.sourceName || ''), sourceUrl: String(dataset?.sourceUrl || ''), confidence: recommended ? 85 : 25,
          evidence: { datasetMatched: Boolean(dataset), brand, model }, lastSeenAt: new Date(),
        }, $setOnInsert: { detectedAt: new Date() } }, { upsert: true, new: true },
      );
      opened++;
    }
  }
  return { scanned, opened, withRecommendation, limit: safeLimit };
}
