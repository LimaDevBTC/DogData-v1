# Explorer — Supabase como source of truth

Documentação da migração do índice de transações DOG do Upstash Redis para
Supabase Postgres, feita em 2026-04-30.

---

## Visão geral

O Explorer (`/explorer`, `/address/bitcoin/{addr}`, `/tx/bitcoin/{txid}`) usa
**Supabase Postgres** como fonte única de verdade para o histórico de transações
DOG, cobrindo do bloco **840,654** (primeiro airdrop) até o último bloco
processado pelo scanner live.

- **Tabela**: `dog_transactions`
- **Cobertura inicial**: 59,029 txs ao final do backfill histórico
- **Índices**: GIN em `addresses` + B-tree em `block_height` e `txid`
- **Latência típica**: 200-500ms por endereço (até ~2k txs); ~4s no caso
  patológico do genesis address (844 txs com ~100 receivers cada)

---

## Por que Supabase, não Redis

O índice anterior tentava manter `dog:addr:txs:{address}` no Upstash Redis
(plano free, 256 MB). Ao tentar indexar o histórico completo (94k endereços,
59k txids) o reindex bateu o teto em ~2k endereços e o DB ficou inacessível
até pra `SET` simples.

| Critério | Redis (Upstash free) | Supabase (free) |
|---|---|---|
| Storage | 256 MB | 500 MB Postgres |
| Modelo | Lista por endereço | Linha por tx + addresses[] |
| Pagination | Manual (LRANGE) | `LIMIT/OFFSET` SQL |
| Filtro por bloco | Não | `WHERE block_height BETWEEN ...` |
| Custo no plano free | Excedeu | Cabe folgado (~80MB usados) |

A latência de ~50ms a mais do Postgres vs Redis não é UX-crítica para um
explorer (cache `s-maxage=300` cobre o caso quente).

---

## Schema

A tabela `dog_transactions` já existia (mantida pelo `dog_block_scanner.py`).
A migration adicionou apenas a coluna denormalizada `addresses` e índices.

### Colunas relevantes

```sql
CREATE TABLE dog_transactions (
  id                BIGSERIAL PRIMARY KEY,
  txid              TEXT NOT NULL UNIQUE,
  block_height      INTEGER NOT NULL,
  timestamp         TIMESTAMPTZ NOT NULL,
  type              TEXT,                -- 'transfer' | ...
  total_dog_moved   DOUBLE PRECISION,
  net_transfer      DOUBLE PRECISION,
  change_amount     DOUBLE PRECISION,
  has_change        BOOLEAN,
  fee_sats          INTEGER,
  sender_count      INTEGER,
  receiver_count    INTEGER,
  senders           TEXT,                -- JSON array stringified
  receivers         TEXT,                -- JSON array stringified
  addresses         TEXT[],              -- ★ denormalized: senders ∪ receivers addresses
  created_at        TIMESTAMPTZ DEFAULT now()
);
```

### Índices

```sql
CREATE INDEX idx_dog_tx_addresses    ON dog_transactions USING gin (addresses);
CREATE INDEX idx_dog_tx_block_height ON dog_transactions (block_height DESC);
CREATE UNIQUE INDEX idx_dog_tx_txid_unique ON dog_transactions (txid);
```

A tabela já vinha com uma constraint `dog_transactions_txid_key` em `txid`,
o que faz com que upserts via PostgREST precisem de `?on_conflict=txid` na
URL para resolver o alvo do `merge-duplicates`.

---

## Migration

Arquivo: [`supabase/migrations/001_explorer_indexes.sql`](../supabase/migrations/001_explorer_indexes.sql)

Roda no **Supabase Dashboard → SQL Editor → New Query**. É idempotente
(`IF NOT EXISTS`). Faz:

1. `ADD COLUMN addresses TEXT[]`
2. `CREATE INDEX ... gin (addresses)`
3. `CREATE INDEX ... block_height DESC`
4. `CREATE UNIQUE INDEX ... txid`
5. `UPDATE dog_transactions SET addresses = ...` para popular linhas existentes

O passo 5 usa regex defensivo (`senders::text ~ '^\s*\['`) pra só cast para
`jsonb` quando o valor é claramente um array — evita falhas em rows com
`senders` NULL ou string vazia.

---

## Backfill histórico

Script: [`scripts/backfill_supabase.py`](../scripts/backfill_supabase.py)

Lê todos os arquivos `data/dog_transactions/block_*.json` (output do
`dog_block_scanner.py` + `backfill_dog_history.py`) e faz upsert em batches
de 500 rows via REST API. Usa checkpoint em
`data/backfill_supabase_state.json` pra resumir após falha.

```bash
# Rodada inicial (35,693 block files → 59k txs):
python3 scripts/backfill_supabase.py

# Resumir do último checkpoint:
python3 scripts/backfill_supabase.py --resume

# Verificar contagens (sem inserir):
python3 scripts/backfill_supabase.py --verify
```

**Performance observada**: ~250 blocos/s no plano Supabase free, ~3 min para
35k blocos. Cobertura final: blocos 840,654 → 947,320.

---

## API endpoints

