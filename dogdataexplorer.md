# DogData Explorer — Plano de Implementação

## Visão Geral

Feature pública e gratuita que fecha o principal gap do DogData: a ausência de uma página de endereço. Funciona como motor de aquisição via SEO e shares no X — cada carteira notável tem uma URL única e indexável.

**Rotas:**
- `/explorer` — landing com search bar global
- `/address/bitcoin/[address]` — página de qualquer endereço $DOG
- `/tx/bitcoin/[txid]` — página de qualquer transação $DOG

**Escopo atual:** Bitcoin L1 (Rune $DOG). Stacks e Solana ficam para fase posterior.

---

## Estado dos Dados (o que já temos)

| Fonte | Arquivo / Endpoint | Campos relevantes |
|---|---|---|
| Holders | `data/dog_holders_by_address.json` (88.882 holders) | `address`, `rank`, `total_dog`, `total_amount`, `utxo_count` |
| Forensic profiles | `data/forensic_behavioral_analysis.json` (75.497 profiles) | `address`, `behavior_pattern`, `airdrop_rank`, `airdrop_amount`, `current_balance`, `retention_rate`, `diamond_score`, `is_dumping`, `insights` |
| Transações por bloco | `data/dog_transactions/block_*.json` (3.424 blocos, 941111→946919) | `txid`, `block_height`, `timestamp`, `senders[].address`, `senders[].amount_dog`, `receivers[].address`, `receivers[].amount_dog`, `total_dog_moved`, `fee_sats` |
| Transações KV | Upstash Redis `dog:transactions` (500 txs recentes) | Mesmo schema |
| Redis client | `lib/upstash.ts` | `redisClient` via `@upstash/redis` |

### Distribuição de holders (base para tiers)
```
rank 1        →  3.437.982.707 DOG
rank 10       →    797.620.207 DOG
rank 100      →     64.853.821 DOG
rank 1.000    →     10.000.000 DOG
rank 5.000    →      1.954.894 DOG
rank 10.000   →        939.806 DOG
rank 25.000   →        889.806 DOG
rank 50.000   →         54.997 DOG
total holders →         88.882
```

### Behavior patterns (forensic)
```
diamond_paws       21.210   Kept exact airdrop amount
paper_hands        47.657   Sold most or all
profit_taker        1.031   Took profits strategically
early_exit          1.007   Sold early
dog_legend          1.530   Major accumulator
panic_seller          847   Sold during dips
ordinal_believer      847   Ordinal-focused holder
steady_holder         519   Consistent holding
hodl_hero             368   Long-term hodler
rune_master           294   Rune-focused activity
btc_maximalist        106   BTC-first behavior
satoshi_visionary      81   Very long hold
```

---

## Problema Central: Índice por Endereço

Os 3.424 blocos estão organizados por bloco, não por endereço. Para mostrar o histórico de txs DOG de um endereço específico sem escanear tudo a cada request, precisamos de um índice invertido.

**Estrutura no Upstash Redis:**
```
dog:addr:txs:{address}  →  JSON string: Array<TxEntry>
```

```typescript
interface TxEntry {
  txid: string
  block_height: number
  timestamp: string
  direction: 'in' | 'out' | 'self'   // in = receiver, out = sender
  amount_dog: number
  counterparty: string | null          // endereço do outro lado (null se multi-party)
  counterparties: string[]             // todos os outros endereços
  total_dog_moved: number              // volume total da tx
}
```

O índice é construído uma vez pelo script de indexação e atualizado incrementalmente a cada novo bloco processado.

---

## Implementação — 5 Etapas

---

### Etapa 1 — Script de Indexação

**Arquivo:** `scripts/build-address-tx-index.ts`

**O que faz:**
1. Lê todos os arquivos `data/dog_transactions/block_*.json` em ordem crescente de bloco
2. Para cada tx, para cada sender e receiver, grava uma entrada no índice Redis
3. Usa pipeline/batch do Upstash para performance
4. Armazena o último bloco processado em `dog:addr:index:last_block` para rodar incrementalmente

**Lógica de direção:**
```typescript
// Para cada sender do endereço → direction: 'out'
// Para cada receiver do endereço → direction: 'in'
// Se o endereço aparece em sender E receiver → direction: 'self' (consolidation tx)
```

