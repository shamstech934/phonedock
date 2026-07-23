# PhoneDock v10 Production Candidate

## Master source
Built from `phonedock-main (45).zip`.

## Stability fix completed
- Fixed the admin dashboard runtime crash `CheckCircle2 is not defined` by importing `CheckCircle2` from `lucide-react` in `src/app/admin/dashboard/page.tsx`.

## AI workflow already present in this master source
- Persistent AI research jobs and drafts
- OpenAI + Tavily research integration
- Data-quality research/review APIs
- Missing specs/images/prices queues
- Review-before-publish safety flow

## Deployment variables
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (recommended value configured by operator)
- `TAVILY_API_KEY`
- `TAVILY_SEARCH_DEPTH`
- `AI_RESEARCH_MAX_JOB_PHONES`

## Verification note
A local dependency installation was attempted to run the full Next.js build. The package registry returned HTTP 503 for a dependency download, so a truthful full local build result is not included. Vercel must perform the final dependency install and production build.
