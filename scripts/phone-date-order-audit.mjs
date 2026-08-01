import fs from 'node:fs';

const required = [
  ['src/lib/phone-date-sort.ts', 'PHONE_NEWEST_SORT'],
  ['src/app/api/[[...path]]/handlers/public.ts', "sort === 'createdAt' || sort === 'releaseDate'"],
  ['src/app/api/[[...path]]/handlers/public.ts', 'newest: { ...PHONE_NEWEST_SORT }'],
  ['src/app/api/[[...path]]/handlers/admin-crud.ts', 'let sort: MongooseSort = { ...PHONE_NEWEST_SORT }'],
  ['src/lib/fetch-home-data.ts', 'Phone.find(cardReady).sort(PHONE_NEWEST_SORT)'],
  ['src/lib/fetch-home-data.ts', 'home-data-v4-date-order'],
];

for (const [file, needle] of required) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(needle)) {
    console.error(`Phone date-order audit failed: ${file} is missing ${needle}`);
    process.exit(1);
  }
}

const helper = fs.readFileSync('src/lib/phone-date-sort.ts', 'utf8');
const order = ['releaseDate', 'availableFrom', 'pakistanLaunchAt', 'announcedAt', 'expectedLaunchAt', 'createdAt'];
let last = -1;
for (const field of order) {
  const index = helper.indexOf(`${field}: -1`);
  if (index < 0 || index <= last) {
    console.error(`Phone date-order audit failed: chronology field ${field} is missing or out of order.`);
    process.exit(1);
  }
  last = index;
}

console.log('Phone date-order audit passed. Newer release years are prioritized with deterministic fallbacks.');
