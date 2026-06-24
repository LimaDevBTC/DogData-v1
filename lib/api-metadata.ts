/**
 * Single source of truth for advertised API/MCP counts.
 *
 * The endpoint count is derived from the OpenAPI contract (openapi.json) so it
 * can never drift from reality again — previously /api said 40, /api/status
 * said 35, and the spec actually documents a different number. Consume these
 * constants everywhere instead of hardcoding.
 */
import openapiSpec from "@/openapi.json";

const paths = (openapiSpec as { paths?: Record<string, unknown> }).paths ?? {};

/** Number of documented REST endpoints (OpenAPI paths). */
export const API_ENDPOINT_COUNT = Object.keys(paths).length;

/**
 * MCP surface exposed at /mcp (see lib/mcp/tools.ts, resources.ts, prompts.ts).
 * Kept as explicit constants because the MCP server registers via side-effect
 * calls rather than a countable registry.
 */
export const MCP_TOOL_COUNT = 17;
export const MCP_RESOURCE_COUNT = 8;
export const MCP_PROMPT_COUNT = 4;
