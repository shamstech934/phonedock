/**
 * SSRF (Server-Side Request Forgery) protection utility.
 * Validates that a URL does not point to internal/private network resources.
 */

/** Private IPv4 ranges: [{start, end}] (inclusive) */
const PRIVATE_V4_RANGES: Array<[number, number]> = [
  [0x00000000, 0x00000000],       // 0.0.0.0/32
  [0x7F000000, 0x7FFFFFFF],       // 127.0.0.0/8 (loopback)
  [0x0A000000, 0x0AFFFFFF],       // 10.0.0.0/8
  [0xAC100000, 0xAC1FFFFF],       // 172.16.0.0/12
  [0xA9FE0000, 0xA9FEFFFF],       // 169.254.0.0/16 (link-local)
  [0xC0A80000, 0xC0A8FFFF],       // 192.168.0.0/16
  [0x64400000, 0x647FFFFF],       // 100.64.0.0/10 (CGNAT)
  [0xE0000000, 0xEFFFFFFF],       // 224.0.0.0/4 (multicast)
  [0xC6120000, 0xC613FFFF],       // 198.18.0.0/15 (benchmark)
];

/**
 * Parse an IPv4 string like "192.168.1.1" into a 32-bit number, or null if invalid.
 */
function parseIPv4(ip: string): number | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (parts.some((p) => p > 255 || isNaN(p))) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Check if an IPv4 address falls within any private/reserved range.
 */
function isPrivateIPv4(ip: string): boolean {
  const num = parseIPv4(ip);
  if (num === null) return true; // If we can't parse, reject
  return PRIVATE_V4_RANGES.some(([start, end]) => num >= start && num <= end);
}

/**
 * Parse a simple IPv6 string into 8 x 16-bit parts (expanded).
 * Handles :: compression. Returns null if invalid.
 */
function parseIPv6(ip: string): number[] | null {
  if (!ip.includes(':')) return null;
  const parts = ip.split(':');
  if (parts.length < 2 || parts.length > 8) return null;

  const expanded: string[] = [];
  const doubleColon = ip.indexOf('::');
  if (doubleColon !== -1) {
    const left = ip.slice(0, doubleColon).split(':').filter(Boolean);
    const right = ip.slice(doubleColon + 2).split(':').filter(Boolean);
    const missing = 8 - left.length - right.length;
    if (missing < 0) return null;
    expanded.push(...left, ...Array(missing).fill('0'), ...right);
  } else {
    if (parts.length !== 8) return null;
    expanded.push(...parts);
  }

  return expanded.map((p) => {
    const v = parseInt(p, 16);
    return isNaN(v) || v < 0 || v > 0xffff ? -1 : v;
  });
}

/** IPv6 private prefixes: first N 16-bit words to match */
const PRIVATE_V6_PREFIXES: Array<{ words: number[] }> = [
  { words: [0, 0, 0, 0, 0, 0, 0, 1] },           // ::1 (loopback)
  { words: [0xfe80] },                             // fe80::/10 (link-local)
  { words: [0xfc00] },                             // fc00::/7 (unique-local)
  { words: [0xff00] },                             // ff00::/8 (multicast)
  { words: [0, 0, 0, 0, 0, 0xffff] },             // ::ffff:x.x.x.x (IPv4-mapped — check IPv4 part separately)
];

function isPrivateIPv6(ip: string): boolean {
  const words = parseIPv6(ip);
  if (!words || words.some((w) => w < 0)) return true; // Can't parse = reject

  for (const prefix of PRIVATE_V6_PREFIXES) {
    if (words.length < prefix.words.length) continue;
    let match = true;
    for (let i = 0; i < prefix.words.length; i++) {
      if (words[i] !== prefix.words[i]) { match = false; break; }
    }
    if (match) return true;
  }
  return false;
}

/**
 * Check if an IP address (v4 or v6 string) is private/reserved.
 */
function isPrivateIP(ip: string): boolean {
  // Detect IPv4-mapped IPv6 like ::ffff:192.168.1.1
  const v4InV6 = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (v4InV6) return isPrivateIPv4(v4InV6[1]);

  if (ip.includes(':')) return isPrivateIPv6(ip);
  return isPrivateIPv4(ip);
}

/**
 * Extract hostname from a URL string safely.
 */
export function safeHostname(urlStr: string): string | null {
  try {
    if (!/^https?:\/\//i.test(urlStr)) return null;
    const url = new URL(urlStr);
    return url.hostname;
  } catch {
    return null;
  }
}

/**
 * Check if a URL's hostname resolves to a private/reserved IP.
 * This uses DNS resolution — only call server-side.
 */
export type DnsResolver = (hostname: string) => Promise<string[]>;

async function systemDnsResolver(hostname: string): Promise<string[]> {
  const { default: dns } = await import('dns');
  const { promisify } = await import('util');
  const resolve4 = promisify(dns.resolve4);
  const resolve6 = promisify(dns.resolve6);
  const results: string[] = [];
  try { results.push(...await resolve4(hostname)); } catch { /* no IPv4 */ }
  try { results.push(...await resolve6(hostname)); } catch { /* no IPv6 */ }
  return results;
}

export async function isPrivateUrl(urlStr: string, resolver: DnsResolver = systemDnsResolver): Promise<boolean> {
  const hostname = safeHostname(urlStr);
  if (!hostname) return true;

  // Quick check: if hostname is already an IP
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return isPrivateIPv4(hostname);
  }
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return isPrivateIPv6(hostname.slice(1, -1));
  }
  // Raw IPv6 without brackets
  if (hostname.includes(':')) {
    return isPrivateIPv6(hostname);
  }

  // Resolve DNS through an injectable resolver so security tests stay deterministic.
  try {
    const results = await resolver(hostname);
    if (results.length === 0) return true; // Can't resolve = reject
    return results.some((ip) => isPrivateIP(ip));
  } catch {
    return true; // DNS error = reject
  }
}

/**
 * Validate that a URL belongs to an allowed domain list.
 * If `allowedDomains` is empty, all public domains are allowed.
 * Supports subdomain matching (e.g. "daraz.pk" allows "www.daraz.pk").
 */
export function isDomainAllowed(urlStr: string, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) return true;
  const hostname = safeHostname(urlStr);
  if (!hostname) return false;
  const lowerHost = hostname.toLowerCase();
  return allowedDomains.some((d) => {
    const lower = d.toLowerCase().replace(/^\./, '');
    return lowerHost === lower || lowerHost.endsWith('.' + lower);
  });
}

/**
 * Full SSRF validation: checks protocol, domain allowlist, and private IP.
 * Returns { safe: true } or { safe: false, reason: string }.
 */
export async function validateUrlForFetch(
  urlStr: string,
  allowedDomains: string[] = [],
  resolver?: DnsResolver,
): Promise<{ safe: boolean; reason?: string }> {
  if (!/^https?:\/\//i.test(urlStr)) {
    return { safe: false, reason: 'Only HTTP(S) URLs are allowed' };
  }

  if (!isDomainAllowed(urlStr, allowedDomains)) {
    return { safe: false, reason: 'Domain not in allowed list' };
  }

  if (await isPrivateUrl(urlStr, resolver)) {
    return { safe: false, reason: 'URL resolves to a private or reserved IP address' };
  }

  return { safe: true };
}