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
      description: `Transfers USDC (devUSDC.e) tokens on Cronos Testnet (chainId: 338). This tool uses the verified USDC ERC-20 contract at ${USDC_ADDRESS}. The contract address is hardcoded and validated server-side. Network: Cronos Testnet. Token: devUSDC.e (6 decimals). Contract: ${USDC_ADDRESS}`,
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
      await executor.validateToken(USDC_ADDRESS, "devUSDC.e", 6);

      const result = await executor.transferToken({
        tokenAddress: USDC_ADDRESS,
        to,
        amount,
      });

      const response = {
        success: true,
        ...result,
        status: 'pending',
        message: `Transaction broadcast successfully! ${amount} devUSDC.e sent to ${to}. Transaction hash: ${result.txHash}. The transaction is pending confirmation on Cronos Testnet.`,
        explorerUrl: `https://explorer.cronos.org/testnet/tx/${result.txHash}`,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
        structuredContent: response as unknown as Record<string, unknown>,
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

  mcp.registerTool(
    'cancel_pending_transaction',
    {
      title: 'Cancel Pending Transaction',
      description: 'Cancel a pending transaction by sending a 0-value transaction with the same nonce and higher gas. If nonce is not provided, cancels the oldest pending transaction.',
      inputSchema: {
        nonce: z.number().optional().describe('Optional: specific nonce to cancel. If not provided, cancels the current pending nonce.'),
      },
    },
    async ({ nonce }: { nonce?: number }) => {
      try {
        const executor = new CronosTransferExecutor();
        const result = await executor.cancelPendingTransaction(nonce);

        const response = {
          success: true,
          txHash: result.txHash,
          message: `Successfully cancelled pending transaction at nonce ${nonce ?? 'current'}. Cancellation tx: ${result.txHash}`,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
          structuredContent: response as unknown as Record<string, unknown>,
        };
      } catch (error: any) {
        const errorResponse = {
          success: false,
          error: error.message || String(error),
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(errorResponse, null, 2) }],
          structuredContent: errorResponse as unknown as Record<string, unknown>,
          isError: true,
        };
      }
    }
  );
}
