/**
 * Formatting helpers for MCP tool/resource responses.
 * Ported from the standalone mcp-server package so the remote /mcp endpoint
 * returns byte-for-byte the same envelope shape that stdio clients receive.
 */

/** DOG total supply (100 billion). */
export const DOG_TOTAL_SUPPLY = 100_000_000_000;

/** Standard MCP tool text response. */
export function toolResult(data: unknown): {
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/** Standard MCP resource response. */
export function resourceResult(
  uri: string,
  data: unknown
): { contents: Array<{ uri: string; mimeType: string; text: string }> } {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

/** Normalize an unknown error into a short message string. */
export function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
