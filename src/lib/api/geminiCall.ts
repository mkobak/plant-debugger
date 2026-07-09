/**
 * Single call site for the Gemini SDK: combines the request's abort signal
 * with a per-call timeout, records token usage, and normalizes errors.
 */

import type { NextRequest } from 'next/server';
import type { GenerationConfig, Part } from '@google/generative-ai';
import { models } from './gemini';
import type { ModelKey } from './modelConfig';
import { recordUsageForRequest, type UsageMetadata } from './costServer';
import { logger, printPrompt, printResponse } from '@/lib/logger';

export const DEFAULT_TIMEOUT_MS = 30_000;

export class GeminiTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiTimeoutError';
  }
}

/** Client-initiated cancellation (either fetch AbortError or our marker). */
export function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.message === 'aborted')
  );
}

export interface GeminiCallOptions {
  /** Incoming request, used for cost accounting. */
  request: NextRequest;
  modelKey: ModelKey;
  parts: Part[];
  generationConfig?: GenerationConfig;
  /** Client abort signal (from the incoming request). */
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Log prefix, e.g. `[FINAL-DIAGNOSIS:abc123]`. */
  tag: string;
}

export interface GeminiCallResult {
  text: string;
  usage: UsageMetadata;
  finishReason?: string;
  blockReason?: string;
}

export async function geminiCall({
  request,
  modelKey,
  parts,
  generationConfig,
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  tag,
}: GeminiCallOptions): Promise<GeminiCallResult> {
  if (signal?.aborted) throw new Error('aborted');

  const textPart = parts.find((p) => 'text' in p) as
    | { text: string }
    | undefined;
  if (textPart) printPrompt(tag, textPart.text);

  try {
    const result = await models[modelKey].generateContent(
      { contents: [{ role: 'user', parts }], generationConfig },
      { signal, timeout: timeoutMs }
    );

    const response = result.response;
    printResponse(tag, response);

    const usage: UsageMetadata = response?.usageMetadata || {};
    recordUsageForRequest(request, modelKey, usage);

    const text = (response?.text?.() ?? '').trim();
    const finishReason = response?.candidates?.[0]?.finishReason;
    const blockReason = response?.promptFeedback?.blockReason;
    if (blockReason) {
      logger.warn(`${tag} ${modelKey} blocked: ${blockReason}`);
    }
    logger.debug(
      `${tag} ${modelKey} done | finish=${finishReason} block=${blockReason || 'none'} textLen=${text.length}`
    );
    return { text, usage, finishReason, blockReason };
  } catch (error) {
    // The SDK throws the same abort error for client aborts and timeouts —
    // the caller's signal state tells them apart.
    if (signal?.aborted) throw new Error('aborted');
    if (
      error instanceof Error &&
      error.name === 'GoogleGenerativeAIAbortError'
    ) {
      logger.warn(`${tag} ${modelKey} timed out after ${timeoutMs}ms`);
      throw new GeminiTimeoutError(
        `${modelKey} call timed out after ${timeoutMs}ms`
      );
    }
    throw error;
  }
}
