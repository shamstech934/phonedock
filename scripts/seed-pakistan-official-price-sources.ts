import { connectDB } from '@/lib/db';
import { PriceSource } from '@/lib/models/PriceTracker';
import { PAKISTAN_OFFICIAL_PRICE_SOURCES } from '@/lib/pakistan-price-sources';

async function main() {
  await connectDB();
  for (const source of PAKISTAN_OFFICIAL_PRICE_SOURCES) {
    await PriceSource.updateOne(
      { name: source.name },
      {
        $set: {
          baseUrl: source.baseUrl,
          allowedDomains: source.allowedDomains,
          priority: source.priority,
          sourceType: source.sourceType,
          notes: source.notes,
        },
        $setOnInsert: {
          enabled: source.enabled,
          trusted: source.trusted,
          status: source.status,
        },
      },
      { upsert: true },
    );
  }
  console.log(`Seeded or refreshed ${PAKISTAN_OFFICIAL_PRICE_SOURCES.length} official Pakistan price sources.`);
  process.exit(0);
}
main().catch((error) => { console.error(error); process.exit(1); });
