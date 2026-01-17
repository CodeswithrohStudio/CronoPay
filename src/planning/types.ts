export enum RiskLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical"
}

export enum StepStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
  SKIPPED = "skipped"
}

export enum ConditionOperator {
  GREATER_THAN = "gt",
  LESS_THAN = "lt",
  EQUAL = "eq",
  NOT_EQUAL = "neq",
  GREATER_THAN_OR_EQUAL = "gte",
  LESS_THAN_OR_EQUAL = "lte"
}

export interface Condition {
  type: "balance_check" | "price_check" | "volatility_check" | "trend_check" | "custom";
  field: string;
  operator: ConditionOperator;
  value: string | number;
  description: string;
  symbol?: string;
}

export interface ExecutionStep {
  id: string;
  action: string;
  toolName: string;
  parameters: Record<string, any>;
  conditions?: Condition[];
  riskLevel: RiskLevel;
  description: string;
  estimatedGas?: string;
  status: StepStatus;
  result?: any;
  error?: string;
}

export interface ExecutionPlan {
  id: string;
  intent: string;
  normalizedIntent: string;
  steps: ExecutionStep[];
  overallRiskLevel: RiskLevel;
  estimatedTotalGas?: string;
  createdAt: string;
  metadata: {
    requiresApproval: boolean;
    canRollback: boolean;
    estimatedDuration?: string;
  };
}

export interface PlanValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
