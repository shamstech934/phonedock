# MongoDB TLS / Vercel build fix

## What the code fix changes

- Uses one connection attempt during `next build` instead of three retries per
  build worker.
- Temporarily remembers a failed connection so every concurrently rendered page
  does not start another retry loop.
- Uses `minPoolSize: 0`, which is appropriate for Vercel/serverless workers.
- Classifies TLS handshake failures without printing the connection string.

The application still retries transient database failures at runtime.

## Required Atlas and Vercel checks

1. Confirm the MongoDB Atlas cluster is active and not paused.
2. In Atlas **Network Access**, allow Vercel traffic. For initial diagnosis,
   `0.0.0.0/0` can be used with a strong database password; replace it with a
   stricter network setup when available.
3. In Atlas **Database Access**, confirm the database user is active and its
   password has not changed.
4. Copy a fresh `mongodb+srv://` driver connection string from Atlas.
5. URL-encode special characters in the username or password.
6. Save the URI in Vercel as `MONGODB_URI` for Production and Preview as needed.
7. Do not add quotes or trailing spaces around the Vercel value.
8. Redeploy without reusing the previous build cache.

Do not commit the real MongoDB URI to Git.
