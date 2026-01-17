---
sidebar_position: 1
---

# Basic Payments

Learn how to use CronoPay for basic token transfers on Cronos.

## Simple Transfer

Send USDC to a recipient:

```
"Send 2 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
```

**What happens:**
1. CronoPay validates the recipient address
2. Checks your wallet balance
3. Executes the transfer on Cronos Testnet
4. Returns transaction hash and explorer link

**Response:**
```json
{
  "success": true,
  "txHash": "0x123...",
  "amount": "2",
  "status": "pending",
  "explorerUrl": "https://explorer.cronos.org/testnet/tx/0x123..."
}
```

## Check Balance

Before sending, check your balance:

```
"Check my USDC balance"
```

**Response:**
```json
{
  "balance": "15.5",
  "symbol": "devUSDC.e",
  "decimals": 6,
  "walletAddress": "0xYourAddress"
}
```

## Multiple Transfers

Send to different recipients:

```
"Send 1 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
"Send 2 USDC to 0xE20D41E77bF1d2121E4bc50411e4523300b72B9a"
```

Each transfer gets its own transaction hash.

## Best Practices

### 1. Always Check Balance First

```
"Check my USDC balance"
"Send 5 USDC to 0x742d35..."
```

### 2. Verify Recipient Address

Double-check addresses before sending. CronoPay validates format but cannot verify ownership.

### 3. Start Small

Test with small amounts first:

```
"Send 0.1 USDC to 0x742d35..."
```

### 4. Monitor Transactions

Use the explorer link to track transaction status:

```
https://explorer.cronos.org/testnet/tx/YOUR_TX_HASH
```

## Common Issues

### Insufficient Balance

**Error:** "Insufficient balance"

**Solution:** Check your balance and ensure you have enough USDC + gas fees

### Invalid Address

**Error:** "Invalid recipient address"

**Solution:** Verify the address format (must start with 0x and be 42 characters)

### Transaction Pending

**Issue:** Transaction stuck in mempool

**Solution:** Use the cancel tool:
```
"Cancel my pending transaction"
```

## Next Steps

- [Conditional Payments](./conditional-payments)
- [Advanced Features](./advanced-features)
