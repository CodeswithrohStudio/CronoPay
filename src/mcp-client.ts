import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { z } from 'zod';

// Define the response schema for browser operations
const BrowserResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
});

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export class MCPClient {
  private client: Client;
  private transport!: StreamableHTTPClientTransport;
  private connected: boolean = false;
  private serverUrl: string;

  constructor(serverUrl?: string) {
    this.serverUrl = serverUrl || process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp';
    this.client = new Client({
      name: 'openai-mcp-agent',
      version: '1.0.0',
    }, {
      capabilities: {},
    });
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      console.log('Already connected to MCP server');
      return;
    }

    try {
      // Create HTTP transport for Finance MCP server
      this.transport = new StreamableHTTPClientTransport(
        new URL(this.serverUrl)
      );

      // Connect the client to the transport
      await this.client.connect(this.transport);
      this.connected = true;
      console.log('Successfully connected to MCP server');

      // List available tools
      const tools = await this.listTools();
      console.log('Available tools:', tools.map(t => t.name));
    } catch (error) {
      console.error('Failed to connect to MCP server:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      await this.client.close();
      await this.transport.close();
      this.connected = false;
      console.log('Disconnected from MCP server');
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  }

  /**
   * List available tools from the MCP server
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.connected) {
      throw new Error('Not connected to MCP server');
    }

    try {
      const response = await this.client.listTools();
      return response.tools;
    } catch (error) {
      console.error('Error listing tools:', error);
      throw error;
    }
  }

  /**
   * List available resources from the MCP server
   */
  async listResources(): Promise<MCPResource[]> {
    if (!this.connected) {
      throw new Error('Not connected to MCP server');
    }

    try {
      const response = await this.client.listResources();
      return response.resources;
    } catch (error: any) {
      if (error?.code === -32601) {
        return [];
      }
      console.error('Error listing resources:', error);
      throw error;
    }
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(toolName: string, args: Record<string, any> = {}): Promise<any> {
    if (!this.connected) {
      throw new Error('Not connected to MCP server');
    }

    try {
      console.log(`Calling tool: ${toolName} with args:`, args);
      const response = await this.client.callTool({
        name: toolName,
        arguments: args,
      });

      // Parse the response
      if (response.content && Array.isArray(response.content) && response.content.length > 0) {
        const content = response.content[0];
        if (content.type === 'text') {
          try {
            // Try to parse as JSON
            return JSON.parse(content.text);
          } catch (parseError) {
            // If parsing fails, check if it's an error message
            if (content.text.includes('Error') || content.text.includes('Cannot')) {
              throw new Error(content.text);
            }
            // Return as plain text if not JSON and not an error
            return content.text;
          }
        }
        return content;
      }

      // Check if response has structuredContent
      if (response.structuredContent) {
        return response.structuredContent;
      }

      return response;
    } catch (error: any) {
      // Provide more detailed error message
      const errorMsg = error?.message || String(error);
      console.error(`Error calling tool ${toolName}:`, errorMsg);
      throw new Error(`Tool execution failed: ${errorMsg}`);
    }
  }

  /**
   * Read a resource from the MCP server
   */
  async readResource(uri: string): Promise<any> {
    if (!this.connected) {
      throw new Error('Not connected to MCP server');
    }

    try {
      const response = await this.client.readResource({
        uri,
      });

      if (response.contents && Array.isArray(response.contents) && response.contents.length > 0) {
        return response.contents[0];
      }

      return response;
    } catch (error) {
      console.error(`Error reading resource ${uri}:`, error);
      throw error;
    }
  }

  /**
   * Check if connected to MCP server
   */
  isConnected(): boolean {
    return this.connected;
  }
}