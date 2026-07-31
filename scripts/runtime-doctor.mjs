import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const major = Number.parseInt(process.versions.node.split('.')[0], 10);
const supportedMajors = new Set([22, 24]);

if (!supportedMajors.has(major)) {
  console.error(
    `SpecsDekh supports Node.js 22.x and 24.x LTS. Current runtime: ${process.version}. ` +
    'Switch to Node 22 or Node 24 before running npm ci or production builds.',
  );
  process.exit(1);
}

function resolvePackageJson(packageName) {
  try {
    return require.resolve(`${packageName}/package.json`);
  } catch {
    return null;
  }
}

const requiredPackages = ['exceljs', 'jszip', 'sanitize-html', 'tsx'];
const missingPackages = requiredPackages.filter(packageName => !resolvePackageJson(packageName));

if (missingPackages.length > 0) {
  console.error(
    `Dependency installation is incomplete. Missing: ${missingPackages.join(', ')}. ` +
    'Run "npm ci --include=dev" from the repository root.',
  );
  process.exit(1);
}

/**
 * Verify a package's executable without resolving private package subpaths.
 * Modern packages such as ESLint and TSX use the package "exports" field,
 * which can intentionally block require.resolve('package/internal/bin').
 * Reading the public package.json and checking its declared bin target is
 * reliable across npm, GitHub Actions, Windows and Linux.
 */
function hasRunnableBin(packageName, preferredBinName) {
  const packageJsonPath = resolvePackageJson(packageName);
  if (!packageJsonPath) return false;

  try {
    const manifest = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const bin = manifest.bin;
    let relativeBin;

    if (typeof bin === 'string') {
      relativeBin = bin;
    } else if (bin && typeof bin === 'object') {
      relativeBin = bin[preferredBinName] || Object.values(bin)[0];
    }

    if (!relativeBin || typeof relativeBin !== 'string') return false;
    return existsSync(resolve(dirname(packageJsonPath), relativeBin));
  } catch {
    return false;
  }
}

const requiredTools = [
  ['TypeScript', 'typescript', 'tsc'],
  ['ESLint', 'eslint', 'eslint'],
  ['TSX', 'tsx', 'tsx'],
  ['Next.js', 'next', 'next'],
];

const missingTools = requiredTools
  .filter(([, packageName, binName]) => !hasRunnableBin(packageName, binName))
  .map(([label]) => label);

if (missingTools.length > 0) {
  console.error(`Dependency installation is incomplete. Missing runnable tools: ${missingTools.join(', ')}.`);
  console.error('Run the following from the repository root:');
  if (process.platform === 'win32') {
    console.error('  Remove-Item -Recurse -Force node_modules');
  } else {
    console.error('  rm -rf node_modules');
  }
  console.error('  npm cache verify');
  console.error('  npm ci --include=dev');
  process.exit(1);
}

console.log(`SpecsDekh runtime is healthy (Node ${process.version}, required tools installed).`);
console.log(`Declared Node engine: ${packageJson.engines?.node || 'not set'}`);
