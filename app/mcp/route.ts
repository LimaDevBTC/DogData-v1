import { createMcpHandler } from "mcp-handler";
import { registerTools } from "@/lib/mcp/tools";
import { registerResources } from "@/lib/mcp/resources";
import { registerPrompts } from "@/lib/mcp/prompts";

/**
 * DOG DATA — Remote MCP endpoint (Streamable HTTP).
 *
 * Advertised at https://www.dogdata.xyz/mcp (ai-agent.json, llms.txt,
 * capabilities). Bridges the MCP server — tools, resources, prompts — into the
 * Next.js app so remote AI agents (Claude.ai connectors, MCP Inspector, etc.)
 * can connect. The standalone Express transport in mcp-server/ never deploys on
 * Vercel's serverless runtime, which is why the bare path used to 404.
 *
 * basePath "/" makes mcp-handler derive the streamable endpoint as "/mcp",
 * which matches this route's path exactly (url.pathname === "/mcp").
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handler = createMcpHandler(
  (server) => {
    registerTools(server);
    registerResources(server);
    registerPrompts(server);
  },
  {
    serverInfo: { name: "dogdata", version: "1.0.0" },
  },
  {
    basePath: "/",
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV !== "production",
    // SSE is deprecated in the MCP spec (2025-03-26); we only expose Streamable HTTP.
    disableSse: true,
  }
);

// CORS — allow browser-based agents to call the endpoint. Streamable HTTP
// clients send/read the Mcp-Session-Id header, so it must be allowed/exposed.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Mcp-Session-Id, mcp-session-id, Mcp-Protocol-Version, mcp-protocol-version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, mcp-session-id",
  "Access-Control-Max-Age": "86400",
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

async function handleWithCors(req: Request): Promise<Response> {
  return withCors(await handler(req));
}

export {
  handleWithCors as GET,
  handleWithCors as POST,
  handleWithCors as DELETE,
};

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
