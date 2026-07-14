/**
 * Shared MongoDB Environment & Connection Utilities — PhoneDock
 *
 * Used by: application (mongodb.ts), CLI scripts, db:check, tests
 *
 * ENV LOADING ORDER (existing process env wins):
 *   1. process.env (already set — e.g. by Vercel, shell export)
 *   2. .env.local
 *   3. .env
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
import dns from 'dns/promises';

// ============ ENV LOADING ============

let _envLoaded = false;

export function loadScriptEnv(): void {
  if (_envLoaded) return;
  _envLoaded = true;
  // .env.local takes precedence over .env when not already in process.env
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  dotenv.config();
}

// ============ URI VALIDATION ============

export interface UriValidationResult {
  valid: boolean;
  error?: string;
  /** Masked for display — e.g. "mongodb+srv://***.mongodb.net/phonedock" */
  masked: string;
  protocol: string;
  hostname: string;
  database: string;
}

const PLACEHOLDER_PATTERNS = [
  /xxxxx/i, /username/, /password/i, /cluster0\.example/,
  /<username>/, /<password>/, /your-/, /example\.com/,
  /test.*secret/i, /changeme/i, /placeholder/i,
];

export function validateMongoUri(uri?: string): UriValidationResult {
  const empty: UriValidationResult = {
    valid: false,
    error: 'MONGODB_URI environment variable is not set.',
    masked: '(not set)',
    protocol: '',
    hostname: '',
    database: '',
  };

  if (!uri) return empty;

  // Check protocol
  const isSrv = uri.startsWith('mongodb+srv://');
  const isStandard = uri.startsWith('mongodb://');
  if (!isSrv && !isStandard) {
    return {
      ...empty,
      error: `MONGODB_URI must start with "mongodb://" or "mongodb+srv://". Found: "${uri.slice(0, 20)}..."`,
    };
  }

  // Reject placeholders
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(uri)) {
      return {
        ...empty,
        error: 'MONGODB_URI appears to contain a placeholder value. Copy the full connection string from MongoDB Atlas > Connect > Drivers.',
      };
    }
  }

  // Parse
  let protocol: string;
  let authAndHost: string;
  let rest: string;

  if (isSrv) {
    protocol = 'mongodb+srv://';
    const afterProtocol = uri.slice(protocol.length);
    const slashIdx = afterProtocol.indexOf('/');
    authAndHost = slashIdx === -1 ? afterProtocol : afterProtocol.slice(0, slashIdx);
    rest = slashIdx === -1 ? '' : afterProtocol.slice(slashIdx + 1);
  } else {
    protocol = 'mongodb://';
    const afterProtocol = uri.slice(protocol.length);
    const slashIdx = afterProtocol.indexOf('/');
    authAndHost = slashIdx === -1 ? afterProtocol : afterProtocol.slice(0, slashIdx);
    rest = slashIdx === -1 ? '' : afterProtocol.slice(slashIdx + 1);
  }

  // Extract host (strip auth)
  let hostname = authAndHost;
  const atIdx = authAndHost.lastIndexOf('@');
  if (atIdx !== -1) {
    hostname = authAndHost.slice(atIdx + 1);
  }

  // Strip query params from hostname
  const qIdx = hostname.indexOf('?');
  if (qIdx !== -1) {
    hostname = hostname.slice(0, qIdx);
  }

  // Extract database name
  let database = 'phonedock'; // safe default
  const hashIdx = rest.indexOf('#');
  const queryIdx2 = rest.indexOf('?');
  const dbPart = hashIdx !== -1
    ? rest.slice(0, hashIdx)
    : queryIdx2 !== -1
      ? rest.slice(0, queryIdx2)
      : rest;
  if (dbPart.trim().length > 0) {
    database = dbPart.trim();
  }

  // Mask the URI for display
  // Format: mongodb+srv://***.mongodb.net/phonedock
  const hostForMask = hostname.split(',')[0]; // first host only
  const masked = `${protocol}***${hostForMask.includes('.') ? '.' + hostForMask.split('.').slice(-2).join('.') : ''}/${database}`;

  if (!hostname) {
    return {
      valid: false,
      error: 'MONGODB_URI has no hostname. Check the connection string from MongoDB Atlas.',
      masked,
      protocol,
      hostname: '',
      database,
    };
  }

  return { valid: true, masked, protocol, hostname, database };
}

