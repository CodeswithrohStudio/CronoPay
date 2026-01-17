export interface ReasoningStep {
  timestamp: number;
  phase: 'understanding' | 'planning' | 'validation' | 'execution' | 'evaluation';
  decision: string;
  reasoning: string;
  confidence: number;
  alternatives?: string[];
  metadata?: Record<string, any>;
}

export interface PlanExplanation {
  intent: string;
  normalizedIntent: string;
  reasoning: {
    whyThisPlan: string;
    riskAssessment: string;
    stepBreakdown: StepExplanation[];
    conditionsRationale?: string;
    alternativesConsidered?: string[];
  };
  trace: ReasoningStep[];
}

export interface StepExplanation {
  stepId: string;
  action: string;
  why: string;
  risks: string[];
  dependencies?: string[];
  expectedOutcome: string;
}

export interface ExecutionExplanation {
  planId: string;
  startTime: number;
  endTime?: number;
  decisions: DecisionLog[];
  conditionEvaluations: ConditionEvaluation[];
  summary: string;
}

export interface DecisionLog {
  timestamp: number;
  stepId: string;
  decision: 'execute' | 'skip' | 'abort' | 'retry';
  reason: string;
  context: Record<string, any>;
}

export interface ConditionEvaluation {
  timestamp: number;
  stepId: string;
  condition: string;
  result: boolean;
  actualValue: any;
  expectedValue: any;
  explanation: string;
}

export interface AuditTrail {
  sessionId: string;
  userIntent: string;
  planExplanation: PlanExplanation;
  executionExplanation?: ExecutionExplanation;
  outcome: 'success' | 'partial' | 'failed' | 'aborted';
  finalSummary: string;
  createdAt: number;
  completedAt?: number;
}
