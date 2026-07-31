import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const checks = [
  ['Static routes and branding', 'node', ['scripts/production-static-audit.mjs']],
  ['Vercel cron contracts', 'node', ['scripts/cron-config-audit.mjs']],
  ['Admin/API contracts', 'node', ['scripts/admin-production-audit.mjs']],
  ['Secret scan', 'node', ['scripts/security-secret-scan.mjs']],
];

const results = [];
for (const [name, command, args] of checks) {
  const run = spawnSync(command, args, { cwd: root, encoding: 'utf8', env: process.env });
  results.push({
    name,
    command: [command, ...args].join(' '),
    passed: run.status === 0,
    status: run.status,
    stdout: (run.stdout || '').trim().slice(-12000),
    stderr: (run.stderr || '').trim().slice(-12000),
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  project: 'SpecsDekh',
  version: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version,
  passed: results.every(item => item.passed),
  results,
  runtimeCertification: {
    staticChecksCompleted: true,
    dependencyInstallCompleted: fs.existsSync(path.join(root, 'node_modules')),
    runtimeDoctorCommand: 'npm run doctor:runtime',
    note: fs.existsSync(path.join(root, 'node_modules'))
      ? 'Dependencies are available; run npm run release:gate for complete certification.'
      : 'Run npm ci and npm run release:gate in GitHub Actions or Vercel to certify lint, TypeScript, tests, and production build.',
  },
};

fs.mkdirSync(path.join(root, 'audit-output'), { recursive: true });
fs.writeFileSync(path.join(root, 'audit-output/final-release-audit.json'), JSON.stringify(report, null, 2));

console.log('\nSpecsDekh final release audit');
for (const item of results) console.log(`${item.passed ? 'PASS' : 'FAIL'}  ${item.name}`);
console.log(`\nOverall: ${report.passed ? 'PASS' : 'FAIL'}`);
if (!report.passed) process.exitCode = 1;
