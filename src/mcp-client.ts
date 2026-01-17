import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export class MCPClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private connected: boolean = false;

  constructor() {
    this.client = new Client(
      {
        name: 'cronopay-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    const serverUrl = process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp';
    
    this.transport = new StdioClientTransport({
      command: 'node',
      args: ['dist/index.js'],
    });

    await this.client.connect(this.transport);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.client.close();
      this.connected = false;
      this.transport = null;
    }
  }

  async listTools(): Promise<MCPTool[]> {
    if (!this.connected) {
      await this.connect();
    }

    const response = await this.client.listTools();
    return response.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as any,
    }));
  }

  async callTool(name: string, args: Record<string, any>): Promise<any> {
    if (!this.connected) {
      await this.connect();
    }

    const response = await this.client.callTool({
      name,
      arguments: args,
    });

    return response;
  }

  isConnected(): boolean {
    return this.connected;
  }
}
