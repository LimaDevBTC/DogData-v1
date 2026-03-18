import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
/**
 * Start the MCP server with STDIO transport.
 * Used by Claude Desktop, Claude Code, and other local MCP clients.
 *
 * IMPORTANT: Never use console.log in STDIO mode as it corrupts the JSON-RPC stream.
 * Use console.error for any logging.
 */
export declare function startStdioTransport(server: McpServer): Promise<void>;
