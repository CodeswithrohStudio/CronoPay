import { ExecutionPlan, ExecutionStep, RiskLevel } from '../planning/types.js';
import { PlanExplanation, StepExplanation, ReasoningStep } from './types.js';

export class ExplanationGenerator {
  generatePlanExplanation(
    plan: ExecutionPlan,
    userIntent: string,
    reasoningTrace: ReasoningStep[] = []
  ): PlanExplanation {
    const stepExplanations = plan.steps.map(step => this.explainStep(step, plan));
    
    return {
      intent: userIntent,
      normalizedIntent: plan.normalizedIntent,
      reasoning: {
        whyThisPlan: this.explainPlanChoice(plan, userIntent),
        riskAssessment: this.explainRiskLevel(plan.overallRiskLevel, plan.steps),
        stepBreakdown: stepExplanations,
        conditionsRationale: this.explainConditions(plan),
        alternativesConsidered: this.suggestAlternatives(plan),
      },
      trace: reasoningTrace,
    };
  }

  private explainStep(step: ExecutionStep, plan: ExecutionPlan): StepExplanation {
    const risks = this.identifyStepRisks(step);
    const dependencies = this.findDependencies(step, plan);
    
    return {
      stepId: step.id,
      action: step.action,
      why: this.explainStepPurpose(step),
      risks,
      dependencies,
      expectedOutcome: this.describeExpectedOutcome(step),
    };
  }

  private explainPlanChoice(plan: ExecutionPlan, userIntent: string): string {
    const hasConditions = plan.steps.some(s => s.conditions && s.conditions.length > 0);
    const stepCount = plan.steps.length;
    
    let explanation = `This plan was generated to fulfill your request: "${userIntent}". `;
    
    if (stepCount === 1) {
      explanation += 'It requires a single direct action. ';
    } else {
      explanation += `It breaks down into ${stepCount} sequential steps to ensure safety and correctness. `;
    }
    
    if (hasConditions) {
      explanation += 'Conditional checks are included to verify prerequisites before execution. ';
    }
    
    explanation += `The overall risk level is ${plan.overallRiskLevel.toUpperCase()}.`;
    
    return explanation;
  }

  private explainRiskLevel(riskLevel: RiskLevel, steps: ExecutionStep[]): string {
    const riskExplanations: Record<RiskLevel, string> = {
      low: 'This operation is considered LOW RISK because it involves small amounts and standard operations.',
      medium: 'This operation is MEDIUM RISK due to moderate transaction amounts or multiple steps.',
      high: 'This operation is HIGH RISK because it involves large amounts or complex multi-step execution. Manual review recommended.',
      critical: 'This operation is CRITICAL RISK due to very large amounts or irreversible actions. Requires explicit approval.',
    };
    
    let explanation = riskExplanations[riskLevel] || 'Risk level assessment unavailable.';
    
    const transferSteps = steps.filter(s => s.toolName === 'transferToken');
    if (transferSteps.length > 0) {
      explanation += ` The plan includes ${transferSteps.length} token transfer(s).`;
    }
    
    const conditionalSteps = steps.filter(s => s.conditions && s.conditions.length > 0);
    if (conditionalSteps.length > 0) {
      explanation += ` ${conditionalSteps.length} step(s) have conditional checks to reduce risk.`;
    }
    
    return explanation;
  }

  private explainStepPurpose(step: ExecutionStep): string {
    const purposeMap: Record<string, string> = {
      getBalance: 'Check wallet balance to verify sufficient funds before proceeding',
      transferToken: 'Execute USDC transfer on Cronos blockchain',
      create_execution_plan: 'Generate a structured execution plan for the requested action',
      check_wallet_balance: 'Verify wallet balance meets requirements',
      assess_transaction_risk: 'Evaluate risk level of the proposed transaction',
    };
    
    const basePurpose = purposeMap[step.toolName] || `Execute ${step.toolName} operation`;
    
    if (step.conditions && step.conditions.length > 0) {
      return `${basePurpose}. This step will only execute if ${step.conditions.length} condition(s) are met.`;
    }
    
    return basePurpose;
  }

  private identifyStepRisks(step: ExecutionStep): string[] {
    const risks: string[] = [];
    
    if (step.toolName === 'transferToken') {
      risks.push('Irreversible blockchain transaction');
      
      if (step.parameters.amount) {
        const amount = parseFloat(step.parameters.amount);
        if (amount > 10) {
          risks.push('Large transfer amount');
        }
        if (amount > 50) {
          risks.push('Very large transfer - requires careful review');
        }
      }
      
      if (!step.conditions || step.conditions.length === 0) {
        risks.push('No balance check - may fail if insufficient funds');
      }
    }
    
    if (step.riskLevel === 'high' || step.riskLevel === 'critical') {
      risks.push(`Marked as ${step.riskLevel.toUpperCase()} risk`);
    }
    
    return risks.length > 0 ? risks : ['Standard operation risk'];
  }

