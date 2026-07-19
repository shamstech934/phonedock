/**
 * Server-side spec normalizer — single source of truth for merging specs from
 * multiple sources into the flat PhoneSpecs shape used by the frontend.
 *
 * Priority order (first valid value wins):
 *   1. PhoneSpecs child document (canonical)
 *   2. Phone document legacy flattened fields (pre-schema-migration data)
 *   3. CollectedPhone nested sub-documents (collector pipeline data)
 *
 * Rules:
 *   - Never replace a valid value with null, empty string, undefined, or "N/A"
 *   - Numeric SPECS_FIELDS values are converted to strings
 *   - PhoneSpecs document always takes priority when its value is valid
 */

// All valid spec field names (must match PhoneSpecs schema)
const SPECS_FIELDS = [
  'display','displayType','resolution','refreshRate','protection','brightness',
  'chipset','cpu','gpu','process','ram','ramType','storage','cardSlot',
  'mainCamera','mainCameraSensor','aperture','ois','eis','ultrawide','telephoto','zoom','cameraFeatures','videoRecording',
  'selfieCamera','selfieSensor','selfieVideo',
  'battery','charging','chargingSpeed','wirelessCharge','wirelessSpeed','reverseCharge',
  'weight','dimensions','build','sim','ipRating','network','fiveG','wifi','bluetooth','nfc','usb','infrared',
  'fingerprint','faceUnlock','sensors','colors',
  'os','osVersion','osUI','updatePolicy','specialFeatures',
] as const;

const NUMERIC_FIELDS = ['ramGB','storageGB','screenSizeInch','mainCameraMP','batteryMAh'] as const;

/** Check if a value is "valid" — not empty/null/undefined/N/A */
function isValid(val: unknown): boolean {
  if (val == null) return false;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed.length > 0 && trimmed.toLowerCase() !== 'n/a' && trimmed.toLowerCase() !== 'not available';
  }
  if (typeof val === 'number') return val > 0;
  return true;
}

/** Convert any value to a string suitable for spec display */
function toSpecString(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (Array.isArray(val)) return val.map(toSpecString).filter(Boolean).join(', ');
  if (typeof val === 'object') {
    try {
      return Object.values(val as Record<string, unknown>)
        .map(toSpecString)
        .filter(Boolean)
        .join(', ');
    } catch { return ''; }
  }
  return String(val);
}

/** Mapping from CollectedPhone nested sub-doc fields to flat PhoneSpecs fields */
const COLLECTED_TO_SPECS: Record<string, Record<string, string>> = {
  display: {
    size: 'display',
    type: 'displayType',
    resolution: 'resolution',
    refreshRate: 'refreshRate',
    brightness: 'brightness',
    protection: 'protection',
  },
  processor: {
    chipset: 'chipset',
    cpu: 'cpu',
    gpu: 'gpu',
    process: 'process',
  },
  memory: {
    ram: 'ram',
    ramType: 'ramType',
    storage: 'storage',
    cardSlot: 'cardSlot',
  },
  camera: {
    rearModules: 'mainCamera',
    frontCamera: 'selfieCamera',
    aperture: 'aperture',
    ois: 'ois',
    eis: 'eis',
    zoom: 'zoom',
    videoRecording: 'videoRecording',
    cameraFeatures: 'cameraFeatures',
    sensorSize: 'mainCameraSensor',
  },
  battery: {
    capacity: 'battery',
    wiredCharging: 'chargingSpeed',
    wirelessCharging: 'wirelessCharge',
    reverseCharging: 'reverseCharge',
    type: 'charging',
  },
  body: {
    dimensions: 'dimensions',
    weight: 'weight',
    build: 'build',
    waterResistance: 'ipRating',
    colors: 'colors',
    sim: 'sim',
  },
  connectivity: {
    network: 'network',
    fiveG: 'fiveG',
    wifi: 'wifi',
    bluetooth: 'bluetooth',
    nfc: 'nfc',
    usb: 'usb',
    infrared: 'infrared',
  },
  software: {
    os: 'os',
    osVersion: 'osVersion',
    osUI: 'osUI',
    updatePolicy: 'updatePolicy',
  },
  sensors: {
    fingerprint: 'fingerprint',
  },
};

/**
 * Flatten a CollectedPhone document's nested spec sections into the flat
 * PhoneSpecs shape. Returns an object with only valid, non-empty values.
 */
export function flattenCollectedPhoneSpecs(collected: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [section, fieldMap] of Object.entries(COLLECTED_TO_SPECS)) {
    const sub = collected[section];
    if (!sub || typeof sub !== 'object') continue;
    for (const [srcField, dstField] of Object.entries(fieldMap)) {
      const val = sub[srcField];
      if (isValid(val)) {
        out[dstField] = toSpecString(val);
      }
    }
  }
  // Also map selfieSensor from camera section if present
  if (collected.camera?.frontCamera) {
    // Already mapped above
  }
  return out;
}

/**
 * Main normalization function. Merges specs from multiple sources.
 *
 * @param phoneSpecsDoc - The PhoneSpecs child document (from DB). Takes priority.
 * @param phoneDoc - The raw Phone document (may contain legacy flattened fields).
 *                   Pass a lean() doc to access all fields including non-schema ones.
 * @param collectedDoc - Optional CollectedPhone document with nested specs.
 * @returns A flat Record<string, string> with the normalized specs, or null if no data.
 */
export function normalizePhoneSpecs(
  phoneSpecsDoc: Record<string, any> | null | undefined,
  phoneDoc?: Record<string, any> | null,
  collectedDoc?: Record<string, any> | null,
): Record<string, string> | null {
  // Build a priority-merged map
  const merged: Record<string, string> = {};

  // Layer 3 (lowest priority): CollectedPhone nested data
  if (collectedDoc) {
    const flat = flattenCollectedPhoneSpecs(collectedDoc);
    for (const [k, v] of Object.entries(flat)) {
      merged[k] = v;
    }
  }

  // Layer 2: Legacy fields on the Phone document itself
  if (phoneDoc) {
    for (const f of SPECS_FIELDS) {
      if (isValid(phoneDoc[f])) {
        merged[f] = toSpecString(phoneDoc[f]);
      }
    }
  }

  // Layer 1 (highest priority): PhoneSpecs child document
  if (phoneSpecsDoc) {
    for (const f of SPECS_FIELDS) {
      if (isValid(phoneSpecsDoc[f])) {
        merged[f] = toSpecString(phoneSpecsDoc[f]);
      }
    }
    // Also include numeric fields if valid
    for (const f of NUMERIC_FIELDS) {
      if (phoneSpecsDoc[f] != null && phoneSpecsDoc[f] !== '') {
        (merged as any)[f] = phoneSpecsDoc[f];
      }
    }
  }

  // Check if we have any actual data
  const hasData = SPECS_FIELDS.some(f => isValid(merged[f]));
  if (!hasData) return null;

  return merged;
}

/**
 * Convert the normalized specs into the format expected by serializePhoneSpecs.
 * This ensures backward compatibility with existing code.
 */
export function normalizedToSerialized(normalized: Record<string, string>): Record<string, string | number | null> {
  const result: Record<string, string | number | null> = {};
  for (const f of SPECS_FIELDS) {
    const val = normalized[f];
    result[f] = isValid(val) ? val : '';
  }
  for (const f of NUMERIC_FIELDS) {
    const val = (normalized as any)[f];
    result[f] = (val !== undefined && val !== null) ? val : null;
  }
  return result;
}