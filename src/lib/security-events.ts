import crypto from 'crypto';
import { ActivityLog } from '@/lib/models';

/**
 * Store useful security telemetry without persisting raw credentials, email
 * addresses, session tokens, or full IP addresses in activity details.
 */
function fingerprint(value: string): string {
  if (!value) return 'unknown';
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function clean(value: string, max = 120): string {
  return value.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export interface SecurityEventInput {
  action: string;
  adminId?: string | { toString(): string };
  ip?: string;
  userAgent?: string;
  reason?: string;
}

export async function recordSecurityEvent(input: SecurityEventInput): Promise<void> {
  try {
    const details = [
      `ip=${fingerprint(input.ip || '')}`,
      `ua=${fingerprint(input.userAgent || '')}`,
      input.reason ? `reason=${clean(input.reason, 80)}` : '',
    ].filter(Boolean).join(' ');

    await ActivityLog.create({
      ...(input.adminId ? { adminId: input.adminId } : {}),
      action: clean(input.action, 64),
      details,
      entityType: 'security',
    });
  } catch (error) {
    // Security logging must never reveal secrets or break the request path.
    console.error('[SecurityEvent] Failed to persist security event:', error instanceof Error ? error.message : 'unknown error');
  }
}
