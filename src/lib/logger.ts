/**
 * Central logger. `debug` is a no-op in production builds unless PB_DEBUG is
 * set (server-side only); `warn`/`error` always pass through.
 */

export function isDebugEnabled(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  const v = process.env.PB_DEBUG;
  return !!v && ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

export const logger = {
  debug(...args: unknown[]): void {
    if (isDebugEnabled()) {
      console.log(...args);
    }
  },
  warn(...args: unknown[]): void {
    console.warn(...args);
  },
  error(...args: unknown[]): void {
    console.error(...args);
  },
};

/**
 * Verbose prompt/response dumping, opt-in via PB_DEBUG_VERBOSE.
 */
export function isVerbose(): boolean {
  const v =
    process.env.PB_DEBUG_VERBOSE || process.env.NEXT_PUBLIC_PB_DEBUG_VERBOSE;
  if (!v) return false;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

export function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(
      obj,
      (key, value) => {
        // Suppress extremely long, noisy, or sensitive fields
        if (key === 'thoughtSignature') return '[redacted]';
        return value;
      },
      2
    );
  } catch {
    return String(obj);
  }
}

export function printPrompt(tag: string, prompt: string): void {
  if (isVerbose()) {
    logger.debug(`${tag} PROMPT:\n${prompt}`);
  }
}

export function printResponse(tag: string, response: unknown): void {
  if (isVerbose()) {
    logger.debug(`${tag} RESPONSE FULL:`, safeStringify(response));
  }
}
