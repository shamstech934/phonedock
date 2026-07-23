import assert from 'node:assert/strict';
import { aiEnrichmentConfigured } from '../../src/lib/ai-enrichment';

const old = { ...process.env };
delete process.env.AI_ENRICHMENT_API_URL;
delete process.env.AI_ENRICHMENT_API_KEY;
delete process.env.AI_ENRICHMENT_MODEL;
delete process.env.AI_IMAGE_SEARCH_URL;
assert.equal(aiEnrichmentConfigured('specs'), false);
assert.equal(aiEnrichmentConfigured('images'), false);
process.env.AI_IMAGE_SEARCH_URL = 'https://example.test/search';
assert.equal(aiEnrichmentConfigured('images'), true);
process.env.AI_ENRICHMENT_API_URL = 'https://example.test/chat';
process.env.AI_ENRICHMENT_API_KEY = 'test';
process.env.AI_ENRICHMENT_MODEL = 'test-model';
assert.equal(aiEnrichmentConfigured('specs'), true);
process.env = old;
console.log('v9 PC5 AI enrichment configuration tests passed');
