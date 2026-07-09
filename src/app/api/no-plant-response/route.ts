import { NextResponse } from 'next/server';
import { withApiRoute } from '@/lib/api/withApiRoute';
import { geminiCall } from '@/lib/api/geminiCall';
import { NO_PLANT_PROMPT } from '@/lib/api/prompts';
import { printAndResetForRequest } from '@/lib/api/costServer';

export const maxDuration = 30;

export const POST = withApiRoute(
  'NO-PLANT',
  { errorMessage: 'Failed to generate message' },
  async ({ request, tag, signal, imageParts }) => {
    const { text: message, usage } = await geminiCall({
      request,
      modelKey: 'modelLow',
      parts: [{ text: NO_PLANT_PROMPT }, ...imageParts],
      generationConfig: { temperature: 0.6, topP: 0.9 },
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
