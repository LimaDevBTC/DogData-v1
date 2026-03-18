import { fetchKrakenPrice, fetchCoinGeckoData } from "../utils/data-loader.js";
import { resourceResult } from "../utils/formatters.js";
export function registerPriceSummaryResource(server) {
    server.resource("price-summary", "dog://price-summary", async (uri) => {
        try {
            const [kraken, gecko] = await Promise.all([
                fetchKrakenPrice().catch(() => null),
                fetchCoinGeckoData().catch(() => null),
            ]);
            const price = kraken?.price ?? 0;
            const change24h = kraken ? price - kraken.open_24h : 0;
            const changePct = kraken && kraken.open_24h > 0
                ? (change24h / kraken.open_24h) * 100
                : 0;
            return resourceResult(uri.href, {
                token: "DOG•GO•TO•THE•MOON",
                price_usd: price,
                change_24h_usd: change24h,
                change_24h_percent: changePct,
                high_24h: kraken?.high_24h ?? 0,
                low_24h: kraken?.low_24h ?? 0,
                volume_24h: kraken?.volume_24h ?? 0,
                market_cap_usd: gecko?.market_cap ?? 0,
                fully_diluted_valuation: gecko?.fully_diluted_valuation ?? 0,
                ath: gecko?.ath ?? 0,
                ath_date: gecko?.ath_date ?? "",
                exchanges_tracked: gecko?.tickers.length ?? 0,
                timestamp: new Date().toISOString(),
            });
        }
        catch {
            return resourceResult(uri.href, {
                error: "Unable to fetch price data",
                timestamp: new Date().toISOString(),
            });
        }
    });
}
//# sourceMappingURL=price-summary.js.map