/**
 * Shared scaffold for the multipart POST routes that call Gemini: request id,
 * rate limiting, form parsing, validation, image conversion, and a unified
 * error envelope. Route handlers receive a ready-to-use context and only
 * contain their model-call logic.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { PartMediaResolutionLevel } from '@google/genai';
import {
  processFormData,
  convertImagesToBase64,
  type ProcessedFormData,
} from './shared';
import { checkRateLimit, getClientIp } from './rateLimit';
import {
  validateImages,
  validateTextFields,
  ValidationError,
  MAX_TOTAL_IMAGE_BYTES,
} from './validation';
import { isAbortError } from './geminiCall';
import { logger } from '@/lib/logger';

export type ImagePart = {
  inlineData: { data: string; mimeType: string };
  /** Gemini 3 per-image token budget (default = high, 1120 tokens). */
  mediaResolution?: { level: PartMediaResolutionLevel };
};

/** Copies of the image parts tagged with a lower media resolution, for
 *  calls that don't need pest-level detail (identification, no-plant). */
export function withResolution(
  parts: ImagePart[],
  level: PartMediaResolutionLevel
): ImagePart[] {
  return parts.map((p) => ({ ...p, mediaResolution: { level } }));
}

// Multipart overhead headroom on top of the image byte limit; anything larger
// is rejected before the body is buffered by formData()
const MAX_BODY_BYTES = MAX_TOTAL_IMAGE_BYTES + 64 * 1024;

export interface RouteContext {
  request: NextRequest;
  requestId: string;
  /** Log prefix, e.g. `[FINAL-DIAGNOSIS:abc123]`. */
  tag: string;
  signal?: AbortSignal;
  data: ProcessedFormData;
  imageParts: ImagePart[];
}

interface RouteOptions {
  /** Generic message returned on unexpected errors. */
  errorMessage: string;
  /** Status for unexpected errors (default 500). */
  errorStatus?: number;
}

export function withApiRoute(
  name: string,
  options: RouteOptions,
  handler: (ctx: RouteContext) => Promise<NextResponse>
) {
  return async function POST(request: NextRequest): Promise<NextResponse> {
    const requestId = Math.random().toString(36).slice(2, 8);
    const tag = `[${name}:${requestId}]`;
    logger.debug(`${tag} START`);

    const { signal } = request as unknown as { signal?: AbortSignal };
    signal?.addEventListener?.('abort', () => {
      logger.warn(`${tag} Request aborted by client`);
    });

    try {
      if (!checkRateLimit(getClientIp(request))) {
        logger.warn(`${tag} Rate limit exceeded`);
        return NextResponse.json(
          { error: 'Too many requests. Please wait before trying again.' },
          { status: 429 }
        );
      }

      if (signal?.aborted) {
        return NextResponse.json(
          { error: 'Request canceled' },
          { status: 499 }
        );
      }

      const contentLength = Number(request.headers.get('content-length'));
      if (contentLength > MAX_BODY_BYTES) {
        return NextResponse.json(
          { error: 'Request body too large' },
          { status: 413 }
        );
      }

      const formData = await request.formData();
      const data = await processFormData(formData);
      await validateImages(data.images);
      validateTextFields(data);

      if (signal?.aborted) {
        return NextResponse.json(
          { error: 'Request canceled' },
          { status: 499 }
        );
      }

      const imageParts = await convertImagesToBase64(data.images);

      const response = await handler({
        request,
        requestId,
        tag,
        signal,
        data,
        imageParts,
      });
      logger.debug(`${tag} DONE`);
      return response;
    } catch (error) {
      if (error instanceof ValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (isAbortError(error)) {
        return NextResponse.json(
          { error: 'Request canceled' },
          { status: 499 }
        );
      }
      logger.error(`${tag} ERROR`, error);
      return NextResponse.json(
        { error: options.errorMessage },
        { status: options.errorStatus ?? 500 }
      );
    }
  };
}
