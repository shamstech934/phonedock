import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/lib/ai-enrichment.ts', 'utf8');
assert.match(source, /TAVILY_API_KEY/);
assert.match(source, /OPENAI_API_KEY/);
assert.match(source, /sources\?: ResearchSource\[\]/);
assert.match(source, /conflicts\?: string\[\]/);
assert.match(source, /approvedSourceUrls\.has\(priceSourceUrl\)/);
assert.match(source, /candidateImageUrls\.has\(image\.url\)/);
console.log('v9 PC6 AI research safety checks passed');
