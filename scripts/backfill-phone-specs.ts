/**
 * Phone Specs Backfill Script
 *
 * Creates missing PhoneSpecs documents from:
 *   1. CollectedPhone nested spec data (phones created via collector approval)
 *   2. Legacy flattened fields on the Phone document
 *
 * Safety:
 *   - Dry-run by default (no writes). Use --apply to write.
 *   - Batch processing (50 at a time).
 *   - Logs every changed phone.
 *   - No destructive deletes.
 *   - Idempotent (safe to run multiple times).
 *   - Skips phones that already have PhoneSpecs with valid data.
 *
 * Usage:
 *   npx tsx scripts/backfill-phone-specs.ts           # Dry-run (read-only)
 *   npx tsx scripts/backfill-phone-specs.ts --apply   # Actually write to DB
 */

import mongoose from 'mongoose';

const APPLY = process.argv.includes('--apply');
const MONGODB_URI = process.env.MONGODB_URI || '';
if (!MONGODB_URI) {
  console.error('MONGODB_URI environment variable is required');
  process.exit(1);
}

// ── CollectedPhone nested → flat mapping ──
const COLLECTED_TO_SPECS: Record<string, Record<string, string>> = {
  display: { size: 'display', type: 'displayType', resolution: 'resolution', refreshRate: 'refreshRate', brightness: 'brightness', protection: 'protection' },
  processor: { chipset: 'chipset', cpu: 'cpu', gpu: 'gpu', process: 'process' },
  memory: { ram: 'ram', ramType: 'ramType', storage: 'storage', cardSlot: 'cardSlot' },
  camera: { rearModules: 'mainCamera', frontCamera: 'selfieCamera', aperture: 'aperture', ois: 'ois', eis: 'eis', zoom: 'zoom', videoRecording: 'videoRecording', cameraFeatures: 'cameraFeatures', sensorSize: 'mainCameraSensor' },
  battery: { capacity: 'battery', wiredCharging: 'chargingSpeed', wirelessCharging: 'wirelessCharge', reverseCharging: 'reverseCharge', type: 'charging' },
  body: { dimensions: 'dimensions', weight: 'weight', build: 'build', waterResistance: 'ipRating', colors: 'colors', sim: 'sim' },
  connectivity: { network: 'network', fiveG: 'fiveG', wifi: 'wifi', bluetooth: 'bluetooth', nfc: 'nfc', usb: 'usb', infrared: 'infrared' },
  software: { os: 'os', osVersion: 'osVersion', osUI: 'osUI', updatePolicy: 'updatePolicy' },
  sensors: { fingerprint: 'fingerprint' },
};

function isValid(val: unknown): boolean {
  if (val == null) return false;
  if (typeof val === 'string') {
    const t = val.trim();
    return t.length > 0 && t.toLowerCase() !== 'n/a' && t.toLowerCase() !== 'not available';
  }
  if (typeof val === 'number') return val > 0;
  return true;
}

function flattenCollectedSpecs(collected: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [section, fieldMap] of Object.entries(COLLECTED_TO_SPECS)) {
    const sub = collected[section];
    if (!sub || typeof sub !== 'object') continue;
    for (const [src, dst] of Object.entries(fieldMap)) {
      const val = sub[src];
      if (isValid(val)) out[dst] = String(val).trim();
    }
  }
  return out;
}

const LEGACY_FIELDS = ['display','displayType','resolution','refreshRate','protection','brightness',
  'chipset','cpu','gpu','process','ram','ramType','storage','cardSlot',
  'mainCamera','mainCameraSensor','aperture','ois','eis','ultrawide','telephoto','zoom','cameraFeatures','videoRecording',
  'selfieCamera','selfieSensor','selfieVideo',
  'battery','charging','chargingSpeed','wirelessCharge','wirelessSpeed','reverseCharge',
  'weight','dimensions','build','sim','ipRating','network','fiveG','wifi','bluetooth','nfc','usb','infrared',
  'fingerprint','faceUnlock','sensors','colors',
  'os','osVersion','osUI','updatePolicy','specialFeatures'];

