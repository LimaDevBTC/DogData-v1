# DOG DATA — Agentic Data Server
## Plano de Implementação para Servidor Mundial de Dados DOG para Agentes de IA

**Versão:** 2.0
**Data:** 2026-03-25
**Revisão anterior:** 2026-03-18 (v1.0)
**Status:** FASE DE VISIBILIDADE — infraestrutura pronta, descoberta invisível
**Modo:** Agêntico — fases executadas em paralelo por sub-agentes
**Visão:** Tornar o DOG DATA a referência mundial em dados on-chain do DOG•GO•TO•THE•MOON para centenas de agentes de IA autônomos.

---

## Resumo do Estado Atual (2026-03-25)

### O que foi construído (Fases 1-4: ~80% concluído)

A infraestrutura core está **implementada e em produção** em `dogdata.xyz`:

| Componente | Status | Detalhes |
|---|---|---|
| MCP Server | **PRODUÇÃO** | 12 tools, 8 resources, 4 prompts, HTTP + STDIO |
| REST API | **PRODUÇÃO** | 35 endpoints em 11 categorias |
| OpenAPI 3.0.3 | **PRODUÇÃO** | Spec completa em `/api/openapi.json` |
| API Gateway | **PRODUÇÃO** | Auth bearer, 4 tiers, rate limiting Redis |
| API Keys | **PRODUÇÃO** | Geração, validação, SHA256, Supabase |
| Rate Limiting | **PRODUÇÃO** | 20/100/5.000/50.000 req/hr por tier |
| SSE Events | **PRODUÇÃO** | transactions, whale alerts, price, heartbeat |
| Agent Discovery | **PRODUÇÃO** | `/.well-known/ai-agent.json` + `/api/agent/capabilities` |
| SDK TypeScript | **CÓDIGO PRONTO** | `@dogdata/sdk` em `/sdk/typescript/` |
| SDK Python | **CÓDIGO PRONTO** | `dogdata` em `/sdk/python/` |
| Health/Status | **PRODUÇÃO** | `/api/health` (Redis 13ms) + `/api/status` (35 endpoints) |

### Health Check ao Vivo (2026-03-25T17:24Z)

```
/api/status    → 200 OK — v1.0.0, 89.194 holders, 35 endpoints, 11 categorias
/api/health    → 200 OK — Redis 13ms, Holders 493ms, Transactions cached
/api/agent/capabilities → 200 OK — Documento completo de capabilities
/api/openapi.json → 200 OK — OpenAPI 3.0.3 spec completa
```

### O PROBLEMA CRÍTICO: Agentes não encontram nada

**Feedback real do agente Xored Pike (2026-03-25):**

> "O site é 100% client-side (Next.js SPA) — não dá pra scrape via fetch.
> Sem API pública documentada (nem /api, nem sitemap, nem docs).
> GitHub vazio — 0 repos públicos na org github.com/dogdata.
> Sem presença significativa no X/Twitter.
> **Problema: sem API pública, o agente não consegue consumir dados programaticamente.**"

**Diagnóstico: a infraestrutura está completa mas INVISÍVEL.**

| Recurso de Discovery | Status | Impacto |
|---|---|---|
| `/api` (raiz) | **404** | Primeira coisa que todo agente tenta |
| `/docs` | **404** | Devs e agentes procuram docs aqui |
| `/robots.txt` | **404** | Crawlers não sabem o que indexar |
| `/sitemap.xml` | **404** | Buscadores não indexam as rotas |
| GitHub `dogdata` org | **0 repos públicos** | Parece projeto fantasma |
| npm `@dogdata/mcp-server` | **Não publicado** | Agentes Claude não conseguem instalar |
| PyPI `dogdata` | **Não publicado** | Agentes Python não conseguem instalar |
| Homepage meta tags | **Client-side only** | Crawlers veem página em branco |
| Twitter/X | **Sem presença** | Zero social proof |

**Conclusão:** Construímos a melhor API de dados DOG do mundo e ninguém sabe que ela existe.

---

## Índice

