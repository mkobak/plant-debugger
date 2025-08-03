import { NextRequest, NextResponse } from 'next/server';
import { models } from '@/lib/api/gemini';
import { getDiagnosisQuestions } from '@/lib/api/utils';
import { processFormData, convertImagesToBase64, validateImages } from '@/lib/api/shared';
import { QUESTIONS_GENERATION_PROMPT } from '@/lib/api/prompts';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const { images } = await processFormData(formData);
    
    validateImages(images);

    // Convert images to base64 for Gemini
    const imageParts = await convertImagesToBase64(images);

    const tools = getDiagnosisQuestions();

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

    console.log('Generate-questions API call completed');

    // Handle function calling response
    let questionsData;
    try {
      const response = result.response;
      console.log('Generate-questions response candidates:', response.candidates?.length);
      
      if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        console.log('Generate-questions candidate content parts:', candidate.content?.parts?.length);
        
        if (candidate.content?.parts) {
          const functionCallPart = candidate.content.parts.find(part => 'functionCall' in part);
          
          if (functionCallPart && 'functionCall' in functionCallPart && functionCallPart.functionCall) {
            console.log('Generate-questions function call found:', functionCallPart.functionCall.name);
            console.log('Generate-questions function call args:', JSON.stringify(functionCallPart.functionCall.args, null, 2));
            questionsData = functionCallPart.functionCall.args;
          } else {
            // Fallback: try to parse text response
            const textPart = candidate.content.parts.find(part => 'text' in part);
            if (textPart && 'text' in textPart && textPart.text) {
              console.log('Generate-questions fallback to text parsing');
              const responseText = textPart.text;
              console.log('Generate-questions response text:', responseText);
              
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
      console.error('Generate-questions response parsing failed:', parseError);
      console.error('Generate-questions raw response:', JSON.stringify(result.response, null, 2));
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

    console.log('Generate-questions extracted questions:', questions.length);
    return NextResponse.json({ questions });

  } catch (error) {
    console.error('Questions generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate questions' },
      { status: 500 }
    );
  }
}
