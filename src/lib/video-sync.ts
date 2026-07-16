// ============ YouTube Sync Logic (shared between cron and admin manual sync) ============

import { Video, Phone } from '@/lib/models';
import { fetchRecentVideos, YouTubeVideoItem } from '@/lib/youtube';

/**
 * Attempt to auto-link a YouTube video to a phone by matching the video title
 * against phone modelNames and brand names. Only returns a match if there's
 * exactly ONE confident hit (avoids wrong links).
 */
async function suggestPhoneId(title: string): Promise<{ phoneId: string | null; confident: boolean }> {
  if (!title) return { phoneId: null, confident: false };

  const normalizedTitle = title.toLowerCase();
  // Remove common review keywords to isolate the phone name
  const cleaned = normalizedTitle
    .replace(/\b(review|unboxing|hands.?on|first.?look|full|detailed|pakistan|price|pt|pta|official|trailer|teaser|comparison|vs|vs\.|flipkart|amazon|buy|should you)\b/gi, '')
    .replace(/[()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length < 3) return { phoneId: null, confident: false };

  // Try to find a phone whose modelName appears in the cleaned title
  // Use a regex-safe version of the cleaned title words
  const words = cleaned.split(' ').filter(w => w.length >= 3);
  if (words.length === 0) return { phoneId: null, confident: false };

  // Build an OR query: any word that is 4+ chars and looks like a model identifier
  const modelPatterns = words
    .filter(w => w.length >= 4)
    .map(w => ({ modelName: { $regex: w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }));

  if (modelPatterns.length === 0) return { phoneId: null, confident: false };

  const matches = await Phone.find({
    $or: modelPatterns,
    active: true,
    status: 'published',
  }).select('_id modelName').limit(5).lean();

  if (matches.length === 1) {
    return { phoneId: matches[0]._id.toString(), confident: true };
  }

  // If multiple matches, try to find the best one by checking brand+model combo
  if (matches.length > 1) {
    // Try matching longer model names first (more specific)
    const sorted = [...matches].sort((a, b) => b.modelName.length - a.modelName.length);
    // If the top match's modelName is significantly longer, it's likely the right one
    if (sorted[0].modelName.length > sorted[1].modelName.length * 1.3) {
      return { phoneId: sorted[0]._id.toString(), confident: true };
    }
  }

  return { phoneId: null, confident: false };
}

export interface SyncResult {
  total: number;
  inserted: number;
  skipped: number;
  autoLinked: number;
  error?: string;
}

/**
 * Main sync function. Fetches recent videos from YouTube and inserts new ones.
 * Safe to call repeatedly — deduplicates by youtubeId.
 */
export async function syncYouTubeVideos(): Promise<SyncResult> {
  const apiKey = process.env.YOUTUBE_API_KEY || '';
  const channelId = process.env.YOUTUBE_CHANNEL_ID || '';

  let ytVideos: YouTubeVideoItem[];
  try {
    ytVideos = await fetchRecentVideos(apiKey, channelId);
  } catch (e: any) {
    return { total: 0, inserted: 0, skipped: 0, autoLinked: 0, error: e.message };
  }

  if (ytVideos.length === 0) {
    return { total: 0, inserted: 0, skipped: 0, autoLinked: 0 };
  }

  // Get existing youtubeIds in one query
  const existingIds = new Set(
    (await Video.find({ youtubeId: { $in: ytVideos.map(v => v.youtubeId) } }).select('youtubeId').lean())
      .map((v: any) => v.youtubeId)
  );

  let inserted = 0;
  let autoLinked = 0;

  for (const yt of ytVideos) {
    if (existingIds.has(yt.youtubeId)) continue;

    const { phoneId, confident } = await suggestPhoneId(yt.title);

    await Video.create({
      youtubeId: yt.youtubeId,
      title: yt.title,
      description: yt.description,
      thumbnailUrl: yt.thumbnailUrl,
      publishedAt: new Date(yt.publishedAt),
      phoneId: phoneId ? phoneId : null,
      active: false, // Auto-linked videos start inactive until admin confirms
      autoLinked: confident && !!phoneId,
    });

    inserted++;
    if (confident && phoneId) autoLinked++;
  }

  return { total: ytVideos.length, inserted, skipped: ytVideos.length - inserted, autoLinked };
}