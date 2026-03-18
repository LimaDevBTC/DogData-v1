import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fetchBitcoinNetwork } from "../utils/data-loader.js";
import { resourceResult } from "../utils/formatters.js";

export function registerNetworkResource(server: McpServer): void {
  server.resource(
    "bitcoin-network",
    "dog://bitcoin-network",
    async (uri) => {
      try {
        const data = await fetchBitcoinNetwork();
        return resourceResult(uri.href, {
          block_height: data.block_height,
          block_hash: data.block_hash,
          difficulty: data.difficulty,
          hashrate_eh_s: data.hashrate / 1e18,
          mempool: {
            transaction_count: data.mempool_size,
            virtual_size_mb: (data.mempool_bytes / 1_000_000).toFixed(2),
          },
          fee_estimates_sat_vb: data.fee_estimates,
          timestamp: data.timestamp,
        });
      } catch {
        return resourceResult(uri.href, {
          error: "Unable to fetch Bitcoin network data",
          timestamp: new Date().toISOString(),
        });
      }
    }
  );
}
