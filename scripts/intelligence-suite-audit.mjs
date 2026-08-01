import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'src/app/admin/specs-intelligence/page.tsx',
  'src/app/admin/price-intelligence-v2/page.tsx',
  'src/app/admin/youtube-intelligence/page.tsx',
  'src/app/api/[[...path]]/handlers/specs-intelligence.ts',
  'src/app/api/[[...path]]/handlers/price-intelligence-v2.ts',
  'src/app/api/[[...path]]/handlers/youtube-intelligence.ts',
  'src/lib/specs-intelligence.ts',
  'src/lib/price-intelligence.ts',
  'src/lib/youtube-intelligence.ts',
  'src/lib/models/SpecsIntelligenceSignal.ts',
  'src/lib/models/PriceIntelligenceSignal.ts',
  'src/lib/models/YouTubeIntelligenceSignal.ts',
];
const failures = [];
for (const rel of required) if (!fs.existsSync(path.join(root, rel))) failures.push(`Missing ${rel}`);
const route = fs.readFileSync(path.join(root, 'src/app/api/[[...path]]/route.ts'), 'utf8');
for (const slug of ['specs-intelligence','price-intelligence-v2','youtube-intelligence']) {
  if (!route.includes(`segments[1] === '${slug}'`)) failures.push(`API route not wired: ${slug}`);
}
const nav = fs.readFileSync(path.join(root, 'src/app/admin/layout.tsx'), 'utf8');
for (const href of ['/admin/specs-intelligence','/admin/price-intelligence-v2','/admin/youtube-intelligence']) {
  if (!nav.includes(href)) failures.push(`Admin navigation missing: ${href}`);
}
const unsafePatterns = [
  ['automatic publishing', /status\s*=\s*['"]published['"]/],
  ['unbounded scans', /limit\s*:\s*Number\([^)]*9999/],
];
for (const rel of ['src/lib/specs-intelligence.ts','src/lib/price-intelligence.ts','src/lib/youtube-intelligence.ts']) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  for (const [label, pattern] of unsafePatterns) if (pattern.test(text)) failures.push(`${label} detected in ${rel}`);
}
const report = {
  generatedAt: new Date().toISOString(),
  suite: 'Specs Intelligence + Price Intelligence V2 + YouTube Intelligence + Final Production Audit',
  requiredFiles: required.length,
  adminRoutes: 3,
  apiModules: 3,
  reviewOnly: true,
  boundedScans: true,
  failures,
  status: failures.length ? 'failed' : 'passed',
};
fs.mkdirSync(path.join(root, 'audit-output'), { recursive: true });
fs.writeFileSync(path.join(root, 'audit-output/intelligence-suite-audit.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
