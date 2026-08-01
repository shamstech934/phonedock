import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'scripts/runtime-doctor.mjs'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  packageManager?: string;
  engines?: { node?: string };
};

const supportedNodeMajors = new Set(['22', '24']);
const nvmVersion = fs.readFileSync(path.join(root, '.nvmrc'), 'utf8').trim().split('.')[0];
const nodeVersion = fs.readFileSync(path.join(root, '.node-version'), 'utf8').trim().split('.')[0];

assert.match(
  source,
  /supportedMajors\s*=\s*new Set\(\[22,\s*24\]\)/,
  'runtime doctor must support the approved Node LTS majors',
);
assert.ok(supportedNodeMajors.has(nvmVersion), '.nvmrc must use a supported Node LTS major');
assert.ok(supportedNodeMajors.has(nodeVersion), '.node-version must use a supported Node LTS major');
assert.match(packageJson.packageManager || '', /^npm@\d+\.\d+\.\d+$/, 'npm must be pinned for reproducible installs');
assert.match(
  packageJson.engines?.node || '',
  /22.*24|24.*22/,
  'package engines must describe both supported Node LTS lines',
);

// Test the public package-manifest strategy, not private dependency file paths.
// Package managers are free to change internal layouts, while package.json#bin is the stable contract.
assert.match(source, /function hasRunnableBin\(/, 'runtime doctor must validate declared package executables');
assert.match(source, /manifest\.bin/, 'runtime doctor must read the public package.json bin field');
assert.match(source, /existsSync\(resolve\(dirname\(packageJsonPath\), relativeBin\)\)/, 'declared bin target must exist');
assert.doesNotMatch(source, /require\.resolve\(['"](?:typescript|eslint|tsx|next)\//, 'private package subpaths must not be resolved');

assert.match(source, /npm cache verify/, 'runtime doctor must provide cache verification recovery');
assert.match(source, /npm ci --include=dev/, 'runtime doctor must recommend deterministic dev dependency installation');

const doctor = spawnSync(process.execPath, ['scripts/runtime-doctor.mjs'], {
  cwd: root,
  encoding: 'utf8',
  env: process.env,
});

assert.equal(
  doctor.status,
  0,
  `runtime doctor must run successfully in the installed CI environment.\nSTDOUT:\n${doctor.stdout}\nSTDERR:\n${doctor.stderr}`,
);
assert.match(doctor.stdout, /SpecsDekh runtime is healthy/, 'runtime doctor must report a healthy runtime');

console.log('runtime-doctor: behavioral and portability assertions passed');
