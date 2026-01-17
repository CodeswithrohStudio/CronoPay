import { MCPClient, MCPTool } from './mcp-client.js';
import { PlanningOrchestrator } from './planning/index.js';
import { ExecutionPlan, PlanValidationResult } from './planning/types.js';
import { ExecutionEngine, ExecutionResult } from './execution/index.js';
import { ExplanationGenerator, ExecutionLogger, PlanExplanation, AuditTrail } from './explainability/index.js';

export interface CronoPayAgentConfig {
  apiKey: string;
  model?: string;
  enableExplainability?: boolean;
}

export interface PlanResult {
  plan: ExecutionPlan;
  validation: PlanValidationResult;
  explanation?: PlanExplanation;
}

export interface ExecutionResultWithExplanation extends ExecutionResult {
  auditTrail?: AuditTrail;
}

export class CronoPayAgent {
  private mcpClient: MCPClient;
  private planningOrchestrator: PlanningOrchestrator;
  private executionEngine: ExecutionEngine | null = null;
  private availableTools: MCPTool[] = [];
  private explanationGenerator: ExplanationGenerator;
  private executionLogger: ExecutionLogger;
  private enableExplainability: boolean;

  constructor(config: CronoPayAgentConfig) {
    this.mcpClient = new MCPClient();
    this.planningOrchestrator = new PlanningOrchestrator({
      apiKey: config.apiKey,
      model: config.model,
    });
    this.explanationGenerator = new ExplanationGenerator();
    this.executionLogger = new ExecutionLogger();
    this.enableExplainability = config.enableExplainability !== false; // Default to true
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing CronoPay Agent...');
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

    // Generate explanation if enabled
    let explanation: PlanExplanation | undefined;
    if (this.enableExplainability) {
      explanation = this.explanationGenerator.generatePlanExplanation(
        result.plan,
        userIntent
      );
      
      // Display explanation
      console.log(this.explanationGenerator.formatExplanationForDisplay(explanation));
    }

    return {
      ...result,
      explanation,
    };
  }

  async executePlan(plan: ExecutionPlan, planExplanation?: PlanExplanation): Promise<ExecutionResultWithExplanation> {
    if (!this.executionEngine) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    console.log('\n⚡ Executing plan...');
    
    // Start execution logging if enabled
    if (this.enableExplainability) {
      this.executionLogger.startExecution(plan);
    }
    
    const result = await this.executionEngine.execute(plan);
    
    console.log('✓ Execution complete');
    
    // Generate audit trail if enabled
    let auditTrail: AuditTrail | undefined;
    if (this.enableExplainability && planExplanation) {
      const executionExplanation = this.executionLogger.generateExecutionExplanation(plan);
      
      // Determine outcome
      const completedSteps = plan.steps.filter((s: any) => s.status === 'completed').length;
      const failedSteps = plan.steps.filter((s: any) => s.status === 'failed').length;
      const totalSteps = plan.steps.length;
      
      let outcome: 'success' | 'partial' | 'failed' | 'aborted';
      if (failedSteps === 0 && completedSteps === totalSteps) {
        outcome = 'success';
      } else if (completedSteps > 0 && failedSteps > 0) {
        outcome = 'partial';
      } else if (failedSteps > 0) {
        outcome = 'failed';
      } else {
        outcome = 'aborted';
      }
      
      auditTrail = this.executionLogger.createAuditTrail(
        plan.id,
        plan.intent,
        planExplanation,
        executionExplanation,
        outcome
      );
      
      // Display execution log and audit trail
      console.log(this.executionLogger.formatExecutionLog());
      console.log(this.executionLogger.formatAuditTrail(auditTrail));
    }
    
    return {
      ...result,
      auditTrail,
    };
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

  getExplanationGenerator(): ExplanationGenerator {
    return this.explanationGenerator;
  }

  getExecutionLogger(): ExecutionLogger {
    return this.executionLogger;
  }

  setExplainabilityEnabled(enabled: boolean): void {
    this.enableExplainability = enabled;
  }

  async cleanup(): Promise<void> {
    await this.mcpClient.disconnect();
  }
}
