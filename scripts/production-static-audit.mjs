import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP = path.join(ROOT, 'src', 'app');
const SCAN_DIRS = [path.join(ROOT, 'src', 'app'), path.join(ROOT, 'src', 'components')];
const TEXT_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.mjs']);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

function routeFromPage(file) {
  let relative = path.relative(APP, path.dirname(file)).replaceAll(path.sep, '/');
  const pieces = relative.split('/').filter(Boolean).filter((part) => !/^\(.+\)$/.test(part));
  const route = `/${pieces.join('/')}`.replace(/\/page$/, '');
  return route === '/' ? '/' : route.replace(/\/$/, '');
}

const pageFiles = walk(APP).filter((file) => /page\.(tsx|ts|jsx|js)$/.test(file));
const routes = new Set(pageFiles.map(routeFromPage));
const dynamicPatterns = [...routes].filter((r) => r.includes('[')).map((route) => {
  const escaped = route.split('/').map((part) => {
    if (/^\[\.\.\..+\]$/.test(part)) return '.+';
    if (/^\[.+\]$/.test(part)) return '[^/]+';
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('/');
  return new RegExp(`^${escaped}$`);
});

const files = SCAN_DIRS.flatMap(walk).filter((file) => TEXT_EXT.has(path.extname(file)));
const brokenLinks = [];
const unsafeRelativeLinks = [];
const visibleLegacyBrand = [];
const hardcodedOldOrigin = [];

const linkRegex = /(?:href\s*=\s*|router\.(?:push|replace)\(\s*|window\.location(?:\.href)?\s*=\s*)["'`]([^"'`$?#]+)["'`]/g;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file).replaceAll(path.sep, '/');
  let match;
  while ((match = linkRegex.exec(text))) {
    const href = match[1].trim();
    if (!href || /^(https?:|mailto:|tel:|#)/.test(href)) continue;
    if (!href.startsWith('/')) {
      unsafeRelativeLinks.push({ file: rel, href });
      continue;
    }
    const clean = href.split('?')[0].replace(/\/$/, '') || '/';
    if (clean.startsWith('/api/') || clean.startsWith('/_next/') || clean.includes('${')) continue;
    if (!routes.has(clean) && !dynamicPatterns.some((pattern) => pattern.test(clean))) {
      brokenLinks.push({ file: rel, href: clean });
    }
  }

  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/phonedock-pi\.vercel\.app/i.test(line)) hardcodedOldOrigin.push({ file: rel, line: index + 1 });
    if (/PhoneDock/.test(line) && !/(legacy|migration|compatib|database|collection|issuer|audience|storage|cookie|event|class|keyframe|internal|phonedock[_:-])/i.test(line)) {
      visibleLegacyBrand.push({ file: rel, line: index + 1, text: line.trim().slice(0, 160) });
    }
  });
}

const requiredFiles = ['package.json', 'next.config.ts', 'vercel.json', 'src/app/layout.tsx', 'src/app/robots.ts', 'src/app/sitemap.ts'];
const missingRequiredFiles = requiredFiles.filter((file) => !fs.existsSync(path.join(ROOT, file)));
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const requiredScripts = ['lint', 'typecheck', 'test', 'build'];
const missingScripts = requiredScripts.filter((name) => !packageJson.scripts?.[name]);

const findings = {
  generatedAt: new Date().toISOString(),
  summary: {
    pages: pageFiles.length,
    routes: routes.size,
    scannedFiles: files.length,
    brokenInternalLinks: brokenLinks.length,
    unsafeRelativeLinks: unsafeRelativeLinks.length,
    hardcodedOldOrigins: hardcodedOldOrigin.length,
    visibleLegacyBrandReferences: visibleLegacyBrand.length,
    missingRequiredFiles: missingRequiredFiles.length,
    missingRequiredScripts: missingScripts.length,
  },
  brokenLinks,
  unsafeRelativeLinks,
  hardcodedOldOrigin,
  visibleLegacyBrand,
  missingRequiredFiles,
  missingScripts,
};

const reportDir = path.join(ROOT, 'reports');
fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(path.join(reportDir, 'production-static-audit.json'), JSON.stringify(findings, null, 2));

const blocking = brokenLinks.length + unsafeRelativeLinks.length + hardcodedOldOrigin.length + missingRequiredFiles.length + missingScripts.length;
console.log('\nSpecsDekh production static audit');
console.log(JSON.stringify(findings.summary, null, 2));
console.log(blocking ? `\nBLOCKED: ${blocking} release-blocking finding(s).` : '\nPASS: No release-blocking static findings.');
if (visibleLegacyBrand.length) console.log(`NOTICE: ${visibleLegacyBrand.length} possible user-facing legacy brand reference(s) need manual review.`);
process.exitCode = blocking ? 1 : 0;
