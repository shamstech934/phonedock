# PhoneDock v11 Production

This release consolidates the current production codebase and keeps AI research intentionally lightweight.

## AI safety and load limits
- Admin-only manual jobs.
- Maximum 10 phones per job.
- Maximum 5 phones per API batch.
- A newly created job does not auto-run.
- Research only creates drafts; publishing always requires admin approval.
- No background scheduler or automatic full-database scan.

## Required environment variables
- MONGO_URL
- DB_NAME
- JWT_SECRET
- NEXT_PUBLIC_BASE_URL

Optional AI research:
- OPENAI_API_KEY
- OPENAI_MODEL=gpt-4.1-mini
- TAVILY_API_KEY
- TAVILY_SEARCH_DEPTH=advanced
- AI_RESEARCH_MAX_JOB_PHONES=10

## Deployment check
1. Add environment variables to Production and Preview.
2. Redeploy without reusing an old build cache.
3. Open Admin Dashboard and Data Quality Center.
4. Test AI with one phone first, then a maximum of five.
5. Review sources before approving a draft.
