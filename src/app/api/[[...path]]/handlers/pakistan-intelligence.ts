import { NextRequest, NextResponse } from 'next/server';
import { ActivityLog, PakistanMarketSignal, Phone, PhoneRetailListing, PriceSource, PriceTrackerHistory } from '@/lib/models';
import { connectDB, getAdminFromRequest, requirePermission } from './helpers';
import { scanPakistanMarket } from '@/lib/pakistan-intelligence';
import { revalidatePublicContent } from '@/lib/revalidate';

export async function handlePakistanIntelligenceGet(req: NextRequest): Promise<NextResponse> {
  const auth = await getAdminFromRequest(req);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth.admin, 'prices:read');
  if (denied) return denied;
  await connectDB();

  const status = req.nextUrl.searchParams.get('status') || 'open';
  const type = req.nextUrl.searchParams.get('type') || 'all';
  const severity = req.nextUrl.searchParams.get('severity') || 'all';
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') || 1));
  const limit = Math.min(100, Math.max(10, Number(req.nextUrl.searchParams.get('limit') || 30)));
  const filter: Record<string, unknown> = {};
  if (status !== 'all') filter.status = status;
  if (type !== 'all') filter.type = type;
  if (severity !== 'all') filter.severity = severity;

  const trustedSourceIds = await PriceSource.find({ enabled: true, trusted: true, status: 'active' }).distinct('_id');
  const [items, total, counts, phonesWithoutPrice, unknownPta, verifiedListings, coveredPhoneIds, activePhones, openSignals, severityRows] = await Promise.all([
    PakistanMarketSignal.find(filter).sort({ severity: 1, lastSeenAt: -1 }).skip((page - 1) * limit).limit(limit).populate('phoneId', 'modelName slug status pricePKR currentPrice ptaStatus availabilityStatus lastVerifiedAt').lean(),
    PakistanMarketSignal.countDocuments(filter),
    PakistanMarketSignal.aggregate([{ $group: { _id: { status: '$status', type: '$type' }, count: { $sum: 1 } } }]),
    Phone.countDocuments({ deletedAt: null, active: true, $and: [{ pricePKR: { $lte: 0 } }, { currentPrice: { $lte: 0 } }] }),
    Phone.countDocuments({ deletedAt: null, active: true, $or: [{ ptaStatus: { $in: ['', 'Unknown', 'unknown'] } }, { ptaStatus: { $exists: false } }] }),
    PhoneRetailListing.countDocuments({ enabled: true, verificationStatus: 'verified', sourceId: { $in: trustedSourceIds } }),
    PhoneRetailListing.distinct('phoneId', { enabled: true, verificationStatus: 'verified', availability: 'available', currentSourcePrice: { $gt: 0 }, sourceId: { $in: trustedSourceIds } }),
    Phone.countDocuments({ deletedAt: null, active: true }),
    PakistanMarketSignal.countDocuments({ status: 'open' }),
    PakistanMarketSignal.aggregate([{ $match: { status: 'open' } }, { $group: { _id: '$severity', count: { $sum: 1 } } }]),
  ]);

  const severitySummary = { info: 0, warning: 0, critical: 0 };
  for (const row of severityRows as Array<{ _id: keyof typeof severitySummary; count: number }>) {
    if (row._id in severitySummary) severitySummary[row._id] = Number(row.count || 0);
  }
  const phonesCovered = coveredPhoneIds.length;
  const retailerCoveragePercent = activePhones > 0 ? Math.round((phonesCovered / activePhones) * 100) : 0;

  return NextResponse.json({
    items, total, page, pages: Math.max(1, Math.ceil(total / limit)),
    summary: { activePhones, phonesWithoutPrice, unknownPta, verifiedListings, trustedSources: trustedSourceIds.length, phonesCovered, retailerCoveragePercent, openSignals, severity: severitySummary },
    counts,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function handlePakistanIntelligencePost(req: NextRequest): Promise<NextResponse> {
  const auth = await getAdminFromRequest(req);
  if (auth.error) return auth.error;
  await connectDB();
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');

  if (action === 'scan') {
    const denied = requirePermission(auth.admin, 'prices:edit');
    if (denied) return denied;
    const result = await scanPakistanMarket({ limit: Number(body.limit || 25) });
    await ActivityLog.create({ adminId: auth.admin._id, action: 'pakistan_intelligence_scan', entityType: 'pakistan_intelligence', details: JSON.stringify(result) });
    return NextResponse.json({ success: true, ...result });
  }

  const id = String(body.id || '');
  if (!id) return NextResponse.json({ error: 'Signal id is required' }, { status: 400 });
  const signal: any = await PakistanMarketSignal.findById(id);
  if (!signal) return NextResponse.json({ error: 'Signal not found' }, { status: 404 });

  if (action === 'resolve') {
    const denied = requirePermission(auth.admin, 'prices:edit');
    if (denied) return denied;
    signal.status = 'resolved'; signal.resolvedAt = new Date(); signal.resolvedBy = auth.admin._id; signal.resolutionNotes = String(body.notes || 'Resolved after manual admin review.');
    await signal.save();
    await ActivityLog.create({ adminId: auth.admin._id, action: 'pakistan_intelligence_resolved', entityType: 'pakistan_intelligence', entityId: signal._id, details: `${signal.type}: ${signal.phoneId}` });
    return NextResponse.json({ success: true, signal });
  }

  if (action === 'dismiss') {
    const denied = requirePermission(auth.admin, 'prices:edit');
    if (denied) return denied;
    signal.status = 'dismissed'; signal.resolvedAt = new Date(); signal.resolvedBy = auth.admin._id; signal.resolutionNotes = String(body.notes || 'Dismissed by admin.');
    await signal.save();
    return NextResponse.json({ success: true, signal });
  }

  if (action === 'apply') {
    const denied = requirePermission(auth.admin, 'prices:edit');
    if (denied) return denied;
    const phone: any = await Phone.findById(signal.phoneId);
    if (!phone) return NextResponse.json({ error: 'Linked phone not found' }, { status: 404 });

    if (signal.type === 'price_available') {
      const price = Number(signal.recommendedValue || 0);
      if (!Number.isFinite(price) || price <= 0) return NextResponse.json({ error: 'Signal has no valid price recommendation' }, { status: 400 });
      if (phone.manualLock) return NextResponse.json({ error: 'Phone price is manually locked' }, { status: 409 });
      const oldPrice = Math.max(Number(phone.pricePKR || 0), Number(phone.currentPrice || 0));
      phone.previousPrice = oldPrice;
      phone.pricePKR = price; phone.currentPrice = price;
      phone.lowestPrice = phone.lowestPrice > 0 ? Math.min(phone.lowestPrice, price) : price;
      phone.highestPrice = Math.max(Number(phone.highestPrice || 0), price);
      phone.priceChange = price - oldPrice;
      phone.percentageChange = oldPrice > 0 ? ((price - oldPrice) / oldPrice) * 100 : 0;
      phone.lastPriceCheckedAt = new Date(); phone.lastPriceChangedAt = new Date(); phone.lastVerifiedAt = new Date();
      await phone.save();
      await PriceTrackerHistory.create({ phoneId: phone._id, oldPrice, newPrice: price, difference: price - oldPrice, percentageChange: oldPrice > 0 ? ((price - oldPrice) / oldPrice) * 100 : 0, changeType: oldPrice === 0 ? 'correction' : price < oldPrice ? 'decrease' : price > oldPrice ? 'increase' : 'unchanged', sourceType: 'correction', sourceUrl: signal.sourceUrl || '', changedByAdminId: auth.admin._id, approvedByAdminId: auth.admin._id, verificationStatus: 'confirmed' });
    } else if (signal.type === 'pta_status_available') {
      const ptaStatus = String(signal.recommendedValue || '').trim();
      if (!ptaStatus) return NextResponse.json({ error: 'Signal has no PTA recommendation' }, { status: 400 });
      phone.ptaStatus = ptaStatus;
      phone.ptaApproved = /approved|pta\s*yes|official/i.test(ptaStatus) && !/non|not/i.test(ptaStatus);
      phone.lastVerifiedAt = new Date();
      await phone.save();
    } else {
      return NextResponse.json({ error: 'This signal is review-only and cannot be applied automatically' }, { status: 400 });
    }

    signal.status = 'resolved'; signal.resolvedAt = new Date(); signal.resolvedBy = auth.admin._id; signal.resolutionNotes = String(body.notes || 'Recommendation applied after admin review.');
    await signal.save();
    await ActivityLog.create({ adminId: auth.admin._id, action: 'pakistan_intelligence_applied', entityType: 'phone', entityId: phone._id, details: `${signal.type}: ${phone.modelName}` });
    revalidatePublicContent();
    return NextResponse.json({ success: true, signal, phone: { _id: phone._id, modelName: phone.modelName, pricePKR: phone.pricePKR, ptaStatus: phone.ptaStatus } });
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
}
