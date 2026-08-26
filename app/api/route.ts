import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
;

export async function GET() {
  const baseUrl = 'https://www.dogdata.xyz';

  // Fetch live stats
  let liveStats = {
    total_holders: '89,000+',
    total_utxos: '250,000+',
    forensic_profiles: '75,490+',
  };

  try {
    const internalBase = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const [holdersRes, forensicRes] = await Promise.allSettled([
      fetch(`${internalBase}/api/dog-rune/holders?limit=1`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      }),
      fetch(`${internalBase}/api/forensic/summary`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      }),
    ]);
    if (holdersRes.status === 'fulfilled' && holdersRes.value.ok) {
      const data = await holdersRes.value.json();
      if (data.pagination?.total) {
        liveStats.total_holders = data.pagination.total.toLocaleString() + '+';
      }
    }
    if (forensicRes.status === 'fulfilled' && forensicRes.value.ok) {
      const data = await forensicRes.value.json();
      if (data.statistics?.total_analyzed) {
        liveStats.forensic_profiles = data.statistics.total_analyzed.toLocaleString();
      }
    }
  } catch {}

  const discovery = {
    service: 'DOG DATA',
    version: '1.0.0',
    description:
      "The world's most comprehensive DOG\u2022GO\u2022TO\u2022THE\u2022MOON data platform on Bitcoin L1. " +
      'Real-time holder tracking, forensic analysis, multi-exchange pricing for AI agents.',
    quick_start: {
      message: 'These endpoints require NO API key. Try them now:',
      endpoints: [
        { method: 'GET', path: '/api/dog-rune/stats', description: 'Token overview & top holders' },
        { method: 'GET', path: '/api/price/kraken', description: 'Current DOG price (USD)' },
        { method: 'GET', path: '/api/health', description: 'Service health check' },
        { method: 'GET', path: '/api/bitcoin', description: 'Bitcoin network status' },
      ],
      get_api_key: 'POST /api/keys/generate — send {"email": "you@example.com", "name": "My Agent"}',
    },
    endpoints: {
      discovery: {
        capabilities: `${baseUrl}/api/agent/capabilities`,
        openapi_spec: `${baseUrl}/api/openapi.json`,
        health: `${baseUrl}/api/health`,
        status: `${baseUrl}/api/status`,
      },
      data: {
        stats: '/api/dog-rune/stats',
        holders: '/api/dog-rune/holders',
        holders_search: '/api/dog-rune/holders?address={btc_address}',
        transactions: '/api/dog-rune/transactions-kv',
        transaction_search: '/api/dog-rune/search-tx?txid={txid}',
      },
      multichain: {
        description: 'Cross-chain DOG data on Stacks and Solana (holders, transactions, stats)',
        holders: '/api/multichain/holders',
        holders_stacks: '/api/multichain/holders?chain=stacks',
        holders_solana: '/api/multichain/holders?chain=solana',
        transactions: '/api/multichain/transactions',
        transactions_stacks: '/api/multichain/transactions?chain=stacks',
        transactions_solana: '/api/multichain/transactions?chain=solana',
        stats: '/api/multichain/stats',
      },
      stacks: {
        description: 'Stacks-specific DOG data with historical metrics (hourly snapshots via Supabase)',
        history: '/api/stacks/history',
        history_7d: '/api/stacks/history?days=7',
        history_30d: '/api/stacks/history?days=30',
        latest_snapshot: '/api/stacks/history?latest=true',
      },
      pricing: {
        kraken: '/api/price/kraken',
        gateio: '/api/price/gateio',
        mexc: '/api/price/mexc',
        bitget: '/api/price/bitget',
        bitflow: '/api/price/bitflow',
        dogswap: '/api/price/dogswap',
        all_markets: '/api/markets',
      },
      metrics: {
        utxo_distribution: '/api/metrics/utxo',
        utxo_age: '/api/metrics/utxo-age',
        holder_concentration: '/api/metrics/holder-concentration',
        realized_cap: '/api/metrics/realized-cap',
        supply_profit_loss: '/api/metrics/supply-profit-loss',
      },
      forensic: {
        profiles: '/api/forensic/profiles',
        summary: '/api/forensic/summary',
      },
      airdrop: {
        summary: '/api/airdrop/summary',
        recipients: '/api/airdrop/recipients',
      },
      bitcoin: '/api/bitcoin',
      whale_alerts: '/api/whale-alerts',
      whale_alerts_bitcoin: '/api/whale-alerts?chain=bitcoin',
      whale_alerts_stacks: '/api/whale-alerts?chain=stacks',
      whale_alerts_solana: '/api/whale-alerts?chain=solana',
      whale_alerts_tweet: '/api/whale-alerts?format=tweet',
      whale_alerts_custom: '/api/whale-alerts?chain=bitcoin&threshold=5000000&limit=10',
      realtime_sse: '/api/events',
    },
    protocols: {
      rest: {
        base_url: `${baseUrl}/api`,
        openapi_spec: `${baseUrl}/api/openapi.json`,
        total_endpoints: 40,
      },
      mcp: {
        description: 'Model Context Protocol for AI agents (Claude, etc.)',
        http_endpoint: `${baseUrl}/mcp`,
        npm_package: '@dogdata/mcp-server',
        tools: 17,
        resources: 8,
        prompts: 4,
      },
      sse: {
        endpoint: `${baseUrl}/api/events`,
        events: ['new_transaction', 'price_update', 'whale_alert', 'scanner_update', 'heartbeat'],
        example: `curl -N "${baseUrl}/api/events?events=whale_alert,price_update"`,
      },
    },
    authentication: {
      type: 'Bearer token',
      header: 'Authorization: Bearer dog_live_xxx',
      tiers: {
        public: { requests_per_hour: 100, description: 'No API key required' },
        free: { requests_per_hour: 100, description: 'Free API key' },
        pro: { requests_per_hour: 5000, description: 'Production agents' },
        enterprise: { requests_per_hour: 50000, description: 'High-volume agents' },
      },
      get_key: `POST ${baseUrl}/api/keys/generate`,
    },
    data_quality: {
      source: 'Bitcoin Core + Ord (local full node)',
      indexing: 'Direct block scanning — no third-party API dependency',
      update_frequency: {
        transactions: '~30 seconds',
        holders: '~1 hour',
        prices: '~30 seconds (6 exchanges)',
        forensic: '~1 hour',
      },
      stats: liveStats,
    },
    links: {
      website: baseUrl,
      docs: `${baseUrl}/docs`,
      openapi: `${baseUrl}/api/openapi.json`,
      capabilities: `${baseUrl}/api/agent/capabilities`,
      well_known: `${baseUrl}/.well-known/ai-agent.json`,
      llms_txt: `${baseUrl}/llms.txt`,
      bots_guide: `${baseUrl}/bots.md`,
    },
  };

  return NextResponse.json(discovery, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      'Access-Control-Allow-Origin': '*',
      'X-Powered-By': 'DOG DATA',
    },
  });
}
