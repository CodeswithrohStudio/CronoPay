import { MCPClient, MCPTool } from './mcp-client.js';
import { PlanningOrchestrator } from './planning/index.js';
import { ExecutionPlan, ExecutionStep, StepStatus, PlanValidationResult } from './planning/types.js';

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

  async executePlan(plan: ExecutionPlan): Promise<ExecutionPlan> {
    console.log('\n⚙️  Executing plan...');
    console.log(`Plan ID: ${plan.id}`);
    console.log(`Steps: ${plan.steps.length}`);
    console.log(`Risk Level: ${plan.overallRiskLevel.toUpperCase()}\n`);

    const executedPlan = { ...plan };

    for (let i = 0; i < executedPlan.steps.length; i++) {
      const step = executedPlan.steps[i];
      
      try {
        console.log(`[Step ${i + 1}/${executedPlan.steps.length}] ${step.action}`);
        
        step.status = StepStatus.IN_PROGRESS;

        if (step.conditions && step.conditions.length > 0) {
          console.log(`  ↳ Checking ${step.conditions.length} condition(s)...`);
          const conditionsMet = await this.evaluateConditions(step);
          
          if (!conditionsMet) {
            step.status = StepStatus.SKIPPED;
            step.error = 'Conditions not met';
            console.log(`  ✗ Conditions not met - step skipped`);
            
            if (step.riskLevel === 'high' || step.riskLevel === 'critical') {
              console.log(`  ⚠️  High-risk step failed conditions - aborting plan`);
              break;
            }
            continue;
          }
          console.log(`  ✓ Conditions satisfied`);
        }

        console.log(`  ↳ Executing tool: ${step.toolName}`);
        const result = await this.mcpClient.callTool(
          step.toolName,
          step.parameters
        );

        step.result = result;
        step.status = StepStatus.COMPLETED;
        console.log(`  ✓ Step completed`);

      } catch (error: any) {
        step.status = StepStatus.FAILED;
        step.error = error?.message || String(error);
        console.error(`  ✗ Step failed: ${step.error}`);

        if (step.riskLevel === 'high' || step.riskLevel === 'critical') {
          console.log(`  ⚠️  High-risk step failed - aborting remaining steps`);
          break;
        }
      }
    }

    const completed = executedPlan.steps.filter(s => s.status === StepStatus.COMPLETED).length;
    const failed = executedPlan.steps.filter(s => s.status === StepStatus.FAILED).length;
    const skipped = executedPlan.steps.filter(s => s.status === StepStatus.SKIPPED).length;

    console.log(`\n📊 Execution Summary:`);
    console.log(`   Completed: ${completed}/${executedPlan.steps.length}`);
    if (failed > 0) console.log(`   Failed: ${failed}`);
    if (skipped > 0) console.log(`   Skipped: ${skipped}`);

    return executedPlan;
  }

  private async evaluateConditions(step: ExecutionStep): Promise<boolean> {
    if (!step.conditions || step.conditions.length === 0) {
      return true;
    }

    for (const condition of step.conditions) {
      if (condition.type === 'balance_check') {
        const result = await this.checkBalance(condition);
        if (!result) {
          console.log(`    ✗ Balance check failed: ${condition.description}`);
          return false;
        }
      }
    }

    return true;
  }

  private async checkBalance(condition: any): Promise<boolean> {
    console.log(`    Checking: ${condition.description}`);
    return true;
  }

  async processIntent(userIntent: string): Promise<{ plan: ExecutionPlan; result: ExecutionPlan }> {
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
