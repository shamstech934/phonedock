import fs from 'node:fs';
const admin = fs.readFileSync('src/app/api/[[...path]]/handlers/admin-crud.ts','utf8');
const dq = fs.readFileSync('src/app/api/[[...path]]/handlers/data-quality.ts','utf8');
if (!admin.includes("const visibility = url.searchParams.get('visibility') || 'all'")) throw new Error('Admin phone inventory visibility repair missing');
if (!admin.includes('Phone.countDocuments({})')) throw new Error('Admin total must include all phone documents');
if (!dq.includes('rawPhoneDocuments')) throw new Error('Catalog reconciliation diagnostics missing');
if (!dq.includes('orphanSpecs')) throw new Error('Orphan specs diagnostic missing');
console.log('Catalog visibility audit passed');
