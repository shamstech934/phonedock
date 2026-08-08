import { createHash } from 'crypto';
import { ImageIntelligenceSignal, Phone, PhoneImage } from '@/lib/models';

const normalizeUrl = (value: unknown) => String(value || '').trim().replace(/^http:\/\//i, 'https://').replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
const hashUrl = (url: string) => createHash('sha1').update(normalizeUrl(url)).digest('hex');
const METADATA_SIGNAL_TYPES = new Set(['missing_all_images','missing_thumbnail','insecure_thumbnail','invalid_image_url','insecure_image_url','missing_alt_text','duplicate_image','thumbnail_not_in_gallery','cross_phone_duplicate','multiple_primary_images','gallery_order_collision']);

export async function scanImageIntelligence(options?: { limit?: number }) {
  const limit = Math.min(500, Math.max(10, Number(options?.limit || 150)));
  const phones = await Phone.find({ deletedAt: null, active: true }).select('_id modelName slug thumbnail status').sort({ updatedAt: -1 }).limit(limit).lean();
  const phoneIds = phones.map((phone: any) => phone._id);
  const images = await PhoneImage.find({ phoneId: { $in: phoneIds }, status: { $ne: 'rejected' } }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  const byPhone = new Map<string, any[]>();
  const globalUrlOwners = new Map<string, Set<string>>();
  for (const image of images as any[]) {
    const key = String(image.phoneId);
    const list = byPhone.get(key) || [];
    list.push(image);
    byPhone.set(key, list);
    const normalized = normalizeUrl(image.url);
    if (normalized) {
      const owners = globalUrlOwners.get(normalized) || new Set<string>();
      owners.add(key);
      globalUrlOwners.set(normalized, owners);
    }
  }

  const now = new Date();
  let signalsSeen = 0;
  let autoResolved = 0;

  for (const phone of phones as any[]) {
    const phoneImages = byPhone.get(String(phone._id)) || [];
    const signals: Array<Record<string, any>> = [];
    const validImages = phoneImages.filter((image: any) => /^https?:\/\//i.test(String(image.url || '')));

    if (!phone.thumbnail && validImages.length === 0) {
      signals.push({ type: 'missing_all_images', severity: phone.status === 'published' ? 'critical' : 'warning', title: 'Phone has no usable images', details: `${phone.modelName} has neither a thumbnail nor gallery images.` });
    } else if (!phone.thumbnail && validImages.length > 0) {
      const preferred = validImages.find((image: any) => image.verified) || validImages.find((image: any) => ['thumbnail','front'].includes(String(image.role || ''))) || validImages[0];
      signals.push({ type: 'missing_thumbnail', severity: 'warning', title: 'Thumbnail is missing', details: 'A verified or primary gallery image can be selected as the thumbnail.', recommendedValue: preferred.url, evidence: { imageId: String(preferred._id), verified: Boolean(preferred.verified), role: preferred.role || 'unknown' } });
    }

    if (phone.thumbnail && !/^https:\/\//i.test(String(phone.thumbnail))) {
      signals.push({ type: 'insecure_thumbnail', severity: 'warning', title: 'Thumbnail is not HTTPS', details: 'Use an HTTPS image URL to avoid mixed-content failures.', recommendedValue: String(phone.thumbnail).replace(/^http:\/\//i, 'https://') });
    }

    const seen = new Map<string, any>();
    const thumbnailRoleImages = phoneImages.filter((image: any) => image.role === 'thumbnail');
    if (thumbnailRoleImages.length > 1) {
      signals.push({ type: 'multiple_primary_images', severity: 'warning', title: 'Multiple primary images', details: `${thumbnailRoleImages.length} gallery images are marked as thumbnail. Keep only one primary image.`, evidence: { imageIds: thumbnailRoleImages.map((image: any) => String(image._id)) } });
    }
    const sortOrderCounts = new Map<number, number>();
    for (const image of phoneImages) {
      const order = Number(image.sortOrder || 0);
      sortOrderCounts.set(order, (sortOrderCounts.get(order) || 0) + 1);
    }
    const collidedOrders = Array.from(sortOrderCounts.entries()).filter(([, count]) => count > 1).map(([order]) => order);
    if (collidedOrders.length && phoneImages.length > 1) {
      signals.push({ type: 'gallery_order_collision', severity: 'info', title: 'Gallery ordering needs review', details: `Multiple images share the same gallery position (${collidedOrders.join(', ')}).`, evidence: { collidedOrders } });
    }

    for (const image of phoneImages) {
      const url = String(image.url || '').trim();
      const normalized = normalizeUrl(url);
      if (!url || !/^https?:\/\//i.test(url)) {
        signals.push({ imageId: image._id, type: 'invalid_image_url', severity: 'critical', title: 'Invalid gallery image URL', details: 'The image URL is empty or not an HTTP(S) URL.' });
        continue;
      }
      if (!/^https:\/\//i.test(url)) {
        signals.push({ imageId: image._id, type: 'insecure_image_url', severity: 'warning', title: 'Gallery image is not HTTPS', details: 'Convert this image URL to HTTPS.', recommendedValue: url.replace(/^http:\/\//i, 'https://') });
      }
      if (!String(image.altText || '').trim()) {
        signals.push({ imageId: image._id, type: 'missing_alt_text', severity: 'info', title: 'Image alt text is missing', details: 'Add descriptive alt text for accessibility and image SEO.', recommendedValue: `${phone.modelName} ${image.role && image.role !== 'unknown' ? image.role : 'official image'}` });
      }
      if (seen.has(normalized)) {
        signals.push({ imageId: image._id, type: 'duplicate_image', severity: 'warning', title: 'Duplicate gallery image', details: 'This image duplicates another gallery item for the same phone.', evidence: { duplicateOf: String(seen.get(normalized)._id), checksum: hashUrl(url) } });
      } else {
        seen.set(normalized, image);
      }
      const owners = globalUrlOwners.get(normalized);
      if (owners && owners.size > 1) {
        signals.push({ imageId: image._id, type: 'cross_phone_duplicate', severity: 'critical', title: 'Image is attached to multiple phones', details: 'The exact same image URL is used by more than one phone. Review device identity before publishing.', evidence: { ownerPhoneIds: Array.from(owners), checksum: hashUrl(url) } });
      }
    }

    if (phone.thumbnail && validImages.length > 0 && !validImages.some((image: any) => normalizeUrl(image.url) === normalizeUrl(phone.thumbnail))) {
      signals.push({ type: 'thumbnail_not_in_gallery', severity: 'info', title: 'Thumbnail is not in gallery', details: 'Add the thumbnail to the gallery for consistent image management.', recommendedValue: phone.thumbnail });
    }

    const activeKeys = new Set<string>();
    for (const signal of signals) {
      const key = `${signal.type}:${signal.imageId ? String(signal.imageId) : 'phone'}`;
      activeKeys.add(key);
      await ImageIntelligenceSignal.findOneAndUpdate(
        { phoneId: phone._id, imageId: signal.imageId || null, type: signal.type },
        { $set: { ...signal, status: 'open', lastSeenAt: now, resolvedAt: null, resolvedBy: null }, $setOnInsert: { detectedAt: now } },
        { upsert: true, new: true },
      );
      signalsSeen += 1;
    }

    const existing = await ImageIntelligenceSignal.find({ phoneId: phone._id, status: 'open', type: { $in: Array.from(METADATA_SIGNAL_TYPES) } }).select('_id type imageId').lean();
    for (const item of existing as any[]) {
      const key = `${item.type}:${item.imageId ? String(item.imageId) : 'phone'}`;
      if (!activeKeys.has(key)) {
        await ImageIntelligenceSignal.updateOne({ _id: item._id }, { $set: { status: 'resolved', resolvedAt: now, resolutionNotes: 'Condition cleared by Image Intelligence scan.' } });
        autoResolved += 1;
      }
    }
  }

  return { scannedPhones: phones.length, signalsSeen, autoResolved, limit };
}

export async function verifyRemoteImageUrls(options?: { limit?: number }) {
  const { validateUrlForFetch } = await import('@/lib/ssrf-guard');
  const limit = Math.min(40, Math.max(1, Number(options?.limit || 20)));
  const images: any[] = await PhoneImage.find({ status: { $ne: 'rejected' }, url: { $regex: '^https?://', $options: 'i' } })
    .select('_id phoneId url').sort({ updatedAt: -1 }).limit(limit).lean();
  let checked = 0, broken = 0, unreachable = 0, cleared = 0;

  const openReviewSignal = async (image: any, title: string, details: string, evidence: Record<string, unknown>, severity: 'info'|'warning' = 'warning') => {
    await ImageIntelligenceSignal.findOneAndUpdate(
      { phoneId: image.phoneId, imageId: image._id, type: 'remote_unreachable' },
      { $set: { severity, status: 'open', title, details, lastSeenAt: new Date(), evidence }, $setOnInsert: { detectedAt: new Date() } },
      { upsert: true },
    );
  };

  const checkOne = async (image: any) => {
    const url = String(image.url || '').trim();
    const safety = await validateUrlForFetch(url);
    if (!safety.safe) {
      await openReviewSignal(image, 'Image URL failed safety check', safety.reason || 'Remote image URL is not safe to fetch.', { reason: safety.reason || 'unsafe_url' });
      unreachable++; return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(url, { method: 'HEAD', redirect: 'manual', cache: 'no-store', signal: controller.signal, headers: { 'User-Agent': 'PhoneDock-ImageHealth/1.0' } });
      checked++;
      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (response.status === 404 || response.status === 410) {
        broken++;
        await ImageIntelligenceSignal.findOneAndUpdate(
          { phoneId: image.phoneId, imageId: image._id, type: 'broken_remote_url' },
          { $set: { severity: 'critical', status: 'open', title: 'Remote image is broken', details: `Remote image returned HTTP ${response.status}. Replace or remove this gallery image after source review.`, lastSeenAt: new Date(), evidence: { httpStatus: response.status } }, $setOnInsert: { detectedAt: new Date() } },
          { upsert: true },
        );
        return;
      }
      if (response.status >= 200 && response.status < 300 && contentType && !contentType.startsWith('image/')) {
        await ImageIntelligenceSignal.findOneAndUpdate(
          { phoneId: image.phoneId, imageId: image._id, type: 'non_image_content' },
          { $set: { severity: 'critical', status: 'open', title: 'URL does not return an image', details: `The URL responded with content type ${contentType}. Verify that the linked asset is actually an image for this phone.`, lastSeenAt: new Date(), evidence: { httpStatus: response.status, contentType } }, $setOnInsert: { detectedAt: new Date() } },
          { upsert: true },
        );
        return;
      }
      if (response.status >= 200 && response.status < 300) {
        const result = await ImageIntelligenceSignal.updateMany(
          { phoneId: image.phoneId, imageId: image._id, type: { $in: ['broken_remote_url','remote_unreachable','non_image_content'] }, status: 'open' },
          { $set: { status: 'resolved', resolvedAt: new Date(), resolutionNotes: `Remote image responded successfully with HTTP ${response.status}.` } },
        );
        cleared += result.modifiedCount || 0;
        return;
      }
      unreachable++;
      await openReviewSignal(image, 'Remote image needs manual verification', `Remote image returned HTTP ${response.status}. This is not treated as definitely broken because the source may block HEAD requests or require a redirect.`, { httpStatus: response.status }, 'info');
    } catch (error) {
      unreachable++;
      await openReviewSignal(image, 'Remote image could not be verified', 'The bounded remote health check timed out or could not reach this image. Review manually before deleting it.', { error: error instanceof Error ? error.message : 'network_error' }, 'info');
    } finally { clearTimeout(timer); }
  };

  for (let offset = 0; offset < images.length; offset += 5) await Promise.all(images.slice(offset, offset + 5).map(checkOne));
  return { candidates: images.length, checked, broken, unreachable, cleared, limit };
}
