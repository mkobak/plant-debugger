import { NextRequest, NextResponse } from 'next/server';
import { resetForRequest } from '@/lib/api/costServer';
import { logger } from '@/lib/logger';

// Dev-only helper: resets in-memory cost counters for the calling client.
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    resetForRequest(request);
    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.warn('[RESET-COSTS] Failed to reset cost counters', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