### `GET /api/address/bitcoin/{address}`

Arquivo: [`app/api/address/bitcoin/[address]/route.ts`](../app/api/address/bitcoin/[address]/route.ts)

Query principal:

```sql
SELECT txid, block_height, timestamp, total_dog_moved, fee_sats, senders, receivers
FROM dog_transactions
WHERE addresses @> ARRAY[$1]   -- GIN index lookup
ORDER BY block_height DESC
LIMIT 10000;
```

Para cada row, parseia `senders`/`receivers` (JSON) e classifica como
`'in' | 'out' | 'self'` baseado na presença do endereço-alvo. Retorna lista
paginada + stats agregadas + labels (whale/shark/etc + behavior pattern).

Query strings suportadas: `limit`, `offset`, `direction=in|out`.

### `GET /api/tx/bitcoin/{txid}`

Arquivo: [`app/api/tx/bitcoin/[txid]/route.ts`](../app/api/tx/bitcoin/[txid]/route.ts)

```sql
SELECT * FROM dog_transactions WHERE txid = $1 LIMIT 1;
```

Enriquece senders/receivers com `holder_rank` e `behavior_label` lookup
(via maps em memória de `dog_holders_by_address.json` e
`forensic_behavioral_analysis.json`).

---

## Integração com o scanner live

O `dog_block_scanner.py` (rodando em loop) continua sendo a fonte de
escrita. A função `push_to_supabase(new_txs, addresses=True)` foi
atualizada para:

- Popular a coluna `addresses` (set único de sender ∪ receiver addresses)
- Usar `Prefer: resolution=merge-duplicates` + `?on_conflict=txid` para
  upsert idempotente

Chamada em `scripts/dog_block_scanner.py:953` após cada bloco com DOG txs:

```python
push_to_supabase(all_txs, addresses=True)
```

A função antiga `update_address_tx_index()` (que escrevia no Redis) foi
removida do pipeline. O Redis ainda é usado para outras finalidades
(price cache, dog:transactions, holder snapshots) mas não para o índice
de endereços.

O cron `automated_update.py` também não chama mais
`build-address-tx-index.ts` — esse script ficou obsoleto.

---

## Performance

Medido em localhost contra Supabase free tier:

| Endereço | # txs | Latência |
|---|---|---|
| Endereço típico | < 100 | ~250ms |
| Top #1 holder | 470 | ~1.4s |
| Top #2 holder | 2,221 | ~1.9s |
| Genesis (airdrop sender) | 844 | ~4s ★ |
| Tx individual | 1 | ~1s |

★ O genesis é caso patológico: cada uma das 844 txs do airdrop tem ~100
receivers no campo JSON `receivers`, totalizando ~12MB de payload. Se
isso virar um gargalo real, opções:

1. Adicionar coluna por-endereço (`(txid, address, direction, amount)`)
   numa tabela auxiliar — query mais leve
2. Postgres function/RPC que projeta o resultado server-side
3. Cache em Redis das top N queries quentes

Por ora, `Cache-Control: public, s-maxage=300` na rota cobre os casos
repetidos via Vercel CDN.

---

## Troubleshooting

### Endereço retornando 0 txs

1. Confirma que a coluna `addresses` está populada:
   ```sql
   SELECT count(*) FROM dog_transactions WHERE addresses IS NULL;
   -- deveria retornar 0
   ```
2. Confirma que o GIN index existe:
   ```sql
   SELECT indexname FROM pg_indexes WHERE tablename = 'dog_transactions';
   ```
3. Roda direto via REST:
   ```bash
   curl "$SUPABASE_URL/rest/v1/dog_transactions?select=count&addresses=cs.{ENDERECO}" \
     -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Prefer: count=exact" -H "Range: 0-0"
   ```

### Scanner pushing duplicates

`HTTP 409: duplicate key value violates unique constraint dog_transactions_txid_key`

Indica que o request não tem `?on_conflict=txid`. Verifica
`push_to_supabase()` em `dog_block_scanner.py` — a URL deve ser
`/rest/v1/dog_transactions?on_conflict=txid` e o header
`Prefer: resolution=merge-duplicates`.

### Backfill resumir após queda

Os checkpoints estão em `data/backfill_supabase_state.json`:

```json
{ "last_block": 947320, "rows_inserted": 58639 }
```

`python3 scripts/backfill_supabase.py --resume` continua do `last_block + 1`.
Se o state file estiver corrompido, deletar pra começar do zero (o
`Prefer: merge-duplicates` lida com rows já inseridas).

---

## Arquivos modificados pela migração

- `supabase/migrations/001_explorer_indexes.sql` — schema + backfill da coluna
- `scripts/backfill_supabase.py` — bulk load dos 35k block files
- `app/api/address/bitcoin/[address]/route.ts` — Redis → Supabase
- `app/api/tx/bitcoin/[txid]/route.ts` — Redis → Supabase
- `scripts/dog_block_scanner.py` — `push_to_supabase()` popula `addresses`,
  `update_address_tx_index()` removida do pipeline
- `scripts/automated_update.py` — removido step do `build-address-tx-index.ts`
