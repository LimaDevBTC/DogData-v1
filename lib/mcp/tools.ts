import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchInternal, settled } from "./internal";
import {
  fetchOrcaPrice,
  fetchRaydiumPrice,
  fetchJupiterPrice,
  fetchMeteoraPrice,
  fetchCoinGeckoData,
} from "./external";
import { toolResult, errMessage, DOG_TOTAL_SUPPLY } from "./format";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Holder {
  rank: number;
  address: string;
  total_amount: number;
  total_dog: number;
  utxo_count?: number;
}

/**
 * Register all DOG DATA MCP tools. Every tool proxies the app's own public
 * REST endpoints (single source of truth) or hits external market APIs
 * directly — never the local data files.
 */
export function registerTools(server: McpServer): void {
  // =======================================================================
  // HOLDERS
  // =======================================================================
  server.tool(
    "get_dog_holders",
    "Get paginated list of DOG token holders with their balances and UTXO counts. " +
      "Returns rank, address, total DOG amount, and UTXO count for each holder.",
    {
      page: z.number().int().min(1).default(1).describe("Page number (starts at 1)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe("Number of holders per page (max 100)"),
      sort: z
        .enum(["rank", "total_dog", "utxo_count"])
        .default("rank")
        .describe("Sort field"),
      order: z.enum(["asc", "desc"]).default("asc").describe("Sort order"),
    },
    async ({ page, limit, sort, order }) => {
      try {
        // Fast path: the source is already rank-ascending, so the default sort
        // maps straight onto the endpoint's native pagination (no full fetch).
        if (sort === "rank" && order === "asc" && limit <= 25) {
          const res = await fetchInternal<{
            data?: Holder[];
            holders?: Holder[];
            pagination?: { total: number; total_pages: number };
            last_updated?: string;
          }>(`/api/dog-rune/holders?page=${page}&limit=${limit}`, {
            ttlMs: 60_000,
          });
          return toolResult({
            timestamp: res.last_updated,
            total_holders: res.pagination?.total,
            page,
            limit,
            total_pages: res.pagination?.total_pages,
            holders: res.data ?? res.holders ?? [],
          });
        }

        // General path: pull the full ranked set once (endpoint returns up to
        // 1M rows when limit >= 100000) and sort/paginate in memory.
        const full = await fetchInternal<{
          data?: Holder[];
          holders?: Holder[];
          pagination?: { total: number };
          last_updated?: string;
        }>("/api/dog-rune/holders?limit=100000", {
          ttlMs: 120_000,
          timeoutMs: 25_000,
        });
        const holders = [...(full.data ?? full.holders ?? [])];
        holders.sort((a, b) => {
          let cmp = 0;
          if (sort === "rank") cmp = a.rank - b.rank;
          else if (sort === "total_dog") cmp = a.total_dog - b.total_dog;
          else cmp = (a.utxo_count ?? 0) - (b.utxo_count ?? 0);
          return order === "desc" ? -cmp : cmp;
        });
        const total = full.pagination?.total ?? holders.length;
        const totalPages = Math.ceil(holders.length / limit);
        const start = (page - 1) * limit;
        return toolResult({
          timestamp: full.last_updated,
          total_holders: total,
          page,
          limit,
          total_pages: totalPages,
          holders: holders.slice(start, start + limit),
        });
      } catch (err) {
        return toolResult({
          error: "Failed to fetch holders",
          message: errMessage(err),
        });
      }
    }
  );

  server.tool(
    "search_holder",
    "Search for a specific DOG holder by Bitcoin address. Returns holder details " +
      "including rank, balance, UTXO count, and forensic behavioral data if available.",
    {
      address: z.string().describe("Bitcoin address to search for"),
    },
    async ({ address }) => {
      const enc = encodeURIComponent(address);
      const [holderRes, forensicRes] = await Promise.allSettled([
        fetchInternal<{ holder?: (Holder & { holder_rank?: number | null }) | null }>(
          `/api/dog-rune/holders?address=${enc}`
        ),
        fetchInternal<{ profile?: any; data_timestamp?: string }>(
          `/api/forensic/profile?address=${enc}`
        ),
      ]);

      const holder = settled(holderRes)?.holder ?? null;
      const forensic = settled(forensicRes)?.profile ?? null;

      if (!holder && !forensic) {
        return toolResult({
          found: false,
          address,
          message:
            "Address not found in current holder data or forensic profiles.",
        });
      }

      return toolResult({
        found: true,
        address,
        holder: holder
          ? {
              rank: holder.holder_rank ?? holder.rank ?? null,
              total_dog: holder.total_dog,
              total_amount: holder.total_amount,
              utxo_count: holder.utxo_count,
              percentage_of_supply:
                ((holder.total_dog ?? 0) / DOG_TOTAL_SUPPLY) * 100,
            }
          : null,
        forensic: forensic
          ? {
              airdrop_rank: forensic.airdrop_rank,
              airdrop_amount: forensic.airdrop_amount,
              current_balance: forensic.current_balance,
              behavior_pattern: forensic.behavior_pattern,
              behavior_category: forensic.behavior_category,
              behavior_detail: forensic.behavior_detail,
              diamond_score: forensic.diamond_score,
              retention_rate: forensic.retention_rate,
              accumulation_rate: forensic.accumulation_rate,
              is_dumping: forensic.is_dumping,
              rank_change: forensic.rank_change,
              insights: forensic.insights,
            }
          : null,
        data_timestamp: settled(forensicRes)?.data_timestamp,
      });
    }
  );

  // =======================================================================
  // TRANSACTIONS
  // =======================================================================
  server.tool(
    "get_recent_transactions",
    "Get recent DOG token transactions from the live transaction feed. " +
      "Supports filtering by transaction type and minimum amount.",
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe("Number of transactions to return (max 100)"),
      type: z
        .string()
        .optional()
        .describe("Filter by transaction type (e.g., 'transfer', 'mint')"),
      min_amount: z.number().optional().describe("Minimum DOG amount to include"),
    },
    async ({ limit, type, min_amount }) => {
      try {
        const res = await fetchInternal<{ transactions?: any[] }>(
          "/api/dog-rune/transactions-kv",
          { ttlMs: 30_000 }
        );
        let txs = res.transactions ?? [];
        if (type) {
          txs = txs.filter(
            (tx) => String(tx.type ?? "").toLowerCase() === type.toLowerCase()
          );
        }
        if (min_amount !== undefined) {
          txs = txs.filter((tx) => (tx.amount ?? 0) >= min_amount);
        }
        const recent = txs.slice(0, limit);
        return toolResult({
          count: recent.length,
          total_available: txs.length,
          transactions: recent,
        });
      } catch (err) {
        return toolResult({
          error: "Failed to fetch transactions",
          message: errMessage(err),
        });
      }
    }
  );

  server.tool(
    "search_transaction",
    "Search for a specific DOG transaction by transaction ID (txid). " +
      "Returns full transaction details if found.",
    {
      txid: z.string().describe("Transaction ID to search for"),
    },
    async ({ txid }) => {
      try {
        const tx = await fetchInternal(
          `/api/dog-rune/search-tx?txid=${encodeURIComponent(txid)}`
        );
        return toolResult({ found: true, transaction: tx });
      } catch {
        return toolResult({
          found: false,
          txid,
          message:
            "Transaction not found. It may be older than the indexed window " +
            "or not a DOG-bearing transaction.",
        });
      }
    }
  );

  // =======================================================================
  // PRICE
  // =======================================================================
  server.tool(
    "get_dog_price",
    "Get the current DOG token price from Kraken exchange. " +
      "Returns last price, bid/ask, 24h volume, VWAP, high/low, and trade count.",
    {},
    async () => {
      try {
        const data = await fetchInternal("/api/price/kraken", { ttlMs: 30_000 });
        return toolResult(data);
      } catch (err) {
        return toolResult({
          error: "Failed to fetch price from Kraken",
          message: errMessage(err),
        });
      }
    }
  );

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
          : {
              source: "unknown",
              price: 0,
              change24h: null,
              error: (r.reason as Error)?.message,
            }
      );
      const reporting = dexes.filter((d) => d.price > 0);
      const avgPrice =
        reporting.length > 0
          ? reporting.reduce((s, d) => s + d.price, 0) / reporting.length
          : 0;
      return toolResult({
        dexes,
        average_price_usd: avgPrice,
        dexes_reporting: reporting.length,
        timestamp: new Date().toISOString(),
      });
    }
  );

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
          message: errMessage(err),
        });
      }
    }
  );

  // =======================================================================
  // METRICS
  // =======================================================================
  server.tool(
    "get_onchain_metrics",
    "Get on-chain metrics for DOG token including total holders, total UTXOs, " +
      "concentration metrics (Gini, top 10/100/1000 supply share), and UTXO age / HODL-wave distribution.",
    {},
    async () => {
      const [statsRes, concRes, utxoRes] = await Promise.allSettled([
        fetchInternal<any>("/api/dog-rune/stats", { ttlMs: 60_000 }),
        fetchInternal<any>("/api/metrics/holder-concentration", {
          ttlMs: 60_000,
        }),
        fetchInternal<any>("/api/metrics/utxo-age", { ttlMs: 60_000 }),
      ]);
      const stats = settled(statsRes);
      const conc = settled(concRes);
      const utxo = settled(utxoRes);

      return toolResult({
        timestamp: stats?.last_updated ?? conc?.last_updated ?? null,
        total_holders: stats?.total_holders ?? conc?.total_holders ?? null,
        total_utxos: stats?.total_utxos ?? utxo?.total_utxos ?? null,
        total_supply: DOG_TOTAL_SUPPLY,
        concentration: conc
          ? {
              gini_coefficient: conc.gini_coefficient,
              top10_supply_pct: conc.top10_supply_pct,
              top100_supply_pct: conc.top100_supply_pct,
              top1000_supply_pct: conc.top1000_supply_pct,
            }
          : null,
        utxo_age: utxo
          ? {
              total_utxos: utxo.total_utxos,
              hodl_waves: utxo.hodl_waves,
              age_distribution: utxo.age_distribution,
              source: utxo.source,
            }
          : null,
      });
    }
  );

  server.tool(
    "get_metrics_history",
    "Get historical time-series metrics for DOG token (holders, UTXOs, or price) " +
      "from the persisted Supabase snapshots, downsampled to the requested window.",
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
      const column =
        metric === "holders"
          ? "total_holders"
          : metric === "utxos"
            ? "total_utxos"
            : metric === "price"
              ? "current_price"
              : null;

      if (!column) {
        return toolResult({
          metric,
          days,
          note:
            "Volume history is not stored as a snapshot column. " +
            "Available history metrics: holders, utxos, price.",
          history: [],
        });
      }

      const range =
        days <= 1 ? "24h" : days <= 7 ? "7d" : days <= 30 ? "30d" : days <= 90 ? "90d" : "all";

      try {
        const data = await fetchInternal<any>(
          `/api/metrics/history?range=${range}&metrics=${column}`,
          { ttlMs: 300_000 }
        );
        return toolResult({
          metric,
          days,
          range,
          history: data.history ?? [],
          total_points: data.total_points,
          last_updated: data.last_updated,
        });
      } catch (err) {
        return toolResult({
          error: "Failed to fetch metrics history",
          message: errMessage(err),
        });
      }
    }
  );

  // =======================================================================
  // FORENSIC
  // =======================================================================
  server.tool(
    "get_forensic_profiles",
    "Get forensic behavioral analysis profiles of DOG airdrop recipients. " +
      "Each profile includes behavior pattern, diamond score, retention rate, " +
      "accumulation rate, and whether the holder is dumping. " +
      "Supports filtering by behavior pattern.",
    {
      page: z.number().int().min(1).default(1).describe("Page number (starts at 1)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe("Profiles per page (max 100)"),
      pattern: z
        .string()
        .optional()
        .describe(
          "Filter by behavior pattern (e.g., 'diamond_paws', 'paper_hands', " +
            "'dog_legend', 'hodl_hero', 'profit_taker', 'panic_seller', 'rune_master')"
        ),
    },
    async ({ page, limit, pattern }) => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (pattern) params.set("pattern", pattern);

      const [profRes, summaryRes] = await Promise.allSettled([
        fetchInternal<any>(`/api/forensic/profiles?${params.toString()}`, {
          ttlMs: 120_000,
        }),
        fetchInternal<any>("/api/forensic/summary", { ttlMs: 300_000 }),
      ]);
      const prof = settled(profRes);
      const summary = settled(summaryRes);

      return toolResult({
        statistics: summary?.statistics ?? null,
        page,
        limit,
        total_results: prof?.pagination?.total,
        total_pages: prof?.pagination?.total_pages,
        profiles: prof?.data ?? prof?.profiles ?? [],
        data_timestamp: prof?.last_updated ?? summary?.timestamp,
      });
    }
  );

  server.tool(
    "get_diamond_scores",
    "Get DOG holders in the diamond-hands behavior cohort — the strongest holders " +
      "since the airdrop — with their diamond scores, retention, and forensic detail. " +
      "Backed by the forensic profiles endpoint filtered to the diamond-hands pattern.",
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe("Number of diamond-hands holders to return"),
      min_score: z
        .number()
        .int()
        .min(0)
        .max(100)
        .default(0)
        .describe("Filter the returned cohort to diamond_score >= this value"),
      pattern: z
        .string()
        .default("diamond_paws")
        .describe("Forensic behavior pattern that identifies the diamond cohort"),
    },
    async ({ limit, min_score, pattern }) => {
      const params = new URLSearchParams({
        page: "1",
        limit: String(Math.min(Math.max(limit, 1), 200)),
        pattern,
      });

      const [profRes, summaryRes] = await Promise.allSettled([
        fetchInternal<any>(`/api/forensic/profiles?${params.toString()}`, {
          ttlMs: 120_000,
        }),
        fetchInternal<any>("/api/forensic/summary", { ttlMs: 300_000 }),
      ]);
      const prof = settled(profRes);
      const summary = settled(summaryRes);

      let list: any[] = prof?.data ?? prof?.profiles ?? [];
      list = list
        .filter((p) => (p.diamond_score ?? 0) >= min_score)
        .sort((a, b) => (b.diamond_score ?? 0) - (a.diamond_score ?? 0))
        .slice(0, limit)
        .map((p) => ({
          address: p.address,
          diamond_score: p.diamond_score,
          behavior_pattern: p.behavior_pattern,
          behavior_detail: p.behavior_detail,
          airdrop_amount: p.airdrop_amount,
          current_balance: p.current_balance,
          retention_rate: p.retention_rate,
          rank_change: p.rank_change,
          insights: p.insights,
        }));

      return toolResult({
        pattern,
        min_score,
        showing: list.length,
        diamond_holders: list,
        statistics: summary?.statistics
          ? {
              total_diamond_hands:
                summary.statistics.diamond_hands ??
                summary.statistics.by_pattern?.[pattern],
              overall_retention_rate: summary.statistics.retention_rate,
            }
          : null,
        data_timestamp: prof?.last_updated ?? summary?.timestamp,
        note:
          "Cohort is filtered server-side by behavior pattern; min_score and " +
          "score-sort are applied to the returned page.",
      });
    }
  );

  // =======================================================================
  // AIRDROP
  // =======================================================================
  server.tool(
    "get_airdrop_analysis",
    "Get analysis of the DOG airdrop including summary statistics, retention rate, " +
      "category breakdown, and paginated recipient details with current balances.",
    {
      page: z.number().int().min(1).default(1).describe("Page number (starts at 1)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe("Recipients per page (max 100)"),
    },
    async ({ page, limit }) => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      const [recRes, summaryRes] = await Promise.allSettled([
        fetchInternal<any>(`/api/airdrop/recipients?${params.toString()}`, {
          ttlMs: 300_000,
        }),
        fetchInternal<any>("/api/airdrop/summary", { ttlMs: 300_000 }),
      ]);
      const rec = settled(recRes);
      const summary = settled(summaryRes);

      return toolResult({
        summary: summary ?? null,
        page,
        limit,
        total_results: rec?.pagination?.total,
        total_pages: rec?.pagination?.total_pages,
        recipients: rec?.data ?? rec?.recipients ?? [],
        data_timestamp: rec?.last_updated ?? summary?.last_updated,
      });
    }
  );

  // =======================================================================
  // BITCOIN NETWORK
  // =======================================================================
  server.tool(
    "get_bitcoin_network",
    "Get current Bitcoin network status: block height, hash, difficulty, hashrate, " +
      "mempool size, and fee estimates (fastest, half-hour, hour, economy, minimum).",
    {},
    async () => {
      try {
        const data = await fetchInternal("/api/bitcoin", { ttlMs: 60_000 });
        return toolResult(data);
      } catch (err) {
        return toolResult({
          error: "Failed to fetch Bitcoin network status",
          message: errMessage(err),
        });
      }
    }
  );

  // =======================================================================
  // MARKET
  // =======================================================================
  server.tool(
    "get_market_data",
    "Get comprehensive market data for DOG token: market cap, volume, price changes " +
      "(24h/7d/30d), ATH/ATL, supply, and fully diluted valuation.",
    {},
    async () => {
      try {
        const data = await fetchInternal("/api/markets", { ttlMs: 120_000 });
        return toolResult(data);
      } catch (err) {
        return toolResult({
          error: "Failed to fetch market data",
          message: errMessage(err),
        });
      }
    }
  );

  // =======================================================================
  // MULTICHAIN (Stacks + Solana)
  // =======================================================================
  server.tool(
    "get_multichain_holders",
    "Get top DOG token holders on Stacks and/or Solana blockchains. " +
      "Stacks data comes from Tenero API, Solana from Helius RPC. " +
      "Includes balances, USD values, holder stats, and concentration percentages.",
    {
      chain: z
        .enum(["stacks", "solana"])
        .optional()
        .describe("Filter by chain. Omit for both chains."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(20)
        .describe("Number of top holders to return (max 50)"),
    },
    async ({ chain, limit }) => {
      try {
        const params = new URLSearchParams();
        if (chain) params.set("chain", chain);
        params.set("limit", String(limit));
        const data = await fetchInternal(
          `/api/multichain/holders?${params.toString()}`,
          { ttlMs: 60_000 }
        );
        return toolResult(data);
      } catch (err) {
        return toolResult({
          error: "Failed to fetch multichain holders",
          message: errMessage(err),
        });
      }
    }
  );

  server.tool(
    "get_multichain_transactions",
    "Get recent DOG token transactions (transfers and swaps) on Stacks and/or Solana. " +
      "Stacks data from Tenero, Solana from Helius Enhanced API. " +
      "Gracefully degrades if one chain is unavailable.",
    {
      chain: z
        .enum(["stacks", "solana"])
        .optional()
        .describe("Filter by chain. Omit for both chains."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(30)
        .describe("Number of transactions to return (max 50)"),
    },
    async ({ chain, limit }) => {
      try {
        const params = new URLSearchParams();
        if (chain) params.set("chain", chain);
        params.set("limit", String(limit));
        const data = await fetchInternal(
          `/api/multichain/transactions?${params.toString()}`,
          { ttlMs: 30_000 }
        );
        return toolResult(data);
      } catch (err) {
        return toolResult({
          error: "Failed to fetch multichain transactions",
          message: errMessage(err),
        });
      }
    }
  );

  server.tool(
    "get_multichain_stats",
    "Get aggregated DOG token statistics across Stacks and Solana — " +
      "total holders, combined market cap, 24h volume, and per-chain breakdowns.",
    {},
    async () => {
      try {
        const data = await fetchInternal("/api/multichain/stats", {
          ttlMs: 60_000,
        });
        return toolResult(data);
      } catch (err) {
        return toolResult({
          error: "Failed to fetch multichain stats",
          message: errMessage(err),
        });
      }
    }
  );
}
