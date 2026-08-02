# SpecsDekh IndexNow Setup

Use the same value in Vercel and GitHub Actions:

```env
INDEXNOW_KEY=9ce2a026ba991e0758d95674e86710b4b237c27aaa6f04fb
```

Verification file URL after deployment:

```text
https://specsdekh.com/9ce2a026ba991e0758d95674e86710b4b237c27aaa6f04fb.txt
```

The protected submission endpoint remains:

```text
POST /api/indexnow
Header: x-cron-secret: <CRON_SECRET>
Body: {"urls":["https://specsdekh.com/phones/example"]}
```
