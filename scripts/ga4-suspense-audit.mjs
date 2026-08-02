import fs from 'node:fs';
const layout = fs.readFileSync('src/app/layout.tsx', 'utf8');
const growth = fs.readFileSync('src/components/monetization/GrowthScripts.tsx', 'utf8');
const checks = [
  ['Suspense imported', /import\s*\{\s*Suspense\s*\}\s*from\s*["']react["']/.test(layout)],
  ['GrowthScripts wrapped in Suspense', /<Suspense\s+fallback=\{null\}>[\s\S]*?<GrowthScripts\s*\/>[\s\S]*?<\/Suspense>/.test(layout)],
  ['GrowthScripts uses search params', /useSearchParams\(\)/.test(growth)],
];
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'}: ${name}`);
  if (!pass) process.exitCode = 1;
}
