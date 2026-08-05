import { randomUUID } from 'crypto';
import {
  DataQualityIssue,
  LaunchCandidate,
  MonitoringRun,
  Phone,
  PhoneImage,
  PhoneSpecs,
  PhoneRetailListing,
  PriceSource,
  PriceTrackerHistory,
  SystemState,
} from '@/lib/models';
import { syncRumourFeeds } from '@/lib/rumour-sync';
import {
  buildMonitoringPhoneMetricsPipeline,
  EMPTY_MONITORING_PHONE_METRICS,
  MONITORING_PHONE_FILTER,
  type MonitoringPhoneMetrics,
} from '@/lib/continuous-monitoring-query';

type Trigger = 'manual' | 'cron';
type TrackerStatus = 'healthy' | 'attention' | 'critical' | 'not_configured';

interface RunOptions {
  trigger: Trigger;
  createdBy?: unknown;
  syncFeeds?: boolean;
}

interface TrackerSnapshot {
  key: string;
  title: string;
  status: TrackerStatus;
  count: number;
  total: number;
  details: string;
  actionUrl: string;
  metrics: Record<string, number>;
}

function alert(code: string, severity: 'info' | 'warning' | 'critical', title: string, details: string, count = 0) {
  return { code, severity, title, details, count };
}

function tracker(
  key: string,
  title: string,
  status: TrackerStatus,
  count: number,
  total: number,
  details: string,
  actionUrl: string,
  metrics: Record<string, number> = {},
): TrackerSnapshot {
  return { key, title, status, count, total, details, actionUrl, metrics };
}

const MONITORING_LOCK_KEY = 'continuous_monitoring_lock';
const MONITORING_LOCK_TTL_MS = 30 * 60 * 1000;

async function acquireMonitoringLock(now: Date): Promise<string | null> {
  const token = randomUUID();
  const staleBefore = new Date(now.getTime() - MONITORING_LOCK_TTL_MS);
  try {
    await SystemState.findOneAndUpdate(
      {
        key: MONITORING_LOCK_KEY,
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
          metadata: { token, startedAt: now.toISOString() },
        },
      },
      { upsert: true, new: true },
    );
    return token;
  } catch (error: unknown) {
    if ((error as { code?: number }).code === 11000) return null;
    throw error;
  }
}

async function releaseMonitoringLock(token: string): Promise<void> {
  await SystemState.findOneAndUpdate(
    { key: MONITORING_LOCK_KEY, 'metadata.token': token },
    {
      $set: {
        completed: false,
        completedAt: new Date(),
        metadata: {},
      },
    },
  );
}