  private findDependencies(step: ExecutionStep, plan: ExecutionPlan): string[] | undefined {
    const dependencies: string[] = [];
    
    if (step.conditions && step.conditions.length > 0) {
      step.conditions.forEach(condition => {
        if (condition.type === 'balance_check') {
          dependencies.push('Requires sufficient wallet balance');
        } else if (condition.type === 'price_check') {
          dependencies.push(`Depends on ${condition.symbol} price meeting threshold`);
        } else if (condition.type === 'custom') {
          dependencies.push(`Depends on: ${condition.description || 'custom condition'}`);
        }
      });
    }
    
    const stepIndex = plan.steps.findIndex(s => s.id === step.id);
    if (stepIndex > 0) {
      dependencies.push(`Requires completion of previous step(s)`);
    }
    
    return dependencies.length > 0 ? dependencies : undefined;
  }

  private describeExpectedOutcome(step: ExecutionStep): string {
    const outcomeMap: Record<string, string> = {
      getBalance: 'Returns current wallet balance in human-readable format',
      transferToken: 'Transaction hash and confirmation of successful transfer',
      create_execution_plan: 'Structured execution plan with risk assessment',
      check_wallet_balance: 'Balance information for specified token',
      assess_transaction_risk: 'Risk level assessment with detailed factors',
    };
    
    return outcomeMap[step.toolName] || 'Operation completes successfully';
  }

  private explainConditions(plan: ExecutionPlan): string | undefined {
    const stepsWithConditions = plan.steps.filter(s => s.conditions && s.conditions.length > 0);
    
    if (stepsWithConditions.length === 0) {
      return undefined;
    }
    
    let explanation = `This plan includes conditional logic to ensure safety. `;
    
    const balanceChecks = stepsWithConditions.filter(s => 
      s.conditions?.some(c => c.type === 'balance_check')
    );
    
    if (balanceChecks.length > 0) {
      explanation += `${balanceChecks.length} step(s) will verify wallet balance before execution. `;
    }
    
    const priceChecks = stepsWithConditions.filter(s => 
      s.conditions?.some(c => c.type === 'price_check')
    );
    
    if (priceChecks.length > 0) {
      explanation += `${priceChecks.length} step(s) depend on market price conditions. `;
    }
    
    explanation += 'Steps will be skipped if conditions are not met.';
    
    return explanation;
  }

  private suggestAlternatives(plan: ExecutionPlan): string[] | undefined {
    const alternatives: string[] = [];
    
    if (plan.steps.length > 1) {
      alternatives.push('Execute steps individually with manual approval between each');
    }
    
    const hasConditions = plan.steps.some(s => s.conditions && s.conditions.length > 0);
    if (!hasConditions && plan.steps.some(s => s.toolName === 'transferToken')) {
      alternatives.push('Add balance check condition before transfer');
    }
    
    if (plan.overallRiskLevel === 'high' || plan.overallRiskLevel === 'critical') {
      alternatives.push('Split into smaller transactions to reduce risk');
      alternatives.push('Use a test transaction first to verify recipient address');
    }
    
    return alternatives.length > 0 ? alternatives : undefined;
  }

  formatExplanationForDisplay(explanation: PlanExplanation): string {
    let output = '\n' + '='.repeat(70) + '\n';
    output += '📋 PLAN EXPLANATION\n';
    output += '='.repeat(70) + '\n\n';
    
    output += `💬 Your Request: "${explanation.intent}"\n`;
    output += `🎯 Normalized: "${explanation.normalizedIntent}"\n\n`;
    
    output += '🤔 Why This Plan?\n';
    output += `   ${explanation.reasoning.whyThisPlan}\n\n`;
    
    output += '⚠️  Risk Assessment:\n';
    output += `   ${explanation.reasoning.riskAssessment}\n\n`;
    
    output += '📝 Step-by-Step Breakdown:\n';
    explanation.reasoning.stepBreakdown.forEach((step, index) => {
      output += `\n   ${index + 1}. ${step.action}\n`;
      output += `      Why: ${step.why}\n`;
      
      if (step.risks.length > 0) {
        output += `      Risks: ${step.risks.join(', ')}\n`;
      }
      
      if (step.dependencies) {
        output += `      Dependencies: ${step.dependencies.join(', ')}\n`;
      }
      
      output += `      Expected: ${step.expectedOutcome}\n`;
    });
    
    if (explanation.reasoning.conditionsRationale) {
      output += `\n🔒 Conditional Logic:\n`;
      output += `   ${explanation.reasoning.conditionsRationale}\n`;
    }
    
    if (explanation.reasoning.alternativesConsidered) {
      output += `\n💡 Alternative Approaches:\n`;
      explanation.reasoning.alternativesConsidered.forEach((alt, index) => {
        output += `   ${index + 1}. ${alt}\n`;
      });
    }
    
    output += '\n' + '='.repeat(70) + '\n';
    
    return output;
  }
}
