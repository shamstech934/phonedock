import { fetchRetailerPage } from '@/lib/retailer-fetch';

const MAX_INPUT_URLS = 12;
const MAX_DISCOVERED_URLS = 500;

export interface CatalogDiscoveryInput {
  mode: string;
  catalogUrls?: string[];
  sitemapUrls?: string[];
  feedUrl?: string;
  allowedDomains: string[];
}

export interface CatalogDiscoveryDiagnostics {
  rootUrl: string;
  httpStatus: number | null;
  finalUrl: string;
  totalLinks: number;
  allowedDomainLinks: number;
  probableProductLinks: number;
  acceptedLinks: number;
  rejectedSamples: Array<{ url: string; reason: string }>;
}

export interface CatalogDiscoveryResult {
  urls: string[];
  errors: string[];
  fetched: number;
  diagnostics?: CatalogDiscoveryDiagnostics[];
}

export function summarizeCatalogDiscoveryDiagnostics(result: CatalogDiscoveryResult): string {
  if (!result.diagnostics?.length) return '';
  return result.diagnostics.map(item =>
    `${item.rootUrl}: HTTP ${item.httpStatus ?? 'n/a'}, anchors=${item.totalLinks}, allowed=${item.allowedDomainLinks}, productCandidates=${item.probableProductLinks}, accepted=${item.acceptedLinks}`
  ).join('; ').slice(0, 1000);
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function extractLocsFromXml(xml: string): string[] {
  return [...xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)]
    .map(match => decodeXml(match[1].trim()))
    .filter(Boolean);
}

export function extractLinksFromHtml(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  for (const match of html.matchAll(/<a\b[^>]*?href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi)) {
    const href = decodeXml(match[1] || match[2] || match[3] || '').trim();
    if (!href || href.startsWith('#') || /^(?:javascript|data|mailto|tel):/i.test(href)) continue;
    try { links.push(new URL(href, baseUrl).toString()); } catch { /* malformed link */ }
  }
  return links;
}

function collectJsonUrls(value: unknown, output: string[], depth = 0): void {
  if (depth > 8 || output.length >= MAX_DISCOVERED_URLS) return;
  if (Array.isArray(value)) {
    value.forEach(item => collectJsonUrls(item, output, depth + 1));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (/^(?:url|productUrl|product_url|link|permalink)$/i.test(key) && typeof child === 'string') output.push(child);
    else collectJsonUrls(child, output, depth + 1);
    if (output.length >= MAX_DISCOVERED_URLS) return;
  }
}

const GENERIC_CATEGORY_TAIL = /^(?:mobiles?|phones?|smartphones?|products?|shop|store|category|collections?|catalog|search|brands?)$/i;
const WHATMOBILE_CATALOG_PATH = /(?:^|_)(?:mobiles?|mobile_phones)(?:_|-)?prices?(?:_|-|$)/i;
const WHATMOBILE_PRODUCT_PATH = /^[a-z0-9]+_[a-z0-9]+(?:-[a-z0-9]+)*$/i;

function normalizeHost(value: string): string {
  return value.toLowerCase().replace(/^www\./, '');
}

function productUrlRejectionReason(value: string): string {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return 'unsupported protocol';
    const host = normalizeHost(url.hostname);
    const segments = url.pathname.split('/').filter(Boolean);
    const tail = decodeURIComponent(segments.at(-1) || '');
    if (!tail) return 'empty path';

    if (host === 'whatmobile.com.pk') {
      if (segments.length !== 1) return 'WhatMobile product URL must use one path segment';
      if (WHATMOBILE_CATALOG_PATH.test(tail)) return 'WhatMobile catalog/category URL';
      if (!WHATMOBILE_PRODUCT_PATH.test(tail)) return 'not a WhatMobile Brand_Model-Variant URL';
      if (!/\d/.test(tail)) return 'WhatMobile product URL has no model number';
      return '';
    }

    if (segments.length < 2) return 'generic provider requires at least two path segments';
    if (GENERIC_CATEGORY_TAIL.test(tail)) return 'generic category/catalog URL';
    if (!/\d/.test(tail) && tail.split(/[-_]/).filter(Boolean).length < 2) return 'path does not look like a product';
    return '';
  } catch {
    return 'invalid URL';
  }
}

export function isProbableProductUrl(value: string): boolean {
  return productUrlRejectionReason(value) === '';
}

async function fetchText(url: string, allowedDomains: string[]): Promise<{ text: string; status: number | null; finalUrl: string }> {
  const result = await fetchRetailerPage(url, allowedDomains, { timeoutMs: 25_000 });
  if (!result.ok) {
    const detail = [
      result.error || 'Catalog fetch failed',
      result.status ? `HTTP ${result.status}` : '',
      result.failureType !== 'none' ? `type=${result.failureType}` : '',
      result.preview ? `preview=${result.preview.slice(0, 180)}` : '',
    ].filter(Boolean).join(' | ');
    throw new Error(detail);
  }
  return { text: result.html, status: result.status, finalUrl: result.finalUrl || url };
}

