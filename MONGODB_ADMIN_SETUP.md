# PhoneDock — MongoDB Setup & Admin Creation Guide (Windows CMD)

Follow these steps exactly in order.

## Step 1: Open the correct project folder

```cmd
cd C:\Users\YourName\phonedock
```

Verify `package.json` exists:

```cmd
dir package.json
```

## Step 2: Install dependencies

```cmd
npm ci
```

## Step 3: Link to Vercel

```cmd
npx vercel link
```

Follow the prompts. Select the existing project `phonedock-pi`.

## Step 4: Pull environment variables from Vercel

```cmd
npx vercel env pull .env.local
```

This creates a `.env.local` file with your production MONGODB_URI, JWT_SECRET, etc. This file is never committed to git.

## Step 5: Test the database connection

```cmd
npm run db:check
```

This will:
- Validate your MONGODB_URI
- Test DNS resolution
- Test the connection (read-only ping, no data changes)

### If you see "querySrv ECONNREFUSED"

Run these diagnostic commands:

```cmd
nslookup -type=SRV _mongodb._tcp.cluster0.xxxxx.mongodb.net
ipconfig /flushdns
```

Replace `cluster0.xxxxx.mongodb.net` with the hostname shown in the db:check output.

Then check:
1. The URI was copied from **MongoDB Atlas > Connect > Drivers** (not from anywhere else)
2. **Atlas > Database Access** has a user with the correct password
3. **Atlas > Network Access** allows your current IP address (or add `0.0.0.0/0`)
4. Try a different network (mobile hotspot) or DNS server
5. Confirm the Atlas cluster is **active** (not paused)

### If you see "Authentication failed"

1. Go to **Atlas > Database Access** and verify the username and password
2. Re-copy the full connection string from **Atlas > Connect > Drivers**
3. Run `vercel env pull .env.local` again to get the latest values

### If you see "IP is not allowed"

1. Go to **Atlas > Network Access**
2. Click "Add IP Address"
3. Add your current IP, or add `0.0.0.0/0` to allow all IPs

## Step 6: Run the database migration

```cmd
npm run migrate
```

This is **non-destructive**. It only creates missing indexes and adds missing fields. It will never delete data.

## Step 7: Create the superadmin account

### Interactive mode (recommended):

```cmd
npm run admin:create
```

Follow the prompts. Type your password (it will not be shown). First admin automatically becomes superadmin.

### Non-interactive mode (for CI/automation):

```cmd
set ADMIN_NAME=Shams
set ADMIN_EMAIL=shamstechofficial@gmail.com
set ADMIN_INITIAL_PASSWORD=YourSecureP@ssw0rd!
npm run admin:create -- --role superadmin
```

**Password requirements:** 12+ characters, uppercase, lowercase, number, special character.

After the command runs, the password is cleared from memory and environment.

## Step 8: Build and verify

```cmd
npm run build
```

## Step 9: Deploy

```cmd
npx vercel --prod
```

## Resetting a password later

```cmd
set ADMIN_INITIAL_PASSWORD=NewSecureP@ssw0rd!
npm run admin:reset-password -- --email shamstechofficial@gmail.com
```

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `querySrv ECONNREFUSED` | DNS cannot resolve Atlas cluster | Check URI, try different DNS/network |
| `ENOTFOUND` | Hostname not found | Copy exact URI from Atlas > Connect > Drivers |
| `Authentication failed` | Wrong username or password | Re-check Atlas Database Access user |
| `IP is not allowed` | Your IP not in Atlas allowlist | Add IP in Atlas > Network Access |
| `timed out` | Cluster paused or network issue | Check Atlas dashboard, try other network |
| `MONGODB_URI not set` | No .env.local file | Run `vercel env pull .env.local` |