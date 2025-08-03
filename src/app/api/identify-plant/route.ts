import { NextRequest, NextResponse } from 'next/server';
import { models } from '@/lib/api/gemini';
import { processFormData, convertImagesToBase64, validateImages } from '@/lib/api/shared';
import { PLANT_IDENTIFICATION_PROMPT } from '@/lib/api/prompts';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const { images } = await processFormData(formData);
    
    validateImages(images);

    // Convert images to base64 for Gemini
    const imageParts = await convertImagesToBase64(images);

    // Call Gemini API for plant identification
    const result = await models.modelLow.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: PLANT_IDENTIFICATION_PROMPT },
            ...imageParts,
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        topP: 0.5,
      },
    });

    const plantName = result.response.text().trim();
    
    const identification = {
      species: plantName,
      commonName: plantName,
      scientificName: plantName.includes(' ') ? plantName : undefined,
    };

    return NextResponse.json({ identification });

  } catch (error) {
    console.error('Plant identification error:', error);
    return NextResponse.json(
      { error: 'Failed to identify plant' },
      { status: 500 }
    );
  }
}
