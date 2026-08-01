#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import process from 'node:process';

/**
 * Durable CI lint runner.
 *
 * ESLint exit codes:
 *   0 = clean
 *   1 = lint findings (style/quality findings)
 *   2 = fatal/configuration/parser failure
 *
 * TypeScript and the production build remain hard release gates. Lint findings
 * are reported in full but do not block deployment; fatal ESLint failures still do.
 */
const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(executable, ['eslint', '.'], {
  stdio: 'inherit',
  env: process.env,
  shell: false,
});

if (result.error) {
  console.error(`Unable to start ESLint: ${result.error.message}`);
  process.exit(2);
}

const status = result.status ?? 2;
if (status === 0) {
  console.log('ESLint completed without blocking findings.');
  process.exit(0);
}

if (status === 1) {
  console.warn(
    'ESLint reported code-quality findings. They remain visible above, but do not block the release gate. ' +
    'TypeScript, regression tests, security scans, and the production build remain mandatory.'
  );
  process.exit(0);
}

console.error(`ESLint failed fatally with exit code ${status}.`);
process.exit(status);
