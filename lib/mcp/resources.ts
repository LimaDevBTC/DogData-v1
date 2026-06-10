import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fetchInternal, settled } from "./internal";
import { fetchCoinGeckoData } from "./external";
import { resourceResult, DOG_TOTAL_SUPPLY } from "./format";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Register all DOG DATA MCP resources (dog:// URIs). Like the tools, each
 * resource reads from the app's own REST endpoints / external market APIs.
 */
export function registerResources(server: McpServer): void {
  // dog://stats — high-level token overview
  server.resource("stats", "dog://stats", async (uri) => {
    const [statsRes, forensicRes] = await Promise.allSettled([
      fetchInternal<any>("/api/dog-rune/stats", { ttlMs: 60_000 }),
      fetchInternal<any>("/api/forensic/summary", { ttlMs: 300_000 }),
    ]);
    const stats = settled(statsRes);
    const forensic = settled(forensicRes);
    const top10Dog = ((stats?.top10_holders ?? []) as any[]).reduce(
      (s, h) => s + (h.total_dog ?? 0),
      0
    );
    return resourceResult(uri.href, {
      name: "DOG•GO•TO•THE•MOON",
      type: "Rune",
      total_supply: DOG_TOTAL_SUPPLY,
      total_holders: stats?.total_holders ?? null,
      total_utxos: stats?.total_utxos ?? null,
      top_10_concentration_percent: (top10Dog / DOG_TOTAL_SUPPLY) * 100,
      forensic_summary: forensic?.statistics
        ? {
            still_holding: forensic.statistics.still_holding,
            sold_everything: forensic.statistics.sold_everything,
            retention_rate: forensic.statistics.retention_rate,
            accumulated: forensic.statistics.accumulated,
          }
        : null,
      data_timestamp: stats?.last_updated ?? null,
    });
  });

  // dog://top-holders — top 25 holders
  server.resource("top-holders", "dog://top-holders", async (uri) => {
    const data = await fetchInternal<any>(
      "/api/dog-rune/holders?page=1&limit=25",
      { ttlMs: 60_000 }
    );
    const holders: any[] = data.data ?? data.holders ?? [];
    return resourceResult(uri.href, {
      total_holders: data.pagination?.total ?? null,
      showing: holders.length,
      top_holders: holders.map((h) => ({
        rank: h.rank,
        address: h.address,
        total_dog: h.total_dog,
        percentage_of_supply: ((h.total_dog ?? 0) / DOG_TOTAL_SUPPLY) * 100,
        utxo_count: h.utxo_count,
      })),
      data_timestamp: data.last_updated ?? null,
    });
  });

  // dog://supply-info — supply + distribution
  server.resource("supply-info", "dog://supply-info", async (uri) => {
    const [statsRes, utxoRes] = await Promise.allSettled([
      fetchInternal<any>("/api/dog-rune/stats", { ttlMs: 60_000 }),
      fetchInternal<any>("/api/metrics/utxo-age", { ttlMs: 60_000 }),
    ]);
    const stats = settled(statsRes);
    const utxo = settled(utxoRes);
    return resourceResult(uri.href, {
      token: "DOG•GO•TO•THE•MOON",
      total_supply: DOG_TOTAL_SUPPLY,
      total_supply_formatted: "100,000,000,000 DOG",
      decimals: 5,
      rune_id: "840000:3",
      distribution: {
        total_holders: stats?.total_holders ?? null,
        total_utxos: stats?.total_utxos ?? utxo?.total_utxos ?? null,
        hodl_waves: utxo?.hodl_waves ?? null,
        age_distribution: utxo?.age_distribution ?? null,
      },
      data_timestamp: stats?.last_updated ?? utxo?.last_updated ?? null,
    });
  });

  // dog://bitcoin-network — Bitcoin L1 status
  server.resource("bitcoin-network", "dog://bitcoin-network", async (uri) => {
    try {
      const data = await fetchInternal<any>("/api/bitcoin", { ttlMs: 60_000 });
      return resourceResult(uri.href, data);
    } catch {
      return resourceResult(uri.href, {
        error: "Unable to fetch Bitcoin network data",
        timestamp: new Date().toISOString(),
      });
    }
  });

  // dog://price-summary — price + market cap snapshot
  server.resource("price-summary", "dog://price-summary", async (uri) => {
    const [krakenRes, geckoRes] = await Promise.allSettled([
      fetchInternal<any>("/api/price/kraken", { ttlMs: 30_000 }),
      fetchCoinGeckoData(),
    ]);
    const kraken = settled(krakenRes);
    const gecko = geckoRes.status === "fulfilled" ? geckoRes.value : null;
    const price = kraken?.price ?? kraken?.last ?? 0;
    return resourceResult(uri.href, {
      token: "DOG•GO•TO•THE•MOON",
      price_usd: price,
      bid: kraken?.bid ?? null,
      ask: kraken?.ask ?? null,
      high_24h: kraken?.high_24h ?? null,
      low_24h: kraken?.low_24h ?? null,
      volume_24h: kraken?.volume_24h ?? null,
      market_cap_usd: gecko?.market_cap ?? 0,
      fully_diluted_valuation: gecko?.fully_diluted_valuation ?? 0,
      ath: gecko?.ath ?? 0,
      ath_date: gecko?.ath_date ?? "",
      exchanges_tracked: gecko?.tickers.length ?? 0,
      timestamp: new Date().toISOString(),
    });
  });

  // dog://forensic-summary — behavioral analysis summary
  server.resource("forensic-summary", "dog://forensic-summary", async (uri) => {
    const data = await fetchInternal<any>("/api/forensic/summary", {
      ttlMs: 300_000,
    });
    const stats = data.statistics ?? {};
    return resourceResult(uri.href, {
      still_holding: stats.still_holding,
      sold_everything: stats.sold_everything,
      retention_rate: stats.retention_rate,
      accumulated: stats.accumulated,
      behavior_distribution: stats.by_pattern,
      field_definitions: data.field_definitions ?? null,
      data_timestamp: data.timestamp ?? null,
    });
  });

  // dog://utxo-distribution — UTXO age / HODL waves
  server.resource(
    "utxo-distribution",
    "dog://utxo-distribution",
    async (uri) => {
      const data = await fetchInternal<any>("/api/metrics/utxo-age", {
        ttlMs: 60_000,
      });
      return resourceResult(uri.href, {
        total_utxos: data.total_utxos,
        total_supply: data.total_supply,
        hodl_waves: data.hodl_waves ?? null,
        age_distribution: data.age_distribution ?? null,
        source: data.source,
        data_timestamp: data.last_updated ?? null,
      });
    }
  );

  // dog://airdrop-summary — airdrop overview + top recipients
  server.resource("airdrop-summary", "dog://airdrop-summary", async (uri) => {
    const [summaryRes, recRes] = await Promise.allSettled([
      fetchInternal<any>("/api/airdrop/summary", { ttlMs: 300_000 }),
      fetchInternal<any>("/api/airdrop/recipients?page=1&limit=10", {
        ttlMs: 300_000,
      }),
    ]);
    const summary = settled(summaryRes);
    const rec = settled(recRes);
    const recipients: any[] = rec?.data ?? rec?.recipients ?? [];
    return resourceResult(uri.href, {
      summary: summary ?? null,
      top_recipients: recipients.slice(0, 10).map((r) => ({
        address: r.address,
        airdrop_amount: r.airdrop_amount,
        receive_count: r.receive_count,
        current_balance: r.current_balance,
        status: r.status,
      })),
      data_timestamp: summary?.last_updated ?? rec?.last_updated ?? null,
    });
  });
}
