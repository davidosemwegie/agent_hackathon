#!/usr/bin/env node

// Simple script to test ClickHouse connection and schema initialization
const { getClickHouseClient, initializeClickHouseSchema } = require('./src/lib/clickhouse.ts');

async function testClickHouse() {
  try {
    console.log('Testing ClickHouse connection...');
    
    // Test basic connection
    const client = getClickHouseClient();
    console.log('✓ ClickHouse client created');
    
    // Test schema initialization
    await initializeClickHouseSchema();
    console.log('✓ Schema initialization completed');
    
    // Test a simple query
    const result = await client.query({
      query: 'SELECT 1 as test'
    });
    console.log('✓ Basic query test passed:', await result.json());
    
    console.log('🎉 All ClickHouse tests passed!');
    
  } catch (error) {
    console.error('❌ ClickHouse test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testClickHouse();
