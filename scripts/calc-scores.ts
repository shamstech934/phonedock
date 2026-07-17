/**
 * Phone Score Calculator — PhoneDock
 *
 * Calculates performanceScore, cameraScore, batteryScore, displayScore, valueScore, overallRating
 * for all published phones based on their specs and benchmarks.
 *
 * Usage: npx tsx scripts/calc-scores.ts
 *        npx tsx scripts/calc-scores.ts --dry-run   (preview only, no writes)
 */

import mongoose from 'mongoose';
import { loadScriptEnv, validateMongoUri } from '../src/lib/mongodb-env';
loadScriptEnv();

const MONGODB_URI = process.env.MONGODB_URI || '';
const _uriV = validateMongoUri(MONGODB_URI);
if (!_uriV.valid) {
  console.error('ERROR: %s', _uriV.error);
  process.exit(1);
}

import { Phone } from '../src/lib/models/Phone';
import { PhoneSpecs } from '../src/lib/models/PhoneSpecs';
import { PhoneBenchmark } from '../src/lib/models/PhoneSub';

const DRY_RUN = process.argv.includes('--dry-run');

// ============ CHIPSET TIER MAP ============
const CHIPSET_TIERS: Record<string, number> = {
  // Apple
  'a17 pro': 98, 'a17': 97, 'a16 bionic': 94, 'a16': 93,
  'a15 bionic': 88, 'a15': 87, 'a14 bionic': 82, 'a14': 81,
  'a13 bionic': 75, 'a13': 74,

  // Snapdragon
  'snapdragon 8 gen 4': 99, 'snapdragon 8 elite': 99, 'snapdragon 8 gen 3': 96,
  'snapdragon 8 gen 2': 91, 'snapdragon 8+ gen 1': 89, 'snapdragon 8 gen 1': 86,
  'snapdragon 888': 83, 'snapdragon 870': 80, 'snapdragon 865': 77,
  'snapdragon 7+ gen 3': 85, 'snapdragon 7+ gen 2': 78, 'snapdragon 7+ gen 1': 72,
  'snapdragon 7 gen 3': 76, 'snapdragon 7 gen 2': 70, 'snapdragon 7 gen 1': 65,
  'snapdragon 6 gen 1': 60, 'snapdragon 6 gen 2': 62,
  'snapdragon 695': 55, 'snapdragon 690': 50, 'snapdragon 685': 48,
  'snapdragon 480': 42, 'snapdragon 4 gen 2': 45, 'snapdragon 4 gen 1': 40,

  // Dimensity
  'dimensity 9400': 97, 'dimensity 9300': 95, 'dimensity 9300+': 96,
  'dimensity 9200+': 92, 'dimensity 9200': 89, 'dimensity 9000+': 88,
  'dimensity 9000': 85, 'dimensity 8300': 78, 'dimensity 8300-ultra': 79,
  'dimensity 8200': 76, 'dimensity 8100': 72, 'dimensity 8000': 70,
  'dimensity 7300': 60, 'dimensity 7200': 58, 'dimensity 7200-pro': 59,
  'dimensity 7050': 52, 'dimensity 7000': 50, 'dimensity 6080': 45,
  'dimensity 6100+': 47,

  // Exynos
  'exynos 2400': 90, 'exynos 2300': 84, 'exynos 2200': 81,
  'exynos 2100': 78, 'exynos 1380': 55, 'exynos 1280': 50,
  'exynos 1080': 58,

  // HiSilicon Kirin
  'kirin 9010': 92, 'kirin 9000s': 85, 'kirin 9000': 82,
  'kirin 820': 60, 'kirin 710a': 45,

  // Google Tensor
  'tensor g4': 90, 'tensor g3': 87, 'tensor g2': 82, 'tensor': 76,

  // Unisoc
  'unisoc t616': 38, 'unisoc t612': 36, 'unisoc t606': 35,
  'unisoc t820': 50, 'unisoc t740': 42, 'unisoc t765': 48,
  'unisoc tiger t612': 36, 'unisoc tiger t616': 38,
  'spreadtrum sc9863a': 25, 'unisoc sc9863a': 25,
};

