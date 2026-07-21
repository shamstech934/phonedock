import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { RateLimit } from '@/lib/models';
import { checkIpRateLimit } from '@/lib/auth';
import { recordSecurityEvent } from '@/lib/security-events';

export function getRequestSecurityContext(req: NextRequest) {
  return {
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown',
    userAgent: req.headers.get('user-agent') || '',
  };
}

export async function enforceUserAuthRateLimit(input: {
  action: 'login' | 'signup';
  email: string;
  ip: string;
  userAgent: string;
}): Promise<boolean> {
  const emailKey = crypto.createHash('sha256').update(input.email).digest('hex').slice(0, 24);
  const isLogin = input.action === 'login';
  const windowMs = isLogin ? 15 * 60 * 1000 : 60 * 60 * 1000;
  const [ipAllowed, accountAllowed] = await Promise.all([
    checkIpRateLimit(`user-${input.action}:ip:${input.ip}`, isLogin ? 15 : 8, windowMs, RateLimit),
    checkIpRateLimit(`user-${input.action}:account:${emailKey}`, isLogin ? 6 : 3, windowMs, RateLimit),
  ]);
  if (!ipAllowed || !accountAllowed) {
    await recordSecurityEvent({
      action: `user_${input.action}_rate_limited`,
      ip: input.ip,
      userAgent: input.userAgent,
      reason: 'rate_limit',
    });
    return false;
  }
  return true;
}
