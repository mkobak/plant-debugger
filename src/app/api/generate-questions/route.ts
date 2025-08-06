import { NextRequest, NextResponse } from 'next/server';
import { models } from '@/lib/api/gemini';
import { getDiagnosisQuestions } from '@/lib/api/utils';
import { processFormData, convertImagesToBase64, validateImages } from '@/lib/api/shared';
import { QUESTIONS_GENERATION_PROMPT } from '@/lib/api/prompts';

export async function POST(request: NextRequest) {
  console.log('=== GENERATE-QUESTIONS API CALL START ===');
  
  try {
    const formData = await request.formData();
    const { images } = await processFormData(formData);
    
    validateImages(images);
    console.log(`[GENERATE-QUESTIONS] Processing ${images.length} images`);

    // Convert images to base64 for Gemini
    const imageParts = await convertImagesToBase64(images);
    console.log(`[GENERATE-QUESTIONS] Converted ${imageParts.length} images to base64`);

    const tools = getDiagnosisQuestions();

    // Log what we're sending to AI
    console.log('[GENERATE-QUESTIONS] Sending to AI:', {
      prompt: QUESTIONS_GENERATION_PROMPT,
      imageCount: imageParts.length,
      imageSizes: imageParts.map(img => img.inlineData.data.length),
      mimeTypes: imageParts.map(img => img.inlineData.mimeType),
      toolsCount: tools.length
    });

    // Call Gemini API for questions generation
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

    console.log('[GENERATE-QUESTIONS] AI response received');
    console.log('[GENERATE-QUESTIONS] AI response full:', JSON.stringify(result.response, null, 2));

    // Handle function calling response
    let questionsData;
    try {
      const response = result.response;
      console.log('[GENERATE-QUESTIONS] AI response candidates:', response.candidates?.length);
      
      if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        console.log('[GENERATE-QUESTIONS] Candidate content parts:', candidate.content?.parts?.length);
        
        if (candidate.content?.parts) {
          const functionCallPart = candidate.content.parts.find(part => 'functionCall' in part);
          
          if (functionCallPart && 'functionCall' in functionCallPart && functionCallPart.functionCall) {
            console.log('[GENERATE-QUESTIONS] Function call found:', functionCallPart.functionCall.name);
            console.log('[GENERATE-QUESTIONS] Function call args:', JSON.stringify(functionCallPart.functionCall.args, null, 2));
            questionsData = functionCallPart.functionCall.args;
          } else {
            // Fallback: try to parse text response
            const textPart = candidate.content.parts.find(part => 'text' in part);
            if (textPart && 'text' in textPart && textPart.text) {
              console.log('[GENERATE-QUESTIONS] Fallback to text parsing');
              const responseText = textPart.text;
              console.log('[GENERATE-QUESTIONS] Response text:', responseText);
              
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
      console.error('[GENERATE-QUESTIONS] Response parsing failed:', parseError);
      console.error('[GENERATE-QUESTIONS] Raw response:', JSON.stringify(result.response, null, 2));
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

    console.log('[GENERATE-QUESTIONS] Extracted questions:', questions.length);
    console.log('[GENERATE-QUESTIONS] Questions data:', questions);
    console.log('=== GENERATE-QUESTIONS API CALL SUCCESS ===');
    
    return NextResponse.json({ questions });

  } catch (error) {
    console.error('=== GENERATE-QUESTIONS API CALL ERROR ===');
    console.error('[GENERATE-QUESTIONS] Error details:', error);
    console.error('[GENERATE-QUESTIONS] Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('=== GENERATE-QUESTIONS API CALL ERROR END ===');
    
    return NextResponse.json(
      { error: 'Failed to generate questions' },
      { status: 500 }
    );
  }
}
