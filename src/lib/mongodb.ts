import mongoose from 'mongoose';

// Lazy-load to avoid importing dotenv/dns at edge runtime
// Validation is for scripts; the app just needs to connect or fail clearly.

const MONGODB_URI = process.env.MONGODB_URI || '';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

async function connectWithRetry(uri: string, retries = 3, delay = 1000): Promise<typeof mongoose> {
  let lastError: Error | null = null;
  for (let i = 0; i < retries; i++) {
    try {
      return await mongoose.connect(uri, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        heartbeatFrequencyMS: 10000,
        retryWrites: true,
        w: 'majority',
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
      } else if (msg.includes('IP is not allowed') || (e as any).code === 8000) {
        console.error(`MongoDB attempt ${i + 1}/${retries}: IP not allowed. Add your IP to Atlas Network Access.`);
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
    throw new Error('MONGODB_URI environment variable is not defined');
  }
  if (cached.conn) {
    if (mongoose.connection.readyState === 1) return cached.conn;
    cached.conn = null;
    cached.promise = null;
  }

  if (!cached.promise) {
    cached.promise = connectWithRetry(MONGODB_URI).then((m) => {
      console.log('MongoDB connected successfully');
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
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