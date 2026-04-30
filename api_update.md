# DogData API — Update Plan

> Plano de correção baseado na auditoria de 2026-04-29. Organizado por severidade e pronto para execução.
> Cada item tem arquivo afetado, problema exato e solução concreta.

---

## 🔴 CRÍTICO — Issues #1, #2, #3: still_holding / sold_everything / retention_rate divergem

**Arquivos afetados:**
- `app/api/forensic/summary/route.ts`
- `app/api/airdrop/summary/route.ts`
- `scripts/update_airdrop_analytics.py`

**Causa raiz:** Os dois endpoints leem de arquivos de dados diferentes (`forensic_analysis.json` e `airdrop_analytics.json`) que foram gerados com lógicas diferentes de classificação. A diferença de 2.050 wallets é consistente entre os três campos, confirmando que é um único bug de classificação.

**Solução — opção A (recomendada): fonte canônica única**

Escolher `/forensic/summary` como fonte de verdade para `still_holding`, `sold_everything` e `retention_rate`. O endpoint `/airdrop/summary` passa a buscar esses três campos do forensic data em vez de recalcular.

Em `app/api/airdrop/summary/route.ts`:

```typescript
export async function GET() {
  try {
    // Airdrop file (distribuição, amounts, categorias)
    const airdropPath = path.join(process.cwd(), 'data', 'airdrop_analytics.json');
    const airdropData = JSON.parse(fs.readFileSync(airdropPath, 'utf-8'));
    const summary = airdropData.analytics?.summary || {};

    // Forensic file como fonte canônica para métricas de retenção
    const forensicPath = path.join(process.cwd(), 'data', 'forensic_analysis.json');
    const forensicData = JSON.parse(fs.readFileSync(forensicPath, 'utf-8'));
    const forensicStats = forensicData.statistics || {};

    // Substituir campos de retenção pelos valores canônicos do forensic
    summary.still_holding = forensicStats.still_holding;
    summary.sold_everything = forensicStats.sold_everything;
    summary.retention_rate = forensicStats.retention_rate;
    summary.last_updated = forensicData.timestamp || null;

    return NextResponse.json(summary, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load airdrop summary' }, { status: 500 });
  }
}
```

**Solução — opção B: documentar a diferença explicitamente**

Se as duas métricas são intencionalmente diferentes (ex: forensic conta UTXOs, airdrop conta addresses), adicionar campo `methodology` na resposta de cada endpoint explicando o critério. Mas unificar é preferível.

**Validação pós-fix:**
```
GET /api/forensic/summary → statistics.still_holding === GET /api/airdrop/summary → still_holding
GET /api/forensic/summary → statistics.sold_everything === GET /api/airdrop/summary → sold_everything
GET /api/forensic/summary → statistics.retention_rate === GET /api/airdrop/summary → retention_rate
```

---

## 🔴 CRÍTICO — Issue #4: accumulated (2,858) ≠ soma dos patterns acumuladores

**Arquivo afetado:** `app/api/forensic/summary/route.ts`

**Problema:** `statistics.accumulated = 2858` mas `dog_legend (1530) + ordinal_believer (847) = 2377`. Faltam 481 wallets sem categoria documentada.

**Solução:** Adicionar campo `accumulator_breakdown` na resposta do forensic summary expondo quais patterns compõem o total:

```typescript
// Em app/api/forensic/summary/route.ts, no objeto de resposta:
const ACCUMULATOR_PATTERNS = ['dog_legend', 'ordinal_believer', 'steady_accumulator'];

const accumulatorBreakdown = ACCUMULATOR_PATTERNS.reduce((acc, pattern) => {
  const category = data.by_pattern?.[pattern];
  if (category) acc[pattern] = category.count;
  return acc;
}, {} as Record<string, number>);

// Adicionar no response:
statistics: {
  ...data.statistics,
  accumulated: data.statistics.accumulated,
  accumulator_breakdown: accumulatorBreakdown,
  accumulator_patterns: ACCUMULATOR_PATTERNS,  // quais patterns somam pro total
}
```

Se `steady_holder` com `accumulation_rate > 0` também conta, incluir na lista e documentar o threshold.

---

## 🟠 ALTO — Issue #5: Snapshot forensic com ~6 meses de defasagem

