# PhoneDock v16.0 — Install and Use

## Deploy
1. Upload/push this project to GitHub.
2. Import the repository in Vercel.
3. Keep Root Directory empty unless the repository itself contains another outer folder.
4. Add `MONGODB_URI`, `JWT_SECRET`, `NEXT_PUBLIC_BASE_URL`, and `CRON_SECRET`.
5. Deploy.

## Local specifications workflow
1. Open **Admin → Data Quality → Missing Specs**.
2. Upload a specifications CSV using **Choose dataset CSV**.
3. Wait for the progress bar to finish. The page shows the number of devices saved locally.
4. Select phones from the missing-specs queue.
5. Choose a confidence threshold. Start with **95%** for safer automatic matches.
6. Click **Auto match selected**.
7. Review uncertain records with **Find specs** before applying.

A sample file is available at `docs/local-specs-dataset-template.csv`.

No OpenAI, OpenRouter, Tavily, paid credits, or runtime third-party phone-spec API is required.
