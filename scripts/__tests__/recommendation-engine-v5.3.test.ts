import assert from 'node:assert/strict';
import { recommendPhones, type RecommendationCandidate } from '../../src/lib/intelligence/recommendations';
import { parseBuyingIntent } from '../../src/lib/intelligence/intent';

const phones: RecommendationCandidate[] = [
  { id:'1', slug:'alpha-a', modelName:'Alpha A', brandSlug:'alpha', pricePKR:50000, ptaApproved:true, cameraScore:82, performanceScore:78, batteryScore:80, displayScore:84, valueScore:86, overallRating:82, dataConfidence:'verified', lastVerifiedAt:new Date(), specs:{display:'AMOLED', charging:'67W'} },
  { id:'2', slug:'beta-b', modelName:'Beta B', brandSlug:'beta', pricePKR:43000, ptaApproved:true, cameraScore:78, performanceScore:76, batteryScore:81, displayScore:80, valueScore:90, overallRating:80, dataConfidence:'verified', lastVerifiedAt:new Date(), specs:{display:'OLED', charging:'45W'} },
  { id:'3', slug:'gamma-c', modelName:'Gamma C', brandSlug:'gamma', pricePKR:62000, ptaApproved:true, cameraScore:91, performanceScore:88, batteryScore:84, displayScore:90, valueScore:81, overallRating:89, dataConfidence:'verified', lastVerifiedAt:new Date(), specs:{display:'AMOLED', charging:'80W'} },
  { id:'4', slug:'alpha-d', modelName:'Alpha D', brandSlug:'alpha', pricePKR:52000, ptaApproved:true, cameraScore:80, performanceScore:80, batteryScore:80, displayScore:80, valueScore:82, overallRating:81, dataConfidence:'estimated', specs:{} },
];

const results = recommendPhones(phones, parseBuyingIntent('best camera phone under 70000 pta amoled fast charging'), 4);
assert.equal(results.length, 4);
assert.equal(results[0].phone.slug, 'gamma-c');
assert.ok(results[0].reasons.some(reason => /AMOLED/i.test(reason)));
assert.ok(results[0].alternatives.length >= 1);
assert.ok(results.some(result => result.alternatives.some(alt => alt.type === 'cheaper')));
assert.ok(results.find(result => result.phone.slug === 'alpha-d')?.confidence !== 'high');
assert.equal(new Set(results.slice(0,3).map(result => result.phone.brandSlug)).size, 3);
console.log('v5.3 recommendation engine tests passed');
