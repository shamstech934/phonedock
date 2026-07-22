import { logger, type LogContext } from './logger';

export function recordMetric(name: string, value: number, unit: 'ms' | 'count' | 'ratio', context: LogContext = {}) {
  if (!Number.isFinite(value)) return;
  logger.info('metric', { metric: name, value, unit, ...context });
}

export async function measure<T>(name: string, operation: () => Promise<T>, context: LogContext = {}): Promise<T> {
  const started = performance.now();
  try {
    const result = await operation();
    recordMetric(name, performance.now() - started, 'ms', { ...context, outcome: 'success' });
    return result;
  } catch (error) {
    recordMetric(name, performance.now() - started, 'ms', { ...context, outcome: 'failure' });
    throw error;
  }
}