// ============ CAMERA SENSOR TIER MAP ============
const SENSOR_TIERS: Record<string, number> = {
  // Flagship sensors
  'lyt-900': 98, 'lyt900': 98, 'imx989': 97, 'gn2': 95, 'hmx': 94,
  'lyt-t808': 93, 'imx888': 92, 'gn3': 91, 'imx982': 90,
  'imx890': 88, 'imx800': 87, 'imx787': 85,
  // Upper-mid
  'imx766': 84, 'imx866': 85, 'gn5': 83, 'ov64b': 80, 'ov64c': 79,
  'lyt-600': 78, 'imx689': 82, 'imx682': 80,
  // Mid-range
  'imx586': 72, 'imx582': 70, 'gw1': 68, 'gm1': 66,
  'ov64b': 75, 'ov50d': 73, 'ov50e': 74,
  // Budget
  'imx482': 55, 'imx481': 52, 'ov48b': 50, 'gc5035': 45, 's5kgm2': 55,
};

// ============ HELPER FUNCTIONS ============

function parseNum(str: string | null | undefined): number {
  if (!str) return 0;
  const match = str.replace(/,/g, '').match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

function matchChipset(chipset: string): number {
  if (!chipset) return 0;
  const lower = chipset.toLowerCase().replace(/\s+/g, ' ').trim();

  // Direct match first
  if (CHIPSET_TIERS[lower]) return CHIPSET_TIERS[lower];

  // Partial/fuzzy match — try longer keys first
  const sortedKeys = Object.keys(CHIPSET_TIERS).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (lower.includes(key)) return CHIPSET_TIERS[key];
  }

  // Generic tier fallback based on keywords
  if (/snapdragon\s*8/i.test(lower)) return 80;
  if (/snapdragon\s*7/i.test(lower)) return 65;
  if (/snapdragon\s*6/i.test(lower)) return 50;
  if (/snapdragon\s*4/i.test(lower)) return 38;
  if (/dimensity\s*9/i.test(lower)) return 85;
  if (/dimensity\s*8/i.test(lower)) return 70;
  if (/dimensity\s*7/i.test(lower)) return 55;
  if (/exynos\s*2/i.test(lower)) return 80;
  if (/a1[5-9]\s*bi/i.test(lower) || /a1[5-9] pro/i.test(lower)) return 88;
  if (/a1[0-4]\s*bi/i.test(lower)) return 75;
  if (/tensor\s*g/i.test(lower)) return 82;
  if (/kirin\s*9/i.test(lower)) return 80;
  if (/helio\s*g99/i.test(lower)) return 52;
  if (/helio\s*g9[5-8]/i.test(lower)) return 55;
  if (/helio\s*g8/i.test(lower)) return 48;
  if (/helio\s*g7/i.test(lower)) return 40;
  if (/helio\s*g6/i.test(lower)) return 32;
  if (/unisoc/i.test(lower) || /spreadtrum/i.test(lower)) return 30;
  if (/mediatek/i.test(lower) || /mtk/i.test(lower)) return 40;

  return 0; // Unknown
}

function matchSensor(sensor: string): number {
  if (!sensor) return 0;
  const lower = sensor.toLowerCase().replace(/\s+/g, '').trim();
  const sortedKeys = Object.keys(SENSOR_TIERS).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (lower.includes(key.replace(/-/g, ''))) return SENSOR_TIERS[key];
  }
  return 0;
}

// ============ SCORE CALCULATORS ============

