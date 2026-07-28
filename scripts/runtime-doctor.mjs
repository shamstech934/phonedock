import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const major = Number.parseInt(process.versions.node.split('.')[0], 10);
const supportedMajors = new Set([22, 24]);

if (!supportedMajors.has(major)) {
  console.error(
    `PhoneDock supports Node.js 22.x and 24.x LTS. Current runtime: ${process.version}. ` +
    'Switch to Node 22 or Node 24 before running npm ci or production builds.',
  );
  process.exit(1);
}

const requiredPackages = ['exceljs', 'jszip', 'sanitize-html', 'tsx'];
const missingPackages = requiredPackages.filter(packageName => {
  try {
    require.resolve(`${packageName}/package.json`);
    return false;
  } catch {
    return true;
  }
});

if (missingPackages.length > 0) {
  console.error(
    `Dependency installation is incomplete. Missing: ${missingPackages.join(', ')}. ` +
    'Run "npm ci" from the repository root.',
  );
  process.exit(1);
}

console.log(`PhoneDock runtime is healthy (Node ${process.version}, npm dependencies installed).`);
console.log(`Declared Node engine: ${packageJson.engines?.node || 'not set'}`);
