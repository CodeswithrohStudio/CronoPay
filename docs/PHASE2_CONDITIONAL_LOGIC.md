# Phase 2: Conditional & Multi-Step Logic Engine

## Overview
Phase 2 implements real balance checking, conditional execution rules, and robust multi-step state management. This enables the agent to make informed decisions based on on-chain data.

## New Components

### 1. **Balance Checker** (`src/finance/balance-checker.ts`)
- Real-time ERC20 balance queries on Cronos Testnet
- Returns human-readable and raw balance values
- Supports any ERC20 token (defaults to agent's wallet)
- Retrieves token metadata (symbol, decimals)

**Features:**
- ✅ On-chain balance verification
- ✅ Automatic wallet address resolution
- ✅ Token metadata retrieval
- ✅ Error handling for invalid addresses

### 2. **Condition Evaluator** (`src/execution/condition-evaluator.ts`)
- Evaluates pre-execution conditions
- Supports balance checks and custom conditions
- Compares values using operators (gt, lt, eq, gte, lte, neq)
- Returns detailed evaluation results with reasons

**Condition Types:**
- **balance_check**: Verifies on-chain token balance meets requirements
- **custom**: Evaluates conditions against execution state

**Operators:**
```typescript
enum ConditionOperator {
  GREATER_THAN = "gt",
  LESS_THAN = "lt",
  EQUAL = "eq",
  NOT_EQUAL = "neq",
  GREATER_THAN_OR_EQUAL = "gte",
  LESS_THAN_OR_EQUAL = "lte"
}
```

### 3. **Execution Engine** (`src/execution/execution-engine.ts`)
- Orchestrates multi-step plan execution
- Evaluates conditions before each step
- Maintains execution state across steps
- Implements failure short-circuiting
- Provides detailed execution summaries

**Key Features:**
- ✅ Sequential step execution
- ✅ Pre-step condition evaluation
- ✅ Execution state management
- ✅ Automatic step status tracking
- ✅ Failure handling with abort logic
- ✅ Verbose logging (configurable)

### 4. **MCP Tool: getBalance**
New tool registered in MCP server for balance queries.

**Input:**
```typescript
{
  tokenAddress: string,      // ERC20 token contract address
  walletAddress?: string      // Optional, defaults to agent's wallet
}
```

**Output:**
```typescript
{
  balance: string,            // Human-readable (e.g., "10.5")
  balanceRaw: string,         // Raw value (e.g., "10500000")
  decimals: number,           // Token decimals
  symbol: string,             // Token symbol (e.g., "USDC")
  tokenAddress: string,       // Token contract address
  walletAddress: string       // Wallet address checked
}
```

## Architecture

### Execution Flow

```
User Intent
    ↓
Plan Generator (with getBalance awareness)
    ↓
Plan Validator
    ↓
[USER APPROVAL]
    ↓
Execution Engine
    ↓
For each step:
    1. Update status → IN_PROGRESS
    2. Evaluate conditions
       ├─ balance_check → Query on-chain balance
       └─ custom → Check execution state
    3. If conditions fail:
       ├─ Mark step as SKIPPED
       └─ Abort if high-risk step
    4. If conditions pass:
       ├─ Execute tool via MCP
       ├─ Update execution state
       └─ Mark step as COMPLETED
    5. If execution fails:
       ├─ Mark step as FAILED
       └─ Abort if high-risk step
    ↓
Execution Summary
```

### Execution State Management

The execution engine maintains a state map that tracks:
- `step_{id}_result`: Result of each step
- `step_{id}_status`: Status of each step
- `current_balance`: Latest balance from getBalance
- `balance_symbol`: Token symbol
- `last_tx_hash`: Most recent transaction hash
- `last_transfer_amount`: Most recent transfer amount

This state is accessible to condition evaluators for complex multi-step logic.

## Example Scenarios

### Scenario 1: Simple Balance Check
```
User: "Check my USDC balance"

Plan:
  Step 1: getBalance
    - Tool: getBalance
    - Parameters: { tokenAddress: "0x..." }
    - Risk: LOW
    - Conditions: []

Execution:
  ✓ Step 1 completed
  Balance: 100.5 USDC
```

### Scenario 2: Conditional Transfer
```
User: "Send 5 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"

Plan:
  Step 1: Check current USDC balance
    - Tool: getBalance
    - Risk: LOW
    - Conditions: []
  
  Step 2: Transfer 5 USDC
    - Tool: transferToken
    - Risk: MEDIUM
    - Conditions:
      * balance_check: balance >= 5 USDC

Execution:
  ✓ Step 1: Balance = 100 USDC
  ✓ Step 2: Condition met (100 >= 5)
  ✓ Transfer executed: 0xabc123...
```

### Scenario 3: Insufficient Balance (Condition Fails)
```
User: "Send 1000 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"

Plan:
  Step 1: Check balance
  Step 2: Transfer 1000 USDC
    - Conditions: balance >= 1000 USDC

Execution:
  ✓ Step 1: Balance = 50 USDC
  ✗ Step 2: Condition failed (50 < 1000)
  ⊘ Step skipped - Insufficient balance
  ⚠️  Execution aborted (high-risk step failed conditions)
```

## Safety Features

### 1. **Real Balance Verification**
- On-chain queries prevent transfers exceeding available balance
- No reliance on cached or estimated values

### 2. **Conditional Execution**
- Steps only execute if all conditions are met
- Failed conditions skip steps safely

### 3. **Failure Short-Circuiting**
- High-risk step failures abort remaining execution
- Prevents cascading failures

### 4. **Execution State Isolation**
- Each execution maintains independent state
- State can be cleared between runs

### 5. **Detailed Logging**
- Every condition evaluation logged with reason
- Step results captured for debugging

## API Changes

### SentinelAgent

**New Methods:**
```typescript
getExecutionState(): Map<string, any>
clearExecutionState(): void
```

**Updated Methods:**
```typescript
executePlan(plan: ExecutionPlan): Promise<ExecutionResult>
// Now returns ExecutionResult instead of ExecutionPlan

processIntent(userIntent: string): Promise<{
  plan: ExecutionPlan;
  result: ExecutionResult;
}>
```

**ExecutionResult Structure:**
```typescript
{
  plan: ExecutionPlan,              // Executed plan with updated statuses
  executionState: Map<string, any>, // State accumulated during execution
  summary: {
    totalSteps: number,
    completed: number,
    failed: number,
    skipped: number,
    aborted: boolean
  }
}
```

## Testing

### Unit Tests
```bash
npm run test:execution
```

**Tests:**
1. Balance check tool functionality
2. Conditional transfer planning
3. Multi-step execution with state management
4. Condition evaluation (insufficient balance)

### Integration Test
```bash
# Terminal 1: Start MCP server
npm run dev

# Terminal 2: Run Sentinel CLI
npm run sentinel

# Try:
> Check my USDC balance
> Send 0.1 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

## Configuration

Ensure `.env` has:
```bash
CRONOS_USDC_TOKEN_ADDRESS=0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0
CRONOS_RPC_URL=https://evm-t3.cronos.org
CRONOS_PRIVATE_KEY=your-private-key
```

## Improvements Over Phase 1

| Feature | Phase 1 | Phase 2 |
|---------|---------|---------|
| Balance Checks | Mock (always true) | Real on-chain queries |
| Condition Evaluation | Placeholder | Full evaluation with operators |
| Execution State | None | Persistent across steps |
| Multi-Step Logic | Basic sequential | State-aware with dependencies |
| Failure Handling | Simple abort | Conditional abort based on risk |
| Tool Coverage | transferToken only | + getBalance |

## Next Steps (Phase 3)

- [ ] Explainability layer (human-readable reasoning)
- [ ] Plan → execution mapping display
- [ ] Decision explanation generation
- [ ] Non-CoT reasoning summaries

---

**Status**: ✅ Phase 2 Complete - Ready for Testing
