import { NextRequest, NextResponse } from 'next/server';
import { models } from '@/lib/api/gemini';
import { 
  checkRateLimit, 
  getClientId, 
  addRateLimitDelay,
  processFormData, 
  convertImagesToBase64, 
  validateImages 
} from '@/lib/api/shared';
import { createInitialDiagnosisPrompt, createAggregationPrompt } from '@/lib/api/prompts';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const clientId = getClientId(request);
    
    if (!checkRateLimit(clientId)) {
      console.warn(`Rate limit exceeded for client: ${clientId}`);
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const { images, questionsAndAnswers } = await processFormData(formData);
    
    validateImages(images);

    console.log(`Initial diagnosis requested for ${images.length} images by client: ${clientId}`);

    // Additional protection: if there are multiple rapid requests, add a delay
    await addRateLimitDelay(clientId);

    // Convert images to base64 for Gemini
    const imageParts = await convertImagesToBase64(images);

    const INITIAL_DIAGNOSIS_PROMPT = createInitialDiagnosisPrompt(questionsAndAnswers || '');

    // Run 3 parallel diagnosis calls for consensus
    const diagnosisPromises = Array(3).fill(null).map(async () => {
      const result = await models.modelLow.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              { text: INITIAL_DIAGNOSIS_PROMPT },
              ...imageParts,
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          topP: 0.5,
        },
      });
      return result.response.text().trim();
    });

    const diagnosisResults = await Promise.all(diagnosisPromises);

    // Aggregate the diagnoses
    const AGGREGATION_PROMPT = createAggregationPrompt(diagnosisResults);

    const aggregationResult = await models.modelLow.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: AGGREGATION_PROMPT }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        topP: 0.5,
      },
    });

    const rankedDiagnoses = aggregationResult.response.text().trim();

    return NextResponse.json({ 
      rawDiagnoses: diagnosisResults,
      rankedDiagnoses 
    });

  } catch (error) {
    console.error('Initial diagnosis error:', error);
    return NextResponse.json(
      { error: 'Failed to generate initial diagnosis' },
      { status: 500 }
    );
  }
}
