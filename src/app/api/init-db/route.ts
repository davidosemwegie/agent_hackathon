import { NextResponse } from 'next/server';
import { initializeClickHouseSchema } from '@/lib/clickhouse';

export async function POST() {
  try {
    await initializeClickHouseSchema();
    return NextResponse.json({ success: true, message: 'Database schema initialized' });
  } catch (error) {
    console.error('Error initializing schema:', error);
    return NextResponse.json(
      { error: 'Failed to initialize schema' },
      { status: 500 }
    );
  }
}
