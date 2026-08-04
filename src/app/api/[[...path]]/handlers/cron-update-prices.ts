import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { Phone, PriceHistory } from '@/lib/models';
import { PriceSource, PhoneRetailListing, PriceTrackerHistory } from '@/lib/models/PriceTracker';
import { SystemState } from '@/lib/models';
import { connectDB, getAdminFromRequest, requirePermission } from './helpers';
import { revalidatePricePages } from '@/lib/revalidate';
import { fetchWithValidatedRedirects, readResponseTextLimited, validateUrlForFetch } from '@/lib/ssrf-guard';
import { getPriceTrackerSettings } from './price-tracker';
import { extractRetailPageSignals, isLikelySameRetailProduct } from '@/lib/price-extraction';

const LOCK_KEY = 'cron_update_prices_lock';
const LOCK_TTL_MS = 30 * 60 * 1000; // 30 minutes

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export async function handleCronUpdatePrices(req: NextRequest): Promise<NextResponse | undefined> {
  // Validate CRON_SECRET via x-cron-secret header (fallback to Authorization Bearer)
  const cronSecret = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace('Bearer ', '') || '';
  const envSecret = process.env.CRON_SECRET || '';
  if (!cronSecret || !envSecret || !safeCompare(cronSecret, envSecret)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await connectDB();

  // ── Distributed lock via SystemState ──
  const now = new Date();
  const staleBefore = new Date(now.getTime() - LOCK_TTL_MS);
  try {
    // Acquire the lock atomically. The old read-then-write sequence allowed two
    // serverless invocations to observe an unlocked document simultaneously.
    await SystemState.findOneAndUpdate(
      {
        key: LOCK_KEY,
        $or: [
          { completed: false },
          { completedAt: null },
          { completedAt: { $lt: staleBefore } },
        ],
      },
      {
        $set: {
          completed: true,
          completedAt: now,
          metadata: { startedAt: now.toISOString() },
        },
      },
      { upsert: true, new: true },
    );
  } catch (error: unknown) {
    // A duplicate-key race means the unique lock key is already held.
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json({ error: 'Job already running' }, { status: 409 });
    }
    throw error;
  }

  // ── Process listings ──
  const summary = { processed: 0, updated: 0, failed: 0, pending: 0 };
  const updatedSlugs: string[] = []; // Collect slugs for batch revalidation

  // Load configurable settings
  const ptSettings = await getPriceTrackerSettings();
  const AUTO_APPROVE_THRESHOLD = ptSettings.autoApproveThreshold;
  const REVIEW_THRESHOLD = ptSettings.reviewThreshold;
  const BATCH_SIZE = ptSettings.batchSize;

  try {
    // Get all enabled+trusted sources
    const trustedSourceIds = await PriceSource.find({ enabled: true, trusted: true, status: 'active' })
      .select('_id')
      .lean()
      .then((docs) => docs.map((d) => d._id));

    if (trustedSourceIds.length === 0) {
      return NextResponse.json({ ...summary, message: 'No trusted sources enabled' });
    }

    // Fetch eligible listings: enabled, verified, with a trusted source
    const listings = await PhoneRetailListing.find({
      enabled: true,
      verificationStatus: 'verified',
      sourceId: { $in: trustedSourceIds },
    })
      .populate('sourceId')
      .populate('phoneId')
      .lean();

    if (listings.length === 0) {
      return NextResponse.json({ ...summary, message: 'No eligible listings to process' });
    }

    const batches: (typeof listings)[number][][] = [];
    for (let i = 0; i < listings.length; i += BATCH_SIZE) {
      batches.push(listings.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      // Process each listing in a batch sequentially (to avoid overwhelming targets)
      for (const listing of batch) {
        summary.processed++;
        const listingId = listing._id;
        const phone = listing.phoneId as unknown as { _id: { toString(): string }; modelName?: string; manualLock?: boolean } | null;
        const source = listing.sourceId as unknown as { _id: { toString(): string }; allowedDomains?: string[]; name?: string } | null;

        if (!phone || !source) {
          summary.failed++;
          continue;
        }

        // Record that we're checking
        await PhoneRetailListing.findByIdAndUpdate(listingId, {
          $set: { lastCheckedAt: new Date() },
        });

        let detectedPrice: number | null = null;
        let availability = 'unknown' as string;
        let fetchError = '';
        let finalUrl = listing.productUrl;
        let detectedTitle = '';
        let extractionMethod = '';
        let extractionConfidence = 0;

        // ── SSRF protection ──
        const sourceAllowedDomains = source?.allowedDomains || [];
        if (sourceAllowedDomains.length === 0) {
          fetchError = 'Trusted source has no allowed domains configured';
        }
        const ssrfCheck = await validateUrlForFetch(listing.productUrl, sourceAllowedDomains);
        if (!fetchError && !ssrfCheck.safe) {
          console.warn(`[cron:prices] SSRF blocked: ${listing.productUrl} — ${ssrfCheck.reason}`);
          summary.failed++;
          continue;
        }

        // Attempt to fetch the product URL
        try {
          if (fetchError) throw new Error(fetchError);
          const response = await fetchWithValidatedRedirects(listing.productUrl, {
            allowedDomains: sourceAllowedDomains,
            timeoutMs: 15000,
            headers: {
              'User-Agent': 'PhoneDock-PriceChecker/1.0 (compatible; bot)',
              'Accept': 'text/html,application/xhtml+xml;q=0.9',
            },
          });
          finalUrl = response.url || listing.productUrl;

          if (!response.ok) {
            fetchError = `Retailer returned HTTP ${response.status}`;
          } else {
            const contentType = response.headers.get('content-type') || '';
            if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
              throw new Error('Retailer response is not an HTML product page');
            }
            const signals = extractRetailPageSignals(await readResponseTextLimited(response));
            detectedTitle = signals.title;
            detectedPrice = signals.price?.price ?? null;
            availability = signals.availability;
            extractionMethod = signals.price?.method || '';
            extractionConfidence = signals.price?.confidence || 0;
            const expectedTitle = String((listing as unknown as { sourceTitle?: string }).sourceTitle || phone.modelName || '').trim();
            if (!isLikelySameRetailProduct(expectedTitle, detectedTitle)) {
              throw new Error('Retailer page no longer matches the linked phone');
            }
          }
        } catch (error) {
          fetchError = error instanceof Error ? error.message : 'Retailer request failed';
        }

        // ── Handle failed extraction ──
        if (fetchError) {
          summary.failed++;
          await PhoneRetailListing.findByIdAndUpdate(listingId, {
            $set: { lastError: fetchError, lastFinalUrl: finalUrl, lastDetectedTitle: detectedTitle },
            $inc: { consecutiveFailures: 1 },
          });
          await PriceSource.findByIdAndUpdate(source._id, {
            $inc: { failureCount: 1 },
          });
          continue;
        }

        // ── Handle unavailable ──
        if (availability === 'unavailable') {
          // Keep old price, just update listing availability
          await PhoneRetailListing.findByIdAndUpdate(listingId, {
            $set: {
              availability: 'unavailable', lastFinalUrl: finalUrl,
              lastDetectedTitle: detectedTitle, lastError: '', consecutiveFailures: 0,
            },
          });
          continue;
        }

        // ── Handle successful price extraction ──
        if (detectedPrice !== null && detectedPrice > 0) {
          const previousSourcePrice = (listing as unknown as { currentSourcePrice?: number; previousSourcePrice?: number }).currentSourcePrice || (listing as unknown as { currentSourcePrice?: number; previousSourcePrice?: number }).previousSourcePrice || 0;

          if (previousSourcePrice <= 0) {
            // First detection — just record the price, no change to compute
            await PhoneRetailListing.findByIdAndUpdate(listingId, {
              $set: {
                currentSourcePrice: detectedPrice,
                previousSourcePrice: 0,
                availability: availability === 'unknown' ? 'available' : availability,
                lastChangedAt: new Date(),
                lastFinalUrl: finalUrl,
                lastDetectedTitle: detectedTitle,
                lastExtractionMethod: extractionMethod,
                lastConfidence: extractionConfidence,
                lastError: '',
                consecutiveFailures: 0,
              },
            });
            // Update source health
            await PriceSource.findByIdAndUpdate(source._id, {
              $set: { lastCheckedAt: new Date(), lastSuccessAt: new Date(), status: 'active', failureCount: 0 },
            });
            continue;
          }

          const difference = detectedPrice - previousSourcePrice;
          const pctChange = Math.abs(Math.round((difference / previousSourcePrice) * 10000) / 100);
          const changeType = difference > 0 ? 'increase' : difference < 0 ? 'decrease' : 'unchanged';

          // Update the listing
          await PhoneRetailListing.findByIdAndUpdate(listingId, {
            $set: {
              previousSourcePrice: previousSourcePrice,
              currentSourcePrice: detectedPrice,
              availability: availability === 'unknown' ? 'available' : availability,
              lastChangedAt: difference !== 0 ? new Date() : (listing as unknown as { lastChangedAt?: Date | null }).lastChangedAt,
              lastFinalUrl: finalUrl,
              lastDetectedTitle: detectedTitle,
              lastExtractionMethod: extractionMethod,
              lastConfidence: extractionConfidence,
              lastError: '',
              consecutiveFailures: 0,
            },
          });

          // Only process actual changes
          if (difference === 0) {
            // Update source health
            await PriceSource.findByIdAndUpdate(source._id, {
              $set: { lastCheckedAt: new Date(), lastSuccessAt: new Date(), status: 'active', failureCount: 0 },
            });
            continue;
          }

          // Determine action based on change percentage
          const isManualLock = phone?.manualLock === true;

          if (pctChange < AUTO_APPROVE_THRESHOLD) {
            // Auto-approve: change < 2%
            if (!isManualLock) {
              const slug = await applyPriceToPhone(phone._id.toString(), detectedPrice, previousSourcePrice, source, changeType);
              if (slug) updatedSlugs.push(slug);
            }
            // Always record history
            await PriceTrackerHistory.create({
              phoneId: phone._id,
              oldPrice: previousSourcePrice,
              newPrice: detectedPrice,
              difference,
              percentageChange: difference > 0 ? pctChange : -pctChange,
              changeType,
              sourceType: 'retailer',
              sourceId: source._id,
              sourceUrl: listing.productUrl,
              verificationStatus: 'confirmed',
              capturedAt: new Date(),
            });
            summary.updated++;
          } else if (pctChange <= REVIEW_THRESHOLD) {
            // Auto-approve but log: change 2-15%
            if (!isManualLock) {
              const slug = await applyPriceToPhone(phone._id.toString(), detectedPrice, previousSourcePrice, source, changeType);
              if (slug) updatedSlugs.push(slug);
            }
            await PriceTrackerHistory.create({
              phoneId: phone._id,
              oldPrice: previousSourcePrice,
              newPrice: detectedPrice,
              difference,
              percentageChange: difference > 0 ? pctChange : -pctChange,
              changeType,
              sourceType: 'retailer',
              sourceId: source._id,
              sourceUrl: listing.productUrl,
              verificationStatus: 'confirmed',
              capturedAt: new Date(),
            });
            summary.updated++;
          } else {
            // Create pending review: change > REVIEW_THRESHOLD%
            await PriceTrackerHistory.create({
              phoneId: phone._id,
              oldPrice: previousSourcePrice,
              newPrice: detectedPrice,
              difference,
              percentageChange: difference > 0 ? pctChange : -pctChange,
              changeType,
              sourceType: 'retailer',
              sourceId: source._id,
              sourceUrl: listing.productUrl,
              verificationStatus: 'pending',
              capturedAt: new Date(),
            });
            // Don't apply to phone — wait for manual approval
            // But if manual lock, save detected price in history only (already done above)
            summary.pending++;
          }

          // Update source health
          await PriceSource.findByIdAndUpdate(source._id, {
            $set: { lastCheckedAt: new Date(), lastSuccessAt: new Date(), status: 'active', failureCount: 0 },
          });
        } else {
          // Price extraction failed (but page loaded) — keep old price, increment failure
          summary.failed++;
          await PriceSource.findByIdAndUpdate(source._id, {
            $inc: { failureCount: 1 },
          });
          await PhoneRetailListing.findByIdAndUpdate(listingId, {
            $set: { lastError: 'No valid PKR price found', lastFinalUrl: finalUrl, lastDetectedTitle: detectedTitle },
            $inc: { consecutiveFailures: 1 },
          });
        }
      }
    }
    // ── Targeted cache revalidation for updated phones ──
    if (updatedSlugs.length > 0) {
      // Deduplicate slugs
      const uniqueSlugs = [...new Set(updatedSlugs)];
      for (const slug of uniqueSlugs) {
        revalidatePricePages(slug);
      }
    }
  } finally {
    // Always release the lock
    await SystemState.findOneAndUpdate(
      { key: LOCK_KEY },
      { $set: { completed: false, completedAt: new Date() } },
    );
  }

  return NextResponse.json(summary);
}

