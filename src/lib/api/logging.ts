/**
 * Logging utilities: verbose toggle and safe stringify (redacts long/noisy keys).
 */

export function isVerbose(): boolean {
  const v = process.env.PB_DEBUG_VERBOSE || process.env.NEXT_PUBLIC_PB_DEBUG_VERBOSE;
  if (!v) return false;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

export function safeStringify(obj: any): string {
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
    // Fallback: best-effort string
    return String(obj);
  }
}

export function printPrompt(tag: string, prompt: string) {
  if (isVerbose()) {
    console.log(`${tag} PROMPT:\n${prompt}`);
  }
}

export function printResponse(tag: string, response: any) {
  if (isVerbose()) {
    console.log(`${tag} RESPONSE FULL:`, safeStringify(response));
  }
}
