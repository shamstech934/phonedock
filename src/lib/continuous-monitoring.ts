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
} from '@/lib/models';
import { syncRumourFeeds } from '@/lib/rumour-sync';

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

function isPositive(value: unknown): boolean {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0;
}

export async function runContinuousMonitoring(options: RunOptions) {
  const startedAt = new Date();
  const run = await MonitoringRun.create({
    trigger: options.trigger,
    status: 'running',
    startedAt,
    createdBy: options.createdBy || null,
  });

  const errors: string[] = [];
  let feedSummary = { feeds: 0, scanned: 0, imported: 0, candidates: 0, skipped: 0, errors: [] as string[] };

  try {
    if (options.syncFeeds !== false) {
      try {
        const syncedFeeds = await syncRumourFeeds();
        feedSummary = { ...syncedFeeds, candidates: 0 };
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
    const phoneFilter = { deletedAt: null };

    const [
      pendingLaunchCandidates,
      staleDraftPhones,
      openDataQualityIssues,
      phoneRows,
      priceSourceCount,
      trustedPriceSourceCount,
      listingCount,
      verifiedListingCount,
      failedListingCount,
      staleListingCount,
      priceDropsToday,
      priceIncreasesToday,
    ] = await Promise.all([
      LaunchCandidate.countDocuments({ status: 'pending' }),
      Phone.countDocuments({ ...phoneFilter, status: { $in: ['draft', 'pending'] }, updatedAt: { $lt: staleDraftCutoff } }),
      DataQualityIssue.countDocuments({ status: { $in: ['open', 'needs_review'] } }),
      Phone.find(phoneFilter)
        .select('_id status pricePKR originalPricePKR ptaApproved ptaStatus upcoming availabilityStatus announcedAt expectedLaunchAt pakistanLaunchAt discontinuedAt thumbnail lastVerifiedAt')
        .lean(),
      PriceSource.countDocuments({ enabled: true }),
      PriceSource.countDocuments({ enabled: true, trusted: true, status: 'active' }),
      PhoneRetailListing.countDocuments({ enabled: true }),
      PhoneRetailListing.countDocuments({ enabled: true, verificationStatus: 'verified' }),
      PhoneRetailListing.countDocuments({ enabled: true, $or: [{ verificationStatus: 'failed' }, { failureCount: { $gt: 0 } }] }),
      PhoneRetailListing.countDocuments({ enabled: true, verificationStatus: 'verified', $or: [{ lastCheckedAt: null }, { lastCheckedAt: { $lt: stalePriceCutoff } }] }),
      PriceTrackerHistory.countDocuments({ changeType: 'decrease', capturedAt: { $gte: todayStart }, verificationStatus: { $ne: 'rejected' } }),
      PriceTrackerHistory.countDocuments({ changeType: 'increase', capturedAt: { $gte: todayStart }, verificationStatus: { $ne: 'rejected' } }),
    ]);

    const ids = phoneRows.map((phone: any) => phone._id);
    const [specRows, imageRows] = await Promise.all([
      PhoneSpecs.find({ phoneId: { $in: ids } }).select('phoneId updatedAt chipset ram storage display battery mainCamera').lean(),
      PhoneImage.find({ phoneId: { $in: ids }, status: { $ne: 'rejected' } }).select('phoneId verified url').lean(),
    ]);

    const specMap = new Map(specRows.map((row: any) => [String(row.phoneId), row]));
    const imageGroups = new Map<string, any[]>();
    for (const image of imageRows as any[]) {
      const key = String(image.phoneId);
      const list = imageGroups.get(key) || [];
      list.push(image);
      imageGroups.set(key, list);
    }

    const totalPhones = phoneRows.length;
    const publishedPhones = phoneRows.filter((phone: any) => phone.status === 'published').length;
    const missingSpecs = phoneRows.filter((phone: any) => !specMap.has(String(phone._id))).length;
    const incompleteSpecs = phoneRows.filter((phone: any) => {
      const spec = specMap.get(String(phone._id));
      if (!spec) return false;
      return ![spec.chipset, spec.ram, spec.storage, spec.display, spec.battery, spec.mainCamera].every((value) => String(value || '').trim());
    }).length;
    const staleSpecs = phoneRows.filter((phone: any) => {
      const spec = specMap.get(String(phone._id));
      return spec?.updatedAt && new Date(spec.updatedAt) < staleSpecsCutoff;
    }).length;

    const missingImages = phoneRows.filter((phone: any) => {
      const thumbnail = String(phone.thumbnail || '').trim();
      return !thumbnail && !(imageGroups.get(String(phone._id)) || []).length;
    }).length;
    const unverifiedImages = phoneRows.filter((phone: any) => {
      const images = imageGroups.get(String(phone._id)) || [];
      return images.length > 0 && !images.some((image) => image.verified === true);
    }).length;

    const missingPrices = phoneRows.filter((phone: any) => !isPositive(phone.pricePKR)).length;
    const discountedPhones = phoneRows.filter((phone: any) => isPositive(phone.pricePKR) && Number(phone.originalPricePKR || 0) > Number(phone.pricePKR || 0)).length;
    const upcomingPhones = phoneRows.filter((phone: any) => phone.upcoming === true || ['rumored', 'announced', 'coming_soon'].includes(String(phone.availabilityStatus || ''))).length;
    const discontinuedPhones = phoneRows.filter((phone: any) => phone.availabilityStatus === 'discontinued' || Boolean(String(phone.discontinuedAt || '').trim())).length;
    const ptaApprovedPhones = phoneRows.filter((phone: any) => phone.ptaApproved === true || /approved/i.test(String(phone.ptaStatus || ''))).length;
    const nonPtaPhones = phoneRows.filter((phone: any) => /non.?pta|not.?approved|unapproved/i.test(String(phone.ptaStatus || ''))).length;
    const unknownPtaPhones = Math.max(totalPhones - ptaApprovedPhones - nonPtaPhones, 0);
    const unlinkedPricePhones = Math.max(publishedPhones - new Set((await PhoneRetailListing.distinct('phoneId', { enabled: true, verificationStatus: 'verified' })).map(String)).size, 0);

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
    return run.toObject();
  } catch (error) {
    const completedAt = new Date();
    run.status = 'failed';
    run.completedAt = completedAt;
    run.durationMs = completedAt.getTime() - startedAt.getTime();
    run.errors = [error instanceof Error ? error.message : 'Monitoring run failed'];
    await run.save();
    throw error;
  }
}
