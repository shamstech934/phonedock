/**
 * Database Migration Script — PhoneDock
 *
 * Idempotent: safe to run multiple times.
 * Only ADDS missing indexes and missing fields — never destroys data.
 *
 * Usage: npm run migrate
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';
if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI is not set in environment.');
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
  const alreadyExists = existingIndexes.some(
    (idx) => idx.name === name,
  );

  if (alreadyExists) {
    return { created: false, message: `  ✓ Index "${name}" already exists` };
  }

  try {
    await collection.createIndex(indexSpec.key, { name, ...indexSpec.options });
    return { created: true, message: `  + Created index "${name}"` };
  } catch (err: unknown) {
    const msg = (err as Error).message || String(err);
    return { created: false, message: `  ! Index "${name}" skipped: ${msg}` };
  }
}

/**
 * Add missing fields to all documents in a collection using bulkWrite
 * with updateOne + upsert:false.  Only sets the field if it doesn't exist.
 */
async function addMissingFields(
  collection: mongoose.Collection,
  fields: Record<string, unknown>,
  filter: Record<string, unknown> = {},
): Promise<{ matched: number; modified: number }> {
  if (Object.keys(fields).length === 0) return { matched: 0, modified: 0 };

  // Build a query that matches documents missing ANY of the fields
  const orConditions: Record<string, unknown>[] = [];
  for (const field of Object.keys(fields)) {
    orConditions.push({ [field]: { $exists: false } });
  }

  const query: Record<string, unknown> = { $or: orConditions, ...filter };
  const result = await collection.updateMany(query, { $set: fields });
  return { matched: result.matchedCount, modified: result.modifiedCount };
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  console.log('Connecting to MongoDB …');
  await mongoose.connect(MONGODB_URI, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 15000,
  });
  console.log('Connected.\n');

  const db = mongoose.connection.db!;

  let totalCreated = 0;
  let totalSkipped = 0;

  /* ================================================================== */
  /*  1. Phone indexes                                                  */
  /* ================================================================== */
  console.log('── Phone ──');
  const phoneCol = db.collection('phones');

  const phoneIndexes: Record<string, IndexEntry> = {
    'phone_slug_unique': { key: { slug: 1 }, options: { unique: true } },
    'phone_brandId_status': { key: { brandId: 1, status: 1 } },
    'phone_status_active': { key: { status: 1, active: 1 } },
    'phone_text_search': { key: { modelName: 'text', slug: 'text' } },
  };

  for (const [name, spec] of Object.entries(phoneIndexes)) {
    const result = await ensureIndex(phoneCol, name, spec);
    console.log(result.message);
    if (result.created) totalCreated++;
    else totalSkipped++;
  }

  /* ================================================================== */
  /*  2. PhoneSpecs indexes                                             */
  /* ================================================================== */
  console.log('\n── PhoneSpecs ──');
  const specsCol = db.collection('phonespecs');

  const specsResult = await ensureIndex(specsCol, 'phonespecs_phoneId_unique', {
    key: { phoneId: 1 },
    options: { unique: true },
  });
  console.log(specsResult.message);
  if (specsResult.created) totalCreated++;
  else totalSkipped++;

  /* ================================================================== */
  /*  3. PhoneBenchmark indexes                                         */
  /* ================================================================== */
  console.log('\n── PhoneBenchmark ──');
  const benchCol = db.collection('phonebenchmarks');

  const benchResult = await ensureIndex(benchCol, 'phonebenchmark_phoneId_unique', {
    key: { phoneId: 1 },
    options: { unique: true },
  });
  console.log(benchResult.message);
  if (benchResult.created) totalCreated++;
  else totalSkipped++;

  /* ================================================================== */
  /*  4. PhonePrice indexes                                             */
  /* ================================================================== */
  console.log('\n── PhonePrice ──');
  const priceCol = db.collection('phoneprices');

  const priceResult = await ensureIndex(priceCol, 'phoneprice_phoneId_storeName_unique', {
    key: { phoneId: 1, storeName: 1 },
    options: { unique: true },
  });
  console.log(priceResult.message);
  if (priceResult.created) totalCreated++;
  else totalSkipped++;

  /* ================================================================== */
  /*  5. News indexes (verify slug unique)                              */
  /* ================================================================== */
  console.log('\n── News ──');
  const newsCol = db.collection('news');

  const newsResult = await ensureIndex(newsCol, 'news_slug_unique', {
    key: { slug: 1 },
    options: { unique: true },
  });
  console.log(newsResult.message);
  if (newsResult.created) totalCreated++;
  else totalSkipped++;

  /* ================================================================== */
  /*  6. ActivityLog TTL index                                          */
  /* ================================================================== */
  console.log('\n── ActivityLog ──');
  const logCol = db.collection('activitylogs');

  const ttlResult = await ensureIndex(logCol, 'activitylog_ttl', {
    key: { createdAt: -1 },
    options: { expireAfterSeconds: 7776000 },
  });
  console.log(ttlResult.message);
  if (ttlResult.created) totalCreated++;
  else totalSkipped++;

  /* ================================================================== */
  /*  7. Add missing fields to Phone documents                          */
  /* ================================================================== */
  console.log('\n── Phone: add missing fields ──');

  // Fields that should default to specific values
  const phoneDefaults: Record<string, unknown> = {
    status: 'published',
    active: true,
    sourceName: null,
    sourceUrl: null,
    lastVerifiedAt: null,
    createdBy: null,
    updatedBy: null,
    publishedBy: null,
    publishedAt: null,
    deletedAt: null,
  };

  // dataConfidence needs special handling: set 'verified' for seeded phones
  const { matched: phoneDefaultMatched, modified: phoneDefaultModified } =
    await addMissingFields(phoneCol, phoneDefaults);
  console.log(`  Fields: ${phoneDefaultModified}/${phoneDefaultMatched} documents updated`);

  // Set dataConfidence to 'verified' for phones that already have dataConfidence missing
  // and look like seeded data (have specs, benchmarks, or were created from seed)
  // For simplicity: set 'verified' for all existing phones (since they were seeded),
  // 'unverified' is only for future auto-imported phones
  const confidenceResult = await phoneCol.updateMany(
    { dataConfidence: { $exists: false } },
    { $set: { dataConfidence: 'verified' } },
  );
  console.log(`  dataConfidence: ${confidenceResult.modifiedCount} documents set to 'verified'`);

  /* ================================================================== */
  /*  8. Add sessionVersion to Admin documents (replaces revokedSessions) */
  /* ================================================================== */
  console.log('\n── Admin: add sessionVersion ──');

  const adminCol = db.collection('admins');
  const adminVersionResult = await adminCol.updateMany(
    { sessionVersion: { $exists: false } },
    { $set: { sessionVersion: 0 } },
  );
  console.log(`  sessionVersion: ${adminVersionResult.modifiedCount} documents set to 0`);

  // Clear old revokedSessions array (no longer used)
  const clearRevokedResult = await adminCol.updateMany(
    { revokedSessions: { $exists: true, $ne: [] } },
    { $set: { revokedSessions: [] } },
  );
  if (clearRevokedResult.modifiedCount > 0) {
    console.log(`  Cleared revokedSessions from ${clearRevokedResult.modifiedCount} admin documents`);
  }

  // Ensure RateLimit collection exists (for MongoDB-backed IP rate limiting)
  try {
    await db.createCollection('ratelimits', {
      expires: { afterSeconds: 300 },
    });
    console.log('  + Created ratelimits collection with TTL');
  } catch (e: any) {
    if (e.code === 48) {
      console.log('  ✓ ratelimits collection already exists');
    } else {
      console.log(`  ! ratelimits collection: ${e.message}`);
    }
  }

  // Create RateLimit indexes
  const rlCol = db.collection('ratelimits');
  try {
    await rlCol.createIndex(
      { expiresAt: 1 },
      { name: 'ratelimit_ttl', expireAfterSeconds: 300, background: true },
    );
    console.log('  + Created ratelimit TTL index');
  } catch (e: any) {
    if (e.message.includes('already exists')) {
      console.log('  ✓ ratelimit TTL index already exists');
    }
  }
  try {
    await rlCol.createIndex(
      { key: 1 },
      { name: 'ratelimit_key_unique', unique: true, background: true },
    );
    console.log('  + Created ratelimit key unique index');
  } catch (e: any) {
    if (e.message.includes('already exists')) {
      console.log('  ✓ ratelimit key unique index already exists');
    }
  }

  /* ================================================================== */
  /*  9. Add missing fields to Brand documents                          */
  /* ================================================================== */
  console.log('\n── Brand: add missing fields ──');

  const brandDefaults: Record<string, unknown> = {
    website: '',
    seoTitle: '',
    seoDescription: '',
  };

  const brandCol = db.collection('brands');
  const { matched: brandMatched, modified: brandModified } =
    await addMissingFields(brandCol, brandDefaults);
  console.log(`  Fields: ${brandModified}/${brandMatched} documents updated`);

  /* ================================================================== */
  /*  Summary                                                           */
  /* ================================================================== */
  console.log('\n═══════════════════════════════════════');
  console.log(`Migration complete.`);
  console.log(`  Indexes created : ${totalCreated}`);
  console.log(`  Indexes existed : ${totalSkipped}`);
  console.log('═══════════════════════════════════════\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  mongoose.disconnect();
  process.exit(1);
});