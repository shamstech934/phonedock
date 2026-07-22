import assert from 'node:assert/strict';
import { parseBuyingIntent, normalizeSearchIntent } from '../../src/lib/intelligence/intent';
import { recommendPhones, type RecommendationCandidate } from '../../src/lib/intelligence/recommendations';
import { analyzePriceHistory } from '../../src/lib/intelligence/price-intelligence';

const roman = parseBuyingIntent('acha camera PTA approved mobile under 50 hazar');
assert.equal(roman.budgetMax, 50_000); assert.equal(roman.ptaRequired, true); assert.ok(roman.preferences.includes('camera')); assert.equal(roman.language, 'roman-ur');
assert.match(normalizeSearchIntent('paisa vasool gaming mobile'), /value gaming/);
assert.doesNotMatch(normalizeSearchIntent('<script>alert(1)</script>'), /[<>]/);

const phones: RecommendationCandidate[] = [
  { id:'1',slug:'best',modelName:'Best',pricePKR:45_000,ptaApproved:true,cameraScore:90,performanceScore:80,batteryScore:75,displayScore:85,valueScore:88,dataConfidence:'verified',lastVerifiedAt:new Date(),specs:{display:'AMOLED'} },
  { id:'2',slug:'over-budget',modelName:'Over',pricePKR:70_000,ptaApproved:true,cameraScore:99,valueScore:90 },
  { id:'3',slug:'non-pta',modelName:'Non PTA',pricePKR:40_000,ptaApproved:false,cameraScore:95,valueScore:90 },
  { id:'1',slug:'best-copy',modelName:'Duplicate',pricePKR:40_000,ptaApproved:true,cameraScore:100,valueScore:100 },
  { id:'4',slug:'missing',modelName:'Missing',pricePKR:30_000,ptaApproved:true,valueScore:70 },
];
const recommended = recommendPhones(phones, roman, 10);
assert.deepEqual(recommended.map(item=>item.phone.slug), ['best','missing']);
assert.equal(recommended[0].confidence, 'high'); assert.ok(recommended[1].missingData.includes('camera score')); assert.ok(recommended[1].matchPercentage < recommended[0].matchPercentage);
assert.equal(new Set(recommended.map(item=>item.phone.id)).size, recommended.length);

const insufficient = analyzePriceHistory(Array.from({length:11},(_,i)=>({price:100_000-i*100,recordedAt:new Date(Date.now()-i*86_400_000)})));
assert.equal(insufficient.status,'insufficient-data');
const history = Array.from({length:20},(_,i)=>({price:100_000-i*600,recordedAt:new Date(Date.now()-(19-i)*3*86_400_000)})); history.push({price:9_000_000,recordedAt:new Date()});
const prediction = analyzePriceHistory(history);
assert.equal(prediction.status,'likely-decrease'); assert.ok(prediction.highest! < 9_000_000); assert.ok(prediction.range); assert.equal(prediction.modelVersion,'linear-trend-v1');

console.log('Phase 3 intelligence tests passed');
