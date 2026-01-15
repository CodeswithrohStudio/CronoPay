# Phase 2 Bug Fix: BigInt Conversion Error

## Issue
The `getBalance` tool was failing with error: **"Cannot convert a BigInt value to a number"**

## Root Cause
In `src/finance/balance-checker.ts`, the code was attempting to convert a BigInt directly to a Number:
```typescript
const balance = (Number(balanceRaw) / Math.pow(10, decimals)).toString();
```

This fails because ethers.js v6 returns BigInt values for large numbers, and JavaScript cannot safely convert very large BigInts to Numbers.

## Fix Applied
Changed to use ethers.js `formatUnits` utility:
```typescript
import { formatUnits } from "ethers";

const balance = formatUnits(balanceRaw, decimals);
```

Also ensured `decimals` is converted to Number:
```typescript
decimals: Number(decimals)
```

## Testing Required
After restarting the MCP server (`npm run dev`), run:
```bash
npm run test:mcp
```

Expected output:
```
✓ getBalance result: {
  "balance": "123.456",
  "balanceRaw": "123456000",
  "decimals": 6,
  "symbol": "USDC",
  ...
}
```

## Next Steps
1. **Restart MCP server** to load the fixed code
2. Run `npm run test:mcp` to verify fix
3. Run `npm run sentinel` to test full CLI flow
4. Confirm balance checks work in conditional transfers

---

**Status**: Fix applied, awaiting server restart for testing
