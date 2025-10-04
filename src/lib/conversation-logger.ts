import { nanoid } from 'nanoid';
import { getClickHouseClient } from './clickhouse';

export interface ConversationData {
  id: string;
  userId: string;
  title?: string;
  metadata?: Record<string, any>;
}

export interface MessageData {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
}

export interface ToolUseData {
  id: string;
  conversationId: string;
  messageId: string;
  toolName: string;
  input: string;
  output: string;
  durationMs: number;
  status: 'success' | 'error';
}

export class ConversationLogger {
  private client = getClickHouseClient();

  async createConversation(data: Omit<ConversationData, 'id'>): Promise<string> {
    const id = nanoid();

    await this.client.insert({
      table: 'conversations',
      values: [{
        id,
        user_id: data.userId,
        title: data.title || '',
        metadata: JSON.stringify(data.metadata || {}),
      }],
      format: 'JSONEachRow',
    });

    return id;
  }

  async updateConversationTitle(conversationId: string, title: string) {
    await this.client.exec({
      query: `
        ALTER TABLE conversations
        UPDATE title = '${title.replace(/'/g, "\\'")}', updated_at = now64(3)
        WHERE id = '${conversationId}'
      `,
    });
  }

  async logMessage(data: Omit<MessageData, 'id'>): Promise<string> {
    const id = nanoid();

    await this.client.insert({
      table: 'messages',
      values: [{
        id,
        conversation_id: data.conversationId,
        role: data.role,
        content: data.content,
        metadata: JSON.stringify(data.metadata || {}),
      }],
      format: 'JSONEachRow',
    });

    return id;
  }

  async logToolUse(data: Omit<ToolUseData, 'id'>): Promise<string> {
    const id = nanoid();

    await this.client.insert({
      table: 'tool_uses',
      values: [{
        id,
        conversation_id: data.conversationId,
        message_id: data.messageId,
        tool_name: data.toolName,
        input: data.input,
        output: data.output,
        duration_ms: data.durationMs,
        status: data.status,
      }],
      format: 'JSONEachRow',
    });

    return id;
  }

  async getConversations(userId: string, limit = 50) {
    const result = await this.client.query({
      query: `
        SELECT
          id,
          user_id,
          title,
          created_at,
          updated_at,
          metadata
        FROM conversations
        WHERE user_id = {userId:String}
        ORDER BY updated_at DESC
        LIMIT {limit:UInt32}
      `,
      query_params: {
        userId,
        limit,
      },
      format: 'JSONEachRow',
    });

    return result.json();
  }

  async getConversationMessages(conversationId: string) {
    const result = await this.client.query({
      query: `
        SELECT
          id,
          conversation_id,
          role,
          content,
          created_at,
          metadata
        FROM messages
        WHERE conversation_id = {conversationId:String}
        ORDER BY created_at ASC
      `,
      query_params: {
        conversationId,
      },
      format: 'JSONEachRow',
    });

    return result.json();
  }

  async getToolUses(conversationId: string) {
    const result = await this.client.query({
      query: `
        SELECT
          id,
          conversation_id,
          message_id,
          tool_name,
          input,
          output,
          created_at,
          duration_ms,
          status
        FROM tool_uses
        WHERE conversation_id = {conversationId:String}
        ORDER BY created_at ASC
      `,
      query_params: {
        conversationId,
      },
      format: 'JSONEachRow',
    });

    return result.json();
  }

  async deleteConversation(conversationId: string) {
    await this.client.exec({
      query: `DELETE FROM conversations WHERE id = '${conversationId}'`,
    });
    await this.client.exec({
      query: `DELETE FROM messages WHERE conversation_id = '${conversationId}'`,
    });
    await this.client.exec({
      query: `DELETE FROM tool_uses WHERE conversation_id = '${conversationId}'`,
    });
  }
}

export const conversationLogger = new ConversationLogger();
