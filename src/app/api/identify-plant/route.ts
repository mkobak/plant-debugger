import { NextRequest, NextResponse } from 'next/server';
import { models } from '@/lib/api/gemini';
import { processFormData, convertImagesToBase64, validateImages } from '@/lib/api/shared';
import { PLANT_IDENTIFICATION_PROMPT } from '@/lib/api/prompts';

export async function POST(request: NextRequest) {
  console.log('=== IDENTIFY-PLANT API CALL START ===');
  
  try {
    const formData = await request.formData();
    const { images } = await processFormData(formData);
    
    validateImages(images);
    console.log(`[IDENTIFY-PLANT] Processing ${images.length} images`);

    // Convert images to base64 for Gemini
    const imageParts = await convertImagesToBase64(images);
    console.log(`[IDENTIFY-PLANT] Converted ${imageParts.length} images to base64`);

    // Log what we're sending to AI
    console.log('[IDENTIFY-PLANT] Sending to AI:', {
      prompt: PLANT_IDENTIFICATION_PROMPT,
      imageCount: imageParts.length,
      imageSizes: imageParts.map(img => img.inlineData.data.length),
      mimeTypes: imageParts.map(img => img.inlineData.mimeType)
    });

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

    // Log the full response from AI
    console.log('[IDENTIFY-PLANT] AI response candidates:', result.response.candidates?.length || 0);
    console.log('[IDENTIFY-PLANT] AI response full:', JSON.stringify(result.response, null, 2));

    const plantName = result.response.text().trim();
    console.log('[IDENTIFY-PLANT] Extracted plant name:', plantName);
    
    // Handle empty responses gracefully
    const identification = {
      species: plantName || '',  // Allow empty string as per requirements
      commonName: plantName || '',
      scientificName: plantName && plantName.includes(' ') ? plantName : undefined,
    };

    console.log('[IDENTIFY-PLANT] Final identification result:', identification);
    console.log('=== IDENTIFY-PLANT API CALL SUCCESS ===');

    return NextResponse.json({ identification });

  } catch (error) {
    console.error('=== IDENTIFY-PLANT API CALL ERROR ===');
    console.error('[IDENTIFY-PLANT] Error details:', error);
    console.error('[IDENTIFY-PLANT] Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('=== IDENTIFY-PLANT API CALL ERROR END ===');
    
    return NextResponse.json(
      { error: 'Failed to identify plant' },
      { status: 500 }
    );
  }
}
