import { ExecutionPlan, ExecutionStep, PlanValidationResult, RiskLevel, Condition } from './types.js';
import { MCPTool } from '../mcp-client.js';

export class PlanValidator {
  private availableTools: MCPTool[];

  constructor(availableTools: MCPTool[]) {
    this.availableTools = availableTools;
  }

  validate(plan: ExecutionPlan): PlanValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    this.validateSchema(plan, errors);
    this.validateSteps(plan.steps, errors, warnings);
    this.validateRiskLevels(plan, warnings);
    this.validateConditions(plan.steps, errors);
    this.sanityChecks(plan, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateSchema(plan: ExecutionPlan, errors: string[]): void {
    if (!plan.id || typeof plan.id !== 'string') {
      errors.push('Plan must have a valid id');
    }
    if (!plan.intent || typeof plan.intent !== 'string') {
      errors.push('Plan must have a valid intent');
    }
    if (!plan.normalizedIntent || typeof plan.normalizedIntent !== 'string') {
      errors.push('Plan must have a normalized intent');
    }
    if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
      errors.push('Plan must have at least one step');
    }
    if (!plan.overallRiskLevel || !Object.values(RiskLevel).includes(plan.overallRiskLevel)) {
      errors.push('Plan must have a valid overall risk level');
    }
  }

  private validateSteps(steps: ExecutionStep[], errors: string[], warnings: string[]): void {
    const toolNames = new Set(this.availableTools.map(t => t.name));

    steps.forEach((step, index) => {
      const stepPrefix = `Step ${index + 1}`;

      if (!step.id || typeof step.id !== 'string') {
        errors.push(`${stepPrefix}: Missing or invalid step id`);
      }
      if (!step.toolName || typeof step.toolName !== 'string') {
        errors.push(`${stepPrefix}: Missing tool name`);
      } else if (!toolNames.has(step.toolName)) {
        errors.push(`${stepPrefix}: Unknown tool '${step.toolName}'`);
      }
      if (!step.action || typeof step.action !== 'string') {
        errors.push(`${stepPrefix}: Missing action description`);
      }
      if (!step.parameters || typeof step.parameters !== 'object') {
        errors.push(`${stepPrefix}: Missing or invalid parameters`);
      }
      if (!step.riskLevel || !Object.values(RiskLevel).includes(step.riskLevel)) {
        errors.push(`${stepPrefix}: Invalid risk level`);
      }

      if (step.toolName === 'transferToken') {
        this.validateTransferStep(step, errors, warnings, stepPrefix);
      }
    });
  }

  private validateTransferStep(
    step: ExecutionStep,
    errors: string[],
    warnings: string[],
    prefix: string
  ): void {
    const { to, amount } = step.parameters;

    if (!to || typeof to !== 'string' || !to.startsWith('0x')) {
      errors.push(`${prefix}: Invalid recipient address`);
    }
    if (!amount || typeof amount !== 'string') {
      errors.push(`${prefix}: Invalid amount`);
    } else {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        errors.push(`${prefix}: Amount must be a positive number`);
      }
      if (amountNum > 1000) {
        warnings.push(`${prefix}: Large transfer amount (${amount} USDC)`);
      }
    }
  }

  private validateRiskLevels(plan: ExecutionPlan, warnings: string[]): void {
    const highestRisk = this.getHighestRiskLevel(plan.steps.map(s => s.riskLevel));
    
    if (highestRisk !== plan.overallRiskLevel) {
      warnings.push(
        `Overall risk level (${plan.overallRiskLevel}) doesn't match highest step risk (${highestRisk})`
      );
    }

    if (plan.overallRiskLevel === RiskLevel.CRITICAL) {
      warnings.push('CRITICAL risk operation - requires manual review');
    }
  }

  private validateConditions(steps: ExecutionStep[], errors: string[]): void {
    const validConditionTypes = ['balance_check', 'price_check', 'volatility_check', 'trend_check', 'custom'];
    
    steps.forEach((step, index) => {
      if (!step.conditions || step.conditions.length === 0) return;

      step.conditions.forEach((condition, condIndex) => {
        const prefix = `Step ${index + 1}, Condition ${condIndex + 1}`;
        
        if (!condition.type || !validConditionTypes.includes(condition.type)) {
          errors.push(`${prefix}: Invalid condition type '${condition.type}'`);
        }
        if (!condition.field || typeof condition.field !== 'string') {
          errors.push(`${prefix}: Missing condition field`);
        }
        if (!condition.operator) {
          errors.push(`${prefix}: Missing condition operator`);
        }
        if (condition.value === undefined || condition.value === null) {
          errors.push(`${prefix}: Missing condition value`);
        }
        
        if (['price_check', 'volatility_check', 'trend_check'].includes(condition.type)) {
          if (!condition.symbol) {
            errors.push(`${prefix}: Market condition requires 'symbol' field`);
          }
        }
      });
    });
  }

  private sanityChecks(plan: ExecutionPlan, warnings: string[]): void {
    if (plan.steps.length > 10) {
      warnings.push(`Plan has ${plan.steps.length} steps - consider breaking into smaller operations`);
    }

    const transferSteps = plan.steps.filter(s => s.toolName === 'transferToken');
    if (transferSteps.length > 3) {
      warnings.push(`Plan includes ${transferSteps.length} transfers - verify this is intentional`);
    }

    const hasBalanceCheck = plan.steps.some(s => 
      s.conditions?.some(c => c.type === 'balance_check')
    );
    const hasTransfer = transferSteps.length > 0;
    
    if (hasTransfer && !hasBalanceCheck) {
      warnings.push('Transfer operation without balance check condition');
    }
  }

  private getHighestRiskLevel(levels: RiskLevel[]): RiskLevel {
    const priority = {
      [RiskLevel.CRITICAL]: 4,
      [RiskLevel.HIGH]: 3,
      [RiskLevel.MEDIUM]: 2,
      [RiskLevel.LOW]: 1,
    };

    return levels.reduce((highest, current) => 
      priority[current] > priority[highest] ? current : highest
    , RiskLevel.LOW);
  }
}
