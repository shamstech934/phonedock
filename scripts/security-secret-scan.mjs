import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const credentialUri = /mongodb(?:\+srv)?:\/\/[^/\s:@]+:[^@\s/]+@/i;
const findings = [];

for (const file of trackedFiles) {
  if (/\.(?:png|jpe?g|gif|webp|ico|woff2?|zip)$/i.test(file)) continue;

  let content = '';
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  if (credentialUri.test(content)) findings.push(file);
}

if (findings.length > 0) {
  console.error('Credential-shaped MongoDB URI found in tracked files:');
  for (const file of findings) console.error(`- ${file}`);
  console.error('Use environment variables and non-credential placeholders instead.');
  process.exit(1);
}

console.log(`Secret scan passed (${trackedFiles.length} tracked files checked).`);
