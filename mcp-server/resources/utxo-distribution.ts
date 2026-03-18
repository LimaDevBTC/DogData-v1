import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadHoldersWithUtxoStats } from "../utils/data-loader.js";
import { resourceResult } from "../utils/formatters.js";

export function registerUtxoDistributionResource(server: McpServer): void {
  server.resource(
    "utxo-distribution",
    "dog://utxo-distribution",
    async (uri) => {
      const data = await loadHoldersWithUtxoStats();
      const stats = data.utxo_age_stats;

      if (!stats) {
        return resourceResult(uri.href, {
          error: "UTXO age stats not available in current data",
          timestamp: data.timestamp,
        });
      }

      return resourceResult(uri.href, {
        total_utxos: stats.total_utxos,
        total_supply_sats: stats.total_supply,
        age_distribution: stats.age_distribution,
        size_distribution: stats.size_distribution,
        avg_age_days: stats.avg_age_days,
        median_age_days: stats.median_age_days,
        short_term_holders: {
          supply_sats: stats.sth_supply,
          percentage: stats.sth_percentage,
        },
        long_term_holders: {
          supply_sats: stats.lth_supply,
          percentage: stats.lth_percentage,
        },
        profit_loss: {
          supply_in_profit: stats.supply_in_profit,
          supply_in_loss: stats.supply_in_loss,
        },
        data_timestamp: data.timestamp,
      });
    }
  );
}
