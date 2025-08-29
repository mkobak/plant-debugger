import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Returns a random sample image (filename + public URL) from /public/sample-images
export async function GET() {
  try {
    const samplesDir = path.join(process.cwd(), 'public', 'sample-images');
    let files: string[] = [];
    try {
      files = await fs.readdir(samplesDir);
    } catch (err) {
      return NextResponse.json(
        { error: 'Sample images directory not found' },
        { status: 404 }
      );
    }

    const imageFiles = files.filter(
      (f) => /\.(jpe?g|png)$/i.test(f) && !f.startsWith('.')
    );

    if (imageFiles.length === 0) {
      return NextResponse.json(
        { error: 'No sample images available' },
        { status: 404 }
      );
    }

    const randomFile =
      imageFiles[Math.floor(Math.random() * imageFiles.length)];
    return NextResponse.json(
      {
        filename: randomFile,
        url: `/sample-images/${randomFile}`,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('sample-image route error', error);
    return NextResponse.json(
      { error: 'Failed to fetch sample image' },
      { status: 500 }
    );
  }
}
