import { NextResponse } from 'next/server';
import { withApiRoute, withResolution } from '@/lib/api/withApiRoute';
import { geminiCall } from '@/lib/api/geminiCall';
import { NO_PLANT_PROMPT } from '@/lib/api/prompts';
import { printAndResetForRequest } from '@/lib/api/costServer';
import { PartMediaResolutionLevel, ThinkingLevel } from '@google/genai';

export const maxDuration = 30;

export const POST = withApiRoute(
  'NO-PLANT',
  { errorMessage: 'Failed to generate message' },
  async ({ request, tag, signal, imageParts }) => {
    const { text: message, usage } = await geminiCall({
      request,
      modelKey: 'modelLow',
      // A high-level description only: low resolution keeps it cheap and fast
      parts: [
        { text: NO_PLANT_PROMPT },
        ...withResolution(
          imageParts,
          PartMediaResolutionLevel.MEDIA_RESOLUTION_LOW
        ),
      ],
      generationConfig: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      },
      signal,
      timeoutMs: 20_000,
      tag,
    });

    // Print a server-side cost summary for this early-termination path
    printAndResetForRequest(request, 'Plant Debugger (no plant)');

    return NextResponse.json({
      message,
      usage: { modelKey: 'modelLow', usage },
    });
  }
);
