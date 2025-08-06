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
  console.log('=== INITIAL-DIAGNOSIS API CALL START ===');
  
  try {
    // Rate limiting check
    const clientId = getClientId(request);
    
    if (!checkRateLimit(clientId)) {
      console.warn(`[INITIAL-DIAGNOSIS] Rate limit exceeded for client: ${clientId}`);
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const { images, questionsAndAnswers } = await processFormData(formData);
    
    validateImages(images);
    console.log(`[INITIAL-DIAGNOSIS] Processing ${images.length} images for client: ${clientId}`);
    console.log(`[INITIAL-DIAGNOSIS] Questions and answers:`, questionsAndAnswers);

    // Additional protection: if there are multiple rapid requests, add a delay
    await addRateLimitDelay(clientId);

    // Convert images to base64 for Gemini
    const imageParts = await convertImagesToBase64(images);
    console.log(`[INITIAL-DIAGNOSIS] Converted ${imageParts.length} images to base64`);

    const INITIAL_DIAGNOSIS_PROMPT = createInitialDiagnosisPrompt(questionsAndAnswers || '');
    
    // Log what we're sending to AI
    console.log('[INITIAL-DIAGNOSIS] Sending to AI:', {
      prompt: INITIAL_DIAGNOSIS_PROMPT.substring(0, 200) + '...',
      questionsAndAnswers: questionsAndAnswers || 'None',
      imageCount: imageParts.length,
      imageSizes: imageParts.map(img => img.inlineData.data.length),
      mimeTypes: imageParts.map(img => img.inlineData.mimeType)
    });

    // Run 3 parallel diagnosis calls for consensus
    console.log('[INITIAL-DIAGNOSIS] Starting 3 parallel diagnosis calls...');
    const diagnosisPromises = Array(3).fill(null).map(async (_, index) => {
      console.log(`[INITIAL-DIAGNOSIS] Starting diagnosis call ${index + 1}/3`);
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
      const response = result.response.text().trim();
      console.log(`[INITIAL-DIAGNOSIS] Diagnosis call ${index + 1}/3 completed:`, response);
      return response;
    });

    const diagnosisResults = await Promise.all(diagnosisPromises);
    console.log('[INITIAL-DIAGNOSIS] All 3 diagnosis calls completed:', diagnosisResults);

    // Aggregate the diagnoses
    const AGGREGATION_PROMPT = createAggregationPrompt(diagnosisResults);
    console.log('[INITIAL-DIAGNOSIS] Starting aggregation with prompt:', AGGREGATION_PROMPT.substring(0, 200) + '...');

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
    console.log('[INITIAL-DIAGNOSIS] Aggregation completed:', rankedDiagnoses);

    const result = { 
      rawDiagnoses: diagnosisResults,
      rankedDiagnoses 
    };
    
    console.log('[INITIAL-DIAGNOSIS] Final result:', result);
    console.log('=== INITIAL-DIAGNOSIS API CALL SUCCESS ===');

    return NextResponse.json(result);

  } catch (error) {
    console.error('=== INITIAL-DIAGNOSIS API CALL ERROR ===');
    console.error('[INITIAL-DIAGNOSIS] Error details:', error);
    console.error('[INITIAL-DIAGNOSIS] Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('=== INITIAL-DIAGNOSIS API CALL ERROR END ===');
    
    return NextResponse.json(
      { error: 'Failed to generate initial diagnosis' },
      { status: 500 }
    );
  }
}
