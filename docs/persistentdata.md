# Persistent Data - Supabase Setup Guide

## 1. SQL para executar no Supabase SQL Editor

Acesse: **Supabase Dashboard > SQL Editor > New Query**

Cole e execute:

```sql
-- Tabela principal de métricas históricas
CREATE TABLE dog_metrics_history (
  id                    BIGSERIAL PRIMARY KEY,
  recorded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_utxos           INTEGER NOT NULL,
  total_holders         INTEGER NOT NULL,
  gini_coefficient      REAL NOT NULL,
  top10_supply_pct      REAL NOT NULL,
  top100_supply_pct     REAL NOT NULL,
  top1000_supply_pct    REAL NOT NULL,
  avg_age_days          REAL NOT NULL,
  median_age_days       REAL NOT NULL,
  sth_percentage        REAL NOT NULL,
  lth_percentage        REAL NOT NULL,
  realized_cap          DOUBLE PRECISION NOT NULL,
  market_cap            DOUBLE PRECISION NOT NULL,
  mvrv_ratio            REAL NOT NULL,
  supply_in_profit_pct  REAL NOT NULL,
  supply_in_loss_pct    REAL NOT NULL,
  current_price         DOUBLE PRECISION NOT NULL
);

-- Índice para queries por tempo (o padrão principal de consulta)
CREATE INDEX idx_metrics_recorded_at ON dog_metrics_history (recorded_at DESC);

-- Unique constraint: máximo 1 row por hora (evita duplicatas se o cron rodar 2x)
CREATE UNIQUE INDEX idx_metrics_hourly_unique
  ON dog_metrics_history (date_trunc('hour', recorded_at));

-- Row Level Security
ALTER TABLE dog_metrics_history ENABLE ROW LEVEL SECURITY;

-- Política: anon key (usada pelo frontend/Vercel) só pode LER
CREATE POLICY "Allow public read access"
  ON dog_metrics_history
  FOR SELECT
  USING (true);

-- Política: service_role key (usada pelo collector local) pode INSERIR
CREATE POLICY "Allow service role insert"
  ON dog_metrics_history
  FOR INSERT
  WITH CHECK (true);
```

---

## 2. Variáveis de Ambiente

### Local (.env.local)

Após criar o projeto no Supabase, pegue as credenciais em:
**Settings > API** no dashboard do Supabase.

Adicione ao arquivo `.env.local`:

```env
SUPABASE_URL=https://SEU-PROJECT-ID.supabase.co
SUPABASE_ANON_KEY=eyJ...sua-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJ...sua-service-role-key...
```

- `SUPABASE_URL` → Project URL
- `SUPABASE_ANON_KEY` → anon public key (em Project API Keys)
- `SUPABASE_SERVICE_ROLE_KEY` → service_role key (em Project API Keys)

### Vercel (Environment Variables)

No dashboard da Vercel, adicione APENAS:

```
SUPABASE_URL=https://SEU-PROJECT-ID.supabase.co
SUPABASE_ANON_KEY=eyJ...sua-anon-key...
```

**NUNCA** adicione `SUPABASE_SERVICE_ROLE_KEY` na Vercel (é chave administrativa).

---

## 3. Comandos pós-setup

### 3.1 Backfill (popular dados históricos existentes - rodar 1x só)

```bash
cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1
npx tsx scripts/backfill_metrics_history.ts
```

Isso insere os ~57 registros diários de `utxo_count_history.json` + preços de `dog_price_history.json`.

### 3.2 Testar o collector (inserir snapshot atual)

```bash
npx tsx scripts/collect_metrics_history.ts
```

Deve imprimir: `✅ Metrics snapshot inserted successfully`

Rodando 2x na mesma hora, deve imprimir: `⏭️ Row for this hour already exists, skipping`

### 3.3 Verificar dados no Supabase

No SQL Editor do Supabase, rode:

