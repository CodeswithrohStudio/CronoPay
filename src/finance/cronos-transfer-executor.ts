import { Contract, JsonRpcProvider, Wallet, isAddress, parseUnits } from "ethers";

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 value) returns (bool)",
];

export interface TransferTokenArgs {
  tokenAddress: string;
  to: string;
  amount: string;
}

export interface TransferTokenResult {
  txHash: string;
  from: string;
  to: string;
  tokenAddress: string;
  amount: string;
  chainId: number;
}

export class CronosTransferExecutor {
  private readonly rpcUrl: string;
  private readonly privateKey: string;
  private static readonly CHAIN_ID = 338;
  private static nonceLock: Promise<void> = Promise.resolve();
  private static lastNonce: number | null = null;
  private static lastNonceTime: number = 0;

  constructor(opts?: { rpcUrl?: string; privateKey?: string }) {
    const rpcUrl = opts?.rpcUrl ?? process.env.CRONOS_RPC_URL ?? "https://evm-t3.cronos.org";
    const rawPrivateKey = opts?.privateKey ?? process.env.CRONOS_PRIVATE_KEY;

    if (!rawPrivateKey) {
      throw new Error("CRONOS_PRIVATE_KEY not found in environment variables (.env is loaded in finance-mcp-server.ts)");
    }

    const privateKey = rawPrivateKey.startsWith("0x") ? rawPrivateKey : `0x${rawPrivateKey}`;
    if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
      throw new Error("CRONOS_PRIVATE_KEY must be a 32-byte hex string (64 hex chars), optionally prefixed with 0x");
    }

    this.rpcUrl = rpcUrl;
    this.privateKey = privateKey;
  }

  async validateToken(tokenAddress: string, expectedSymbol: string, expectedDecimals: number): Promise<void> {
    if (!isAddress(tokenAddress)) {
      throw new Error(`Invalid tokenAddress: ${tokenAddress}`);
    }

    const provider = new JsonRpcProvider(this.rpcUrl, CronosTransferExecutor.CHAIN_ID);
    const token = new Contract(tokenAddress, ERC20_ABI, provider);

    const [symbol, decimals] = await Promise.all([
      token.symbol(),
      token.decimals(),
    ]);

    if (symbol !== expectedSymbol) {
      throw new Error(`Token symbol mismatch: expected ${expectedSymbol}, got ${symbol}`);
    }
    // Convert bigint to number for comparison
    if (Number(decimals) !== expectedDecimals) {
      throw new Error(`Token decimals mismatch: expected ${expectedDecimals}, got ${decimals}`);
    }
  }

  async transferToken(args: TransferTokenArgs): Promise<TransferTokenResult> {
    if (!isAddress(args.tokenAddress)) {
      throw new Error(`Invalid tokenAddress: ${args.tokenAddress}`);
    }
    if (!isAddress(args.to)) {
      throw new Error(`Invalid recipient address: ${args.to}`);
    }

    const provider = new JsonRpcProvider(this.rpcUrl, CronosTransferExecutor.CHAIN_ID);
    const wallet = new Wallet(this.privateKey, provider);
    const token = new Contract(args.tokenAddress, ERC20_ABI, wallet);

    const decimals: number = await token.decimals();
    const value = parseUnits(args.amount, decimals);

    // Use mutex lock to prevent concurrent nonce issues
    await CronosTransferExecutor.nonceLock;
    
    let resolveLock: () => void;
    CronosTransferExecutor.nonceLock = new Promise(resolve => {
      resolveLock = resolve;
    });

    try {
      // Get nonce - use cached if recent (within 2 seconds), otherwise fetch fresh
      const now = Date.now();
      let nonce: number;
      
      if (CronosTransferExecutor.lastNonce !== null && (now - CronosTransferExecutor.lastNonceTime) < 2000) {
        // Use cached nonce and increment
        nonce = CronosTransferExecutor.lastNonce;
        CronosTransferExecutor.lastNonce++;
      } else {
        // Fetch fresh nonce from network
        nonce = await wallet.getNonce('latest');
        CronosTransferExecutor.lastNonce = nonce + 1;
        CronosTransferExecutor.lastNonceTime = now;
      }

      // Send transaction with explicit nonce
      const tx = await token.transfer(args.to, value, { nonce });

      // Release lock after a short delay to ensure transaction is broadcast
      setTimeout(() => resolveLock!(), 100);

      return {
        txHash: tx.hash,
        from: await wallet.getAddress(),
        to: args.to,
        tokenAddress: args.tokenAddress,
        amount: args.amount,
        chainId: CronosTransferExecutor.CHAIN_ID,
      };
    } catch (error) {
      // Reset nonce cache on error
      CronosTransferExecutor.lastNonce = null;
      resolveLock!();
      throw error;
    }
  }

  async cancelPendingTransaction(nonce?: number): Promise<TransferTokenResult> {
    const provider = new JsonRpcProvider(this.rpcUrl, CronosTransferExecutor.CHAIN_ID);
    const wallet = new Wallet(this.privateKey, provider);

    // If nonce not provided, get the current pending nonce
    const txNonce = nonce ?? await wallet.getNonce('pending');

    // Send 0-value transaction to self with higher gas to cancel
    const tx = await wallet.sendTransaction({
      to: await wallet.getAddress(),
      value: 0,
      nonce: txNonce,
      gasLimit: 21000,
      // Increase gas price by 10% to ensure replacement
      maxFeePerGas: (await provider.getFeeData()).maxFeePerGas! * 110n / 100n,
      maxPriorityFeePerGas: (await provider.getFeeData()).maxPriorityFeePerGas! * 110n / 100n,
    });

    await tx.wait(1);

    return {
      txHash: tx.hash,
      from: await wallet.getAddress(),
      to: await wallet.getAddress(),
      tokenAddress: 'CANCEL',
      amount: '0',
      chainId: CronosTransferExecutor.CHAIN_ID,
    };
  }
}
