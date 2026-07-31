import { DataQualityIssue, LaunchCandidate, MonitoringRun, Phone, PhoneImage, PhoneSpecs } from '@/lib/models';
import { syncRumourFeeds } from '@/lib/rumour-sync';

type Trigger = 'manual' | 'cron';

interface RunOptions {
  trigger: Trigger;
  createdBy?: unknown;
  syncFeeds?: boolean;
}

function alert(code: string, severity: 'info' | 'warning' | 'critical', title: string, details: string, count = 0) {
  return { code, severity, title, details, count };
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
        feedSummary = await syncRumourFeeds();
        errors.push(...feedSummary.errors);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Rumour feed sync failed');
      }
    }

    const staleCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const phoneFilter = { deletedAt: null };
    const [
      pendingLaunchCandidates,
      staleDraftPhones,
      openDataQualityIssues,
      phoneIds,
    ] = await Promise.all([
      LaunchCandidate.countDocuments({ status: 'pending' }),
      Phone.countDocuments({ ...phoneFilter, status: 'draft', updatedAt: { $lt: staleCutoff } }),
      DataQualityIssue.countDocuments({ status: { $in: ['open', 'needs_review'] } }),
      Phone.find(phoneFilter).select('_id pricePKR').lean(),
    ]);

    const ids = phoneIds.map((phone: any) => phone._id);
    const [specIds, imageIds] = await Promise.all([
      PhoneSpecs.distinct('phoneId', { phoneId: { $in: ids } }),
      PhoneImage.distinct('phoneId', { phoneId: { $in: ids } }),
    ]);
    const specSet = new Set(specIds.map(String));
    const imageSet = new Set(imageIds.map(String));
    const missingSpecs = ids.filter((id: unknown) => !specSet.has(String(id))).length;
    const missingImages = ids.filter((id: unknown) => !imageSet.has(String(id))).length;
    const missingPrices = phoneIds.filter((phone: any) => !Number(phone.pricePKR || 0)).length;

    const alerts = [];
    if (feedSummary.feeds === 0) alerts.push(alert('feeds_not_configured', 'critical', 'No launch feeds configured', 'Add trusted RSS/Atom URLs to RUMOUR_FEED_URLS.', 0));
    if (errors.length) alerts.push(alert('feed_errors', 'warning', 'Some monitored feeds failed', errors.slice(0, 3).join(' | '), errors.length));
    if (pendingLaunchCandidates > 0) alerts.push(alert('pending_launches', 'info', 'Launch candidates need review', 'Review and approve or reject detected phones.', pendingLaunchCandidates));
    if (staleDraftPhones > 0) alerts.push(alert('stale_drafts', 'warning', 'Stale phone drafts detected', 'Draft phones have not been updated for more than 14 days.', staleDraftPhones));
    if (missingSpecs > 0) alerts.push(alert('missing_specs', missingSpecs > 100 ? 'critical' : 'warning', 'Phones missing specifications', 'Run Data Quality and enrich verified specifications.', missingSpecs));
    if (missingImages > 0) alerts.push(alert('missing_images', missingImages > 100 ? 'critical' : 'warning', 'Phones missing images', 'Review image gaps before publishing.', missingImages));
    if (missingPrices > 0) alerts.push(alert('missing_prices', missingPrices > 100 ? 'critical' : 'warning', 'Phones missing prices', 'Link trusted retailer listings or set a verified manual price.', missingPrices));

    const completedAt = new Date();
    const summary = {
      feedsConfigured: feedSummary.feeds,
      feedsScanned: feedSummary.scanned,
      newsImported: feedSummary.imported,
      launchCandidatesCreated: feedSummary.candidates,
      pendingLaunchCandidates,
      staleDraftPhones,
      missingSpecs,
      missingImages,
      missingPrices,
      openDataQualityIssues,
    };

    run.status = errors.length ? 'completed_with_warnings' : 'completed';
    run.completedAt = completedAt;
    run.durationMs = completedAt.getTime() - startedAt.getTime();
    run.summary = summary;
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
