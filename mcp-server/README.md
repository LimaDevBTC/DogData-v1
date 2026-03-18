# DOG DATA MCP Server

Model Context Protocol server for **DOG•GO•TO•THE•MOON** Bitcoin rune token data. Provides real-time on-chain analytics, holder intelligence, forensic behavioral profiles, and market data to AI agents.

## Quick Start

```bash
# Install dependencies
npm install

# Run in development mode (STDIO)
npm run dev

# Run in HTTP mode for remote agents
npm run start:http

# Build for production
npm run build
npm start
```

## Transports

### STDIO (Default)
Used by Claude Desktop, Claude Code, and local MCP clients. All communication happens over stdin/stdout using JSON-RPC.

```bash
npm run dev
```

### Streamable HTTP
Exposes the server on port 3002 (configurable via `MCP_HTTP_PORT`) for remote AI agents.

```bash
npm run start:http
```

Endpoints:
- `POST /mcp` — JSON-RPC requests
- `GET /mcp` — SSE stream (with session ID)
- `DELETE /mcp` — Close session
- `GET /health` — Health check

## Claude Desktop Configuration

Add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "dogdata": {
      "command": "npx",
      "args": ["tsx", "/path/to/DogData-v1/mcp-server/index.ts"],
      "env": {
        "UPSTASH_KV_REST_API_URL": "your-url",
        "UPSTASH_KV_REST_API_TOKEN": "your-token"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `UPSTASH_KV_REST_API_URL` | For transactions | Upstash Redis REST URL |
| `UPSTASH_KV_REST_API_TOKEN` | For transactions | Upstash Redis REST token |
| `SUPABASE_URL` | Optional | Supabase project URL for historical metrics |
| `SUPABASE_ANON_KEY` | Optional | Supabase anonymous key |
| `MCP_HTTP_PORT` | Optional | HTTP transport port (default: 3002) |

## Tools (12)

| Tool | Description |
|------|-------------|
| `get_dog_holders` | Paginated holder list with balances and UTXO counts |
| `search_holder` | Search by Bitcoin address with forensic profile |
| `get_recent_transactions` | Live transaction feed from Redis |
| `search_transaction` | Look up transaction by txid |
| `get_dog_price` | Current price from Kraken exchange |
| `get_multi_exchange_prices` | Prices across exchanges via CoinGecko |
| `get_onchain_metrics` | Holder count, UTXOs, concentration, MVRV |
| `get_metrics_history` | Historical time-series data |
| `get_forensic_profiles` | Behavioral analysis of airdrop recipients |
| `get_diamond_scores` | Top diamond-hands holders |
| `get_airdrop_analysis` | Airdrop recipient tracking and retention |
| `get_bitcoin_network` | Bitcoin network status from mempool.space |
| `get_market_data` | Aggregated market data from CoinGecko + Kraken |

## Resources (8)

| URI | Description |
|-----|-------------|
| `dog://stats` | Overview snapshot of DOG token |
| `dog://top-holders` | Top 25 holders with supply percentages |
| `dog://supply-info` | Supply distribution and holding periods |
| `dog://bitcoin-network` | Current Bitcoin network status |
| `dog://price-summary` | Price and market summary |
| `dog://forensic-summary` | Forensic behavioral analysis summary |
| `dog://utxo-distribution` | UTXO age and size distribution |
| `dog://airdrop-summary` | Airdrop analytics summary |

## Prompts (4)

| Prompt | Description |
|--------|-------------|
| `analyze-holder` | Deep analysis of a specific holder address |
| `market-report` | Comprehensive market report generation |
| `whale-alert` | Whale detection and risk assessment |
| `portfolio-check` | Portfolio lookup for any address |

## Data Sources

- **Local JSON files** in `../data/` — holder lists, forensic profiles, airdrop analytics, UTXO set
- **Upstash Redis** — live transaction feed (`dog:transactions` key)
- **Kraken API** — real-time DOG/USD price
- **CoinGecko API** — market data, exchange tickers, supply info
- **mempool.space API** — Bitcoin network status, fees, mempool

## Architecture

```
index.ts          — Entry point, transport selection
server.ts         — McpServer creation, registration of all tools/resources/prompts
tools/            — 8 files, 12 tool handlers
resources/        — 8 files, 8 resource handlers
prompts/          — 4 files, 4 prompt templates
transport/        — STDIO and HTTP transport adapters
utils/
  data-loader.ts  — Cached data loading from files, Redis, and APIs
  formatters.ts   — Response formatting helpers
```
