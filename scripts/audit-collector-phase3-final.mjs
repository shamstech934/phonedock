import fs from 'node:fs';
const base = fs.readFileSync('src/lib/collectors/providers/base.ts','utf8');
const handler = fs.readFileSync('src/app/api/[[...path]]/handlers/collector.ts','utf8');
const checks = [
  ['collector fetch does not instantiate Headers', !base.includes('const requestHeaders = new Headers()')],
  ['collector request headers are plain string record', base.includes('const requestHeaders: Record<string, string> = {}')],
  ['non-api source headers are discarded on create', handler.includes("const safeHeaders = normalizedType === 'api'")],
  ['retry repairs source headers before run', handler.includes('source.headers = new Map(Object.entries(safeHeaders))')],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`); if (!ok) failed++; }
if (failed) process.exit(1);
console.log(`Collector Phase 3 final audit: ${checks.length}/${checks.length} passed`);
