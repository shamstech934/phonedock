import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ignoredDirs = new Set(['.git', '.next', 'node_modules', 'coverage', 'dist', 'build', 'audit-output']);
const ignoredFiles = /\.(?:png|jpe?g|gif|webp|ico|woff2?|zip|pdf)$/i;

function walk(dir, base = process.cwd()) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (ignoredDirs.has(entry)) continue;
    const absolute = path.join(dir, entry);
    const relative = path.relative(base, absolute).replaceAll('\\', '/');
    let stat;
    try { stat = statSync(absolute); } catch { continue; }
    if (stat.isDirectory()) files.push(...walk(absolute, base));
    else if (!ignoredFiles.test(relative)) files.push(relative);
  }
  return files;
}

let trackedFiles;
try {
  trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    .split('\0')
    .filter(Boolean);
} catch {
  trackedFiles = walk(process.cwd());
}

const credentialUri = /mongodb(?:\+srv)?:\/\/[^/\s:@]+:[^@\s/]+@/i;
const privateKey = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
const findings = [];

for (const file of trackedFiles) {
  let content = '';
  try { content = readFileSync(file, 'utf8'); } catch { continue; }
  if (credentialUri.test(content)) findings.push({ file, type: 'credential-shaped MongoDB URI' });
  if (privateKey.test(content)) findings.push({ file, type: 'private key material' });
}

if (findings.length > 0) {
  console.error('Potential secrets found:');
  for (const finding of findings) console.error(`- ${finding.file}: ${finding.type}`);
  console.error('Use environment variables and non-credential placeholders instead.');
  process.exit(1);
}

console.log(`Secret scan passed (${trackedFiles.length} source files checked).`);
