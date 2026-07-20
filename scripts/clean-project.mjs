import { rm } from 'node:fs/promises';

const generatedPaths = [
  'node_modules',
  '.next',
  'out',
  'coverage',
  'playwright-report',
  'test-results',
  'blob-report',
  'dev.log',
  'build-output.txt',
  'tsconfig.tsbuildinfo',
  '.zscripts/dev.pid',
];

for (const path of generatedPaths) {
  await rm(path, { recursive: true, force: true });
  console.log(`Removed: ${path}`);
}

console.log('PhoneDock project cleaned. Run npm ci before local development.');
