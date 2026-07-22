type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  userId?: string;
  adminId?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  jobId?: string;
  sourceId?: string;
  errorCategory?: string;
  [key: string]: unknown;
}

const SECRET_KEY = /password|passwd|secret|token|authorization|cookie|jwt|api[-_]?key|credential/i;
const MAX_DEPTH = 6;

export function redactLogValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[TRUNCATED]';
  if (value instanceof Error) return { name: value.name, message: value.message, stack: process.env.NODE_ENV === 'production' ? undefined : value.stack };
  if (Array.isArray(value)) return value.slice(0, 50).map(item => redactLogValue(item, depth + 1));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key,
    SECRET_KEY.test(key) ? '[REDACTED]' : redactLogValue(item, depth + 1),
  ]));
}

function write(level: LogLevel, message: string, context: LogContext = {}) {
  const record = JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...redactLogValue(context) as object });
  if (level === 'error') console.error(record);
  else if (level === 'warn') console.warn(record);
  else console.info(record);
}

export const logger = {
  debug: (message: string, context?: LogContext) => { if (process.env.NODE_ENV !== 'production') write('debug', message, context); },
  info: (message: string, context?: LogContext) => write('info', message, context),
  warn: (message: string, context?: LogContext) => write('warn', message, context),
  error: (message: string, context?: LogContext) => write('error', message, context),
};

export function createRequestId(incoming?: string | null) {
  return incoming && /^[a-zA-Z0-9._-]{8,128}$/.test(incoming) ? incoming : crypto.randomUUID();
}
