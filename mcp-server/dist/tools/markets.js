import { fetchCoinGeckoData, fetchKrakenPrice } from "../utils/data-loader.js";
import { toolResult } from "../utils/formatters.js";
export function registerMarketTools(server) {
    // -----------------------------------------------------------------------
    // get_market_data — aggregated from CoinGecko + Kraken
    // -----------------------------------------------------------------------
    server.tool("get_market_data", "Get comprehensive market data for DOG token aggregated from CoinGecko and Kraken. " +
        "Includes market cap, volume, price changes (24h/7d/30d), ATH/ATL, supply, " +
        "and fully diluted valuation.", {}, async () => {
        try {
            const [geckoData, krakenPrice] = await Promise.all([
                fetchCoinGeckoData(),
                fetchKrakenPrice().catch(() => null),
            ]);
            return toolResult({
                price: {
                    current_usd: krakenPrice?.price ?? 0,
                    source: krakenPrice ? "Kraken" : "unavailable",
                    bid: krakenPrice?.bid ?? 0,
                    ask: krakenPrice?.ask ?? 0,
                },
                market: {
                    market_cap_usd: geckoData.market_cap,
                    market_cap_rank: geckoData.market_cap_rank,
                    fully_diluted_valuation_usd: geckoData.fully_diluted_valuation,
                    total_volume_24h_usd: geckoData.total_volume,
                },
                changes: {
                    price_change_24h_usd: geckoData.price_change_24h,
                    price_change_24h_percent: geckoData.price_change_percentage_24h,
                    price_change_7d_percent: geckoData.price_change_percentage_7d,
                    price_change_30d_percent: geckoData.price_change_percentage_30d,
                },
                supply: {
                    circulating: geckoData.circulating_supply,
                    total: geckoData.total_supply,
                },
                all_time: {
                    ath_usd: geckoData.ath,
                    ath_date: geckoData.ath_date,
                    atl_usd: geckoData.atl,
                    atl_date: geckoData.atl_date,
                },
                exchange_count: geckoData.tickers.length,
                timestamp: geckoData.timestamp,
            });
        }
        catch (err) {
            return toolResult({
                error: "Failed to fetch market data",
                message: err instanceof Error ? err.message : String(err),
            });
        }
    });
}
//# sourceMappingURL=markets.js.map