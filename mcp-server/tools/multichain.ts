import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { toolResult } from "../utils/formatters.js";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.dogdata.xyz");

async function fetchJson<T>(path: string): Promise<T> {
  const resp = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  return resp.json() as Promise<T>;
}

export function registerMultichainTools(server: McpServer): void {
  // -----------------------------------------------------------------------
  // get_multichain_holders — holders on Stacks and/or Solana
  // -----------------------------------------------------------------------
  server.tool(
    "get_multichain_holders",
    "Get top DOG token holders on Stacks and/or Solana blockchains. " +
      "Stacks data comes from Tenero API, Solana from Helius RPC. " +
      "Includes balances, USD values, holder stats, and concentration percentages.",
    {
      chain: z
        .enum(["stacks", "solana"])
        .optional()
        .describe("Filter by chain. Omit for both chains."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(20)
        .describe("Number of top holders to return (max 50)"),
    },
    async ({ chain, limit }) => {
      try {
        const params = new URLSearchParams();
        if (chain) params.set("chain", chain);
        params.set("limit", String(limit));
        const data = await fetchJson(`/api/multichain/holders?${params}`);
        return toolResult(data);
      } catch (err) {
        return toolResult({
          error: "Failed to fetch multichain holders",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  );

  // -----------------------------------------------------------------------
  // get_multichain_transactions — transactions on Stacks and/or Solana
  // -----------------------------------------------------------------------
  server.tool(
    "get_multichain_transactions",
    "Get recent DOG token transactions (transfers and swaps) on Stacks and/or Solana. " +
      "Stacks data from Tenero, Solana from Helius Enhanced API. " +
      "Gracefully degrades if one chain is unavailable.",
    {
      chain: z
        .enum(["stacks", "solana"])
        .optional()
        .describe("Filter by chain. Omit for both chains."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(30)
        .describe("Number of transactions to return (max 50)"),
    },
    async ({ chain, limit }) => {
      try {
        const params = new URLSearchParams();
        if (chain) params.set("chain", chain);
        params.set("limit", String(limit));
        const data = await fetchJson(`/api/multichain/transactions?${params}`);
        return toolResult(data);
      } catch (err) {
        return toolResult({
          error: "Failed to fetch multichain transactions",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  );

  // -----------------------------------------------------------------------
  // get_multichain_stats — aggregated stats across chains
  // -----------------------------------------------------------------------
  server.tool(
    "get_multichain_stats",
    "Get aggregated DOG token statistics across Stacks and Solana — " +
      "total holders, combined market cap, 24h volume, and per-chain breakdowns. " +
      "Uses Tenero (Stacks) and Birdeye (Solana) as data sources.",
    {},
    async () => {
      try {
        const data = await fetchJson("/api/multichain/stats");
        return toolResult(data);
      } catch (err) {
        return toolResult({
          error: "Failed to fetch multichain stats",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  );
}
