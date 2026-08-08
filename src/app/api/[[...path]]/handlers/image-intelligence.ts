import { NextRequest, NextResponse } from 'next/server';
import { ActivityLog, ImageIntelligenceSignal, Phone, PhoneImage } from '@/lib/models';
import { connectDB, getAdminFromRequest, requirePermission } from './helpers';
import { scanImageIntelligence, verifyRemoteImageUrls } from '@/lib/image-intelligence';
import { revalidatePublicContent } from '@/lib/revalidate';

export async function handleImageIntelligenceGet(req: NextRequest): Promise<NextResponse> {
  const auth = await getAdminFromRequest(req);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth.admin, 'phones:read');
  if (denied) return denied;
  await connectDB();

  const status = req.nextUrl.searchParams.get('status') || 'open';
  const type = req.nextUrl.searchParams.get('type') || 'all';
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') || 1));
  const limit = Math.min(100, Math.max(10, Number(req.nextUrl.searchParams.get('limit') || 30)));
  const filter: Record<string, unknown> = {};
  if (status !== 'all') filter.status = status;
  if (type !== 'all') filter.type = type;

  const [items, total, openSignals, phonesWithoutImages, missingAlt, duplicates] = await Promise.all([
    ImageIntelligenceSignal.find(filter).sort({ severity: 1, lastSeenAt: -1 }).skip((page - 1) * limit).limit(limit).populate('phoneId', 'modelName slug status thumbnail').populate('imageId', 'url altText sortOrder role color verified').lean(),
    ImageIntelligenceSignal.countDocuments(filter),
    ImageIntelligenceSignal.countDocuments({ status: 'open' }),
    ImageIntelligenceSignal.countDocuments({ status: 'open', type: 'missing_all_images' }),
    ImageIntelligenceSignal.countDocuments({ status: 'open', type: 'missing_alt_text' }),
    ImageIntelligenceSignal.countDocuments({ status: 'open', type: 'duplicate_image' }),
  ]);

  return NextResponse.json({
    items, total, page, pages: Math.max(1, Math.ceil(total / limit)),
    summary: { openSignals, phonesWithoutImages, missingAlt, duplicates },
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function handleImageIntelligencePost(req: NextRequest): Promise<NextResponse> {
  const auth = await getAdminFromRequest(req);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth.admin, 'phones:edit');
  if (denied) return denied;
  await connectDB();

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');
  if (action === 'scan') {
    const result = await scanImageIntelligence({ limit: Number(body.limit || 150) });
    await ActivityLog.create({ adminId: auth.admin._id, action: 'image_intelligence_scan', entityType: 'image_intelligence', details: JSON.stringify(result) });
    return NextResponse.json({ success: true, ...result });
  }
  if (action === 'verify_remote') {
    const result = await verifyRemoteImageUrls({ limit: Number(body.limit || 20) });
    await ActivityLog.create({ adminId: auth.admin._id, action: 'image_intelligence_remote_check', entityType: 'image_intelligence', details: JSON.stringify(result) });
    return NextResponse.json({ success: true, ...result });
  }

  const id = String(body.id || '');
  if (!id) return NextResponse.json({ error: 'Signal id is required' }, { status: 400 });
  const signal: any = await ImageIntelligenceSignal.findById(id);
  if (!signal) return NextResponse.json({ error: 'Signal not found' }, { status: 404 });

  if (action === 'dismiss') {
    signal.status = 'dismissed'; signal.resolvedAt = new Date(); signal.resolvedBy = auth.admin._id; signal.resolutionNotes = String(body.notes || 'Dismissed by admin.');
    await signal.save();
    return NextResponse.json({ success: true, signal });
  }

  if (action !== 'apply') return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  const phone: any = await Phone.findById(signal.phoneId);
  if (!phone) return NextResponse.json({ error: 'Linked phone not found' }, { status: 404 });
  const image: any = signal.imageId ? await PhoneImage.findById(signal.imageId) : null;

  switch (signal.type) {
    case 'missing_thumbnail':
      phone.thumbnail = String(signal.recommendedValue || '');
      await phone.save();
      break;
    case 'insecure_thumbnail':
      phone.thumbnail = String(signal.recommendedValue || phone.thumbnail || '');
      await phone.save();
      break;
    case 'missing_alt_text':
      if (!image) return NextResponse.json({ error: 'Linked image not found' }, { status: 404 });
      image.altText = String(signal.recommendedValue || `${phone.modelName} official image`);
      await image.save();
      break;
    case 'insecure_image_url':
      if (!image) return NextResponse.json({ error: 'Linked image not found' }, { status: 404 });
      image.url = String(signal.recommendedValue || image.url || '');
      await image.save();
      break;
    case 'duplicate_image':
    case 'invalid_image_url':
      if (!image) return NextResponse.json({ error: 'Linked image not found' }, { status: 404 });
      await PhoneImage.deleteOne({ _id: image._id });
      break;
    case 'thumbnail_not_in_gallery':
      await PhoneImage.create({ phoneId: phone._id, url: String(signal.recommendedValue || phone.thumbnail || ''), altText: `${phone.modelName} official image`, sortOrder: 0, role: 'thumbnail', verified: false, sourceName: 'Phone thumbnail' });
      break;
    default:
      return NextResponse.json({ error: 'This signal is review-only and cannot be applied automatically' }, { status: 400 });
  }

  signal.status = 'resolved'; signal.resolvedAt = new Date(); signal.resolvedBy = auth.admin._id; signal.resolutionNotes = String(body.notes || 'Recommendation applied after admin review.');
  await signal.save();
  await ActivityLog.create({ adminId: auth.admin._id, action: 'image_intelligence_applied', entityType: 'phone', entityId: phone._id, details: `${signal.type}: ${phone.modelName}` });
  revalidatePublicContent();
  return NextResponse.json({ success: true, signal });
}
