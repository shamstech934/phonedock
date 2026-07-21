import { BaseProvider, type ProviderFetchResult } from './base';
import { mapExternalRecord } from '../field-mapper';
import type { ProviderConfig } from '../types';

export function recordsFromXml(xml: string, rss: boolean): Record<string, unknown>[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('DTD and entity declarations are not allowed');
  const tags = rss ? ['item', 'entry'] : ['phone', 'record', 'item']; const blocks: string[] = [];
  for (const tag of tags) { const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'gi'); for (const match of xml.matchAll(regex)) blocks.push(match[1]); if (blocks.length) break; }
  return blocks.slice(0, 5000).map(block => { const record: Record<string, unknown> = {}; const fields = /<([\w:-]+)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g; for (const match of block.matchAll(fields)) record[match[1].replace(/^.*:/, '')] = match[2].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').trim(); return record; });
}

export class XmlFeedProvider extends BaseProvider {
  constructor(config: ProviderConfig, sourceId: string, sourceName: string, private rss = false) { super(config, sourceId, sourceName); }
  async fetch(): Promise<ProviderFetchResult> {
    if (!this.config.endpoint) return { phones: [], hasNextPage: false, providerErrors: ['No endpoint configured'] };
    try { const response = await this.fetchWithTimeout(this.config.endpoint, {}, this.config.timeoutMs); if (!response.ok) return { phones: [], hasNextPage: false, providerErrors: [`HTTP ${response.status}`] }; const records = recordsFromXml(await this.readTextLimited(response), this.rss); const phones = records.map(record => mapExternalRecord(record, this.config)).filter(phone => phone.brandName && phone.model); return { phones: this.applyBrandFilter(phones), totalAvailable: records.length, hasNextPage: false, providerErrors: phones.length ? [] : ['No mapped phone records found'] }; }
    catch (error) { return { phones: [], hasNextPage: false, providerErrors: [error instanceof Error ? error.message : 'XML feed failed'] }; }
  }
}
export class RssFeedProvider extends XmlFeedProvider { constructor(config: ProviderConfig, sourceId: string, sourceName: string) { super(config, sourceId, sourceName, true); } }
