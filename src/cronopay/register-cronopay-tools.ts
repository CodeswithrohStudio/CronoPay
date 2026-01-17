import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PlanningOrchestrator } from '../planning/index.js';
import { ExecutionEngine } from '../execution/index.js';
import { MCPClient } from '../mcp-client.js';
import { ExecutionPlan, RiskLevel } from '../planning/types.js';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY!;
const mcpClient = new MCPClient();
let planningOrchestrator: PlanningOrchestrator;
let executionEngine: ExecutionEngine;
let initialized = false;

async function ensureInitialized() {
  if (!initialized) {
    await mcpClient.connect();
    const tools = await mcpClient.listTools();
    planningOrchestrator = new PlanningOrchestrator({ apiKey });
    planningOrchestrator.initializeValidator(tools);
    executionEngine = new ExecutionEngine(mcpClient);
    initialized = true;
  }
}

export function registerCronoPayTools(server: McpServer): void {
  server.registerTool(
    'create_execution_plan',
    {
      title: 'Create Execution Plan',
      description: 'Generate an AI-powered execution plan for a payment intent. Analyzes the request, identifies required steps, evaluates risks, and creates conditional logic.',
      inputSchema: {
        intent: z.string().describe('Natural language description of what the user wants to do (e.g., "Send 5 USDC to 0x123... if balance is above 10 USDC")'),
      },
    },
    async ({ intent }) => {
      try {
        await ensureInitialized();
        const result = await planningOrchestrator.createPlan(intent, await mcpClient.listTools());
        const plan = result.plan;
        
        const response = {
          success: true,
          plan: {
            id: plan.id,
            intent: plan.intent,
            normalizedIntent: plan.normalizedIntent,
            steps: plan.steps.map((step: any) => ({
              id: step.id,
              action: step.action,
              toolName: step.toolName,
              parameters: step.parameters,
              riskLevel: step.riskLevel,
              conditions: step.conditions,
            })),
            overallRiskLevel: plan.overallRiskLevel,
            createdAt: plan.createdAt,
          },
          message: `Execution plan created with ${plan.steps.length} steps. Risk level: ${plan.overallRiskLevel}. Ready for approval.`,
        };
        
        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
          structuredContent: response as unknown as Record<string, unknown>,
        };
      } catch (error: any) {
        const errorResponse = {
          success: false,
          error: error.message,
          message: 'Failed to create execution plan',
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(errorResponse, null, 2) }],
          structuredContent: errorResponse as unknown as Record<string, unknown>,
          isError: true,
        };
      }
    }
  );

  // TODO: Fix type compatibility issues with ExecutionResult
  /*
  server.registerTool(
    'execute_plan',
    {
      title: 'Execute Plan',
      description: 'Execute a previously created execution plan. Runs each step sequentially, evaluates conditions, manages state, and handles failures.',
      inputSchema: {
        planId: z.string().describe('The ID of the execution plan to execute'),
        plan: z.object({
        id: z.string(),
        intent: z.string(),
        normalizedIntent: z.string(),
        steps: z.array(z.object({
          id: z.string(),
          action: z.string(),
          toolName: z.string(),
          parameters: z.record(z.any()),
          riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
          conditions: z.array(z.object({
            type: z.string(),
            field: z.string(),
            operator: z.string(),
            value: z.any(),
            description: z.string().optional(),
            symbol: z.string().optional(),
          })).optional(),
          estimatedDuration: z.string().optional(),
        })),
        overallRiskLevel: z.enum(['low', 'medium', 'high', 'critical']),
        estimatedGas: z.string().optional(),
        estimatedDuration: z.string().optional(),
        createdAt: z.number(),
      }).describe('The complete execution plan object'),
      },
    },
    async ({ planId, plan }) => {
      try {
        await ensureInitialized();
        
        const executionPlan: ExecutionPlan = {
          ...plan,
          overallRiskLevel: plan.overallRiskLevel as RiskLevel,
          steps: plan.steps.map(step => ({
            ...step,
            riskLevel: step.riskLevel as RiskLevel,
            description: step.action,
            status: 'pending' as const,
          })),
        };

        const result = await executionEngine.execute(executionPlan);
        
        const completedSteps = result.steps.filter(s => s.status === 'completed').length;
        const failedSteps = result.steps.filter(s => s.status === 'failed').length;
        const totalSteps = result.steps.length;
        const allSuccess = failedSteps === 0;
        
        const response = {
          success: allSuccess,
          planId: result.plan.id,
          completedSteps,
          failedSteps,
          totalSteps,
          stepResults: result.steps.map(step => ({
            stepId: step.id,
            status: step.status,
            result: step.result,
            error: step.error,
          })),
          message: allSuccess 
            ? `Plan executed successfully. ${completedSteps}/${totalSteps} steps completed.`
            : `Plan execution failed. ${completedSteps}/${totalSteps} steps completed, ${failedSteps} failed.`,
        };
        
        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
          structuredContent: response as unknown as Record<string, unknown>,
        };
      } catch (error: any) {
        const errorResponse = {
          success: false,
          error: error.message,
          message: 'Failed to execute plan',
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(errorResponse, null, 2) }],
          structuredContent: errorResponse as unknown as Record<string, unknown>,
          isError: true,
        };
      }
    }
  );
  */

  server.registerTool(
    'check_wallet_balance',
    {
      title: 'Check Wallet Balance',
      description: 'Check the balance of an ERC20 token in a wallet on Cronos Testnet.',
      inputSchema: {
        tokenAddress: z.string().describe('The ERC20 token contract address (e.g., USDC: 0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0)'),
        walletAddress: z.string().optional().describe('The wallet address to check'),
      },
    },
    async ({ tokenAddress, walletAddress }) => {
      try {
        await ensureInitialized();
        const result = await mcpClient.callTool('getBalance', {
          tokenAddress,
          walletAddress,
        });
        
        const response = {
          success: true,
          balance: result.balance,
          tokenAddress,
          walletAddress: result.walletAddress,
          message: `Balance: ${result.balance}`,
        };
        
        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
          structuredContent: response as unknown as Record<string, unknown>,
        };
      } catch (error: any) {
        const errorResponse = {
          success: false,
          error: error.message,
          message: 'Failed to check balance',
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(errorResponse, null, 2) }],
          structuredContent: errorResponse as unknown as Record<string, unknown>,
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'assess_transaction_risk',
    {
      title: 'Assess Transaction Risk',
      description: 'Analyze a transaction intent and assess its risk level. Returns risk assessment with explanation.',
      inputSchema: {
        intent: z.string().describe('Description of the transaction (e.g., "Send 50 USDC to 0x123...")'),
        amount: z.string().optional().describe('Transaction amount'),
        recipient: z.string().optional().describe('Recipient address'),
      },
    },
    async ({ intent }) => {
      try {
        await ensureInitialized();
        const result = await planningOrchestrator.createPlan(intent, await mcpClient.listTools());
        const plan = result.plan;
        
        const riskFactors = [];
        
        if (plan.overallRiskLevel === 'critical') {
          riskFactors.push('Very large transaction amount');
        } else if (plan.overallRiskLevel === 'high') {
          riskFactors.push('Large transaction amount or complex operation');
        }
        
        const hasConditions = plan.steps.some(s => s.conditions && s.conditions.length > 0);
        if (hasConditions) {
          riskFactors.push('Conditional execution reduces risk');
        }
        
        const response = {
          success: true,
          riskLevel: plan.overallRiskLevel,
          riskFactors,
          requiresApproval: ['high', 'critical'].includes(plan.overallRiskLevel),
          message: `Risk assessment: ${plan.overallRiskLevel.toUpperCase()}. ${riskFactors.join('. ')}.`,
        };
        
        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
          structuredContent: response as unknown as Record<string, unknown>,
        };
      } catch (error: any) {
        const errorResponse = {
          success: false,
          error: error.message,
          message: 'Failed to assess risk',
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(errorResponse, null, 2) }],
          structuredContent: errorResponse as unknown as Record<string, unknown>,
          isError: true,
        };
      }
    }
  );

  console.log('✓ Registered CronoPay AI tools: create_execution_plan, check_wallet_balance, assess_transaction_risk');
}
