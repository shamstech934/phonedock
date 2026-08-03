import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { extractRetailPrice } from '../../src/lib/price-extraction';

const root = path.resolve(import.meta.dirname, '../..');
const handler = fs.readFileSync(path.join(root, 'src/app/api/[[...path]]/handlers/price-tracker.ts'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'src/app/admin/price-tracker/page.tsx'), 'utf8');

const result = extractRetailPrice(`<script type="application/ld+json">{"@type":"Product","offers":{"@type":"Offer","priceCurrency":"PKR","price":"364999"}}</script>`);
assert.equal(result?.price, 364999);
assert.equal(result?.confidence, 0.98);
assert.ok((result?.confidence || 0) >= 0.70);

assert.match(handler, /MIN_TRUST_CONFIDENCE = 0\.70/);
assert.match(handler, /Wrong domain\. Use a real product page from/);
assert.match(handler, /extractionConfidence >= MIN_TRUST_CONFIDENCE/);
assert.match(handler, /error: safeToEnable \? null : validationError/);
assert.match(ui, /Math\.round\(Math\.max\(0, Math\.min\(1, sourceTestResult\.extractionConfidence/);
assert.match(ui, /Reliable PKR price detected\. This source is trusted and ready for tracking\./);
assert.doesNotMatch(ui, /if \(!test\.safeToEnable\) throw new Error/);

console.log('Price source trust v2.3.2 checks passed');
