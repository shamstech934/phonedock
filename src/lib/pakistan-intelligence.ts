import { Phone, PhoneRetailListing, PakistanMarketSignal } from '@/lib/models';

type SignalInput = {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  details: string;
  sourceName?: string;
  sourceUrl?: string;
  recommendedValue?: unknown;
  evidence?: Record<string, unknown>;
};

const UNKNOWN_PTA = new Set(['', 'unknown', 'n/a', 'na', 'not set']);
const normalizePta = (value: unknown) => String(value || '').trim().toLowerCase();

function daysSince(value: unknown): number | null {
  if (!value) return null;
  const timestamp = new Date(String(value)).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.floor((Date.now() - timestamp) / 86_400_000);
}

export async function scanPakistanMarket(options?: { limit?: number }) {
  const limit = Math.min(500, Math.max(10, Number(options?.limit || 150)));
  const phones = await Phone.find({ deletedAt: null, active: true })
    .select('_id modelName slug pricePKR currentPrice ptaStatus ptaApproved availabilityStatus pakistanLaunchAt lastVerifiedAt status')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  const phoneIds = phones.map((phone: any) => phone._id);
  const listings = await PhoneRetailListing.find({
    phoneId: { $in: phoneIds },
    enabled: true,
    verificationStatus: 'verified',
  }).populate('sourceId', 'name trusted sourceType status enabled').lean();

  const byPhone = new Map<string, any[]>();
  for (const listing of listings as any[]) {
    const key = String(listing.phoneId);
    const list = byPhone.get(key) || [];
    list.push(listing);
    byPhone.set(key, list);
  }

  let opened = 0;
  let resolved = 0;
  const now = new Date();

  for (const phone of phones as any[]) {
    const phoneListings = (byPhone.get(String(phone._id)) || []).filter((listing: any) => {
      const source = listing.sourceId;
      return source?.enabled !== false && source?.status !== 'failed' && source?.trusted === true;
    });
    const availableListings = phoneListings.filter((listing: any) => listing.availability === 'available' && Number(listing.currentSourcePrice) > 0);
    const signals: SignalInput[] = [];
    const currentPta = normalizePta(phone.ptaStatus);

    if (UNKNOWN_PTA.has(currentPta)) {
      signals.push({
        type: 'missing_pta_status', severity: 'warning',
        title: 'PTA status needs verification',
        details: `${phone.modelName} has no confirmed PTA status. Keep it under manual review until evidence is available.`,
      });

      const ptaValues = Array.from(new Set(phoneListings.map((listing: any) => normalizePta(listing.ptaStatus)).filter((value: string) => value && !UNKNOWN_PTA.has(value))));
      if (ptaValues.length === 1) {
        const evidenceListing = phoneListings.find((listing: any) => normalizePta(listing.ptaStatus) === ptaValues[0]);
        signals.push({
          type: 'pta_status_available', severity: 'info',
          title: 'Retailer PTA evidence available',
          details: `A trusted verified listing reports PTA status “${evidenceListing.ptaStatus}”. Review before applying.`,
          sourceName: evidenceListing.sourceId?.name || '', sourceUrl: evidenceListing.productUrl || '',
          recommendedValue: evidenceListing.ptaStatus,
          evidence: { listingId: String(evidenceListing._id), ptaStatus: evidenceListing.ptaStatus },
        });
      }
    }

    const publicPrice = Math.max(Number(phone.pricePKR || 0), Number(phone.currentPrice || 0));
    if (publicPrice <= 0) {
      signals.push({
        type: 'missing_pakistan_price', severity: 'critical',
        title: 'Pakistan price is missing',
        details: `${phone.modelName} does not have a usable PKR price.`,
      });
      if (availableListings.length > 0) {
        const sorted = [...availableListings].sort((a: any, b: any) => Number(a.currentSourcePrice) - Number(b.currentSourcePrice));
        const best = sorted[0];
        signals.push({
          type: 'price_available', severity: 'info',
          title: 'Trusted Pakistan price available',
          details: `${best.sourceId?.name || 'Trusted retailer'} lists this phone for Rs. ${Number(best.currentSourcePrice).toLocaleString('en-PK')}. Review before applying.`,
          sourceName: best.sourceId?.name || '', sourceUrl: best.productUrl || '',
          recommendedValue: Number(best.currentSourcePrice),
          evidence: { listingId: String(best._id), sampleSize: availableListings.length },
        });
      }
    }

    if (phoneListings.length === 0) {
      signals.push({
        type: 'no_verified_retailer', severity: 'warning',
        title: 'No trusted Pakistan retailer linked',
        details: `${phone.modelName} has no enabled, trusted and verified retailer listing.`,
      });
    }

    if (availableListings.length >= 2) {
      const prices = availableListings.map((listing: any) => Number(listing.currentSourcePrice)).filter((price: number) => price > 0);
      const min = Math.min(...prices); const max = Math.max(...prices);
      if (min > 0 && ((max - min) / min) * 100 >= 25) {
        signals.push({
          type: 'retailer_price_conflict', severity: 'warning',
          title: 'Large retailer price conflict',
          details: `Trusted listings range from Rs. ${min.toLocaleString('en-PK')} to Rs. ${max.toLocaleString('en-PK')}. Verify storage, PTA and warranty variants.`,
          evidence: { minimum: min, maximum: max, sampleSize: prices.length },
        });
      }
    }

    const verificationAge = daysSince(phone.lastVerifiedAt);
    if (verificationAge === null || verificationAge > 90) {
      signals.push({
        type: 'stale_market_verification', severity: phone.status === 'published' ? 'warning' : 'info',
        title: 'Pakistan market verification is stale',
        details: verificationAge === null ? 'This phone has never been market-verified.' : `Last market verification was ${verificationAge} days ago.`,
        evidence: { ageDays: verificationAge },
      });
    }

    if (['announced', 'coming_soon', 'available'].includes(String(phone.availabilityStatus)) && !phone.pakistanLaunchAt) {
      signals.push({
        type: 'missing_pakistan_launch_date', severity: 'info',
        title: 'Pakistan launch date is missing',
        details: `${phone.modelName} has a global lifecycle status but no Pakistan launch date.`,
      });
    }

    const activeTypes = new Set(signals.map(signal => signal.type));
    for (const signal of signals) {
      await PakistanMarketSignal.findOneAndUpdate(
        { phoneId: phone._id, type: signal.type },
        { $set: { ...signal, status: 'open', lastSeenAt: now, resolvedAt: null, resolvedBy: null }, $setOnInsert: { detectedAt: now } },
        { upsert: true, new: true },
      );
      opened += 1;
    }

    const resolution = await PakistanMarketSignal.updateMany(
      { phoneId: phone._id, status: 'open', type: { $nin: Array.from(activeTypes) } },
      { $set: { status: 'resolved', resolvedAt: now, resolutionNotes: 'Condition cleared by Pakistan Intelligence scan.' } },
    );
    resolved += Number(resolution.modifiedCount || 0);
  }

  return { scannedPhones: phones.length, signalsSeen: opened, autoResolved: resolved, limit };
}
