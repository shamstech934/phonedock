import fs from 'node:fs';
const file = 'src/app/admin/phones/page.tsx';
const source = fs.readFileSync(file, 'utf8');
const bad = "readApiResponse(response).catch(() => ({}))";
const good = "readApiResponse<PhoneUpdateErrorPayload>(response).catch(() => null)";
if (source.includes(bad)) {
  console.error(`FAIL: legacy unsafe payload code remains in ${file}`);
  process.exit(1);
}
if (!source.includes(good)) {
  console.error(`FAIL: typed payload fix missing in ${file}`);
  process.exit(1);
}
console.log('PASS: admin phones payload typing fix is present.');
