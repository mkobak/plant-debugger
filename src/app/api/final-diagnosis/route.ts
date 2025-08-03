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
    const { images, questionsAndAnswers, rankedDiagnoses } = await processFormData(formData);
    
    validateImages(images);

    console.log(`Final diagnosis requested for ${images.length} images by client: ${clientId}`);

    // Additional protection: if there are multiple rapid requests, add a delay
    await addRateLimitDelay(clientId);

    // Convert images to base64 for Gemini
    const imageParts = await convertImagesToBase64(images);

    const MAIN_DIAGNOSIS_PROMPT = createFinalDiagnosisPrompt(questionsAndAnswers || '', rankedDiagnoses || '');

    const tools = getDiagnosisTools();

    // Call Gemini API for final structured diagnosis
    const result = await models.modelHigh.generateContent({
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

    // Parse the function call response
    const response = result.response;
    console.log('Final diagnosis response candidates:', JSON.stringify(response.candidates, null, 2));
    
    if (!response.candidates || response.candidates.length === 0) {
      throw new Error('No response candidates received from AI');
    }

    const candidate = response.candidates[0];
    if (!candidate.content || !candidate.content.parts) {
      throw new Error('No content parts in response');
    }

    let diagnosisData;
    
    // Look for function calls in the response parts
    const functionCallPart = candidate.content.parts.find(part => part.functionCall);
    if (functionCallPart && functionCallPart.functionCall) {
      console.log('Function call found:', JSON.stringify(functionCallPart.functionCall, null, 2));
      
      if (functionCallPart.functionCall.name === 'plant_diagnosis') {
        diagnosisData = functionCallPart.functionCall.args;
      } else {
        throw new Error(`Unexpected function call: ${functionCallPart.functionCall.name}`);
      }
    } else {
      // Fallback: try to parse as text response if no function call
      const responseText = response.text();
      console.log('No function call found, trying to parse text response:', responseText);
      
      try {
        // Extract JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          diagnosisData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response and no function call');
        }
      } catch (parseError) {
        console.error('Failed to parse diagnosis response:', parseError);
        console.error('Response text:', responseText);
        throw new Error('Invalid diagnosis response format');
      }
    }

    console.log('Parsed diagnosis data:', JSON.stringify(diagnosisData, null, 2));

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

    console.log('Final diagnosis result:', JSON.stringify(diagnosisResult, null, 2));

    return NextResponse.json({ diagnosisResult });

  } catch (error) {
    console.error('Final diagnosis error:', error);
    return NextResponse.json(
      { error: 'Failed to generate final diagnosis' },
      { status: 500 }
    );
  }
}
