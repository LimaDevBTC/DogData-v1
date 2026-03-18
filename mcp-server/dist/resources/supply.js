import { loadHoldersWithUtxoStats, DOG_TOTAL_SUPPLY } from "../utils/data-loader.js";
import { resourceResult } from "../utils/formatters.js";
export function registerSupplyResource(server) {
    server.resource("supply-info", "dog://supply-info", async (uri) => {
        const data = await loadHoldersWithUtxoStats();
        const stats = data.utxo_age_stats;
        return resourceResult(uri.href, {
            token: "DOG•GO•TO•THE•MOON",
            total_supply: DOG_TOTAL_SUPPLY,
            total_supply_formatted: "100,000,000,000 DOG",
            decimals: 5,
            rune_id: "DOG•GO•TO•THE•MOON",
            distribution: {
                total_holders: data.total_holders,
                total_utxos: data.total_utxos,
                size_distribution: stats?.size_distribution ?? null,
            },
            holding_period: stats
                ? {
                    short_term_holder_supply_pct: stats.sth_percentage,
                    long_term_holder_supply_pct: stats.lth_percentage,
                    avg_age_days: stats.avg_age_days,
                    median_age_days: stats.median_age_days,
                }
                : null,
            valuation: stats
                ? {
                    realized_cap_usd: stats.realized_cap,
                    market_cap_usd: stats.market_cap,
                    mvrv_ratio: stats.mvrv_ratio,
                }
                : null,
            data_timestamp: data.timestamp,
        });
    });
}
//# sourceMappingURL=supply.js.map