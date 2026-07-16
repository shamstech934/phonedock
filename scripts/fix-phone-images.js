const mongoose = require('mongoose');
const https = require('https');
const http = require('http');

function checkUrl(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, { method: 'HEAD', timeout: 5000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  
  const phones = await db.collection('phones').find({
    active: true, status: 'published',
    $or: [{ thumbnail: '' }, { thumbnail: null }]
  }).project({ _id: 1, modelName: 1, slug: 1 }).toArray();
  
  console.log(`Found ${phones.length} phones without images\n`);
  
  // Brand prefix mapping for GSMArena
  const brandMap = {
    'samsung': 'samsung-galaxy-',
    'apple': 'apple-iphone-',
    'xiaomi': 'xiaomi-',
    'redmi': 'xiaomi-redmi-',
    'poco': 'xiaomi-poco-',
    'infinix': 'infinix-',
    'tecno': 'tecno-',
    'oneplus': 'oneplus-',
    'realme': 'realme-',
    'oppo': 'oppo-',
    'vivo': 'vivo-',
    'huawei': 'huawei-',
    'honor': 'honor-',
    'motorola': 'motorola-',
    'nothing': 'nothing-',
    'google': 'google-pixel-',
  };
  
  let updated = 0;
  let failed = 0;
  
  for (const phone of phones) {
    const name = phone.modelName;
    const slug = phone.slug;
    
    // Try multiple URL patterns
    const candidates = [];
    
    // Pattern 1: Use our slug directly
    candidates.push(`https://fdn2.gsmarena.com/vv/bigpic/${slug}.jpg`);
    
    // Pattern 2: Use slug with trailing dash (some GSMArena URLs have this)
    candidates.push(`https://fdn2.gsmarena.com/vv/bigpic/${slug}-.jpg`);
    
    // Pattern 3: Construct from modelName
    const nameSlug = name.toLowerCase().replace(/[^a-z0-9+]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    candidates.push(`https://fdn2.gsmarena.com/vv/bigpic/${nameSlug}.jpg`);
    candidates.push(`https://fdn2.gsmarena.com/vv/bigpic/${nameSlug}-.jpg`);
    
    // Try each candidate
    let found = false;
    for (const url of candidates) {
      const valid = await checkUrl(url);
      if (valid) {
        await db.collection('phones').updateOne({ _id: phone._id }, { $set: { thumbnail: url } });
        console.log(`✅ ${name} → ${url}`);
        updated++;
        found = true;
        break;
      }
    }
    
    if (!found) {
      console.log(`❌ ${name} (no GSMArena image found)`);
      failed++;
    }
  }
  
  console.log(`\n=== RESULTS ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Failed: ${failed}`);
  
  await mongoose.disconnect();
}

main().catch(console.error);