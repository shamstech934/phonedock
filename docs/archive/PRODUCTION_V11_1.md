# PhoneDock v11.1 — Lightweight OpenRouter AI

This release keeps AI admin-only and manual while removing the hard dependency on OpenAI quota.

## Provider order
- `AI_PROVIDER=openrouter`: OpenRouter first, OpenAI fallback if configured.
- `AI_PROVIDER=openai`: OpenAI first, OpenRouter fallback if configured.
- `AI_PROVIDER=auto` or omitted: OpenRouter first, OpenAI fallback.

## Vercel variables
```env
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your_real_key
OPENROUTER_MODEL=openrouter/free
TAVILY_API_KEY=your_real_key
TAVILY_SEARCH_DEPTH=advanced
AI_RESEARCH_MAX_JOB_PHONES=10
```

Jobs are manual, limited to 10 phones, and run 5 phones per batch. Draft approval remains mandatory.
