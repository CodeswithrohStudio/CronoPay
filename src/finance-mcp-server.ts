import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import { registerFinanceTools } from "./finance/register-finance-tools.js";

dotenv.config();

const mcp = new McpServer({
  name: "finance-tools-server",
  version: "0.1.0",
});

registerFinanceTools(mcp);

async function main() {
  const transport = new StdioServerTransport();
  await mcp.connect(transport);
  console.log("Finance MCP server running...");
}

main().catch((error) => {
  console.error("Finance MCP server error:", error);
  process.exit(1);
});
