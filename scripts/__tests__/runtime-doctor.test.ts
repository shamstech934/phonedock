import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'scripts/runtime-doctor.mjs'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as {
  packageManager?: string;
};
const nvmVersion = fs.readFileSync(path.join(process.cwd(), '.nvmrc'), 'utf8').trim();
const nodeVersion = fs.readFileSync(path.join(process.cwd(), '.node-version'), 'utf8').trim();

assert.match(source, /supportedMajors = new Set\(\[22, 24\]\)/, 'runtime doctor must enforce supported Node LTS majors');
assert.equal(nvmVersion, '24', '.nvmrc must match the Vercel production Node major');
assert.equal(nodeVersion, '24', '.node-version must match the Vercel production Node major');
assert.equal(packageJson.packageManager, 'npm@11.16.0', 'npm version must be pinned for reproducible installs');
assert.match(source, /\['TypeScript', 'typescript'\]/, 'runtime doctor must verify TypeScript through its public entry point');
assert.match(source, /\['ESLint', 'eslint'\]/, 'runtime doctor must verify ESLint through its public entry point');
assert.match(source, /\['TSX', 'tsx'\]/, 'runtime doctor must verify TSX through its public entry point');
assert.match(source, /\['Next\.js', 'next'\]/, 'runtime doctor must verify Next.js through its public entry point');
assert.match(source, /Close running Next\.js\/dev terminals/, 'runtime doctor must explain Windows file-lock recovery');
assert.match(source, /npm cache verify/, 'runtime doctor must provide cache verification recovery');
assert.match(source, /npm ci/, 'runtime doctor must recommend deterministic installation');

console.log('runtime-doctor: all assertions passed');
