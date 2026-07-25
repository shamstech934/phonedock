# PhoneDock OpenRouter setup

Add these Vercel Environment Variables and redeploy:

```env
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your_real_key
OPENROUTER_MODEL=openrouter/free
TAVILY_API_KEY=your_real_key
TAVILY_SEARCH_DEPTH=advanced
AI_RESEARCH_MAX_JOB_PHONES=10
```

The AI Research screen shows the active provider and model. Jobs remain manual, with at most 10 phones per job and 5 per batch. OpenAI can remain configured as a fallback, but is not required. Free-model availability and limits are controlled by OpenRouter.
