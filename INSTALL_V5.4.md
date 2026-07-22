# Install PhoneDock v5.4.0

1. Extract the ZIP over the existing v5.3.0 project or deploy the complete included project.
2. Run `npm install`.
3. Run `npm run test:v5.4`.
4. Run `npm run typecheck`.
5. Run `npm run build`.
6. Deploy normally.
7. Sign in as an admin with `phones:edit` permission and open `/admin/review-engine`.

No database migration is required. The engine writes into the existing Phone fields: category scores, overall rating, pros, cons, review summary and review verdict.
