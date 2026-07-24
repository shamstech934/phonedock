# PhoneDock v13 AI & Data Quality Stability

- Robust OpenRouter/OpenAI provider resolution with safe environment-variable aliases.
- Provider status reports the environment variable name used, never its secret value.
- OpenRouter requests avoid unsupported JSON-mode flags on free routed models.
- Tavily sends both bearer auth and API key in the request body for compatibility.
- Job creation refuses to start when the selected research type is not configured.
- Active jobs are shown by default; finished history can be shown and safely cleared.
- Refresh All reloads provider status, jobs, and drafts without browser caching.
- Finished/cancelled jobs cannot be run again accidentally.
- Existing AI drafts are never deleted by job-history cleanup.

Required Vercel Production variables:

```env
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=openrouter/free
TAVILY_API_KEY=tvly-...
TAVILY_SEARCH_DEPTH=advanced
AI_RESEARCH_MAX_JOB_PHONES=10
```

After saving variables, redeploy the Production deployment. The status card must show `OpenRouter` and the key source `OPENROUTER_API_KEY`.
