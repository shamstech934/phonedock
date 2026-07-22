import { Types } from 'mongoose';

export interface CursorValue { createdAt: Date; id: Types.ObjectId }

export function encodeCursor(value: { createdAt: Date | string; id: string }) {
  return Buffer.from(JSON.stringify({ createdAt: new Date(value.createdAt).toISOString(), id: value.id }), 'utf8').toString('base64url');
}

export function decodeCursor(value?: string | null): CursorValue | null {
  if (!value || value.length > 512) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as { createdAt?: unknown; id?: unknown };
    const createdAt = new Date(String(parsed.createdAt));
    if (!Number.isFinite(createdAt.getTime()) || typeof parsed.id !== 'string' || !Types.ObjectId.isValid(parsed.id)) return null;
    return { createdAt, id: new Types.ObjectId(parsed.id) };
  } catch { return null; }
}

export function cursorFilter(cursor: CursorValue | null, direction: 'next' | 'previous' = 'next') {
  if (!cursor) return {};
  const operator = direction === 'next' ? '$lt' : '$gt';
  return { $or: [{ createdAt: { [operator]: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { [operator]: cursor.id } }] };
}

export const CURSOR_SORT = { createdAt: -1 as const, _id: -1 as const };
