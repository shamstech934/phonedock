export type AIResearchMode = 'off' | 'lite' | 'standard';

function boundedInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function getAIResearchPolicy() {
  const rawMode = String(process.env.AI_RESEARCH_MODE || 'lite').trim().toLowerCase();
  const mode: AIResearchMode = rawMode === 'off' || rawMode === 'standard' ? rawMode : 'lite';
  const lite = mode === 'lite';

  return {
    mode,
    enabled: mode !== 'off',
    maxPhonesPerJob: boundedInt(process.env.AI_RESEARCH_MAX_PHONES_PER_JOB, lite ? 5 : 25, 1, 50),
    batchSize: boundedInt(process.env.AI_RESEARCH_BATCH_SIZE, lite ? 1 : 3, 1, lite ? 2 : 5),
    maxProviderCallsPerJob: boundedInt(process.env.AI_RESEARCH_MAX_PROVIDER_CALLS_PER_JOB, lite ? 5 : 25, 1, 50),
    cooldownSeconds: boundedInt(process.env.AI_RESEARCH_COOLDOWN_SECONDS, lite ? 20 : 5, 0, 3600),
    draftFreshHours: boundedInt(process.env.AI_RESEARCH_DRAFT_FRESH_HOURS, 168, 1, 2160),
    maxFailuresStored: boundedInt(process.env.AI_RESEARCH_MAX_FAILURES_STORED, 100, 10, 500),
    autoRun: String(process.env.AI_RESEARCH_AUTO_RUN || 'false').toLowerCase() === 'true' && !lite,
  };
}
