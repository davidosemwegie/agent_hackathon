import { NextResponse } from 'next/server';
import { evalManager } from '@/lib/eval-manager';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      conversationId,
      userId,
      rating,
      resolved,
      feedbackText,
      taskCategory,
      metadata,
    } = body;

    if (!conversationId || !userId || rating === undefined || resolved === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const outcomeId = await evalManager.recordOutcome({
      conversationId,
      userId,
      rating,
      resolved,
      feedbackText,
      taskCategory,
      metadata,
    });

    return NextResponse.json({ success: true, outcomeId });
  } catch (error) {
    console.error('Error recording feedback:', error);
    return NextResponse.json(
      { error: 'Failed to record feedback' },
      { status: 500 }
    );
  }
}
