import { connectDB } from '@/lib/db';
import { PriceSource } from '@/lib/models/PriceTracker';

const sources = [
  { name: 'Samsung Pakistan Official', baseUrl: 'https://www.samsung.com/pk', allowedDomains: ['samsung.com'], priority: 100 },
  { name: 'vivo Pakistan Official', baseUrl: 'https://www.vivo.com/pk', allowedDomains: ['vivo.com'], priority: 98 },
  { name: 'vivo Pakistan Official Store', baseUrl: 'https://shop.vivo.com/pk', allowedDomains: ['shop.vivo.com'], priority: 99 },
  { name: 'OPPO Pakistan Official', baseUrl: 'https://www.oppo.com/pk', allowedDomains: ['oppo.com'], priority: 94 },
  { name: 'Xiaomi Pakistan Official Store', baseUrl: 'https://mistore.pk', allowedDomains: ['mistore.pk'], priority: 97 },
  { name: 'realme Pakistan Official', baseUrl: 'https://www.realme.com/pk', allowedDomains: ['realme.com'], priority: 95 },
  { name: 'Infinix Pakistan Official', baseUrl: 'https://pk.infinixmobility.com', allowedDomains: ['pk.infinixmobility.com'], priority: 92 },
  { name: 'TECNO Pakistan Official', baseUrl: 'https://www.tecno-mobile.com/pak', allowedDomains: ['tecno-mobile.com'], priority: 92 },
  { name: 'HONOR Pakistan Official', baseUrl: 'https://www.honor.com/pk', allowedDomains: ['honor.com'], priority: 91 },
];

async function main() {
  await connectDB();
  for (const source of sources) {
    await PriceSource.updateOne(
      { name: source.name },
      { $setOnInsert: { ...source, sourceType: 'official_brand', enabled: true, trusted: false, status: 'active', notes: 'Official Pakistan source. Test a real product URL before marking trusted.' } },
      { upsert: true },
    );
  }
  console.log(`Seeded ${sources.length} official Pakistan price sources.`);
  process.exit(0);
}
main().catch((error) => { console.error(error); process.exit(1); });
