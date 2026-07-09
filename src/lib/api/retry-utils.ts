import { logger } from '@/lib/logger';
/**
 * Retry utilities for API calls to prevent infinite loops
 */

interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  shouldRetry?: (error: any) => boolean;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 2, // Maximum 2 retries (total 3 attempts)
  retryDelay: 1000, // base delay, doubled on each retry
  shouldRetry: (error) => {
    // Retry on network errors, timeout errors, or 5xx server errors
    // Don't retry on 4xx client errors (except 429 rate limiting)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return true; // Network error
    }
    if (error.message.includes('429') || error.message.includes('rate limit')) {
      return true; // Rate limit error
    }
    if (/50[0-9]|Internal Server Error|timed out/i.test(error.message)) {
      return true; // Server error or upstream timeout
    }
    return false; // Don't retry other errors
  },
};

/**
 * Wrapper function that adds retry logic to any async function
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: any;

  logger.debug(
    `[RETRY] Starting ${context} (max ${opts.maxRetries + 1} attempts)`
  );

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      logger.debug(
        `[RETRY] ${context} - Attempt ${attempt + 1}/${opts.maxRetries + 1}`
      );
      const result = await operation();

      if (attempt > 0) {
        logger.debug(
          `[RETRY] ${context} - Success after ${attempt + 1} attempts`
        );
      } else {
        logger.debug(`[RETRY] ${context} - Success on first attempt`);
      }

      return result;
    } catch (error) {
      lastError = error;
      logger.error(
        `[RETRY] ${context} - Attempt ${attempt + 1} failed:`,
        error
      );

      if (
        (error instanceof Error && error.name === 'AbortError') ||
        (typeof (error as any)?.message === 'string' &&
          /(aborted|abort)/i.test((error as any).message))
      ) {
        logger.debug(`[RETRY] ${context} - Aborted, stopping retries`);
        throw error;
      }

      // If this is the last attempt, don't retry
      if (attempt === opts.maxRetries) {
        logger.error(
          `[RETRY] ${context} - All ${opts.maxRetries + 1} attempts failed`
        );
        break;
      }

      // Check if we should retry this error
      if (!opts.shouldRetry(error)) {
        logger.error(`[RETRY] ${context} - Error not retryable, stopping`);
        break;
      }

      // Wait before retrying, backing off exponentially
      const backoff = opts.retryDelay * 2 ** attempt;
      logger.debug(`[RETRY] ${context} - Waiting ${backoff}ms before retry`);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  // If we got here, all attempts failed
  const msg = `${context} failed after ${opts.maxRetries + 1} attempts. Last error: ${lastError?.message || 'Unknown error'}`;
  const wrapped = new Error(msg);
  (wrapped as any).cause = lastError;
  throw wrapped;
}
