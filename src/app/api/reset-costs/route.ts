import { NextRequest, NextResponse } from 'next/server';
import { resetForRequest } from '@/lib/api/costServer';

export async function POST(request: NextRequest) {
  try {
    resetForRequest(request);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
