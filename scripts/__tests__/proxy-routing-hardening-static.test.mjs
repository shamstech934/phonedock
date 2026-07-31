import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../../src/proxy.ts', import.meta.url), 'utf8');
assert.match(source, /hostname\.toLowerCase\(\) === 'www\.specsdekh\.com'/);
assert.match(source, /canonicalUrl\.hostname = 'specsdekh\.com'/);
assert.match(source, /NextResponse\.redirect\(canonicalUrl, 308\)/);
assert.match(source, /pathname\.endsWith\(route\)/);
assert.match(source, /'\/admin\/login'/);
assert.match(source, /NextResponse\.redirect\(recoveredUrl, 308\)/);
console.log('Proxy routing hardening static checks passed.');
