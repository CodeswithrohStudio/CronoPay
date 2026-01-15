# Phase 1: Execution Planning Layer

## Overview
The Execution Planning Layer provides deterministic, structured planning for finance operations. It separates **intent understanding** from **execution**, ensuring transparency and safety.

## Architecture

### Components

#### 1. **Types** (`src/planning/types.ts`)
- `ExecutionPlan`: Complete plan structure with metadata
- `ExecutionStep`: Individual action with conditions and risk assessment
- `Condition`: Pre-execution validation rules
- `RiskLevel`: LOW | MEDIUM | HIGH | CRITICAL
- `StepStatus`: PENDING | IN_PROGRESS | COMPLETED | FAILED | SKIPPED

#### 2. **Plan Generator** (`src/planning/plan-generator.ts`)
- Converts natural language intent → structured JSON plan
- Uses GPT-4o-mini for intent parsing
- Generates step-by-step action lists
- Assigns risk levels per step
- Identifies conditional logic requirements

#### 3. **Plan Validator** (`src/planning/plan-validator.ts`)
- Schema validation (structure, types, required fields)
- Tool availability checks
- Parameter validation
- Risk level consistency
- Sanity checks (e.g., balance checks before transfers)

#### 4. **Planning Orchestrator** (`src/planning/planning-orchestrator.ts`)
- Coordinates plan generation and validation
- Single entry point for planning operations
- Ensures plans are validated before execution

#### 5. **Sentinel Agent** (`src/sentinel-agent.ts`)
- Main agent with planning/execution separation
- `createExecutionPlan()`: Generate plan only
- `executePlan()`: Execute pre-approved plan
- `processIntent()`: Combined flow for convenience
- Enforces failure short-circuiting for high-risk steps

## Key Features

### ✅ Intent Normalization
User input → Clear, unambiguous statement of what will happen

### ✅ Step-by-Step Breakdown
Complex operations decomposed into discrete, sequential actions

### ✅ Risk Assessment
Every step and overall plan assigned risk levels:
- **LOW**: Read-only operations
- **MEDIUM**: Transfers < 10 USDC
- **HIGH**: Transfers ≥ 10 USDC
- **CRITICAL**: Transfers > 100 USDC

### ✅ Conditional Logic
Pre-execution conditions (e.g., balance checks) defined in plan

### ✅ Plan Validation
- Schema compliance
- Tool existence verification
- Parameter validation
- Sanity checks

### ✅ Execution Separation
Plans are generated, validated, and approved **before** execution

## Usage

### CLI Interface
```bash
npm run sentinel
```

### Programmatic Usage
```typescript
import { SentinelAgent } from './sentinel-agent.js';

const agent = new SentinelAgent({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o-mini'
});

await agent.initialize();

// Generate plan
const { plan, validation } = await agent.createExecutionPlan(
  'Send 5 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
);

// Review plan...

// Execute plan
const result = await agent.executePlan(plan);
```

## Example Plan Structure

```json
{
  "id": "uuid-v4",
  "intent": "Send 5 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "normalizedIntent": "Transfer 5 USDC tokens to address 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb on Cronos Testnet",
  "steps": [
    {
      "id": "uuid-step-1",
      "action": "Check wallet balance",
      "toolName": "getBalance",
      "parameters": {},
      "conditions": [],
      "riskLevel": "low",
      "description": "Verify sufficient USDC balance before transfer",
      "status": "pending"
    },
    {
      "id": "uuid-step-2",
      "action": "Transfer 5 USDC",
      "toolName": "transferToken",
      "parameters": {
        "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        "amount": "5"
      },
      "conditions": [
        {
          "type": "balance_check",
          "field": "balance",
          "operator": "gte",
          "value": "5",
          "description": "Ensure balance >= 5 USDC"
        }
      ],
      "riskLevel": "medium",
      "description": "Execute USDC transfer to recipient",
      "estimatedGas": "0.001",
      "status": "pending"
    }
  ],
  "overallRiskLevel": "medium",
  "estimatedTotalGas": "0.001",
  "createdAt": "2026-01-15T11:28:00.000Z",
  "metadata": {
    "requiresApproval": true,
    "canRollback": false,
    "estimatedDuration": "~6s"
  }
}
```

## Testing

### Unit Tests
```bash
npm run test:planning
```

Tests cover:
- Plan generation from natural language
- Plan validation (valid and invalid cases)
- Orchestrator integration
- Error detection

### Integration Test
```bash
# Start MCP server
npm run dev

# In another terminal, run Sentinel CLI
npm run sentinel
```

## Safety Features

1. **No Auto-Execution**: Plans must be explicitly approved
2. **Failure Short-Circuiting**: High-risk step failures abort remaining steps
3. **Condition Evaluation**: Pre-execution checks prevent invalid operations
4. **Risk Transparency**: Every action's risk level is explicit
5. **Validation Gates**: Invalid plans cannot be executed

## Next Steps (Phase 2)

- [ ] Implement balance check tool
- [ ] Add multi-step execution engine with state management
- [ ] Implement conditional execution rules
- [ ] Add rollback/recovery mechanisms
- [ ] Enhance condition evaluation system
