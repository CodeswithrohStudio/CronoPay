import { MCPClient } from '../mcp-client.js';

export interface PriceData {
  symbol: string;
  price: number;
  timestamp: number;
  change24h?: number;
  volume24h?: number;
}

export interface MarketMetrics {
  symbol: string;
  volatility24h: number;
  priceChange24h: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  timestamp: number;
}

export class CryptoComMarketClient {
  private mcpClient: MCPClient;
  private connected: boolean = false;

  constructor() {
    this.mcpClient = new MCPClient('https://mcp.crypto.com/market-data/mcp');
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }
    await this.mcpClient.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }
    await this.mcpClient.disconnect();
    this.connected = false;
  }

  async getPrice(symbol: string): Promise<PriceData> {
    if (!this.connected) {
      throw new Error('Market data client not connected');
    }

    // Use the actual Crypto.com MCP tool name based on documentation
    const result = await this.mcpClient.callTool('get_current_price', {
      cryptocurrency: symbol.toUpperCase(),
      currency: 'USD',
    });

    return {
      symbol: result.cryptocurrency || symbol,
      price: parseFloat(result.price || '0'),
      timestamp: Date.now(),
      change24h: result.change_24h ? parseFloat(result.change_24h) : undefined,
      volume24h: result.volume_24h ? parseFloat(result.volume_24h) : undefined,
    };
  }

  async getVolatility(symbol: string, periodHours: number = 24): Promise<number> {
    if (!this.connected) {
      throw new Error('Market data client not connected');
    }

    // Crypto.com MCP doesn't provide volatility directly
    // Calculate approximate volatility from 24h price change
    const priceData = await this.getPrice(symbol);
    if (priceData.change24h !== undefined) {
      return Math.abs(priceData.change24h);
    }
    
    throw new Error(`Unable to calculate volatility for ${symbol}: no 24h price change data available`);
  }

  async getPriceChange(symbol: string, periodHours: number = 24): Promise<number> {
    if (!this.connected) {
      throw new Error('Market data client not connected');
    }

    const priceData = await this.getPrice(symbol);
    return priceData.change24h || 0;
  }

  async getMarketTrend(symbol: string): Promise<'bullish' | 'bearish' | 'neutral'> {
    if (!this.connected) {
      throw new Error('Market data client not connected');
    }

    // Crypto.com MCP doesn't provide trend directly
    // Derive from 24h price change
    const priceChange = await this.getPriceChange(symbol);
    
    if (priceChange > 2) return 'bullish';
    if (priceChange < -2) return 'bearish';
    return 'neutral';
  }

  async getMarketMetrics(symbol: string): Promise<MarketMetrics> {
    if (!this.connected) {
      throw new Error('Market data client not connected');
    }

    const [volatility, priceChange, trend] = await Promise.all([
      this.getVolatility(symbol),
      this.getPriceChange(symbol),
      this.getMarketTrend(symbol),
    ]);

    return {
      symbol,
      volatility24h: volatility,
      priceChange24h: priceChange,
      trend,
      timestamp: Date.now(),
    };
  }

  async listAvailableSymbols(): Promise<string[]> {
    if (!this.connected) {
      throw new Error('Market data client not connected');
    }

    const result = await this.mcpClient.callTool('list_symbols', {});
    return result.symbols || ['BTC', 'ETH', 'CRO', 'USDC', 'USDT'];
  }
}
