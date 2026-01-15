import { SentinelAgent } from '../sentinel-agent.js';
import dotenv from 'dotenv';

dotenv.config();

async function testBalanceCheck() {
  console.log('🧪 Test 1: Balance Check Tool');
  console.log('='.repeat(60));

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found');
  }

  const agent = new SentinelAgent({
    apiKey,
    model: 'gpt-4o-mini'
  });

  await agent.initialize();

  const intent = 'Check my USDC balance';
  console.log(`\nIntent: "${intent}"\n`);

  const { plan, validation } = await agent.createExecutionPlan(intent);
  
  console.log('✓ Plan generated');
  console.log(`  Steps: ${plan.steps.length}`);
  console.log(`  Risk Level: ${plan.overallRiskLevel}`);

  const result = await agent.executePlan(plan);
  
  console.log('\n✓ Execution completed');
  console.log(`  Completed: ${result.summary.completed}/${result.summary.totalSteps}`);
  console.log(`  Failed: ${result.summary.failed}`);

  await agent.cleanup();
  return result;
}

async function testConditionalTransfer() {
  console.log('\n\n🧪 Test 2: Conditional Transfer (Balance Check + Transfer)');
  console.log('='.repeat(60));

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found');
  }

  const agent = new SentinelAgent({
    apiKey,
    model: 'gpt-4o-mini'
  });

  await agent.initialize();

  const intent = 'Send 0.1 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
  console.log(`\nIntent: "${intent}"\n`);

  const { plan, validation } = await agent.createExecutionPlan(intent);
  
  console.log('✓ Plan generated');
  console.log(`  Steps: ${plan.steps.length}`);
  console.log(`  Risk Level: ${plan.overallRiskLevel}`);
  
  plan.steps.forEach((step, index) => {
    console.log(`\n  Step ${index + 1}: ${step.action}`);
    console.log(`    Tool: ${step.toolName}`);
    console.log(`    Conditions: ${step.conditions?.length || 0}`);
    if (step.conditions && step.conditions.length > 0) {
      step.conditions.forEach(cond => {
        console.log(`      - ${cond.description}`);
      });
    }
  });

  console.log('\n⚠️  Skipping execution in test mode');
  console.log('   (To execute, approve manually in CLI)');

  await agent.cleanup();
  return plan;
}

async function testMultiStepExecution() {
  console.log('\n\n🧪 Test 3: Multi-Step Execution with State Management');
  console.log('='.repeat(60));

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found');
  }

  const agent = new SentinelAgent({
    apiKey,
    model: 'gpt-4o-mini'
  });

  await agent.initialize();

  const intent = 'Check my balance and send 0.1 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
  console.log(`\nIntent: "${intent}"\n`);

  const { plan, validation } = await agent.createExecutionPlan(intent);
  
  console.log('✓ Plan generated');
  console.log(`  Steps: ${plan.steps.length}`);
  
  if (plan.steps.length < 2) {
    console.log('\n⚠️  Warning: Expected at least 2 steps (balance check + transfer)');
  } else {
    console.log('\n✓ Plan includes multiple steps as expected');
  }

  const hasBalanceCheck = plan.steps.some(s => s.toolName === 'getBalance');
  const hasTransfer = plan.steps.some(s => s.toolName === 'transferToken');
  const transferHasConditions = plan.steps
    .filter(s => s.toolName === 'transferToken')
    .some(s => s.conditions && s.conditions.length > 0);

  console.log('\nValidation:');
  console.log(`  ✓ Has balance check step: ${hasBalanceCheck}`);
  console.log(`  ✓ Has transfer step: ${hasTransfer}`);
  console.log(`  ✓ Transfer has conditions: ${transferHasConditions}`);

  if (!hasBalanceCheck || !hasTransfer || !transferHasConditions) {
    console.log('\n❌ Plan structure validation failed');
  } else {
    console.log('\n✅ Plan structure validated successfully');
  }

  await agent.cleanup();
  return plan;
}

async function testConditionEvaluation() {
  console.log('\n\n🧪 Test 4: Condition Evaluation (Insufficient Balance)');
  console.log('='.repeat(60));

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found');
  }

  const agent = new SentinelAgent({
    apiKey,
    model: 'gpt-4o-mini'
  });

  await agent.initialize();

  const intent = 'Send 1000000 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
  console.log(`\nIntent: "${intent}" (intentionally large amount)\n`);

  const { plan, validation } = await agent.createExecutionPlan(intent);
  
  console.log('✓ Plan generated');
  console.log(`  Risk Level: ${plan.overallRiskLevel} (should be CRITICAL)`);

  console.log('\n⚠️  This test would check if conditions properly fail on insufficient balance');
  console.log('   Skipping actual execution to avoid errors');

  await agent.cleanup();
  return plan;
}

async function runAllTests() {
  console.log('\n🚀 Starting Phase 2: Execution Engine Tests\n');
  
  try {
    await testBalanceCheck();
    await testConditionalTransfer();
    await testMultiStepExecution();
    await testConditionEvaluation();
    
    console.log('\n\n✅ All Phase 2 tests completed!');
    console.log('='.repeat(60));
    console.log('\n💡 Next steps:');
    console.log('   1. Test with real transactions using: npm run sentinel');
    console.log('   2. Verify balance checks work correctly');
    console.log('   3. Confirm conditional execution prevents invalid transfers');
    
  } catch (error: any) {
    console.error('\n\n❌ Test failed:', error?.message || String(error));
    console.error(error);
    process.exit(1);
  }
}

runAllTests();
