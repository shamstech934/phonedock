const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  // 1. Update brand logos to PNG
  console.log('=== UPDATING BRAND LOGOS ===');
  const logoMap = {
    'samsung': '/brands/samsung.png',
    'apple': '/brands/apple.png',
    'xiaomi': '/brands/xiaomi.png',
    'infinix': '/brands/infinix.png',
    'tecno': '/brands/tecno.png',
    'oneplus': '/brands/oneplus.png',
    'realme': '/brands/realme.png',
  };
  for (const [slug, logo] of Object.entries(logoMap)) {
    await db.collection('brands').updateOne({ slug }, { $set: { logo } });
    console.log(`  ✅ ${slug} → ${logo}`);
  }

  // 2. Update phone thumbnails from image search results
  console.log('\n=== UPDATING PHONE IMAGES ===');
  
  const slugToImgFile = {
    'tecno-pova-6-pro-2': 'img-pova6pro',
    'realme-gt-6-2': 'img-realmegt6',
    'xiaomi-poco-m7': 'img-pocom7',
    'oppo-a18': 'img-oppoa18',
    'tecno-pop-9': 'img-tecnopop9',
    'infinix-hot-50': 'img-hot50',
    'motorola-moto-g34': 'img-motog34',
    'oneplus-nord-ce-4': 'img-nordce4',
    'infinix-hot-50-pro': 'img-hot50pro',
    'oppo-reno-12f': 'img-reno12f',
    'huawei-nova-13': 'img-nova13',
    'oneplus-nord-4': 'img-nord4',
    'oppo-reno-13': 'img-reno13',
    'apple-iphone-17-air': 'img-iphone17air',
    'infinix-note-40': 'img-note40',
    'oppo-reno-13-pro': 'img-reno13pro',
    'huawei-pura-80': 'img-pura80',
    'honor-magic-7': 'img-magic7',
    'infinix-note-40-pro-plus': 'img-note40proplus',
    'huawei-pura-80-pro': 'img-pura80pro',
    'honor-magic-7-pro': 'img-magic7pro',
    'infinix-zero-40-pro': 'img-zero40pro',
    'realme-gt-7-pro': 'img-gt7pro',
  };

  let updated = 0;
  for (const [slug, imgFile] of Object.entries(slugToImgFile)) {
    const filePath = `/home/z/my-project/upload/${imgFile}.json`;
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const url = data.results?.[0]?.original_url;
      if (url) {
        const result = await db.collection('phones').updateOne(
          { slug, $or: [{ thumbnail: '' }, { thumbnail: null }] },
          { $set: { thumbnail: url } }
        );
        if (result.modifiedCount > 0) {
          console.log(`  ✅ ${slug} → ${url}`);
          updated++;
        } else {
          console.log(`  ⏭️  ${slug} (already has image)`);
        }
      } else {
        console.log(`  ❌ ${slug} (no URL in search result)`);
      }
    } catch (e) {
      console.log(`  ❌ ${slug} (file error: ${e.message})`);
    }
  }

  // 3. Final count
  const stillEmpty = await db.collection('phones').countDocuments({
    active: true, status: 'published',
    $or: [{ thumbnail: '' }, { thumbnail: null }]
  });
  const withImg = await db.collection('phones').countDocuments({
    active: true, status: 'published',
    thumbnail: { $ne: '', $ne: null }
  });

  console.log(`\n=== FINAL STATS ===`);
  console.log(`Phones with images: ${withImg}`);
  console.log(`Phones still missing: ${stillEmpty}`);
  console.log(`Image search updates: ${updated}`);

  await mongoose.disconnect();
}

main().catch(console.error);