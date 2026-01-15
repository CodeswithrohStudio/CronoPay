import { PlanGenerator } from './plan-generator.js';
import { PlanValidator } from './plan-validator.js';
import { PlanningOrchestrator } from './planning-orchestrator.js';
import { MCPTool } from '../mcp-client.js';
import dotenv from 'dotenv';

dotenv.config();

const mockTools: MCPTool[] = [
  {
    name: 'transferToken',
    description: 'Transfers USDC tokens on Cronos Testnet',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient address' },
        amount: { type: 'string', description: 'Amount to transfer' }
      },
      required: ['to', 'amount']
    }
  }
];

async function testPlanGeneration() {
  console.log('🧪 Test 1: Plan Generation');
  console.log('='.repeat(60));

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found');
  }

  const generator = new PlanGenerator({
    apiKey,
    model: 'gpt-4o-mini'
  });

  const intent = 'Send 5 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
  
  console.log(`\nIntent: "${intent}"\n`);
  
  const plan = await generator.generatePlan(intent, mockTools);
  
  console.log('✓ Plan generated successfully');
  console.log(`  Plan ID: ${plan.id}`);
  console.log(`  Normalized Intent: ${plan.normalizedIntent}`);
  console.log(`  Steps: ${plan.steps.length}`);
  console.log(`  Risk Level: ${plan.overallRiskLevel}`);
  
  plan.steps.forEach((step, index) => {
    console.log(`\n  Step ${index + 1}:`);
    console.log(`    Action: ${step.action}`);
    console.log(`    Tool: ${step.toolName}`);
    console.log(`    Risk: ${step.riskLevel}`);
    console.log(`    Conditions: ${step.conditions?.length || 0}`);
  });

  return plan;
}

async function testPlanValidation(plan: any) {
  console.log('\n\n🧪 Test 2: Plan Validation');
  console.log('='.repeat(60));

  const validator = new PlanValidator(mockTools);
  const result = validator.validate(plan);

  console.log(`\nValidation Result: ${result.valid ? '✓ VALID' : '✗ INVALID'}`);
  
  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach(err => console.log(`  ✗ ${err}`));
  }
  
  if (result.warnings.length > 0) {
    console.log('\nWarnings:');
    result.warnings.forEach(warn => console.log(`  ⚠ ${warn}`));
  }

  return result;
}

async function testPlanningOrchestrator() {
  console.log('\n\n🧪 Test 3: Planning Orchestrator');
  console.log('='.repeat(60));

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found');
  }

  const orchestrator = new PlanningOrchestrator({
    apiKey,
    model: 'gpt-4o-mini'
  });

  const intent = 'Transfer 10 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
  
  console.log(`\nIntent: "${intent}"\n`);
  
  const { plan, validation } = await orchestrator.createPlan(intent, mockTools);
  
  console.log('✓ Plan created and validated through orchestrator');
  console.log(`  Valid: ${validation.valid}`);
  console.log(`  Warnings: ${validation.warnings.length}`);
  console.log(`  Steps: ${plan.steps.length}`);

  return { plan, validation };
}

async function testInvalidPlan() {
  console.log('\n\n🧪 Test 4: Invalid Plan Detection');
  console.log('='.repeat(60));

  const validator = new PlanValidator(mockTools);
  
  const invalidPlan: any = {
    id: 'test-invalid',
    intent: 'Test',
    normalizedIntent: 'Test',
    steps: [
      {
        id: 'step-1',
        action: 'Invalid action',
        toolName: 'nonExistentTool',
        parameters: {},
        riskLevel: 'low',
        description: 'Test',
        status: 'pending'
      }
    ],
    overallRiskLevel: 'low',
    createdAt: new Date().toISOString(),
    metadata: {
      requiresApproval: true,
      canRollback: false
    }
  };

  const result = validator.validate(invalidPlan);
  
  console.log(`\nValidation Result: ${result.valid ? '✓ VALID' : '✗ INVALID (Expected)'}`);
  
  if (result.errors.length > 0) {
    console.log('\nErrors detected (as expected):');
    result.errors.forEach(err => console.log(`  ✗ ${err}`));
  }
}

async function runAllTests() {
  console.log('\n🚀 Starting Planning Layer Tests\n');
  
  try {
    const plan = await testPlanGeneration();
    await testPlanValidation(plan);
    await testPlanningOrchestrator();
    await testInvalidPlan();
    
    console.log('\n\n✅ All tests completed successfully!');
    console.log('='.repeat(60));
    
  } catch (error: any) {
    console.error('\n\n❌ Test failed:', error?.message || String(error));
    console.error(error);
    process.exit(1);
  }
}

runAllTests();