// ============ ERROR CLASSIFICATION ============

export interface ClassifiedError {
  category: 'DNS_FAILURE' | 'CONNECTION_REFUSED' | 'AUTH_FAILURE' | 'IP_NOT_ALLOWED' | 'TIMEOUT' | 'MALFORMED_URI' | 'MISSING_ENV' | 'QUERY_SRV' | 'UNKNOWN';
  message: string;
  guidance: string[];
}

export function classifyMongoError(error: Error, uriInfo: UriValidationResult): ClassifiedError {
  const msg = error.message || '';
  const code = (error as any).code;

  // querySrv ECONNREFUSED
  if (msg.includes('querySrv') && msg.includes('ECONNREFUSED')) {
    return {
      category: 'QUERY_SRV',
      message: `DNS SRV lookup failed for "${uriInfo.hostname}". Your computer cannot resolve the Atlas cluster DNS record.`,
      guidance: [
        'Verify the URI was copied exactly from MongoDB Atlas > Connect > Drivers.',
        'Verify Atlas "Database Access" has a user with the correct password.',
        'Verify Atlas "Network Access" allows your current IP (or 0.0.0.0/0 for any IP).',
        'Try a different DNS provider (e.g. 8.8.8.8) or a mobile hotspot.',
        `Run: nslookup -type=SRV _mongodb._tcp.${uriInfo.hostname}`,
        'Confirm the Atlas cluster is active (not paused).',
      ],
    };
  }

  // ENOTFOUND
  if (code === 'ENOTFOUND' || msg.includes('ENOTFOUND')) {
    return {
      category: 'DNS_FAILURE',
      message: `DNS could not resolve hostname in "${uriInfo.masked}".`,
      guidance: [
        'Check your internet connection.',
        'Verify the hostname in MONGODB_URI is correct (copy from Atlas > Connect > Drivers).',
        `Run: nslookup -type=SRV _mongodb._tcp.${uriInfo.hostname}`,
        'Try flushing DNS: ipconfig /flushdns (Windows) or sudo systemd-resolve --flush-caches (Linux)',
        'Try a different network or DNS server (8.8.8.8).',
      ],
    };
  }

  // ECONNREFUSED (non-SRV)
  if (code === 'ECONNREFUSED' || msg.includes('ECONNREFUSED')) {
    return {
      category: 'CONNECTION_REFUSED',
      message: `Connection refused by host in "${uriInfo.masked}".`,
      guidance: [
        'Verify the cluster is running (not paused) in MongoDB Atlas.',
        'Check if a firewall or proxy is blocking the connection.',
        'If using a non-SRV connection string, verify the host and port are correct.',
        'Try connecting from a different network.',
      ],
    };
  }

  // Authentication failure
  if (msg.includes('Authentication failed') || msg.includes('auth failed') || code === 18) {
    return {
      category: 'AUTH_FAILURE',
      message: `Authentication failed for "${uriInfo.masked}". The username or password is incorrect.`,
      guidance: [
        'Go to MongoDB Atlas > Database Access > Edit the user.',
        'Verify the username and password match exactly.',
        'Re-copy the full connection string from Atlas > Connect > Drivers.',
        'Atlas usernames and passwords are case-sensitive.',
        'If you recently changed the password, make sure to update MONGODB_URI.',
      ],
    };
  }

  // IP not allowed
  if (msg.includes('IP is not allowed') || msg.includes('unauthorized') || code === 8000) {
    return {
      category: 'IP_NOT_ALLOWED',
      message: `Your IP address is not in the Atlas access list for "${uriInfo.masked}".`,
      guidance: [
        'Go to MongoDB Atlas > Network Access.',
        'Add your current IP address, or add 0.0.0.0/0 to allow all IPs (less secure).',
        'If using Vercel, add Vercel\'s IP ranges or use 0.0.0.0/0.',
        'Note: IP changes may take 1-2 minutes to propagate.',
      ],
    };
  }

  // Timeout
  if (msg.includes('timed out') || msg.includes('timeout') || msg.includes('server selection timeout')) {
    return {
      category: 'TIMEOUT',
      message: `Connection timed out for "${uriInfo.masked}".`,
      guidance: [
        'Check your internet connection speed and stability.',
        'Verify the Atlas cluster is not paused.',
        'If the cluster is in a distant region, latency may cause timeouts.',
        'Try connecting from a different network.',
      ],
    };
  }

  // Malformed URI
  if (msg.includes('Invalid URI') || msg.includes('malformed') || msg.includes('parse error')) {
    return {
      category: 'MALFORMED_URI',
      message: `The connection string in MONGODB_URI is malformed.`,
      guidance: [
        'Re-copy the full connection string from MongoDB Atlas > Connect > Drivers.',
        'Ensure there are no extra spaces or line breaks in the URI.',
        'The URI must start with mongodb:// or mongodb+srv://',
      ],
    };
  }

  // Unknown
  return {
    category: 'UNKNOWN',
    message: `Unexpected MongoDB error for "${uriInfo.masked}": ${msg.slice(0, 200)}`,
    guidance: [
      'Check the full error message above.',
      'Search for this error at https://www.mongodb.com/docs/drivers/node/',
      'Verify your MONGODB_URI, Atlas credentials, and network access.',
    ],
  };
}

