import { MCPClient, MCPTool } from './mcp-client.js';
import { PlanningOrchestrator } from './planning/index.js';
import { ExecutionPlan, PlanValidationResult } from './planning/types.js';
import { ExecutionEngine, ExecutionResult } from './execution/index.js';

export interface SentinelAgentConfig {
  apiKey: string;
  model?: string;
}

export interface PlanResult {
  plan: ExecutionPlan;
  validation: PlanValidationResult;
}

export class SentinelAgent {
  private mcpClient: MCPClient;
  private planningOrchestrator: PlanningOrchestrator;
  private executionEngine: ExecutionEngine | null = null;
  private availableTools: MCPTool[] = [];

  constructor(config: SentinelAgentConfig) {
    this.mcpClient = new MCPClient();
    this.planningOrchestrator = new PlanningOrchestrator({
      apiKey: config.apiKey,
      model: config.model,
    });
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Sentinel Agent...');
    await this.mcpClient.connect();
    this.availableTools = await this.mcpClient.listTools();
    this.planningOrchestrator.initializeValidator(this.availableTools);
    this.executionEngine = new ExecutionEngine(this.mcpClient);
    console.log(`✓ Agent initialized with ${this.availableTools.length} available tools`);
  }

  async createExecutionPlan(userIntent: string): Promise<PlanResult> {
    console.log('\n📋 Generating execution plan...');
    
    const result = await this.planningOrchestrator.createPlan(
      userIntent,
      this.availableTools
    );

    console.log('✓ Plan generated and validated');
    
    if (result.validation.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      result.validation.warnings.forEach(w => console.log(`   - ${w}`));
    }

    return result;
  }

  async executePlan(plan: ExecutionPlan): Promise<ExecutionResult> {
    if (!this.executionEngine) {
      throw new Error('Execution engine not initialized. Call initialize() first.');
    }

    return await this.executionEngine.execute(plan, {
      verbose: true,
      stopOnFailure: true,
    });
  }

  getExecutionState(): Map<string, any> {
    if (!this.executionEngine) {
      return new Map();
    }
    return this.executionEngine.getExecutionState();
  }

  clearExecutionState(): void {
    if (this.executionEngine) {
      this.executionEngine.clearExecutionState();
    }
  }

  async processIntent(userIntent: string): Promise<{ plan: ExecutionPlan; result: ExecutionResult }> {
    const { plan, validation } = await this.createExecutionPlan(userIntent);
    
    const result = await this.executePlan(plan);
    
    return { plan, result };
  }

  getAvailableTools(): MCPTool[] {
    return this.availableTools;
  }

  async cleanup(): Promise<void> {
    await this.mcpClient.disconnect();
  }
}
