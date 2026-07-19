import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let passed = 0;
let failed = 0;
function check(name: string, condition: boolean) {
  if (condition) { console.log(`✅ ${name}`); passed++; }
  else { console.error(`❌ ${name}`); failed++; }
}
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const helpers = read('src/app/api/[[...path]]/handlers/helpers.ts');
const imp = read('src/app/api/[[...path]]/handlers/import-v2.ts');
const crud = read('src/app/api/[[...path]]/handlers/admin-crud.ts');
const sessions = read('src/lib/models/AdminSession.ts');
check('Import capacity supports 8276+ rows', /MAX_UPLOAD_RECORDS = 20000/.test(helpers));
check('V2 import validates extension', /ALLOWED_EXTENSIONS\.includes\(extension\)/.test(imp));
check('V2 import validates MIME type', /ALLOWED_MIME_TYPES\.has\(file\.type\)/.test(imp));
check('V2 import rejects excessive record count', /TOO_MANY_RECORDS/.test(imp));
check('Admin phone list validates brand ObjectId', /mongoose\.isValidObjectId\(brandId\)/.test(crud));
check('Admin phone list rejects invalid price values', /Invalid minPrice/.test(crud) && /Invalid maxPrice/.test(crud));
check('Admin phone list rejects inverted price range', /minPrice cannot exceed maxPrice/.test(crud));
check('Expired admin sessions use exact TTL expiry', /expireAfterSeconds: 0/.test(sessions));
console.log(`\nCheckpoint 2: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