**Lógica de counterparty:**
```typescript
// Se tx tem 1 sender e 1 receiver → counterparty = o outro endereço
// Se tx tem múltiplos → counterparty = null, counterparties = lista dos outros
```

**Execução:**
```bash
npx ts-node scripts/build-address-tx-index.ts
```

**Estimativa de escala:** ~3.424 blocos × ~3 txs/bloco médio = ~10k txs. O número de endereços únicos com histórico deve ser ~20-30k. Cada entrada no Redis é pequena (~200 bytes). Custo total de storage: manejável.

**Atualização incremental:** o script de cron existente que processa novos blocos deve chamar a função de indexação após gravar cada novo bloco.

---

### Etapa 2 — Endpoint de Agregação por Endereço

**Arquivo:** `app/api/address/bitcoin/[address]/route.ts`

**Lógica de resposta:**

```typescript
GET /api/address/bitcoin/{address}
```

**Passos internos:**
1. Normaliza o endereço (lowercase para comparação)
2. Lookup paralelo:
   - `dog_holders_by_address.json` → dados de holder (rank, balance, utxos)
   - `forensic_behavioral_analysis.json` → perfil airdrop/comportamental
   - Redis `dog:addr:txs:{address}` → histórico de txs DOG
3. Computa labels (ver seção abaixo)
4. Se nenhuma das 3 fontes retornar dados → responde com status "not_a_dog_holder"
5. Retorna objeto consolidado

**Schema de resposta:**
```typescript
interface AddressResponse {
  address: string
  status: 'holder' | 'forensic_only' | 'tx_only' | 'not_a_dog_holder'
  
  // Dados de holder (null se não é holder atual)
  holder: {
    rank: number
    total_dog: number
    total_amount: number     // em satoshis de rune
    utxo_count: number
    percentile: number       // rank / total_holders * 100
  } | null

  // Perfil forense (null se não recebeu airdrop)
  forensic: {
    behavior_pattern: string
    behavior_detail: string
    airdrop_rank: number
    airdrop_amount: number
    current_balance: number
    retention_rate: number
    diamond_score: number
    is_dumping: boolean
    insights: string[]
  } | null

  // Labels computadas
  labels: AddressLabel[]

  // Histórico de txs DOG
  transactions: TxEntry[]
  tx_count: number

  // Stats computados a partir das txs
  stats: {
    total_received_dog: number
    total_sent_dog: number
    first_tx_timestamp: string | null
    last_tx_timestamp: string | null
    first_tx_block: number | null
    last_tx_block: number | null
    largest_single_receive: number
    largest_single_send: number
  }

  metadata: {
    indexed_blocks: number   // quantos blocos cobertos pelo índice
    last_updated: string
    total_holders: number    // para calcular percentil no frontend
  }
}
```

---

### Etapa 3 — Labels Computadas

Labels são calculadas no endpoint de agregação com base nos dados disponíveis.

**Tiers por balance (usando distribuição real dos holders):**
```typescript
function getTierLabel(total_dog: number): AddressLabel {
  if (total_dog >= 500_000_000) return { id: 'whale',   emoji: '🐳', text: 'Whale',   description: 'Top 10 holder' }
  if (total_dog >= 100_000_000) return { id: 'shark',   emoji: '🦈', text: 'Shark',   description: 'Top 50 holder' }
  if (total_dog >=  50_000_000) return { id: 'dolphin', emoji: '🐬', text: 'Dolphin', description: 'Top 100 holder' }
  if (total_dog >=  10_000_000) return { id: 'fish',    emoji: '🐟', text: 'Fish',    description: 'Top 1,000 holder' }
  if (total_dog >=   1_000_000) return { id: 'shrimp',  emoji: '🦐', text: 'Shrimp',  description: 'Top 10,000 holder' }
  return { id: 'plankton', emoji: '🌊', text: 'Plankton', description: 'Holder' }
}
```

**Labels de ranking:**
```typescript
if (rank <= 10)  → { id: 'top10',  emoji: '🏆', text: 'Top 10 Holder' }
if (rank <= 100) → { id: 'top100', emoji: '🥇', text: 'Top 100 Holder' }
```

