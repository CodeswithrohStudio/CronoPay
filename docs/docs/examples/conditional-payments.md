---
sidebar_position: 2
---

# Conditional Payments

Execute payments based on conditions like balance checks or market prices.

## Balance-Based Conditions

### Send if Balance Above Threshold

```
"Send 5 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb if balance > 10 USDC"
```

**How it works:**
1. CronoPay checks your wallet balance
2. If balance > 10 USDC, executes the transfer
3. If balance ≤ 10 USDC, skips the transfer

**Execution Plan:**
```json
{
  "steps": [
    {
      "action": "Check wallet balance",
      "toolName": "check_wallet_balance",
      "riskLevel": "low"
    },
    {
      "action": "Transfer 5 USDC",
      "toolName": "transferToken",
      "riskLevel": "medium",
      "conditions": [
        {
          "type": "balance",
          "operator": ">",
          "value": "10"
        }
      ]
    }
  ]
}
```

### Send Only if Sufficient Balance

```
"Transfer 20 USDC only if I have more than 50 USDC"
```

Ensures you maintain a minimum balance after the transfer.

## Market-Based Conditions

### Price-Based Execution

Requires Crypto.com Market Data MCP integration:

```
"Send 1 USDC to 0x742d35... if CRO is above $0.10"
```

**How it works:**
1. CronoPay queries Crypto.com Market Data MCP
2. Gets current CRO price
3. If price > $0.10, executes the transfer
4. If price ≤ $0.10, skips the transfer

### Multi-Condition Logic

Combine multiple conditions:

```
"Transfer 2 USDC if CRO > $0.10 and my balance > 5 USDC"
```

**Execution Plan:**
```json
{
  "steps": [
    {
      "action": "Check CRO price",
      "conditions": [
        {
          "type": "price",
          "symbol": "CRO",
          "operator": ">",
          "value": "0.10"
        }
      ]
    },
    {
      "action": "Check wallet balance",
      "conditions": [
        {
          "type": "balance",
          "operator": ">",
          "value": "5"
        }
      ]
    },
    {
      "action": "Transfer 2 USDC",
      "riskLevel": "medium"
    }
  ]
}
```

## Risk Assessment

CronoPay automatically assesses risk for conditional payments:

### Low Risk
- Small amounts (< 10 USDC)
- Balance well above threshold
- Stable market conditions

### Medium Risk
- Moderate amounts (10-100 USDC)
- Balance near threshold
- Normal market volatility

### High Risk
- Large amounts (> 100 USDC)
- Balance close to minimum
- High market volatility

## Visualize Before Executing

Always visualize complex conditional logic:

```
"Visualize in HTML: Send 5 USDC if balance > 10 and CRO > $0.10"
```

This generates a visual flow diagram showing:
- All conditions
- Execution paths (pass/fail)
- Risk assessment
- Expected outcomes

## Best Practices

### 1. Start Simple

Begin with single conditions:
```
"Send 1 USDC if balance > 5"
```

Then progress to multi-condition logic.

### 2. Use Simulation

Test conditional logic with the simulator:
```
"Simulate sending 10 USDC if balance > 20"
```

### 3. Monitor Market Conditions

For price-based conditions, check current prices first:
```
"What's the current price of CRO?"
"Send 1 USDC if CRO > $0.10"
```

### 4. Set Reasonable Thresholds

Avoid edge cases:
- ❌ "Send if balance > 0.01" (too low)
- ✅ "Send if balance > 10" (reasonable buffer)

## Common Patterns

### Safety Buffer

```
"Send 5 USDC only if I have more than 20 USDC"
```

Maintains 4x buffer for safety.

### Price Opportunity

```
"Send 10 USDC if CRO is below $0.08"
```

Execute when price is favorable.

### Combined Safety

```
"Send 2 USDC if balance > 10 and CRO > $0.10"
```

Both balance and market conditions must be met.

## Next Steps

- [Advanced Features](./advanced-features)
- [Visual Planning](../features/visual-planning)
