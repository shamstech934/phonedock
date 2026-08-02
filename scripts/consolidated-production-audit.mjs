import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'src/lib/client/api-response.ts',
  'src/app/api/[[...path]]/handlers/import-v2.ts',
  'src/app/api/[[...path]]/handlers/price-intelligence-v2.ts',
  'src/app/api/[[...path]]/handlers/automation-pipeline.ts',
  'src/app/api/[[...path]]/route.ts',
  'src/app/sitemap.xml/route.ts',
  'src/app/robots.ts',
  'public/BingSiteAuth.xml',
];
const missing = required.filter((item) => !fs.existsSync(path.join(root, item)));
const apiReader = fs.readFileSync(path.join(root, 'src/lib/client/api-response.ts'), 'utf8');
const failures = [];
if (missing.length) failures.push(`Missing required files: ${missing.join(', ')}`);
if (!apiReader.includes("contentType.includes('+json')")) failures.push('API reader does not support +json content types.');
if (!apiReader.includes('response.text()')) failures.push('API reader does not safely inspect raw response bodies.');
if (!apiReader.includes('malformed JSON')) failures.push('Malformed JSON fallback is missing.');
console.log(JSON.stringify({ required: required.length, missing, failures, status: failures.length ? 'failed' : 'passed' }, null, 2));
if (failures.length) process.exit(1);
