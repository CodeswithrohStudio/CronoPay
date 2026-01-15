import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CronosTransferExecutor } from "./cronos-transfer-executor.js";

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
}
