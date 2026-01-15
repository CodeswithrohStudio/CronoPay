import { Contract, JsonRpcProvider, isAddress, formatUnits } from "ethers";

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

export interface BalanceCheckArgs {
  tokenAddress: string;
  walletAddress: string;
}

export interface BalanceCheckResult {
  balance: string;
  balanceRaw: string;
  decimals: number;
  symbol: string;
  tokenAddress: string;
  walletAddress: string;
}

export class BalanceChecker {
  private readonly rpcUrl: string;
  private static readonly CHAIN_ID = 338;

  constructor(opts?: { rpcUrl?: string }) {
    this.rpcUrl = opts?.rpcUrl ?? process.env.CRONOS_RPC_URL ?? "https://evm-t3.cronos.org";
  }

  async checkBalance(args: BalanceCheckArgs): Promise<BalanceCheckResult> {
    if (!isAddress(args.tokenAddress)) {
      throw new Error(`Invalid tokenAddress: ${args.tokenAddress}`);
    }
    if (!isAddress(args.walletAddress)) {
      throw new Error(`Invalid walletAddress: ${args.walletAddress}`);
    }

    const provider = new JsonRpcProvider(this.rpcUrl, BalanceChecker.CHAIN_ID);
    const token = new Contract(args.tokenAddress, ERC20_ABI, provider);

    const [balanceRaw, decimals, symbol] = await Promise.all([
      token.balanceOf(args.walletAddress),
      token.decimals(),
      token.symbol(),
    ]);

    const balance = formatUnits(balanceRaw, decimals);

    return {
      balance,
      balanceRaw: balanceRaw.toString(),
      decimals: Number(decimals),
      symbol,
      tokenAddress: args.tokenAddress,
      walletAddress: args.walletAddress,
    };
  }

  async getWalletAddress(): Promise<string> {
    const privateKey = process.env.CRONOS_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("CRONOS_PRIVATE_KEY not found in environment");
    }

    const { Wallet } = await import("ethers");
    const wallet = new Wallet(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);
    return wallet.address;
  }
}
