import OpenAI from 'openai';
import { MCPClient, MCPTool } from './mcp-client.js';

export interface AgentConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
}

export class OpenAIAgent {
  private openai: OpenAI;
  private mcpClient: MCPClient;
  private model: string;
  private availableTools: MCPTool[] = [];

  constructor(config: AgentConfig) {
    this.openai = new OpenAI({
      apiKey: config.apiKey,
    });
    this.model = config.model || 'gpt-5-nano';
    this.mcpClient = new MCPClient();
  }

  /**
   * Initialize the agent and connect to MCP server
   */
  async initialize(): Promise<void> {
    console.log('Initializing OpenAI Agent...');
    await this.mcpClient.connect();
    this.availableTools = await this.mcpClient.listTools();
    console.log(`Agent initialized with ${this.availableTools.length} available tools`);
  }

  /**
   * Convert MCP tools to OpenAI function format
   */
  private convertToOpenAIFunctions(): OpenAI.ChatCompletionTool[] {
    return this.availableTools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description || `Execute ${tool.name} operation`,
        parameters: tool.inputSchema || {
          type: 'object',
          properties: {},
        },
      },
    }));
  }

  /**
   * Process a user message and execute browser automation tasks
   */
  async processMessage(userMessage: string): Promise<string> {
    try {
      console.log('Processing message:', userMessage);

      const cronosUsdcTokenAddress = process.env.CRONOS_USDC_TOKEN_ADDRESS;

      // Prepare the conversation with system context
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: `You are an AI assistant with access to finance tools via MCP.
          Your job is to interpret user requests like "Send 1 USDC to address X" and call the appropriate tool.
          Available tools: ${this.availableTools.map(t => t.name).join(', ')}

          HARD RULES:
          - One tool call = one on-chain transaction.
          - No retries.
          - No loops.
          - No strategy.
          - The agent decides WHEN to call a tool, not HOW it executes.

          TOKEN MAPPING (Cronos Testnet):
          - "USDC" tokenAddress = ${cronosUsdcTokenAddress || "(missing: set CRONOS_USDC_TOKEN_ADDRESS in env)"}

          If the user says "Send 1 USDC to 0x...":
          - Call transferToken once with tokenAddress, to, amount.
          - Then respond with the tx hash.

          Output format:
          - If a transaction is sent, respond with a JSON object containing {"status":"success","txHash":"0x..."}.
          - If you cannot proceed due to missing config (e.g., tokenAddress), respond with a JSON object containing {"status":"error","error":"..."}.`,
        },
        {
          role: 'user',
          content: userMessage,
        },
      ];

      let maxSteps = 20; // Safety limit for the conversation loop
      let toolCallsUsed = 0;

      while (maxSteps > 0) {
        // Get OpenAI's response with function calling
        const response = await this.openai.chat.completions.create({
          model: this.model,
          messages,
          tools: this.convertToOpenAIFunctions(),
          tool_choice: 'auto',
        });

        const assistantMessage = response.choices[0].message;
        messages.push(assistantMessage);

        // Check if the assistant wants to call tools
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          if (toolCallsUsed >= 1) {
            throw new Error('Hard rule violation: multiple tool calls across turns are not allowed');
          }
          if (assistantMessage.tool_calls.length !== 1) {
            throw new Error(`Hard rule violation: expected exactly 1 tool call, got ${assistantMessage.tool_calls.length}`);
          }

          console.log(`\n🤖 AI Requesting ${assistantMessage.tool_calls.length} tool(s)...`);
          
          for (const toolCall of assistantMessage.tool_calls) {
            console.log(`  > Executing tool: ${toolCall.function.name}`);

            let result: any;
            try {
              // Parse the arguments
              const args = JSON.parse(toolCall.function.arguments);

              // Call the MCP tool
              result = await this.mcpClient.callTool(
                toolCall.function.name,
                args
              );
              
              console.log(`  ✓ Tool executed`);
            } catch (error: any) {
              console.error(`  ✗ Error executing ${toolCall.function.name}:`, error);
              result = `Error executing ${toolCall.function.name}: ${error?.message || String(error)}`;
            }

            // Add the tool result to the conversation history
            messages.push({
              role: 'tool',
              content: typeof result === 'string' ? result : JSON.stringify(result),
              tool_call_id: toolCall.id,
            });
          }

          toolCallsUsed++;
          
          // Continue the loop to let the AI process the tool results
          maxSteps--;
        } else {
          // No more tools to call, return the final response
          return assistantMessage.content || 'Task completed';
        }
      }

      return "Maximum conversation steps reached. The task may be incomplete.";

    } catch (error) {
      console.error('Error processing message:', error);
      throw error;
    }
  }

  /**
   * Execute a specific browser automation task
   */
  async executeBrowserTask(taskDescription: string, toolName?: string, args?: Record<string, any>): Promise<any> {
    try {
      if (toolName && args) {
        // Direct tool execution
        console.log(`Executing ${toolName} with args:`, args);
        return await this.mcpClient.callTool(toolName, args);
      } else {
        // Let the AI decide which tools to use
        return await this.processMessage(taskDescription);
      }
    } catch (error) {
      console.error('Error executing browser task:', error);
      throw error;
    }
  }

  /**
   * List all available browser automation capabilities
   */
  async listCapabilities(): Promise<{ tools: MCPTool[], resources: any[] }> {
    const tools = await this.mcpClient.listTools();
    const resources = await this.mcpClient.listResources();

    return { tools, resources };
  }

  /**
   * Cleanup and disconnect
   */
  async cleanup(): Promise<void> {
    await this.mcpClient.disconnect();
  }
}