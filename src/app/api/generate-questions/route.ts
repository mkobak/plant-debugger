import { NextRequest, NextResponse } from 'next/server';
import { models } from '@/lib/api/gemini';
import { questionsSchema } from '@/lib/api/schemas';
import {
  processFormData,
  convertImagesToBase64,
  validateImages,
} from '@/lib/api/shared';
import { createQuestionsGenerationPrompt } from '@/lib/api/prompts';
import { recordUsageForRequest } from '@/lib/api/costServer';
import { printPrompt, printResponse } from '@/lib/api/logging';

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).slice(2, 8);
  console.log(`[GENERATE-QUESTIONS:${requestId}] START`);

  try {
    const { signal } = request as unknown as { signal?: AbortSignal };
    signal?.addEventListener?.('abort', () => {
      console.warn(
        `[GENERATE-QUESTIONS:${requestId}] Request aborted by client`
      );
    });

    if (signal?.aborted) {
      console.warn(
        `[GENERATE-QUESTIONS:${requestId}] Aborted before reading form data`
      );
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    const formData = await request.formData();
    const { images, rankedDiagnoses, userComment } =
      await processFormData(formData);

    validateImages(images);
    const totalImageBytes = images.reduce((s, f) => s + (f.size || 0), 0);
    console.log(
      `[GENERATE-QUESTIONS:${requestId}] images: ${images.length} (~${Math.round(totalImageBytes / 1024)} KB)`
    );

    if (signal?.aborted) {
      console.warn(
        `[GENERATE-QUESTIONS:${requestId}] Aborted before converting images`
      );
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    // Convert images to base64 for Gemini
    const imageParts = await convertImagesToBase64(images);
    console.log(
      `[GENERATE-QUESTIONS:${requestId}] Converted ${imageParts.length} images to base64`
    );

    // Print prompt exactly once (gated)
    const QUESTIONS_GENERATION_PROMPT = createQuestionsGenerationPrompt(
      rankedDiagnoses || '',
      userComment || ''
    );
    printPrompt(
      `[GENERATE-QUESTIONS:${requestId}]`,
      QUESTIONS_GENERATION_PROMPT
    );

    // Concise send summary
    console.log(
      `[GENERATE-QUESTIONS:${requestId}] Sending to AI | images: ${imageParts.length} | schema: questions`
    );

    // Call Gemini API for questions generation
    if (signal?.aborted) {
      console.warn(
        `[GENERATE-QUESTIONS:${requestId}] Aborted before model call`
      );
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    const result = await models.modelMedium.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: QUESTIONS_GENERATION_PROMPT }, ...imageParts],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        topP: 0.5,
        responseMimeType: 'application/json',
        responseSchema: questionsSchema as any,
      },
    });

    // Print full response exactly once (gated)
    printResponse(`[GENERATE-QUESTIONS:${requestId}]`, result.response);
    const usage = (result.response?.usageMetadata || {}) as any;
    if (
      !usage ||
      ((usage?.promptTokenCount ?? 0) === 0 &&
        (usage?.candidatesTokenCount ?? 0) === 0)
    ) {
      console.warn(
        `[GENERATE-QUESTIONS:${requestId}] Missing or zero usage metadata`
      );
    }
    recordUsageForRequest(request, 'modelMedium', usage);

    // Structured JSON response parsing
    let questionsData: any;
    try {
      const jsonText = result.response.text();
      if (typeof jsonText !== 'string' || !jsonText.trim()) {
        throw new Error('Empty JSON response');
      }
      questionsData = JSON.parse(jsonText);
      console.log(
        `[GENERATE-QUESTIONS:${requestId}] Parsed JSON keys: ${Object.keys(questionsData || {}).join(', ')}`
      );
    } catch (e) {
      console.error(
        `[GENERATE-QUESTIONS:${requestId}] Failed to parse structured JSON response`,
        e
      );
      throw new Error('Invalid structured questions response');
    }

    // Convert the function call response to our questions format
    const questions = [];
    const questionKeys = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'];

    for (let i = 0; i < questionKeys.length; i++) {
      const key = questionKeys[i];
      if (questionsData[key] && questionsData[key].trim()) {
        questions.push({
          id: `q${i + 1}`,
          question: questionsData[key].trim(),
          type: 'yes_no' as const,
          required: false,
        });
      }
    }

    console.log(
      `[GENERATE-QUESTIONS:${requestId}] Extracted questions: ${questions.length}`
    );
    console.log(`[GENERATE-QUESTIONS:${requestId}] SUCCESS`);

    return NextResponse.json({
      questions,
      usage: { modelKey: 'modelMedium', usage },
    });
  } catch (error) {
    console.error(`[GENERATE-QUESTIONS:${requestId}] ERROR`, error);
    if (error instanceof Error && error.stack) {
      console.error(`[GENERATE-QUESTIONS:${requestId}] STACK`, error.stack);
    }

    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    return NextResponse.json(
      { error: 'Failed to generate questions' },
      { status: 500 }
    );
  }
}
