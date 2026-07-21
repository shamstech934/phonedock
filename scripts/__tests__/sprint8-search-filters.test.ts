import assert from 'node:assert/strict';
import fs from 'node:fs';

const publicHandler = fs.readFileSync('src/app/api/[[...path]]/handlers/public.ts', 'utf8');
const phonesClient = fs.readFileSync('src/app/phones/PhonesClient.tsx', 'utf8');
const header = fs.readFileSync('src/components/shared/Header.tsx', 'utf8');

assert.match(publicHandler, /displayType = \(url\.searchParams\.get\('displayType'\)/);
assert.match(publicHandler, /refreshMin = parseFloat\(url\.searchParams\.get\('refreshMin'\)/);
assert.match(publicHandler, /chipset = \(url\.searchParams\.get\('chipset'\)/);
assert.match(publicHandler, /specFilter\.refreshRate/);
assert.match(phonesClient, /CHIPSET_OPTIONS/);
assert.match(phonesClient, /params\.set\('chipset', chipsetParam\)/);
assert.match(header, /autocompleteAbortRef\.current\?\.abort\(\)/);
assert.match(header, /router\.push\(`\/phones\/\$\{p\.slug\}`\)/);

console.log('Sprint 8 search/filter checks passed');
