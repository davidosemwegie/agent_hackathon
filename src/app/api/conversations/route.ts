import { NextResponse } from 'next/server';
import { conversationLogger } from '@/lib/conversation-logger';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') || 'default-user';
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  try {
    const conversations = await conversationLogger.getConversations(userId, limit);
    return NextResponse.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}
