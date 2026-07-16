import { importPhones } from '../src/lib/import/import-engine';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

async function testImport() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'phonedock-sample-data.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    const records = JSON.parse(content);
    console.log(`Parsed ${records.length} records`);
    
    const result = await importPhones(records, {
      filename: 'test.json',
      fileType: 'json',
      autoCategorize: false,
      autoSEO: false,
      autoReview: false,
      skipExisting: false,
    });
    
    console.log('\n=== IMPORT RESULT ===');
    console.log('Total:', result.total);
    console.log('Inserted:', result.inserted);
    console.log('Updated:', result.updated);
    console.log('Skipped:', result.skipped);
    console.log('Failed:', result.failed);
    console.log('Duration:', result.duration, 'ms');
    
    if (result.errors.length > 0) {
      console.log('\n=== ERRORS ===');
      for (const err of result.errors) {
        console.log(`Row ${err.row} (${err.model}): ${err.error}`);
      }
    }
    
    if (result.warnings.length > 0) {
      console.log('\n=== WARNINGS ===');
      for (const w of result.warnings) {
        console.log(w);
      }
    }
  } catch (e: any) {
    console.error('FATAL ERROR:', e.message);
    console.error('Stack:', e.stack);
  }
  
  process.exit(0);
}

testImport();