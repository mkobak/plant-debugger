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
  retryDelay: 2000, // 2 seconds delay between retries
  shouldRetry: (error) => {
    // Retry on network errors, timeout errors, or 5xx server errors
    // Don't retry on 4xx client errors (except 429 rate limiting)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return true; // Network error
    }
    if (error.message.includes('429') || error.message.includes('rate limit')) {
      return true; // Rate limit error
    }
    if (
      error.message.includes('500') ||
      error.message.includes('Internal Server Error')
    ) {
      return true; // Server error
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

  console.log(
    `[RETRY] Starting ${context} (max ${opts.maxRetries + 1} attempts)`
  );

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      console.log(
        `[RETRY] ${context} - Attempt ${attempt + 1}/${opts.maxRetries + 1}`
      );
      const result = await operation();

      if (attempt > 0) {
        console.log(
          `[RETRY] ${context} - Success after ${attempt + 1} attempts`
        );
      } else {
        console.log(`[RETRY] ${context} - Success on first attempt`);
      }

      return result;
    } catch (error) {
      lastError = error;
      console.error(
        `[RETRY] ${context} - Attempt ${attempt + 1} failed:`,
        error
      );

      // If this is the last attempt, don't retry
      if (attempt === opts.maxRetries) {
        console.error(
          `[RETRY] ${context} - All ${opts.maxRetries + 1} attempts failed`
        );
        break;
      }

      // Check if we should retry this error
      if (!opts.shouldRetry(error)) {
        console.error(`[RETRY] ${context} - Error not retryable, stopping`);
        break;
      }

      // Wait before retrying
      console.log(
        `[RETRY] ${context} - Waiting ${opts.retryDelay}ms before retry`
      );
      await new Promise((resolve) => setTimeout(resolve, opts.retryDelay));
    }
  }

  // If we got here, all attempts failed
  throw new Error(
    `${context} failed after ${opts.maxRetries + 1} attempts. Last error: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Special retry wrapper for API calls that might return empty responses
 * (like plant identification that should allow empty strings)
 */
export async function withRetryAllowEmpty<T>(
  operation: () => Promise<T>,
  context: string,
  options: RetryOptions = {}
): Promise<T> {
  return withRetry(operation, context, {
    ...options,
    shouldRetry: (error) => {
      // Don't retry if the operation succeeded but returned empty result
      // (we'll let the caller handle empty results)
      if (error.message.includes('empty') || error.message.includes('blank')) {
        return false;
      }
      return DEFAULT_RETRY_OPTIONS.shouldRetry(error);
    },
  });
}
