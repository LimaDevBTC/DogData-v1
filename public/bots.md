# DogData API & Data — Bot Access Guide

Documentation to facilitate bot and integration access to DOG (Dog•Go•To•The•Moon) data on DogData.

**Base URL:** `https://www.dogdata.xyz`

---

## Authentication

Most endpoints work without an API key (public tier: 20 req/hr). For higher limits, generate a key:

```bash
curl -s -X POST "https://www.dogdata.xyz/api/keys/generate" \
  -H "Content-Type: application/json" \
  -d '{"email": "bot@example.com", "name": "My Bot"}'
```

Then pass it as a Bearer token:
```
Authorization: Bearer dog_live_xxx
```

| Tier | Requests/hour |
|------|--------------|
| Public (no key) | 20 |
| Free | 100 |
| Pro | 5,000 |
| Enterprise | 50,000 |

---

## API Endpoints

All endpoints return JSON. Use header `Accept: application/json`.

### DOG Rune — Stats & Holders

| Endpoint | Description | Parameters |
|----------|-------------|------------|
| `GET /api/dog-rune/stats` | Rune metadata, supply, top 10 holders | — |
| `GET /api/dog-rune/holders` | Paginated holders list | `page`, `limit` (max 25) |
| `GET /api/dog-rune/holders?address={addr}` | Lookup holder by address | `address` |
| `GET /api/dog-rune/holders?snapshot=refresh` | Snapshot of top 500 holders | `snapshot=refresh` |
| `GET /api/dog-rune/events-count` | Events count | — |
| `GET /api/dog-rune/search-tx` | Search transactions | `q`, `limit` |
| `GET /api/dog-rune/transactions-kv` | Transactions (KV cache) | — |

### On-Chain Metrics

| Endpoint | Description |
|----------|-------------|
| `GET /api/metrics/utxo` | UTXO metrics (total, distribution) |
| `GET /api/metrics/utxo-age` | UTXO age distribution |
| `GET /api/metrics/utxo-count-history` | UTXO count history |
| `GET /api/metrics/holder-concentration` | Holder concentration (Gini) |
| `GET /api/metrics/realized-cap` | Realized Cap & MVRV |
| `GET /api/metrics/supply-profit-loss` | Supply in profit/loss |

### Price & Markets

| Endpoint | Description |
|----------|-------------|
| `GET /api/markets` | Tickers, volume, market cap (20+ exchanges) |
| `GET /api/price/kraken` | Kraken price |
| `GET /api/price/bitget` | Bitget price |
| `GET /api/price/mexc` | MEXC price |
| `GET /api/price/gateio` | Gate.io price |
| `GET /api/price/bitflow` | Bitflow DEX price |
| `GET /api/price/dogswap` | DogSwap price |
| `GET /api/price/orca` | Orca (Solana DEX) |
| `GET /api/price/raydium` | Raydium (Solana DEX) |
| `GET /api/price/meteora` | Meteora (Solana DEX) |
| `GET /api/price/jupiter` | Jupiter aggregator (Solana) |

### Bitcoin Network

| Endpoint | Description |
|----------|-------------|
| `GET /api/bitcoin` | Difficulty, hashrate, mempool, fees, blocks |

### Whale Alerts

| Endpoint | Description |
|----------|-------------|
| `GET /api/whale-alerts` | Recent large transfers (all chains) |
| `GET /api/whale-alerts?chain=bitcoin` | Bitcoin L1 whale alerts |
| `GET /api/whale-alerts?chain=stacks` | Stacks whale alerts |
| `GET /api/whale-alerts?chain=solana` | Solana whale alerts |
| `GET /api/whale-alerts?format=tweet` | Tweet-ready text format |
| `GET /api/whale-alerts?threshold=5000000&limit=10` | Custom threshold (DOG units) |

### Multichain (Stacks + Solana)

| Endpoint | Description |
|----------|-------------|
| `GET /api/multichain/holders` | DOG holders on Stacks + Solana |
| `GET /api/multichain/holders?chain=stacks` | Stacks holders only |
| `GET /api/multichain/holders?chain=solana` | Solana holders only |
| `GET /api/multichain/transactions` | Cross-chain transactions |
| `GET /api/multichain/transactions?chain=stacks` | Stacks transactions only |
| `GET /api/multichain/stats` | Aggregated cross-chain stats |