/**
 * Lets an authorised administrator run the exact same protected job without
 * exposing CRON_SECRET to the browser. Scheduled Vercel cron runs continue to
 * use handleCronUpdatePrices directly.
 */
export async function handleAdminRunPriceSync(req: NextRequest): Promise<NextResponse> {
  const authResult = await getAdminFromRequest(req);
  if (authResult.error) return authResult.error;
  const permissionError = requirePermission(authResult.admin, 'prices:edit');
  if (permissionError) return permissionError;

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured. Add it in Vercel Environment Variables first.' },
      { status: 503 },
    );
  }

  const headers = new Headers(req.headers);
  headers.set('x-cron-secret', cronSecret);
  const internalRequest = new NextRequest(req.url, { method: 'GET', headers });
  return (await handleCronUpdatePrices(internalRequest))
    || NextResponse.json({ error: 'Price sync did not return a result.' }, { status: 500 });
}

// ── Helper: apply detected price to Phone document ──
async function applyPriceToPhone(
  phoneId: string,
  newPrice: number,
  _oldPrice: number,
  source: { _id: { toString(): string }; name?: string },
  _changeType: string,
): Promise<string | null> {
  const phone = await Phone.findById(phoneId);
  if (!phone) return null;

  const currentPhonePrice = (phone as unknown as { currentPrice?: number }).currentPrice || 0;
  const difference = newPrice - currentPhonePrice;
  const pctChange = currentPhonePrice > 0 ? Math.round((difference / currentPhonePrice) * 10000) / 100 : 0;

  const updates: Record<string, unknown> = {
    currentPrice: newPrice,
    previousPrice: currentPhonePrice,
    priceChange: difference,
    percentageChange: pctChange,
    lastPriceChangedAt: new Date(),
    lastPriceCheckedAt: new Date(),
    priceMode: 'automatic',
    pricePKR: newPrice,
  };

  const lowest = (phone as unknown as { lowestPrice?: number }).lowestPrice || 0;
  const highest = (phone as unknown as { highestPrice?: number }).highestPrice || 0;
  if (newPrice < lowest || lowest === 0) updates.lowestPrice = newPrice;
  if (newPrice > highest) updates.highestPrice = newPrice;

  await Phone.findByIdAndUpdate(phoneId, { $set: updates });

  // Legacy PriceHistory
  try {
    await PriceHistory.create({ phoneId, storeName: source.name || null, price: newPrice });
  } catch (e) { console.error('[PriceHistory]', e); }

  // Return slug for cache revalidation
  return (phone as unknown as { slug?: string }).slug || null;
}
