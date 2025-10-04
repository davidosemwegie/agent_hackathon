import { createClient } from '@clickhouse/client';

// Create ClickHouse client singleton
let client: ReturnType<typeof createClient> | null = null;

export function getClickHouseClient() {
  if (!client) {
    client = createClient({
      url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
      username: process.env.CLICKHOUSE_USER || 'default',
      password: process.env.CLICKHOUSE_PASSWORD || '',
      database: process.env.CLICKHOUSE_DATABASE || 'default',
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
      PRIMARY KEY (user_id, id)
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
      PRIMARY KEY (conversation_id, id)
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
      PRIMARY KEY (conversation_id, id)
    `,
  });

  console.log('ClickHouse schema initialized');
}
