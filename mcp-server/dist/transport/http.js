import express from "express";
import { randomUUID } from "crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
const PORT = parseInt(process.env.MCP_HTTP_PORT ?? "3002", 10);
/**
 * Start the MCP server with Streamable HTTP transport.
 * Exposes the server on a configurable port for remote AI agents.
 */
export async function startHttpTransport(server) {
    const app = express();
    app.use(express.json());
    // Map of session ID -> transport
    const transports = new Map();
    // POST /mcp — main JSON-RPC endpoint
    app.post("/mcp", async (req, res) => {
        const sessionId = req.headers["mcp-session-id"];
        let transport;
        if (sessionId && transports.has(sessionId)) {
            transport = transports.get(sessionId);
        }
        else if (!sessionId && isInitializeRequest(req.body)) {
            // New session — create transport with session ID generator
            transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (id) => {
                    transports.set(id, transport);
                    console.error(`[dogdata-mcp] HTTP session initialized: ${id}`);
                },
            });
            transport.onclose = () => {
                const sid = transport.sessionId;
                if (sid) {
                    transports.delete(sid);
                    console.error(`[dogdata-mcp] HTTP session closed: ${sid}`);
                }
            };
            await server.connect(transport);
        }
        else {
            res.status(400).json({
                jsonrpc: "2.0",
                error: { code: -32000, message: "Bad Request: No valid session" },
                id: null,
            });
            return;
        }
        await transport.handleRequest(req, res, req.body);
    });
    // GET /mcp — SSE stream for server-to-client notifications
    app.get("/mcp", async (req, res) => {
        const sessionId = req.headers["mcp-session-id"];
        if (!sessionId || !transports.has(sessionId)) {
            res.status(400).json({
                jsonrpc: "2.0",
                error: { code: -32000, message: "Bad Request: No valid session" },
                id: null,
            });
            return;
        }
        const transport = transports.get(sessionId);
        await transport.handleRequest(req, res);
    });
    // DELETE /mcp — close session
    app.delete("/mcp", async (req, res) => {
        const sessionId = req.headers["mcp-session-id"];
        if (sessionId && transports.has(sessionId)) {
            const transport = transports.get(sessionId);
            await transport.handleRequest(req, res);
            transports.delete(sessionId);
        }
        else {
            res.status(400).json({
                jsonrpc: "2.0",
                error: { code: -32000, message: "Bad Request: No valid session" },
                id: null,
            });
        }
    });
    // Health check
    app.get("/health", (_req, res) => {
        res.json({
            status: "ok",
            server: "dogdata-mcp",
            version: "1.0.0",
            sessions: transports.size,
            timestamp: new Date().toISOString(),
        });
    });
    app.listen(PORT, () => {
        console.error(`[dogdata-mcp] HTTP server listening on port ${PORT}`);
        console.error(`[dogdata-mcp] Endpoint: http://localhost:${PORT}/mcp`);
        console.error(`[dogdata-mcp] Health:   http://localhost:${PORT}/health`);
    });
}
//# sourceMappingURL=http.js.map