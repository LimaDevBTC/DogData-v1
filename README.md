# 🐕 DOG DATA — On-Chain Analytics Platform & Agent Data Server

> Real-time DOG•GO•TO•THE•MOON rune data on Bitcoin L1, Stacks, and Solana — with a public REST API, an MCP server, and SDKs so AI agents and trading bots can consume it directly.

**Live:** [dogdata.xyz](https://www.dogdata.xyz) · **API docs:** [/docs](https://www.dogdata.xyz/docs) · **Agent capabilities:** [/api/agent/capabilities](https://www.dogdata.xyz/api/agent/capabilities)

---

## What this is

DOG DATA is two things in one Next.js app:

1. **A product** — a web app with holder/transaction explorers, forensic behavioral analysis, multi-exchange pricing, cross-chain (Stacks + Solana) data, and a live 3D visualization of the holder base ("DogCity").
2. **A data platform for machines** — a public REST API, an MCP server, and TypeScript/Python SDKs so AI agents, trading bots, and other services can pull the same data programmatically.

Everything is indexed first-party from our own **Bitcoin Core + Ord full node** (no third-party API dependency for L1 data), plus Tenero/Hiro for Stacks and public Solana RPC for Solana.

---

## Quick Start (running the app)

### Prerequisites
- Bitcoin Core + Ord indexer running (see [bitcoin-node/](../bitcoin-node) and [ord/](../ord))
- Node.js 20+
- Python 3.9+ (for the data pipeline scripts)

### Install & run
```bash
npm install
cp .env.local.example .env.local   # fill in Upstash/Supabase/RPC keys — see below
npm run dev                        # http://localhost:3000
```

### Environment variables
The app needs at minimum:

| Variable | Purpose |
|---|---|
| `UPSTASH_KV_REST_API_URL` / `UPSTASH_KV_REST_API_TOKEN` | Redis — live tx feed, caching, rate limiting |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Historical metrics, API keys, status/uptime persistence |
| `HELIUS_API_KEY`, `BIRDEYE_API_KEY` | Solana holders/pricing (falls back to public RPC if unset) |
| `UNISAT_API_TOKEN` | Fallback transaction source |
| `X_*` (bearer/API/access tokens) | Whale-alert auto-posting to X |
| `CRON_SECRET`, `UPDATE_SECRET` | Auth for `/api/cron/*` and `/api/update-transactions` |

See `.env.local` for the full list (gitignored — never commit it).

### Keeping data fresh
The on-chain data pipeline is Python, run either via cron (see `vercel.json` crons + `manage_services.sh` for local systemd services) or manually:
```bash
python3 scripts/update_holders_and_fees.py   # holders, fees, UTXO metrics — the main one
python3 scripts/dog_block_scanner.py         # live block-by-block scanner daemon
```
Other scripts in `scripts/` handle backfills, forensic/airdrop analysis, and historical replay — see inline docstrings for one-off usage.

---

## Product pages

| Route | What it shows |
|---|---|
| `/overview` | Main dashboard — holders, supply, price, recent activity |
| `/holders` | Full holder list (90k+), rank, balance, UTXO count |
| `/transactions`, `/tx` | Live and historical transaction explorer |
| `/address/[address]` | Per-wallet profile: balance, holding period, forensic tags |
| `/markets` | Price across 10 exchanges (4 CEX + 2 BTC-L2 DEX + 4 Solana DEX) |
| `/metrics` | On-chain indicators — UTXO age/HODL waves, concentration, realized cap, supply P/L |
| `/charts` | Historical charting (see [charts expansion project](docs/) for the backfill effort) |
| `/forensic` | Behavioral analysis of airdrop recipients — Diamond Score, 12+ cohort tags |
| `/airdrop` | Airdrop distribution and retention analysis |
| `/multichain` | Cross-chain DOG on Stacks + Solana |
| `/bitcoin-network` | Bitcoin L1 network status |
| `/analytics` | Filters and cross-cutting insights |
| `/donate` | Donation leaderboard (crowdfunding for DogCity build-out) |
| `/city/explore` | Live 3D city — every wallet is a building, sized by balance/UTXO age |
| `/status` | Public uptime dashboard for crons, infra, and external data sources |
| `/docs` | Human-readable API reference (renders the OpenAPI spec) |
| `/explorer` | Combined explorer view |

---

## REST API

- **Base URL:** `https://www.dogdata.xyz/api`
- **Discovery index:** `GET /api` — machine-readable list of every endpoint, grouped by category
- **OpenAPI 3.0.3 spec:** `GET /api/openapi.json`
- **Interactive docs:** [`/docs`](https://www.dogdata.xyz/docs)
- **75 route handlers** across holders, transactions, addresses, pricing (per-exchange), on-chain metrics, forensic profiles, airdrop analytics, multichain (Stacks/Solana), Bitcoin network status, market aggregation, whale alerts, wallet auth (BIP-322), health/status, and SSE events.

### Auth & rate limits
Requests are gated by `middleware/api-gateway.ts` (bearer token) + `middleware/rate-limit.ts` (Redis sliding window):

| Tier | Requests/hour | How to get it |
|---|---|---|
| Public (no key) | 100 | Nothing — just call the API |
| Free | 100 | `POST /api/keys/generate` with `{ "email", "name" }` (max 5 keys/email) |
| Pro | 5,000 | Contact for upgrade |
| Enterprise | 50,000 | Contact for upgrade |

A handful of endpoints are always public regardless of tier: `/api/health`, `/api/status`, `/api/agent/capabilities`, `/api/openapi.json`, `/api/dog-rune/stats`, `/api/price/kraken`.

```bash
# Get a key
curl -X POST https://www.dogdata.xyz/api/keys/generate \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","name":"My Agent"}'

# Use it
curl https://www.dogdata.xyz/api/dog-rune/holders \
  -H "Authorization: Bearer dog_live_xxx"
```

### Real-time
`GET /api/events` — SSE stream (`new_transaction`, `price_update`, `whale_alert`, `new_block`, `heartbeat`).

---

## Agent integration

DOG DATA is built to be *discoverable and consumable by AI agents*, not just browsed by humans. Three ways an agent can plug in:

### 1. MCP (Model Context Protocol)
There are two MCP surfaces — use the remote one unless you specifically need local stdio:

- **Production / remote (recommended):** `https://www.dogdata.xyz/mcp` — Streamable HTTP, implemented as a Next.js route (`app/mcp/route.ts` via `mcp-handler`, backed by `lib/mcp/`). This is what Claude.ai connectors and MCP Inspector should point at. **17 tools, 8 resources, 4 prompts.**
- **Local / stdio dev server:** [`mcp-server/`](mcp-server) — standalone Node process for Claude Desktop / Claude Code, run from source (not yet published to npm as `@dogdata/mcp-server`). Slightly smaller tool set (12) since it predates the multichain/Solana-DEX tools. See [mcp-server/README.md](mcp-server/README.md) for setup and the full tool/resource/prompt tables.

Claude Desktop config for the local server:
```json
{
  "mcpServers": {
    "dogdata": {
      "command": "npx",
      "args": ["tsx", "/path/to/DogData-v1/mcp-server/index.ts"],
      "env": { "UPSTASH_KV_REST_API_URL": "...", "UPSTASH_KV_REST_API_TOKEN": "..." }
    }
  }
}
```
For the remote endpoint, just add `https://www.dogdata.xyz/mcp` as a Streamable HTTP MCP server in any MCP-capable client — no local process needed.

### 2. SDKs
Source-complete, versioned `1.0.0`, but **not yet published to npm/PyPI** — install from the repo path or `npm link` / `pip install -e` locally until they're published.

- [`sdk/typescript/`](sdk/typescript) — `@dogdata/sdk`, native `fetch`, Node 18+
- [`sdk/python/`](sdk/python) — `dogdata`, `httpx`-based, Python 3.9+, context-manager support

Both wrap the same REST API 1:1 (`dog.holders`, `dog.transactions`, `dog.price`, `dog.metrics`, `dog.forensic`, `dog.airdrop`, `dog.bitcoin`, `dog.markets`) with typed errors (`DogDataError`). See each package's README for the full method table.

### 3. Discovery files (so agents find any of this in the first place)
| File | Purpose |
|---|---|
| `GET /api` | JSON discovery index — every endpoint, grouped |
| `GET /api/agent/capabilities` | Full capabilities doc — protocols, datasets, rate limits, data-quality notes |
| `GET /.well-known/ai-agent.json` | Minimal agent-discovery manifest (schema_version 1.0) |
| `GET /llms.txt` | LLM-oriented plaintext summary — what this is, quick-start endpoints, key reference table |

If you're adding a new capability, keep these four in sync — they're the ones agents actually crawl, and drift between them (e.g. a tool/rate-limit number changing in code but not in `capabilities`/`llms.txt`) is the #1 way agents get told the wrong thing. See [docs/agenticdogdataserver.md](docs/agenticdogdataserver.md) for the full agent-discoverability plan and status.

---

## Architecture

```
DogData-v1/
├── app/
│   ├── <page>/            # Next.js App Router pages (see "Product pages" above)
│   ├── api/                # 75 REST route handlers (see "REST API" above)
│   └── mcp/route.ts        # Production remote MCP endpoint (Streamable HTTP)
├── lib/
│   └── mcp/                 # Tool/resource/prompt implementations used by app/mcp
├── mcp-server/              # Standalone local MCP server (stdio + own HTTP transport)
├── sdk/
│   ├── typescript/          # @dogdata/sdk
│   └── python/              # dogdata
├── middleware/               # auth.ts, rate-limit.ts, api-gateway.ts
├── scripts/                  # Python data pipeline (scanner, backfills, forensic/airdrop analysis)
├── data/                     # Generated JSON datasets (holders, forensic, airdrop, UTXO set)
├── components/, contexts/, design-system/   # React UI layer
├── supabase/, migrations/    # Historical metrics, API keys, status persistence
├── docs/                     # Internal planning/reference docs (see below)
└── openapi.json               # OpenAPI 3.0.3 spec served at /api/openapi.json
```

`backend/` (an old standalone Express server) is legacy and no longer wired into the build — all API surface today is Next.js route handlers under `app/api/`.

---

## Documentation index

- [docs/README.md](docs/README.md) — index of internal docs (metrics plans, setup guides, archived material)
- [mcp-server/README.md](mcp-server/README.md) — local MCP server reference
- [sdk/typescript/README.md](sdk/typescript/README.md), [sdk/python/README.md](sdk/python/README.md) — SDK usage
- [docs/agenticdogdataserver.md](docs/agenticdogdataserver.md) — agent-facing infrastructure: what's built, what's pending, discoverability status
- [PERFORMANCE_GUIDE.md](../PERFORMANCE_GUIDE.md) — perf tooling for the wider workspace

---

**Status:** ✅ Production (dogdata.xyz) — REST API, MCP server, agent discovery all live. SDKs source-complete, npm/PyPI publish pending.
