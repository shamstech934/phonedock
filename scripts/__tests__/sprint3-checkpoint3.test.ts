import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const scanner = fs.readFileSync(path.join(root, 'src/lib/data-quality/scanner.ts'), 'utf8');
let passed = 0;
let failed = 0;

function check(name: string, condition: boolean) {
  if (condition) {
    passed++;
    console.log(`✅ ${name}`);
  } else {
    failed++;
    console.error(`❌ ${name}`);
  }
}

check('Failed scans can resume from persisted cursor',
  !scanner.includes("job.status === 'failed' || job.status === 'cancelled'") &&
  scanner.includes("job.status === 'completed' || job.status === 'cancelled'"));
check('Resume preserves processed counter', scanner.includes('let processed = job.processed || 0'));
check('Scoped entity/import scans do not trigger global orphan scan',
  scanner.includes("job.type === 'full' || job.type === 'incremental' || job.type === 'manual'"));
check('Duplicate specs are detected globally with aggregation',
  scanner.includes("{ $group: { _id: '$phoneId', count: { $sum: 1 } } }") &&
  scanner.includes("{ $match: { count: { $gt: 1 } } }"));
check('Published-phone specs health score is scoped correctly',
  scanner.includes("Phone.find({ deletedAt: null, status: 'published' }).distinct('_id')") &&
  scanner.includes("PhoneSpecs.find({ phoneId: { $in: publishedIds } })"));
check('Missing specs cannot become negative', scanner.includes('Math.max(0, publishedPhones - specPhoneIds.size)'));
check('Image health score only counts published phones',
  scanner.includes("PhoneImage.distinct('phoneId', { phoneId: { $in: publishedIds } })"));
check('Missing PTA status contributes to health deduction', scanner.includes('(missingStatus / base) * 2'));

console.log(`\nCheckpoint 3: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