function calcPerformanceScore(
  chipset: string,
  ramGB: number | null,
  cpu: string,
  benchmark: { antutu: number; geekbenchSingle: number; geekbenchMulti: number; gamingScore: number } | null,
): number {
  let score = 0;
  let factors = 0;

  // Chipset tier (weight: 40%)
  const chipsetTier = matchChipset(chipset);
  if (chipsetTier > 0) {
    score += chipsetTier * 0.40;
    factors++;
  }

  // AnTuTu benchmark (weight: 30%)
  if (benchmark?.antutu && benchmark.antutu > 0) {
    // Map: 100k → ~25, 500k → ~55, 1M → ~75, 2M+ → ~95
    const antutuNorm = Math.min(100, (Math.log10(benchmark.antutu) - 4.5) * 33);
    score += antutuNorm * 0.30;
    factors++;
  }

  // Geekbench Single (weight: 15%)
  if (benchmark?.geekbenchSingle && benchmark.geekbenchSingle > 0) {
    const gbNorm = Math.min(100, (Math.log10(benchmark.geekbenchSingle) - 2) * 40);
    score += gbNorm * 0.15;
    factors++;
  }

  // RAM contribution (weight: 10%)
  if (ramGB && ramGB > 0) {
    const ramNorm = Math.min(100, ramGB * 7); // 4GB→28, 8GB→56, 12GB→84, 16GB→100
    score += ramNorm * 0.10;
    factors++;
  }

  // CPU cores hint (weight: 5%)
  if (cpu) {
    const coreMatch = cpu.match(/(\d+)\s*core/i);
    const cores = coreMatch ? parseInt(coreMatch[1]) : 0;
    if (cores >= 8) { score += 5 * 0.05 * 20; factors++; } // 1.0
    else if (cores >= 6) { score += 3 * 0.05 * 20; factors++; } // 0.6
    else if (cores > 0) { score += 0.3; factors++; }
  }

  // Gaming score bonus
  if (benchmark?.gamingScore && benchmark.gamingScore > 0) {
    score += Math.min(100, benchmark.gamingScore) * 0.05;
    factors++;
  }

  // If no data at all, return 0
  if (factors === 0) return 0;

  // Normalize: if only chipset known, use it directly (capped)
  if (factors === 1 && chipsetTier > 0) return Math.min(100, chipsetTier);

  return Math.round(Math.min(100, Math.max(0, score)));
}

function calcCameraScore(
  mainCameraMP: number | null,
  mainCamera: string,
  mainCameraSensor: string,
  aperture: string,
  ois: string,
  eis: string,
  ultrawide: string,
  telephoto: string,
  selfieCamera: string,
  selfieSensor: string,
  videoRecording: string,
): number {
  let score = 0;
  let maxPossible = 0;

  // 1. Main camera megapixels (max 15 points)
  maxPossible += 15;
  if (mainCameraMP && mainCameraMP > 0) {
    score += Math.min(15, mainCameraMP * 0.6); // 50MP → ~12, 200MP → 15
  }

  // 2. Sensor quality (max 20 points)
  maxPossible += 20;
  const sensorTier = matchSensor(mainCameraSensor);
  if (sensorTier > 0) {
    score += (sensorTier / 100) * 20;
  }

  // 3. Aperture (max 10 points)
  maxPossible += 10;
  if (aperture) {
    const apMatch = aperture.match(/f\/?([\d.]+)/i);
    if (apMatch) {
      const fNum = parseFloat(apMatch[1]);
      if (fNum > 0 && fNum <= 2.0) score += 10;
      else if (fNum <= 2.4) score += 8;
      else if (fNum <= 2.8) score += 6;
      else if (fNum <= 3.5) score += 4;
      else score += 2;
    }
  }

  // 4. OIS (max 12 points)
  maxPossible += 12;
  if (ois && /yes|optical|sensor.?shift|gyro/i.test(ois)) {
    score += 12;
  }

  // 5. EIS bonus (max 3 points)
  maxPossible += 3;
  if (eis && /yes|electronic/i.test(eis)) {
    score += 3;
  }

  // 6. Ultrawide camera (max 12 points)
  maxPossible += 12;
  if (ultrawide) {
    const uwMP = parseNum(ultrawide);
    if (uwMP >= 12) score += 12;
    else if (uwMP >= 8) score += 9;
    else if (uwMP >= 5) score += 6;
    else if (uwMP > 0) score += 3;
  }

  // 7. Telephoto / periscope (max 12 points)
  maxPossible += 12;
  if (telephoto) {
    const telMatch = telephoto.match(/(\d+)x/i);
    const telMP = parseNum(telephoto);
    if (telMatch) {
      const zoom = parseInt(telMatch[1]);
      if (zoom >= 5) score += 12; // Periscope
      else if (zoom >= 3) score += 9;
      else score += 6;
    } else if (telMP > 0) {
      score += 5;
    }
  }

  // 8. Selfie camera (max 8 points)
  maxPossible += 8;
  const selfieMP = parseNum(selfieCamera);
  if (selfieMP >= 32) score += 8;
  else if (selfieMP >= 16) score += 6;
  else if (selfieMP >= 12) score += 5;
  else if (selfieMP >= 8) score += 3;
  else if (selfieMP > 0) score += 1;

  // 9. Video recording (max 8 points)
  maxPossible += 8;
  if (videoRecording) {
    const lower = videoRecording.toLowerCase();
    if (/8k/i.test(lower)) score += 8;
    else if (/4k.*60/i.test(lower)) score += 7;
    else if (/4k/i.test(lower)) score += 5;
    else if (/1080p.*60/i.test(lower)) score += 3;
    else if (/1080p/i.test(lower)) score += 2;
  }

  if (maxPossible === 0) return 0;

  return Math.round(Math.min(100, (score / maxPossible) * 100));
}

