/**
 * Shared scaffold for the multipart POST routes that call Gemini: request id,
 * rate limiting, form parsing, validation, image conversion, and a unified
 * error envelope. Route handlers receive a ready-to-use context and only
 * contain their model-call logic.
 */

import { NextRequest, NextResponse } from 'next/server';
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
} from './validation';
import { isAbortError } from './geminiCall';
import { logger } from '@/lib/logger';

export type ImagePart = { inlineData: { data: string; mimeType: string } };

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
