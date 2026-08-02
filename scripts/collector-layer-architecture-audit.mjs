import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'src/lib/collectors/parsers/types.ts',
  'src/lib/collectors/parsers/html-utils.ts',
  'src/lib/collectors/parsers/generic-parser.ts',
  'src/lib/collectors/parsers/samsung-parser.ts',
  'src/lib/collectors/parsers/registry.ts',
  'src/lib/collectors/providers/manual-url-provider.ts',
  'src/lib/collectors/providers/manufacturer-provider.ts',
];
const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error('Collector layer audit failed. Missing:', missing.join(', '));
  process.exit(1);
}
const manual = fs.readFileSync(path.join(root, 'src/lib/collectors/providers/manual-url-provider.ts'), 'utf8');
const registry = fs.readFileSync(path.join(root, 'src/lib/collectors/parsers/registry.ts'), 'utf8');
const checks = {
  registry: /getManufacturerParser/.test(manual) && /GenericManufacturerParser/.test(registry),
  boundedProductCrawl: /maxProductPages/.test(manual) && /slice\(0, productPageLimit\)/.test(manual),
  provenance: /sourceUrl/.test(manual),
  genericFallback: /plugins\[plugins\.length - 1\]/.test(registry),
  noAiDependency: !/openai|anthropic|gemini|tavily/i.test(manual + registry),
};
const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error('Collector layer audit failed:', failed.join(', '));
  process.exit(1);
}
console.log('Collector layer audit passed:', checks);
