import { NextRequest, NextResponse } from 'next/server';
import { models } from '@/lib/api/gemini';
import { getDiagnosisQuestions } from '@/lib/api/utils';
import { processFormData, convertImagesToBase64, validateImages } from '@/lib/api/shared';
import { QUESTIONS_GENERATION_PROMPT } from '@/lib/api/prompts';
import { recordUsageForRequest } from '@/lib/api/costServer';
import { printPrompt, printResponse } from '@/lib/api/logging';

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).slice(2, 8);
  console.log(`[GENERATE-QUESTIONS:${requestId}] START`);
  
  try {
    const { signal } = request as unknown as { signal?: AbortSignal };
    signal?.addEventListener?.('abort', () => {
      console.warn(`[GENERATE-QUESTIONS:${requestId}] Request aborted by client`);
    });

    if (signal?.aborted) {
      console.warn(`[GENERATE-QUESTIONS:${requestId}] Aborted before reading form data`);
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    const formData = await request.formData();
    const { images } = await processFormData(formData);
    
  validateImages(images);
  const totalImageBytes = images.reduce((s, f) => s + (f.size || 0), 0);
  console.log(`[GENERATE-QUESTIONS:${requestId}] images: ${images.length} (~${Math.round(totalImageBytes/1024)} KB)`);

    if (signal?.aborted) {
      console.warn(`[GENERATE-QUESTIONS:${requestId}] Aborted before converting images`);
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

  // Convert images to base64 for Gemini
  const imageParts = await convertImagesToBase64(images);
  console.log(`[GENERATE-QUESTIONS:${requestId}] Converted ${imageParts.length} images to base64`);

  // Print prompt exactly once (gated)
  printPrompt(`[GENERATE-QUESTIONS:${requestId}]`, QUESTIONS_GENERATION_PROMPT);

    const tools = getDiagnosisQuestions();

  // Concise send summary
  console.log(`[GENERATE-QUESTIONS:${requestId}] Sending to AI | images: ${imageParts.length} | tools: ${tools.length}`);

    // Call Gemini API for questions generation
    if (signal?.aborted) {
      console.warn(`[GENERATE-QUESTIONS:${requestId}] Aborted before model call`);
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    const result = await models.modelMedium.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: QUESTIONS_GENERATION_PROMPT },
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

  // Print full response exactly once (gated)
  printResponse(`[GENERATE-QUESTIONS:${requestId}]`, result.response);
  const usage = (result.response?.usageMetadata || {}) as any;
  if (!usage || ((usage?.promptTokenCount ?? 0) === 0 && (usage?.candidatesTokenCount ?? 0) === 0)) {
      console.warn(`[GENERATE-QUESTIONS:${requestId}] Missing or zero usage metadata`);
    }
    recordUsageForRequest(request, 'modelMedium', usage);

    // Handle function calling response
    let questionsData;
    try {
  const response = result.response;
  console.log(`[GENERATE-QUESTIONS:${requestId}] candidates: ${response.candidates?.length}`);
      
      if (response.candidates && response.candidates.length > 0) {
  const candidate = response.candidates[0];
  console.log(`[GENERATE-QUESTIONS:${requestId}] parts: ${candidate.content?.parts?.length}`);
        
        if (candidate.content?.parts) {
          const functionCallPart = candidate.content.parts.find(part => 'functionCall' in part);
          
          if (functionCallPart && 'functionCall' in functionCallPart && functionCallPart.functionCall) {
            console.log(`[GENERATE-QUESTIONS:${requestId}] functionCall: ${functionCallPart.functionCall.name}`);
            questionsData = functionCallPart.functionCall.args;
          } else {
            // Fallback: try to parse text response
            const textPart = candidate.content.parts.find(part => 'text' in part);
            if (textPart && 'text' in textPart && textPart.text) {
              console.log(`[GENERATE-QUESTIONS:${requestId}] Fallback to text parsing`);
              const responseText = textPart.text;
              console.log(`[GENERATE-QUESTIONS:${requestId}] text excerpt:`, responseText.slice(0, 1000));
              
              // Try to extract JSON from text
              const jsonMatch = responseText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                questionsData = JSON.parse(jsonMatch[0]);
              } else {
                throw new Error('No function call or valid JSON found in response');
              }
            } else {
              throw new Error('No function call or text found in response');
            }
          }
        } else {
          throw new Error('No content parts found in response');
        }
      } else {
        throw new Error('No candidates found in response');
      }
    } catch (parseError) {
  console.error(`[GENERATE-QUESTIONS:${requestId}] Parsing failed:`, parseError);
      throw new Error('Invalid questions response format');
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

  console.log(`[GENERATE-QUESTIONS:${requestId}] Extracted questions: ${questions.length}`);
  console.log(`[GENERATE-QUESTIONS:${requestId}] SUCCESS`);
    
    return NextResponse.json({ 
      questions,
  usage: { modelKey: 'modelMedium', usage }
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
