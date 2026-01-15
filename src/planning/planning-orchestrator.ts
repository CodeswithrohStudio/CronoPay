import { PlanGenerator } from './plan-generator.js';
import { PlanValidator } from './plan-validator.js';
import { ExecutionPlan, PlanValidationResult } from './types.js';
import { MCPTool } from '../mcp-client.js';

export interface PlanningOrchestratorConfig {
  apiKey: string;
  model?: string;
}

export class PlanningOrchestrator {
  private planGenerator: PlanGenerator;
  private planValidator: PlanValidator | null = null;

  constructor(config: PlanningOrchestratorConfig) {
    this.planGenerator = new PlanGenerator({
      apiKey: config.apiKey,
      model: config.model,
    });
  }

  initializeValidator(availableTools: MCPTool[]): void {
    this.planValidator = new PlanValidator(availableTools);
  }

  async createPlan(
    userIntent: string,
    availableTools: MCPTool[]
  ): Promise<{ plan: ExecutionPlan; validation: PlanValidationResult }> {
    if (!this.planValidator) {
      this.initializeValidator(availableTools);
    }

    const plan = await this.planGenerator.generatePlan(userIntent, availableTools);
    
    const validation = this.planValidator!.validate(plan);

    if (!validation.valid) {
      throw new Error(
        `Plan validation failed:\n${validation.errors.join('\n')}`
      );
    }

    return { plan, validation };
  }

  validatePlan(plan: ExecutionPlan): PlanValidationResult {
    if (!this.planValidator) {
      throw new Error('Validator not initialized. Call initializeValidator first.');
    }
    return this.planValidator.validate(plan);
  }
}
