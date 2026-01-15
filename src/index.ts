import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerFinanceTools } from "./finance/register-finance-tools.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const mcp = new McpServer({
  name: "finance-mcp-http-server",
  version: "0.1.0",
});

registerFinanceTools(mcp);

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
  console.log(`Finance MCP server running on http://localhost:${port}/mcp`);
});
