export type NumericSpecKind = 'ram' | 'storage' | 'screen' | 'camera' | 'battery';

const RAM_VALUES = [1, 2, 3, 4, 6, 8, 10, 12, 16, 18, 24, 32, 48, 64];
const STORAGE_VALUES = [8, 16, 32, 64, 128, 256, 512, 1024, 2048];
const CAMERA_VALUES = [2, 3, 5, 8, 12, 13, 16, 20, 24, 32, 40, 48, 50, 64, 100, 108, 150, 200];
const BATTERY_VALUES = [2000, 2500, 3000, 3500, 4000, 4500, 4800, 4900, 5000, 5100, 5200, 5300, 5400, 5500, 5600, 5700, 5800, 5900, 6000, 6200, 6500, 7000, 7500, 8000, 9000, 10000];
const SCREEN_VALUES = Array.from({ length: 71 }, (_, index) => Number((2 + index * 0.1).toFixed(1)));

function valuesFor(kind: NumericSpecKind): number[] {
  if (kind === 'ram') return RAM_VALUES;
  if (kind === 'storage') return STORAGE_VALUES;
  if (kind === 'camera') return CAMERA_VALUES;
  if (kind === 'battery') return BATTERY_VALUES;
  return SCREEN_VALUES;
}

function escapeNumber(value: number): string {
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return text.replace('.', '\\.');
}

function legacyRegex(kind: NumericSpecKind, min?: number, max?: number): RegExp {
  const values = valuesFor(kind).filter(value =>
    (min === undefined || value >= min) && (max === undefined || value <= max),
  );

  if (!values.length) return /a^/i;
  const alternatives = values.map(escapeNumber).join('|');

  if (kind === 'screen') {
    return new RegExp(`(?:^|[^0-9])(?:${alternatives})\\s*(?:inch(?:es)?|in\\b|[\"”])`, 'i');
  }
  if (kind === 'camera') {
    return new RegExp(`(?:^|[^0-9])(?:${alternatives})\\s*mp\\b`, 'i');
  }
  if (kind === 'battery') {
    return new RegExp(`(?:^|[^0-9])(?:${alternatives})\\s*m?ah\\b`, 'i');
  }
  if (kind === 'storage') {
    const tb: string[] = [];
    if ((min === undefined || 1024 >= min) && (max === undefined || 1024 <= max)) tb.push('1\\s*tb\\b');
    if ((min === undefined || 2048 >= min) && (max === undefined || 2048 <= max)) tb.push('2\\s*tb\\b');
    const gb = `(?:^|[^0-9])(?:${alternatives})\\s*gb\\b`;
    return new RegExp(tb.length ? `(?:${gb}|${tb.join('|')})` : gb, 'i');
  }
  return new RegExp(`(?:^|[^0-9])(?:${alternatives})\\s*gb\\b`, 'i');
}

export function numericSpecClause(options: {
  numericField: string;
  textField: string;
  kind: NumericSpecKind;
  min?: number;
  max?: number;
}): Record<string, unknown> {
  const range: Record<string, number> = {};
  if (options.min !== undefined) range.$gte = options.min;
  if (options.max !== undefined) range.$lte = options.max;

  return {
    $or: [
      { [options.numericField]: range },
      { [options.textField]: { $regex: legacyRegex(options.kind, options.min, options.max) } },
    ],
  };
}
