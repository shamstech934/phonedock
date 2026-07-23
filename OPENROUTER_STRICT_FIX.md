# OpenRouter strict provider fix (v11.2)

Use these Vercel Production variables:

```env
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-your-real-key
OPENROUTER_MODEL=openrouter/free
TAVILY_API_KEY=your-real-tavily-key
TAVILY_SEARCH_DEPTH=advanced
AI_RESEARCH_MAX_JOB_PHONES=10
```

`AI_PROVIDER=openrouter` is strict in this build. PhoneDock will not silently fall back to OpenAI. Old cancelled job cards retain historical OpenAI errors; after redeploy, create a new job.
