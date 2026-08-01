import fs from 'node:fs';
const file = 'src/lib/import/import-v2-engine.ts';
const src = fs.readFileSync(file, 'utf8');
const checks = [
  ['variant identity helper', /function getVariantIdentity/],
  ['strict incoming variant match', /!incomingVariant \? true : Boolean\(existingVariant && incomingVariant === existingVariant\)/],
  ['unambiguous identity matching', /identityCandidates\.length === 1/],
  ['variant-safe slug generation', /effectiveSlug = `\$\{d\.slug\}-\$\{suffix/],
  ['create action reason', /No exact brand \+ normalized model match found; creating a new phone/],
];
let failed = 0;
for (const [name, pattern] of checks) {
  if (!pattern.test(src)) { console.error(`FAIL: ${name}`); failed++; }
  else console.log(`PASS: ${name}`);
}
if (failed) process.exit(1);
