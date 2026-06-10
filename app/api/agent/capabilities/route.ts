import { NextResponse } from 'next/server';
import { MCP_TOOL_COUNT, MCP_RESOURCE_COUNT, MCP_PROMPT_COUNT } from '@/lib/api-metadata';

export const dynamic = 'force-dynamic';

export async function GET() {
  let totalHolders = 89287;
  let totalUtxos = 250002;
  let lastScan = new Date().toISOString();
  let totalForensicProfiles = 75497;

  // Fetch live stats via internal API (avoids fs which bloats serverless bundle)
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const [holdersRes, forensicRes] = await Promise.allSettled([
      fetch(`${baseUrl}/api/dog-rune/holders?limit=1`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`${baseUrl}/api/forensic/summary`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    if (holdersRes.status === 'fulfilled' && holdersRes.value.ok) {
      const data = await holdersRes.value.json();
      totalHolders = data.pagination?.total || totalHolders;
      lastScan = data.metadata?.updatedAt || lastScan;
    }
    if (forensicRes.status === 'fulfilled' && forensicRes.value.ok) {
      const data = await forensicRes.value.json();
      totalForensicProfiles = data.statistics?.total_analyzed || totalForensicProfiles;
    }
  } catch {}

  const capabilities = {
    service: "DOG DATA",
    version: "1.0.0",
    description: "World's most comprehensive DOG\u2022GO\u2022TO\u2022THE\u2022MOON data platform — Bitcoin L1, Stacks, and Solana",
    protocols: {
      rest: {
        base_url: "https://www.dogdata.xyz/api",
        openapi_spec: "https://www.dogdata.xyz/api/openapi.json",
        auth: "bearer_token",
        docs: "https://www.dogdata.xyz/docs"
      },
      mcp: {
        http_endpoint: "https://www.dogdata.xyz/mcp",
        client_connect: "npx mcp-remote https://www.dogdata.xyz/mcp",
        transport: ["streamable-http", "stdio (via mcp-remote bridge)"],
        tools_count: MCP_TOOL_COUNT,
        resources_count: MCP_RESOURCE_COUNT,
        prompts_count: MCP_PROMPT_COUNT
      },
      sse: {
        endpoint: "https://www.dogdata.xyz/api/events",
        events: ["new_transaction", "price_update", "whale_alert", "new_block"]
      }
    },
    datasets: {
      holders: {
        description: "Complete DOG holder list with rankings and UTXO counts",
        total_records: totalHolders,
        update_frequency: "hourly",
        endpoints: ["/api/dog-rune/holders"]
      },
      transactions: {
        description: "Real-time DOG transactions from Bitcoin L1",
        update_frequency: "real-time (~30s)",
        endpoints: ["/api/dog-rune/transactions-kv"]
      },
      forensic: {
        description: `Behavioral analysis of ${totalForensicProfiles.toLocaleString('en-US')} airdrop recipients with Diamond Score`,
        total_profiles: totalForensicProfiles,
        categories: 14,
        endpoints: ["/api/forensic/profiles", "/api/forensic/summary"]
      },
      pricing: {
        description: "Multi-exchange DOG pricing from 10 sources: 4 CEXes, 2 BTC-layer DEXes, and 4 Solana DEXes",
        exchanges: ["kraken", "gateio", "mexc", "bitget", "bitflow", "dogswap", "orca", "raydium", "meteora", "jupiter"],
        cex: ["kraken", "gateio", "mexc", "bitget"],
        btc_l2_dex: ["bitflow", "dogswap"],
        solana_dex: ["orca", "raydium", "meteora", "jupiter"],
        update_frequency: "30s",
        endpoints: [
          "/api/price/kraken", "/api/price/gateio", "/api/price/mexc",
          "/api/price/bitget", "/api/price/bitflow", "/api/price/dogswap",
          "/api/price/orca", "/api/price/raydium", "/api/price/meteora", "/api/price/jupiter"
        ]
      },
      metrics: {
        description: "On-chain analytics: UTXO distribution, concentration, realized cap",
        endpoints: ["/api/metrics/utxo", "/api/metrics/holder-concentration", "/api/metrics/realized-cap"]
      },
      airdrop: {
        description: "Airdrop distribution and recipient analysis",
        endpoints: ["/api/airdrop/summary", "/api/airdrop/recipients"]
      },
      bitcoin: {
        description: "Bitcoin network status — blocks, hashrate, mempool, fees",
        endpoints: ["/api/bitcoin"]
      },
      markets: {
        description: "Aggregated market data across 20+ exchanges",
        endpoints: ["/api/markets"]
      },
      multichain: {
        description: "Cross-chain DOG data on Stacks (via Tenero) and Solana (via Helius). Holders, transactions, and aggregated stats for bridged DOG tokens.",
        chains: ["stacks", "solana"],
        update_frequency: "5 minutes (cached)",
        endpoints: ["/api/multichain/holders", "/api/multichain/transactions", "/api/multichain/stats"],
        query_params: {
          chain: "Filter by chain: 'stacks' | 'solana' (omit for both)",
          limit: "Number of results (default 20 for holders, 30 for transactions)"
        }
      },
      stacks_history: {
        description: "Historical Stacks DOG metrics — hourly snapshots persisted to Supabase. Enables trend analysis for holder count, price, concentration, whale activity, and more.",
        data_sources: ["tenero (primary)", "hiro (fallback)"],
        resilience: "3-tier: memory cache → Redis (1h TTL) → Tenero → Hiro fallback",
        update_frequency: "hourly (Vercel cron)",
        endpoints: ["/api/stacks/history"],
        query_params: {
          days: "Lookback window in days (default 30, max 365)",
          limit: "Max rows (default 720)",
          latest: "Set to 'true' for most recent snapshot only"
        },
        fields: [
          "holder_count", "price_usd", "market_cap_usd", "volume_24h_usd",
          "liquidity_usd", "circulating_supply", "top_10_pct", "top_25_pct",
          "top_50_pct", "whale_wallets", "active_1w", "fresh_1w"
        ]
      },
      status: {
        description: "Service health & uptime — passive observations of crons, infra and external APIs persisted to Supabase. Powers the public /status page with 30/90-day uptime per component.",
        update_frequency: "real-time (per request) + every cron execution",
        endpoints: ["/api/status", "/api/status/full"],
        components_tracked: 15,
        component_categories: ["cron", "infra", "external_api", "data_source"],
        public_page: "/status"
      }
    },
    data_quality: {
      bitcoin_l1: {
        source: "Bitcoin Core + Ord (local full node)",
        indexing_method: "direct block scanning (no third-party APIs)",
        total_holders_indexed: totalHolders,
        total_utxos_tracked: totalUtxos,
        last_scan: lastScan
      },
      stacks: {
        source: "Tenero API (primary) + Hiro API (fallback)",
        caching: "memory (5 min) → Redis/Upstash (1 h) → origin APIs",
        persistence: "Supabase (hourly snapshots for trend analysis)",
        resilience: "automatic failover between Tenero and Hiro"
      },
      solana: {
        source: "Helius RPC + Enhanced API (primary) + Birdeye (pricing)"
      }
    },
    rate_limits: {
      public: { requests_per_hour: 100, description: "No API key required" },
      free: { requests_per_hour: 100, description: "For testing and evaluation" },
      pro: { requests_per_hour: 5000, description: "For production agents" },
      enterprise: { requests_per_hour: 50000, description: "For high-volume agents" }
    },
    links: {
      website: "https://www.dogdata.xyz",
      api_docs: "https://www.dogdata.xyz/docs",
      github: "https://github.com/dogdata",
      mcp_endpoint: "https://www.dogdata.xyz/mcp"
    }
  };

  return NextResponse.json(capabilities, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      'Access-Control-Allow-Origin': '*',
    }
  });
}
