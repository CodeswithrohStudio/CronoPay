import { Contract, JsonRpcProvider, Wallet, parseUnits } from 'ethers';

export interface BatchTransferArgs {
  tokenAddress: string;
  recipients: string[];
  amounts: string[];
}

export interface BatchTransferResult {
  success: boolean;
  txHash?: string;
  from: string;
  recipients: string[];
  amounts: string[];
  tokenAddress: string;
  totalAmount: string;
  gasUsed?: string;
  chainId: number;
  message: string;
}

export class BatchTransactionBuilder {
  private readonly rpcUrl: string;
  private readonly privateKey: string;
  private static readonly CHAIN_ID = 338;
  private static nonceLock: Promise<void> = Promise.resolve();
  private static lastNonce: number | null = null;
  private static lastNonceTime: number = 0;

  constructor(rpcUrl?: string, privateKey?: string) {
    this.rpcUrl = rpcUrl || process.env.CRONOS_RPC_URL || 'https://evm-t3.cronos.org';
    this.privateKey = privateKey || process.env.CRONOS_PRIVATE_KEY || '';
  }

  async executeBatchTransfer(args: BatchTransferArgs): Promise<BatchTransferResult> {
    if (args.recipients.length !== args.amounts.length) {
      throw new Error('Recipients and amounts arrays must have the same length');
    }

    if (args.recipients.length === 0) {
      throw new Error('At least one recipient is required');
    }

    const provider = new JsonRpcProvider(this.rpcUrl, BatchTransactionBuilder.CHAIN_ID);
    const wallet = new Wallet(this.privateKey, provider);

    const erc20Abi = [
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)',
      'function transfer(address to, uint256 value) returns (bool)',
    ];

    const token = new Contract(args.tokenAddress, erc20Abi, wallet);
    const decimals = await token.decimals();
    const symbol = await token.symbol();

    // Calculate total amount
    let totalValue = 0n;
    for (const amount of args.amounts) {
      totalValue += parseUnits(amount, decimals);
    }

    // Use mutex lock for nonce management
    await BatchTransactionBuilder.nonceLock;
    
    let resolveLock: () => void;
    BatchTransactionBuilder.nonceLock = new Promise(resolve => {
      resolveLock = resolve;
    });

    try {
      // Get nonce
      const now = Date.now();
      let nonce: number;
      
      if (BatchTransactionBuilder.lastNonce !== null && (now - BatchTransactionBuilder.lastNonceTime) < 2000) {
        nonce = BatchTransactionBuilder.lastNonce;
        BatchTransactionBuilder.lastNonce++;
      } else {
        nonce = await wallet.getNonce('latest');
        BatchTransactionBuilder.lastNonce = nonce + 1;
        BatchTransactionBuilder.lastNonceTime = now;
      }

      // Execute transfers sequentially
      const txHashes: string[] = [];
      let currentNonce = nonce;

      for (let i = 0; i < args.recipients.length; i++) {
        const value = parseUnits(args.amounts[i], decimals);
        const tx = await token.transfer(args.recipients[i], value, { nonce: currentNonce });
        txHashes.push(tx.hash);
        currentNonce++;
      }

      // Update last nonce
      BatchTransactionBuilder.lastNonce = currentNonce;

      // Release lock
      setTimeout(() => resolveLock!(), 100);

      return {
        success: true,
        txHash: txHashes.join(', '),
        from: await wallet.getAddress(),
        recipients: args.recipients,
        amounts: args.amounts,
        tokenAddress: args.tokenAddress,
        totalAmount: `${totalValue.toString()} ${symbol}`,
        chainId: BatchTransactionBuilder.CHAIN_ID,
        message: `Batch transfer successful! ${args.recipients.length} transactions sent. Total: ${totalValue.toString()} ${symbol}`,
      };
    } catch (error) {
      BatchTransactionBuilder.lastNonce = null;
      resolveLock!();
      throw error;
    }
  }

  async estimateBatchGas(args: BatchTransferArgs): Promise<{ totalGas: string; totalCost: string }> {
    const provider = new JsonRpcProvider(this.rpcUrl, BatchTransactionBuilder.CHAIN_ID);
    const wallet = new Wallet(this.privateKey, provider);

    const erc20Abi = [
      'function decimals() view returns (uint8)',
      'function transfer(address to, uint256 value) returns (bool)',
    ];

    const token = new Contract(args.tokenAddress, erc20Abi, wallet);
    const decimals = await token.decimals();

    let totalGas = 0n;
    for (let i = 0; i < args.recipients.length; i++) {
      const value = parseUnits(args.amounts[i], decimals);
      const gasEstimate = await token.transfer.estimateGas(args.recipients[i], value);
      totalGas += gasEstimate;
    }

    const feeData = await provider.getFeeData();
    const totalCost = totalGas * (feeData.gasPrice || 0n);

    return {
      totalGas: totalGas.toString(),
      totalCost: totalCost.toString(),
    };
  }
}
