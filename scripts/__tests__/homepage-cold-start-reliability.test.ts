import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/app/page.tsx', 'utf8');
const settings = readFileSync('src/lib/models/Settings.ts', 'utf8');

assert.match(settings, /import \{ connectDB \} from '@\/lib\/mongodb'/);
assert.match(settings, /export async function getSettings[\s\S]*await connectDB\(\)/);
assert.doesNotMatch(page, /Promise\.all\(\[fetchHomeData\(\), getSettings\(\)\]\)/);
assert.match(page, /const raw = await fetchHomeData\(\)/);
assert.match(page, /if \(homeData\)[\s\S]*const settings = await getSettings\(\)/);
assert.match(page, /Failed to load primary homepage data/);
assert.match(page, /Failed to load optional site settings/);

console.log('Homepage cold-start reliability tests passed');
