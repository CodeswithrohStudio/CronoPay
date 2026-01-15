import { Condition, ConditionOperator } from '../planning/types.js';
import { MCPClient } from '../mcp-client.js';

export interface ConditionContext {
  mcpClient: MCPClient;
  executionState: Map<string, any>;
  stepParameters: Record<string, any>;
}

export class ConditionEvaluator {
  async evaluate(
    condition: Condition,
    context: ConditionContext
  ): Promise<{ met: boolean; actualValue?: any; reason?: string }> {
    try {
      if (condition.type === 'balance_check') {
        return await this.evaluateBalanceCheck(condition, context);
      } else if (condition.type === 'custom') {
        return await this.evaluateCustomCondition(condition, context);
      }

      return {
        met: false,
        reason: `Unknown condition type: ${condition.type}`,
      };
    } catch (error: any) {
      return {
        met: false,
        reason: `Condition evaluation error: ${error?.message || String(error)}`,
      };
    }
  }

  private async evaluateBalanceCheck(
    condition: Condition,
    context: ConditionContext
  ): Promise<{ met: boolean; actualValue?: any; reason?: string }> {
    const tokenAddress = process.env.CRONOS_USDC_TOKEN_ADDRESS || 
      "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0";

    const balanceResult = await context.mcpClient.callTool('getBalance', {
      tokenAddress,
    });

    const balanceData = typeof balanceResult === 'string' 
      ? JSON.parse(balanceResult) 
      : balanceResult;

    const actualBalance = parseFloat(balanceData.balance);
    const requiredBalance = typeof condition.value === 'string' 
      ? parseFloat(condition.value) 
      : condition.value;

    const met = this.compareValues(actualBalance, condition.operator, requiredBalance);

    return {
      met,
      actualValue: actualBalance,
      reason: met 
        ? `Balance ${actualBalance} ${balanceData.symbol} meets requirement (${condition.operator} ${requiredBalance})`
        : `Insufficient balance: ${actualBalance} ${balanceData.symbol} (required: ${condition.operator} ${requiredBalance})`,
    };
  }

  private async evaluateCustomCondition(
    condition: Condition,
    context: ConditionContext
  ): Promise<{ met: boolean; actualValue?: any; reason?: string }> {
    const actualValue = context.executionState.get(condition.field);

    if (actualValue === undefined) {
      return {
        met: false,
        reason: `Field '${condition.field}' not found in execution state`,
      };
    }

    const met = this.compareValues(actualValue, condition.operator, condition.value);

    return {
      met,
      actualValue,
      reason: met 
        ? `Condition met: ${condition.field} ${condition.operator} ${condition.value}`
        : `Condition not met: ${condition.field} = ${actualValue} (expected ${condition.operator} ${condition.value})`,
    };
  }

  private compareValues(actual: any, operator: ConditionOperator, expected: any): boolean {
    const actualNum = typeof actual === 'string' ? parseFloat(actual) : actual;
    const expectedNum = typeof expected === 'string' ? parseFloat(expected) : expected;

    switch (operator) {
      case ConditionOperator.GREATER_THAN:
        return actualNum > expectedNum;
      case ConditionOperator.LESS_THAN:
        return actualNum < expectedNum;
      case ConditionOperator.EQUAL:
        return actualNum === expectedNum;
      case ConditionOperator.NOT_EQUAL:
        return actualNum !== expectedNum;
      case ConditionOperator.GREATER_THAN_OR_EQUAL:
        return actualNum >= expectedNum;
      case ConditionOperator.LESS_THAN_OR_EQUAL:
        return actualNum <= expectedNum;
      default:
        return false;
    }
  }
}
