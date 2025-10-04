import { createClient } from "@clickhouse/client";

// Create ClickHouse client singleton
let client: ReturnType<typeof createClient> | null = null;

export function getClickHouseClient() {
  if (!client) {
    let url: string;

    // Check if a complete URL is provided (for cloud providers)
    if (process.env.CLICKHOUSE_URL) {
      url = process.env.CLICKHOUSE_URL;
    } else {
      // Construct the full URL with embedded credentials
      const username = process.env.CLICKHOUSE_USER || "default";
      const password = process.env.CLICKHOUSE_PASSWORD || "";
      const host = process.env.CLICKHOUSE_HOST || "localhost";
      const port = process.env.CLICKHOUSE_PORT || "8443";
      const database = process.env.CLICKHOUSE_DATABASE || "default";
      const protocol = process.env.CLICKHOUSE_PROTOCOL || "http";

      // Build URL in format: http[s]://[username:password@]hostname:port[/database]
      url = `${protocol}://`;

      if (username && password) {
        // URL encode credentials to handle special characters
        const encodedUsername = encodeURIComponent(username);
        const encodedPassword = encodeURIComponent(password);
        url += `${encodedUsername}:${encodedPassword}@`;
      } else if (username) {
        url += `${encodeURIComponent(username)}@`;
      }

      url += `${host}:${port}/${database}`;
    }

    console.log("ClickHouse URL:", url.replace(/:[^:@]*@/, ":***@")); // Hide password in logs
    client = createClient({
      url: url,
    });
  }
  return client;
}

// Initialize database schema
export async function initializeClickHouseSchema() {
  const client = getClickHouseClient();

  // Create conversations table
  await client.exec({
    query: `
      CREATE TABLE IF NOT EXISTS conversations (
        id String,
        user_id String,
        created_at DateTime64(3) DEFAULT now64(3),
        updated_at DateTime64(3) DEFAULT now64(3),
        title String DEFAULT '',
        metadata String DEFAULT '{}'
      ) ENGINE = MergeTree()
      ORDER BY (user_id, created_at)
      PRIMARY KEY user_id
    `,
  });

  // Create messages table
  await client.exec({
    query: `
      CREATE TABLE IF NOT EXISTS messages (
        id String,
        conversation_id String,
        role String,
        content String,
        created_at DateTime64(3) DEFAULT now64(3),
        metadata String DEFAULT '{}'
      ) ENGINE = MergeTree()
      ORDER BY (conversation_id, created_at)
      PRIMARY KEY conversation_id
    `,
  });

  // Create tool_uses table
  await client.exec({
    query: `
      CREATE TABLE IF NOT EXISTS tool_uses (
        id String,
        conversation_id String,
        message_id String,
        tool_name String,
        input String,
        output String,
        created_at DateTime64(3) DEFAULT now64(3),
        duration_ms UInt32,
        status String
      ) ENGINE = MergeTree()
      ORDER BY (conversation_id, created_at)
      PRIMARY KEY conversation_id
    `,
  });

  // Create conversation_outcomes table for feedback
  await client.exec({
    query: `
      CREATE TABLE IF NOT EXISTS conversation_outcomes (
        id String,
        conversation_id String,
        user_id String,
        rating Int8,
        resolved Boolean,
        feedback_text String DEFAULT '',
        task_category String DEFAULT '',
        created_at DateTime64(3) DEFAULT now64(3),
        metadata String DEFAULT '{}'
      ) ENGINE = MergeTree()
      ORDER BY (user_id, created_at)
      PRIMARY KEY user_id
    `,
  });

  // Create eval_examples table for successful conversation examples
  await client.exec({
    query: `
      CREATE TABLE IF NOT EXISTS eval_examples (
        id String,
        conversation_id String,
        task_category String,
        user_query String,
        agent_steps String,
        outcome_summary String,
        rating Int8,
        created_at DateTime64(3) DEFAULT now64(3),
        times_used UInt32 DEFAULT 0,
        last_used DateTime64(3) DEFAULT now64(3)
      ) ENGINE = MergeTree()
      ORDER BY (task_category, created_at)
      PRIMARY KEY task_category
    `,
  });

  // Create eval_metrics table for aggregated metrics
  await client.exec({
    query: `
      CREATE TABLE IF NOT EXISTS eval_metrics (
        id String,
        metric_date Date,
        total_conversations UInt32,
        successful_conversations UInt32,
        failed_conversations UInt32,
        avg_rating Float32,
        avg_resolution_time_ms UInt32,
        tool_usage_stats String,
        created_at DateTime64(3) DEFAULT now64(3)
      ) ENGINE = MergeTree()
      ORDER BY metric_date
      PRIMARY KEY metric_date
    `,
  });

  console.log("ClickHouse schema initialized");
}

// Initialize schema when this module is imported
initializeClickHouseSchema().catch((error) => {
  console.error("Failed to initialize ClickHouse schema:", error.message);
  // Don't throw - let the app continue without ClickHouse if needed
});
