# PhoneDock v12 Data Quality & AI Fix

This release rewrites provider detection and AI synthesis for the Data Quality Center.

## Required Vercel variables (OpenRouter)
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=openrouter/free
TAVILY_API_KEY=...
TAVILY_SEARCH_DEPTH=advanced
AI_RESEARCH_MAX_JOB_PHONES=10

Redeploy after saving variables. The AI status card must show `AI: OpenRouter`.
Research jobs are manual, max 10 phones, 5 phones per batch. Draft review remains mandatory.
