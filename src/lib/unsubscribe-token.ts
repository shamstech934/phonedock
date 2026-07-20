import crypto from 'crypto';

function getSigningSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required to sign unsubscribe links');
    }
    return 'phonedock-local-development-only';
  }
  return secret;
}

function payload(email: string, phoneId: string): string {
  return `${email.trim().toLowerCase()}:${phoneId.trim()}`;
}

export function createUnsubscribeToken(email: string, phoneId: string): string {
  return crypto.createHmac('sha256', getSigningSecret()).update(payload(email, phoneId)).digest('hex');
}

export function verifyUnsubscribeToken(email: string, phoneId: string, token: string): boolean {
  if (!email || !phoneId || !token) return false;
  const expected = createUnsubscribeToken(email, phoneId);
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(token, 'utf8');
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}
