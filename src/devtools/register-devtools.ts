import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TransactionVisualizer } from './transaction-visualizer.js';
import { SmartContractTools } from './smart-contract-tools.js';
import { TransactionSimulator } from './transaction-simulator.js';
import { BatchTransactionBuilder } from './batch-transaction-builder.js';
import { TransactionAnalytics } from './transaction-analytics.js';
import { PlanningOrchestrator } from '../planning/index.js';
import { ExplanationGenerator } from '../explainability/index.js';
import fs from 'fs';
import path from 'path';

export function registerDevTools(mcp: McpServer): void {
  const visualizer = new TransactionVisualizer();
  const contractTools = new SmartContractTools();
  const simulator = new TransactionSimulator();
  const batchBuilder = new BatchTransactionBuilder();
  const analytics = new TransactionAnalytics();

  // Tool 1: Visualize Execution Plan
  mcp.registerTool(
    'visualize_plan',
    {
      title: 'Visualize Execution Plan',
      description: 'Generate visual representation of an execution plan. Returns HTML, Mermaid diagram, or ASCII flow chart.',
      inputSchema: {
        intent: z.string().describe('The payment intent to visualize'),
        format: z.enum(['html', 'mermaid', 'ascii']).describe('Output format: html (interactive), mermaid (diagram), or ascii (terminal)'),
      },
    },
    async ({ intent, format }: { intent: string; format: 'html' | 'mermaid' | 'ascii' }) => {
      try {
        const apiKey = process.env.OPENAI_API_KEY!;
        const orchestrator = new PlanningOrchestrator({ apiKey });
        const explanationGen = new ExplanationGenerator();

        // Generate plan
        const { plan } = await orchestrator.createPlan(intent, []);
        const explanation = explanationGen.generatePlanExplanation(plan, intent);

        let visualization: string;
        let contentType: string;

        switch (format) {
          case 'html':
            visualization = visualizer.generateHTMLVisualization(plan, explanation);
            contentType = 'text/html';
            
            // Save to file
            const htmlPath = path.join(process.cwd(), 'visualizations', `plan-${Date.now()}.html`);
            fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
            fs.writeFileSync(htmlPath, visualization);
            break;

          case 'mermaid':
            visualization = visualizer.generateMermaidDiagram(plan, explanation);
            contentType = 'text/plain';
            break;

          case 'ascii':
            visualization = visualizer.generateASCIIFlow(plan);
            contentType = 'text/plain';
            break;
        }

        const response = {
          success: true,
          format,
          visualization,
          message: format === 'html' 
            ? `HTML visualization generated and saved. Open the file to view interactive plan.`
            : `${format.toUpperCase()} visualization generated successfully.`,
        };

        return {
          content: [{ type: 'text', text: visualization }],
          structuredContent: response as unknown as Record<string, unknown>,
        };
      } catch (error: any) {
        const errorResponse = {
          success: false,
          error: error.message,
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(errorResponse, null, 2) }],
          structuredContent: errorResponse as unknown as Record<string, unknown>,
          isError: true,
        };
      }
    }
  );

  // Tool 2: Inspect Smart Contract
  mcp.registerTool(
    'inspect_contract',
    {
      title: 'Inspect Smart Contract',
      description: 'Inspect a smart contract on Cronos Testnet. Returns contract info, functions, and events.',
      inputSchema: {
        address: z.string().describe('Contract address (0x...)'),
      },
    },
    async ({ address }: { address: string }) => {
      try {
        const info = await contractTools.inspectContract(address);

        const response = {
          success: true,
          contract: info,
          message: `Contract at ${address} inspected successfully.`,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
          structuredContent: response as unknown as Record<string, unknown>,
        };
      } catch (error: any) {
        const errorResponse = {
          success: false,
          error: error.message,
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(errorResponse, null, 2) }],
          structuredContent: errorResponse as unknown as Record<string, unknown>,
          isError: true,
        };
      }
    }
  );

  // Tool 3: Read Contract Function
  mcp.registerTool(
    'read_contract',
    {
      title: 'Read Contract Function',
      description: 'Call a read-only function on a smart contract (view/pure functions).',
      inputSchema: {
        address: z.string().describe('Contract address'),
        functionName: z.string().describe('Function name to call'),
        args: z.array(z.string()).optional().describe('Function arguments as strings (if any)'),
      },
    },
    async ({ address, functionName, args }: { address: string; functionName: string; args?: string[] }) => {
      try {
        // Use standard ERC20 ABI for common functions
        const erc20Abi = [
          'function name() view returns (string)',
          'function symbol() view returns (string)',
          'function decimals() view returns (uint8)',
          'function totalSupply() view returns (uint256)',
          'function balanceOf(address) view returns (uint256)',
        ];

        const result = await contractTools.readContract(address, erc20Abi, functionName, args || []);

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          structuredContent: result as unknown as Record<string, unknown>,
        };
      } catch (error: any) {
        const errorResponse = {
          success: false,
          error: error.message,
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(errorResponse, null, 2) }],
          structuredContent: errorResponse as unknown as Record<string, unknown>,
          isError: true,
        };
      }
    }
  );

  // Tool 4: Estimate Gas
  mcp.registerTool(
    'estimate_gas',
    {
      title: 'Estimate Gas Cost',
      description: 'Estimate gas cost for a contract function call.',
      inputSchema: {
        address: z.string().describe('Contract address'),
        functionName: z.string().describe('Function name'),
        args: z.array(z.string()).optional().describe('Function arguments as strings'),
      },
    },
    async ({ address, functionName, args }: { address: string; functionName: string; args?: string[] }) => {
      try {
        const erc20Abi = [
          'function transfer(address to, uint256 amount) returns (bool)',
          'function approve(address spender, uint256 amount) returns (bool)',
        ];

        const estimate = await contractTools.estimateGas(address, erc20Abi, functionName, args || []);

        const response = {
          success: true,
          ...estimate,
          message: `Estimated gas: ${estimate.gasEstimate} units, Cost: ${estimate.gasCost} wei`,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
          structuredContent: response as unknown as Record<string, unknown>,
        };
      } catch (error: any) {
        const errorResponse = {
          success: false,
          error: error.message,
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(errorResponse, null, 2) }],
          structuredContent: errorResponse as unknown as Record<string, unknown>,
          isError: true,
        };
      }
    }
  );

  // Tool 5: Decode Transaction
  mcp.registerTool(
    'decode_transaction',
    {
      title: 'Decode Transaction',
      description: 'Decode and analyze a transaction by its hash.',
      inputSchema: {
        txHash: z.string().describe('Transaction hash (0x...)'),
      },
    },
    async ({ txHash }: { txHash: string }) => {
      try {
        const decoded = await contractTools.decodeTransaction(txHash);

        const response = {
          success: true,
          transaction: decoded,
          explorerUrl: `https://explorer.cronos.org/testnet/tx/${txHash}`,
          message: `Transaction ${txHash} decoded successfully.`,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
          structuredContent: response as unknown as Record<string, unknown>,
        };
      } catch (error: any) {
        const errorResponse = {
          success: false,
          error: error.message,
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(errorResponse, null, 2) }],
          structuredContent: errorResponse as unknown as Record<string, unknown>,
          isError: true,
        };
      }
    }
  );

  // Tool 6: Simulate Transfer (Dry Run)
  mcp.registerTool(
    'simulate_transfer',
    {
      title: 'Simulate Token Transfer (Dry Run)',
      description: 'Simulate a token transfer without executing it. Shows gas costs, balance changes, and risk assessment.',
      inputSchema: {
        tokenAddress: z.string().describe('Token contract address'),
        to: z.string().describe('Recipient address'),
        amount: z.string().describe('Amount to transfer'),
      },
    },
    async ({ tokenAddress, to, amount }: { tokenAddress: string; to: string; amount: string }) => {
      try {
        const result = await simulator.simulateTransfer(tokenAddress, to, amount);

        const response = {
          ...result,
          message: result.wouldSucceed 
            ? `✅ Simulation successful! Transaction would succeed.\n\nGas: ${result.gasEstimate} units (${result.gasCost} wei)\nRisk: ${result.riskLevel.toUpperCase()}\n\nBalance Changes:\nFrom: ${result.balanceChanges?.from.before} → ${result.balanceChanges?.from.after}\nTo: ${result.balanceChanges?.to.before} → ${result.balanceChanges?.to.after}\n\nWarnings: ${result.warnings?.join(', ') || 'None'}`
            : `❌ Simulation failed! Transaction would NOT succeed.\n\nErrors: ${result.errors?.join(', ')}`,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
          structuredContent: response as unknown as Record<string, unknown>,
        };
      } catch (error: any) {
        const errorResponse = {
          success: false,
          error: error.message,
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(errorResponse, null, 2) }],
          structuredContent: errorResponse as unknown as Record<string, unknown>,
          isError: true,
        };
      }
    }
  );

  // Tool 7: Batch Transfer
  mcp.registerTool(
    'batch_transfer',
    {
      title: 'Batch Token Transfer',
      description: 'Send tokens to multiple recipients in one operation. Optimized for airdrops and bulk payments.',
      inputSchema: {
        tokenAddress: z.string().describe('Token contract address'),
        recipients: z.array(z.string()).describe('Array of recipient addresses'),
        amounts: z.array(z.string()).describe('Array of amounts (must match recipients length)'),
      },
    },
    async ({ tokenAddress, recipients, amounts }: { tokenAddress: string; recipients: string[]; amounts: string[] }) => {
      try {
        const result = await batchBuilder.executeBatchTransfer({
          tokenAddress,
          recipients,
          amounts,
        });

        const response = {
          ...result,
          explorerUrls: result.txHash?.split(', ').map(hash => `https://explorer.cronos.org/testnet/tx/${hash}`),
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
          structuredContent: response as unknown as Record<string, unknown>,
        };
      } catch (error: any) {
        const errorResponse = {
          success: false,
          error: error.message,
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(errorResponse, null, 2) }],
          structuredContent: errorResponse as unknown as Record<string, unknown>,
          isError: true,
        };
      }
    }
  );

  // Tool 8: Estimate Batch Gas
  mcp.registerTool(
    'estimate_batch_gas',
    {
      title: 'Estimate Batch Transfer Gas',
      description: 'Estimate total gas cost for a batch transfer before executing.',
      inputSchema: {
        tokenAddress: z.string().describe('Token contract address'),
        recipients: z.array(z.string()).describe('Array of recipient addresses'),
        amounts: z.array(z.string()).describe('Array of amounts'),
      },
    },
    async ({ tokenAddress, recipients, amounts }: { tokenAddress: string; recipients: string[]; amounts: string[] }) => {
      try {
        const estimate = await batchBuilder.estimateBatchGas({
          tokenAddress,
          recipients,
          amounts,
        });

        const response = {
          success: true,
          ...estimate,
          message: `Estimated gas for ${recipients.length} transfers: ${estimate.totalGas} units, Total cost: ${estimate.totalCost} wei`,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
          structuredContent: response as unknown as Record<string, unknown>,
        };
      } catch (error: any) {
        const errorResponse = {
          success: false,
          error: error.message,
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(errorResponse, null, 2) }],
          structuredContent: errorResponse as unknown as Record<string, unknown>,
          isError: true,
        };
      }
    }
  );

  // Tool 9: Query Transaction History
  mcp.registerTool(
    'query_transactions',
    {
      title: 'Query Transaction History',
      description: 'Query and analyze transaction history for an address using natural language.',
      inputSchema: {
        address: z.string().describe('Wallet address to query'),
        minAmount: z.string().optional().describe('Minimum transaction amount filter'),
        days: z.number().optional().describe('Number of days to look back (default: 7)'),
        limit: z.number().optional().describe('Maximum number of transactions to return (default: 50)'),
      },
    },
    async ({ address, minAmount, days, limit }: { address: string; minAmount?: string; days?: number; limit?: number }) => {
      try {
        const daysBack = days || 7;
        const endTime = Math.floor(Date.now() / 1000);
        const startTime = endTime - (daysBack * 24 * 60 * 60);

        const result = await analytics.queryTransactions({
          address,
          minAmount,
          startTime,
          endTime,
          limit: limit || 50,
        });

        const response = {
          success: true,
          ...result,
          message: `Found ${result.totalTransactions} transactions in the last ${daysBack} days.\n\nTotal Sent: ${result.totalSent} wei\nTotal Received: ${result.totalReceived} wei\nAverage: ${result.averageAmount} wei\n\nMost frequent recipient: ${result.mostFrequentRecipient?.address || 'N/A'} (${result.mostFrequentRecipient?.count || 0} times)`,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
          structuredContent: response as unknown as Record<string, unknown>,
        };
      } catch (error: any) {
        const errorResponse = {
          success: false,
          error: error.message,
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(errorResponse, null, 2) }],
          structuredContent: errorResponse as unknown as Record<string, unknown>,
          isError: true,
        };
      }
    }
  );

  // Tool 10: Get Spending Summary
  mcp.registerTool(
    'get_spending_summary',
    {
      title: 'Get Spending Summary',
      description: 'Get a summary of spending for an address over a time period.',
      inputSchema: {
        address: z.string().describe('Wallet address'),
        days: z.number().optional().describe('Number of days (default: 7)'),
      },
    },
    async ({ address, days }: { address: string; days?: number }) => {
      try {
        const result = await analytics.getSpendingSummary(address, days || 7);

        const response = {
          success: true,
          ...result,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
          structuredContent: response as unknown as Record<string, unknown>,
        };
      } catch (error: any) {
        const errorResponse = {
          success: false,
          error: error.message,
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(errorResponse, null, 2) }],
          structuredContent: errorResponse as unknown as Record<string, unknown>,
          isError: true,
        };
      }
    }
  );

  console.log('✓ Registered DevTools: visualize_plan, inspect_contract, read_contract, estimate_gas, decode_transaction, simulate_transfer, batch_transfer, estimate_batch_gas, query_transactions, get_spending_summary');
}