**Labels de comportamento (via forensic):**
```typescript
const behaviorLabels = {
  diamond_paws:      { emoji: '💎', text: 'Diamond Paws',       description: 'Held exact airdrop amount' },
  dog_legend:        { emoji: '🐕', text: 'DOG Legend',         description: 'Major accumulator' },
  hodl_hero:         { emoji: '🦸', text: 'HODL Hero',          description: 'Long-term holder' },
  satoshi_visionary: { emoji: '👁', text: 'Satoshi Visionary',  description: 'Early believer' },
  rune_master:       { emoji: '🔱', text: 'Rune Master',        description: 'Rune-native holder' },
  paper_hands:       { emoji: '📄', text: 'Paper Hands',        description: 'Sold airdrop' },
  panic_seller:      { emoji: '😱', text: 'Panic Seller',       description: 'Sold during dips' },
}
```

**Labels especiais:**
```typescript
// Airdrop OG — qualquer endereço no forensic
{ id: 'airdrop_og', emoji: '🎯', text: 'Airdrop OG', description: `Airdrop rank #${forensic.airdrop_rank}` }

// Acumulador — current_balance > airdrop_amount
if (forensic.current_balance > forensic.airdrop_amount)
  { id: 'accumulator', emoji: '📈', text: 'Accumulator', description: 'Bought more after airdrop' }
```

---

### Etapa 4 — Endpoint de Transação

**Arquivo:** `app/api/tx/bitcoin/[txid]/route.ts`

**Lógica:**
1. Busca o txid no Redis KV (`dog:transactions`) primeiro (txs recentes)
2. Se não encontrar, busca nos arquivos de bloco via scan (ou mantém índice `dog:txid:{txid}` → block_height para lookup direto)
3. Para cada endereço em senders e receivers, faz lookup rápido nos holders e forensic para enriquecer com rank e label
4. Retorna objeto completo

**Schema de resposta:**
```typescript
interface TxResponse {
  txid: string
  block_height: number
  timestamp: string
  type: string
  fee_sats: number
  total_dog_moved: number
  
  senders: Array<{
    address: string
    amount_dog: number
    // Enriquecimento
    holder_rank: number | null
    label: AddressLabel | null
    is_known: boolean          // aparece em holders ou forensic
  }>
  
  receivers: Array<{
    address: string
    amount_dog: number
    is_change: boolean
    holder_rank: number | null
    label: AddressLabel | null
    is_known: boolean
  }>
  
