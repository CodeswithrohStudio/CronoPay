import { ExecutionPlan, ExecutionStep, Condition } from '../planning/types.js';
import { 
  ExecutionExplanation, 
  DecisionLog, 
  ConditionEvaluation,
  AuditTrail,
  PlanExplanation 
} from './types.js';

export class ExecutionLogger {
  private decisions: DecisionLog[] = [];
  private conditionEvaluations: ConditionEvaluation[] = [];
  private startTime: number = 0;

  startExecution(plan: ExecutionPlan): void {
    this.startTime = Date.now();
    this.decisions = [];
    this.conditionEvaluations = [];
    
    this.logDecision({
      timestamp: this.startTime,
      stepId: 'init',
      decision: 'execute',
      reason: `Starting execution of plan ${plan.id} with ${plan.steps.length} steps`,
      context: {
        planId: plan.id,
        riskLevel: plan.overallRiskLevel,
        stepCount: plan.steps.length,
      },
    });
  }

  logDecision(decision: DecisionLog): void {
    this.decisions.push(decision);
  }

  logConditionEvaluation(evaluation: ConditionEvaluation): void {
    this.conditionEvaluations.push(evaluation);
  }

  logStepExecution(
    step: ExecutionStep,
    decision: 'execute' | 'skip' | 'abort',
    reason: string,
    context?: Record<string, any>
  ): void {
    this.logDecision({
      timestamp: Date.now(),
      stepId: step.id,
      decision,
      reason,
      context: context || {},
    });
  }

  logConditionCheck(
    step: ExecutionStep,
    condition: Condition,
    result: boolean,
    actualValue: any,
    expectedValue: any
  ): void {
    const explanation = this.explainConditionResult(condition, result, actualValue, expectedValue);
    
    this.logConditionEvaluation({
      timestamp: Date.now(),
      stepId: step.id,
      condition: condition.description || `${condition.type}: ${condition.field} ${condition.operator} ${condition.value}`,
      result,
      actualValue,
      expectedValue,
      explanation,
    });
  }

  private explainConditionResult(
    condition: Condition,
    result: boolean,
    actualValue: any,
    expectedValue: any
  ): string {
    const status = result ? '✓ PASSED' : '✗ FAILED';
    
    if (condition.type === 'balance_check') {
      return `${status}: Wallet balance is ${actualValue}, ${result ? 'meets' : 'does not meet'} requirement of ${expectedValue}`;
    }
    
    if (condition.type === 'price_check') {
      return `${status}: ${condition.symbol} price is ${actualValue}, ${result ? 'satisfies' : 'does not satisfy'} condition ${condition.operator} ${expectedValue}`;
    }
    
    if (condition.type === 'custom') {
      return `${status}: ${condition.description || 'Custom condition'} evaluated to ${result}`;
    }
    
    return `${status}: Condition ${condition.type} evaluated to ${result}`;
  }

  generateExecutionExplanation(plan: ExecutionPlan): ExecutionExplanation {
    const summary = this.generateExecutionSummary(plan);
    
    return {
      planId: plan.id,
      startTime: this.startTime,
      endTime: Date.now(),
      decisions: this.decisions,
      conditionEvaluations: this.conditionEvaluations,
      summary,
    };
  }

  private generateExecutionSummary(plan: ExecutionPlan): string {
    const duration = Date.now() - this.startTime;
    const executedSteps = this.decisions.filter(d => d.decision === 'execute' && d.stepId !== 'init').length;
    const skippedSteps = this.decisions.filter(d => d.decision === 'skip').length;
    const abortedSteps = this.decisions.filter(d => d.decision === 'abort').length;
    
    let summary = `Execution completed in ${duration}ms. `;
    summary += `${executedSteps} step(s) executed`;
    
    if (skippedSteps > 0) {
      summary += `, ${skippedSteps} skipped`;
    }
    
    if (abortedSteps > 0) {
      summary += `, ${abortedSteps} aborted`;
    }
    
    summary += `. `;
    
    if (this.conditionEvaluations.length > 0) {
      const passedConditions = this.conditionEvaluations.filter(c => c.result).length;
      summary += `${passedConditions}/${this.conditionEvaluations.length} conditions passed.`;
    }
    
    return summary;
  }

