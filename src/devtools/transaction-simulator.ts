import { Contract, JsonRpcProvider, Wallet, parseUnits } from 'ethers';

export interface SimulationResult {
  success: boolean;
  wouldSucceed: boolean;
  gasEstimate?: string;
  gasCost?: string;
  balanceChanges?: {
    from: { before: string; after: string };
    to: { before: string; after: string };
  };
  errors?: string[];
  warnings?: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

export class TransactionSimulator {
  private readonly rpcUrl: string;
  private readonly privateKey: string;
  private static readonly CHAIN_ID = 338;

  constructor(rpcUrl?: string, privateKey?: string) {
    this.rpcUrl = rpcUrl || process.env.CRONOS_RPC_URL || 'https://evm-t3.cronos.org';
    this.privateKey = privateKey || process.env.CRONOS_PRIVATE_KEY || '';
  }

  async simulateTransfer(
    tokenAddress: string,
    to: string,
    amount: string
  ): Promise<SimulationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    try {
      const provider = new JsonRpcProvider(this.rpcUrl, TransactionSimulator.CHAIN_ID);
      const wallet = new Wallet(this.privateKey, provider);

      const erc20Abi = [
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)',
        'function balanceOf(address) view returns (uint256)',
        'function transfer(address to, uint256 value) returns (bool)',
      ];

      const token = new Contract(tokenAddress, erc20Abi, wallet);

      // Get token info
      const [decimals, symbol, senderBalance, recipientBalance] = await Promise.all([
        token.decimals(),
        token.symbol(),
        token.balanceOf(wallet.address),
        token.balanceOf(to),
      ]);

      const value = parseUnits(amount, decimals);

      // Check if sender has enough balance
      if (senderBalance < value) {
        errors.push(`Insufficient balance. Have: ${senderBalance.toString()}, Need: ${value.toString()}`);
        riskLevel = 'critical';
        return {
          success: true,
          wouldSucceed: false,
          errors,
          warnings,
          riskLevel,
          message: 'Simulation failed: Insufficient balance',
        };
      }

      // Estimate gas
      let gasEstimate: bigint;
      let gasCost: bigint;
      try {
        gasEstimate = await token.transfer.estimateGas(to, value);
        const feeData = await provider.getFeeData();
        gasCost = gasEstimate * (feeData.gasPrice || 0n);
      } catch (error: any) {
        errors.push(`Gas estimation failed: ${error.message}`);
        riskLevel = 'high';
        return {
          success: true,
          wouldSucceed: false,
          errors,
          warnings,
          riskLevel,
          message: 'Simulation failed: Cannot estimate gas',
        };
      }

      // Calculate balance changes
      const senderAfter = senderBalance - value;
      const recipientAfter = recipientBalance + value;

      // Risk assessment
      const amountNum = parseFloat(amount);
      const balanceNum = parseFloat(senderBalance.toString()) / Math.pow(10, Number(decimals));

      if (amountNum > balanceNum * 0.9) {
        warnings.push('Transferring >90% of balance');
        riskLevel = 'high';
      } else if (amountNum > balanceNum * 0.5) {
        warnings.push('Transferring >50% of balance');
        riskLevel = 'medium';
      }

      if (amountNum > 100) {
        warnings.push('Large transfer amount');
        if (riskLevel === 'low') riskLevel = 'medium';
      }

      // Check if recipient is a contract
      const recipientCode = await provider.getCode(to);
      if (recipientCode !== '0x') {
        warnings.push('Recipient is a smart contract');
        if (riskLevel === 'low') riskLevel = 'medium';
      }

