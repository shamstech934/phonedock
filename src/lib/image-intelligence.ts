import { createHash } from 'crypto';
import { ImageIntelligenceSignal, Phone, PhoneImage } from '@/lib/models';

const normalizeUrl = (value: unknown) => String(value || '').trim().replace(/^http:\/\//i, 'https://').replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
const hashUrl = (url: string) => createHash('sha1').update(normalizeUrl(url)).digest('hex');

export async function scanImageIntelligence(options?: { limit?: number }) {
  const limit = Math.min(500, Math.max(10, Number(options?.limit || 150)));
  const phones = await Phone.find({ deletedAt: null, active: true }).select('_id modelName slug thumbnail status').sort({ updatedAt: -1 }).limit(limit).lean();
  const phoneIds = phones.map((phone: any) => phone._id);
  const images = await PhoneImage.find({ phoneId: { $in: phoneIds }, status: { $ne: 'rejected' } }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  const byPhone = new Map<string, any[]>();
  for (const image of images as any[]) {
    const key = String(image.phoneId);
    const list = byPhone.get(key) || [];
    list.push(image);
    byPhone.set(key, list);
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
      signals.push({ type: 'missing_thumbnail', severity: 'warning', title: 'Thumbnail is missing', details: 'A gallery image can be selected as the thumbnail.', recommendedValue: validImages[0].url, evidence: { imageId: String(validImages[0]._id) } });
    }

    if (phone.thumbnail && !/^https:\/\//i.test(String(phone.thumbnail))) {
      signals.push({ type: 'insecure_thumbnail', severity: 'warning', title: 'Thumbnail is not HTTPS', details: 'Use an HTTPS image URL to avoid mixed-content failures.', recommendedValue: String(phone.thumbnail).replace(/^http:\/\//i, 'https://') });
    }

    const seen = new Map<string, any>();
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
        signals.push({ imageId: image._id, type: 'duplicate_image', severity: 'warning', title: 'Duplicate gallery image', details: 'This image duplicates another gallery item.', evidence: { duplicateOf: String(seen.get(normalized)._id), checksum: hashUrl(url) } });
      } else {
        seen.set(normalized, image);
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

    const existing = await ImageIntelligenceSignal.find({ phoneId: phone._id, status: 'open' }).select('_id type imageId').lean();
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
