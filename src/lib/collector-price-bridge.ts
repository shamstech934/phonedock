import { Types } from 'mongoose';
import {
  CollectedPhone,
  Phone,
  PhoneRetailListing,
  PriceMatchCandidate,
  PriceSource,
} from '@/lib/models';
import { isProbableProductUrl } from '@/lib/price-catalog-discovery';
import { inferRetailVariantIdentity, inferUniqueMemoryLabel } from '@/lib/price-variant';
import { buildMarketPriceIdentity, normalizeMarketPriceType } from '@/lib/price-market';

export type CollectorMatchStrategy = 'direct_approval' | 'imported' | 'exact_duplicate';

export interface CollectorBridgeRecord {
  approvedPhoneId?: unknown;
  importedPhoneId?: unknown;
  duplicatePhoneId?: unknown;
  hasExactDuplicate?: boolean;
  duplicateMatches?: Array<{ type?: string; phoneId?: string; confidence?: number }>;
}

export interface CollectorTarget {
  phoneId: string;
  strategy: CollectorMatchStrategy;
  confidence: number;
}

export interface TrustedSourceLike {
  _id: unknown;
  allowedDomains?: string[];
}

export interface CollectorPriceBridgeResult {
  candidates: number;
  queued: number;
  alreadyLinked: number;
  sourceGaps: number;
  skipped: number;
}

function asValidId(value: unknown): string {
  const text = String(value || '').trim();
  return Types.ObjectId.isValid(text) ? text : '';
}

/** Only explicit editorial/import links or a high-confidence exact slug duplicate may auto-link. */
export function resolveCollectorPhoneTarget(record: CollectorBridgeRecord): CollectorTarget | null {
  const approved = asValidId(record.approvedPhoneId);
  if (approved) return { phoneId: approved, strategy: 'direct_approval', confidence: 100 };

  const imported = asValidId(record.importedPhoneId);
  if (imported) return { phoneId: imported, strategy: 'imported', confidence: 100 };

  const exactMatch = (record.duplicateMatches || []).find(match =>
    match.type === 'exact_slug' && Number(match.confidence || 0) >= 0.95 && asValidId(match.phoneId),
  );
  const duplicate = asValidId(exactMatch?.phoneId || (record.hasExactDuplicate ? record.duplicatePhoneId : ''));
  if (duplicate) return { phoneId: duplicate, strategy: 'exact_duplicate', confidence: 95 };

  return null;
}

export function normalizeHostname(value: string): string {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return ''; }
}

export function findTrustedSourceForUrl<T extends TrustedSourceLike>(url: string, sources: T[]): T | null {
  const hostname = normalizeHostname(url);
  if (!hostname) return null;
  return sources.find(source => (source.allowedDomains || []).some(rawDomain => {
    const domain = String(rawDomain || '').trim().toLowerCase().replace(/^\./, '').replace(/^www\./, '');
    return Boolean(domain) && (hostname === domain || hostname.endsWith(`.${domain}`));
  })) || null;
}

export function normalizePendingCollectedPrice(value: unknown): number {
  const price = Number(value || 0);
  return Number.isFinite(price) && price > 0 ? Math.round(price) : 0;
}

/**
 * Converts safe collector provenance into tracker review items. This never marks
 * a listing verified and never writes a collected price to currentSourcePrice.
 */
