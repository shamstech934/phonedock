import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const builder = fs.readFileSync(path.join(root, 'src/app/admin/homepage-builder/page.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'src/app/admin/layout.tsx'), 'utf8');
const handler = fs.readFileSync(path.join(root, 'src/app/api/[[...path]]/handlers/admin-crud.ts'), 'utf8');

assert.match(layout, /Homepage Builder', href: '\/admin\/homepage-builder'/, 'sidebar must open the Pro Builder');
assert.match(layout, /Site Settings', href: '\/admin\/settings'/, 'legacy settings must remain available as a safe fallback');
assert.match(builder, /draggable/, 'section rows must support drag ordering');
assert.match(builder, /onDrop/, 'section drag ordering must have a drop handler');
assert.match(builder, /aria-label=\{`Move \$\{LABELS\[key\]\} up`\}/, 'section ordering must retain an accessible keyboard fallback');
assert.match(builder, /brand: ''/, 'section rules must support brand filtering');
assert.match(builder, /year: ''/, 'section rules must support release-year filtering');
assert.match(builder, /lifecycle: ''/, 'section rules must support lifecycle filtering');
assert.match(builder, /priceMin: ''/, 'section rules must support price filtering');
assert.match(builder, /manualPhoneSlugs/, 'section rules must support manual phone selection');
assert.match(builder, /\['desktop', Monitor\]/, 'preview must offer desktop mode');
assert.match(builder, /\['tablet', Tablet\]/, 'preview must offer tablet mode');
assert.match(builder, /\['mobile', Smartphone\]/, 'preview must offer mobile mode');
assert.match(builder, /Design system/, 'builder must expose global design controls');
assert.match(builder, /Header & links/, 'builder must expose navigation controls');
assert.match(builder, /Media library/, 'builder must expose media controls');
assert.match(builder, /3D stage positioning/, 'builder must expose precise hero positioning');
assert.match(builder, /release-year categories/, 'builder must expose release-year category controls');
assert.match(builder, /uploadImage/, 'builder must support managed image uploads');
assert.match(handler, /revalidatePath\('\/admin\/homepage-builder'\)/, 'settings update must revalidate the Pro Builder');

console.log('homepage-builder-pro: all assertions passed');
