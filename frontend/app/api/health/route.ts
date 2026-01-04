import { NextResponse } from 'next/server';

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://agent:8889';

export async function GET() {
  try {
    // Check backend health by calling settings endpoint
    const res = await fetch(`${WEBHOOK_URL}/settings`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      return NextResponse.json(
        { status: 'unhealthy', error: 'Backend not responding' },
        { status: 503 }
      );
    }

    return NextResponse.json({ status: 'healthy' });
  } catch (error) {
    console.error('[/api/health] Error:', error);
    return NextResponse.json(
      { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 503 }
    );
  }
}
