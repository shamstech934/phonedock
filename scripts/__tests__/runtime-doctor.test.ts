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
assert.match(source, /typescript\/bin\/tsc/, 'runtime doctor must verify the TypeScript executable');
assert.match(source, /eslint\/bin\/eslint\.js/, 'runtime doctor must verify the ESLint executable');
assert.match(source, /tsx\/dist\/cli\.mjs/, 'runtime doctor must verify the TSX executable');
assert.match(source, /next\/dist\/bin\/next/, 'runtime doctor must verify the Next.js executable');
assert.match(source, /Close running Next\.js\/dev terminals/, 'runtime doctor must explain Windows file-lock recovery');
assert.match(source, /npm cache verify/, 'runtime doctor must provide cache verification recovery');
assert.match(source, /npm ci/, 'runtime doctor must recommend deterministic installation');

console.log('runtime-doctor: all assertions passed');
