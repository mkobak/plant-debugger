import { NextResponse } from 'next/server';
import { withApiRoute } from '@/lib/api/withApiRoute';
import { geminiCall } from '@/lib/api/geminiCall';
import { questionsSchema } from '@/lib/api/schemas';
import { createQuestionsGenerationPrompt } from '@/lib/api/prompts';
import { logger } from '@/lib/logger';

export const maxDuration = 30;

export const POST = withApiRoute(
  'GENERATE-QUESTIONS',
  { errorMessage: 'Failed to generate questions' },
  async ({ request, tag, signal, data, imageParts }) => {
    const prompt = createQuestionsGenerationPrompt(
      data.rankedDiagnoses || '',
      data.userComment || ''
    );

    const { text, usage } = await geminiCall({
      request,
      modelKey: 'modelMedium',
      parts: [{ text: prompt }, ...imageParts],
      generationConfig: {
        temperature: 0.1,
        topP: 0.5,
        responseMimeType: 'application/json',
        responseSchema: questionsSchema,
      },
      signal,
      timeoutMs: 30_000,
      tag,
    });

    let questionsData: Record<string, string>;
    try {
      if (!text) throw new Error('Empty JSON response');
      questionsData = JSON.parse(text);
    } catch (e) {
      logger.error(`${tag} Failed to parse structured JSON response`, e);
      throw new Error('Invalid structured questions response');
    }

    const questions = [];
    const questionKeys = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'];
    for (let i = 0; i < questionKeys.length; i++) {
      const value = questionsData[questionKeys[i]];
      if (value && value.trim()) {
        questions.push({
          id: `q${i + 1}`,
          question: value.trim(),
          type: 'yes_no' as const,
          required: false,
        });
      }
    }
    logger.debug(`${tag} Extracted questions: ${questions.length}`);

    return NextResponse.json({
      questions,
      usage: { modelKey: 'modelMedium', usage },
    });
  }
);
