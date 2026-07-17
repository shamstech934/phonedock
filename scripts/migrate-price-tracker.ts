/**
 * Price Tracker Migration Script — PhoneDock
 *
 * Idempotent: safe to run multiple times.
 * Only ADDS missing fields, seed data, and backfill — never destroys data.
 *
 * What this script does:
 *   1. Adds price tracker fields to existing Phone documents
 *   2. Seeds default PriceSource records for common Pakistani retailers
 *   3. Backfills lowestPrice/highestPrice from existing PriceHistory
 *
 * Usage: npx tsx scripts/migrate-price-tracker.ts
 */

import mongoose from 'mongoose';
import { loadScriptEnv, validateMongoUri, classifyMongoError, testConnection } from '../src/lib/mongodb-env';

// Load env in correct priority order
loadScriptEnv();

const MONGODB_URI = process.env.MONGODB_URI || '';
const uriValidation = validateMongoUri(MONGODB_URI);

if (!uriValidation.valid) {
  console.error('ERROR: %s', uriValidation.error);
  console.error('  URI: %s', uriValidation.masked);
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

interface IndexEntry {
  key: Record<string, number | string>;
  options?: Record<string, unknown>;
}

async function ensureIndex(
  collection: mongoose.Collection,
  name: string,
  indexSpec: IndexEntry,
): Promise<{ created: boolean; message: string }> {
  const existingIndexes = await collection.indexes();
  const alreadyExists = existingIndexes.some((idx) => idx.name === name);

  if (alreadyExists) {
    return { created: false, message: `  [exists] Index "${name}"` };
  }

  try {
    await collection.createIndex(indexSpec.key, { name, ...indexSpec.options });
    return { created: true, message: `  [created] Index "${name}"` };
  } catch (err: unknown) {
    const msg = (err as Error).message || String(err);
    return { created: false, message: `  [skipped] Index "${name}": ${msg}` };
  }
}

/**
 * Add missing fields to documents using updateMany.
 * Only sets the field if it doesn't exist.
 */
async function addMissingFields(
  collection: mongoose.Collection,
  fields: Record<string, unknown>,
  filter: Record<string, unknown> = {},
): Promise<{ matched: number; modified: number }> {
  if (Object.keys(fields).length === 0) return { matched: 0, modified: 0 };

  const orConditions: Record<string, unknown>[] = [];
  for (const field of Object.keys(fields)) {
    orConditions.push({ [field]: { $exists: false } });
  }

  const query: Record<string, unknown> = { $or: orConditions, ...filter };
  const result = await collection.updateMany(query, { $set: fields });
  return { matched: result.matchedCount, modified: result.modifiedCount };
}

/* ------------------------------------------------------------------ */
/*  Seed Data                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_SOURCES = [
  { name: 'Daraz', sourceType: 'marketplace', baseUrl: 'https://www.daraz.pk', allowedDomains: ['daraz.pk', 'www.daraz.pk'], priority: 10, trusted: true },
  { name: 'PriceOye', sourceType: 'retailer', baseUrl: 'https://priceoye.pk', allowedDomains: ['priceoye.pk', 'www.priceoye.pk'], priority: 20, trusted: true },
  { name: 'WhatMobile', sourceType: 'retailer', baseUrl: 'https://www.whatmobile.com.pk', allowedDomains: ['whatmobile.com.pk', 'www.whatmobile.com.pk'], priority: 30, trusted: true },
  { name: 'MyShop', sourceType: 'retailer', baseUrl: 'https://myshop.pk', allowedDomains: ['myshop.pk', 'www.myshop.pk'], priority: 40, trusted: false },
  { name: 'Telemart', sourceType: 'marketplace', baseUrl: 'https://telemart.pk', allowedDomains: ['telemart.pk', 'www.telemart.pk'], priority: 50, trusted: false },
  { name: 'iShopping', sourceType: 'retailer', baseUrl: 'https://ishopping.pk', allowedDomains: ['ishopping.pk', 'www.ishopping.pk'], priority: 60, trusted: false },
  { name: 'Yadah', sourceType: 'retailer', baseUrl: 'https://yadah.pk', allowedDomains: ['yadah.pk', 'www.yadah.pk'], priority: 70, trusted: false },
];

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   PhoneDock — Price Tracker Migration    ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  console.log('URI: %s', uriValidation.masked);

  // Test connection first
  console.log('Testing connection...');
  const connResult = await testConnection(MONGODB_URI);
  if (!connResult.success) {
    const classified = classifyMongoError(new Error(connResult.message), uriValidation);
    console.error('\n✗ Cannot connect to MongoDB. Migration aborted.');
    console.error('  %s\n', classified.message);
    for (const line of classified.guidance) {
      console.error('    - %s', line);
    }
    console.error('');
    process.exit(1);
  }
  console.log('Connected to: %s\n', connResult.database);

  // Connect for migration work
  await mongoose.connect(MONGODB_URI, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 15000,
  });

  const db = mongoose.connection.db!;

  let totalCreated = 0;
  let totalExisted = 0;

  /* ================================================================== */
  /*  1. Add price tracker fields to Phone documents                     */
  /* ================================================================== */
  console.log('── Phone: add price tracker fields ──');
  const phoneCol = db.collection('phones');

  const { matched: pm1, modified: pm1o } = await addMissingFields(phoneCol, {
    currentPrice: 0,
    previousPrice: 0,
    lowestPrice: 0,
    highestPrice: 0,
    priceChange: 0,
    percentageChange: 0,
    lastPriceCheckedAt: null,
    lastPriceChangedAt: null,
    priceMode: 'manual',
    manualLock: false,
    manualLockReason: '',
    preferredPriceSourceId: null,
  });
  console.log('  Price tracker fields: %d/%d documents updated', pm1o, pm1);

  // Set currentPrice = pricePKR for documents that still have currentPrice === 0 and pricePKR > 0
  const backfillCurrentPrice = await phoneCol.updateMany(
    { currentPrice: 0, pricePKR: { $gt: 0 } },
    { $set: { currentPrice: '$pricePKR' } },
  );
  console.log('  Backfilled currentPrice from pricePKR: %d documents', backfillCurrentPrice.modifiedCount);

  /* ================================================================== */
  /*  2. Seed default PriceSource records                                */
  /* ================================================================== */
  console.log('\n── PriceSource: seed default records ──');
  const priceSourceCol = db.collection('pricesources');

  // Ensure the collection exists (Mongoose creates it on first model use, but we're using raw driver)
  try {
    await db.createCollection('pricesources');
    console.log('  [created] pricesources collection');
  } catch (e: any) {
    if (e.code === 48) {
      console.log('  [exists] pricesources collection');
    } else {
      console.log('  [skipped] pricesources collection: %s', e.message);
    }
  }

  let sourcesCreated = 0;
  let sourcesExisted = 0;

  for (const source of DEFAULT_SOURCES) {
    const existing = await priceSourceCol.findOne({ name: source.name });
    if (existing) {
      sourcesExisted++;
      console.log('  [exists] PriceSource "%s"', source.name);
    } else {
      await priceSourceCol.insertOne({
        ...source,
        enabled: true,
        lastCheckedAt: null,
        lastSuccessAt: null,
        failureCount: 0,
        status: 'active',
        notes: 'Seeded by migration script',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      sourcesCreated++;
      console.log('  [created] PriceSource "%s" (%s, priority %d)', source.name, source.sourceType, source.priority);
    }
  }

  console.log('  Sources created: %d, already existed: %d', sourcesCreated, sourcesExisted);

  /* ================================================================== */
  /*  3. PriceSource indexes                                             */
  /* ================================================================== */
  console.log('\n── PriceSource: ensure indexes ──');
  const sourceIndexes: Record<string, IndexEntry> = {
    'pricesource_name_unique': { key: { name: 1 }, options: { unique: true } },
    'pricesource_sourceType': { key: { sourceType: 1 } },
    'pricesource_enabled_status': { key: { enabled: 1, status: 1 } },
    'pricesource_priority': { key: { priority: -1 } },
  };

  for (const [name, spec] of Object.entries(sourceIndexes)) {
    const result = await ensureIndex(priceSourceCol, name, spec);
    console.log(result.message);
    if (result.created) totalCreated++; else totalExisted++;
  }

  /* ================================================================== */
  /*  4. Ensure supporting collections exist                             */
  /* ================================================================== */
  console.log('\n── Ensure supporting collections ──');

  for (const collName of ['phoneretaillistings', 'pricetrackerhistories']) {
    try {
      await db.createCollection(collName);
      console.log('  [created] %s collection', collName);
    } catch (e: any) {
      if (e.code === 48) {
        console.log('  [exists] %s collection', collName);
      } else {
        console.log('  [skipped] %s collection: %s', collName, e.message);
      }
    }
  }

  /* ================================================================== */
  /*  5. PhoneRetailListing indexes                                      */
  /* ================================================================== */
  console.log('\n── PhoneRetailListing: ensure indexes ──');
  const retailCol = db.collection('phoneretaillistings');
  const retailIndexes: Record<string, IndexEntry> = {
    'phoneretail_phoneId_sourceId': { key: { phoneId: 1, sourceId: 1 } },
    'phoneretail_phoneId_enabled': { key: { phoneId: 1, enabled: 1 } },
    'phoneretail_sourceId_enabled': { key: { sourceId: 1, enabled: 1 } },
    'phoneretail_verificationStatus': { key: { verificationStatus: 1 } },
    'phoneretail_externalProductId': { key: { externalProductId: 1 } },
  };

  for (const [name, spec] of Object.entries(retailIndexes)) {
    const result = await ensureIndex(retailCol, name, spec);
    console.log(result.message);
    if (result.created) totalCreated++; else totalExisted++;
  }

  /* ================================================================== */
  /*  6. PriceTrackerHistory indexes                                     */
  /* ================================================================== */
  console.log('\n── PriceTrackerHistory: ensure indexes ──');
  const historyCol = db.collection('pricetrackerhistories');
  const historyIndexes: Record<string, IndexEntry> = {
    'pricetrackerhistory_phoneId_capturedAt': { key: { phoneId: 1, capturedAt: -1 } },
    'pricetrackerhistory_phoneId_changeType': { key: { phoneId: 1, changeType: 1 } },
    'pricetrackerhistory_sourceType': { key: { sourceType: 1 } },
    'pricetrackerhistory_verificationStatus': { key: { verificationStatus: 1 } },
    'pricetrackerhistory_capturedAt': { key: { capturedAt: -1 } },
  };

  for (const [name, spec] of Object.entries(historyIndexes)) {
    const result = await ensureIndex(historyCol, name, spec);
    console.log(result.message);
    if (result.created) totalCreated++; else totalExisted++;
  }

  /* ================================================================== */
  /*  7. Backfill lowestPrice/highestPrice from existing PriceHistory    */
  /* ================================================================== */
  console.log('\n── Backfill lowest/highest prices from PriceHistory ──');
  const priceHistoryCol = db.collection('pricehistories');

  // Get all phones
  const phones = await phoneCol.find(
    { deletedAt: null },
    { projection: { _id: 1, modelName: 1, pricePKR: 1, currentPrice: 1, lowestPrice: 1, highestPrice: 1 } },
  ).toArray();

  console.log('  Found %d active phones to process', phones.length);

  let backfillCount = 0;
  let skipCount = 0;

  for (const phone of phones) {
    // Skip if already has non-zero lowest and highest
    if (phone.lowestPrice > 0 && phone.highestPrice > 0) {
      skipCount++;
      continue;
    }

    // Aggregate min/max prices from PriceHistory for this phone
    const priceAgg = await priceHistoryCol.aggregate([
      { $match: { phoneId: phone._id, price: { $gt: 0 } } },
      { $group: {
        _id: '$phoneId',
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
        recordCount: { $sum: 1 },
      }},
    ]).toArray();

    if (priceAgg.length > 0 && priceAgg[0].recordCount > 0) {
      const { minPrice, maxPrice } = priceAgg[0];
      const updateFields: Record<string, unknown> = {};

      if (phone.lowestPrice === 0 && minPrice > 0) {
        updateFields.lowestPrice = minPrice;
      }
      if (phone.highestPrice === 0 && maxPrice > 0) {
        updateFields.highestPrice = maxPrice;
      }

      if (Object.keys(updateFields).length > 0) {
        await phoneCol.updateOne(
          { _id: phone._id },
          { $set: updateFields },
        );
        backfillCount++;
      } else {
        skipCount++;
      }
    } else {
      skipCount++;
    }
  }

  console.log('  Backfilled lowest/highest from PriceHistory: %d phones', backfillCount);
  console.log('  Skipped (already populated or no history): %d phones', skipCount);

  /* ================================================================== */
  /*  Summary                                                           */
  /* ================================================================== */
  console.log('\n═══════════════════════════════════════════');
  console.log('  Price Tracker migration complete.');
  console.log('  Phone fields updated     : %d/%d', pm1o, pm1);
  console.log('  currentPrice backfilled  : %d', backfillCurrentPrice.modifiedCount);
  console.log('  PriceSource created      : %d', sourcesCreated);
  console.log('  PriceSource existed      : %d', sourcesExisted);
  console.log('  Lowest/highest backfilled: %d phones', backfillCount);
  console.log('  Indexes created          : %d', totalCreated);
  console.log('  Indexes existed          : %d', totalExisted);
  console.log('  No data was deleted or overwritten.');
  console.log('═══════════════════════════════════════════\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err.message || err);
  try { mongoose.disconnect(); } catch {}
  process.exit(1);
});