```sql
-- Ver últimas 5 inserções
SELECT recorded_at, total_utxos, total_holders, mvrv_ratio, current_price
FROM dog_metrics_history
ORDER BY recorded_at DESC
LIMIT 5;

-- Contar total de registros
SELECT COUNT(*) FROM dog_metrics_history;

-- Verificar que não há duplicatas
SELECT date_trunc('hour', recorded_at) as hour, COUNT(*)
FROM dog_metrics_history
GROUP BY hour
HAVING COUNT(*) > 1;
-- Deve retornar 0 linhas
```

---

## 4. Como funciona o fluxo automático

```
Cron (cada hora, minuto 0)
    │
    ▼
automated_update.py
    │
    ├─ 1. Atualiza holders via Bitcoin node + Ord
    ├─ 2. Lê external_holders.json
    ├─ 3. Atualiza valores hardcoded no frontend
    ├─ 4. Git commit + push
    │
    └─ 5. [NOVO] Chama collect_metrics_history.ts
              │
              ├─ Lê public/data/dog_holders.json (recém-atualizado)
              ├─ Calcula Gini, top10/100/1000%
              ├─ Extrai métricas de utxo_age_stats
              └─ INSERT no Supabase (1 row por hora)
```

---

## 5. Arquivos criados/modificados

| Arquivo | Tipo | Função |
|---------|------|--------|
| `lib/supabase.ts` | Novo | Cliente Supabase (anon key, para API routes) |
| `scripts/collect_metrics_history.ts` | Novo | Collector horário (service_role key) |
| `scripts/backfill_metrics_history.ts` | Novo | Backfill one-time dos JSONs existentes |
| `app/api/metrics/history/route.ts` | Novo | Endpoint `/api/metrics/history?range=7d` |
| `components/ui/metric-sparkline.tsx` | Novo | Mini gráfico sparkline para cards |
| `components/metrics/historical-charts.tsx` | Novo | Seção com 8 gráficos históricos |
| `app/metrics/page.tsx` | Editado | Sparklines nos cards + seção histórica |
| `scripts/automated_update.py` | Editado | Chama collector após git push |

---

## 6. Métricas acumuladas (16 campos)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `total_utxos` | int | Total de UTXOs não gastos |
| `total_holders` | int | Total de endereços com DOG |
| `gini_coefficient` | float | Concentração (0=igual, 1=concentrado) |
| `top10_supply_pct` | float | % do supply nos top 10 holders |
| `top100_supply_pct` | float | % do supply nos top 100 holders |
| `top1000_supply_pct` | float | % do supply nos top 1000 holders |
| `avg_age_days` | float | Idade média dos UTXOs em dias |
| `median_age_days` | float | Idade mediana dos UTXOs em dias |
| `sth_percentage` | float | % supply em Short-Term Holders (<155 dias) |
| `lth_percentage` | float | % supply em Long-Term Holders (>=155 dias) |
| `realized_cap` | float | Realized Cap em USD |
| `market_cap` | float | Market Cap em USD |
| `mvrv_ratio` | float | Market Value to Realized Value ratio |
| `supply_in_profit_pct` | float | % do supply em lucro |
| `supply_in_loss_pct` | float | % do supply em prejuízo |
| `current_price` | float | Preço atual do DOG em USD |

---

## 7. API de consulta

### Endpoint: `GET /api/metrics/history`

**Parâmetros:**

| Param | Valores | Default | Descrição |
|-------|---------|---------|-----------|
| `range` | `24h`, `7d`, `30d`, `90d`, `all` | `30d` | Período |
| `metrics` | lista separada por vírgula | todos | Filtro de colunas |

**Exemplos:**

```
/api/metrics/history?range=7d
/api/metrics/history?range=30d&metrics=mvrv_ratio,current_price
/api/metrics/history?range=all
```

**Resposta:**

```json
{
  "history": [
    {
      "recorded_at": "2026-03-06T00:00:00Z",
      "total_utxos": 251150,
      "total_holders": 89464,
      "gini_coefficient": 0.85,
      "mvrv_ratio": 0.265,
      "current_price": 0.000758,
      "..."
    }
  ],
  "total_points": 720,
  "range": "30d",
  "last_updated": "2026-03-07T23:00:00Z"
}
```
