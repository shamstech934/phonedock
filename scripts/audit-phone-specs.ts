/**
 * Phone Specs Audit Script
 *
 * Reports:
 *   - Total phones (active + published)
 *   - Phones with PhoneSpecs
 *   - Phones without PhoneSpecs
 *   - Orphan PhoneSpecs records (phoneId doesn't match any Phone)
 *   - Duplicate PhoneSpecs records (multiple docs for same phoneId)
 *   - PhoneSpecs with invalid phoneId
 *   - Phones with legacy spec fields on the Phone document
 *   - Phones with CollectedPhone data but no PhoneSpecs (backfill candidates)
 *
 * Usage:
 *   npx tsx scripts/audit-phone-specs.ts
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || '';
if (!MONGODB_URI) {
  console.error('MONGODB_URI environment variable is required');
  process.exit(1);
}

// Minimal schemas for raw queries (no index creation, no model registration conflicts)
const PhoneSchema = new mongoose.Schema(
  { slug: String, active: Boolean, status: String, brandId: mongoose.Schema.Types.ObjectId },
  { strict: false, _id: true },
);
const PhoneSpecsSchema = new mongoose.Schema(
  { phoneId: mongoose.Schema.Types.ObjectId },
  { strict: false, _id: true },
);
const CollectedPhoneSchema = new mongoose.Schema(
  { approvedPhoneId: mongoose.Schema.Types.ObjectId, status: String },
  { strict: false, _id: true },
);

async function audit() {
  await mongoose.connect(MONGODB_URI, { autoIndex: false, autoCreate: false });
  const db = mongoose.connection.db;
  if (!db) { console.error('No database connection'); process.exit(1); }

  console.log('═══════════════════════════════════════════════');
  console.log('  PhoneDock — PhoneSpecs Audit Report');
  console.log('═══════════════════════════════════════════════\n');

  // 1. Total phones
  const totalPhones = await db.collection('phones').countDocuments({ active: true, status: 'published' });
  console.log(`Total active published phones: ${totalPhones}`);

  // 2. Phones with PhoneSpecs
  const phonesWithSpecs = await db.collection('phonespecs').distinct('phoneId');
  console.log(`PhoneSpecs documents: ${phonesWithSpecs.length}`);

  // 3. Phones without PhoneSpecs
  const allPhoneIds = await db.collection('phones')
    .find({ active: true, status: 'published' }, { projection: { _id: 1 } })
    .map((d: any) => d._id)
    .toArray();
  const allPhoneIdStrs = new Set(allPhoneIds.map((id: any) => id.toString()));
  const specIdStrs = new Set(phonesWithSpecs.map((id: any) => id.toString()));

  const missing: string[] = [];
  for (const idStr of allPhoneIdStrs) {
    if (!specIdStrs.has(idStr)) missing.push(idStr);
  }
  console.log(`Phones WITHOUT PhoneSpecs: ${missing.length}`);

  // 4. Orphan PhoneSpecs (phoneId doesn't match any active Phone)
  const orphans: string[] = [];
  for (const idStr of specIdStrs) {
    if (!allPhoneIdStrs.has(idStr)) orphans.push(idStr);
  }
  console.log(`Orphan PhoneSpecs (no matching Phone): ${orphans.length}`);

  // 5. Duplicate PhoneSpecs (same phoneId appears more than once)
  const specCounts = await db.collection('phonespecs').aggregate([
    { $group: { _id: '$phoneId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]).toArray();
  console.log(`Duplicate PhoneSpecs (same phoneId): ${specCounts.length}`);
  if (specCounts.length > 0) {
    for (const dup of specCounts) {
      const slug = await db.collection('phones').findOne({ _id: dup._id }, { projection: { slug: 1, modelName: 1 } });
      console.log(`  ⚠ phoneId=${dup._id} (${slug?.slug || 'unknown'}, ${slug?.modelName || '?'}) — ${dup.count} records`);
    }
  }

  // 6. PhoneSpecs with invalid phoneId
  const invalidSpecs = await db.collection('phonespecs').find({
    $or: [
      { phoneId: null },
      { phoneId: { $exists: false } },
      { phoneId: { $type: 'string' } },
    ],
  }).toArray();
  console.log(`PhoneSpecs with invalid phoneId: ${invalidSpecs.length}`);

  // 7. Phones with legacy spec fields on the Phone document
  const legacyFields = ['chipset','cpu','gpu','ram','storage','battery','mainCamera','selfieCamera','display','os','chargingSpeed','weight','dimensions'];
  const legacyPhones: any[] = [];
  const legacyCursor = db.collection('phones').find({ active: true, status: 'published' });
  let legacyCount = 0;
  for await (const doc of legacyCursor) {
    const found: string[] = [];
    for (const f of legacyFields) {
      if (doc[f] && typeof doc[f] === 'string' && doc[f].trim()) found.push(f);
    }
    if (found.length > 0) {
      legacyCount++;
      if (legacyCount <= 10) {
        legacyPhones.push({ slug: doc.slug, modelName: doc.modelName, fields: found });
      }
    }
  }
  console.log(`Phones with legacy spec fields: ${legacyCount}`);
  if (legacyPhones.length > 0) {
    for (const p of legacyPhones) {
      console.log(`  ✓ ${p.slug} (${p.modelName}) — ${p.fields.join(', ')}`);
    }
  }

  // 8. Backfill candidates: phones without PhoneSpecs but with CollectedPhone data
  const backfillCandidates: any[] = [];
  if (missing.length > 0) {
    const missingOids = missing.map(id => new mongoose.Types.ObjectId(id));
    const collectedMatches = await db.collection('collectedphones').find({
      approvedPhoneId: { $in: missingOids },
      status: { $in: ['approved', 'imported'] },
    }).toArray();

    // Check which of these have actual spec data
    const specSections = ['display','processor','memory','camera','battery','body','connectivity','software','sensors'];
    for (const c of collectedMatches) {
      let hasSpecData = false;
      for (const section of specSections) {
        const sub = c[section];
        if (sub && typeof sub === 'object' && Object.values(sub).some((v: any) => v && typeof v === 'string' && v.trim())) {
          hasSpecData = true;
          break;
        }
      }
      if (hasSpecData) {
        const phone = await db.collection('phones').findOne({ _id: c.approvedPhoneId }, { projection: { slug: 1, modelName: 1 } });
        backfillCandidates.push({
          phoneSlug: phone?.slug,
          phoneModel: phone?.modelName,
          collectedId: c._id,
          collectedSlug: c.slug,
        });
      }
    }
  }
  console.log(`Backfill candidates (CollectedPhone has specs, PhoneSpecs missing): ${backfillCandidates.length}`);
  if (backfillCandidates.length > 0) {
    for (const c of backfillCandidates.slice(0, 20)) {
      console.log(`  → ${c.phoneSlug} (${c.phoneModel}) — collected: ${c.collectedSlug}`);
    }
    if (backfillCandidates.length > 20) {
      console.log(`  ... and ${backfillCandidates.length - 20} more`);
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Total phones:              ${totalPhones}`);
  console.log(`  With PhoneSpecs:           ${totalPhones - missing.length}`);
  console.log(`  Without PhoneSpecs:        ${missing.length}`);
  console.log(`  Orphan specs:              ${orphans.length}`);
  console.log(`  Duplicate specs:           ${specCounts.length}`);
  console.log(`  Invalid phoneId specs:     ${invalidSpecs.length}`);
  console.log(`  Legacy field phones:       ${legacyCount}`);
  console.log(`  Backfill candidates:       ${backfillCandidates.length}`);
  console.log('═══════════════════════════════════════════════\n');

  if (backfillCandidates.length > 0) {
    console.log('Run the backfill script to create missing PhoneSpecs:');
    console.log('  npx tsx scripts/backfill-phone-specs.ts --apply\n');
  }

  await mongoose.disconnect();
}

audit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});