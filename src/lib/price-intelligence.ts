import { Phone, PhoneRetailListing, PriceIntelligenceSignal, PriceSource, PriceTrackerHistory } from '@/lib/models';

export async function scanPriceIntelligence({ limit = 200 }: { limit?: number } = {}) {
  const safeLimit = Math.min(500, Math.max(1, limit));
  const phones: any[] = await Phone.find({ deletedAt: null, active: true, status: 'published' }).select('_id modelName pricePKR currentPrice manualLock').sort({ updatedAt: -1 }).limit(safeLimit).lean();
  let scanned = 0, opened = 0, recommendations = 0;
  const staleBefore = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  for (const phone of phones) {
    scanned++;
    const listings: any[] = await PhoneRetailListing.find({ phoneId: phone._id, enabled: true, verificationStatus: 'verified' }).populate('sourceId', 'name trusted enabled status priority').lean();
    const trusted = listings.filter(l => l.sourceId?.trusted && l.sourceId?.enabled && l.sourceId?.status === 'active' && l.availability === 'available' && Number(l.currentSourcePrice) > 0);
    const sorted = [...trusted].sort((a,b) => Number(a.currentSourcePrice)-Number(b.currentSourcePrice));
    const lowest = sorted[0];
    const highest = sorted[sorted.length-1];
    const signals: Array<{type:string,severity:string,title:string,details:string,recommendedPrice?:number,sourceId?:unknown,sourceUrl?:string,evidence?:unknown}> = [];
    if (!trusted.length) signals.push({ type:'missing_retailer_coverage', severity:'critical', title:'No trusted Pakistan retailer price', details:'No verified, available listing from an enabled trusted source.' });
    if (lowest && (!phone.pricePKR || Math.abs(Number(phone.pricePKR)-Number(lowest.currentSourcePrice))/Math.max(1,Number(phone.pricePKR)) >= .02)) {
      signals.push({ type:'recommended_market_price', severity:'warning', title:'Market price recommendation available', details:`Lowest trusted listing is PKR ${Number(lowest.currentSourcePrice).toLocaleString()}.`, recommendedPrice:Number(lowest.currentSourcePrice), sourceId:lowest.sourceId?._id, sourceUrl:lowest.productUrl, evidence:{ listingId:lowest._id, sourceName:lowest.sourceId?.name } });
      recommendations++;
    }
    if (lowest && highest && Number(highest.currentSourcePrice) > Number(lowest.currentSourcePrice) * 1.25) signals.push({ type:'large_price_spread', severity:'warning', title:'Large retailer price spread', details:'Trusted retailer prices differ by more than 25%.', evidence:{ lowest:Number(lowest.currentSourcePrice), highest:Number(highest.currentSourcePrice) } });
    if (listings.some(l => !l.lastCheckedAt || new Date(l.lastCheckedAt) < staleBefore)) signals.push({ type:'stale_price_check', severity:'warning', title:'Retailer listing is stale', details:'At least one enabled listing has not been checked in the last 7 days.' });
    const historyCount = await PriceTrackerHistory.countDocuments({ phoneId: phone._id });
    if (!historyCount && Number(phone.pricePKR) > 0) signals.push({ type:'missing_price_history', severity:'info', title:'No price history yet', details:'Current public price has no historical snapshot.' });
    const activeTypes = new Set(signals.map(s=>s.type));
    await PriceIntelligenceSignal.updateMany({ phoneId: phone._id, status:'open', type:{ $nin:[...activeTypes] } }, { $set:{ status:'resolved', resolvedAt:new Date(), resolutionNotes:'Condition no longer detected.' } });
    for (const s of signals) {
      await PriceIntelligenceSignal.findOneAndUpdate({ phoneId:phone._id, type:s.type }, { $set:{ ...s, status:'open', lastSeenAt:new Date() }, $setOnInsert:{ detectedAt:new Date() } }, { upsert:true, new:true });
      opened++;
    }
  }
  const sourceSummary = await PriceSource.aggregate([{ $group:{ _id:'$status', count:{ $sum:1 } } }]);
  return { scanned, opened, recommendations, sourceSummary, limit:safeLimit };
}
