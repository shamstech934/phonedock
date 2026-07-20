import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { parseXLSX as parseV1 } from '../../src/lib/import/parsers';
import { parseXLSX as parseV2 } from '../../src/lib/import/v2-parsers';

async function main() {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
    dependencies?: Record<string, string>;
    overrides?: Record<string, string>;
  };

  assert.equal(pkg.dependencies?.xlsx, undefined, 'vulnerable SheetJS package must not be installed');
  assert.match(pkg.dependencies?.['adm-zip'] ?? '', /0\.6\.0/, 'adm-zip must include ZIP bomb allocation fix');
  assert.equal(pkg.overrides?.uuid, '11.1.1');
  assert.equal(pkg.overrides?.postcss, '8.5.10');

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Phones');
  sheet.addRow(['brand', 'modelName', 'pricePKR', 'formulaResult']);
  sheet.addRow(['Samsung', 'Galaxy Test', 123456, { formula: '1+1', result: 2 }]);
  const bytes = await workbook.xlsx.writeBuffer();
  const buffer = bytes.slice(0) as ArrayBuffer;

  const v1 = await parseV1(buffer);
  assert.equal(v1.length, 1);
  assert.equal(v1[0].brand, 'Samsung');
  assert.equal(v1[0].formulaResult, 2, 'formula source must not execute; cached result is used');

  const v2 = await parseV2(buffer, 'phones.xlsx');
  assert.equal(v2.records.length, 1);
  assert.equal(v2.records[0].modelName, 'Galaxy Test');
  assert.equal(v2.totalRecords, 1);

  console.log('Final release hardening: 10/10 checks passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
