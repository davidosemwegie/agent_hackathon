import { NextResponse } from 'next/server';
import { evalManager } from '@/lib/eval-manager';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || 'general';
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const examples = await evalManager.getSuccessfulExamples(category, limit);

    return NextResponse.json({ examples });
  } catch (error) {
    console.error('Error fetching examples:', error);
    return NextResponse.json(
      { error: 'Failed to fetch examples' },
      { status: 500 }
    );
  }
}