async function backfill() {
  await mongoose.connect(MONGODB_URI, { autoIndex: false, autoCreate: false });
  const db = mongoose.connection.db;
  if (!db) { console.error('No database connection'); process.exit(1); }

  console.log(APPLY
    ? '═══ RUNNING IN APPLY MODE (writes to DB) ═══\n'
    : '═══ RUNNING IN DRY-RUN MODE (no writes) ═══\n');

  // Find all active published phones
  const phones = await db.collection('phones')
    .find({ active: true, status: 'published' })
    .project({ _id: 1, slug: 1, modelName: 1 })
    .toArray();

  // Get all phoneIds that already have PhoneSpecs
  const existingSpecs = new Set(
    (await db.collection('phonespecs').find({}, { projection: { phoneId: 1 } }).toArray())
      .map((d: any) => d.phoneId?.toString())
  );

  // Get all CollectedPhone docs linked to approved phones
  const collectedByPhoneId = new Map<string, any>();
  const collectedDocs = await db.collection('collectedphones').find({
    approvedPhoneId: { $exists: true, $ne: null },
    status: { $in: ['approved', 'imported'] },
  }).toArray();
  for (const c of collectedDocs) {
    if (c.approvedPhoneId) {
      collectedByPhoneId.set(c.approvedPhoneId.toString(), c);
    }
  }

  let created = 0;
  let skipped = 0;
  let errors = 0;

  const BATCH_SIZE = 50;
  const batches: any[][] = [];
  for (let i = 0; i < phones.length; i += BATCH_SIZE) {
    batches.push(phones.slice(i, i + BATCH_SIZE));
  }

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    for (const phone of batch) {
      const phoneIdStr = phone._id.toString();

      // Skip if PhoneSpecs already exists
      if (existingSpecs.has(phoneIdStr)) {
        skipped++;
        continue;
      }

      try {
        // Source 1: CollectedPhone nested data
        let specData: Record<string, string> | null = null;
        const collected = collectedByPhoneId.get(phoneIdStr);
        if (collected) {
          const flat = flattenCollectedSpecs(collected);
          if (Object.keys(flat).length > 0) specData = flat;
        }

        // Source 2: Legacy fields on Phone document (fetch full doc)
        if (!specData) {
          const fullPhone = await db.collection('phones').findOne({ _id: phone._id });
          if (fullPhone) {
            const legacy: Record<string, string> = {};
            for (const f of LEGACY_FIELDS) {
              if (isValid(fullPhone[f])) legacy[f] = String(fullPhone[f]).trim();
            }
            if (Object.keys(legacy).length > 0) specData = legacy;
          }
        }

        if (!specData || Object.keys(specData).length === 0) {
          skipped++;
          continue;
        }

        if (APPLY) {
          await db.collection('phonespecs').updateOne(
            { phoneId: phone._id },
            { $set: { phoneId: phone._id, ...specData } },
            { upsert: true },
          );
        }

        created++;
        console.log(`${APPLY ? '✓ CREATED' : '○ WOULD CREATE'} specs for ${phone.slug} (${phone.modelName}) — ${Object.keys(specData).length} fields from ${collected ? 'CollectedPhone' : 'legacy Phone fields'}`);
      } catch (err: any) {
        errors++;
        console.error(`✗ FAILED ${phone.slug}: ${err.message}`);
      }
    }

    if (bi < batches.length - 1) {
      console.log(`  ... processed ${bi * BATCH_SIZE + batch.length}/${phones.length}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log(`  Created (or would create): ${created}`);
  console.log(`  Skipped (already have specs): ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log(APPLY ? '  Mode: APPLY (changes written)' : '  Mode: DRY-RUN (no changes made)');
  console.log('═══════════════════════════════════════════════\n');

  await mongoose.disconnect();
}

backfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});