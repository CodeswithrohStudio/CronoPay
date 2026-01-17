---
sidebar_position: 1
---

# ChatGPT Setup

Connect CronoPay with ChatGPT to use natural language for blockchain payments.

## Prerequisites

- CronoPay MCP server running (`npm run dev`)
- ChatGPT Plus subscription
- Access to ChatGPT's MCP configuration

## Configuration Steps

### 1. Start CronoPay Server

```bash
cd CronoPay
npm run dev
```

You should see:
```
💰 CronoPay MCP Server running on http://localhost:3000/mcp
📦 Finance tools: transferToken, getBalance, cancel_pending_transaction
🧠 AI Planning tools: create_execution_plan, check_wallet_balance, assess_transaction_risk
🛠️  DevTools: visualize_plan, inspect_contract, read_contract, estimate_gas, decode_transaction
🎯 Advanced: simulate_transfer, batch_transfer, estimate_batch_gas, query_transactions, get_spending_summary
```

### 2. Configure ChatGPT

1. Open ChatGPT Settings
2. Navigate to "Beta Features" or "MCP Servers"
3. Add a new MCP server:

```json
{
  "cronopay": {
    "url": "http://localhost:3000/mcp",
    "name": "CronoPay Payment Agent"
  }
}
```

### 3. Verify Connection

In ChatGPT, try:

```
"Check my USDC balance"
```

If connected successfully, CronoPay will respond with your wallet balance.

## Available Tools

Once connected, you have access to 16 MCP tools:

### Finance Tools
- `transferToken` - Send USDC on Cronos
- `getBalance` - Check token balance
- `cancel_pending_transaction` - Cancel stuck transactions

### AI Planning Tools
- `create_execution_plan` - Generate multi-step plans
- `check_wallet_balance` - Balance verification
- `assess_transaction_risk` - Risk analysis

### DevTools
- `visualize_plan` - Generate visual diagrams
- `inspect_contract` - Contract inspection
- `read_contract` - Read contract functions
- `estimate_gas` - Gas cost estimation
- `decode_transaction` - Transaction analysis

### Advanced Tools
- `simulate_transfer` - Dry run simulation
- `batch_transfer` - Multi-recipient transfers
- `estimate_batch_gas` - Batch gas estimation
- `query_transactions` - Transaction history
- `get_spending_summary` - Spending analytics

## Example Prompts

Try these commands in ChatGPT:

```
"Send 2 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"

"Visualize in HTML: Send 5 USDC if balance > 10"

"Simulate sending 100 USDC to 0x742d35... and show what would happen"

"Send 1 USDC to 3 addresses: 0x742d35..., 0xE20D41..., 0x123..."
```

## Troubleshooting

### Server Not Connecting

- Verify server is running on port 3000
- Check firewall settings
- Ensure `.env` file is configured correctly

### Transaction Failures

- Verify wallet has sufficient USDC balance
- Check Cronos Testnet RPC is accessible
- Ensure private key is correct in `.env`

### API Errors

- Verify OpenAI API key in `.env`
- Check API credits
- Ensure model access (gpt-4o-mini recommended)

## Next Steps

- [Explore MCP Tools](../tools/overview)
- [Try Advanced Features](../examples/advanced-features)
- [Learn About Visual Planning](../features/visual-planning)
