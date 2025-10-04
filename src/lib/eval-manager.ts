import { nanoid } from "nanoid";
import { getClickHouseClient } from "./clickhouse";

export interface ConversationOutcome {
  id: string;
  conversationId: string;
  userId: string;
  rating: number; // 1 (thumbs down) or 5 (thumbs up)
  resolved: boolean;
  feedbackText?: string;
  taskCategory?: string;
  metadata?: Record<string, any>;
}

export interface EvalExample {
  id: string;
  conversationId: string;
  taskCategory: string;
  userQuery: string;
  agentSteps: string;
  outcomeSummary: string;
  rating: number;
  timesUsed: number;
}

export interface EvalMetrics {
  metricDate: string;
  totalConversations: number;
  successfulConversations: number;
  failedConversations: number;
  avgRating: number;
  avgResolutionTimeMs: number;
  toolUsageStats: Record<string, any>;
}

export class EvalManager {
  private client = getClickHouseClient();

  // Record user feedback for a conversation
  async recordOutcome(data: Omit<ConversationOutcome, "id">): Promise<string> {
    const id = nanoid();

    await this.client.insert({
      table: "conversation_outcomes",
      values: [
        {
          id,
          conversation_id: data.conversationId,
          user_id: data.userId,
          rating: data.rating,
          resolved: data.resolved,
          feedback_text: data.feedbackText || "",
          task_category: data.taskCategory || "",
          metadata: JSON.stringify(data.metadata || {}),
        },
      ],
      format: "JSONEachRow",
    });

    // If positive feedback, potentially create an eval example
    if (data.rating >= 4 && data.resolved) {
      await this.createEvalExample(
        data.conversationId,
        data.taskCategory || "general"
      );
    }

    return id;
  }

  // Create an eval example from a successful conversation
  private async createEvalExample(
    conversationId: string,
    taskCategory: string
  ): Promise<void> {
    // Get conversation messages
    const messagesResult = await this.client.query({
      query: `
        SELECT role, content
        FROM messages
        WHERE conversation_id = {conversationId:String}
        ORDER BY created_at ASC
      `,
      query_params: { conversationId },
      format: "JSONEachRow",
    });

    const messages = await messagesResult.json();

    // Get tool uses
    const toolUsesResult = await this.client.query({
      query: `
        SELECT tool_name, input, output, status
        FROM tool_uses
        WHERE conversation_id = {conversationId:String}
        ORDER BY created_at ASC
      `,
      query_params: { conversationId },
      format: "JSONEachRow",
    });

    const toolUses = await toolUsesResult.json();

    // Extract user query (first user message)
    const userQuery =
      (messages as any[])
        .find((m: any) => m.role === "user")
        ?.parts?.find((part: any) => part.type === "text")?.text || "";

    // Summarize agent steps
    const agentSteps = JSON.stringify({
      messages: messages
        .filter((m: any) => m.role === "assistant")
        .map((m: any) => ({ content: m.content.substring(0, 200) })),
      tools: toolUses.map((t: any) => ({
        name: t.tool_name,
        status: t.status,
      })),
    });

    // Create outcome summary
    const outcomeSummary = `Resolved ${taskCategory} task using ${toolUses.length} tools`;

    // Get outcome rating
    const outcomeResult = await this.client.query({
      query: `
        SELECT rating
        FROM conversation_outcomes
        WHERE conversation_id = {conversationId:String}
        LIMIT 1
      `,
      query_params: { conversationId },
      format: "JSONEachRow",
    });

    const outcomes = await outcomeResult.json();
    const rating = (outcomes as any[])[0]?.rating || 5;

    // Insert eval example
    await this.client.insert({
      table: "eval_examples",
      values: [
        {
          id: nanoid(),
          conversation_id: conversationId,
          task_category: taskCategory,
          user_query: userQuery,
          agent_steps: agentSteps,
          outcome_summary: outcomeSummary,
          rating,
          times_used: 0,
          last_used: new Date().toISOString(),
        },
      ],
      format: "JSONEachRow",
    });
  }

