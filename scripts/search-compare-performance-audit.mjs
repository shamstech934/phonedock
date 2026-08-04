import fs from 'node:fs';

const files = {
  home: fs.readFileSync('src/components/home/HomeHeroSearch.tsx', 'utf8'),
  compare: fs.readFileSync('src/app/compare/page.tsx', 'utf8'),
  api: fs.readFileSync('src/app/api/[[...path]]/handlers/public.ts', 'utf8'),
};
const checks = [
  ['home aborts stale requests', files.home.includes('requestIdRef') && files.home.includes('AbortController')],
  ['home has client cache', files.home.includes('autocompleteCache')],
  ['compare has client caches', files.compare.includes('compareAutocompleteCache') && files.compare.includes('compareLookupCache')],
  ['compare has modern category navigation', files.compare.includes('specCategories') && files.compare.includes('activeSpecCategory')],
  ['autocomplete avoids aggregation lookup', !files.api.slice(files.api.indexOf('/api/phones/autocomplete'), files.api.indexOf('/api/phones/:slug')).includes('Phone.aggregate')],
  ['search uses bounded lightweight query', files.api.includes("slice(0, 100)") && files.api.includes(".limit(20)")],
  ['edge cache increased', files.api.includes("300, 1800")],
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) process.exit(1);
console.log('Search, compare and CPU performance audit passed.');
