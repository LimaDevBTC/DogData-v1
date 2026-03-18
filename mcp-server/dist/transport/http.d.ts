import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
/**
 * Start the MCP server with Streamable HTTP transport.
 * Exposes the server on a configurable port for remote AI agents.
 */
export declare function startHttpTransport(server: McpServer): Promise<void>;
