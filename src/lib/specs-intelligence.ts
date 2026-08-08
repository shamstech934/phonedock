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
    const normalizedModel = normalize(model);
    const normalizedBrand = normalize(brand);
    // Identity safety: when a phone has a brand, never fall back to model-only matching.
    // Numeric/short models such as "14", "10" or "1" are otherwise easy to cross-link.
    const dataset: any = brand
      ? await DeviceSpecDataset.findOne({ normalizedModel, normalizedBrand }).lean()
      : await DeviceSpecDataset.findOne({ normalizedModel }).lean();
    for (const field of FIELDS) {
      const current = String(specs?.[field] || '').trim();
      const recommended = String(dataset?.[field] || '').trim();
      const valuesConflict = Boolean(current && recommended && normalize(current) !== normalize(recommended));

      if (current && !valuesConflict) {
        await SpecsIntelligenceSignal.updateOne(
          { phoneId: phone._id, field },
          { $set: { status: 'resolved', currentValue: current, recommendedValue: recommended, resolvedAt: new Date(), resolutionNotes: recommended ? 'Saved value agrees with the verified local dataset.' : 'Field is populated; no verified comparison source is available.' } },
        ).catch(() => {});
        continue;
      }

      if (recommended) withRecommendation++;
      const issueKind = valuesConflict ? 'conflict' : 'missing';
      await SpecsIntelligenceSignal.findOneAndUpdate(
        { phoneId: phone._id, field },
        { $set: {
          status: 'open',
          severity: valuesConflict ? 'warning' : (CRITICAL.has(field) ? 'critical' : 'warning'),
          currentValue: current,
          recommendedValue: recommended,
          sourceName: String(dataset?.sourceName || ''), sourceUrl: String(dataset?.sourceUrl || ''),
          confidence: recommended ? (valuesConflict ? 80 : 85) : 0,
          evidence: { datasetMatched: Boolean(dataset), brand, model, issueKind, valuesConflict },
          lastSeenAt: new Date(), resolvedAt: null, resolvedBy: null,
        }, $setOnInsert: { detectedAt: new Date() } }, { upsert: true, new: true },
      );
      opened++;
    }
  }
  return { scanned, opened, withRecommendation, limit: safeLimit };
}