  classification: 'whale_movement' | 'airdrop_og_activity' | 'normal' | 'consolidation'
  mempool_link: string         // https://mempool.space/tx/{txid}
}
```

---

### Etapa 5 — Páginas Frontend

#### 5a. `/explorer` — Search Landing

**Arquivo:** `app/explorer/page.tsx`

Search bar central com:
- Placeholder: `Search address or transaction ID...`
- Detecção automática de formato:
  - Endereço BTC: começa com `bc1`, `1`, `3` e tem 25-62 chars → redireciona para `/address/bitcoin/{input}`
  - TXID: 64 chars hex → redireciona para `/tx/bitcoin/{input}`
  - Inválido → mostra mensagem de erro inline
- Sem submit, redireciona ao pressionar Enter ou clicar no botão
- Search bar também aparece no header das páginas `/address/*` e `/tx/*`

Layout sugerido:
```
[Logo DOG]
DOGDATA EXPLORER
Search any $DOG address or transaction

[___________________________________] [Search]

Recent notable addresses (Top 10 holders + últimos movers grandes)
```

#### 5b. `/address/bitcoin/[address]` — Página de Endereço

**Arquivo:** `app/address/bitcoin/[address]/page.tsx`

**Caso: endereço sem $DOG**
```
[Badge: Bitcoin]  bc1q...xyz  [Copy] [mempool.space ↗]

This address has no $DOG activity.
Not a DOG holder — yet? 🐕
```

**Caso: endereço com $DOG — seções:**

**1. Header**
```
[Badge: Bitcoin]  bc1q...xyz  [Copy] [mempool.space ↗]
[🐳 Whale] [💎 Diamond Paws] [🎯 Airdrop OG #10]
```

**2. Stats grid**
```
$DOG Balance          Rank              Percentile
1,234,567 DOG         #42               Top 0.05%

Total Received        Total Sent        UTXO Count
1,500,000 DOG         265,433 DOG       7

First Activity        Last Activity     Txs
Block 923,205         Block 946,917     34
2025-11-11            2026-03-28
```

**3. Forensic card** (só aparece se endereço está no forensic)
```
[💎 Diamond Paws]
Airdrop rank: #10 · Amount: 110,335,944 DOG
Retention rate: 100% · Diamond score: 100
"Elite holder"
```

**4. Transaction History**

Tabela com paginação (25 por página):
```
Direction  Amount DOG   Counterparty          Block     Date
→ OUT      889,806      bc1q...abc [🐳]       941,111   2026-03-18
← IN     1,000,000      bc1p...xyz            940,890   2026-03-15
```
- Direção clicável leva para `/tx/bitcoin/{txid}`
- Counterparty clicável leva para `/address/bitcoin/{counterparty}`
- Labels do counterparty aparecem se conhecido
- Filtros: All / In / Out

#### 5c. `/tx/bitcoin/[txid]` — Página de Transação

**Arquivo:** `app/tx/bitcoin/[txid]/page.tsx`

```
TRANSACTION
abc123...def456  [Copy] [mempool.space ↗]

Block 941,111 · 2026-03-18 05:54 UTC · [whale_movement]

INPUTS (Senders)                    OUTPUTS (Receivers)
bc1q...abc [🐳 Whale, #42]          bc1p...xyz [💎 Diamond Paws]
889,806 DOG                          889,806 DOG

Total moved: 889,806 DOG  ·  Fee: 609 sats
```

---

### Etapa 6 — Links Internos (integração com site existente)

Todos os endereços já exibidos no site passam a ser clicáveis:

| Página existente | Campo | Link para |
|---|---|---|
| `/holders` | address de cada holder | `/address/bitcoin/{address}` |
| `/forensic` | address de cada perfil | `/address/bitcoin/{address}` |
| `/transactions` | senders e receivers | `/address/bitcoin/{address}` e `/tx/bitcoin/{txid}` |

---

## Cache Strategy

| Dado | TTL | Onde |
|---|---|---|
| Índice de txs por endereço | permanente (invalidado por novo bloco) | Upstash Redis |
| Response do endpoint `/api/address/*` | 5 minutos | `Cache-Control: s-maxage=300` |
| Response do endpoint `/api/tx/*` | 1 hora (tx confirmada é imutável) | `Cache-Control: s-maxage=3600` |
| Páginas Next.js | ISR 5 min | `revalidate: 300` |

---

## SEO

- `<title>` dinâmico: `bc1q...xyz — $DOG Holder #42 | DogData Explorer`
- `<meta description>`: `Diamond Paws · Airdrop OG #10 · 1,234,567 $DOG · Top 0.05% holder. Explore on DogData.`
- `generateMetadata()` no Next.js App Router chamando o endpoint de agregação
- Sitemap dinâmico em `/sitemap.xml` incluindo:
  - Top 500 holders
  - Todos os airdrop OGs com `diamond_paws` e `dog_legend`
  - Endpoints de txs grandes recentes

---

## Sequência de Desenvolvimento

```
1. scripts/build-address-tx-index.ts          — índice Redis por endereço
2. app/api/address/bitcoin/[address]/route.ts  — endpoint de agregação
3. app/api/tx/bitcoin/[txid]/route.ts          — endpoint de transação
4. app/explorer/page.tsx                       — search landing
5. app/address/bitcoin/[address]/page.tsx      — página de endereço
6. app/tx/bitcoin/[txid]/page.tsx              — página de transação
7. Integração de links no site existente
8. generateMetadata + sitemap dinâmico
```

---

## Dependências Externas

- **mempool.space API** — usado apenas como link externo (não como fonte de dados). Cada página linka para `https://mempool.space/address/{address}` e `https://mempool.space/tx/{txid}`.
- **Upstash Redis** — já configurado via `lib/upstash.ts`. Usado para o índice de txs por endereço.
- Nenhuma nova API externa necessária para Bitcoin L1.

---

## O que NÃO está no escopo desta fase

- Chains Stacks e Solana (fase posterior)
- Balance over time chart (requer indexação temporal separada)
- Realized P&L (requer preço histórico por bloco cruzado com txs)
- Search por ENS/label (requer mapeamento editorial separado)
- Autenticação / features premium
