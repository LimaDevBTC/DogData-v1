import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  loadHolders,
  loadHoldersWithUtxoStats,
  DOG_TOTAL_SUPPLY,
} from "../utils/data-loader.js";
import { toolResult } from "../utils/formatters.js";

export function registerMetricsTools(server: McpServer): void {
  // -----------------------------------------------------------------------
  // get_onchain_metrics — computed from JSON data files
  // -----------------------------------------------------------------------
  server.tool(
    "get_onchain_metrics",
    "Get on-chain metrics for DOG token including total holders, total UTXOs, " +
      "concentration metrics, UTXO age distribution, supply distribution, and MVRV ratio.",
    {},
    async () => {
      const [holders, holdersWithStats] = await Promise.all([
        loadHolders(),
        loadHoldersWithUtxoStats(),
      ]);

      // Concentration metrics from top holders
      const top10 = holders.holders.slice(0, 10);
      const top50 = holders.holders.slice(0, 50);
      const top100 = holders.holders.slice(0, 100);

      const top10Supply = top10.reduce((s, h) => s + h.total_dog, 0);
      const top50Supply = top50.reduce((s, h) => s + h.total_dog, 0);
      const top100Supply = top100.reduce((s, h) => s + h.total_dog, 0);

      const utxoStats = holdersWithStats.utxo_age_stats;

      return toolResult({
        timestamp: holders.timestamp,
        total_holders: holders.total_holders,
        total_utxos: holders.total_utxos,
        total_supply: DOG_TOTAL_SUPPLY,
        concentration: {
          top_10_holders_dog: top10Supply,
          top_10_percentage: (top10Supply / DOG_TOTAL_SUPPLY) * 100,
          top_50_holders_dog: top50Supply,
          top_50_percentage: (top50Supply / DOG_TOTAL_SUPPLY) * 100,
          top_100_holders_dog: top100Supply,
          top_100_percentage: (top100Supply / DOG_TOTAL_SUPPLY) * 100,
        },
        utxo_age_stats: utxoStats
          ? {
              avg_age_days: utxoStats.avg_age_days,
              median_age_days: utxoStats.median_age_days,
              sth_percentage: utxoStats.sth_percentage,
              lth_percentage: utxoStats.lth_percentage,
              age_distribution: utxoStats.age_distribution,
              size_distribution: utxoStats.size_distribution,
              realized_cap: utxoStats.realized_cap,
              market_cap: utxoStats.market_cap,
              mvrv_ratio: utxoStats.mvrv_ratio,
            }
          : null,
      });
    }
  );

  // -----------------------------------------------------------------------
  // get_metrics_history — placeholder for Supabase time-series
  // -----------------------------------------------------------------------
  server.tool(
    "get_metrics_history",
    "Get historical metrics for DOG token over time. " +
      "Returns time-series data for holders, UTXOs, and price from Supabase.",
    {
      metric: z
        .enum(["holders", "utxos", "price", "volume"])
        .describe("Which metric to retrieve history for"),
      days: z
        .number()
        .int()
        .min(1)
        .max(365)
        .default(30)
        .describe("Number of days of history to return"),
    },
    async ({ metric, days }) => {
      // Supabase integration placeholder — returns structure info
      return toolResult({
        metric,
        days,
        note: "Historical metrics data available via Supabase integration. " +
          "This endpoint returns time-series data stored in the dog_metrics table.",
        schema: {
          table: "dog_metrics",
          columns: [
            "id",
            "timestamp",
            "total_holders",
            "total_utxos",
            "price_usd",
            "volume_24h",
            "market_cap",
          ],
          query_example: `SELECT timestamp, ${metric} FROM dog_metrics WHERE timestamp > NOW() - INTERVAL '${days} days' ORDER BY timestamp ASC`,
        },
        data: [],
      });
    }
  );
}
