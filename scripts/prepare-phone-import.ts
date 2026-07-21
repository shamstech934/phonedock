import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';

type RawPhone = Record<string, unknown>;
type PreparedPhone = RawPhone & {
  brand: string;
  model: string;
  slug: string;
};

function arg(name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((item) => item.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function clean(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizePhone(row: RawPhone): PreparedPhone | null {
  const brand = clean(row.brand || row.brandName || row.manufacturer);
  const model = clean(row.model || row.name || row.phoneName);
  if (!brand || !model) return null;

  const slug = clean(row.slug) || slugify(`${brand}-${model}`);
  return {
    ...row,
    brand,
    brandName: brand,
    model,
    slug,
  };
}

function readRows(inputPath: string): RawPhone[] {
  const extension = path.extname(inputPath).toLowerCase();
  const content = fs.readFileSync(inputPath, 'utf8');
  if (extension === '.json') {
    const parsed = JSON.parse(content) as unknown;
    if (Array.isArray(parsed)) return parsed as RawPhone[];
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { phones?: unknown[] }).phones)) {
      return (parsed as { phones: RawPhone[] }).phones;
    }
    throw new Error('JSON must be an array or an object containing a phones array.');
  }
  if (extension === '.csv') {
    const result = Papa.parse<RawPhone>(content, { header: true, skipEmptyLines: true });
    if (result.errors.length) {
      throw new Error(`CSV parse error: ${result.errors[0]?.message ?? 'unknown error'}`);
    }
    return result.data;
  }
  throw new Error('Only .csv and .json files are supported.');
}

function main(): void {
  const input = arg('input');
  const output = arg('output', 'data-import/output');
  const chunkSize = Number(arg('chunk-size', '500'));
  if (!input) throw new Error('Use --input=/path/to/phones.csv or .json');
  if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > 5000) {
    throw new Error('--chunk-size must be between 1 and 5000.');
  }

  const inputPath = path.resolve(input);
  const outputDir = path.resolve(output!);
  fs.mkdirSync(outputDir, { recursive: true });

  const rows = readRows(inputPath);
  const prepared: PreparedPhone[] = [];
  const invalid: Array<{ row: number; reason: string; data: RawPhone }> = [];
  const duplicates: Array<{ row: number; key: string }> = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const phone = normalizePhone(row);
    if (!phone) {
      invalid.push({ row: index + 2, reason: 'Missing brand or model', data: row });
      return;
    }
    const key = `${phone.brand.toLowerCase()}::${phone.model.toLowerCase()}`;
    if (seen.has(key)) {
      duplicates.push({ row: index + 2, key });
      return;
    }
    seen.add(key);
    prepared.push(phone);
  });

  for (let index = 0; index < prepared.length; index += chunkSize) {
    const chunk = prepared.slice(index, index + chunkSize);
    const fileName = `phones-${String(index / chunkSize + 1).padStart(3, '0')}.json`;
    fs.writeFileSync(path.join(outputDir, fileName), JSON.stringify(chunk, null, 2));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    source: inputPath,
    totalRows: rows.length,
    validUniquePhones: prepared.length,
    invalidRows: invalid.length,
    duplicateRows: duplicates.length,
    chunkSize,
    chunkFiles: Math.ceil(prepared.length / chunkSize),
    note: 'This tool prepares user-provided or properly licensed data. It does not scrape or fabricate phone records.',
  };
  fs.writeFileSync(path.join(outputDir, 'import-report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outputDir, 'invalid-rows.json'), JSON.stringify(invalid, null, 2));
  fs.writeFileSync(path.join(outputDir, 'duplicate-rows.json'), JSON.stringify(duplicates, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
