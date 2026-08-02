import fs from 'node:fs';
const required = [
  'src/app/sitemap.xml/route.ts','src/app/phones-sitemap.xml/route.ts','src/app/brands-sitemap.xml/route.ts',
  'src/app/image-sitemap.xml/route.ts','src/app/video-sitemap.xml/route.ts','src/app/api/indexnow/route.ts','src/app/indexnow-key.txt/route.ts'
];
const missing = required.filter((file) => !fs.existsSync(file));
if (missing.length) { console.error('SEO final phase missing:', missing); process.exit(1); }
const index = fs.readFileSync('src/app/sitemap.xml/route.ts','utf8');
for (const name of ['phones','brands','news','reviews','image','video']) {
  if (!index.includes(`'${name}'`) && !index.includes(`\"${name}\"`)) { console.error('Sitemap index missing', name); process.exit(1); }
}
console.log('SEO final phase audit passed:', required.length, 'critical files present.');
