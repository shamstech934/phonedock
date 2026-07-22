import { logger, type LogContext } from './logger';

export interface ErrorTracker {
  captureException(error: unknown, context?: LogContext): void | Promise<void>;
  captureMessage(message: string, context?: LogContext): void | Promise<void>;
}

let provider: ErrorTracker | null = null;

export function registerErrorTracker(tracker: ErrorTracker) {
  provider = tracker;
}

export function captureException(error: unknown, context: LogContext = {}) {
  const safeContext = { ...context, release: process.env.APP_RELEASE, environment: process.env.APP_ENV || process.env.NODE_ENV };
  logger.error('Unhandled application error', { ...safeContext, error });
  try { return provider?.captureException(error, safeContext); } catch (trackerError) {
    logger.warn('Error tracker provider failed', { error: trackerError, errorCategory: 'observability_provider' });
  }
}

export function captureMessage(message: string, context: LogContext = {}) {
  logger.warn(message, context);
  try { return provider?.captureMessage(message, context); } catch { return undefined; }
}
