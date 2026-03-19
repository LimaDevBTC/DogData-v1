# DOG DATA — Agentic Data Server
## Plano de Implementação para Servidor Mundial de Dados DOG para Agentes de IA

**Versão:** 1.0
**Data:** 2026-03-18
**Status:** EXECUÇÃO IMEDIATA
**Modo:** Agêntico — todas as fases executadas em paralelo por sub-agentes
**Visão:** Tornar o DOG DATA a referência mundial em dados on-chain do DOG•GO•TO•THE•MOON para milhares de agentes de IA autônomos.

---

## Sumário Executivo

O DOG DATA já possui a infraestrutura de dados mais completa do ecossistema DOG: scanner próprio rodando sobre Bitcoin Core + Ord, 89.287 holders indexados, 250.002 UTXOs rastreados, análise forense de 75.490 endereços, preços de 8+ exchanges, e 29 endpoints REST em produção. **Nenhum outro projeto no mundo oferece esse nível de dados DOG.**

O próximo passo é transformar essa infraestrutura em uma plataforma agent-native: um servidor de dados que milhares de agentes de IA ao redor do mundo possam consumir de forma autônoma, segura e escalável.

Este documento define o plano completo de implementação em 5 fases, projetado para **execução agêntica paralela** — múltiplos sub-agentes implementando simultaneamente.

---

## Índice

