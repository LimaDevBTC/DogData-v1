/**
 * Formatting helpers for MCP tool/resource responses.
 */

/** Standard MCP tool text response */
export function toolResult(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/** Standard MCP resource response */
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

/** Format large numbers with commas */
export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/** Format DOG amounts (divide by 100_000 when stored as sats-like) */
export function formatDog(amount: number): string {
  return amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** Format USD amounts */
export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
}

/** Format percentage */
export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

/** Truncate address for display */
export function truncateAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}