### Stacks History

| Endpoint | Description |
|----------|-------------|
| `GET /api/stacks/history` | Hourly snapshots (default 30 days) |
| `GET /api/stacks/history?days=7` | Last 7 days |
| `GET /api/stacks/history?latest=true` | Most recent snapshot only |

Fields: `holder_count`, `price_usd`, `market_cap_usd`, `volume_24h_usd`, `liquidity_usd`, `top_10_pct`, `top_25_pct`, `whale_wallets`, `active_1w`, `fresh_1w`.

### Airdrop & Forensics

| Endpoint | Description |
|----------|-------------|
| `GET /api/airdrop/summary` | Airdrop summary |
| `GET /api/airdrop/recipients` | Recipients list |
| `GET /api/forensic/summary` | Forensic summary |
| `GET /api/forensic/profiles` | Behavioral profiles (Diamond Score) |

### Real-time Events (SSE)

| Endpoint | Description |
|----------|-------------|
| `GET /api/events` | SSE stream: `new_transaction`, `price_update`, `whale_alert`, `new_block`, `heartbeat` |

```bash
curl -N "https://www.dogdata.xyz/api/events?events=whale_alert,price_update"
```

### Service

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/status` | Full service status |

---

## MCP Server (for Claude and AI agents)

```bash
npx @dogdata/mcp-server
```

- HTTP endpoint: `https://www.dogdata.xyz/mcp`
- 16 tools, 8 resources, 4 prompts
- Transports: `stdio` (Claude Desktop) + `streamable-http` (remote agents)
- Full capabilities: `https://www.dogdata.xyz/api/agent/capabilities`

---

## Usage Examples for Bots

### cURL — Rune stats
```bash
curl -s "https://www.dogdata.xyz/api/dog-rune/stats" | jq
```

### cURL — Holder by address
```bash
curl -s "https://www.dogdata.xyz/api/dog-rune/holders?address=bc1q..." | jq
```

### cURL — Whale alerts (tweet format)
```bash
curl -s "https://www.dogdata.xyz/api/whale-alerts?format=tweet" | jq
```

### cURL — Multichain holders
```bash
curl -s "https://www.dogdata.xyz/api/multichain/holders?chain=stacks" | jq
```

### cURL — Markets
```bash
curl -s "https://www.dogdata.xyz/api/markets" | jq
```

### Python
```python
import requests

r = requests.get("https://www.dogdata.xyz/api/dog-rune/stats")
stats = r.json()
print(stats.get("totalHolders"), stats.get("metadata", {}).get("supply"))
```

### JavaScript/Node
```javascript
const res = await fetch('https://www.dogdata.xyz/api/markets');
const data = await res.json();
console.log(data.marketData?.price, data.marketData?.marketCap);
```

---

## Update Frequency

| Data | Update |
|------|--------|
| Transactions (Bitcoin L1) | ~30s (block scanner daemon) |
| Prices (CEX) | ~30s |
| Prices (Solana DEX) | ~30s |
| Whale alerts | ~30s |
| Markets | ~60s (cache) |
| Holders (Bitcoin L1) | ~1 hour (full rescan) |
| Stacks data | ~5 min (cached) |
| Stacks history snapshots | Hourly (Vercel cron) |
| Forensic profiles | ~1 hour |

---

## DOG Rune

- **Rune ID:** `840000:3`
- **Name:** Dog•Go•To•The•Moon
- **Divisibility:** 5 (1 DOG = 100,000 units)

---

## Useful Links

- **Site:** https://www.dogdata.xyz
- **API Discovery:** https://www.dogdata.xyz/api
- **Docs:** https://www.dogdata.xyz/docs
- **OpenAPI spec:** https://www.dogdata.xyz/api/openapi.json
- **Capabilities:** https://www.dogdata.xyz/api/agent/capabilities
- **LLM context:** https://www.dogdata.xyz/llms.txt
- **Twitter:** @dogdatabtc
- **This file:** https://www.dogdata.xyz/bots.md

---

*Last updated: 2026-04-29*