// ============ DNS DIAGNOSTICS ============

export interface DnsResult {
  success: boolean;
  message: string;
  windowsCommand?: string;
}

export async function checkDns(hostname: string, isSrv: boolean): Promise<DnsResult> {
  if (isSrv) {
    const srvRecord = `_mongodb._tcp.${hostname}`;
    try {
      const result = await dns.resolveSrv(srvRecord);
      if (result.length === 0) {
        return {
          success: false,
          message: `SRV lookup for "${srvRecord}" returned zero records.`,
          windowsCommand: `nslookup -type=SRV ${srvRecord}`,
        };
      }
      const targets = result.map(r => `${r.name}:${r.port}`).join(', ');
      return {
        success: true,
        message: `SRV resolved to ${result.length} host(s): ${targets}`,
        windowsCommand: `nslookup -type=SRV ${srvRecord}`,
      };
    } catch (e: any) {
      return {
        success: false,
        message: `SRV lookup for "${srvRecord}" failed: ${e.code || e.message}`,
        windowsCommand: `nslookup -type=SRV ${srvRecord}`,
      };
    }
  } else {
    try {
      const result = await dns.resolve4(hostname.split(':')[0]);
      return {
        success: true,
        message: `Hostname "${hostname}" resolved to: ${result.join(', ')}`,
        windowsCommand: `nslookup ${hostname.split(':')[0]}`,
      };
    } catch (e: any) {
      return {
        success: false,
        message: `DNS lookup for "${hostname}" failed: ${e.code || e.message}`,
        windowsCommand: `nslookup ${hostname.split(':')[0]}`,
      };
    }
  }
}

// ============ SAFE CONNECTION TEST ============

export async function testConnection(uri: string): Promise<{ success: boolean; message: string; database: string }> {
  const mongoose = await import('mongoose');
  try {
    await mongoose.connect(uri, {
      maxPoolSize: 2,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 15000,
    });
    const db = mongoose.connection.db;
    const dbName = db?.databaseName || 'unknown';
    // Ping — read-only
    const result = await db!.command({ ping: 1 });
    await mongoose.disconnect();
    if (result.ok === 1) {
      return { success: true, message: 'Ping successful.', database: dbName };
    }
    await mongoose.disconnect();
    return { success: false, message: 'Ping returned unexpected result.', database: dbName };
  } catch (e: any) {
    try { await mongoose.disconnect(); } catch {}
    return { success: false, message: e.message || String(e), database: '' };
  }
}