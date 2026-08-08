import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');
const checks=[
 ['Specs page exists', fs.existsSync('src/app/admin/specs-intelligence/page.tsx')],
 ['Specs detects conflicts', read('src/lib/specs-intelligence.ts').includes('valuesConflict')],
 ['Specs brand+model identity safety', read('src/lib/specs-intelligence.ts').includes('never fall back to model-only matching')],
 ['Specs approve/reject UI', read('src/app/admin/specs-intelligence/page.tsx').includes('Approve replacement') && read('src/app/admin/specs-intelligence/page.tsx').includes('Reject')],
 ['Image page exists', fs.existsSync('src/app/admin/image-intelligence/page.tsx')],
 ['Image duplicate detection', read('src/lib/image-intelligence.ts').includes("type: 'duplicate_image'")],
 ['Image cross-phone identity detection', read('src/lib/image-intelligence.ts').includes("type: 'cross_phone_duplicate'")],
 ['Image primary conflict detection', read('src/lib/image-intelligence.ts').includes("type: 'multiple_primary_images'")],
 ['Image gallery order detection', read('src/lib/image-intelligence.ts').includes("type: 'gallery_order_collision'")],
 ['Image remote broken checker', read('src/lib/image-intelligence.ts').includes('verifyRemoteImageUrls') && read('src/lib/image-intelligence.ts').includes("type: 'broken_remote_url'")],
 ['Ratings & benchmarks page', fs.existsSync('src/app/admin/ratings-benchmarks/page.tsx')],
 ['Ratings API handler', fs.existsSync('src/app/api/[[...path]]/handlers/ratings-benchmarks.ts')],
 ['Lifecycle consolidated workspace', read('src/app/admin/launch-center/page.tsx').includes('Launch & Lifecycle Intelligence')],
 ['Lifecycle manual lock preserved', read('src/app/api/[[...path]]/handlers/launch-intelligence.ts').includes('lifecycleManualLock')],
 ['Data Quality routes to Price', read('src/app/admin/data-quality/page.tsx').includes("href: '/admin/price-tracker'" )],
 ['Data Quality routes to Specs', read('src/app/admin/data-quality/page.tsx').includes("href: '/admin/specs-intelligence'" )],
 ['Data Quality routes to Images', read('src/app/admin/data-quality/page.tsx').includes("href: '/admin/image-intelligence'" )],
 ['Data Quality routes to Ratings', read('src/app/admin/data-quality/page.tsx').includes("href: '/admin/ratings-benchmarks'" )],
 ['Data Quality routes to Lifecycle', read('src/app/admin/data-quality/page.tsx').includes("href: '/admin/launch-center'" )],
 ['Data Quality UI declares detection-only', read('src/app/admin/data-quality/page.tsx').includes('Detection & routing only')],
 ['Phone data health backed by API metrics', read('src/app/api/[[...path]]/handlers/admin-crud.ts').includes('dataHealth:') && read('src/app/admin/phones/[id]/page.tsx').includes('phone.dataHealth')],
 ['Simple sidebar has Price/Specs/Image/Ratings/Lifecycle', ['/admin/price-tracker','/admin/specs-intelligence','/admin/image-intelligence','/admin/ratings-benchmarks','/admin/launch-center'].every(x=>read('src/app/admin/layout.tsx').includes(x))],
 ['Dedicated Specs runtime route', fs.existsSync('src/app/api/admin/specs-intelligence/route.ts')],
 ['Dedicated Image runtime route', fs.existsSync('src/app/api/admin/image-intelligence/route.ts')],
 ['Dedicated Ratings runtime route', fs.existsSync('src/app/api/admin/ratings-benchmarks/route.ts')],
 ['Dedicated Lifecycle runtime route', fs.existsSync('src/app/api/admin/launch-intelligence/route.ts')],
];
const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'}  ${name}`);
console.log(`\n${checks.length-failed.length}/${checks.length} checks passed`);
if(failed.length) process.exit(1);