**Arquivo afetado:** `data/forensic_analysis.json` (dados) + `scripts/forensic_behavior_analyzer.py`

**Problema:** `timestamp: "2025-10-24T15:04:43.916717"` — dados congelados há 6 meses.

**Solução imediata (hoje):** Re-executar o script de análise forensic contra o estado atual do blockchain:

```bash
cd scripts
python3 forensic_behavior_analyzer.py --output ../data/forensic_analysis.json
```

**Solução estrutural:** Adicionar `staleness_hours` calculado na resposta do endpoint para o consumidor saber a idade dos dados sem precisar inspecionar o timestamp:

```typescript
// Em app/api/forensic/summary/route.ts
const timestamp = data.timestamp ? new Date(data.timestamp) : null;
const staleness_hours = timestamp
  ? Math.floor((Date.now() - timestamp.getTime()) / 3_600_000)
  : null;

return NextResponse.json({
  ...data,
  staleness_hours,
  data_note: staleness_hours && staleness_hours > 168
    ? `Snapshot ${staleness_hours}h old. Refresh in progress.`
    : null,
});
```

**Solução de longo prazo:** Criar cron job semanal (Vercel Cron ou script externo) para re-rodar o forensic analyzer. Adicionar à `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/admin/refresh-forensic",
      "schedule": "0 3 * * 0"
    }
  ]
}
```

---

## 🟠 ALTO — Issue #6: /airdrop/summary sem timestamp

**Arquivo afetado:** `app/api/airdrop/summary/route.ts`

**Fix direto** — já coberto pelo fix do Issue #1 que adiciona `last_updated` na resposta. Confirmar que o campo está presente:

```typescript
summary.last_updated = forensicData.timestamp
  ? new Date(forensicData.timestamp).toISOString()
  : new Date().toISOString();
```

Regra geral: **todo endpoint retorna `last_updated` (ISO 8601 UTC)**. Sem exceção.

---

## 🟠 ALTO — Issue #7: last_updated do multichain — semântica ambígua

**Arquivo afetado:** `app/api/multichain/stats/route.ts`

**Fix:** Documentar explicitamente que o `last_updated` top-level é o **mais antigo** entre as chains (pior caso), não o mais recente. Assim o consumidor pode saber que *todos* os dados têm pelo menos aquela frescura.

```typescript
// No objeto de resposta:
last_updated: Math.min(...chainTimestamps).toISOString(), // timestamp da chain mais antiga
last_updated_note: "Timestamp of the least-recently-updated chain. Check per-chain last_updated for individual freshness.",
chains: {
  solana: { ..., last_updated: "2026-04-29T22:52:30Z" },
  stacks: { ..., last_updated: "2026-04-29T22:50:49Z" },
}
```

---

## 🟠 ALTO — Issue #8: first_receive_block e first_receive_time zerados

**Arquivo afetado:** `scripts/forensic_behavior_analyzer.py` (geração dos dados)

**Problema:** Todos os 75k+ profiles têm `first_receive_block: 0` e `first_receive_time: ""`.

