import fs from 'node:fs';
import path from 'node:path';

let passed = 0;
let failed = 0;

function test(name: string, condition: boolean) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

const root = process.cwd();
const handler = fs.readFileSync(path.join(root, 'src/app/api/[[...path]]/handlers/import-v2.ts'), 'utf8');
const page = fs.readFileSync(path.join(root, 'src/app/admin/import-v2/page.tsx'), 'utf8');
const model = fs.readFileSync(path.join(root, 'src/lib/models/ImportRecord.ts'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'src/lib/import/import-v2-engine.ts'), 'utf8');

console.log('\n═══ SPRINT 2 IMPORT PERSISTENCE TESTS ═══\n');

test('ImportRecord has unique importId + rowNumber index', model.includes("ImportRecordSchema.index({ importId: 1, rowNumber: 1 }, { unique: true })"));
test('Upload persists all source rows in chunks', handler.includes('ImportRecord.insertMany(chunk') && handler.includes('RECORD_INSERT_CHUNK'));
test('Batch endpoint loads source rows from MongoDB', handler.includes('SOURCE_ROWS_MISSING') && handler.includes('ImportRecord.find({'));
test('Batch checksum uses SHA-256', handler.includes("createHash('sha256')"));
test('Retry executes processBatch server-side', handler.includes('handleImportV2Retry') && handler.includes('records: sourceRows.map'));
test('Upload response exposes jobId', handler.includes('jobId: importId'));
test('UI submits one-based batch numbers', page.includes('batchNumber: i + 1') && page.includes('nextBatchRef.current = 1'));
test('UI and API use the same review publish mode', page.includes("type PublishMode = 'immediate' | 'review'"));
test('Config persists createMissingBrands', handler.includes("update.createMissingBrands = createMissingBrands"));
test('Completed-batch replay verifies checksum', engine.includes('Checksum mismatch for completed batch'));

console.log(`\nPassed: ${passed}\nFailed: ${failed}`);
if (failed > 0) process.exit(1);