export async function runContinuousMonitoring(options: RunOptions) {
  const startedAt = new Date();
  const lockToken = await acquireMonitoringLock(startedAt);
  if (!lockToken) {
    const activeRun = await MonitoringRun.findOne({ status: 'running' }).sort({ startedAt: -1 });
    if (activeRun) return activeRun.toObject();
    throw new Error('Continuous monitoring is already running');
  }

  let run;
  try {
    run = await MonitoringRun.create({
      trigger: options.trigger,
      status: 'running',
      startedAt,
      createdBy: options.createdBy || null,
    });
  } catch (error) {
    await releaseMonitoringLock(lockToken);
    throw error;
  }

  const errors: string[] = [];
  let feedSummary = { feeds: 0, scanned: 0, imported: 0, candidates: 0, skipped: 0, errors: [] as string[] };

  try {
    if (options.syncFeeds !== false) {
      try {
        feedSummary = await syncRumourFeeds();
        errors.push(...feedSummary.errors);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Rumour feed sync failed');
      }
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const staleDraftCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const staleSpecsCutoff = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
    const stalePriceCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [
      pendingLaunchCandidates,
      staleDraftPhones,
      openDataQualityIssues,
      phoneMetricRows,
      priceSourceCount,
      trustedPriceSourceCount,
      listingCount,
      verifiedListingCount,
      failedListingCount,
      staleListingCount,
      priceDropsToday,
      priceIncreasesToday,
      verifiedListingPhoneIds,
    ] = await Promise.all([
      LaunchCandidate.countDocuments({ status: 'pending' }),
      Phone.countDocuments({ ...MONITORING_PHONE_FILTER, status: { $in: ['draft', 'pending'] }, updatedAt: { $lt: staleDraftCutoff } }),
      DataQualityIssue.countDocuments({ status: { $in: ['open', 'needs_review'] } }),
      Phone.aggregate<MonitoringPhoneMetrics>(buildMonitoringPhoneMetricsPipeline({
        phoneSpecsCollection: PhoneSpecs.collection.name,
        phoneImagesCollection: PhoneImage.collection.name,
        staleSpecsCutoff,
      })),
      PriceSource.countDocuments({ enabled: true }),
      PriceSource.countDocuments({ enabled: true, trusted: true, status: 'active' }),
      PhoneRetailListing.countDocuments({ enabled: true }),
      PhoneRetailListing.countDocuments({ enabled: true, verificationStatus: 'verified' }),
      PhoneRetailListing.countDocuments({ enabled: true, $or: [{ verificationStatus: 'failed' }, { failureCount: { $gt: 0 } }] }),
      PhoneRetailListing.countDocuments({ enabled: true, verificationStatus: 'verified', $or: [{ lastCheckedAt: null }, { lastCheckedAt: { $lt: stalePriceCutoff } }] }),
      PriceTrackerHistory.countDocuments({ changeType: 'decrease', capturedAt: { $gte: todayStart }, verificationStatus: { $ne: 'rejected' } }),
      PriceTrackerHistory.countDocuments({ changeType: 'increase', capturedAt: { $gte: todayStart }, verificationStatus: { $ne: 'rejected' } }),
      PhoneRetailListing.distinct('phoneId', { enabled: true, verificationStatus: 'verified' }),
    ]);

    const phoneMetrics = phoneMetricRows[0] || EMPTY_MONITORING_PHONE_METRICS;
    const {
      totalPhones,
      publishedPhones,
      missingSpecs,
      incompleteSpecs,
      staleSpecs,
      missingImages,
      unverifiedImages,
      missingPrices,
      discountedPhones,
      upcomingPhones,
      discontinuedPhones,
      ptaApprovedPhones,
      nonPtaPhones,
    } = phoneMetrics;
    const unknownPtaPhones = Math.max(totalPhones - ptaApprovedPhones - nonPtaPhones, 0);
    const unlinkedPricePhones = Math.max(publishedPhones - new Set(verifiedListingPhoneIds.map(String)).size, 0);

    const trackers: TrackerSnapshot[] = [
      tracker(
        'price',
        'Price Tracker',
        trustedPriceSourceCount === 0 ? 'not_configured' : (missingPrices > 0 || failedListingCount > 0 || staleListingCount > 0 ? 'attention' : 'healthy'),
        missingPrices + failedListingCount + staleListingCount,
        totalPhones,
        trustedPriceSourceCount === 0
          ? 'No trusted price source is ready. Add exact retailer product pages before automatic checks can run.'
          : `${verifiedListingCount} verified listings; ${priceDropsToday} price drops and ${priceIncreasesToday} increases detected today.`,
        '/admin/price-tracker',
        { sources: priceSourceCount, trustedSources: trustedPriceSourceCount, listings: listingCount, verifiedListings: verifiedListingCount, failedListings: failedListingCount, staleListings: staleListingCount, unlinkedPhones: unlinkedPricePhones, missingPrices, priceDropsToday, priceIncreasesToday },
      ),
      tracker(
        'specs',
        'Specs Tracker',
        missingSpecs > 0 || incompleteSpecs > 0 ? (missingSpecs > 100 ? 'critical' : 'attention') : 'healthy',
        missingSpecs + incompleteSpecs,
        totalPhones,
        `${missingSpecs} phones have no specs document; ${incompleteSpecs} have incomplete core specifications; ${staleSpecs} have not been refreshed for 120 days.`,
        '/admin/specs-intelligence',
        { missing: missingSpecs, incomplete: incompleteSpecs, stale: staleSpecs },
      ),
      tracker(
        'images',
        'Image Tracker',
        missingImages > 0 || unverifiedImages > 0 ? (missingImages > 100 ? 'critical' : 'attention') : 'healthy',
        missingImages + unverifiedImages,
        totalPhones,
        `${missingImages} phones have no image and ${unverifiedImages} only have unverified image records.`,
        '/admin/image-intelligence',
        { missing: missingImages, unverified: unverifiedImages },
      ),
      tracker(
        'discounts',
        'Discount Tracker',
        discountedPhones > 0 || priceDropsToday > 0 ? 'attention' : 'healthy',
        Math.max(discountedPhones, priceDropsToday),
        totalPhones,
        `${discountedPhones} phones currently have a lower sale price than original price; ${priceDropsToday} verified drops were recorded today.`,
        '/admin/price-tracker?tab=price-changes',
        { discountedPhones, priceDropsToday, priceIncreasesToday },
      ),
      tracker(
        'discontinued',
        'Discontinued Tracker',
        discontinuedPhones > 0 ? 'attention' : 'healthy',
        discontinuedPhones,
        totalPhones,
        `${discontinuedPhones} phones are marked discontinued. Review availability and public visibility before changing status.`,
        '/admin/phones?availability=discontinued',
        { discontinued: discontinuedPhones },
      ),
      tracker(
        'upcoming',
        'Coming Soon Tracker',
        upcomingPhones > 0 || pendingLaunchCandidates > 0 ? 'attention' : 'healthy',
        upcomingPhones + pendingLaunchCandidates,
        totalPhones,
        `${upcomingPhones} catalog phones are upcoming/announced and ${pendingLaunchCandidates} launch candidates await review.`,
        '/admin/launch-intelligence',
        { upcomingPhones, pendingLaunchCandidates },
      ),
      tracker(
        'pta',
        'PTA Tracker',
        unknownPtaPhones > 0 ? 'attention' : 'healthy',
        unknownPtaPhones,
        totalPhones,
        `${ptaApprovedPhones} PTA approved, ${nonPtaPhones} non-PTA and ${unknownPtaPhones} unknown. Unknown records should be reviewed before publishing PTA claims.`,
        '/admin/phones?ptaStatus=unknown',
        { approved: ptaApprovedPhones, nonPta: nonPtaPhones, unknown: unknownPtaPhones },
      ),
      tracker(
        'quality',
        'Data Quality Pipeline',
        openDataQualityIssues > 0 ? 'attention' : 'healthy',
        openDataQualityIssues,
        totalPhones,
        `${openDataQualityIssues} open or needs-review issues are waiting in Data Quality Center.`,
        '/admin/data-quality',
        { openIssues: openDataQualityIssues, staleDrafts: staleDraftPhones },
      ),
    ];

    const alerts = [];
    if (feedSummary.feeds === 0) alerts.push(alert('feeds_not_configured', 'critical', 'No launch feeds configured', 'Add trusted RSS/Atom URLs to RUMOUR_FEED_URLS.', 0));
    if (errors.length) alerts.push(alert('feed_errors', 'warning', 'Some monitored feeds failed', errors.slice(0, 3).join(' | '), errors.length));
    if (pendingLaunchCandidates > 0) alerts.push(alert('pending_launches', 'info', 'Launch candidates need review', 'Review and approve or reject detected phones.', pendingLaunchCandidates));
    if (staleDraftPhones > 0) alerts.push(alert('stale_drafts', 'warning', 'Stale phone drafts detected', 'Draft phones have not been updated for more than 14 days.', staleDraftPhones));
    if (missingSpecs > 0) alerts.push(alert('missing_specs', missingSpecs > 100 ? 'critical' : 'warning', 'Phones missing specifications', 'Run Data Quality and enrich verified specifications.', missingSpecs));
    if (missingImages > 0) alerts.push(alert('missing_images', missingImages > 100 ? 'critical' : 'warning', 'Phones missing images', 'Review image gaps before publishing.', missingImages));
    if (missingPrices > 0) alerts.push(alert('missing_prices', missingPrices > 100 ? 'critical' : 'warning', 'Phones missing prices', 'Link trusted retailer listings or set a verified manual price.', missingPrices));
    if (unknownPtaPhones > 0) alerts.push(alert('unknown_pta', 'warning', 'Phones with unknown PTA status', 'Verify PTA status before showing PTA claims to visitors.', unknownPtaPhones));
    if (failedListingCount > 0) alerts.push(alert('failed_price_listings', 'warning', 'Retail listings are failing', 'Review failed checks and product URLs in Price Tracker.', failedListingCount));

    const completedAt = new Date();
    const summary = {
      feedsConfigured: feedSummary.feeds,
      feedsScanned: feedSummary.scanned,
      newsImported: feedSummary.imported,
      launchCandidatesCreated: feedSummary.candidates,
      pendingLaunchCandidates,
      staleDraftPhones,
      missingSpecs,
      incompleteSpecs,
      staleSpecs,
      missingImages,
      unverifiedImages,
      missingPrices,
      discountedPhones,
      discontinuedPhones,
      upcomingPhones,
      ptaApprovedPhones,
      nonPtaPhones,
      unknownPtaPhones,
      verifiedPriceListings: verifiedListingCount,
      failedPriceListings: failedListingCount,
      stalePriceListings: staleListingCount,
      priceDropsToday,
      priceIncreasesToday,
      openDataQualityIssues,
      totalPhones,
      publishedPhones,
    };

    run.status = errors.length ? 'completed_with_warnings' : 'completed';
    run.completedAt = completedAt;
    run.durationMs = completedAt.getTime() - startedAt.getTime();
    run.summary = summary;
    run.trackers = trackers;
    run.alerts = alerts;
    run.errors = errors.slice(0, 25);
    await run.save();
    console.info('[continuous-monitoring] completed', {
      trigger: options.trigger,
      durationMs: run.durationMs,
      phoneMetricsQueryCount: 1,
      phoneDocumentsLoaded: 0,
      totalPhones,
    });
    return run.toObject();
  } catch (error) {
    const completedAt = new Date();
    run.status = 'failed';
    run.completedAt = completedAt;
    run.durationMs = completedAt.getTime() - startedAt.getTime();
    run.errors = [error instanceof Error ? error.message : 'Monitoring run failed'];
    await run.save();
    throw error;
  } finally {
    await releaseMonitoringLock(lockToken).catch((error) => {
      console.error('[continuous-monitoring] failed to release lock', error);
    });
  }
}
