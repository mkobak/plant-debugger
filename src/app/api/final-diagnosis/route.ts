import { NextResponse } from 'next/server';
import { withApiRoute } from '@/lib/api/withApiRoute';
import { geminiCall } from '@/lib/api/geminiCall';
import { finalDiagnosisSchema } from '@/lib/api/schemas';
import { createFinalDiagnosisPrompt } from '@/lib/api/prompts';
import { printAndResetForRequest } from '@/lib/api/costServer';
import { logger } from '@/lib/logger';

export const maxDuration = 60;

export const POST = withApiRoute(
  'FINAL-DIAGNOSIS',
  { errorMessage: 'Failed to generate final diagnosis' },
  async ({ request, tag, signal, data, imageParts }) => {
    const prompt = createFinalDiagnosisPrompt(
      data.questionsAndAnswers || '',
      data.userComment || '',
      data.rankedDiagnoses || ''
    );

    const { text, usage } = await geminiCall({
      request,
      modelKey: 'modelMedium',
      parts: [{ text: prompt }, ...imageParts],
      generationConfig: {
        temperature: 0.1,
        topP: 0.5,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: finalDiagnosisSchema,
      },
      signal,
      timeoutMs: 45_000,
      tag,
    });

    let diagnosisData: any;
    try {
      if (!text) throw new Error('Empty JSON response text');
      diagnosisData = JSON.parse(text);
    } catch (e) {
      logger.error(`${tag} Failed to parse structured JSON response`, e);
      throw new Error('Invalid structured diagnosis response');
    }

    const diagnosisResult = {
      primary: {
        condition: diagnosisData.primaryDiagnosis,
        confidence: diagnosisData.primaryConfidence,
        summary: diagnosisData.primarySummary,
        reasoning: diagnosisData.primaryReasoning,
        treatment: diagnosisData.primaryTreatmentPlan,
        prevention: diagnosisData.primaryPreventionTips,
      },
      ...(diagnosisData.secondaryDiagnosis && {
        secondary: {
          condition: diagnosisData.secondaryDiagnosis,
          confidence: diagnosisData.secondaryConfidence,
          summary: diagnosisData.secondarySummary,
          reasoning: diagnosisData.secondaryReasoning,
          treatment: diagnosisData.secondaryTreatmentPlan,
          prevention: diagnosisData.secondaryPreventionTips,
        },
      }),
      careTips: diagnosisData.careTips || 'No care tips provided',
      plant: diagnosisData.plant,
    };

    // Print a server-side cost summary in the terminal
    printAndResetForRequest(request, 'Plant Debugger');

    return NextResponse.json({
      diagnosisResult,
      usage: { modelKey: 'modelMedium', usage },
    });
  }
);
