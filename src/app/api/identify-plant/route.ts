import { NextResponse } from 'next/server';
import { withApiRoute } from '@/lib/api/withApiRoute';
import { geminiCall } from '@/lib/api/geminiCall';
import { PLANT_IDENTIFICATION_PROMPT } from '@/lib/api/prompts';
import { logger } from '@/lib/logger';

export const maxDuration = 30;

export const POST = withApiRoute(
  'IDENTIFY-PLANT',
  // Surface backend failures instead of masking them as "no plant found";
  // the client retry path handles non-OK responses.
  { errorMessage: 'Failed to identify plant', errorStatus: 502 },
  async ({ request, tag, signal, imageParts }) => {
    const { text, usage } = await geminiCall({
      request,
      modelKey: 'modelLow',
      parts: [{ text: PLANT_IDENTIFICATION_PROMPT }, ...imageParts],
      generationConfig: { temperature: 0.1, topP: 0.5 },
      signal,
      timeoutMs: 20_000,
      tag,
    });

    let plantName = text;
    const normalized = plantName.toLowerCase();
    if (
      !plantName ||
      /no\s+plant/.test(normalized) ||
      /not\s+a\s+plant/.test(normalized) ||
      /no\s+.*detected/.test(normalized) ||
      /multiple\s+plants?/.test(normalized) ||
      /cannot\s+(identify|determine)/.test(normalized) ||
      /unknown/.test(normalized)
    ) {
      plantName = '';
    }
    logger.debug(`${tag} Extracted plant name: ${plantName}`);

    return NextResponse.json({
      identification: { name: plantName },
      usage: { modelKey: 'modelLow', usage },
    });
  }
);
