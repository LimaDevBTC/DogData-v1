import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadHolders, loadForensicData, DOG_TOTAL_SUPPLY } from "../utils/data-loader.js";
import { resourceResult } from "../utils/formatters.js";

export function registerStatsResource(server: McpServer): void {
  server.resource(
    "stats",
    "dog://stats",
    async (uri) => {
      const [holders, forensic] = await Promise.all([
        loadHolders(),
        loadForensicData().catch(() => null),
      ]);

      const top10Dog = holders.holders
        .slice(0, 10)
        .reduce((s, h) => s + h.total_dog, 0);

      return resourceResult(uri.href, {
        name: "DOG•GO•TO•THE•MOON",
        type: "Rune",
        total_supply: DOG_TOTAL_SUPPLY,
        total_holders: holders.total_holders,
        total_utxos: holders.total_utxos,
        top_10_concentration_percent: (top10Dog / DOG_TOTAL_SUPPLY) * 100,
        forensic_summary: forensic
          ? {
              total_airdrop_recipients_analyzed: forensic.statistics.total_analyzed,
              still_holding: forensic.statistics.still_holding,
              sold_everything: forensic.statistics.sold_everything,
              retention_rate: forensic.statistics.retention_rate,
              diamond_hands: forensic.statistics.diamond_hands,
            }
          : null,
        data_timestamp: holders.timestamp,
      });
    }
  );
}
