import { MCPClient } from './mcp-client.js';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  console.log('🧪 Testing MCP Connection\n');
  
  const client = new MCPClient();
  
  try {
    console.log('1. Connecting to MCP server...');
    await client.connect();
    console.log('✓ Connected successfully\n');
    
    console.log('2. Listing tools...');
    const tools = await client.listTools();
    console.log(`✓ Found ${tools.length} tools:`);
    tools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description || 'No description'}`);
    });
    console.log();
    
    console.log('3. Testing getBalance tool...');
    const tokenAddress = process.env.CRONOS_USDC_TOKEN_ADDRESS || '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0';
    
    try {
      const result = await client.callTool('getBalance', { tokenAddress });
      console.log('✓ getBalance result:', JSON.stringify(result, null, 2));
    } catch (error: any) {
      console.error('✗ getBalance failed:', error.message);
      console.error('Full error:', error);
    }
    
    await client.disconnect();
    console.log('\n✓ Test completed');
    
  } catch (error: any) {
    console.error('\n✗ Test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testConnection();
