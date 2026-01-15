import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CronosTransferExecutor } from "./cronos-transfer-executor.js";
import { BalanceChecker } from "./balance-checker.js";

export function registerFinanceTools(mcp: McpServer): void {
  const USDC_ADDRESS = process.env.CRONOS_USDC_TOKEN_ADDRESS || "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0";

  mcp.registerTool(
    "transferToken",
    {
      title: "Transfer USDC on Cronos Testnet",
      description: `Transfers USDC tokens on Cronos Testnet (chainId: 338). This tool uses the verified USDC ERC-20 contract at ${USDC_ADDRESS}. The contract address is hardcoded and validated server-side. Network: Cronos Testnet. Token: USDC (6 decimals). Contract: ${USDC_ADDRESS}`,
      inputSchema: {
        to: z.string().describe("Recipient wallet address (0x...)"),
        amount: z.string().describe("Amount of USDC to transfer (e.g. '1' or '0.5')"),
      },
      outputSchema: {
        txHash: z.string(),
        from: z.string(),
        to: z.string(),
        tokenAddress: z.string(),
        amount: z.string(),
        chainId: z.number(),
      },
    },
    async (
      { to, amount }: { to: string; amount: string },
      _extra
    ) => {
      const executor = new CronosTransferExecutor();
      const result = await executor.transferToken({
        tokenAddress: USDC_ADDRESS,
        to,
        amount,
      });

      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    }
  );

  mcp.registerTool(
    "getBalance",
    {
      title: "Get ERC20 Token Balance on Cronos Testnet",
      description: `Retrieves the balance of an ERC20 token for a wallet address on Cronos Testnet (chainId: 338). Returns balance in human-readable format and raw format.`,
      inputSchema: {
        tokenAddress: z.string().describe("Token contract address (0x...)"),
        walletAddress: z.string().optional().describe("Wallet address to check (defaults to agent's wallet)"),
      },
      outputSchema: {
        balance: z.string(),
        balanceRaw: z.string(),
        decimals: z.number(),
        symbol: z.string(),
        tokenAddress: z.string(),
        walletAddress: z.string(),
      },
    },
    async (
      { tokenAddress, walletAddress }: { tokenAddress: string; walletAddress?: string },
      _extra
    ) => {
      const checker = new BalanceChecker();
      
      const targetWallet = walletAddress || await checker.getWalletAddress();
      
      const result = await checker.checkBalance({
        tokenAddress,
        walletAddress: targetWallet,
      });

      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    }
  );
}