function calcBatteryScore(
  batteryMAh: number | null,
  chargingSpeed: string,
  wirelessCharge: string,
  wirelessSpeed: string,
  reverseCharge: string,
): number {
  let score = 0;

  // 1. Battery capacity (max 40 points)
  if (batteryMAh && batteryMAh > 0) {
    // Sweet spot: 5000mAh = 40pts, 4000 = 30, 6000 = 38, 3000 = 20
    const cap = batteryMAh;
    if (cap >= 5500) score += 38;
    else if (cap >= 5000) score += 40;
    else if (cap >= 4500) score += 35;
    else if (cap >= 4000) score += 30;
    else if (cap >= 3500) score += 22;
    else if (cap >= 3000) score += 15;
    else score += 8;
  }

  // 2. Charging speed (max 35 points)
  const chargeW = parseNum(chargingSpeed);
  if (chargeW > 0) {
    if (chargeW >= 120) score += 35;
    else if (chargeW >= 100) score += 32;
    else if (chargeW >= 67) score += 28;
    else if (chargeW >= 45) score += 24;
    else if (chargeW >= 33) score += 20;
    else if (chargeW >= 25) score += 15;
    else if (chargeW >= 18) score += 10;
    else score += 5;
  }

  // 3. Wireless charging (max 15 points)
  if (wirelessCharge && /yes|supported|qi/i.test(wirelessCharge)) {
    const wWatts = parseNum(wirelessSpeed);
    if (wWatts >= 15) score += 15;
    else if (wWatts >= 10) score += 12;
    else score += 8;
  }

  // 4. Reverse charging (max 10 points)
  if (reverseCharge && /yes|supported|wireless/i.test(reverseCharge)) {
    score += 10;
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

function calcDisplayScore(
  displayType: string,
  screenSizeInch: number | null,
  resolution: string,
  refreshRate: string,
  brightness: string,
  protection: string,
): number {
  let score = 0;

  // 1. Display type (max 20 points)
  if (displayType) {
    const dt = displayType.toLowerCase();
    if (/ltpo.*amoled|dynamic.*amoled/i.test(dt)) score += 20;
    else if (/amoled|oled|super.*amoled/i.test(dt)) score += 18;
    else if (/ips.*lcd|tft.*lcd/i.test(dt)) score += 10;
    else if (/lcd/i.test(dt)) score += 8;
    else score += 5;
  }

  // 2. Screen size (max 10 points) — sweet spot 6.4-6.8"
  if (screenSizeInch && screenSizeInch > 0) {
    if (screenSizeInch >= 6.4 && screenSizeInch <= 6.8) score += 10;
    else if (screenSizeInch >= 6.0 && screenSizeInch <= 7.2) score += 8;
    else if (screenSizeInch >= 5.5) score += 5;
    else score += 3;
  }

  // 3. Resolution (max 20 points)
  if (resolution) {
    const r = resolution.toLowerCase();
    if (/2k|1440p|qhd|2560.*1440|1440.*2560/i.test(r)) score += 20;
    else if (/1080p|fhd|full.?hd|2400.*1080|1080.*2400/i.test(r)) score += 15;
    else if (/720p|hd\+/i.test(r)) score += 8;
    else score += 5;
  }

  // 4. Refresh rate (max 25 points)
  if (refreshRate) {
    const rr = parseNum(refreshRate);
    if (rr >= 120) score += 25;
    else if (rr >= 90) score += 18;
    else if (rr >= 60) score += 10;
    else if (rr > 0) score += 5;
  }

  // 5. Peak brightness (max 15 points)
  if (brightness) {
    // Handle "2000 nits peak" or "1000 nits (HBM)"
    const nits = parseNum(brightness);
    if (nits >= 2000) score += 15;
    else if (nits >= 1500) score += 13;
    else if (nits >= 1000) score += 10;
    else if (nits >= 700) score += 7;
    else if (nits >= 400) score += 4;
    else if (nits > 0) score += 2;
  }

  // 6. Protection (max 10 points)
  if (protection) {
    const p = protection.toLowerCase();
    if (/victus\s*2/i.test(p)) score += 10;
    else if (/victus/i.test(p)) score += 9;
    else if (/gorilla\s*glass/i.test(p)) {
      const ver = parseNum(protection);
      if (ver >= 5) score += 8;
      else score += 6;
    }
    else if (/scratch.?resist/i.test(p)) score += 4;
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

function calcValueScore(
  performanceScore: number,
  cameraScore: number,
  batteryScore: number,
  displayScore: number,
  pricePKR: number,
): number {
  if (pricePKR <= 0) return 0;

  // Average quality score
  const quality = (performanceScore + cameraScore + batteryScore + displayScore) / 4;

  // Price segments with expected quality thresholds
  let expectedQuality: number;
  if (pricePKR <= 30000) expectedQuality = 30;      // Budget
  else if (pricePKR <= 60000) expectedQuality = 50;  // Mid-range
  else if (pricePKR <= 100000) expectedQuality = 65; // Upper-mid
  else if (pricePKR <= 200000) expectedQuality = 80; // Flagship
  else expectedQuality = 90;                         // Ultra-premium

  // Value = how much you get ABOVE expected for your price
  const excess = quality - expectedQuality;
  let value = 50 + (excess * 1.5); // 50 is average value, scale excess

  return Math.round(Math.min(100, Math.max(0, value)));
}

function calcOverallRating(
  performanceScore: number,
  cameraScore: number,
  batteryScore: number,
  displayScore: number,
  valueScore: number,
): number {
  // Weighted average: Performance 25%, Camera 25%, Battery 20%, Display 15%, Value 15%
  const overall =
    performanceScore * 0.25 +
    cameraScore * 0.25 +
    batteryScore * 0.20 +
    displayScore * 0.15 +
    valueScore * 0.15;

  return Math.round(Math.min(100, Math.max(0, overall)));
}

// ============ MAIN ============

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   PhoneDock — Phone Score Calculator        ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(DRY_RUN ? '⏳  DRY RUN — no changes will be written\n' : '✏️  LIVE MODE — scores will be updated\n');

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB.');

  // Fetch all published phones
  const phones = await Phone.find({ active: true, status: 'published' }).select('_id modelName slug pricePKR').lean();
  console.log(`Found ${phones.length} published phones.\n`);

  if (phones.length === 0) {
    console.log('No phones to process. Exiting.');
    await mongoose.disconnect();
    return;
  }

  // Fetch all specs in bulk
  const phoneIds = phones.map(p => p._id);
  const specsList = await PhoneSpecs.find({ phoneId: { $in: phoneIds } }).lean();
  const specsMap = new Map(specsList.map(s => [s.phoneId.toString(), s]));

  // Fetch all benchmarks in bulk
  const benchList = await PhoneBenchmark.find({ phoneId: { $in: phoneIds } }).lean();
  const benchMap = new Map(benchList.map(b => [b.phoneId.toString(), b]));

  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let totalPerf = 0, totalCam = 0, totalBat = 0, totalDisp = 0;

  for (const phone of phones) {
    try {
      const pid = phone._id.toString();
      const specs = specsMap.get(pid);
      const bench = benchMap.get(pid) || null;

      if (!specs) {
        skipped++;
        continue;
      }

      // Calculate scores
      const performanceScore = calcPerformanceScore(
        specs.chipset,
        specs.ramGB,
        specs.cpu,
        bench ? { antutu: bench.antutu, geekbenchSingle: bench.geekbenchSingle, geekbenchMulti: bench.geekbenchMulti, gamingScore: bench.gamingScore } : null,
      );

      const cameraScore = calcCameraScore(
        specs.mainCameraMP,
        specs.mainCamera,
        specs.mainCameraSensor,
        specs.aperture,
        specs.ois,
        specs.eis,
        specs.ultrawide,
        specs.telephoto,
        specs.selfieCamera,
        specs.selfieSensor,
        specs.videoRecording,
      );

      const batteryScore = calcBatteryScore(
        specs.batteryMAh,
        specs.chargingSpeed,
        specs.wirelessCharge,
        specs.wirelessSpeed,
        specs.reverseCharge,
      );

      const displayScore = calcDisplayScore(
        specs.displayType,
        specs.screenSizeInch,
        specs.resolution,
        specs.refreshRate,
        specs.brightness,
        specs.protection,
      );

      const valueScore = calcValueScore(
        performanceScore,
        cameraScore,
        batteryScore,
        displayScore,
        phone.pricePKR,
      );

      const overallRating = calcOverallRating(
        performanceScore,
        cameraScore,
        batteryScore,
        displayScore,
        valueScore,
      );

      // Skip if all scores are 0 (not enough data)
      if (performanceScore === 0 && cameraScore === 0 && batteryScore === 0 && displayScore === 0) {
        skipped++;
        console.log(`  ⏭  ${phone.modelName} — no usable spec data, skipped`);
        continue;
      }

      totalPerf += performanceScore;
      totalCam += cameraScore;
      totalBat += batteryScore;
      totalDisp += displayScore;

      if (DRY_RUN) {
        console.log(`  📊 ${phone.modelName}: perf=${performanceScore} cam=${cameraScore} bat=${batteryScore} disp=${displayScore} val=${valueScore} overall=${overallRating}`);
      } else {
        await Phone.updateOne(
          { _id: phone._id },
          {
            $set: {
              performanceScore,
              cameraScore,
              batteryScore,
              displayScore,
              valueScore,
              overallRating,
            },
          },
        );
        console.log(`  ✅ ${phone.modelName}: perf=${performanceScore} cam=${cameraScore} bat=${batteryScore} disp=${displayScore} val=${valueScore} overall=${overallRating}`);
      }

      updated++;
    } catch (err: any) {
      errors++;
      console.error(`  ❌ ${phone.modelName}: ${err.message}`);
    }
  }

  // Summary
  const scored = updated || 1;
  console.log('\n══════════════════════════════════════════════');
  console.log(`  Total phones:    ${phones.length}`);
  console.log(`  Updated/Scored:  ${updated}`);
  console.log(`  Skipped:         ${skipped}`);
  console.log(`  Errors:          ${errors}`);
  console.log(`  ─────────────────────────────────────────────`);
  console.log(`  Avg Performance: ${Math.round(totalPerf / scored)}`);
  console.log(`  Avg Camera:      ${Math.round(totalCam / scored)}`);
  console.log(`  Avg Battery:     ${Math.round(totalBat / scored)}`);
  console.log(`  Avg Display:     ${Math.round(totalDisp / scored)}`);
  console.log('══════════════════════════════════════════════');

  if (DRY_RUN) {
    console.log('\n⏳  DRY RUN complete. Run without --dry-run to apply.');
  } else {
    console.log('\n✅  All scores updated successfully!');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});