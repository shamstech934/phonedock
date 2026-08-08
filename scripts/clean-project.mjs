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
  '.zscripts',
  '.npm-cache',
  'audit-output',
  'e2e-server.err',
  'e2e-server.out',
];

for (const path of generatedPaths) {
  await rm(path, { recursive: true, force: true });
  console.log(`Removed: ${path}`);
}

console.log('PhoneDock project cleaned. Run npm ci before local development.');
