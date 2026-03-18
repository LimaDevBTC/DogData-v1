import { fetchBitcoinNetwork } from "../utils/data-loader.js";
import { toolResult } from "../utils/formatters.js";
export function registerBitcoinTools(server) {
    // -----------------------------------------------------------------------
    // get_bitcoin_network — from mempool.space API
    // -----------------------------------------------------------------------
    server.tool("get_bitcoin_network", "Get current Bitcoin network status from mempool.space. " +
        "Returns block height, hash, difficulty, hashrate, mempool size, " +
        "and fee estimates (fastest, half-hour, hour, economy, minimum).", {}, async () => {
        try {
            const data = await fetchBitcoinNetwork();
            return toolResult({
                block_height: data.block_height,
                block_hash: data.block_hash,
                difficulty: data.difficulty,
                hashrate_eh_s: data.hashrate / 1e18,
                mempool: {
                    transaction_count: data.mempool_size,
                    virtual_size_bytes: data.mempool_bytes,
                    virtual_size_mb: (data.mempool_bytes / 1_000_000).toFixed(2),
                },
                fee_estimates_sat_vb: data.fee_estimates,
                timestamp: data.timestamp,
            });
        }
        catch (err) {
            return toolResult({
                error: "Failed to fetch Bitcoin network status",
                message: err instanceof Error ? err.message : String(err),
            });
        }
    });
}
//# sourceMappingURL=bitcoin.js.map