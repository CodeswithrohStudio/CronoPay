import { ExecutionPlan, ExecutionStep, StepStatus, RiskLevel } from '../planning/types.js';
import { MCPClient } from '../mcp-client.js';
import { ConditionEvaluator } from './condition-evaluator.js';
import { MarketConditionEvaluator } from './market-condition-evaluator.js';

export interface ExecutionResult {
  plan: ExecutionPlan;
  executionState: Map<string, any>;
  summary: {
    totalSteps: number;
    completed: number;
    failed: number;
    skipped: number;
    aborted: boolean;
  };
}

export interface ExecutionOptions {
  verbose?: boolean;
  stopOnFailure?: boolean;
}

export class ExecutionEngine {
  private mcpClient: MCPClient;
  private conditionEvaluator: ConditionEvaluator;
  private marketConditionEvaluator: MarketConditionEvaluator;
  private executionState: Map<string, any>;

  constructor(mcpClient: MCPClient) {
    this.mcpClient = mcpClient;
    this.conditionEvaluator = new ConditionEvaluator();
    this.marketConditionEvaluator = new MarketConditionEvaluator();
    this.executionState = new Map();
  }

  async execute(
    plan: ExecutionPlan,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const { verbose = true, stopOnFailure = true } = options;

    if (verbose) {
      this.logExecutionStart(plan);
    }

    const executedPlan = { ...plan };
    let aborted = false;

    for (let i = 0; i < executedPlan.steps.length; i++) {
      const step = executedPlan.steps[i];

      if (aborted) {
        step.status = StepStatus.SKIPPED;
        step.error = 'Execution aborted due to previous failure';
        continue;
      }

      try {
        if (verbose) {
          console.log(`\n[Step ${i + 1}/${executedPlan.steps.length}] ${step.action}`);
        }

        step.status = StepStatus.IN_PROGRESS;

        const conditionsResult = await this.evaluateStepConditions(step, verbose);
        
        if (!conditionsResult.allMet) {
          step.status = StepStatus.SKIPPED;
          step.error = conditionsResult.reason;
          
          if (verbose) {
            console.log(`  ✗ Conditions not met - step skipped`);
            console.log(`    Reason: ${conditionsResult.reason}`);
          }

          if (this.shouldAbortOnSkip(step, stopOnFailure)) {
            if (verbose) {
              console.log(`  ⚠️  Critical step skipped - aborting execution`);
            }
            aborted = true;
          }
          continue;
        }

        if (verbose && conditionsResult.details.length > 0) {
          console.log(`  ✓ All conditions satisfied`);
          conditionsResult.details.forEach(detail => {
            console.log(`    • ${detail}`);
          });
        }

        if (verbose) {
          console.log(`  ↳ Executing tool: ${step.toolName}`);
        }

        const result = await this.mcpClient.callTool(
          step.toolName,
          step.parameters
        );

        step.result = result;
        step.status = StepStatus.COMPLETED;

        this.updateExecutionState(step, result);

        if (verbose) {
          console.log(`  ✓ Step completed successfully`);
          this.logStepResult(step, result);
        }

      } catch (error: any) {
        step.status = StepStatus.FAILED;
        step.error = error?.message || String(error);

        if (verbose) {
          console.error(`  ✗ Step failed: ${step.error}`);
        }

        if (this.shouldAbortOnFailure(step, stopOnFailure)) {
          if (verbose) {
            console.log(`  ⚠️  Critical step failed - aborting remaining steps`);
          }
          aborted = true;
        }
      }
    }

    const summary = this.generateSummary(executedPlan, aborted);

    if (verbose) {
      this.logExecutionSummary(summary);
    }

    return {
      plan: executedPlan,
      executionState: this.executionState,
      summary,
    };
  }

