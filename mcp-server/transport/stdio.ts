import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Start the MCP server with STDIO transport.
 * Used by Claude Desktop, Claude Code, and other local MCP clients.
 *
 * IMPORTANT: Never use console.log in STDIO mode as it corrupts the JSON-RPC stream.
 * Use console.error for any logging.
 */
export async function startStdioTransport(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[dogdata-mcp] Server started on STDIO transport");
}