  createAuditTrail(
    sessionId: string,
    userIntent: string,
    planExplanation: PlanExplanation,
    executionExplanation: ExecutionExplanation,
    outcome: 'success' | 'partial' | 'failed' | 'aborted'
  ): AuditTrail {
    const finalSummary = this.generateFinalSummary(outcome, executionExplanation);
    
    return {
      sessionId,
      userIntent,
      planExplanation,
      executionExplanation,
      outcome,
      finalSummary,
      createdAt: this.startTime,
      completedAt: Date.now(),
    };
  }

  private generateFinalSummary(
    outcome: 'success' | 'partial' | 'failed' | 'aborted',
    execution: ExecutionExplanation
  ): string {
    const outcomeEmoji = {
      success: '✅',
      partial: '⚠️',
      failed: '❌',
      aborted: '🛑',
    };
    
    let summary = `${outcomeEmoji[outcome]} Execution ${outcome.toUpperCase()}. `;
    summary += execution.summary;
    
    return summary;
  }

  formatExecutionLog(): string {
    let output = '\n' + '='.repeat(70) + '\n';
    output += '📊 EXECUTION LOG\n';
    output += '='.repeat(70) + '\n\n';
    
    output += '🔍 Decisions Made:\n';
    this.decisions.forEach((decision, index) => {
      const timestamp = new Date(decision.timestamp).toISOString();
      output += `\n   ${index + 1}. [${timestamp}] Step: ${decision.stepId}\n`;
      output += `      Decision: ${decision.decision.toUpperCase()}\n`;
      output += `      Reason: ${decision.reason}\n`;
      
      if (Object.keys(decision.context).length > 0) {
        output += `      Context: ${JSON.stringify(decision.context, null, 2).split('\n').join('\n      ')}\n`;
      }
    });
    
    if (this.conditionEvaluations.length > 0) {
      output += '\n\n🔒 Condition Evaluations:\n';
      this.conditionEvaluations.forEach((evaluation, index) => {
        const timestamp = new Date(evaluation.timestamp).toISOString();
        const status = evaluation.result ? '✓ PASSED' : '✗ FAILED';
        
        output += `\n   ${index + 1}. [${timestamp}] ${status}\n`;
        output += `      Step: ${evaluation.stepId}\n`;
        output += `      Condition: ${evaluation.condition}\n`;
        output += `      ${evaluation.explanation}\n`;
      });
    }
    
    output += '\n' + '='.repeat(70) + '\n';
    
    return output;
  }

  formatAuditTrail(trail: AuditTrail): string {
    let output = '\n' + '='.repeat(70) + '\n';
    output += '📜 AUDIT TRAIL\n';
    output += '='.repeat(70) + '\n\n';
    
    output += `Session ID: ${trail.sessionId}\n`;
    output += `Created: ${new Date(trail.createdAt).toISOString()}\n`;
    if (trail.completedAt) {
      output += `Completed: ${new Date(trail.completedAt).toISOString()}\n`;
      output += `Duration: ${trail.completedAt - trail.createdAt}ms\n`;
    }
    output += `\nUser Intent: "${trail.userIntent}"\n`;
    output += `Outcome: ${trail.outcome.toUpperCase()}\n\n`;
    
    output += trail.finalSummary + '\n\n';
    
    output += '📋 Plan Details:\n';
    output += `   Normalized Intent: "${trail.planExplanation.normalizedIntent}"\n`;
    output += `   Steps: ${trail.planExplanation.reasoning.stepBreakdown.length}\n`;
    output += `   Risk Assessment: ${trail.planExplanation.reasoning.riskAssessment}\n\n`;
    
    if (trail.executionExplanation) {
      output += '📊 Execution Summary:\n';
      output += `   ${trail.executionExplanation.summary}\n`;
      output += `   Decisions: ${trail.executionExplanation.decisions.length}\n`;
      output += `   Conditions Evaluated: ${trail.executionExplanation.conditionEvaluations.length}\n`;
    }
    
    output += '\n' + '='.repeat(70) + '\n';
    
    return output;
  }
}
