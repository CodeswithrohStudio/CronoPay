import { SentinelAgent } from './sentinel-agent.js';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

function displayPlan(plan: any): void {
  console.log('\n' + '='.repeat(60));
  console.log('📋 EXECUTION PLAN');
  console.log('='.repeat(60));
  console.log(`\n🎯 Intent: ${plan.intent}`);
  console.log(`📝 Normalized: ${plan.normalizedIntent}`);
  console.log(`⚠️  Risk Level: ${plan.overallRiskLevel.toUpperCase()}`);
  console.log(`⏱️  Estimated Duration: ${plan.metadata.estimatedDuration}`);
  if (plan.estimatedTotalGas) {
    console.log(`⛽ Estimated Gas: ${plan.estimatedTotalGas} TCRO`);
  }
  
  console.log(`\n📊 Steps (${plan.steps.length}):`);
  plan.steps.forEach((step: any, index: number) => {
    console.log(`\n  ${index + 1}. ${step.action}`);
    console.log(`     Tool: ${step.toolName}`);
    console.log(`     Risk: ${step.riskLevel}`);
    console.log(`     Description: ${step.description}`);
    
    if (step.conditions && step.conditions.length > 0) {
      console.log(`     Conditions:`);
      step.conditions.forEach((cond: any) => {
        console.log(`       - ${cond.description}`);
      });
    }
    
    console.log(`     Parameters:`, JSON.stringify(step.parameters, null, 2).split('\n').map((line, i) => i === 0 ? line : `       ${line}`).join('\n'));
  });
  
  console.log('\n' + '='.repeat(60));
}

function displayExecutionResult(result: any): void {
  console.log('\n' + '='.repeat(60));
  console.log('✅ EXECUTION RESULT');
  console.log('='.repeat(60));
  
  result.steps.forEach((step: any, index: number) => {
    const statusIcons: Record<string, string> = {
      completed: '✓',
      failed: '✗',
      skipped: '⊘',
      pending: '○',
      in_progress: '◐'
    };
    const statusIcon = statusIcons[step.status] || '?';
    
    console.log(`\n  ${statusIcon} Step ${index + 1}: ${step.action}`);
    console.log(`     Status: ${step.status.toUpperCase()}`);
    
    if (step.status === 'completed' && step.result) {
      const resultData = typeof step.result === 'string' 
        ? JSON.parse(step.result) 
        : step.result;
      
      if (resultData.txHash) {
        console.log(`     Transaction: ${resultData.txHash}`);
        console.log(`     Explorer: https://explorer.cronos.org/testnet/tx/${resultData.txHash}`);
      }
    }
    
    if (step.error) {
      console.log(`     Error: ${step.error}`);
    }
  });
  
  console.log('\n' + '='.repeat(60));
}

async function runCLI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: OPENAI_API_KEY not found in environment variables');
    console.log('Please create a .env file with: OPENAI_API_KEY=your-api-key');
    process.exit(1);
  }

  const agent = new SentinelAgent({
    apiKey,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  });

  try {
    await agent.initialize();

    const tools = agent.getAvailableTools();
    console.log('\n✨ Available Finance Tools:');
    tools.forEach(tool => {
      console.log(`  • ${tool.name}: ${tool.description || 'No description'}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('🛡️  SENTINEL - Agentic Finance Assistant');
    console.log('='.repeat(60));
    console.log('\n💡 Example commands:');
    console.log('  • "Send 1 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"');
    console.log('  • "Transfer 5 USDC to 0xYourAddress"');
    console.log('\n📝 Type "exit" to quit\n');

    while (true) {
      const userInput = await question('💬 Your request > ');

      if (userInput.toLowerCase() === 'exit') {
        break;
      }

      if (!userInput.trim()) {
        continue;
      }

      try {
        const { plan, validation } = await agent.createExecutionPlan(userInput);
        
        displayPlan(plan);

        if (validation.warnings.length > 0) {
          console.log('\n⚠️  WARNINGS:');
          validation.warnings.forEach(w => console.log(`   • ${w}`));
        }

        const approval = await question('\n❓ Execute this plan? (yes/no) > ');
        
        if (approval.toLowerCase() !== 'yes' && approval.toLowerCase() !== 'y') {
          console.log('❌ Execution cancelled by user');
          continue;
        }

        const result = await agent.executePlan(plan);
        displayExecutionResult(result);

      } catch (error: any) {
        console.error('\n❌ Error:', error?.message || String(error));
      }
    }

    console.log('\n👋 Shutting down Sentinel...');
    await agent.cleanup();
  } catch (error) {
    console.error('Fatal error:', error);
    await agent.cleanup();
    process.exit(1);
  }

  rl.close();
  process.exit(0);
}

runCLI().catch(console.error);
