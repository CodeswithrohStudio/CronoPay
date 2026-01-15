# Phase 1 Testing Guide

## Quick Start

### Prerequisites
```bash
# Ensure .env file has:
OPENAI_API_KEY=your-key
CRONOS_PRIVATE_KEY=your-key
CRONOS_USDC_TOKEN_ADDRESS=0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0
MCP_SERVER_URL=http://localhost:3000/mcp
```

### Test 1: Unit Tests (No MCP Server Required)
```bash
npm run test:planning
```

**Expected Output:**
- ✅ Plan generation from natural language
- ✅ Plan validation (valid plans pass)
- ✅ Invalid plan detection (errors caught)
- ✅ Orchestrator integration

### Test 2: Full Integration (Requires MCP Server)

**Terminal 1 - Start MCP Server:**
```bash
npm run dev
```

**Terminal 2 - Run Sentinel CLI:**
```bash
npm run sentinel
```

## Test Scenarios

### Scenario 1: Simple Transfer
```
💬 Your request > Send 1 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

**Verify:**
- Plan shows 2 steps (balance check + transfer)
- Risk level: MEDIUM
- Conditions include balance check
- Approval prompt appears
- After approval, execution proceeds

### Scenario 2: Large Transfer (High Risk)
```
💬 Your request > Transfer 50 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

**Verify:**
- Risk level: HIGH
- Warning about large transfer
- Approval required
- If step fails, execution aborts

### Scenario 3: Plan Rejection
```
💬 Your request > Send 1 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
❓ Execute this plan? (yes/no) > no
```

**Verify:**
- Plan displayed but not executed
- "Execution cancelled by user" message

## What to Look For

### ✅ Plan Generation
- [ ] Intent correctly normalized
- [ ] Steps are sequential and logical
- [ ] Each step maps to a tool
- [ ] Risk levels are appropriate
- [ ] Conditions are included for transfers

### ✅ Validation
- [ ] Invalid addresses rejected
- [ ] Invalid amounts rejected
- [ ] Unknown tools rejected
- [ ] Warnings for large transfers

### ✅ Execution
- [ ] Steps execute in order
- [ ] Status updates shown per step
- [ ] Conditions evaluated before execution
- [ ] Transaction hashes displayed
- [ ] Explorer links provided

### ✅ Safety
- [ ] Plans require approval
- [ ] High-risk failures abort execution
- [ ] Clear error messages
- [ ] No autonomous decision-making

## Expected Output Format

### Plan Display
```
============================================================
📋 EXECUTION PLAN
============================================================

🎯 Intent: Send 1 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
📝 Normalized: Transfer 1 USDC token to address 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb on Cronos Testnet
⚠️  Risk Level: MEDIUM
⏱️  Estimated Duration: ~6s
⛽ Estimated Gas: 0.001 TCRO

📊 Steps (2):

  1. Check wallet balance
     Tool: getBalance
     Risk: low
     Description: Verify sufficient USDC balance before transfer
     Conditions:
       - Ensure balance >= 1 USDC
     Parameters: {...}

  2. Transfer 1 USDC
     Tool: transferToken
     Risk: medium
     Description: Execute USDC transfer to recipient
     Parameters: {...}

============================================================
```

### Execution Display
```
⚙️  Executing plan...
Plan ID: d7bef661-6524-487a-ab5b-7830d0f511e8
Steps: 2
Risk Level: MEDIUM

[Step 1/2] Check wallet balance
  ↳ Checking 1 condition(s)...
  ✓ Conditions satisfied
  ↳ Executing tool: getBalance
  ✓ Step completed

[Step 2/2] Transfer 1 USDC
  ↳ Executing tool: transferToken
  ✓ Step completed

📊 Execution Summary:
   Completed: 2/2
```

## Troubleshooting

### Issue: "OPENAI_API_KEY not found"
**Solution:** Create/update `.env` file with your OpenAI API key

### Issue: "Cannot connect to MCP server"
**Solution:** Ensure `npm run dev` is running in another terminal

### Issue: "CRONOS_PRIVATE_KEY not found"
**Solution:** Add your Cronos testnet private key to `.env`

### Issue: Plan validation fails
**Solution:** Check that:
- Recipient address starts with "0x"
- Amount is a positive number
- Tool names match available tools

## Success Criteria

Phase 1 is working correctly if:

1. ✅ Plans are generated from natural language
2. ✅ Plans are validated before execution
3. ✅ Invalid plans are rejected with clear errors
4. ✅ Plans require user approval
5. ✅ Execution follows the plan exactly
6. ✅ Conditions are evaluated
7. ✅ High-risk failures abort execution
8. ✅ Transaction hashes are displayed

## Next Phase Preview

After confirming Phase 1 works:
- **Phase 2**: Real balance checks, multi-step logic, conditional execution
- **Phase 3**: Explainability and reason traces
- **Phase 4**: MCP-native design (expose as MCP server)

---

**Ready to test?** Run `npm run test:planning` first, then try the CLI!
