import { JsonRpcProvider } from 'ethers';

export interface TransactionRecord {
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  amount?: string;
  timestamp: number;
  blockNumber: number;
  gasUsed: string;
  status: 'success' | 'failed';
}

export interface AnalyticsQuery {
  address: string;
  tokenAddress?: string;
  minAmount?: string;
  maxAmount?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

export interface AnalyticsSummary {
  totalTransactions: number;
  totalSent: string;
  totalReceived: string;
  averageAmount: string;
  largestTransaction: TransactionRecord | null;
  mostFrequentRecipient: { address: string; count: number } | null;
  timeRange: { start: number; end: number };
  transactions: TransactionRecord[];
}

export class TransactionAnalytics {
  private readonly rpcUrl: string;
  private static readonly CHAIN_ID = 338;

  constructor(rpcUrl?: string) {
    this.rpcUrl = rpcUrl || process.env.CRONOS_RPC_URL || 'https://evm-t3.cronos.org';
  }

  async queryTransactions(query: AnalyticsQuery): Promise<AnalyticsSummary> {
    const provider = new JsonRpcProvider(this.rpcUrl, TransactionAnalytics.CHAIN_ID);
    
    // Get current block number
    const currentBlock = await provider.getBlockNumber();
    
    // Calculate block range (approximate: 1 block per second)
    const endBlock = currentBlock;
    const startBlock = query.startTime 
      ? Math.max(0, currentBlock - Math.floor((Date.now() / 1000 - query.startTime)))
      : Math.max(0, currentBlock - 1000); // Default: last ~1000 blocks

    const transactions: TransactionRecord[] = [];
    const limit = query.limit || 50;

    // Note: This is a simplified implementation
    // In production, you'd use an indexer or explorer API for better performance
    try {
      // Scan recent blocks for transactions
      for (let i = endBlock; i >= startBlock && transactions.length < limit; i--) {
        try {
          const block = await provider.getBlock(i, true);
          if (!block || !block.transactions) continue;

          for (const txHash of block.transactions) {
            if (transactions.length >= limit) break;

            try {
              const tx = await provider.getTransaction(txHash as string);
              const receipt = await provider.getTransactionReceipt(txHash as string);
              
              if (!tx || !receipt) continue;

              // Check if transaction involves the queried address
              if (tx.from.toLowerCase() === query.address.toLowerCase() ||
                  tx.to?.toLowerCase() === query.address.toLowerCase()) {
                
                transactions.push({
                  hash: tx.hash,
                  from: tx.from,
                  to: tx.to || '',
                  value: tx.value.toString(),
                  timestamp: block.timestamp,
                  blockNumber: block.number,
                  gasUsed: receipt.gasUsed.toString(),
                  status: receipt.status === 1 ? 'success' : 'failed',
                });
              }
            } catch (error) {
              // Skip failed transaction lookups
              continue;
            }
          }
        } catch (error) {
          // Skip failed block lookups
          continue;
        }
      }
    } catch (error) {
      console.error('Error querying transactions:', error);
    }

    // Calculate analytics
    let totalSent = 0n;
    let totalReceived = 0n;
    let largestTx: TransactionRecord | null = null;
    let largestAmount = 0n;
    const recipientCounts: Record<string, number> = {};

    for (const tx of transactions) {
      const value = BigInt(tx.value);

      if (tx.from.toLowerCase() === query.address.toLowerCase()) {
        totalSent += value;
        
        // Track recipients
        if (tx.to) {
          recipientCounts[tx.to] = (recipientCounts[tx.to] || 0) + 1;
        }
      }

      if (tx.to?.toLowerCase() === query.address.toLowerCase()) {
        totalReceived += value;
      }

      if (value > largestAmount) {
        largestAmount = value;
        largestTx = tx;
      }
    }

    // Find most frequent recipient
    let mostFrequentRecipient: { address: string; count: number } | null = null;
    for (const [address, count] of Object.entries(recipientCounts)) {
      if (!mostFrequentRecipient || count > mostFrequentRecipient.count) {
        mostFrequentRecipient = { address, count };
      }
    }

    const averageAmount = transactions.length > 0
      ? ((totalSent + totalReceived) / BigInt(transactions.length)).toString()
      : '0';

    return {
      totalTransactions: transactions.length,
      totalSent: totalSent.toString(),
      totalReceived: totalReceived.toString(),
      averageAmount,
      largestTransaction: largestTx,
      mostFrequentRecipient,
      timeRange: {
        start: transactions.length > 0 ? Math.min(...transactions.map(tx => tx.timestamp)) : 0,
        end: transactions.length > 0 ? Math.max(...transactions.map(tx => tx.timestamp)) : 0,
      },
      transactions,
    };
  }

  async getSpendingSummary(address: string, days: number = 7): Promise<{
    totalSpent: string;
    transactionCount: number;
    averagePerDay: string;
    message: string;
  }> {
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - (days * 24 * 60 * 60);

    const analytics = await this.queryTransactions({
      address,
      startTime,
      endTime,
      limit: 100,
    });

    const avgPerDay = BigInt(analytics.totalSent) / BigInt(days);

    return {
      totalSpent: analytics.totalSent,
      transactionCount: analytics.totalTransactions,
      averagePerDay: avgPerDay.toString(),
      message: `In the last ${days} days: ${analytics.totalTransactions} transactions, ${analytics.totalSent} wei spent, averaging ${avgPerDay.toString()} wei per day`,
    };
  }
}
