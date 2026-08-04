import mongoose from 'mongoose';

// Lazy-load to avoid importing dotenv/dns at edge runtime
// Validation is for scripts; the app just needs to connect or fail clearly.

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URL || '';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  lastError: Error | null;
  lastFailureAt: number;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongooseCache || {
  conn: null,
  promise: null,
  lastError: null,
  lastFailureAt: 0,
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

const BUILD_PHASE = process.env.NEXT_PHASE === 'phase-production-build';
const SERVERLESS_RUNTIME = Boolean(process.env.VERCEL);
const FAILURE_COOLDOWN_MS = BUILD_PHASE ? 60_000 : 10_000;

async function connectWithRetry(
  uri: string,
  retries = BUILD_PHASE || SERVERLESS_RUNTIME ? 1 : 3,
  delay = 1000,
): Promise<typeof mongoose> {
  let lastError: Error | null = null;
  for (let i = 0; i < retries; i++) {
    try {
      return await mongoose.connect(uri, {
        maxPoolSize: 10,
        // Serverless functions scale horizontally. Keeping idle connections in
        // every function/build worker creates avoidable Atlas connection pressure.
        minPoolSize: 0,
        // A public request must fail quickly enough to return a useful 503
        // instead of leaving the page on a loading screen for 30+ seconds.
        serverSelectionTimeoutMS: SERVERLESS_RUNTIME ? 6000 : 10000,
        socketTimeoutMS: SERVERLESS_RUNTIME ? 20000 : 45000,
        heartbeatFrequencyMS: 10000,
        retryWrites: true,
        w: 'majority',
        // Disable auto-index creation in serverless/Vercel — indexes are
        // managed via deploy-time migration scripts, not on every cold start.
        autoIndex: false,
        autoCreate: false,
      });
    } catch (e) {
      lastError = e as Error;
      // Classify the error for better logging (without importing heavy deps at edge)
      const msg = (e as Error).message || '';
      if (msg.includes('querySrv') && msg.includes('ECONNREFUSED')) {
        console.error(`MongoDB attempt ${i + 1}/${retries}: DNS SRV lookup failed. Check MONGODB_URI hostname and Atlas Network Access.`);
      } else if (msg.includes('ENOTFOUND')) {
        console.error(`MongoDB attempt ${i + 1}/${retries}: DNS resolution failed. Check hostname in MONGODB_URI.`);
      } else if (msg.includes('Authentication failed')) {
        console.error(`MongoDB attempt ${i + 1}/${retries}: Authentication failed. Check username/password in MONGODB_URI.`);
      } else if (msg.includes('IP is not allowed') || ((e as unknown as Record<string, unknown>).code as string) === '8000') {
        console.error(`MongoDB attempt ${i + 1}/${retries}: IP not allowed. Add your IP to Atlas Network Access.`);
      } else if (
        msg.includes('tlsv1 alert internal error')
        || msg.includes('SSL routines')
        || msg.includes('TLS')
      ) {
        console.error(
          `MongoDB attempt ${i + 1}/${retries}: TLS handshake failed. Check the Atlas cluster status, Vercel Network Access, and MONGODB_URI.`,
        );
      } else {
        console.warn(`MongoDB attempt ${i + 1}/${retries} failed:`, lastError.message);
      }
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, delay * (i + 1)));
      }
    }
  }
  throw lastError;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not defined (legacy MONGO_URL is also supported)');
  }
  if (cached.conn) {
    if (mongoose.connection.readyState === 1) return cached.conn;
    cached.conn = null;
    cached.promise = null;
  }

  // A single Vercel build can render many pages concurrently. If Atlas is
  // unavailable, do not let every page start its own three-attempt retry loop.
  if (
    cached.lastError
    && Date.now() - cached.lastFailureAt < FAILURE_COOLDOWN_MS
  ) {
    throw cached.lastError;
  }

  if (!cached.promise) {
    cached.promise = connectWithRetry(MONGODB_URI).then((m) => {
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
    cached.lastError = null;
    cached.lastFailureAt = 0;
  } catch (e) {
    cached.promise = null;
    cached.lastError = e as Error;
    cached.lastFailureAt = Date.now();
    throw e;
  }

  return cached.conn;
}

/** Safe connect that returns null instead of throwing — for optional DB features */
export async function connectDBSafe(): Promise<typeof mongoose | null> {
  if (!MONGODB_URI) return null;
  try {
    return await connectDB();
  } catch {
    return null;
  }
}

export default connectDB;