  // Get successful examples for a task category
  async getSuccessfulExamples(
    taskCategory: string = "general",
    limit: number = 3
  ): Promise<EvalExample[]> {
    const result = await this.client.query({
      query: `
        SELECT
          id,
          conversation_id,
          task_category,
          user_query,
          agent_steps,
          outcome_summary,
          rating,
          times_used
        FROM eval_examples
        WHERE task_category = {taskCategory:String}
          AND rating >= 4
        ORDER BY rating DESC, times_used ASC
        LIMIT {limit:UInt32}
      `,
      query_params: {
        taskCategory,
        limit,
      },
      format: "JSONEachRow",
    });

    const examples = await result.json();

    // Update usage count
    for (const example of examples as any[]) {
      await this.client.exec({
        query: `
          ALTER TABLE eval_examples
          UPDATE times_used = times_used + 1, last_used = now64(3)
          WHERE id = '${example.id}'
        `,
      });
    }

    return examples as any[];
  }

  // Get metrics for a date range
  async getMetrics(startDate: string, endDate: string): Promise<EvalMetrics[]> {
    const result = await this.client.query({
      query: `
        SELECT
          toDate(co.created_at) as metric_date,
          count(*) as total_conversations,
          countIf(co.rating >= 4) as successful_conversations,
          countIf(co.rating < 4) as failed_conversations,
          avg(co.rating) as avg_rating,
          avg(dateDiff('millisecond', c.created_at, co.created_at)) as avg_resolution_time_ms
        FROM conversation_outcomes co
        JOIN conversations c ON co.conversation_id = c.id
        WHERE co.created_at BETWEEN {startDate:String} AND {endDate:String}
        GROUP BY metric_date
        ORDER BY metric_date DESC
      `,
      query_params: {
        startDate,
        endDate,
      },
      format: "JSONEachRow",
    });

    return result.json();
  }

  // Analyze tool usage patterns
  async analyzeToolUsage(days: number = 30): Promise<any> {
    const result = await this.client.query({
      query: `
        SELECT
          t.tool_name,
          count(*) as usage_count,
          countIf(t.status = 'success') as success_count,
          countIf(t.status = 'error') as error_count,
          avg(t.duration_ms) as avg_duration_ms,
          countIf(co.rating >= 4) as led_to_success
        FROM tool_uses t
        JOIN conversation_outcomes co ON t.conversation_id = co.conversation_id
        WHERE t.created_at >= now() - INTERVAL {days:UInt32} DAY
        GROUP BY t.tool_name
        ORDER BY usage_count DESC
      `,
      query_params: { days },
      format: "JSONEachRow",
    });

    return result.json();
  }

  // Get recent feedback
  async getRecentFeedback(limit: number = 20): Promise<any> {
    const result = await this.client.query({
      query: `
        SELECT
          co.id,
          co.conversation_id,
          co.rating,
          co.resolved,
          co.feedback_text,
          co.task_category,
          co.created_at,
          c.title
        FROM conversation_outcomes co
        JOIN conversations c ON co.conversation_id = c.id
        ORDER BY co.created_at DESC
        LIMIT {limit:UInt32}
      `,
      query_params: { limit },
      format: "JSONEachRow",
    });

    return result.json();
  }

  // Get success rate over time
  async getSuccessRateTrend(days: number = 30): Promise<any> {
    const result = await this.client.query({
      query: `
        SELECT
          toDate(created_at) as date,
          countIf(rating >= 4) * 100.0 / count(*) as success_rate,
          count(*) as total_feedback
        FROM conversation_outcomes
        WHERE created_at >= now() - INTERVAL {days:UInt32} DAY
        GROUP BY date
        ORDER BY date ASC
      `,
      query_params: { days },
      format: "JSONEachRow",
    });

    return result.json();
  }

  // Generate formatted examples for context injection
  async getFormattedExamplesForContext(
    taskCategory: string = "general",
    limit: number = 3
  ): Promise<string> {
    const examples = await this.getSuccessfulExamples(taskCategory, limit);

    if (examples.length === 0) {
      return "";
    }

    const formattedExamples = examples
      .map((example, index) => {
        const steps = JSON.parse(example.agentSteps);
        return `
**Example ${index + 1}: Successful ${example.taskCategory} resolution**
User Query: ${example.userQuery}
Agent Approach: ${steps.tools.map((t: any) => t.name).join(" → ")}
Outcome: ${example.outcomeSummary} (Rating: ${example.rating}/5)
`;
      })
      .join("\n");

    return `
## Examples of Successful Resolutions

These are real examples of how similar tasks were successfully resolved:

${formattedExamples}

Use these examples as guidance for handling similar requests, but adapt your approach based on the specific context and user needs.
`;
  }
}

export const evalManager = new EvalManager();
