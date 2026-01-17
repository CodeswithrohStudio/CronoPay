import { ExecutionPlan, ExecutionStep } from '../planning/types.js';
import { PlanExplanation } from '../explainability/types.js';

export class TransactionVisualizer {
  generateMermaidDiagram(plan: ExecutionPlan, explanation?: PlanExplanation): string {
    let diagram = 'graph TD\n';
    diagram += '    Start([User Intent]) --> Plan\n';
    diagram += `    Plan[📋 Plan: ${plan.steps.length} steps]\n`;
    
    plan.steps.forEach((step, index) => {
      const stepId = `Step${index + 1}`;
      const nextStepId = index < plan.steps.length - 1 ? `Step${index + 2}` : 'End';
      
      // Step node with emoji based on action
      const emoji = this.getStepEmoji(step.toolName);
      diagram += `    Plan --> ${stepId}[${emoji} ${step.action}]\n`;
      
      // Add conditions if present
      if (step.conditions && step.conditions.length > 0) {
        const condId = `Cond${index + 1}`;
        diagram += `    ${stepId} --> ${condId}{Conditions Met?}\n`;
        diagram += `    ${condId} -->|Yes| ${nextStepId}\n`;
        diagram += `    ${condId} -->|No| Skip${index + 1}[⏭️ Skip]\n`;
        diagram += `    Skip${index + 1} --> ${nextStepId}\n`;
      } else {
        diagram += `    ${stepId} --> ${nextStepId}\n`;
      }
    });
    
    diagram += '    End([✅ Complete])\n';
    
    // Add styling
    diagram += '\n    classDef riskHigh fill:#ff6b6b,stroke:#c92a2a,color:#fff\n';
    diagram += '    classDef riskMedium fill:#ffd93d,stroke:#f59f00,color:#000\n';
    diagram += '    classDef riskLow fill:#51cf66,stroke:#2f9e44,color:#fff\n';
    
    // Apply risk styling
    plan.steps.forEach((step, index) => {
      if (step.riskLevel === 'high' || step.riskLevel === 'critical') {
        diagram += `    class Step${index + 1} riskHigh\n`;
      } else if (step.riskLevel === 'medium') {
        diagram += `    class Step${index + 1} riskMedium\n`;
      } else {
        diagram += `    class Step${index + 1} riskLow\n`;
      }
    });
    
    return diagram;
  }

  generateASCIIFlow(plan: ExecutionPlan): string {
    let flow = '\n';
    flow += '╔═══════════════════════════════════════════════════════════════╗\n';
    flow += '║                    EXECUTION FLOW                             ║\n';
    flow += '╚═══════════════════════════════════════════════════════════════╝\n\n';
    
    flow += '    📝 User Intent\n';
    flow += '         ↓\n';
    flow += `    📋 Plan Generated (${plan.steps.length} steps, Risk: ${plan.overallRiskLevel.toUpperCase()})\n`;
    flow += '         ↓\n';
    
    plan.steps.forEach((step, index) => {
      const emoji = this.getStepEmoji(step.toolName);
      const riskEmoji = this.getRiskEmoji(step.riskLevel);
      
      flow += `    ${emoji} Step ${index + 1}: ${step.action} ${riskEmoji}\n`;
      
      if (step.conditions && step.conditions.length > 0) {
        flow += '         ├─ 🔍 Check Conditions\n';
        step.conditions.forEach(cond => {
          flow += `         │  └─ ${cond.description || cond.type}\n`;
        });
        flow += '         ├─ ✓ Pass → Continue\n';
        flow += '         └─ ✗ Fail → Skip\n';
      }
      
      if (index < plan.steps.length - 1) {
        flow += '         ↓\n';
      }
    });
    
    flow += '         ↓\n';
    flow += '    ✅ Execution Complete\n\n';
    
    return flow;
  }

