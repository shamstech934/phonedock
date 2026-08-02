import type { ProviderType } from './types';

export type SourceDetection = {
  type: ProviderType;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
};

export function detectCollectorSourceType(endpoint: string): SourceDetection {
  const value = String(endpoint || '').trim();
  if (!value) return { type: 'manual_url', confidence: 'low', reason: 'Enter a URL to detect the source type.' };

  let url: URL;
  try { url = new URL(value); }
  catch { return { type: 'manual_url', confidence: 'low', reason: 'The URL is not valid yet.' }; }

  const path = url.pathname.toLowerCase();
  const combined = `${url.hostname.toLowerCase()}${path}${url.search.toLowerCase()}`;
  if (/\.csv(?:$|\?)/.test(path) || /(?:format|output)=csv/.test(combined)) {
    return { type: 'csv_url', confidence: 'high', reason: 'The URL points to a CSV file/feed.' };
  }
  if (/\.json(?:$|\?)/.test(path)) {
    return { type: 'json_url', confidence: 'high', reason: 'The URL points to a JSON document.' };
  }
  if (/\.(?:xml|rss|atom)(?:$|\?)/.test(path) || /(?:rss|atom|feed)(?:\/|$)/.test(path)) {
    return { type: /rss|atom|feed/.test(path) ? 'rss_feed' : 'xml_feed', confidence: 'high', reason: 'The URL looks like an XML/RSS feed.' };
  }
  if (/\bapi\b/.test(url.hostname) || /\/api\//.test(path) || /\/v\d+\//.test(path)) {
    return { type: 'api', confidence: 'medium', reason: 'The URL looks like a JSON API endpoint.' };
  }
  return { type: 'manual_url', confidence: 'high', reason: 'This is a normal website page. The collector will read JSON-LD and structured product links.' };
}