      return {
        success: true,
        wouldSucceed: true,
        gasEstimate: gasEstimate.toString(),
        gasCost: gasCost.toString(),
        balanceChanges: {
          from: {
            before: `${senderBalance.toString()} ${symbol}`,
            after: `${senderAfter.toString()} ${symbol}`,
          },
          to: {
            before: `${recipientBalance.toString()} ${symbol}`,
            after: `${recipientAfter.toString()} ${symbol}`,
          },
        },
        errors,
        warnings,
        riskLevel,
        message: `Simulation successful. Transaction would succeed with gas cost: ${gasCost.toString()} wei`,
      };
    } catch (error: any) {
      errors.push(error.message);
      return {
        success: false,
        wouldSucceed: false,
        errors,
        warnings,
        riskLevel: 'critical',
        message: `Simulation error: ${error.message}`,
      };
    }
  }

  async simulateBatchTransfer(
    tokenAddress: string,
    recipients: string[],
    amounts: string[]
  ): Promise<SimulationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    try {
      if (recipients.length !== amounts.length) {
        errors.push('Recipients and amounts arrays must have the same length');
        return {
          success: false,
          wouldSucceed: false,
          errors,
          warnings,
          riskLevel: 'critical',
          message: 'Invalid batch parameters',
        };
      }

      const provider = new JsonRpcProvider(this.rpcUrl, TransactionSimulator.CHAIN_ID);
      const wallet = new Wallet(this.privateKey, provider);

      const erc20Abi = [
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)',
        'function balanceOf(address) view returns (uint256)',
      ];

      const token = new Contract(tokenAddress, erc20Abi, provider);

      const [decimals, symbol, senderBalance] = await Promise.all([
        token.decimals(),
        token.symbol(),
        token.balanceOf(wallet.address),
      ]);

      // Calculate total amount needed
      let totalValue = 0n;
      for (const amount of amounts) {
        totalValue += parseUnits(amount, decimals);
      }

      // Check if sender has enough balance
      if (senderBalance < totalValue) {
        errors.push(`Insufficient balance for batch. Have: ${senderBalance.toString()}, Need: ${totalValue.toString()}`);
        riskLevel = 'critical';
        return {
          success: true,
          wouldSucceed: false,
          errors,
          warnings,
          riskLevel,
          message: 'Batch simulation failed: Insufficient balance',
        };
      }

      // Estimate gas (approximate: 21000 base + 50000 per transfer)
      const estimatedGas = 21000n + BigInt(recipients.length) * 50000n;
      const feeData = await provider.getFeeData();
      const gasCost = estimatedGas * (feeData.gasPrice || 0n);

      // Risk assessment
      const totalNum = parseFloat(totalValue.toString()) / Math.pow(10, Number(decimals));
      const balanceNum = parseFloat(senderBalance.toString()) / Math.pow(10, Number(decimals));

      if (totalNum > balanceNum * 0.9) {
        warnings.push('Batch transfer >90% of balance');
        riskLevel = 'high';
      } else if (totalNum > balanceNum * 0.5) {
        warnings.push('Batch transfer >50% of balance');
        riskLevel = 'medium';
      }

      if (recipients.length > 10) {
        warnings.push('Large batch size (>10 recipients)');
        if (riskLevel === 'low') riskLevel = 'medium';
      }

      const senderAfter = senderBalance - totalValue;

      return {
        success: true,
        wouldSucceed: true,
        gasEstimate: estimatedGas.toString(),
        gasCost: gasCost.toString(),
        balanceChanges: {
          from: {
            before: `${senderBalance.toString()} ${symbol}`,
            after: `${senderAfter.toString()} ${symbol}`,
          },
          to: {
            before: 'Multiple recipients',
            after: `${recipients.length} recipients will receive tokens`,
          },
        },
        errors,
        warnings,
        riskLevel,
        message: `Batch simulation successful. ${recipients.length} transfers would succeed with estimated gas: ${gasCost.toString()} wei`,
      };
    } catch (error: any) {
      errors.push(error.message);
      return {
        success: false,
        wouldSucceed: false,
        errors,
        warnings,
        riskLevel: 'critical',
        message: `Batch simulation error: ${error.message}`,
      };
    }
  }
}