export async function bridgeCollectedPricesToTracker(
  input: { jobId?: string } = {},
): Promise<CollectorPriceBridgeResult> {
  const result: CollectorPriceBridgeResult = { candidates: 0, queued: 0, alreadyLinked: 0, sourceGaps: 0, skipped: 0 };
  const filter: Record<string, unknown> = { sourceUrl: { $type: 'string', $ne: '' } };
  if (input.jobId && Types.ObjectId.isValid(input.jobId)) filter.jobId = new Types.ObjectId(input.jobId);

  const [records, sources] = await Promise.all([
    CollectedPhone.find(filter)
      .select('_id brandName model sourceUrl pakistanPrice ptaStatus officialWarranty memory.ram memory.storage body.colors localSellerNotes approvedPhoneId importedPhoneId duplicatePhoneId hasExactDuplicate duplicateMatches')
      .lean(),
    PriceSource.find({ enabled: true, trusted: true, status: 'active', allowedDomains: { $exists: true, $ne: [] } })
      .select('_id allowedDomains')
      .lean(),
  ]);

  const phoneIds = [...new Set(records.map(record => resolveCollectorPhoneTarget(record)?.phoneId).filter(Boolean))] as string[];
  const publishedPhones = new Set((await Phone.find({ _id: { $in: phoneIds }, active: true, status: 'published' }).select('_id').lean())
    .map(phone => phone._id.toString()));

  for (const record of records) {
    const target = resolveCollectorPhoneTarget(record);
    const productUrl = String(record.sourceUrl || '').trim();
    if (!target || !publishedPhones.has(target.phoneId) || !isProbableProductUrl(productUrl)) {
      result.skipped++;
      continue;
    }
    result.candidates++;
    const source = findTrustedSourceForUrl(productUrl, sources);
    if (!source) {
      const hostname = normalizeHostname(productUrl);
      if (hostname) {
        await PriceMatchCandidate.findOneAndUpdate(
          { phoneId: target.phoneId, sourceUrl: productUrl },
          { $set: { hostname, status: 'pending', reason: `Collector URL requires a trusted source for ${hostname}.`, resolvedSourceId: null, resolvedAt: null } },
          { upsert: true, setDefaultsOnInsert: true },
        );
        result.sourceGaps++;
      } else result.skipped++;
      continue;
    }

    const pendingPrice = normalizePendingCollectedPrice(record.pakistanPrice);
    const sourceTitle = `${String(record.brandName || '').trim()} ${String(record.model || '').trim()}`.trim();
    const variant = inferRetailVariantIdentity({
      title: `${sourceTitle} ${String(record.localSellerNotes || '')}`,
      productUrl,
      existing: {
        ram: inferUniqueMemoryLabel(record.memory?.ram),
        storage: inferUniqueMemoryLabel(record.memory?.storage),
        ptaStatus: record.ptaStatus,
        warrantyType: record.officialWarranty,
        condition: 'new',
      },
    });
    const update = await PhoneRetailListing.updateOne(
      { sourceId: source._id, productUrl },
      {
        $setOnInsert: {
          phoneId: target.phoneId,
          sourceTitle,
          currentSourcePrice: 0,
          availability: 'unknown',
          enabled: true,
          verificationStatus: 'pending',
          discoveryOrigin: 'collector',
          collectorRecordId: record._id,
          matchStrategy: target.strategy,
          matchConfidence: target.confidence,
        },
        $set: {
          ram: variant.ram,
          storage: variant.storage,
          color: variant.color,
          condition: variant.condition,
          ptaStatus: variant.ptaStatus,
          warrantyType: variant.warrantyType,
          variantKey: variant.variantKey,
          market: 'PK',
          currency: 'PKR',
          priceType: normalizeMarketPriceType('', 'PK', variant.ptaStatus),
          priceIdentityKey: buildMarketPriceIdentity({ market: 'PK', currency: 'PKR', priceType: normalizeMarketPriceType('', 'PK', variant.ptaStatus), ptaStatus: variant.ptaStatus, variantKey: variant.variantKey }),
          ...(pendingPrice ? { pendingSourcePrice: pendingPrice, pendingDetectedAt: new Date() } : {}),
        },
      },
      { upsert: true },
    );
    if (update.upsertedCount) result.queued++;
    else result.alreadyLinked++;

    await PriceMatchCandidate.updateOne(
      { phoneId: target.phoneId, sourceUrl: productUrl },
      { $set: { status: 'resolved', resolvedSourceId: source._id, resolvedAt: new Date() } },
    );
  }
  return result;
}
