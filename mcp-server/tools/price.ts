import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  fetchKrakenPrice,
  fetchCoinGeckoData,
  fetchOrcaPrice,
  fetchRaydiumPrice,
  fetchJupiterPrice,
  fetchMeteoraPrice,
} from "../utils/data-loader.js";
import { toolResult } from "../utils/formatters.js";

export function registerPriceTools(server: McpServer): void {
  // -----------------------------------------------------------------------
  // get_dog_price — from Kraken API
  // -----------------------------------------------------------------------
  server.tool(
    "get_dog_price",
    "Get the current DOG token price from Kraken exchange. " +
      "Returns last price, bid/ask, 24h volume, VWAP, high/low, and trade count.",
    {},
    async () => {
      try {
        const price = await fetchKrakenPrice();
        const change24h = price.price - price.open_24h;
        const changePct = price.open_24h > 0 ? (change24h / price.open_24h) * 100 : 0;

        return toolResult({
          source: "Kraken",
          pair: "DOG/USD",
          price: price.price,
          bid: price.bid,
          ask: price.ask,
          spread: price.ask - price.bid,
          volume_24h: price.volume_24h,
          vwap_24h: price.vwap,
          high_24h: price.high_24h,
          low_24h: price.low_24h,
          open_24h: price.open_24h,
          change_24h: change24h,
          change_24h_percent: changePct,
          trades_24h: price.trades_24h,
          timestamp: price.timestamp,
        });
      } catch (err) {
        return toolResult({
          error: "Failed to fetch price from Kraken",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  );

  // -----------------------------------------------------------------------
  // get_solana_dex_prices — from Orca, Raydium, Meteora, Jupiter
  // -----------------------------------------------------------------------
  server.tool(
    "get_solana_dex_prices",
    "Get DOG token prices from all 4 Solana DEXes: Orca (Whirlpool), Raydium, Meteora, and Jupiter. " +
      "Returns price per DEX, 24h change where available, and extra liquidity/TVL data. " +
      "Also computes the average price across all reporting DEXes.",
    {},
    async () => {
      const results = await Promise.allSettled([
        fetchOrcaPrice(),
        fetchRaydiumPrice(),
        fetchJupiterPrice(),
        fetchMeteoraPrice(),
      ]);

      const dexes = results.map((r) =>
        r.status === "fulfilled"
          ? r.value
          : { source: "unknown", price: 0, change24h: null, error: (r.reason as Error)?.message }
      );

      const reporting = dexes.filter((d) => d.price > 0);
      const avgPrice =
        reporting.length > 0
          ? reporting.reduce((sum, d) => sum + d.price, 0) / reporting.length
          : 0;

      return toolResult({
        dexes,
        average_price_usd: avgPrice,
        dexes_reporting: reporting.length,
        timestamp: new Date().toISOString(),
      });
    }
  );

  // -----------------------------------------------------------------------
  // get_multi_exchange_prices — from CoinGecko tickers
  // -----------------------------------------------------------------------
  server.tool(
    "get_multi_exchange_prices",
    "Get DOG token prices across multiple exchanges via CoinGecko tickers. " +
      "Shows price, volume, and trust score for each exchange listing.",
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe("Number of exchange tickers to return"),
    },
    async ({ limit }) => {
      try {
        const data = await fetchCoinGeckoData();
        const tickers = data.tickers.slice(0, limit).map((t) => ({
          exchange: t.market.name,
          exchange_id: t.market.identifier,
          pair: `${t.base}/${t.target}`,
          price: t.last,
          volume_usd: t.converted_volume.usd,
          trust_score: t.trust_score,
          trade_url: t.trade_url,
        }));

        return toolResult({
          total_exchanges: data.tickers.length,
          showing: tickers.length,
          tickers,
          timestamp: data.timestamp,
        });
      } catch (err) {
        return toolResult({
          error: "Failed to fetch multi-exchange prices",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  );
}
