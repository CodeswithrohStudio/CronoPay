import { Condition, ConditionOperator } from '../planning/types.js';
import { CryptoComMarketClient } from '../market/crypto-com-client.js';

export interface MarketConditionContext {
  executionState: Map<string, any>;
}

export interface MarketConditionResult {
  met: boolean;
  actualValue?: any;
  reason?: string;
  marketData?: {
    symbol: string;
    price?: number;
    volatility?: number;
    trend?: string;
    change24h?: number;
  };
}

export class MarketConditionEvaluator {
  private marketClient: CryptoComMarketClient;
  private connected: boolean = false;

  constructor() {
    this.marketClient = new CryptoComMarketClient();
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      try {
        await this.marketClient.connect();
        this.connected = true;
      } catch (error: any) {
        throw new Error(`Failed to connect to Crypto.com Market Data MCP: ${error.message}. Market-aware conditions require access to https://mcp.crypto.com/market-data/mcp`);
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      try {
        await this.marketClient.disconnect();
      } catch (error) {
        // Ignore disconnect errors
      }
      this.connected = false;
    }
  }

  async evaluate(
    condition: Condition,
    context: MarketConditionContext
  ): Promise<MarketConditionResult> {
    try {
      await this.connect();
    } catch (error: any) {
      return {
        met: false,
        reason: `Cannot evaluate market condition: ${error.message}`,
      };
    }

    try {
      switch (condition.type) {
        case 'price_check':
          return await this.evaluatePriceCondition(condition);
        
        case 'volatility_check':
          return await this.evaluateVolatilityCondition(condition);
        
        case 'trend_check':
          return await this.evaluateTrendCondition(condition);
        
        default:
          return {
            met: false,
            reason: `Unsupported market condition type: ${condition.type}`,
          };
      }
    } catch (error: any) {
      return {
        met: false,
        reason: `Market condition evaluation failed: ${error.message}`,
      };
    }
  }

  private async evaluatePriceCondition(condition: Condition): Promise<MarketConditionResult> {
    if (!condition.symbol) {
      return {
        met: false,
        reason: 'Price condition requires a symbol',
      };
    }

    const priceData = await this.marketClient.getPrice(condition.symbol);
    const actualPrice = priceData.price;
    const expectedValue = parseFloat(String(condition.value));

    const met = this.compareValues(actualPrice, condition.operator, expectedValue);

    return {
      met,
      actualValue: actualPrice,
      reason: met
        ? `${condition.symbol} price $${actualPrice.toFixed(4)} ${this.operatorToText(condition.operator)} $${expectedValue}`
        : `${condition.symbol} price $${actualPrice.toFixed(4)} does not meet condition (${this.operatorToText(condition.operator)} $${expectedValue})`,
      marketData: {
        symbol: condition.symbol,
        price: actualPrice,
        change24h: priceData.change24h,
      },
    };
  }

  private async evaluateVolatilityCondition(condition: Condition): Promise<MarketConditionResult> {
    if (!condition.symbol) {
      return {
        met: false,
        reason: 'Volatility condition requires a symbol',
      };
    }

    const volatility = await this.marketClient.getVolatility(condition.symbol);
    const expectedValue = parseFloat(String(condition.value));

    const met = this.compareValues(volatility, condition.operator, expectedValue);

    return {
      met,
      actualValue: volatility,
      reason: met
        ? `${condition.symbol} volatility ${volatility.toFixed(2)}% ${this.operatorToText(condition.operator)} ${expectedValue}%`
        : `${condition.symbol} volatility ${volatility.toFixed(2)}% does not meet condition (${this.operatorToText(condition.operator)} ${expectedValue}%)`,
      marketData: {
        symbol: condition.symbol,
        volatility,
      },
    };
  }

  private async evaluateTrendCondition(condition: Condition): Promise<MarketConditionResult> {
    if (!condition.symbol) {
      return {
        met: false,
        reason: 'Trend condition requires a symbol',
      };
    }

    const trend = await this.marketClient.getMarketTrend(condition.symbol);
    const expectedTrend = String(condition.value).toLowerCase();

    const met = trend === expectedTrend;

    return {
      met,
      actualValue: trend,
      reason: met
        ? `${condition.symbol} trend is ${trend} (matches expected ${expectedTrend})`
        : `${condition.symbol} trend is ${trend} (expected ${expectedTrend})`,
      marketData: {
        symbol: condition.symbol,
        trend,
      },
    };
  }

  private compareValues(actual: number, operator: ConditionOperator, expected: number): boolean {
    switch (operator) {
      case ConditionOperator.GREATER_THAN:
        return actual > expected;
      case ConditionOperator.LESS_THAN:
        return actual < expected;
      case ConditionOperator.EQUAL:
        return Math.abs(actual - expected) < 0.0001;
      case ConditionOperator.NOT_EQUAL:
        return Math.abs(actual - expected) >= 0.0001;
      case ConditionOperator.GREATER_THAN_OR_EQUAL:
        return actual >= expected;
      case ConditionOperator.LESS_THAN_OR_EQUAL:
        return actual <= expected;
      default:
        return false;
    }
  }

  private operatorToText(operator: ConditionOperator): string {
    switch (operator) {
      case ConditionOperator.GREATER_THAN:
        return '>';
      case ConditionOperator.LESS_THAN:
        return '<';
      case ConditionOperator.EQUAL:
        return '=';
      case ConditionOperator.NOT_EQUAL:
        return '≠';
      case ConditionOperator.GREATER_THAN_OR_EQUAL:
        return '≥';
      case ConditionOperator.LESS_THAN_OR_EQUAL:
        return '≤';
      default:
        return operator;
    }
  }
}