1. [Arquitetura Geral](#1-arquitetura-geral)
2. [Fase 1 — MCP Server](#2-fase-1--mcp-server) ✅ CONCLUÍDA
3. [Fase 2 — OpenAPI Spec + Schemas](#3-fase-2--openapi-spec--schemas) ✅ CONCLUÍDA
4. [Fase 3 — API Gateway: Auth, Rate Limiting & Tiers](#4-fase-3--api-gateway-auth-rate-limiting--tiers) ✅ CONCLUÍDA
5. [Fase 4 — Agent Discovery & SDK](#5-fase-4--agent-discovery--sdk) ⚠️ PARCIAL
6. [Fase 5 — DISCOVERABILITY: A Fase Invisível](#6-fase-5--discoverability-a-fase-invisível) 🔴 CRÍTICA — EXECUTAR AGORA
7. [Fase 6 — Escalabilidade & Observabilidade](#7-fase-6--escalabilidade--observabilidade) ⏳ PENDENTE
8. [Definição dos Tools MCP](#8-definição-dos-tools-mcp)
9. [Definição dos Resources MCP](#9-definição-dos-resources-mcp)
10. [Schema de API Unificado](#10-schema-de-api-unificado)
11. [Sistema de Tiers & Rate Limiting](#11-sistema-de-tiers--rate-limiting)
12. [Infraestrutura & Deploy](#12-infraestrutura--deploy)
13. [Métricas de Sucesso](#13-métricas-de-sucesso)
14. [Riscos & Mitigações](#14-riscos--mitigações)
15. [Plano de Execução Agêntica](#15-plano-de-execução-agêntica)

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
│                   DISCOVERY LAYER (FASE 5 — NOVO)               │
│                                                                 │
│  ┌────────────┐ ┌────────────┐ ┌───────────┐ ┌──────────────┐  │
│  │ /api index │ │ /docs page │ │ robots.txt│ │ sitemap.xml  │  │
│  │ (discovery)│ │ (Scalar UI)│ │ + SEO     │ │ + meta tags  │  │
│  └────────────┘ └────────────┘ └───────────┘ └──────────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                     API GATEWAY LAYER ✅                         │
│                                                                 │
│  ┌─────────────┐  ┌──────────┐  ┌───────────┐  ┌────────────┐  │
│  │ Auth &      │  │ Rate     │  │ Request   │  │ Usage      │  │
│  │ API Keys    │  │ Limiter  │  │ Validator │  │ Tracker    │  │
│  └─────────────┘  └──────────┘  └───────────┘  └────────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                     PROTOCOL LAYER ✅                            │
│                                                                 │
│  ┌──────────────────────┐  ┌─────────────────────────────────┐  │
│  │ MCP Server ✅         │  │ REST API (Next.js /api/) ✅      │  │
│  │ (Streamable HTTP +   │  │ (35 endpoints em produção)      │  │
│  │  stdio transport)    │  │                                 │  │
│  │                      │  │ • OpenAPI 3.0.3 Spec ✅          │  │
│  │ • 12 Tools ✅         │  │ • JSON responses padronizadas  │  │
│  │ • 8 Resources ✅      │  │ • SSE real-time events ✅       │  │
│  │ • 4 Prompts ✅        │  │                                 │  │
│  └──────────┬───────────┘  └──────────────┬──────────────────┘  │
│             │                             │                     │
│             └──────────────┬──────────────┘                     │
└────────────────────────────┼────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                     DATA LAYER ✅                                │
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
│                     INDEXING LAYER ✅                             │
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

## 2. Fase 1 — MCP Server ✅ CONCLUÍDA

**Status:** Implementado e funcional em `/mcp-server/`
**Impacto:** Agentes Claude podem consumir dados DOG nativamente

### 2.1 Estrutura Implementada

```
DogData-v1/
├── mcp-server/
│   ├── index.ts                  ✅ Entry point (STDIO + HTTP modes)
│   ├── server.ts                 ✅ McpServer config + 12 tools + 8 resources + 4 prompts
│   ├── transport/
│   │   └── http.ts               ✅ Express + Streamable HTTP (porta 3002)
│   ├── package.json              ✅ @dogdata/mcp-server
│   ├── tsconfig.json             ✅
│   └── README.md                 ✅ Deploy guide
```

### 2.2 Entregáveis Fase 1

- [x] MCP Server funcional com 12 tools, 8 resources, 4 prompts
- [x] Transport STDIO para Claude Desktop/Code
- [x] Transport HTTP para agentes remotos (porta 3002)
- [x] README com instruções de instalação
- [ ] **Publicado no npm** → movido para Fase 5
- [ ] **Registrado no MCP Directory** → movido para Fase 5
- [ ] Testes de integração com Claude

---

## 3. Fase 2 — OpenAPI Spec + Schemas ✅ CONCLUÍDA

**Status:** OpenAPI 3.0.3 spec completa servida em `/api/openapi.json`

### 3.1 Entregáveis Fase 2

- [x] OpenAPI 3.0.3 spec completa (30+ endpoints, 12 tags)
- [x] Endpoint `GET /api/openapi.json` servindo a spec
- [x] Response format padronizado em endpoints
- [ ] **Zod schemas compartilhados como single source of truth** → pendente
- [ ] **Suporte a `?fields=` para field selection** → pendente
- [ ] **Portal de documentação interativo** → movido para Fase 5

---

## 4. Fase 3 — API Gateway: Auth, Rate Limiting & Tiers ✅ CONCLUÍDA

**Status:** Auth, rate limiting e API keys em produção

### 4.1 Entregáveis Fase 3

- [x] Sistema de API keys (geração SHA256, validação, Supabase)
- [x] Rate limiting por tier via Upstash Redis (sliding window)
- [x] Headers de rate limit (`X-RateLimit-*`, `Retry-After`)
- [x] Endpoint `POST /api/keys/generate`
- [x] Endpoint `POST /api/keys/verify`
- [x] Migration SQL (`001_api_keys.sql`)
- [x] API Gateway middleware com detecção de tier
- [x] Usage logging em Redis (buckets horários, 7 dias retenção)
- [ ] Dashboard de uso para key owners → Fase 6
- [ ] Página de signup em dogdata.xyz → Fase 5

---

## 5. Fase 4 — Agent Discovery & SDK ⚠️ PARCIAL

**Status:** Endpoints de discovery implementados, SDKs não publicados

### 5.1 Entregáveis Fase 4

- [x] Endpoint `GET /api/agent/capabilities` (retorna capabilities completas)
- [x] `/.well-known/ai-agent.json` (agent discovery manifest)
- [x] SDK TypeScript (`@dogdata/sdk`) — código em `/sdk/typescript/`
- [x] SDK Python (`dogdata`) — código em `/sdk/python/`
- [ ] **SDK TypeScript publicado no npm** → Fase 5
- [ ] **SDK Python publicado no PyPI** → Fase 5
- [ ] Exemplos de integração para 3 protocolos

---

## 6. Fase 5 — DISCOVERABILITY: A Fase Invisível 🔴 CRÍTICA

**Impacto:** SEM ESTA FASE, NENHUM AGENTE NOS ENCONTRA
**Prioridade:** BLOQUEADORA — deve ser executada antes de qualquer outra coisa
**Evidência:** Feedback real do agente Xored Pike confirmou que a API é invisível
**Execução:** Sub-agente dedicado — cria todas as rotas de discovery, SEO e presença pública

### 6.1 Problema

Agentes e crawlers seguem um padrão previsível de discovery:

```
1. GET /api               → "Existe API?"          → 404 ❌ PARA AQUI
2. GET /docs              → "Tem documentação?"     → 404 ❌
3. GET /robots.txt        → "O que posso acessar?"  → 404 ❌
4. GET /sitemap.xml       → "Que páginas existem?"  → 404 ❌
5. GitHub org             → "É projeto real?"       → vazio ❌
6. npm search             → "Tem SDK?"              → nada ❌
7. CONCLUSÃO: "Sem API pública" — exatamente o que Xored Pike concluiu
```

### 6.2 Entregáveis — Rota de Discovery `/api` (index)

**Arquivo:** `app/api/route.ts`
**Prioridade:** IMEDIATA — 5 minutos, maior impacto

Criar rota raiz que retorna JSON de discovery:

```json
{
  "service": "DOG DATA",
  "version": "1.0.0",
  "description": "The world's most comprehensive DOG•GO•TO•THE•MOON data platform on Bitcoin L1. Real-time holder tracking, forensic analysis, multi-exchange pricing for AI agents.",
  "quick_start": {
    "no_key_required": [
      "GET /api/dog-rune/stats",
      "GET /api/price/kraken",
      "GET /api/health"
    ],
    "get_api_key": "POST /api/keys/generate",
    "full_capabilities": "GET /api/agent/capabilities"
  },
  "endpoints": {
    "stats": "/api/dog-rune/stats",
    "holders": "/api/dog-rune/holders",
    "transactions": "/api/dog-rune/transactions-kv",
    "price_kraken": "/api/price/kraken",
    "price_all": "/api/markets",
    "metrics": "/api/metrics/utxo",
    "forensic": "/api/forensic/profiles",
    "airdrop": "/api/airdrop/summary",
    "bitcoin": "/api/bitcoin",
    "events_sse": "/api/events"
  },
  "protocols": {
    "rest": { "base_url": "https://www.dogdata.xyz/api", "spec": "/api/openapi.json" },
    "mcp": { "http": "https://www.dogdata.xyz/mcp", "npm": "@dogdata/mcp-server" },
    "sse": { "endpoint": "/api/events", "events": ["new_transaction", "price_update", "whale_alert"] }
  },
  "auth": {
    "type": "bearer",
    "format": "dog_live_xxx",
    "tiers": { "public": "20 req/hr (no key)", "free": "100 req/hr", "pro": "5000 req/hr", "enterprise": "50000 req/hr" }
  },
  "links": {
    "docs": "/docs",
    "openapi": "/api/openapi.json",
    "capabilities": "/api/agent/capabilities",
    "health": "/api/health",
    "status": "/api/status"
  },
  "data": {
    "holders": "89,000+",
    "utxos": "250,000+",
    "forensic_profiles": "75,490+",
    "exchanges": 6,
    "source": "Bitcoin Core + Ord (local full node)",
    "update_frequency": "~30s (transactions), ~1h (holders)"
  }
}
```

### 6.3 Entregáveis — `/docs` (Documentação Interativa)

**Arquivo:** `app/docs/page.tsx`
**Prioridade:** IMEDIATA — 10 minutos

Opções (do mais rápido ao mais completo):

**Opção A — Redirect para Scalar (recomendado, rápido):**
Página Next.js que renderiza Scalar API Reference apontando para `/api/openapi.json`:

```tsx
// app/docs/page.tsx
import ApiReference from '@scalar/nextjs-api-reference'

export default function DocsPage() {
  return <ApiReference spec={{ url: '/api/openapi.json' }} />
}
```

**Opção B — Swagger UI embed:**
```tsx
import SwaggerUI from 'swagger-ui-react'
```

**Opção C — Página estática com links:**
Markdown renderizado com seções: Quick Start, Authentication, Endpoints, MCP, SSE, SDKs.

### 6.4 Entregáveis — `robots.txt`

**Arquivo:** `public/robots.txt`
**Prioridade:** IMEDIATA — 2 minutos

```
User-agent: *
Allow: /
Allow: /api/
Allow: /docs
Allow: /.well-known/

Sitemap: https://www.dogdata.xyz/sitemap.xml

# DOG DATA — Real-time DOG•GO•TO•THE•MOON rune data API
# API Docs: https://www.dogdata.xyz/docs
# OpenAPI Spec: https://www.dogdata.xyz/api/openapi.json
# Agent Discovery: https://www.dogdata.xyz/.well-known/ai-agent.json
```

### 6.5 Entregáveis — `sitemap.xml`

**Arquivo:** `public/sitemap.xml` ou gerado via `app/sitemap.ts`
**Prioridade:** IMEDIATA — 5 minutos

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.dogdata.xyz/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>https://www.dogdata.xyz/docs</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://www.dogdata.xyz/api</loc><changefreq>daily</changefreq><priority>0.9</priority></url>
  <url><loc>https://www.dogdata.xyz/api/openapi.json</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://www.dogdata.xyz/api/agent/capabilities</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://www.dogdata.xyz/api/status</loc><changefreq>always</changefreq><priority>0.7</priority></url>
  <url><loc>https://www.dogdata.xyz/api/dog-rune/stats</loc><changefreq>hourly</changefreq><priority>0.7</priority></url>
</urlset>
```

### 6.6 Entregáveis — Meta Tags SSR na Homepage

**Arquivo:** `app/layout.tsx` (metadata export)
**Prioridade:** ALTA — 5 minutos

```tsx
export const metadata: Metadata = {
  title: 'DOG DATA — Real-time DOG•GO•TO•THE•MOON Rune Data API',
  description: 'The world\'s most comprehensive data platform for DOG rune on Bitcoin L1. 89,000+ holders, 250,000+ UTXOs, forensic analysis, multi-exchange pricing. REST API, MCP Server, SSE events for AI agents.',
  keywords: ['DOG', 'rune', 'bitcoin', 'API', 'holders', 'MCP', 'AI agents', 'on-chain analytics'],
  openGraph: {
    title: 'DOG DATA API — 89K+ Holders | 35 Endpoints | AI Agent Ready',
    description: 'Real-time DOG•GO•TO•THE•MOON data for AI agents. REST API, MCP Server, SSE events.',
    url: 'https://www.dogdata.xyz',
    type: 'website',
  },
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://www.dogdata.xyz' }
}
```

### 6.7 Entregáveis — Publicação npm + PyPI

**Prioridade:** ALTA — 15 minutos cada

**npm (@dogdata/mcp-server):**
```bash
cd mcp-server && npm publish --access public
```

**npm (@dogdata/sdk):**
```bash
cd sdk/typescript && npm publish --access public
```

**PyPI (dogdata):**
```bash
cd sdk/python && pip install build twine && python -m build && twine upload dist/*
```

### 6.8 Entregáveis — GitHub Public Repos

**Prioridade:** ALTA — 15 minutos

Criar repos públicos mínimos na org `github.com/dogdata`:

1. **`dogdata/mcp-server`** — Código do MCP server + README
2. **`dogdata/sdk-typescript`** — SDK TypeScript + README
3. **`dogdata/sdk-python`** — SDK Python + README
4. **`dogdata/docs`** — Opcional: integration guides, examples

Cada repo deve ter:
- README claro com quick start
- Link para `dogdata.xyz/docs`
- Link para `/api/agent/capabilities`
- Badge de versão (npm/PyPI)

### 6.9 Entregáveis — `llms.txt` (Padrão de Discovery para LLMs)

**Arquivo:** `public/llms.txt`
**Prioridade:** MÉDIA — 5 minutos

Seguindo o padrão emergente `llms.txt` para que LLMs descubram APIs:

```
# DOG DATA
> The world's most comprehensive DOG•GO•TO•THE•MOON data platform on Bitcoin L1.

## API Access
- REST API: https://www.dogdata.xyz/api (35 endpoints, OpenAPI spec at /api/openapi.json)
- MCP Server: npm install @dogdata/mcp-server (12 tools, 8 resources for Claude/AI agents)
- SSE Events: https://www.dogdata.xyz/api/events (real-time transactions, whale alerts, prices)

## Quick Start (no API key required)
- GET https://www.dogdata.xyz/api/dog-rune/stats — token overview (89,000+ holders)
- GET https://www.dogdata.xyz/api/price/kraken — current DOG price
- GET https://www.dogdata.xyz/api/health — service health

## Data
- 89,000+ DOG holders indexed hourly
- 250,000+ UTXOs tracked continuously
- 75,490 forensic behavioral profiles with Diamond Score
- 6 exchange price feeds (30s updates)
- Direct Bitcoin Core + Ord indexing (no third-party APIs)

## Authentication
- Public: 20 requests/hour (no key needed)
- Free tier: 100 req/hr — POST /api/keys/generate
- Pro tier: 5,000 req/hr
- Enterprise: 50,000 req/hr

## Full Documentation
- Agent capabilities: https://www.dogdata.xyz/api/agent/capabilities
- OpenAPI spec: https://www.dogdata.xyz/api/openapi.json
- Interactive docs: https://www.dogdata.xyz/docs
```

### 6.10 Checklist Completo Fase 5

```
BLOCO A — Rotas de Discovery (executar PRIMEIRO, 20 min total)
- [ ] Criar /api/route.ts (index JSON de discovery)
- [ ] Criar /docs page (Scalar ou Swagger UI sobre /api/openapi.json)
- [ ] Criar public/robots.txt
- [ ] Criar public/sitemap.xml (ou app/sitemap.ts dinâmico)
- [ ] Criar public/llms.txt
- [ ] Adicionar metadata SSR em app/layout.tsx (title, description, og tags)

BLOCO B — Publicação de Pacotes (30 min total)
- [ ] Publicar @dogdata/mcp-server no npm
- [ ] Publicar @dogdata/sdk no npm
- [ ] Publicar dogdata no PyPI
- [ ] Registrar MCP server no MCP Directory (modelcontextprotocol.io)

BLOCO C — Presença Pública (30 min total)
- [ ] Criar repo público github.com/dogdata/mcp-server
- [ ] Criar repo público github.com/dogdata/sdk-typescript
- [ ] Criar repo público github.com/dogdata/sdk-python
- [ ] README em cada repo com quick start + links

BLOCO D — Validação (15 min)
- [ ] Testar: fetch https://dogdata.xyz/api → 200 com JSON discovery
- [ ] Testar: fetch https://dogdata.xyz/docs → 200 com documentação
- [ ] Testar: fetch https://dogdata.xyz/robots.txt → 200
- [ ] Testar: fetch https://dogdata.xyz/sitemap.xml → 200
- [ ] Testar: fetch https://dogdata.xyz/llms.txt → 200
- [ ] Testar: npx @dogdata/mcp-server → server inicia
- [ ] Pedir para um agente externo redescobrir dogdata.xyz
```

---

## 7. Fase 6 — Escalabilidade & Observabilidade ⏳ PENDENTE

**Impacto:** Suportar centenas de agentes simultâneos com confiabilidade
**Prioridade:** ALTA (após Fase 5)
**Execução:** Sub-agente dedicado — expande cache, observabilidade, alerting, webhooks

### 7.1 Cache Layer Expandido

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

### 7.2 Observabilidade

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

### 7.3 Alerting

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
├── Whale transaction detectada (> 1B DOG)
└── Novo holder milestone (90k, 100k, etc.)
```

### 7.4 Agent Registry

Sistema para registrar e rastrear agentes consumidores:

```
Tabela: agent_registry (Supabase)
├── id: uuid (PK)
├── api_key_id: uuid (FK → api_keys)
├── agent_name: text (ex: "Xored Pike", "Trading Bot v2")
├── agent_type: text (ex: "defi_analyzer", "whale_tracker", "portfolio_manager")
├── description: text
├── first_seen: timestamptz
├── last_seen: timestamptz
├── total_requests: bigint
├── favorite_endpoints: text[] (top 5 mais usados)
├── metadata: jsonb
```

### 7.5 Webhook Push Delivery

Para agentes serverless que não podem manter conexão SSE:

```
POST /api/webhooks/register
{
  "url": "https://agent.example.com/webhook",
  "events": ["whale_alert", "price_update"],
  "secret": "whsec_xxx"  // Para validação HMAC
}

Delivery:
POST https://agent.example.com/webhook
Headers:
  X-DogData-Event: whale_alert
  X-DogData-Signature: sha256=xxx
  X-DogData-Timestamp: 1710000000
Body: { event payload }
```

### 7.6 Bulk/Batch Endpoints

Para agentes que precisam de muitos dados de uma vez:

```
POST /api/batch
{
  "requests": [
    { "endpoint": "/api/dog-rune/stats" },
    { "endpoint": "/api/price/kraken" },
    { "endpoint": "/api/dog-rune/holders", "params": { "limit": 10 } },
    { "endpoint": "/api/forensic/summary" }
  ]
}

Response: Array de respostas individuais em uma única chamada HTTP
```

### 7.7 Entregáveis Fase 6

```
BLOCO A — Observabilidade
- [ ] Dashboard de métricas (requests/s, latência, erros por endpoint)
- [ ] Dashboard de uso por API key / agente
- [ ] Logging estruturado com request_id
- [ ] Health check expandido com latência de cada componente

BLOCO B — Resiliência
- [ ] Cache multi-tier implementado (memory → Redis → CDN)
- [ ] Circuit breakers para APIs externas (Kraken, CoinGecko, mempool.space)
- [ ] Graceful degradation quando Redis offline (fail-open)
- [ ] Load testing (target: 1000 req/s)

BLOCO C — Features para Agentes
- [ ] Agent registry (identificação e tracking de agentes consumidores)
- [ ] Webhook push delivery (alternativa ao SSE para serverless)
- [ ] Batch endpoint (múltiplas queries em uma chamada)
- [ ] Field selection (?fields=address,balance,rank)

BLOCO D — Documentação de SLA
- [ ] SLA formal por tier (99.5% free, 99.9% enterprise)
- [ ] Status page pública (status.dogdata.xyz ou similar)
- [ ] Incident response documentation
```

---

## 8. Definição dos Tools MCP

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
Data Source: All 6 exchange APIs
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

## 9. Definição dos Resources MCP

Resources são dados read-only que agentes podem incorporar como contexto.

| Resource | URI | Descrição | Atualização |
|---|---|---|---|
| Stats | `dog://stats` | Current DOG rune statistics snapshot | 60s cache |
| Top Holders | `dog://top-holders` | Top 100 DOG holders with rankings | hourly |
| Supply Info | `dog://supply-info` | Supply distribution and tokenomics | hourly |
| Bitcoin Network | `dog://bitcoin-network` | Bitcoin network status | 30s cache |
| Price Summary | `dog://price-summary` | DOG price across all exchanges | 30s cache |
| Forensic Summary | `dog://forensic-summary` | Aggregated behavioral analysis | daily |
| UTXO Distribution | `dog://utxo-distribution` | UTXO size and age distribution | hourly |
| Airdrop Summary | `dog://airdrop-summary` | Airdrop distribution and recipient behavior | daily |

---

## 10. Schema de API Unificado

### 10.1 Endpoints em Produção (35 total)

```
BASE: https://www.dogdata.xyz/api

# Discovery & System
GET  /api                              → Discovery index (FASE 5)
GET  /api/status                       → System status (35 endpoints) ✅
GET  /api/health                       → Health check com latências ✅
GET  /api/openapi.json                 → OpenAPI 3.0.3 spec ✅
GET  /api/agent/capabilities           → Agent capabilities document ✅

# DOG Rune Stats & Holders
GET  /api/dog-rune/stats               → Metadata, supply, top 10 ✅
GET  /api/dog-rune/holders             → Paginated (page, limit) ✅
GET  /api/dog-rune/holders?address=    → Address lookup ✅
GET  /api/dog-rune/holders?snapshot=   → Top 500 ✅
GET  /api/dog-rune/events-count        → Event count ✅
GET  /api/dog-rune/search-tx           → Search transactions ✅
GET  /api/dog-rune/transactions-kv     → Cached transactions ✅
GET  /api/dog-rune/transactions-unisat → Via Unisat ✅

# Pricing (6 exchanges)
GET  /api/price/kraken                 ✅
GET  /api/price/bitget                 ✅
GET  /api/price/mexc                   ✅
GET  /api/price/gateio                 ✅
GET  /api/price/bitflow                ✅
GET  /api/price/dogswap                ✅
GET  /api/markets                      → Aggregated ✅

# On-Chain Metrics
GET  /api/metrics/utxo                 ✅
GET  /api/metrics/utxo-age             ✅
GET  /api/metrics/utxo-count-history   ✅
GET  /api/metrics/holder-concentration ✅
GET  /api/metrics/realized-cap         ✅
GET  /api/metrics/supply-profit-loss   ✅

# Forensic & Airdrop
GET  /api/forensic/summary             ✅
GET  /api/forensic/profiles            ✅
GET  /api/airdrop/summary              ✅
GET  /api/airdrop/recipients           ✅

# Bitcoin Network
GET  /api/bitcoin                      ✅

# Real-Time Events
GET  /api/events                       → SSE stream ✅

# API Key Management
POST /api/keys/generate                ✅
POST /api/keys/verify                  ✅
```

### 10.2 Query Parameters Universais

| Param | Tipo | Descrição |
|-------|------|-----------|
| `page` | int | Página (default: 1) |
| `limit` | int | Items por página (default: 50, max: 100) |
| `fields` | string | Campos a retornar — pendente Fase 6 |
| `format` | string | `json` (default) — pendente: `csv` |

### 10.3 Error Responses Padronizadas

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Upgrade to Pro for 5,000 requests/hour.",
    "status": 429,
    "retry_after": 120,
    "docs_url": "https://www.dogdata.xyz/docs"
  }
}
```

---

## 11. Sistema de Tiers & Rate Limiting

### 11.1 Tier Definitions (em produção)

| Feature | Public | Free | Pro | Enterprise |
|---------|--------|------|-----|------------|
| **Requests/hora** | 20 | 100 | 5.000 | 50.000 |
| **API Key** | Não precisa | Sim | Sim | Sim |
| **Endpoints** | Básicos | Todos (read) | Todos (read) | Todos + SSE + Webhooks |
| **SLA** | Best effort | Best effort | 99.5% | 99.9% |

### 11.2 Acesso Público sem Key

Endpoints que não requerem API key:
- `GET /api` — Discovery index
- `GET /api/dog-rune/stats` — Estatísticas básicas
- `GET /api/price/kraken` — Preço atual
- `GET /api/health` — Health check
- `GET /api/status` — System status
- `GET /api/agent/capabilities` — Discovery
- `GET /api/openapi.json` — Spec

---

## 12. Infraestrutura & Deploy

### 12.1 Domínios

| Domínio | Propósito | Status |
|---------|-----------|--------|
| `www.dogdata.xyz` | Frontend + API Routes | ✅ Produção |
| `dogdata.xyz` | Redirect → www | ✅ |
| `api.dogdata.xyz` | API v1 (futuro) | ⏳ Configurar |
| `mcp.dogdata.xyz` | MCP Server HTTP | ⏳ Configurar |
| `docs.dogdata.xyz` | Portal de documentação (futuro) | ⏳ |

### 12.2 Stack Atual

```
Frontend + API Routes:
├── Vercel (Next.js) — auto-scaling, edge network ✅
├── 35 API routes em produção ✅
└── Environment: SUPABASE_*, UPSTASH_*, API secrets ✅

MCP Server:
├── Express + Streamable HTTP (porta 3002) ✅
├── STDIO transport ✅
└── npm package: @dogdata/mcp-server (não publicado)

Data Infrastructure:
├── Bitcoin Core + Ord (VPS dedicado) ✅
├── dog_block_scanner (systemd service, 30s) ✅
├── Upstash Redis (cache + rate limits) ✅
├── Supabase PostgreSQL (API keys, usage, history) ✅
└── Local JSON files (holders, forensic, airdrop) ✅
```

---

## 13. Métricas de Sucesso

### 13.1 KPIs Pré-Lançamento (Fase 5 — Agora)

| Métrica | Target | Status |
|---------|--------|--------|
| `/api` retorna 200 | Sim | ❌ Retorna 404 |
| `/docs` retorna 200 | Sim | ❌ Retorna 404 |
| `robots.txt` existe | Sim | ❌ |
| `sitemap.xml` existe | Sim | ❌ |
| npm `@dogdata/mcp-server` instalável | Sim | ❌ |
| GitHub repos públicos | 1+ | ❌ 0 repos |
| Agente externo consegue descobrir API | Sim | ❌ Xored Pike falhou |

### 13.2 KPIs de Lançamento (Mês 1 após Fase 5)

| Métrica | Target |
|---------|--------|
| API keys geradas | 100+ |
| Requests/dia | 10.000+ |
| MCP installs (npm) | 50+ |
| Uptime | 99.5% |
| Avg response time | < 500ms |
| Agente externo redescobre API com sucesso | 100% |

### 13.3 KPIs de Crescimento (Mês 3)

| Métrica | Target |
|---------|--------|
| API keys ativas | 500+ |
| Requests/dia | 100.000+ |
| Agentes únicos/dia | 200+ |
| Pro tier subscribers | 50+ |
| MCP installs (npm) | 500+ |

### 13.4 KPIs de Escala (Mês 6)

| Métrica | Target |
|---------|--------|
| API keys ativas | 2.000+ |
| Requests/dia | 1.000.000+ |
| Enterprise clients | 10+ |
| Uptime | 99.9% |
| Referência em rankings | Top 3 DOG data providers |

---

## 14. Riscos & Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| **Agentes não encontram a API** | **CONFIRMADO** | **CRÍTICO** | **Fase 5 — resolver AGORA** |
| **Sobrecarga no Bitcoin node** | Média | Alto | Rate limiting rigoroso, cache agressivo |
| **Abuso de API keys free** | Alta | Médio | Rate limiting por IP + key, ban automático |
| **Downtime do scanner** | Baixa | Alto | Alerting < 5min, dados cached servem por horas |
| **Concorrência** | Baixa | Médio | Vantagem: único com scanner próprio + forense |
| **Custos Upstash/Supabase** | Média | Médio | Monitorar uso, otimizar queries |
| **Mudanças no protocolo MCP** | Média | Médio | Seguir spec oficial, SDK abstrai transport |
| **DDoS** | Média | Alto | Vercel proteção, rate limiting distribuído |

---

## 15. Plano de Execução Agêntica

### Estado Atual dos Sub-Agentes

```
┌─────────────────────────────────────────────────────────┐
│                  AGENTE ORQUESTRADOR                    │
│         (coordena, resolve conflitos, integra)          │
└────┬──────────┬──────────┬──────────┬──────────┬────────┘
     │          │          │          │          │
     ▼          ▼          ▼          ▼          ▼
┌─────────┐┌─────────┐┌─────────┐┌─────────┐┌─────────┐
│ Agent 1 ││ Agent 2 ││ Agent 3 ││ Agent 4 ││ Agent 5 │
│ MCP     ││ OpenAPI ││ Gateway ││Discovery││Discover-│
│ Server  ││ + Docs  ││ + Auth  ││ + SDK   ││ ability │
│ ✅ DONE  ││ ✅ DONE  ││ ✅ DONE  ││ ⚠️ 70%  ││ 🔴 NOW  │
└─────────┘└─────────┘└─────────┘└─────────┘└─────────┘
                                              │
                                     ┌────────┴────────┐
                                     │ Agent 6         │
                                     │ Scale + Obs     │
                                     │ ⏳ AFTER 5      │
                                     └─────────────────┘
```

### Ordem de Execução ATUALIZADA

```
CONCLUÍDO ────────────────────────────────────────────────
Agent 1 (MCP Server)      ████████████████████████ ✅
Agent 2 (OpenAPI/Schemas)  ████████████████████████ ✅
Agent 3 (Gateway/Auth)     ████████████████████████ ✅
Agent 4 (Discovery/SDK)    ██████████████████░░░░░░ ⚠️ 70%

EXECUTAR AGORA ───────────────────────────────────────────
Agent 5 (Discoverability)  ░░░░░░████████████████████ 🔴

APÓS FASE 5 ──────────────────────────────────────────────
Agent 4 (Publicação npm/PyPI) ░░░░░░░░░░░░░░░████████
Agent 6 (Scale + Obs)         ░░░░░░░░░░░░░░░████████

VALIDAÇÃO ────────────────────────────────────────────────
Orquestrador              ░░░░░░░░░░░░░░░░░░░░████
                          (agente externo redescobre)
```

### Instruções para o Agente Executor (Fase 5)

1. **BLOCO A primeiro** — Criar rotas de discovery (20 min):
   - `/api/route.ts` → JSON discovery index
   - `/docs/page.tsx` → Scalar/Swagger UI
   - `public/robots.txt`
   - `public/sitemap.xml`
   - `public/llms.txt`
   - Metadata SSR em `app/layout.tsx`

2. **BLOCO B** — Publicar pacotes (30 min):
   - `npm publish` para MCP server e SDK
   - `twine upload` para SDK Python
   - Registrar no MCP Directory

3. **BLOCO C** — Presença GitHub (30 min):
   - Criar repos públicos com READMEs

4. **BLOCO D** — Validar discovery (15 min):
   - Testar todos os URLs retornam 200
   - Pedir para agente externo redescobrir

---

## Apêndice A — Competitive Advantage

### Por que o DOG DATA será a referência mundial:

1. **Scanner próprio** — Único projeto que indexa DOG diretamente do Bitcoin Core + Ord, sem dependência de APIs terceiras. Dados de primeira mão.

2. **Análise forense** — 75.490 perfis comportamentais com Diamond Score, 14 categorias de comportamento. Nenhum outro projeto DOG oferece isso.

3. **MCP first-mover** — Um dos primeiros projetos crypto com MCP Server nativo. Agentes Claude têm acesso direto.

4. **Cobertura de preço** — 6 exchanges simultâneos (Kraken, Gate.io, MEXC, Bitget, Bitflow, Dogswap).

5. **On-chain metrics profundas** — Gini coefficient, HODL waves, realized cap, MVRV, supply in profit/loss.

6. **Real-time** — Scanner processa blocos em ~30s. Dados quase em tempo real.

7. **Full-stack** — Do Bitcoin node até o frontend. Controle total da stack.

### Comparação com alternativas:

| Feature | DOG DATA | Unisat | Xverse | Magic Eden |
|---------|----------|--------|--------|------------|
| Holder list completa | ✅ 89k+ | ❌ | ❌ | ❌ |
| Scanner próprio | ✅ | ❌ | ❌ | ❌ |
| Análise forense | ✅ 14 categorias | ❌ | ❌ | ❌ |
| Diamond Score | ✅ | ❌ | ❌ | ❌ |
| UTXO analytics | ✅ 250k+ | ❌ | ❌ | ❌ |
| Multi-exchange prices | ✅ 6 exchanges | ❌ | ❌ | ✅ 1 |
| MCP Server | ✅ | ❌ | ❌ | ❌ |
| API para agentes | ✅ 35 endpoints | Limitado | Limitado | Limitado |
| On-chain metrics | ✅ Glassnode-level | ❌ | ❌ | ❌ |
| Real-time txs | ✅ ~30s | ✅ | ✅ | ❌ |
| **Discoverability** | **🔴 Fase 5** | ✅ | ✅ | ✅ |

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

### Usando via REST API:

```bash
# Sem key (20 req/hora)
curl https://www.dogdata.xyz/api/dog-rune/stats
curl https://www.dogdata.xyz/api/price/kraken

# Gerar key
curl -X POST https://www.dogdata.xyz/api/keys/generate \
  -H "Content-Type: application/json" \
  -d '{"email": "agent@example.com", "name": "My Agent"}'

# Com key (100+ req/hora)
curl -H "Authorization: Bearer dog_live_xxx" \
  https://www.dogdata.xyz/api/dog-rune/holders?limit=10
```

### Usando via SDK:

```typescript
import { DogData } from "@dogdata/sdk";
const dog = new DogData({ apiKey: "dog_live_xxx" });
const { data } = await dog.holders.list({ limit: 10 });
```

### Usando via SSE (real-time):

```javascript
const events = new EventSource("https://www.dogdata.xyz/api/events?events=whale_alert,price_update");
events.addEventListener("whale_alert", (e) => console.log(JSON.parse(e.data)));
```

---

*DOG DATA — The world's most comprehensive DOG•GO•TO•THE•MOON data platform for AI agents.*

*Versão 2.0 — Atualizado 2026-03-25 com diagnóstico de discoverability e Fase 5 crítica.*
