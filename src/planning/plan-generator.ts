import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { ExecutionPlan, ExecutionStep, RiskLevel, StepStatus, Condition, ConditionOperator } from './types.js';
import { MCPTool } from '../mcp-client.js';

export interface PlanGeneratorConfig {
  apiKey: string;
  model?: string;
}

export class PlanGenerator {
  private openai: OpenAI;
  private model: string;

  constructor(config: PlanGeneratorConfig) {
    this.openai = new OpenAI({
      apiKey: config.apiKey,
    });
    this.model = config.model || 'gpt-4o-mini';
  }

  async generatePlan(
    userIntent: string,
    availableTools: MCPTool[]
  ): Promise<ExecutionPlan> {
    const systemPrompt = this.buildSystemPrompt(availableTools);
    
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userIntent }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    const planData = JSON.parse(content);
    return this.transformToPlan(userIntent, planData);
  }

  private buildSystemPrompt(availableTools: MCPTool[]): string {
    const toolDescriptions = availableTools
      .map(tool => `- ${tool.name}: ${tool.description || 'No description'}`)
      .join('\n');

    return `You are an execution plan generator for a finance agent on Cronos Testnet.

Your job is to convert user intent into a structured, deterministic execution plan.

AVAILABLE TOOLS:
${toolDescriptions}

RULES:
1. Normalize the user's intent into a clear, unambiguous statement
2. Break down the intent into discrete, sequential steps
3. Each step must map to exactly ONE tool call
4. Identify conditions that must be checked before execution (e.g., balance checks, price checks, volatility checks)
5. Assign risk levels: low (read-only), medium (transfers <10 USDC), high (transfers >=10 USDC), critical (>100 USDC)
6. No loops, no retries, no autonomous decision-making
7. Be explicit about what will happen
8. Support market-aware conditions: price_check, volatility_check, trend_check

OUTPUT FORMAT (JSON only):
{
  "normalizedIntent": "Clear statement of what will happen",
  "steps": [
    {
      "action": "Human-readable action description",
      "toolName": "exact tool name from available tools",
      "parameters": {
        "param1": "value1"
      },
      "conditions": [
        {
          "type": "balance_check",
          "field": "balance",
          "operator": "gte",
          "value": "10",
          "description": "Ensure balance >= 10 USDC before transfer"
        },
        {
          "type": "price_check",
          "field": "price",
          "operator": "gt",
          "value": "0.10",
          "symbol": "CRO",
          "description": "Execute only if CRO price > $0.10"
        },
        {
          "type": "volatility_check",
          "field": "volatility",
          "operator": "lt",
          "value": "5",
          "symbol": "BTC",
          "description": "Execute only if BTC volatility < 5%"
        }
      ],
      "riskLevel": "low|medium|high|critical",
      "description": "Detailed explanation of this step",
      "estimatedGas": "0.001"
    }
  ],
  "overallRiskLevel": "highest risk level among all steps",
  "requiresApproval": true,
  "canRollback": false
}

IMPORTANT:
- If user says "send 1 USDC to 0x123...", create a plan with:
  1. Step 1: getBalance tool to check current balance (risk: low)
  2. Step 2: transferToken with balance_check condition (risk: medium/high based on amount)
- If user says "send USDC if CRO is above $0.10", add price_check condition with symbol: "CRO"
- If user says "pay when BTC volatility is low", add volatility_check condition with symbol: "BTC"
- If user says "transfer if market is bullish", add trend_check condition with value: "bullish"
- Token address for USDC on Cronos Testnet: ${process.env.CRONOS_USDC_TOKEN_ADDRESS || '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0'}
- Always include balance_check conditions on transfer steps
- Use getBalance tool for explicit balance verification steps
- Be conservative with risk assessment
- Market conditions use Crypto.com real-time data for: BTC, ETH, CRO, USDC, USDT

EXAMPLE for "Send 5 USDC to 0x123...":
{
  "normalizedIntent": "Check wallet balance and transfer 5 USDC to 0x123... on Cronos Testnet",
  "steps": [
    {
      "action": "Check current USDC balance",
      "toolName": "getBalance",
      "parameters": {
        "tokenAddress": "${process.env.CRONOS_USDC_TOKEN_ADDRESS || '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0'}"
      },
      "conditions": [],
      "riskLevel": "low",
      "description": "Verify current USDC balance before proceeding with transfer",
      "estimatedGas": "0"
    },
    {
      "action": "Transfer 5 USDC to recipient",
      "toolName": "transferToken",
      "parameters": {
        "to": "0x123...",
        "amount": "5"
      },
      "conditions": [
        {
          "type": "balance_check",
          "field": "balance",
          "operator": "gte",
          "value": "5",
          "description": "Ensure balance >= 5 USDC before transfer"
        }
      ],
      "riskLevel": "medium",
      "description": "Execute USDC transfer to recipient address",
      "estimatedGas": "0.001"
    }
  ],
  "overallRiskLevel": "medium",
  "requiresApproval": true,
  "canRollback": false
}`;
  }

  private transformToPlan(userIntent: string, planData: any): ExecutionPlan {
    const planId = uuidv4();
    
    const steps: ExecutionStep[] = planData.steps.map((step: any, index: number) => ({
      id: `${planId}-step-${index + 1}`,
      action: step.action,
      toolName: step.toolName,
      parameters: step.parameters || {},
      conditions: step.conditions || [],
      riskLevel: step.riskLevel as RiskLevel,
      description: step.description,
      estimatedGas: step.estimatedGas,
      status: StepStatus.PENDING,
    }));

    return {
      id: planId,
      intent: userIntent,
      normalizedIntent: planData.normalizedIntent,
      steps,
      overallRiskLevel: planData.overallRiskLevel as RiskLevel,
      estimatedTotalGas: this.calculateTotalGas(steps),
      createdAt: new Date().toISOString(),
      metadata: {
        requiresApproval: planData.requiresApproval ?? true,
        canRollback: planData.canRollback ?? false,
        estimatedDuration: this.estimateDuration(steps),
      },
    };
  }

  private calculateTotalGas(steps: ExecutionStep[]): string | undefined {
    const gasValues = steps
      .map(s => s.estimatedGas)
      .filter((g): g is string => g !== undefined)
      .map(g => parseFloat(g));

    if (gasValues.length === 0) return undefined;
    
    const total = gasValues.reduce((sum, val) => sum + val, 0);
    return total.toFixed(6);
  }

  private estimateDuration(steps: ExecutionStep[]): string {
    const seconds = steps.length * 3;
    return `~${seconds}s`;
  }
}
