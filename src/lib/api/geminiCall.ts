/**
 * Single call site for the Gemini SDK: combines the request's abort signal
 * with a per-call timeout, records token usage, and normalizes errors.
 */

import type { NextRequest } from 'next/server';
import type { GenerateContentConfig, Part } from '@google/genai';
import { getGenAI } from './gemini';
import { MODEL_BY_KEY, type ModelKey } from './modelConfig';
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
  generationConfig?: GenerateContentConfig;
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
    const response = await getGenAI().models.generateContent({
      model: MODEL_BY_KEY[modelKey],
      contents: [{ role: 'user', parts }],
      config: {
        ...generationConfig,
        abortSignal: signal,
        httpOptions: { timeout: timeoutMs },
      },
    });

    printResponse(tag, response);

    const usage: UsageMetadata = response.usageMetadata || {};
    recordUsageForRequest(request, modelKey, usage);

    const text = (response.text ?? '').trim();
    const finishReason = response.candidates?.[0]?.finishReason as
      | string
      | undefined;
    const blockReason = response.promptFeedback?.blockReason as
      | string
      | undefined;
    if (blockReason) {
      logger.warn(`${tag} ${modelKey} blocked: ${blockReason}`);
    }
    logger.debug(
      `${tag} ${modelKey} done | finish=${finishReason} block=${blockReason || 'none'} textLen=${text.length}`
    );
    return { text, usage, finishReason, blockReason };
  } catch (error) {
    // The SDK aborts an internal controller for both client aborts and
    // timeouts — the caller's signal state tells them apart.
    if (signal?.aborted) throw new Error('aborted');
    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn(`${tag} ${modelKey} timed out after ${timeoutMs}ms`);
      throw new GeminiTimeoutError(
        `${modelKey} call timed out after ${timeoutMs}ms`
      );
    }
    throw error;
  }
}
