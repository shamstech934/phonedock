import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..'); const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');

const growth=read('src/components/monetization/GrowthScripts.tsx'); const ads=read('src/components/monetization/AdSlot.tsx');
assert.match(growth,/phonedock_cookie_consent_v1[\s\S]*accepted/); assert.match(growth,/pathname\.startsWith\('\/admin'\)/);
assert.match(ads,/min-h-\[90px\]/); assert.match(ads,/pathname\.startsWith\('\/admin'\)/); assert.match(ads,/consented/);

const commercial=read('src/lib/models/Commercial.ts');
for(const field of ['trackingId','priority','availability','logo','rating','country','expiresAt','clicks'])assert.match(commercial,new RegExp(field));
assert.match(commercial,/storeKey: 1, phoneId: 1[\s\S]*unique: true/); assert.match(commercial,/AffiliateClickSchema\.index[\s\S]*unique: true/);
const affiliate=read('src/app/api/affiliate/route.ts'); assert.match(affiliate,/AFFILIATE_ALLOWED_HOSTS/); assert.match(affiliate,/AffiliateLink\.findOne/); assert.match(affiliate,/utm_source/); assert.match(affiliate,/AffiliateClick\.updateOne/);

const models=read('src/lib/models/Other.ts'); assert.match(models,/status:[\s\S]*pending[\s\S]*confirmed[\s\S]*unsubscribed/); assert.match(models,/confirmTokenHash/); assert.match(models,/unsubscribeTokenHash/); assert.match(models,/active: 1, position: 1, priority: -1/);
const api=read('src/app/api/[[...path]]/route.ts'); assert.match(api,/newsletter[\s\S]*confirm[\s\S]*unsubscribe/); assert.match(api,/createHash\('sha256'\)/); assert.doesNotMatch(api,/confirmTokenHash:\s*rawConfirm/);
const share=read('src/components/shared/PhoneShareMenu.tsx'); for(const network of ['WhatsApp','Facebook','X / Twitter','Telegram','LinkedIn','Copy link'])assert.match(share,new RegExp(network.replace('/','\\/')));
const layout=read('src/app/layout.tsx'); assert.match(layout,/NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION/); assert.match(layout,/application\/ld\+json/);
console.log('Phase 4 commercial launch tests passed');
