import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerFinanceTools } from "./finance/register-finance-tools.js";
import { registerCronoPayTools } from "./cronopay/register-cronopay-tools.js";
import { registerDevTools } from "./devtools/register-devtools.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const mcp = new McpServer({
  name: "cronopay-mcp-server",
  version: "1.0.0",
});

registerFinanceTools(mcp);
registerCronoPayTools(mcp);
registerDevTools(mcp);

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => transport.close());

  await mcp.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/", (_req, res) => res.send("ok"));

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`💰 CronoPay MCP Server running on http://localhost:${port}/mcp`);
  console.log(`📦 Finance tools: transferToken, getBalance, cancel_pending_transaction`);
  console.log(`🧠 AI Planning tools: create_execution_plan, check_wallet_balance, assess_transaction_risk`);
  console.log(`🛠️  DevTools: visualize_plan, inspect_contract, read_contract, estimate_gas, decode_transaction`);
  console.log(`🎯 Advanced: simulate_transfer, batch_transfer, estimate_batch_gas, query_transactions, get_spending_summary`);
});