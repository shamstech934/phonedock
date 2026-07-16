// ============ YouTube Data API v3 Client ============
// Server-side only. Never import this in client code.
// Uses playlistItems.list (1 quota unit) instead of search.list (100 units).

export interface YouTubeVideoItem {
  youtubeId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string; // ISO string
}

interface PlaylistResponse {
  kind: string;
  items?: Array<{
    snippet?: {
      resourceId?: { videoId?: string };
      title?: string;
      description?: string;
      thumbnails?: {
        medium?: { url?: string };
        high?: { url?: string };
        maxres?: { url?: string };
      };
      publishedAt?: string;
    };
  }>;
  nextPageToken?: string;
}

interface ChannelResponse {
  kind: string;
  items?: Array<{
    contentDetails?: {
      relatedPlaylists?: {
        uploads?: string;
      };
    };
  }>;
}

/** Fetch the uploads playlist ID for a channel (UCxxx → UUxxx). */
async function getUploadsPlaylistId(apiKey: string, channelId: string): Promise<string> {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    if (res.status === 403) throw new Error('YouTube API key invalid or quota exceeded (403)');
    if (res.status === 400) throw new Error(`YouTube API bad request (400): ${await res.text()}`);
    throw new Error(`YouTube channels.list failed: ${res.status}`);
  }
  const data: ChannelResponse = await res.json();
  const uploadsId = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) throw new Error(`No uploads playlist found for channel ${channelId}. Is the channel ID correct?`);
  return uploadsId;
}

/**
 * Fetch recent videos from a channel's uploads playlist.
 * Uses playlistItems.list — costs ~1 quota unit per call.
 * Max 2 pages per call to stay within Vercel function timeout.
 */
export async function fetchRecentVideos(apiKey: string, channelId: string, maxPages = 2): Promise<YouTubeVideoItem[]> {
  if (!apiKey || apiKey === 'YOUR_API_KEY' || apiKey.includes('placeholder')) {
    throw new Error('YOUTUBE_API_KEY is not configured. Set it in Vercel env vars.');
  }
  if (!channelId || channelId === 'YOUR_CHANNEL_ID') {
    throw new Error('YOUTUBE_CHANNEL_ID is not configured. Set it in Vercel env vars.');
  }

  const playlistId = await getUploadsPlaylistId(apiKey, channelId);
  const videos: YouTubeVideoItem[] = [];
  let pageToken = '';

  for (let page = 0; page < maxPages; page++) {
    let url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${apiKey}`;
    if (pageToken) url += `&pageToken=${pageToken}`;

    const res = await fetch(url, { next: { revalidate: 0 } });

    if (res.status === 403) {
      console.error('[YouTube] Quota exceeded or key invalid (403). Stopping sync.');
      break;
    }
    if (!res.ok) {
      console.error(`[YouTube] playlistItems.list failed: ${res.status} ${await res.text()}`);
      break;
    }

    const data: PlaylistResponse = await res.json();

    for (const item of data.items || []) {
      const snippet = item.snippet;
      if (!snippet?.resourceId?.videoId) continue;

      const thumbs = snippet.thumbnails;
      const thumbnailUrl = thumbs?.maxres?.url || thumbs?.high?.url || thumbs?.medium?.url || '';

      videos.push({
        youtubeId: snippet.resourceId.videoId,
        title: snippet.title || '',
        description: (snippet.description || '').slice(0, 2000),
        thumbnailUrl,
        publishedAt: snippet.publishedAt || new Date().toISOString(),
      });
    }

    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }

  return videos;
}