# PhoneDock v12.1 — Real AI Provider Fix

This release is based on `phonedock-main (46)` and replaces the hardcoded OpenAI-only synthesis path.

## Required Vercel variables for OpenRouter

```env
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-your-real-key
OPENROUTER_MODEL=openrouter/free
TAVILY_API_KEY=your-real-tavily-key
TAVILY_SEARCH_DEPTH=advanced
AI_RESEARCH_MAX_JOB_PHONES=10
```

Apply the variables to Production and Preview, then redeploy.

## Verification

The AI Research status card must display:

- `AI: OpenRouter · openrouter/free`
- `Tavily: Configured`
- `specs research: Ready`

Create a new job; historical OpenAI errors stored in old jobs remain historical. New requests use only the provider selected by `AI_PROVIDER`.

## Lightweight controls

- Default job size: 5
- Maximum job size: 10
- Maximum batch size: 5
- No automatic first batch
- No 20-batch auto-run
- Review and approval remain mandatory before live publishing