1. [Arquitetura Geral](#1-arquitetura-geral)
2. [Fase 1 — MCP Server](#2-fase-1--mcp-server)
3. [Fase 2 — OpenAPI Spec + Portal de Documentação](#3-fase-2--openapi-spec--portal-de-documentação)
4. [Fase 3 — API Gateway: Auth, Rate Limiting & Tiers](#4-fase-3--api-gateway-auth-rate-limiting--tiers)
5. [Fase 4 — Agent Discovery & SDK](#5-fase-4--agent-discovery--sdk)
6. [Fase 5 — Escalabilidade & Observabilidade](#6-fase-5--escalabilidade--observabilidade)
7. [Definição dos Tools MCP](#7-definição-dos-tools-mcp)
8. [Definição dos Resources MCP](#8-definição-dos-resources-mcp)
9. [Schema de API Unificado](#9-schema-de-api-unificado)
10. [Sistema de Tiers & Rate Limiting](#10-sistema-de-tiers--rate-limiting)
11. [Infraestrutura & Deploy](#11-infraestrutura--deploy)
12. [Métricas de Sucesso](#12-métricas-de-sucesso)
13. [Riscos & Mitigações](#13-riscos--mitigações)
14. [Cronograma Visual](#14-cronograma-visual)

---

## 1. Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENTES DE IA (CLIENTES)                     │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │
│  │ Claude   │  │ GPT      │  │ Custom   │  │ Trading Bots  │   │
│  │ Agents   │  │ Agents   │  │ Agents   │  │ & Analyzers   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬────────┘   │
│       │              │              │               │           │
│       │  MCP Protocol│   REST API   │    REST API   │           │
└───────┼──────────────┼──────────────┼───────────────┼───────────┘
        │              │              │               │
┌───────▼──────────────▼──────────────▼───────────────▼───────────┐
│                     API GATEWAY LAYER                            │
│                                                                 │
│  ┌─────────────┐  ┌──────────┐  ┌───────────┐  ┌────────────┐  │
│  │ Auth &      │  │ Rate     │  │ Request   │  │ Usage      │  │
│  │ API Keys    │  │ Limiter  │  │ Validator │  │ Tracker    │  │
│  └─────────────┘  └──────────┘  └───────────┘  └────────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                     PROTOCOL LAYER                              │
│                                                                 │
│  ┌──────────────────────┐  ┌─────────────────────────────────┐  │
│  │ MCP Server           │  │ REST API (Next.js /api/)        │  │
│  │ (Streamable HTTP +   │  │ (29 endpoints existentes +     │  │
│  │  stdio transport)    │  │  novos endpoints agent-ready)  │  │
│  │                      │  │                                 │  │
│  │ • 12 Tools           │  │ • OpenAPI 3.0 Spec             │  │
│  │ • 8 Resources        │  │ • JSON responses padronizadas  │  │
│  │ • 4 Prompts          │  │ • Field selection (?fields=)   │  │
│  └──────────┬───────────┘  └──────────────┬──────────────────┘  │
│             │                             │                     │
│             └──────────────┬──────────────┘                     │
└────────────────────────────┼────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                     DATA LAYER                                  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │ Local JSON   │  │ Upstash      │  │ Supabase           │    │
│  │ (Primary)    │  │ Redis (KV)   │  │ (Historical)       │    │
│  │              │  │              │  │                    │    │
│  │ • Holders    │  │ • Latest 500 │  │ • Metrics history  │    │
│  │ • UTXOs     │  │   transactions│  │ • Time-series      │    │
│  │ • Forensic  │  │ • Rate limit │  │ • API keys         │    │
│  │ • Airdrop   │  │   counters   │  │ • Usage logs       │    │
│  └──────┬───────┘  └──────────────┘  └────────────────────┘    │
│         │                                                       │
└─────────┼───────────────────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────────────────┐
│                     INDEXING LAYER                               │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ dog_block_scanner │  │ update_holders   │                    │
│  │ (daemon, 30s)     │  │ (cron, 1h)       │                    │
│  └────────┬──────────┘  └────────┬─────────┘                    │
│           │                      │                              │
│  ┌────────▼──────────────────────▼─────────┐                    │
│  │ Bitcoin Core + Ord Indexer (local node)  │                    │
│  └─────────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Fase 1 — MCP Server

**Impacto:** Agentes Claude podem consumir dados DOG nativamente
**Prioridade:** CRÍTICA — diferencial competitivo imediato
**Execução:** Sub-agente dedicado — implementa server core, tools, resources, prompts e transports

### 2.1 Estrutura de Arquivos

```
DogData-v1/
├── mcp-server/
│   ├── index.ts                  # Entry point do MCP server
│   ├── server.ts                 # Configuração do McpServer
│   ├── tools/
│   │   ├── holders.ts            # get_dog_holders, search_holder
│   │   ├── transactions.ts       # get_recent_transactions, search_transaction
│   │   ├── price.ts              # get_dog_price, get_multi_exchange_prices
│   │   ├── metrics.ts            # get_onchain_metrics, get_utxo_distribution
│   │   ├── forensic.ts           # get_forensic_profiles, get_diamond_scores
│   │   ├── airdrop.ts            # get_airdrop_analysis
│   │   ├── bitcoin.ts            # get_bitcoin_network_status
│   │   └── markets.ts            # get_market_data
│   ├── resources/
│   │   ├── stats.ts              # dog://stats (read-only resource)
│   │   ├── top-holders.ts        # dog://top-holders
│   │   ├── supply.ts             # dog://supply-info
│   │   └── network.ts            # dog://bitcoin-network
│   ├── prompts/
│   │   ├── analyze-holder.ts     # Prompt template for holder analysis
│   │   ├── market-report.ts      # Prompt template for market report
│   │   ├── whale-alert.ts        # Prompt template for whale detection
│   │   └── portfolio-check.ts    # Prompt template for address check
│   ├── transport/
│   │   ├── stdio.ts              # STDIO transport (Claude Desktop)
│   │   └── http.ts               # Streamable HTTP transport (remote)
│   ├── auth/
│   │   └── api-keys.ts           # API key validation for MCP
│   ├── utils/
│   │   ├── data-loader.ts        # Shared data loading logic
│   │   └── formatters.ts         # Response formatting for agents
│   ├── package.json
│   └── tsconfig.json
```

### 2.2 Dependências

```json
{
  "name": "@dogdata/mcp-server",
  "version": "1.0.0",
  "description": "DOG DATA MCP Server — Real-time DOG rune data for AI agents",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "zod": "^3.24.0",
    "@upstash/redis": "^1.34.0",
    "@supabase/supabase-js": "^2.47.0"
  },
  "engines": {
    "node": ">=22.18.0"
  }
}
```

### 2.3 Implementação do Server Core

```typescript
// mcp-server/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "dogdata",
  version: "1.0.0",
  description: "Real-time DOG•GO•TO•THE•MOON rune data on Bitcoin L1. " +
    "89,000+ holders, 250,000+ UTXOs, forensic analysis, " +
    "multi-exchange pricing, and on-chain metrics."
});

// Tools registrados nas seções seguintes (Seção 7)
// Resources registrados na Seção 8
```

### 2.4 Transports

**STDIO** (para Claude Desktop e Claude Code):
```typescript
// mcp-server/transport/stdio.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const transport = new StdioServerTransport();
await server.connect(transport);
// IMPORTANTE: Nunca usar console.log() — corrompe JSON-RPC via stdio
// Usar console.error() para logging
```

**Streamable HTTP** (para agentes remotos):
```typescript
// mcp-server/transport/http.ts
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

const app = express();
app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.writeHead(200, { "Content-Type": "application/json" });
  await server.connect(transport);
  await transport.handleRequest(req, res);
});
// Roda na porta 3002 ou integrado ao Next.js
```

### 2.5 Publicação

- Publicar no **npm** como `@dogdata/mcp-server`
- Registrar no **MCP Server Directory** (modelcontextprotocol.io)
- Configuração para Claude Desktop:
```json
{
  "mcpServers": {
    "dogdata": {
      "command": "npx",
      "args": ["@dogdata/mcp-server"]
    }
  }
}
```

### 2.6 Entregáveis Fase 1

- [ ] MCP Server funcional com 12 tools, 8 resources, 4 prompts
- [ ] Transport STDIO para Claude Desktop/Code
- [ ] Transport HTTP para agentes remotos
- [ ] Publicado no npm
- [ ] Registrado no MCP Directory
- [ ] README com instruções de instalação
- [ ] Testes de integração com Claude

---

## 3. Fase 2 — OpenAPI Spec + Portal de Documentação

**Impacto:** Qualquer agente pode auto-descobrir e consumir APIs
**Prioridade:** ALTA
**Execução:** Sub-agente dedicado — gera Zod schemas, OpenAPI spec, response padronizado

### 3.1 OpenAPI 3.0 Specification

Gerar spec completa para todos os endpoints REST. Usar `next-openapi-gen` + Zod schemas como source of truth.

```yaml
# openapi.yaml (resumo estrutural)
openapi: "3.0.3"
info:
  title: "DOG DATA API"
  version: "1.0.0"
  description: |
    The world's most comprehensive data API for DOG•GO•TO•THE•MOON rune on Bitcoin L1.
    Real-time holder tracking, UTXO analysis, forensic behavioral profiling,
    multi-exchange pricing, and on-chain metrics.
  contact:
    name: "DOG DATA Team"
    url: "https://www.dogdata.xyz"
  license:
    name: "Proprietary"

servers:
  - url: "https://api.dogdata.xyz/v1"
    description: "Production API"
  - url: "https://www.dogdata.xyz/api"
    description: "Legacy API (will be deprecated)"

tags:
  - name: holders
    description: "DOG rune holder data — 89,000+ unique addresses"
  - name: transactions
    description: "Real-time DOG transaction tracking"
  - name: price
    description: "Multi-exchange pricing from 8+ sources"
  - name: metrics
    description: "On-chain analytics — UTXO, concentration, realized cap"
  - name: forensic
    description: "Behavioral analysis & Diamond Score profiling"
  - name: airdrop
    description: "Airdrop recipient analysis — 75,000+ addresses"
  - name: bitcoin
    description: "Bitcoin network status — blocks, hashrate, mempool"
  - name: markets
    description: "Aggregated market data across exchanges"
  - name: agent
    description: "Agent discovery & capability endpoints"
```

### 3.2 Schemas Zod (Source of Truth)

Criar schemas Zod compartilhados entre API routes e OpenAPI:

```
DogData-v1/
├── schemas/
│   ├── holder.ts          # HolderSchema, HolderListSchema
│   ├── transaction.ts     # TransactionSchema, TxListSchema
│   ├── price.ts           # PriceSchema, MultiPriceSchema
│   ├── metrics.ts         # UtxoSchema, ConcentrationSchema, etc.
│   ├── forensic.ts        # ProfileSchema, DiamondScoreSchema
│   ├── airdrop.ts         # RecipientSchema, SummarySchema
│   ├── bitcoin.ts         # NetworkSchema, BlockSchema
│   ├── markets.ts         # MarketSchema, TickerSchema
│   ├── common.ts          # PaginationSchema, MetadataSchema, ErrorSchema
│   └── index.ts           # Re-exports
```

### 3.3 Response Padronizado para Agentes

Todas as respostas seguem formato unificado:

```typescript
interface AgentResponse<T> {
  data: T;                          // Dados solicitados
  metadata: {
    source: string;                 // "dogdata.xyz"
    version: string;                // "1.0.0"
    timestamp: string;              // ISO 8601
    cached: boolean;                // Se veio do cache
    cache_age_seconds?: number;     // Idade do cache
    data_freshness: string;         // "real-time" | "hourly" | "daily"
    block_height?: number;          // Último bloco processado
  };
  pagination?: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}
```

### 3.4 Portal de Documentação

Implementar documentação interativa em `/docs` ou subdomínio `docs.dogdata.xyz`:

- **Swagger UI** ou **Scalar** para playground interativo
- Exemplos de request/response para cada endpoint
- Guia "Getting Started for AI Agents"
- Code snippets em Python, TypeScript, cURL
- Seção dedicada "MCP Integration Guide"

### 3.5 Entregáveis Fase 2

- [ ] OpenAPI 3.0 spec completa para todos os endpoints
- [ ] Zod schemas compartilhados (single source of truth)
- [ ] Response format padronizado implementado em todos os endpoints
- [ ] Suporte a `?fields=` para field selection
- [ ] Portal de documentação interativo
- [ ] Endpoint `GET /api/openapi.json` servindo a spec
- [ ] Guia de integração para agentes

---

## 4. Fase 3 — API Gateway: Auth, Rate Limiting & Tiers

**Impacto:** Segurança e controle para milhares de agentes
**Prioridade:** ALTA
**Execução:** Sub-agente dedicado — implementa auth middleware, rate limiting, API keys

### 4.1 Sistema de API Keys

```
Tabela: api_keys (Supabase)
├── id: uuid (PK)
├── key_hash: text (SHA-256 do API key)
├── key_prefix: text (primeiros 8 chars, para identificação)
├── name: text (nome descritivo)
├── owner_email: text
├── tier: enum (free, pro, enterprise)
├── permissions: text[] (scopes permitidos)
├── created_at: timestamptz
├── expires_at: timestamptz (nullable)
├── last_used_at: timestamptz
├── is_active: boolean
├── metadata: jsonb (informações adicionais)
```

**Formato da API Key:**
```
dog_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx    (produção)
dog_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx    (sandbox)
```

**Header de autenticação:**
```
Authorization: Bearer dog_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 4.2 Middleware de Autenticação

```typescript
// middleware/auth.ts
export async function validateApiKey(req: NextRequest): Promise<ApiKeyInfo | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer dog_")) return null;

  const key = authHeader.slice(7);
  const keyHash = sha256(key);

  // Verificar no Upstash (cache) primeiro, depois Supabase
  let keyInfo = await redis.get(`apikey:${keyHash}`);
  if (!keyInfo) {
    keyInfo = await supabase.from("api_keys")
      .select("*")
      .eq("key_hash", keyHash)
      .eq("is_active", true)
      .single();
    if (keyInfo) await redis.set(`apikey:${keyHash}`, keyInfo, { ex: 300 });
  }

  return keyInfo;
}
```

### 4.3 Rate Limiting via Upstash

```typescript
// middleware/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const rateLimiters = {
  free:       new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, "1h") }),
  pro:        new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5000, "1h") }),
  enterprise: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(50000, "1h") }),
};

// Headers retornados em cada response:
// X-RateLimit-Limit: 5000
// X-RateLimit-Remaining: 4987
// X-RateLimit-Reset: 1710792000
// Retry-After: 120 (quando excedido)
```

### 4.4 Definição de Tiers

Ver seção 10 para detalhamento completo.

### 4.5 Usage Tracking

```
Tabela: api_usage (Supabase)
├── id: bigint (PK)
├── api_key_id: uuid (FK → api_keys)
├── endpoint: text
├── method: text
├── status_code: int
├── response_time_ms: int
├── timestamp: timestamptz
├── ip_address: text
├── user_agent: text
```

Agregação horária para dashboard de analytics.

### 4.6 Entregáveis Fase 3

- [ ] Sistema de API keys (geração, validação, revogação)
- [ ] Rate limiting por tier via Upstash Redis
- [ ] Headers de rate limit em todas as responses
- [ ] Usage tracking em Supabase
- [ ] Dashboard de uso para key owners
- [ ] Endpoint de self-service: `POST /api/keys/generate`
- [ ] Página de signup em dogdata.xyz

---

## 5. Fase 4 — Agent Discovery & SDK

**Impacto:** Agentes podem auto-configurar integração
**Prioridade:** ALTA
**Execução:** Sub-agente dedicado — cria discovery endpoints, well-known, SDKs

### 5.1 Agent Discovery Endpoint

```
GET /api/agent/capabilities
```

Response:
```json
{
  "service": "DOG DATA",
  "version": "1.0.0",
  "description": "World's most comprehensive DOG•GO•TO•THE•MOON data platform",
  "protocols": {
    "rest": {
      "base_url": "https://api.dogdata.xyz/v1",
      "openapi_spec": "https://api.dogdata.xyz/v1/openapi.json",
      "auth": "bearer_token",
      "docs": "https://docs.dogdata.xyz"
    },
    "mcp": {
      "npm_package": "@dogdata/mcp-server",
      "http_endpoint": "https://mcp.dogdata.xyz",
      "transport": ["stdio", "streamable-http"],
      "tools_count": 12,
      "resources_count": 8
    },
    "sse": {
      "endpoint": "https://api.dogdata.xyz/v1/events",
      "events": ["new_transaction", "price_update", "whale_alert", "new_block"]
    }
  },
  "datasets": {
    "holders": {
      "description": "Complete DOG holder list with rankings and UTXO counts",
      "total_records": 89287,
      "update_frequency": "hourly",
      "endpoints": ["/holders", "/holders/{address}"]
    },
    "transactions": {
      "description": "Real-time DOG transactions from Bitcoin L1",
      "update_frequency": "real-time (~30s)",
      "endpoints": ["/transactions", "/transactions/{txid}"]
    },
    "forensic": {
      "description": "Behavioral analysis of 75,490 airdrop recipients",
      "total_profiles": 75490,
      "categories": 14,
      "endpoints": ["/forensic/profiles", "/forensic/summary"]
    },
    "pricing": {
      "description": "Multi-exchange DOG pricing",
      "exchanges": ["kraken", "gateio", "mexc", "bitget", "bitflow", "dogswap"],
      "update_frequency": "30s",
      "endpoints": ["/price", "/price/{exchange}"]
    },
    "metrics": {
      "description": "On-chain analytics: UTXO distribution, concentration, realized cap",
      "endpoints": ["/metrics/utxo", "/metrics/concentration", "/metrics/realized-cap"]
    }
  },
  "data_quality": {
    "source": "Bitcoin Core + Ord (local full node)",
    "indexing_method": "direct block scanning (no third-party APIs)",
    "current_block": 941187,
    "last_scan": "2026-03-18T17:44:38Z"
  },
  "rate_limits": {
    "free": { "requests_per_hour": 100, "description": "For testing and evaluation" },
    "pro": { "requests_per_hour": 5000, "description": "For production agents" },
    "enterprise": { "requests_per_hour": 50000, "description": "For high-volume agents" }
  }
}
```

### 5.2 Well-Known Discovery

Implementar `/.well-known/ai-agent.json` seguindo padrões emergentes:

```json
{
  "schema_version": "1.0",
  "name": "DOG DATA",
  "description": "Real-time DOG•GO•TO•THE•MOON rune data on Bitcoin L1",
  "api": {
    "type": "openapi",
    "url": "https://api.dogdata.xyz/v1/openapi.json"
  },
  "mcp": {
    "url": "https://mcp.dogdata.xyz",
    "npm": "@dogdata/mcp-server"
  },
  "auth": {
    "type": "bearer",
    "signup_url": "https://www.dogdata.xyz/api-keys"
  }
}
```

### 5.3 SDK Leve (TypeScript)

```typescript
// @dogdata/sdk
import { DogData } from "@dogdata/sdk";

const dog = new DogData({ apiKey: "dog_live_xxx" });

// Holder data
const holders = await dog.holders.list({ page: 1, limit: 50 });
const holder = await dog.holders.get("bc1p...");

// Transactions
const txs = await dog.transactions.recent({ limit: 20 });
const tx = await dog.transactions.get("txid...");

// Price
const price = await dog.price.current();         // Kraken (primary)
const prices = await dog.price.all();             // All exchanges
const kraken = await dog.price.exchange("kraken");

// Metrics
const utxo = await dog.metrics.utxo();
const concentration = await dog.metrics.concentration();

// Forensic
const profiles = await dog.forensic.profiles({ pattern: "diamond_hands" });

// Real-time
dog.events.on("new_transaction", (tx) => { ... });
dog.events.on("whale_alert", (alert) => { ... });
```

### 5.4 SDK Python

```python
# dogdata-sdk (PyPI)
from dogdata import DogData

dog = DogData(api_key="dog_live_xxx")

holders = dog.holders.list(page=1, limit=50)
holder = dog.holders.get("bc1p...")
price = dog.price.current()
txs = dog.transactions.recent(limit=20)
```

### 5.5 Entregáveis Fase 4

- [ ] Endpoint `/api/agent/capabilities`
- [ ] `/.well-known/ai-agent.json`
- [ ] SDK TypeScript publicado no npm (`@dogdata/sdk`)
- [ ] SDK Python publicado no PyPI (`dogdata-sdk`)
- [ ] Exemplos de integração para os 3 protocolos (REST, MCP, SSE)

---

## 6. Fase 5 — Escalabilidade & Observabilidade

**Impacto:** Suportar milhares de conexões simultâneas
**Prioridade:** ALTA
**Execução:** Sub-agente dedicado — expande cache, SSE, alerting

### 6.1 Cache Layer Expandido

```
Estratégia de Cache Multi-Tier:

Tier 1 — In-Memory (Node.js)
├── Price data: 30s TTL
├── Bitcoin network: 30s TTL
├── Stats/counts: 60s TTL
└── Capacidade: ~100MB

Tier 2 — Upstash Redis (Distribuído)
├── Holder queries: 5min TTL
├── Transaction lists: 3min TTL
├── Metrics: 5min TTL
├── Rate limit counters: sliding window
├── API key cache: 5min TTL
└── Capacidade: configurável

Tier 3 — CDN (Vercel Edge / Cloudflare)
├── OpenAPI spec: 1h
├── Agent capabilities: 5min
├── Static holder snapshots: 1h
└── Capacidade: global edge
```

### 6.2 Observabilidade

```
Métricas a rastrear:

Performance:
├── p50/p95/p99 response time por endpoint
├── Requests por segundo (RPS) global e por tier
├── Cache hit ratio por endpoint
├── Error rate (4xx, 5xx) por endpoint
└── Uptime (target: 99.9%)

Negócio:
├── Total API keys ativas
├── Requests por API key (top consumers)
├── Endpoints mais populares
├── Agentes únicos por dia
├── Crescimento de keys por semana
└── Revenue por tier (quando monetizado)

Infraestrutura:
├── Scanner block lag (current block - scanned block)
├── Data freshness (age of latest data)
├── Redis memory usage
├── Supabase connection pool
└── Vercel function cold starts
```

### 6.3 Alerting

```
Alertas críticos:
├── Scanner offline > 5 minutos
├── Block lag > 3 blocos
├── Error rate > 5% em 5 minutos
├── Response time p95 > 2 segundos
├── Redis connection failure
└── Supabase connection failure

Alertas informativos:
├── Novo API key registrado
├── Key atingiu 80% do rate limit
├── Whale transaction detectada (> 1M DOG)
└── Novo holder milestone (90k, 100k, etc.)
```

### 6.4 SSE Expandido para Agentes

Expandir o endpoint `/api/events` com eventos estruturados:

```typescript
// Eventos disponíveis para agentes
interface DogDataEvents {
  "new_transaction": {
    txid: string;
    type: string;
    total_dog_moved: number;
    sender_count: number;
    receiver_count: number;
    block_height: number;
  };
  "whale_alert": {
    txid: string;
    amount_dog: number;
    from: string;
    to: string;
    type: "accumulation" | "distribution" | "transfer";
  };
  "price_update": {
    exchange: string;
    price_usd: number;
    change_24h: number;
    volume_24h: number;
  };
  "new_block": {
    height: number;
    dog_tx_count: number;
    total_dog_moved: number;
  };
  "holder_milestone": {
    total_holders: number;
    milestone: number;
    timestamp: string;
  };
}
```

### 6.5 Entregáveis Fase 5

- [ ] Cache multi-tier implementado
- [ ] Dashboard de observabilidade
- [ ] Sistema de alertas
- [ ] SSE expandido com 5+ tipos de evento
- [ ] Load testing (target: 1000 req/s)
- [ ] Documentação de SLA

---

## 7. Definição dos Tools MCP

Os tools são ações que agentes podem executar. Cada tool é uma function com inputs tipados e output estruturado.

### Tool 1: `get_dog_holders`
```
Descrição: Get paginated list of DOG rune holders on Bitcoin L1
Inputs:
  - page: number (default: 1)
  - limit: number (default: 50, max: 100)
  - sort: "rank" | "balance" | "utxo_count" (default: "rank")
Output: Lista de holders com rank, address, balance, utxo_count
Data Source: dog_holders_by_address.json
```

### Tool 2: `search_holder`
```
Descrição: Search for a specific DOG holder by Bitcoin address
Inputs:
  - address: string (Bitcoin address, required)
Output: Holder detail com rank, balance, UTXOs, airdrop status, forensic profile
Data Source: dog_holders_by_address.json + forensic_behavioral_analysis.json
```

### Tool 3: `get_recent_transactions`
```
Descrição: Get recent DOG transactions from Bitcoin blockchain
Inputs:
  - limit: number (default: 20, max: 100)
  - type: "all" | "transfer" | "consolidation" | "burn" (default: "all")
  - min_amount: number (optional, minimum DOG amount filter)
Output: Lista de transações com txid, type, senders, receivers, amount
Data Source: Upstash Redis (dog:transactions)
```

### Tool 4: `search_transaction`
```
Descrição: Search for a specific DOG transaction by txid
Inputs:
  - txid: string (required)
Output: Transaction detail com senders, receivers, amounts, fees
Data Source: Upstash Redis → Supabase → Unisat fallback
```

### Tool 5: `get_dog_price`
```
Descrição: Get current DOG price from primary exchange (Kraken)
Inputs: none
Output: price_usd, change_24h, volume_24h, high_24h, low_24h
Data Source: Kraken API (cached 30s)
```

### Tool 6: `get_multi_exchange_prices`
```
Descrição: Get DOG price from all tracked exchanges simultaneously
Inputs:
  - exchanges: string[] (optional, filter specific exchanges)
Output: Array de {exchange, price, change_24h, volume_24h, spread}
Data Source: All 8 exchange APIs
```

### Tool 7: `get_onchain_metrics`
```
Descrição: Get comprehensive on-chain metrics for DOG rune
Inputs:
  - metrics: string[] (optional, filter specific metrics)
Output: total_utxos, total_holders, gini_coefficient, top10/100/1000 concentration,
        realized_cap, mvrv_ratio, supply_in_profit/loss, avg_utxo_age
Data Source: Local JSON + Supabase
```

### Tool 8: `get_metrics_history`
```
Descrição: Get historical time-series of DOG on-chain metrics
Inputs:
  - range: "24h" | "7d" | "30d" | "90d" | "all" (default: "30d")
  - metrics: string[] (optional, filter specific metrics)
Output: Array de data points com timestamp + valores
Data Source: Supabase (dog_metrics_history)
```

### Tool 9: `get_forensic_profiles`
```
Descrição: Get behavioral analysis profiles of DOG airdrop recipients
Inputs:
  - page: number (default: 1)
  - limit: number (default: 50)
  - pattern: string (optional, filter by behavior pattern)
  - min_diamond_score: number (optional, 0-100)
Output: Profiles com diamond_score, behavior_category, retention_rate, etc.
Data Source: forensic_behavioral_analysis.json
```

### Tool 10: `get_airdrop_analysis`
```
Descrição: Get DOG airdrop distribution and retention analysis
Inputs: none
Output: total_recipients, retention_rate, behavior_distribution, categories
Data Source: airdrop_analytics.json
```

### Tool 11: `get_bitcoin_network`
```
Descrição: Get Bitcoin network status (blocks, hashrate, mempool, fees)
Inputs: none
Output: latest_block, difficulty, hashrate, mempool_size, fee_estimates, mining_pools
Data Source: Mempool.space API (cached 30s)
```

### Tool 12: `get_market_data`
```
Descrição: Get aggregated DOG market data across all exchanges
Inputs: none
Output: tickers array, market_cap, total_volume, weighted_avg_price
Data Source: CoinGecko + exchange APIs
```

---

## 8. Definição dos Resources MCP

Resources são dados read-only que agentes podem incorporar como contexto.

### Resource 1: `dog://stats`
```
Descrição: Current DOG rune statistics snapshot
URI: dog://stats
MIME: application/json
Dados: total_holders, total_supply, circulating_supply, total_utxos,
       current_price, market_cap, 24h_volume, last_block_scanned
Atualização: a cada request (cached 60s)
```

### Resource 2: `dog://top-holders`
```
Descrição: Top 100 DOG holders with rankings
URI: dog://top-holders
MIME: application/json
Dados: Array dos 100 maiores holders (rank, address, balance, % of supply)
Atualização: hourly
```

### Resource 3: `dog://supply-info`
```
Descrição: DOG supply distribution and tokenomics
URI: dog://supply-info
MIME: application/json
Dados: total_supply, circulating, burned, airdrop_allocation,
       concentration_metrics (gini, top10%, top100%)
Atualização: hourly
```

### Resource 4: `dog://bitcoin-network`
```
Descrição: Current Bitcoin network status relevant to DOG
URI: dog://bitcoin-network
MIME: application/json
Dados: block_height, hashrate, difficulty, mempool_size, avg_fee
Atualização: 30s cache
```

### Resource 5: `dog://price-summary`
```
Descrição: DOG price across all tracked exchanges
URI: dog://price-summary
MIME: application/json
Dados: Array de {exchange, price, volume, change_24h}
Atualização: 30s cache
```

### Resource 6: `dog://forensic-summary`
```
Descrição: Aggregated behavioral analysis of DOG community
URI: dog://forensic-summary
MIME: application/json
Dados: total_analyzed, category_distribution, avg_diamond_score,
       retention_stats, behavior_patterns
Atualização: daily
```

### Resource 7: `dog://utxo-distribution`
```
Descrição: DOG UTXO size and age distribution
URI: dog://utxo-distribution
MIME: application/json
Dados: size_buckets, age_buckets, hodl_waves, sth_lth_ratio
Atualização: hourly
```

### Resource 8: `dog://airdrop-summary`
```
Descrição: DOG airdrop distribution and recipient behavior summary
URI: dog://airdrop-summary
MIME: application/json
Dados: total_recipients, retention_rate, category_breakdown
Atualização: daily
```

---

## 9. Schema de API Unificado

### 9.1 Endpoints Consolidados (Nova Estrutura)

A API unificada reorganiza os 29 endpoints existentes em uma estrutura limpa e consistente:

```
BASE: https://api.dogdata.xyz/v1

# Core Data
GET  /v1/stats                           → Estatísticas gerais
GET  /v1/holders                         → Lista paginada de holders
GET  /v1/holders/:address                → Detalhe de holder específico
GET  /v1/holders/snapshot                → Top 500 holders (snapshot rápido)

# Transactions
GET  /v1/transactions                    → Transações recentes
GET  /v1/transactions/:txid              → Busca por txid
GET  /v1/transactions/heatmap            → Heatmap de atividade

# Pricing
GET  /v1/price                           → Preço primário (Kraken)
GET  /v1/price/all                       → Todos os exchanges
GET  /v1/price/:exchange                 → Exchange específico

# On-Chain Metrics
GET  /v1/metrics                         → Métricas atuais consolidadas
GET  /v1/metrics/history                 → Séries temporais
GET  /v1/metrics/utxo                    → Distribuição de UTXOs
GET  /v1/metrics/utxo-age               → Idade dos UTXOs (HODL waves)
GET  /v1/metrics/concentration           → Concentração (Gini, top%)
GET  /v1/metrics/realized-cap            → Realized cap & MVRV
GET  /v1/metrics/supply                  → Supply in profit/loss

# Forensic Analysis
GET  /v1/forensic/profiles               → Perfis comportamentais
GET  /v1/forensic/summary                → Resumo forense
GET  /v1/forensic/:address               → Perfil de endereço específico

# Airdrop
GET  /v1/airdrop/summary                 → Resumo do airdrop
GET  /v1/airdrop/recipients              → Lista de recipientes

# Bitcoin Network
GET  /v1/bitcoin                         → Status da rede Bitcoin

# Markets
GET  /v1/markets                         → Dados agregados de mercado

# Agent Discovery
GET  /v1/agent/capabilities              → Capacidades da plataforma
GET  /v1/openapi.json                    → OpenAPI 3.0 spec

# Real-time
GET  /v1/events                          → SSE stream

# System
GET  /v1/health                          → Health check
GET  /v1/status                          → System status
```

### 9.2 Query Parameters Universais

Todos os endpoints list suportam:

| Param | Tipo | Descrição |
|-------|------|-----------|
| `page` | int | Página (default: 1) |
| `limit` | int | Items por página (default: 50, max: 100) |
| `fields` | string | Campos a retornar (comma-separated) |
| `format` | string | `json` (default) ou `csv` |
| `pretty` | bool | JSON formatado (para debug) |

### 9.3 Error Responses Padronizadas

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Upgrade to Pro for 5,000 requests/hour.",
    "status": 429,
    "retry_after": 120,
    "docs_url": "https://docs.dogdata.xyz/rate-limits"
  }
}
```

Códigos de erro:
- `UNAUTHORIZED` (401) — API key ausente ou inválida
- `FORBIDDEN` (403) — Permissão insuficiente
- `NOT_FOUND` (404) — Recurso não encontrado
- `RATE_LIMIT_EXCEEDED` (429) — Rate limit excedido
- `INTERNAL_ERROR` (500) — Erro interno
- `SERVICE_UNAVAILABLE` (503) — Dados indisponíveis temporariamente

---

## 10. Sistema de Tiers & Rate Limiting

### 10.1 Tier Definitions

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| **Requests/hora** | 100 | 5.000 | 50.000 |
| **Requests/dia** | 1.000 | 100.000 | 1.000.000 |
| **Endpoints** | Todos (read) | Todos (read) | Todos + SSE + Webhooks |
| **Rate limit** | 2 req/s | 20 req/s | 100 req/s |
| **Cache** | 5min min | 1min min | Real-time |
| **Field selection** | Não | Sim | Sim |
| **CSV export** | Não | Sim | Sim |
| **Bulk queries** | Não | Até 10 addresses | Até 100 addresses |
| **SSE stream** | Não | Não | Sim |
| **Webhook alerts** | Não | Não | Sim |
| **SLA** | Best effort | 99.5% | 99.9% |
| **Suporte** | Docs only | Email | Dedicado |
| **Preço** | Grátis | DOG tokens* | Negociável |

*Pagamento em DOG tokens é o modelo preferencial — alinhamento com o ecossistema.

### 10.2 Acesso Público sem Key

Endpoints que não requerem API key (para acessibilidade):
- `GET /v1/stats` — Estatísticas básicas
- `GET /v1/price` — Preço atual
- `GET /v1/health` — Health check
- `GET /v1/agent/capabilities` — Discovery

Rate limit sem key: 20 requests/hora por IP.

---

## 11. Infraestrutura & Deploy

### 11.1 Domínios

| Domínio | Propósito |
|---------|-----------|
| `www.dogdata.xyz` | Frontend (dashboard, signup) |
| `api.dogdata.xyz` | REST API (v1) |
| `mcp.dogdata.xyz` | MCP Server (Streamable HTTP) |
| `docs.dogdata.xyz` | Portal de documentação |

### 11.2 Stack de Deploy

```
Frontend + API Routes:
├── Vercel (Next.js) — auto-scaling, edge network
├── Custom domain: api.dogdata.xyz → Vercel
└── Environment: SUPABASE_*, UPSTASH_*, API secrets

MCP Server:
├── Opção A: Vercel Functions (integrado)
├── Opção B: Cloudflare Workers (edge global)
├── Opção C: Railway/Fly.io (container dedicado)
└── npm package: @dogdata/mcp-server (stdio)

Data Infrastructure:
├── Bitcoin Core + Ord (VPS dedicado — atual)
├── dog_block_scanner.py (systemd service — atual)
├── Upstash Redis (cache distribuído — atual)
├── Supabase PostgreSQL (dados históricos — atual)
└── Local JSON files (dados primários — atual)
```

### 11.3 CI/CD Pipeline

```
GitHub Push
  → Vercel auto-deploy (frontend + API)
  → npm publish @dogdata/mcp-server (on tag)
  → PyPI publish dogdata-sdk (on tag)
  → OpenAPI spec validation (CI check)
  → Integration tests contra staging
```

---

## 12. Métricas de Sucesso

### 12.1 KPIs de Lançamento (Mês 1)

| Métrica | Target |
|---------|--------|
| API keys geradas | 100+ |
| Requests/dia | 10.000+ |
| MCP installs (npm) | 50+ |
| Uptime | 99.5% |
| Avg response time | < 500ms |
| Endpoints documentados | 100% |

### 12.2 KPIs de Crescimento (Mês 3)

| Métrica | Target |
|---------|--------|
| API keys ativas | 500+ |
| Requests/dia | 100.000+ |
| Agentes únicos/dia | 200+ |
| Pro tier subscribers | 50+ |
| MCP installs (npm) | 500+ |
| Menções em AI/crypto communities | 20+ |

### 12.3 KPIs de Escala (Mês 6)

| Métrica | Target |
|---------|--------|
| API keys ativas | 2.000+ |
| Requests/dia | 1.000.000+ |
| Enterprise clients | 10+ |
| Revenue mensal (DOG) | Sustentável |
| Uptime | 99.9% |
| Referência em rankings | Top 3 DOG data providers |

---

## 13. Riscos & Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| **Sobrecarga no Bitcoin node** | Média | Alto | Rate limiting rigoroso, cache agressivo, réplica read-only |
| **Abuso de API keys free** | Alta | Médio | Rate limiting por IP + key, CAPTCHA no signup, ban automático |
| **Downtime do scanner** | Baixa | Alto | Alerting < 5min, dados cached servem por horas, fallback APIs |
| **Concorrência** | Baixa | Médio | Vantagem: único com scanner próprio + forense, MCP first-mover |
| **Custos Upstash/Supabase** | Média | Médio | Monitorar uso, otimizar queries, tier free com limites |
| **Mudanças no protocolo MCP** | Média | Médio | Seguir spec oficial, SDK abstrai transport layer |
| **DDoS** | Média | Alto | Cloudflare/Vercel proteção, rate limiting distribuído |
| **Data staleness** | Baixa | Alto | Monitorar scanner lag, health checks automáticos |

---

## 14. Plano de Execução Agêntica

Este plano é projetado para execução simultânea por múltiplos sub-agentes de IA. Cada agente recebe uma fase e implementa de forma autônoma.

### Arquitetura de Sub-Agentes

```
┌─────────────────────────────────────────────────────────┐
│                  AGENTE ORQUESTRADOR                    │
│         (coordena, resolve conflitos, integra)          │
└────┬──────────┬──────────┬──────────┬──────────┬────────┘
     │          │          │          │          │
     ▼          ▼          ▼          ▼          ▼
┌─────────┐┌─────────┐┌─────────┐┌─────────┐┌─────────┐
│ Agent 1 ││ Agent 2 ││ Agent 3 ││ Agent 4 ││ Agent 5 │
│ MCP     ││ OpenAPI ││ Gateway ││Discovery││ Scale   │
│ Server  ││ + Docs  ││ + Auth  ││ + SDK   ││ + Obs   │
└─────────┘└─────────┘└─────────┘└─────────┘└─────────┘
```

### Agent 1 — MCP Server (CRÍTICO, executa primeiro)
```
Responsabilidades:
├── Criar /mcp-server/ com toda a estrutura
├── Implementar McpServer com 12 tools
├── Implementar 8 resources
├── Implementar 4 prompts
├── Transport STDIO + Streamable HTTP
├── Data loaders (lê JSON local, Upstash, Supabase)
├── package.json + tsconfig.json
└── README com instruções de instalação

Dependências: Nenhuma (usa dados existentes)
Output: MCP Server funcional testável localmente
```

### Agent 2 — OpenAPI + Schemas (paralelo ao Agent 1)
```
Responsabilidades:
├── Criar /schemas/ com Zod schemas para todos os tipos
├── Gerar openapi.json completo (OpenAPI 3.0)
├── Implementar response wrapper padronizado (AgentResponse<T>)
├── Adicionar suporte a ?fields= nos endpoints existentes
├── Criar endpoint GET /api/openapi.json
└── Refatorar endpoints existentes para usar schemas compartilhados

Dependências: Nenhuma (documenta endpoints existentes)
Output: Spec OpenAPI completa + schemas Zod reutilizáveis
```

### Agent 3 — API Gateway (paralelo, precisa dos schemas do Agent 2)
```
Responsabilidades:
├── Criar tabelas api_keys e api_usage no Supabase
├── Implementar middleware de autenticação
├── Implementar rate limiting via Upstash (@upstash/ratelimit)
├── Headers X-RateLimit-* em todas as responses
├── Endpoint POST /api/keys/generate
├── Error responses padronizadas
└── Usage tracking (log de requests)

Dependências: Schemas do Agent 2 (para error responses)
Output: Auth + rate limiting funcional
```

### Agent 4 — Agent Discovery + SDK (paralelo)
```
Responsabilidades:
├── Endpoint GET /api/agent/capabilities
├── Arquivo /.well-known/ai-agent.json (public/)
├── SDK TypeScript (@dogdata/sdk) em /sdk/typescript/
├── SDK Python (dogdata-sdk) em /sdk/python/
└── Exemplos de integração

Dependências: Nenhuma (consome APIs existentes)
Output: Discovery endpoint + SDKs publicáveis
```

### Agent 5 — Escalabilidade + SSE (paralelo)
```
Responsabilidades:
├── Expandir /api/events com tipos de evento estruturados
├── Implementar cache multi-tier (in-memory → Redis → CDN headers)
├── Health check endpoint (/api/health com métricas)
├── Status endpoint (/api/status com scanner state)
└── Otimizar endpoints existentes com cache headers

Dependências: Nenhuma (melhora infraestrutura existente)
Output: SSE expandido + cache otimizado
```

### Ordem de Execução

```
PARALELO ──────────────────────────────────────────►

Agent 1 (MCP Server)      ████████████████████████
Agent 2 (OpenAPI/Schemas)  ████████████████████████
Agent 4 (Discovery/SDK)    ████████████████████████
Agent 5 (Scale/SSE)        ████████████████████████

SEQUENCIAL (após Agent 2) ─────────────────────────►

Agent 3 (Gateway/Auth)              ████████████████

INTEGRAÇÃO FINAL ──────────────────────────────────►

Orquestrador              ░░░░░░░░░░░░░░██████████
                          (monitora)    (integra)
```

### Instruções para o Orquestrador

1. Lançar Agents 1, 2, 4 e 5 em paralelo imediatamente
2. Quando Agent 2 completar os Zod schemas, lançar Agent 3
3. Quando todos completarem, fazer integração final:
   - MCP Server importa schemas do Agent 2
   - Gateway middleware aplicado nos endpoints do MCP e REST
   - Discovery endpoint reflete tools/resources do MCP Server
   - SDKs testados contra a API com auth
4. Validar tudo funciona end-to-end
5. Deploy

---

## Apêndice A — Competitive Advantage

### Por que o DOG DATA será a referência mundial:

1. **Scanner próprio** — Único projeto que indexa DOG diretamente do Bitcoin Core + Ord, sem dependência de APIs terceiras (Xverse, Unisat, Hiro). Dados de primeira mão.

2. **Análise forense** — 75.490 perfis comportamentais com Diamond Score, 14 categorias de comportamento. Nenhum outro projeto DOG oferece isso.

3. **MCP first-mover** — Seremos um dos primeiros projetos crypto com MCP Server nativo. Agentes Claude terão acesso direto.

4. **Cobertura de preço** — 6 exchanges simultâneos (Kraken, Gate.io, MEXC, Bitget, Bitflow, Dogswap). Visão completa do mercado.

5. **On-chain metrics profundas** — Gini coefficient, HODL waves, realized cap, MVRV, supply in profit/loss. Nível de análise comparável ao Glassnode, mas específico para DOG.

6. **Real-time** — Scanner processa blocos em ~30s. Dados quase em tempo real, não snapshots diários.

7. **Full-stack** — Do Bitcoin node até o frontend. Controle total da stack.

### Comparação com alternativas:

| Feature | DOG DATA | Unisat | Xverse | Magic Eden |
|---------|----------|--------|--------|------------|
| Holder list completa | ✅ 89k+ | ❌ | ❌ | ❌ |
| Scanner próprio | ✅ | ❌ | ❌ | ❌ |
| Análise forense | ✅ 14 categorias | ❌ | ❌ | ❌ |
| Diamond Score | ✅ | ❌ | ❌ | ❌ |
| UTXO analytics | ✅ 250k+ | ❌ | ❌ | ❌ |
| Multi-exchange prices | ✅ 8 exchanges | ❌ | ❌ ✅ 1 |
| MCP Server | ✅ (em breve) | ❌ | ❌ | ❌ |
| API para agentes | ✅ (em breve) | Limitado | Limitado | Limitado |
| On-chain metrics | ✅ Glassnode-level | ❌ | ❌ | ❌ |
| Real-time txs | ✅ ~30s | ✅ | ✅ | ❌ |

---

## Apêndice B — Quick Start para Agentes

### Usando via MCP (Claude Desktop/Code):

```json
{
  "mcpServers": {
    "dogdata": {
      "command": "npx",
      "args": ["@dogdata/mcp-server"]
    }
  }
}
```

Depois, qualquer agente Claude pode perguntar:
- "Quantos holders o DOG tem?"
- "Qual o preço do DOG agora?"
- "Mostre as últimas transações whale de DOG"
- "Qual o Diamond Score do endereço bc1p...?"

### Usando via REST API:

```bash
# Sem key (20 req/hora)
curl https://api.dogdata.xyz/v1/stats

# Com key
curl -H "Authorization: Bearer dog_live_xxx" \
  https://api.dogdata.xyz/v1/holders?limit=10

# Field selection (Pro+)
curl -H "Authorization: Bearer dog_live_xxx" \
  "https://api.dogdata.xyz/v1/holders?fields=address,total_dog,rank&limit=100"
```

### Usando via SDK:

```typescript
import { DogData } from "@dogdata/sdk";
const dog = new DogData({ apiKey: "dog_live_xxx" });
const { data } = await dog.holders.list({ limit: 10 });
console.log(`DOG has ${data.pagination.total} holders`);
```

---

*DOG DATA — The world's most comprehensive DOG•GO•TO•THE•MOON data platform for AI agents.*

*DOG GO TO THE MOON 🌙*