**Solução:** Durante o refresh do forensic (Issue #5), popular esses campos com o bloco do airdrop original para cada address. Todos os OGs receberam no mesmo set de blocos — usar o bloco de cada transação de airdrop como `first_receive_block`.

Se o dado não puder ser populado no curto prazo, **remover os campos do schema** até que estejam corretos. Retornar `null` explícito é melhor que `0` e `""` que confundem o consumidor:

```typescript
// schemas/forensic.ts — tornar nullable explícito em vez de omissível
first_receive_block: z.number().int().nullable(),
first_receive_time: z.string().nullable(),
```

E no serializer do endpoint, substituir `0` e `""` por `null`:

```typescript
first_receive_block: profile.first_receive_block || null,
first_receive_time: profile.first_receive_time || null,
```

---

## 🟠 ALTO — Issue #9: rank_change null quando wallet zerou

**Arquivo afetado:** `app/api/forensic/profiles/route.ts`

**Fix:** Quando `current_rank` é `null` (wallet sem saldo), calcular `rank_change` como negativo em relação ao `airdrop_rank`:

```typescript
const current_rank = profile.current_rank ?? null;
const airdrop_rank = profile.airdrop_rank ?? null;

const rank_change = current_rank !== null && airdrop_rank !== null
  ? airdrop_rank - current_rank          // positivo = subiu, negativo = desceu
  : airdrop_rank !== null
    ? -(airdrop_rank)                    // saiu do ranking: rank_change = -airdrop_rank
    : null;

const rank_status: 'in_ranking' | 'out_of_ranking' | 'never_ranked' =
  current_rank !== null ? 'in_ranking'
  : airdrop_rank !== null ? 'out_of_ranking'
  : 'never_ranked';
```

---

## 🟡 MÉDIO — Issue #10: Rate limit anônimo muito baixo (20 req/h)

**Arquivo afetado:** `middleware/rate-limit.ts` + `middleware/api-gateway.ts`

**Fix:** Aumentar tier público de 20 para 100 req/h. Adicionar burst allowance de 10 req em 10s para não bloquear testes iniciais.

```typescript
// middleware/rate-limit.ts
const TIER_LIMITS = {
  public: { per_hour: 100, burst: 10 },   // era 20
  free:   { per_hour: 300, burst: 30 },
  pro:    { per_hour: 5000, burst: 100 },
  enterprise: { per_hour: 50000, burst: 500 },
};
```

Documentar os rate limits no endpoint `/api/agent/capabilities` (já está lá como `rate_limits`) — atualizar os valores.

**Adicionar cabeçalhos de rate limit em todos os endpoints:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1746000000
Retry-After: 3600  (só quando bloqueado)
```

---

## 🟡 MÉDIO — Issue #11: Bitflow e Dogswap classificados como CEX

**Arquivo afetado:** `app/api/agent/capabilities/route.ts` — linha 69

**Fix direto:**

```typescript
// ANTES (errado):
cex: ["kraken", "gateio", "mexc", "bitget", "bitflow", "dogswap"],
solana_dex: ["orca", "raydium", "meteora", "jupiter"],

// DEPOIS (correto):
cex: ["kraken", "gateio", "mexc", "bitget"],
btc_l2_dex: ["bitflow", "dogswap"],   // Bitflow = Stacks AMM, Dogswap = BTC L1 AMM
solana_dex: ["orca", "raydium", "meteora", "jupiter"],
```

Adicionar campo `type` por exchange no objeto de pricing:

```typescript
exchanges: {
  kraken:   { type: "cex",       chain: "bitcoin-l1",  pair: "DOG/USD" },
  gateio:   { type: "cex",       chain: "bitcoin-l1",  pair: "DOG/USDT" },
  mexc:     { type: "cex",       chain: "bitcoin-l1",  pair: "DOG/USDT" },
  bitget:   { type: "cex",       chain: "bitcoin-l1",  pair: "DOG/USDT" },
  bitflow:  { type: "dex",       chain: "stacks",      pair: "DOG/sBTC" },
  dogswap:  { type: "dex",       chain: "bitcoin-l1",  pair: "DOG/BTC" },
  orca:     { type: "dex",       chain: "solana",      pair: "DOG/SOL" },
  raydium:  { type: "dex",       chain: "solana",      pair: "DOG/USDC" },
  meteora:  { type: "dex",       chain: "solana",      pair: "DOG/SOL" },
  jupiter:  { type: "aggregator",chain: "solana",      pair: "DOG/USD" },
}
```

---

## 🟡 MÉDIO — Issue #12: Timestamps sem timezone em /forensic/summary

**Arquivo afetado:** `scripts/forensic_behavior_analyzer.py` (geração) + qualquer lugar que escreva timestamps sem `Z`

**Regra geral:** todo timestamp na API deve ser ISO 8601 UTC com `Z` sufixo. Nunca `"2025-10-24T15:04:43.916717"` — sempre `"2025-10-24T15:04:43.916Z"`.

**Fix no script Python:**
```python
# ANTES:
import datetime
timestamp = datetime.datetime.now().isoformat()

# DEPOIS:
import datetime
timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')
```

**Fix em TypeScript (onde aplicável):**
```typescript
// ANTES:
timestamp: new Date().toISOString()  // já gera com Z ✓

// Ao ler de arquivo sem timezone, normalizar:
function normalizeTimestamp(ts: string): string {
  if (!ts) return new Date().toISOString();
  if (ts.endsWith('Z') || ts.includes('+')) return ts;
  return ts + 'Z'; // assume UTC se sem indicador
}
```

---

## 🟡 MÉDIO — Issue #13: Schema de /api/price/* não normalizado

**Arquivos afetados:** `app/api/price/kraken/route.ts` e os outros 9 price routes

**Problema:** Kraken retorna formato bruto `{result: {DOGUSD: {c, o, h, l, v}}}`. Jupiter retorna normalizado `{price, change24h, source}`. Os outros 8 são inconsistentes entre si.

**Schema canônico** — todos os `/api/price/*` devem retornar:

```typescript
interface NormalizedPriceResponse {
  exchange: string;            // "kraken"
  type: "cex" | "dex" | "aggregator";
  chain: "bitcoin-l1" | "stacks" | "solana" | null;
  pair: string;                // "DOG/USD"
  price_usd: number;
  price_btc: number | null;
  price_sats: number | null;
  change_24h_pct: number;      // arredondado para 2 casas — sempre presente
  volume_24h_usd: number | null;
  high_24h: number | null;
  low_24h: number | null;
  liquidity_usd: number | null;
  fetched_at: string;          // ISO 8601 UTC com Z
  cached: boolean;
  stale?: boolean;
  cache_age_s?: number;
}
```

**Fix para Kraken** (`app/api/price/kraken/route.ts`) — substituir o return atual por:

```typescript
const currentPrice = parseFloat(data.result.DOGUSD.c[0]);
const openPrice = parseFloat(data.result.DOGUSD.o);
const change_24h_pct = parseFloat(((currentPrice - openPrice) / openPrice * 100).toFixed(2));

return NextResponse.json({
  exchange: "kraken",
  type: "cex",
  chain: null,
  pair: "DOG/USD",
  price_usd: currentPrice,
  price_btc: null,
  price_sats: null,
  change_24h_pct,
  volume_24h_usd: parseFloat(data.result.DOGUSD.v) * currentPrice,
  high_24h: parseFloat(data.result.DOGUSD.h[0]),
  low_24h: parseFloat(data.result.DOGUSD.l[0]),
  liquidity_usd: null,
  fetched_at: new Date(fetchTime).toISOString(),
  cached: false,
});
```

Replicar o mesmo padrão nos outros 9 exchanges. Criar helper `lib/price-normalizer.ts` para evitar duplicação.

---

## 🟡 MÉDIO — Issue #14: change_24h formato inconsistente

**Resolvido pelo Issue #13** — o schema canônico define `change_24h_pct: number` com 2 casas decimais, calculado server-side onde a fonte original não fornece.

Para exchanges onde o dado não está disponível (ex: Dogswap retorna `0`), verificar se é realmente zero ou ausência de dado:

```typescript
// Se a exchange não fornece change_24h, retornar null em vez de 0:
change_24h_pct: rawChange !== undefined ? parseFloat(rawChange.toFixed(2)) : null,
```

---

## 🟡 MÉDIO — Issue #15: snake_case vs camelCase misturado

**Arquivos afetados:** `app/api/price/bitflow/route.ts` (principal ofensor: `lastPrice`, `priceSats`, `change24h`)

**Regra:** toda a API DogData usa **snake_case**. camelCase apenas em campos internos de TypeScript.

**Fix em bitflow** — renomear campos no response:

```typescript
// ANTES:
{ lastPrice, priceSats, change24h, change24hSource, ... }

// DEPOIS (resolvido junto com Issue #13 — schema canônico já usa snake_case):
{ price_usd, price_sats, change_24h_pct, ... }
```

---

## 🟢 BAIXO — Issue #16: /dog-rune/stats sem total_supply e circulating_supply

**Arquivo afetado:** `app/api/dog-rune/stats/route.ts`

**Fix:** Buscar esses campos do multichain/stats ou hardcodar o supply total do rune (é fixo no protocolo):

```typescript
// Supply total do DOG•GO•TO•THE•MOON é fixo no rune etching
const TOTAL_SUPPLY = 100_000_000_000_000; // ajustar para valor real do rune
const BURNED = 0; // atualizar quando houver burns

// Adicionar no response:
supply: {
  total: TOTAL_SUPPLY,
  circulating: TOTAL_SUPPLY - BURNED,
  burned: BURNED,
  burned_pct: parseFloat((BURNED / TOTAL_SUPPLY * 100).toFixed(4)),
}
```

---

## 🟢 BAIXO — Issue #17: /api/markets — validar e documentar

**Ação:** Confirmar que o endpoint existe e está funcional. Se sim, documentar o shape esperado na resposta. Se não existe, remover do `agent/capabilities`.

Shape sugerido quando implementado:

```typescript
interface MarketsResponse {
  best_bid: number;
  best_ask: number;
  spread_pct: number;
  volume_24h_usd: number;
  exchanges_reporting: number;
  last_updated: string;
}
```

---

## 🟢 BAIXO — Issue #18: Endpoint de transações por endereço

**Novo endpoint:** `GET /api/address/[address]/transactions`

**Arquivo a criar:** `app/api/address/[address]/transactions/route.ts`

```typescript
// Query params: limit (default 50, max 200), offset (default 0), direction ("in" | "out" | "all")
export async function GET(req: NextRequest, { params }: { params: { address: string } }) {
  const { searchParams } = req.nextUrl;
  const limit = Math.min(Number(searchParams.get('limit') || 50), 200);
  const offset = Number(searchParams.get('offset') || 0);
  const direction = searchParams.get('direction') || 'all';

  // Buscar do KV/DB filtrando por address
  // Retornar array ordenado por timestamp desc
  return NextResponse.json({
    address: params.address,
    transactions: [...],
    pagination: { page: Math.floor(offset/limit) + 1, limit, total, has_more: offset + limit < total },
    last_updated: new Date().toISOString(),
  });
}
```

---

## 🟢 BAIXO — Issue #19: Paginação inconsistente

**Padrão canônico** — todo endpoint que retorna arrays usa este envelope:

```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_more: boolean;
  };
  last_updated: string;
}
```

Endpoints que precisam adotar o padrão:
- `/api/dog-rune/holders`
- `/api/forensic/profiles` (já tem, confirmar formato)
- `/api/airdrop/recipients`
- `/api/address/[address]/transactions` (novo)

---

## 🟢 BAIXO — Issue #20: OpenAPI spec não acessível

**Arquivo a criar:** `app/api/openapi.json/route.ts`

O Next.js com TypeScript já tem as rotas definidas. A forma mais rápida é gerar o spec manualmente e servir como JSON estático, atualizando conforme o schema evolui:

```typescript
// app/api/openapi.json/route.ts
import spec from '@/openapi.json';
export async function GET() {
  return NextResponse.json(spec, {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
```

Criar `openapi.json` na raiz com OpenAPI 3.1. Usar o `/api/agent/capabilities` existente como base para preencher os endpoints.

---

## 🟢 BAIXO — Issue #21: /forensic/profiles — campos opcionais inconsistentes

**Arquivo afetado:** `app/api/forensic/profiles/route.ts` + `schemas/forensic.ts`

**Fix:** Sempre serializar todos os campos, usando `null` quando ausente. Nunca omitir:

```typescript
// Serializer que garante campos completos
function serializeProfile(raw: any) {
  return {
    address: raw.address,
    behavior_pattern: raw.behavior_pattern ?? null,
    behavior_detail: raw.behavior_detail ?? null,    // sempre presente, null se ausente
    insights: raw.insights ?? [],                    // sempre array
    airdrop_rank: raw.airdrop_rank ?? null,
    current_rank: raw.current_rank ?? null,
    rank_change: raw.rank_change ?? null,
    rank_status: raw.rank_status ?? null,
    airdrop_amount: raw.airdrop_amount ?? 0,
    current_balance: raw.current_balance ?? null,
    retention_pct: raw.retention_pct ?? null,
    diamond_score: raw.diamond_score ?? null,
    first_receive_block: raw.first_receive_block || null,
    first_receive_time: raw.first_receive_time || null,
    last_activity: raw.last_activity ?? null,
  };
}
```

Atualizar `schemas/forensic.ts` para refletir nullable explícito em vez de `optional()`:

```typescript
// schemas/forensic.ts — campos que são null quando ausentes
first_receive_block: z.number().int().nullable(),
first_receive_time: z.string().nullable(),
behavior_detail: z.string().nullable(),
insights: z.array(z.string()),  // sempre array, nunca undefined
rank_change: z.number().nullable(),
rank_status: z.enum(['in_ranking', 'out_of_ranking', 'never_ranked']).nullable(),
```

---

## Novos endpoints sugeridos (roadmap)

Não são bugs, mas necessários para as próximas features (Address Explorer, OG Cards, Visual Graph):

| Endpoint | Prioridade | Descrição |
|---|---|---|
| `GET /api/forensic/profile/:address` | Alta | Lookup direto por endereço sem paginar 75k |
| `GET /api/address/:address/transactions` | Alta | Issue #18 — já detalhado acima |
| `GET /api/airdrop/lookup/:address` | Média | "Where Are They Now" — profile + stats personalizadas |
| `GET /api/whale-alerts/recent` | Média | Últimas N transações de whales, formato pronto |
| `GET /api/metrics/history` | Baixa | Serie temporal de métricas agregadas (holders, retention, concentration) |
| `GET /api/bridge/flows` | Baixa | Fluxos BTC↔SOL↔STX — requer novo indexer |

---

## Checklist de validação pós-correção

Execute após cada fix para confirmar resolução:

### Críticos
- [ ] `GET /api/forensic/summary → statistics.still_holding` === `GET /api/airdrop/summary → still_holding`
- [ ] `GET /api/forensic/summary → statistics.sold_everything` === `GET /api/airdrop/summary → sold_everything`
- [ ] `GET /api/forensic/summary → statistics.retention_rate` === `GET /api/airdrop/summary → retention_rate`
- [ ] `GET /api/forensic/summary → statistics.accumulated` tem campo `accumulator_breakdown` documentando a fórmula
- [ ] `GET /api/forensic/summary → staleness_hours` < 168 (7 dias)

### Altos
- [ ] `GET /api/airdrop/summary` retorna campo `last_updated` com valor ISO 8601 UTC
- [ ] `GET /api/forensic/profiles` — `first_receive_block` não é `0` nos top 10 profiles
- [ ] `GET /api/forensic/profiles` — wallets que zeraram têm `rank_change` negativo (não null) e `rank_status: "out_of_ranking"`

### Médios
- [ ] `GET /api/agent/capabilities → datasets.pricing.cex` não inclui bitflow nem dogswap
- [ ] `GET /api/agent/capabilities → datasets.pricing.btc_l2_dex` inclui bitflow e dogswap
- [ ] `GET /api/price/kraken` retorna `price_usd`, `change_24h_pct`, `fetched_at` no formato canônico
- [ ] Todos os `/api/price/*` retornam o mesmo schema (verificar os 10)
- [ ] Todos os timestamps na API terminam com `Z`
- [ ] Rate limit anônimo = 100 req/h (verificar header `X-RateLimit-Limit`)

### Baixos / DX
- [ ] `GET /api/dog-rune/stats` retorna `supply.total` e `supply.circulating`
- [ ] `GET /api/openapi.json` responde com status 200
- [ ] `GET /api/forensic/profiles?limit=1` — profile retorna `behavior_detail: null` (não omitido) para wallets paper_hands

---

## Ordem de execução sugerida (1 dia de trabalho)

**Manhã — Issues que afetam credibilidade pública:**
1. Fix Issues #1-3 (unificar still_holding / sold_everything / retention_rate) — ~30 min
2. Fix Issue #4 (expor accumulator_breakdown) — ~15 min
3. Fix Issue #11 (CEX/DEX no capabilities) — ~5 min
4. Fix Issue #5 (re-rodar forensic analyzer com timestamp atualizado) — depende do script, ~1-2h de processamento

**Tarde — Schema e DX:**
5. Fix Issue #12 (timestamps com Z) — ~20 min
6. Fix Issues #6, #9, #21 (last_updated airdrop, rank_change, nullable fields) — ~45 min
7. Fix Issues #13-15 (schema canônico de price) — ~2h (são 10 arquivos, mas padrão repetitivo)
8. Fix Issue #10 (rate limit 100/h) — ~10 min

**Backlog (próxima sprint):**
- Issues #7, #8, #16, #17, #18, #19, #20
- Novos endpoints do roadmap