function uniqueAllowedProductUrls(values: string[], allowedDomains: string[]): string[] {
  const allowed = allowedDomains.map(value => value.toLowerCase().replace(/^www\./, '').replace(/^\./, ''));
  return [...new Set(values)].filter(value => {
    if (!isProbableProductUrl(value)) return false;
    try {
      const host = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
      return allowed.some(domain => host === domain || host.endsWith(`.${domain}`));
    } catch { return false; }
  }).slice(0, MAX_DISCOVERED_URLS);
}

export async function discoverCatalogProductUrls(input: CatalogDiscoveryInput): Promise<CatalogDiscoveryResult> {
  const errors: string[] = [];
  const discovered: string[] = [];
  const diagnostics: CatalogDiscoveryDiagnostics[] = [];
  let fetched = 0;
  const mode = input.mode || 'manual';
  const roots = mode === 'sitemap' ? input.sitemapUrls || []
    : mode === 'catalog' ? input.catalogUrls || []
      : (mode === 'feed' || mode === 'api') && input.feedUrl ? [input.feedUrl] : [];

  for (const root of roots.filter(Boolean).slice(0, MAX_INPUT_URLS)) {
    try {
      const fetchedPage = await fetchText(root, input.allowedDomains); fetched++;
      const body = fetchedPage.text;
      if (mode === 'catalog') {
        const allLinks = extractLinksFromHtml(body, fetchedPage.finalUrl || root);
        const allowed = input.allowedDomains.map(normalizeHost);
        const allowedLinks = allLinks.filter(value => {
          try {
            const host = normalizeHost(new URL(value).hostname);
            return allowed.some(domain => host === domain || host.endsWith(`.${domain}`));
          } catch { return false; }
        });
        const probable = allowedLinks.filter(isProbableProductUrl);
        const rejectedSamples = allowedLinks
          .filter(value => !isProbableProductUrl(value))
          .slice(0, 8)
          .map(value => ({ url: value, reason: productUrlRejectionReason(value) }));
        diagnostics.push({
          rootUrl: root,
          httpStatus: fetchedPage.status,
          finalUrl: fetchedPage.finalUrl,
          totalLinks: allLinks.length,
          allowedDomainLinks: allowedLinks.length,
          probableProductLinks: probable.length,
          acceptedLinks: probable.length,
          rejectedSamples,
        });
        discovered.push(...probable);
      } else if (mode === 'api' || (mode === 'feed' && /^[\s\r\n]*[\[{]/.test(body))) {
        const jsonUrls: string[] = [];
        collectJsonUrls(JSON.parse(body), jsonUrls);
        for (const url of jsonUrls) {
          try { discovered.push(new URL(url, root).toString()); } catch { /* invalid feed URL */ }
        }
      } else {
        const locs = extractLocsFromXml(body);
        const sitemapChildren = locs.filter(url => /(?:sitemap|\.xml)(?:$|\?)/i.test(url)).slice(0, MAX_INPUT_URLS);
        discovered.push(...locs.filter(url => !sitemapChildren.includes(url)));
        if (mode === 'sitemap') {
          for (const child of sitemapChildren) {
            try { discovered.push(...extractLocsFromXml((await fetchText(child, input.allowedDomains)).text)); fetched++; }
            catch (error) { errors.push(`${child}: ${error instanceof Error ? error.message : 'Fetch failed'}`); }
          }
        }
      }
    } catch (error) {
      errors.push(`${root}: ${error instanceof Error ? error.message : 'Discovery failed'}`);
    }
  }
  return { urls: uniqueAllowedProductUrls(discovered, input.allowedDomains), errors: errors.slice(0, 10), fetched, diagnostics };
}

function normalizedTokens(value: string): string[] {
  return decodeURIComponent(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(token => token.length > 1);
}

export function matchProductUrlToPhone<T extends { slug?: string; modelName?: string }>(url: string, phones: T[]): T | null {
  let path = '';
  try { path = new URL(url).pathname; } catch { return null; }
  const pathTokens = new Set(normalizedTokens(path));
  const scored = phones.map(phone => {
    const phoneTokens = [...new Set(normalizedTokens(`${phone.slug || ''} ${phone.modelName || ''}`))];
    const significant = phoneTokens.filter(token => !['samsung', 'apple', 'xiaomi', 'phone', 'mobile', 'galaxy'].includes(token));
    const matched = significant.filter(token => pathTokens.has(token));
    const digitTokens = significant.filter(token => /\d/.test(token));
    const digitsMatch = digitTokens.length === 0 || digitTokens.every(token => pathTokens.has(token));
    return { phone, score: significant.length ? matched.length / significant.length : 0, matched: matched.length, digitsMatch };
  }).filter(item => item.digitsMatch && item.matched >= 1 && item.score >= 0.6)
    .sort((a, b) => b.score - a.score || b.matched - a.matched);
  if (!scored[0]) return null;
  if (scored[1] && scored[0].score === scored[1].score && scored[0].matched === scored[1].matched) return null;
  return scored[0].phone;
}
