const mongoose = require('mongoose');
const https = require('https');

function checkUrl(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD', timeout: 5000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

// Extra slug mappings for phones that don't follow standard patterns
const EXTRA_SLUGS = {
  'samsung-galaxy-tab-s10': ['samsung-galaxy-tab-s10-ultra', 'samsung-galaxy-tab-s10-fe', 'samsung-galaxy-tab-s10-plus'],
  'samsung-galaxy-f15': ['samsung-galaxy-f15-5g', 'samsung-galaxy-f15-'],
  'infinix-gt-20-pro-2': ['infinix-gt-20-pro'],
  'tecno-pova-6-pro-2': ['tecno-pova-6-pro'],
  'realme-gt-6-2': ['realme-gt-6-'],
  'xiaomi-poco-m7': ['xiaomi-poco-m7-pro', 'poco-m7'],
  'samsung-galaxy-a16': ['samsung-galaxy-a16-5g'],
  'infinix-smart-8': ['infinix-smart-8-hd'],
  'oppo-a18': ['oppo-a18-'],
  'infinix-smart-9': ['infinix-smart-9-hd'],
  'oneplus-nord-n30': ['oneplus-nord-n30-5g'],
  'honor-x7c': ['honor-x7c-5g'],
  'tecno-pop-9': ['tecno-pop-9-pro'],
  'infinix-hot-50': ['infinix-hot-50-5g', 'infinix-hot-50-pro-'],
  'realme-c67': ['realme-c67-5g'],
  'xiaomi-redmi-note-14': ['xiaomi-redmi-note-14-5g'],
  'motorola-moto-g34': ['motorola-moto-g34-5g', 'motorola-moto-g34-'],
  'oneplus-nord-ce-4': ['oneplus-nord-ce-4-5g', 'oneplus-nord-ce4'],
  'infinix-hot-50-pro': ['infinix-hot-50-pro-'],
  'oppo-reno-12f': ['oppo-reno-12f-5g'],
  'xiaomi-redmi-note-14-pro': ['xiaomi-redmi-note-14-pro-5g'],
  'huawei-nova-13': ['huawei-nova-13-pro'],
  'motorola-moto-g55': ['motorola-moto-g55-5g'],
  'oneplus-nord-4': ['oneplus-nord-4-5g'],
  'oppo-reno-13': ['oppo-reno-13-5g', 'oppo-reno-13-f'],
  'xiaomi-redmi-note-14-pro-plus': ['xiaomi-redmi-note-14-pro-plus-5g'],
  'apple-iphone-17-air': ['apple-iphone-17-air-'],
  'infinix-note-40': ['infinix-note-40-5g', 'infinix-note-40-vip'],
  'oppo-reno-13-pro': ['oppo-reno-13-pro-5g'],
  'huawei-pura-80': ['huawei-pura-80-ultra'],
  'honor-magic-7': ['honor-magic-7-lite'],
  'tecno-camon-30-premier': ['tecno-camon-30-premier-5g'],
  'infinix-zero-40-pro': ['infinix-zero-40-pro-5g'],
  'realme-gt-7-pro': ['realme-gt-7-pro-'],
  'tecno-spark-20-pro-plus': ['tecno-spark-20-pro-plus-5g'],
  'motorola-razr-60': ['motorola-razr-60-ultra', 'motorola-razr-60-'],
  'xiaomi-redmi-13c': ['xiaomi-redmi-13c-5g'],
  'oppo-f27': ['oppo-f27-pro-plus', 'oppo-f27-5g'],
  'xiaomi-poco-c75': ['xiaomi-poco-c75-5g'],
  'realme-12x': ['realme-12x-5g'],
  'realme-13-pro': ['realme-13-pro-5g'],
  'realme-13-pro-plus': ['realme-13-pro-plus-5g'],
  'honor-200': ['honor-200-lite', 'honor-200-pro-5g'],
  'honor-200-pro': ['honor-200-pro-5g'],
  'oppo-a3-pro': ['oppo-a3-pro-5g'],
  'oppo-a3x': ['oppo-a3x-5g'],
  'realme-c63': ['realme-c63-5g'],
  'motorola-edge-50-fusion': ['motorola-edge-50-fusion-5g'],
  'realme-narzo-70-pro': ['realme-narzo-70-pro-5g'],
  'realme-note-60x': ['realme-note-60x-5g'],
  'huawei-nova-12i': ['huawei-nova-12i-5g'],
  'oneplus-oneplus-13r': ['oneplus-13r'],
  'xiaomi-poco-x7': ['xiaomi-poco-x7-5g'],
  'xiaomi-poco-x7-pro': ['xiaomi-poco-x7-pro-5g'],
  'nothing-phone-2a': ['nothing-phone-2a-plus'],
  'nothing-phone-2a-plus': ['nothing-phone-2a-plus-'],
  'google-pixel-10': ['google-pixel-10-pro'],
  'google-pixel-9a': ['google-pixel-9a-5g'],
  'google-pixel-8': ['google-pixel-8-pro', 'google-pixel-8-'],
  'honor-magic-7-pro': ['honor-magic-7-pro-5g'],
  'huawei-pura-80-pro': ['huawei-pura-80-pro-ultra'],
  'tecno-spark-20': ['tecno-spark-20-pro-5g'],
  'vivo-v40-pro': ['vivo-v40-pro-5g'],
  'vivo-v40e': ['vivo-v40e-5g'],
  'honor-x6c': ['honor-x6c-5g'],
  'honor-x9c': ['honor-x9c-5g'],
  'xiaomi-xiaomi-15': ['xiaomi-15-'],
  'vivo-y100': ['vivo-y100-5g', 'vivo-y100a'],
  'vivo-y19s': ['vivo-y19s-5g'],
  'vivo-y200': ['vivo-y200-5g', 'vivo-y200e'],
  'vivo-y28': ['vivo-y28-5g'],
  'apple-iphone-14': ['apple-iphone-14-plus', 'apple-iphone-14-'],
  'apple-iphone-16': ['apple-iphone-16-pro', 'apple-iphone-16-'],
  'apple-iphone-16e': ['apple-iphone-16e-'],
  'apple-iphone-17': ['apple-iphone-17-pro', 'apple-iphone-17-'],
  'samsung-galaxy-a26': ['samsung-galaxy-a26-5g'],
  'samsung-galaxy-a36': ['samsung-galaxy-a36-5g'],
  'samsung-galaxy-a56': ['samsung-galaxy-a56-5g'],
  'samsung-galaxy-m15': ['samsung-galaxy-m15-5g-'],
  'samsung-galaxy-m35': ['samsung-galaxy-m35-5g'],
  'samsung-galaxy-s25-fe': ['samsung-galaxy-s25-fe-5g'],
  'samsung-galaxy-z-flip6': ['samsung-galaxy-z-flip6-5g'],
  'samsung-galaxy-z-fold6': ['samsung-galaxy-z-fold6-5g'],
  'xiaomi-14-ultra': ['xiaomi-14-ultra-'],
};

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  
  const phones = await db.collection('phones').find({
    active: true, status: 'published',
    $or: [{ thumbnail: '' }, { thumbnail: null }]
  }).project({ _id: 1, modelName: 1, slug: 1 }).toArray();
  
  console.log(`Found ${phones.length} phones still without images\n`);
  
  let updated = 0;
  let failed = 0;
  
  for (const phone of phones) {
    const slugs = EXTRA_SLUGS[phone.slug] || [];
    let found = false;
    
    for (const s of slugs) {
      const url = `https://fdn2.gsmarena.com/vv/bigpic/${s}.jpg`;
      const valid = await checkUrl(url);
      if (valid) {
        await db.collection('phones').updateOne({ _id: phone._id }, { $set: { thumbnail: url } });
        console.log(`✅ ${phone.modelName} → ${url}`);
        updated++;
        found = true;
        break;
      }
    }
    
    if (!found) {
      console.log(`❌ ${phone.modelName}`);
      failed++;
    }
  }
  
  console.log(`\n=== RESULTS ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Still missing: ${failed}`);
  
  await mongoose.disconnect();
}

main().catch(console.error);