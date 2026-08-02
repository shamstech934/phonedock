import fs from 'node:fs';
import path from 'node:path';

const roots = ['src/app/admin'];
const findings = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) {
      const text = fs.readFileSync(full, 'utf8');
      if (/readApiResponse\([^)]*\)\.catch\(\(\) => \(\{\}\)\)/.test(text) && /\.issues\b/.test(text)) {
        findings.push(full);
      }
    }
  }
}
for (const root of roots) if (fs.existsSync(root)) walk(root);
if (findings.length) {
  console.error('Unsafe API payload fallbacks found:\n' + findings.join('\n'));
  process.exit(1);
}
console.log('API payload type audit passed.');