  private async evaluateStepConditions(
    step: ExecutionStep,
    verbose: boolean
  ): Promise<{ allMet: boolean; reason?: string; details: string[] }> {
    if (!step.conditions || step.conditions.length === 0) {
      return { allMet: true, details: [] };
    }

    if (verbose) {
      console.log(`  ↳ Evaluating ${step.conditions.length} condition(s)...`);
    }

    const details: string[] = [];

    for (const condition of step.conditions) {
      let result;

      if (condition.type === 'price_check' || condition.type === 'volatility_check' || condition.type === 'trend_check') {
        result = await this.marketConditionEvaluator.evaluate(condition, {
          executionState: this.executionState,
        });

        if (result.marketData) {
          this.executionState.set(`market_${condition.symbol}`, result.marketData);
        }
      } else {
        result = await this.conditionEvaluator.evaluate(condition, {
          mcpClient: this.mcpClient,
          executionState: this.executionState,
          stepParameters: step.parameters,
        });
      }

      if (!result.met) {
        return {
          allMet: false,
          reason: result.reason || 'Condition not met',
          details,
        };
      }

      if (result.reason) {
        details.push(result.reason);
      }
    }

    return { allMet: true, details };
  }

  private updateExecutionState(step: ExecutionStep, result: any): void {
    this.executionState.set(`step_${step.id}_result`, result);
    this.executionState.set(`step_${step.id}_status`, step.status);

    if (step.toolName === 'getBalance') {
      const balanceData = typeof result === 'string' ? JSON.parse(result) : result;
      this.executionState.set('current_balance', balanceData.balance);
      this.executionState.set('balance_symbol', balanceData.symbol);
    }

    if (step.toolName === 'transferToken') {
      const txData = typeof result === 'string' ? JSON.parse(result) : result;
      this.executionState.set('last_tx_hash', txData.txHash);
      this.executionState.set('last_transfer_amount', txData.amount);
    }
  }

  private shouldAbortOnSkip(step: ExecutionStep, stopOnFailure: boolean): boolean {
    if (!stopOnFailure) return false;
    return step.riskLevel === RiskLevel.HIGH || step.riskLevel === RiskLevel.CRITICAL;
  }

  private shouldAbortOnFailure(step: ExecutionStep, stopOnFailure: boolean): boolean {
    if (!stopOnFailure) return false;
    return step.riskLevel === RiskLevel.HIGH || step.riskLevel === RiskLevel.CRITICAL;
  }

  private generateSummary(plan: ExecutionPlan, aborted: boolean) {
    const completed = plan.steps.filter(s => s.status === StepStatus.COMPLETED).length;
    const failed = plan.steps.filter(s => s.status === StepStatus.FAILED).length;
    const skipped = plan.steps.filter(s => s.status === StepStatus.SKIPPED).length;

    return {
      totalSteps: plan.steps.length,
      completed,
      failed,
      skipped,
      aborted,
    };
  }

  private logExecutionStart(plan: ExecutionPlan): void {
    console.log('\n⚙️  Executing plan...');
    console.log(`Plan ID: ${plan.id}`);
    console.log(`Steps: ${plan.steps.length}`);
    console.log(`Risk Level: ${plan.overallRiskLevel.toUpperCase()}`);
  }

  private logStepResult(step: ExecutionStep, result: any): void {
    try {
      const resultData = typeof result === 'string' ? JSON.parse(result) : result;
      
      if (resultData.txHash) {
        console.log(`    Transaction: ${resultData.txHash}`);
      }
      if (resultData.balance) {
        console.log(`    Balance: ${resultData.balance} ${resultData.symbol || ''}`);
      }
    } catch {
      // Ignore parsing errors
    }
  }

  private logExecutionSummary(summary: any): void {
    console.log(`\n📊 Execution Summary:`);
    console.log(`   Total Steps: ${summary.totalSteps}`);
    console.log(`   Completed: ${summary.completed}`);
    if (summary.failed > 0) console.log(`   Failed: ${summary.failed}`);
    if (summary.skipped > 0) console.log(`   Skipped: ${summary.skipped}`);
    if (summary.aborted) console.log(`   ⚠️  Execution Aborted`);
  }

  getExecutionState(): Map<string, any> {
    return new Map(this.executionState);
  }

  clearExecutionState(): void {
    this.executionState.clear();
  }
}
