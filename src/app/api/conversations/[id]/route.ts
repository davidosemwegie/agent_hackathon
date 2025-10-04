import { NextResponse } from 'next/server';
import { conversationLogger } from '@/lib/conversation-logger';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const conversationId = params.id;

    const [messages, toolUses] = await Promise.all([
      conversationLogger.getConversationMessages(conversationId),
      conversationLogger.getToolUses(conversationId),
    ]);

    return NextResponse.json({
      conversationId,
      messages,
      toolUses,
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const conversationId = params.id;
    await conversationLogger.deleteConversation(conversationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    );
  }
}
