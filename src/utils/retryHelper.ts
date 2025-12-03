import { logger } from './logger';

/**
 * Retry helper for network operations with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  operationName: string = 'operation',
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (i === maxRetries) {
        break;
      }
      const delay = baseDelay * Math.pow(2, i);
      const retryCount = i + 1;
      logger.warn(
        `${operationName} failed, retrying in ${delay}ms (retry ${retryCount}/${maxRetries})`,
        {
          error: lastError.message,
        },
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  logger.error(`${operationName} failed after ${maxRetries} retries`, {
    error: lastError?.message,
  });
  throw lastError;
}

/**
 * Execute operation with fallback
 */
export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  operationName: string = 'operation',
): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    logger.warn(`${operationName} primary failed, using fallback`, {
      error: (error as Error).message,
    });
    return await fallback();
  }
}
