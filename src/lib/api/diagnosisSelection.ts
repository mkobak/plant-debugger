/**
 * Pure selection logic for the initial-diagnosis consensus calls,
 * extracted for unit testing.
 */

import type { GeminiCallResult } from './geminiCall';
import type { ModelKey } from './modelConfig';

export interface DiagnosisAttempt extends GeminiCallResult {
  modelKey: ModelKey;
}

export interface DiagnosisSelection {
  /** Attempts that completed with non-empty text. */
  successes: DiagnosisAttempt[];
  /** Failure reasons (rejections and empty responses), for logging. */
  failures: string[];
}

export function collectSuccessfulDiagnoses(
  settled: PromiseSettledResult<DiagnosisAttempt>[]
): DiagnosisSelection {
  const successes: DiagnosisAttempt[] = [];
  const failures: string[] = [];
  for (const result of settled) {
    if (result.status === 'rejected') {
      failures.push(
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason)
      );
    } else if (result.value.text.length === 0) {
      failures.push(
        `empty response (finish=${result.value.finishReason || 'unknown'}, block=${result.value.blockReason || 'none'})`
      );
    } else {
      successes.push(result.value);
    }
  }
  return { successes, failures };
}
