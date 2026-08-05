type PublicSettingsPayload = {
  settings?: Record<string, unknown>;
};

let cachedSettings: Record<string, unknown> | null = null;
let inFlight: Promise<Record<string, unknown> | null> | null = null;

/**
 * Header, Footer and analytics mount together on every public page. Sharing
 * this promise prevents three identical /api/settings function invocations.
 */
export function getPublicSettings(): Promise<Record<string, unknown> | null> {
  if (cachedSettings) return Promise.resolve(cachedSettings);
  if (inFlight) return inFlight;

  inFlight = fetch('/api/settings')
    .then(async response => {
      if (!response.ok) return null;
      const payload = await response.json() as PublicSettingsPayload;
      cachedSettings = payload.settings || null;
      return cachedSettings;
    })
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export function clearPublicSettingsCache(): void {
  cachedSettings = null;
  inFlight = null;
}
