import { NextRequest, NextResponse } from 'next/server';
import { models } from '@/lib/api/gemini';
import { getDiagnosisTools } from '@/lib/api/utils';
import { 
  checkRateLimit, 
  getClientId, 
  addRateLimitDelay,
  processFormData, 
  convertImagesToBase64, 
  validateImages 
} from '@/lib/api/shared';
import { createFinalDiagnosisPrompt } from '@/lib/api/prompts';

export async function POST(request: NextRequest) {
  console.log('=== FINAL-DIAGNOSIS API CALL START ===');
  
  try {
    const { signal } = request as unknown as { signal?: AbortSignal };
    signal?.addEventListener?.('abort', () => {
      console.warn('[FINAL-DIAGNOSIS] Request aborted by client');
    });

    // Rate limiting check
    const clientId = getClientId(request);
    
    if (!checkRateLimit(clientId)) {
      console.warn(`[FINAL-DIAGNOSIS] Rate limit exceeded for client: ${clientId}`);
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429 }
      );
    }

    if (signal?.aborted) {
      console.warn('[FINAL-DIAGNOSIS] Aborted before reading form data');
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    const formData = await request.formData();
    const { images, questionsAndAnswers, rankedDiagnoses } = await processFormData(formData);
    
    validateImages(images);
    console.log(`[FINAL-DIAGNOSIS] Processing ${images.length} images for client: ${clientId}`);
    console.log(`[FINAL-DIAGNOSIS] Questions and answers:`, questionsAndAnswers);
    console.log(`[FINAL-DIAGNOSIS] Ranked diagnoses:`, rankedDiagnoses);

    // Additional protection: if there are multiple rapid requests, add a delay
    await addRateLimitDelay(clientId);

    if (signal?.aborted) {
      console.warn('[FINAL-DIAGNOSIS] Aborted before converting images');
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    // Convert images to base64 for Gemini
    const imageParts = await convertImagesToBase64(images);
    console.log(`[FINAL-DIAGNOSIS] Converted ${imageParts.length} images to base64`);

    const MAIN_DIAGNOSIS_PROMPT = createFinalDiagnosisPrompt(questionsAndAnswers || '', rankedDiagnoses || '');
    console.log(`[FINAL-DIAGNOSIS] Generated diagnosis prompt:`, MAIN_DIAGNOSIS_PROMPT);

    const tools = getDiagnosisTools();
    
    // Log what we're sending to AI
    console.log('[FINAL-DIAGNOSIS] Sending to AI:', {
      promptLength: MAIN_DIAGNOSIS_PROMPT.length,
      questionsAndAnswers: questionsAndAnswers || 'None',
      rankedDiagnoses: rankedDiagnoses || 'None',
      imageCount: imageParts.length,
      imageSizes: imageParts.map(img => img.inlineData.data.length),
      mimeTypes: imageParts.map(img => img.inlineData.mimeType),
      toolsCount: tools.length
    });

    // Call Gemini API for final structured diagnosis
    if (signal?.aborted) {
      console.warn('[FINAL-DIAGNOSIS] Aborted before model call');
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    console.log('[FINAL-DIAGNOSIS] Calling Gemini API...');
    const genPromise = models.modelHigh.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: MAIN_DIAGNOSIS_PROMPT },
            ...imageParts,
          ],
        },
      ],
      tools,
      generationConfig: {
        temperature: 0.1,
        topP: 0.5,
      },
    });
    // Race with abort to stop further processing early if canceled
    const result = await new Promise<typeof genPromise extends Promise<infer R> ? R : never>((resolve, reject) => {
      if (signal?.aborted) return reject(new Error('aborted'));
      const onAbort = () => reject(new Error('aborted'));
      signal?.addEventListener?.('abort', onAbort, { once: true });
      genPromise.then(r => {
        signal?.removeEventListener?.('abort', onAbort);
        resolve(r);
      }).catch(err => {
        signal?.removeEventListener?.('abort', onAbort);
        reject(err);
      });
    }).catch(err => {
      if ((err as Error)?.message === 'aborted') {
        console.warn('[FINAL-DIAGNOSIS] Aborted during model call');
        throw new Error('aborted');
      }
      throw err;
    });

    // Parse the function call response
    const response = result.response;
    console.log('[FINAL-DIAGNOSIS] AI response received');
    console.log('[FINAL-DIAGNOSIS] AI response full:', JSON.stringify(response, null, 2));
    console.log('[FINAL-DIAGNOSIS] Response candidates count:', response.candidates?.length || 0);
    
    if (!response.candidates || response.candidates.length === 0) {
      throw new Error('No response candidates received from AI');
    }

    const candidate = response.candidates[0];
    console.log('[FINAL-DIAGNOSIS] First candidate:', JSON.stringify(candidate, null, 2));
    
    if (!candidate.content || !candidate.content.parts) {
      throw new Error('No content parts in response');
    }

    let diagnosisData;
    
    // Look for function calls in the response parts
    const functionCallPart = candidate.content.parts.find(part => part.functionCall);
    if (functionCallPart && functionCallPart.functionCall) {
      console.log('[FINAL-DIAGNOSIS] Function call found:', JSON.stringify(functionCallPart.functionCall, null, 2));
      
      if (functionCallPart.functionCall.name === 'plant_diagnosis') {
        diagnosisData = functionCallPart.functionCall.args;
        console.log('[FINAL-DIAGNOSIS] Extracted diagnosis data from function call:', JSON.stringify(diagnosisData, null, 2));
      } else {
        throw new Error(`Unexpected function call: ${functionCallPart.functionCall.name}`);
      }
    } else {
      // Fallback: try to parse as text response if no function call
      const responseText = response.text();
      console.log('[FINAL-DIAGNOSIS] No function call found, trying to parse text response');
      console.log('[FINAL-DIAGNOSIS] Response text:', responseText);
      
      try {
        // Extract JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          diagnosisData = JSON.parse(jsonMatch[0]);
          console.log('[FINAL-DIAGNOSIS] Parsed diagnosis data from text:', JSON.stringify(diagnosisData, null, 2));
        } else {
          throw new Error('No JSON found in response and no function call');
        }
      } catch (parseError) {
        console.error('[FINAL-DIAGNOSIS] Failed to parse diagnosis response:', parseError);
        console.error('[FINAL-DIAGNOSIS] Response text:', responseText);
        throw new Error('Invalid diagnosis response format');
      }
    }

    console.log('[FINAL-DIAGNOSIS] Parsed diagnosis data:', JSON.stringify(diagnosisData, null, 2));

    // Format the response according to our DiagnosisResult interface
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
        }
      }),
      careTips: diagnosisData.careTips || 'No care tips provided',
      plant: diagnosisData.plant,
    };

    console.log('[FINAL-DIAGNOSIS] Final diagnosis result:', JSON.stringify(diagnosisResult, null, 2));
    console.log('=== FINAL-DIAGNOSIS API CALL SUCCESS ===');

    return NextResponse.json({ diagnosisResult });

  } catch (error) {
    console.error('=== FINAL-DIAGNOSIS API CALL ERROR ===');
    console.error('[FINAL-DIAGNOSIS] Error details:', error);
    console.error('[FINAL-DIAGNOSIS] Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('=== FINAL-DIAGNOSIS API CALL ERROR END ===');
    
    if (error instanceof Error && error.message === 'aborted') {
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    return NextResponse.json(
      { error: 'Failed to generate final diagnosis' },
      { status: 500 }
    );
  }
}
