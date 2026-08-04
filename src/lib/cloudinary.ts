// Cloudinary Image Upload Utility for PhoneDock
// Environment variables needed:
//   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME - Your Cloudinary cloud name
//   CLOUDINARY_UPLOAD_PRESET - Unsigned upload preset name (create in Cloudinary Dashboard > Settings > Upload)
//   CLOUDINARY_API_KEY - Optional, for signed uploads
//   CLOUDINARY_API_SECRET - Optional, for signed uploads

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || 'phonedock_images';
const BASE_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}`;

export interface UploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  size: number;
}

/**
 * Upload a single image to Cloudinary using unsigned upload preset
 */
export async function uploadImage(file: File, folder = 'phones'): Promise<UploadResult> {
  if (!CLOUD_NAME) {
    throw new Error('Cloudinary cloud name not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME env var.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);
  formData.append('transformation', 'q_auto,f_auto,w_800');

  const res = await fetch(`${BASE_URL}/image/upload`, { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Upload failed with status ${res.status}`);
  }

  const data = await res.json();
  return {
    url: data.secure_url,
    publicId: data.public_id,
    width: data.width,
    height: data.height,
    format: data.format,
    size: data.bytes,
  };
}

/**
 * Upload multiple images in parallel
 */
export async function uploadImages(files: File[], folder = 'phones'): Promise<UploadResult[]> {
  const results = await Promise.allSettled(files.map(f => uploadImage(f, folder)));
  const successes: UploadResult[] = [];
  const errors: string[] = [];

  results.forEach((r, i) => {
    if (r.status === 'fulfilled') successes.push(r.value);
    else errors.push(`File ${i + 1} (${files[i].name}): ${r.reason?.message || 'Upload failed'}`);
  });

  if (errors.length > 0) {
    console.warn(`[Cloudinary] ${errors.length} of ${files.length} uploads failed:`, errors);
  }

  return successes;
}

/**
 * Delete an image from Cloudinary by public ID
 */
export async function deleteImage(publicId: string): Promise<boolean> {
  // Note: Deletion requires a signed API call (API key + secret)
  // This is intended to be called from server-side API routes only
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!apiKey || !apiSecret) {
    console.warn('[Cloudinary] Delete requires CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET');
    return false;
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const crypto = await import('crypto');
    const signature = crypto
      .createHash('sha1')
      .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
      .digest('hex');

    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('timestamp', timestamp);
    formData.append('api_key', apiKey);
    formData.append('signature', signature);

    const res = await fetch(`${BASE_URL}/image/destroy`, { method: 'POST', body: formData });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Generate an optimized Cloudinary URL from an existing URL or public ID
 */
export function getOptimizedUrl(publicIdOrUrl: string, width = 400): string {
  if (!publicIdOrUrl) return '';
  // If already a Cloudinary URL, transform it
  if (publicIdOrUrl.includes('cloudinary.com')) {
    return publicIdOrUrl.replace('/upload/', `/upload/w_${width},q_auto,f_auto/`);
  }
  // If it's just a public ID, construct full URL
  if (CLOUD_NAME && !publicIdOrUrl.startsWith('http')) {
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/w_${width},q_auto,f_auto/${publicIdOrUrl}`;
  }
  return publicIdOrUrl;
}