  generateHTMLVisualization(plan: ExecutionPlan, explanation?: PlanExplanation): string {
    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CronoPay Execution Plan</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 { 
            color: #667eea;
            margin-bottom: 10px;
            font-size: 2.5em;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 1.1em;
        }
        .plan-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .plan-header h2 { margin-bottom: 10px; }
        .risk-badge {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
            margin-left: 10px;
        }
        .risk-low { background: #51cf66; color: white; }
        .risk-medium { background: #ffd93d; color: #000; }
        .risk-high { background: #ff6b6b; color: white; }
        .risk-critical { background: #c92a2a; color: white; }
        .timeline {
            position: relative;
            padding-left: 50px;
        }
        .timeline::before {
            content: '';
            position: absolute;
            left: 20px;
            top: 0;
            bottom: 0;
            width: 4px;
            background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
        }
        .step {
            position: relative;
            margin-bottom: 30px;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            border-left: 4px solid #667eea;
        }
        .step::before {
            content: '';
            position: absolute;
            left: -38px;
            top: 20px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: white;
            border: 4px solid #667eea;
        }
        .step-header {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        }
        .step-number {
            font-size: 2em;
            margin-right: 15px;
        }
        .step-title {
            font-size: 1.3em;
            font-weight: bold;
            color: #333;
        }
        .step-details {
            margin-left: 60px;
            color: #666;
        }
        .conditions {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 10px;
            margin-top: 10px;
            border-radius: 5px;
        }
        .conditions-title {
            font-weight: bold;
            color: #856404;
            margin-bottom: 5px;
        }
        .condition-item {
            padding: 5px 0;
            color: #856404;
        }
        .explanation {
            background: #e7f5ff;
            border-left: 4px solid #339af0;
            padding: 15px;
            margin-top: 30px;
            border-radius: 5px;
        }
        .explanation h3 {
            color: #1971c2;
            margin-bottom: 10px;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            color: #999;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>💰 CronoPay</h1>
        <div class="subtitle">AI-Powered Payment Agent for Cronos</div>
        
        <div class="plan-header">
            <h2>📋 Execution Plan</h2>
            <p><strong>Intent:</strong> ${plan.intent}</p>
            <p><strong>Steps:</strong> ${plan.steps.length} | <strong>Risk:</strong> 
                <span class="risk-badge risk-${plan.overallRiskLevel}">${plan.overallRiskLevel.toUpperCase()}</span>
            </p>
        </div>
        
        <div class="timeline">
`;

    plan.steps.forEach((step, index) => {
      const emoji = this.getStepEmoji(step.toolName);
      html += `
            <div class="step">
                <div class="step-header">
                    <div class="step-number">${emoji}</div>
                    <div class="step-title">Step ${index + 1}: ${step.action}</div>
                    <span class="risk-badge risk-${step.riskLevel}">${step.riskLevel.toUpperCase()}</span>
                </div>
                <div class="step-details">
                    <p><strong>Tool:</strong> ${step.toolName}</p>
`;

      if (step.conditions && step.conditions.length > 0) {
        html += `
                    <div class="conditions">
                        <div class="conditions-title">🔒 Conditions (must pass to execute):</div>
`;
        step.conditions.forEach(cond => {
          html += `                        <div class="condition-item">• ${cond.description || cond.type}</div>\n`;
        });
        html += `                    </div>\n`;
      }

      html += `
                </div>
            </div>
`;
    });

    html += `
        </div>
`;

    if (explanation) {
      html += `
        <div class="explanation">
            <h3>🤔 Why This Plan?</h3>
            <p>${explanation.reasoning.whyThisPlan}</p>
            <h3 style="margin-top: 15px;">⚠️ Risk Assessment</h3>
            <p>${explanation.reasoning.riskAssessment}</p>
        </div>
`;
    }

    html += `
        <div class="footer">
            Generated by CronoPay • Powered by AI • Built for Cronos
        </div>
    </div>
</body>
</html>
`;

    return html;
  }

  private getStepEmoji(toolName: string): string {
    const emojiMap: Record<string, string> = {
      getBalance: '💰',
      transferToken: '💸',
      check_wallet_balance: '🔍',
      create_execution_plan: '📋',
      assess_transaction_risk: '⚠️',
      cancel_pending_transaction: '🛑',
    };
    return emojiMap[toolName] || '⚙️';
  }

  private getRiskEmoji(riskLevel: string): string {
    const riskMap: Record<string, string> = {
      low: '🟢',
      medium: '🟡',
      high: '🔴',
      critical: '🚨',
    };
    return riskMap[riskLevel] || '⚪';
  }

  saveVisualization(html: string, filename: string): void {
    // In a real implementation, this would save to file
    console.log(`Visualization saved to ${filename}`);
  }
}
