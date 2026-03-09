# Plano de Implementação: Fine-Tune dos Gráficos Históricos

## Objetivo
Configurar granularidade dinâmica por time range e ajustar escalas, eixos e formatação para aspecto profissional.

---

## 1. Backend — Downsampling na API Route

**Arquivo:** `app/api/metrics/history/route.ts`

### 1.1 Definir intervalos por range

| Range | Intervalo | Pontos Aprox. |
|-------|-----------|---------------|
| 24h   | 1 hora    | ~24           |
| 7d    | 4 horas   | ~42           |
| 30d   | 1 dia     | ~30           |
| 90d   | 3 dias    | ~30           |
| all   | 1 mês     | variável      |

### 1.2 Implementar agrupamento com `date_trunc` ou bucket temporal

Usar query SQL agrupada no Supabase via `.rpc()` ou raw SQL:

```sql
SELECT
  date_trunc('hour', recorded_at) AS bucket,
  -- Métricas de média
  AVG(current_price) AS current_price,
  AVG(mvrv_ratio) AS mvrv_ratio,
  AVG(gini_coefficient) AS gini_coefficient,
  AVG(sth_percentage) AS sth_percentage,
  AVG(lth_percentage) AS lth_percentage,
  AVG(supply_in_profit_pct) AS supply_in_profit_pct,
  AVG(realized_cap) AS realized_cap,
  AVG(market_cap) AS market_cap,
  AVG(avg_age_days) AS avg_age_days,
  AVG(top10_supply_pct) AS top10_supply_pct,
  AVG(top100_supply_pct) AS top100_supply_pct,
  AVG(top1000_supply_pct) AS top1000_supply_pct,
  -- Métricas de último valor (contadores)
  MAX(total_holders) AS total_holders,
  MAX(total_utxos) AS total_utxos
FROM dog_metrics_history
WHERE recorded_at >= $cutoff
GROUP BY bucket
ORDER BY bucket ASC
```

### 1.3 Mapeamento de intervalo para `date_trunc`

- **24h** → `date_trunc('hour', recorded_at)` — nativo
- **7d** → bucket de 4 horas — calcular: `timestamp '2000-01-01' + FLOOR(EXTRACT(EPOCH FROM recorded_at) / (4*3600)) * INTERVAL '4 hours'`
- **30d** → `date_trunc('day', recorded_at)` — nativo
- **90d** → bucket de 3 dias — calcular: `timestamp '2000-01-01' + FLOOR(EXTRACT(EPOCH FROM recorded_at) / (3*86400)) * INTERVAL '3 days'`
- **all** → `date_trunc('month', recorded_at)` — nativo

### 1.4 Opção de implementação

**Opção A — RPC function no Supabase (preferível)**
Criar uma function PostgreSQL `get_metrics_history(range_param text)` que encapsula a lógica de bucketing.

**Opção B — Query no route handler**
Usar `supabase.rpc()` ou construir a query com `.from().select()` e fazer o agrupamento no JS do route handler como fallback caso não tenhamos acesso para criar functions no Supabase.

**Decisão:** Tentar Opção A primeiro. Se não for possível, fazer agrupamento no JS do route handler (buscar dados brutos com limite razoável e agrupar em memória).

---

## 2. Backend — Agregação por Tipo de Métrica

### 2.1 Métricas com AVG (média)
- `current_price`
- `mvrv_ratio`
- `gini_coefficient`
- `sth_percentage`
- `lth_percentage`
- `supply_in_profit_pct`
- `realized_cap`
- `market_cap`
- `avg_age_days`
- `top10_supply_pct`
- `top100_supply_pct`
- `top1000_supply_pct`

### 2.2 Métricas com MAX (último/maior valor — contadores)
- `total_holders`
- `total_utxos`

---

## 3. Frontend — Formatação do X-Axis

**Arquivo:** `components/metrics/historical-charts.tsx`

### 3.1 Atualizar `formatXAxis` por range

```typescript
const formatXAxis = (dateStr: string) => {
  const d = new Date(dateStr)
  switch (range) {
    case '24h':
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    case '7d':
      return d.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' +
             d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    case '30d':
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    case '90d':
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    case 'all':
      return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    default:
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}
```

### 3.2 Configurar tick count por range

Limitar a ~6-8 ticks visíveis no XAxis:

```typescript
const getTickCount = (range: TimeRange) => {
  switch (range) {
    case '24h': return 8    // a cada 3h
    case '7d':  return 7    // 1 por dia
    case '30d': return 6    // a cada 5 dias
    case '90d': return 6    // a cada ~15 dias
    case 'all': return 8    // depende do total
  }
}
```

Usar `<XAxis interval={Math.ceil(data.length / tickCount)}` ou `tickCount` do Recharts.

---

## 4. Frontend — Escala do Y-Axis

**Arquivo:** `components/metrics/historical-charts.tsx`

### 4.1 Configuração de domain por métrica

```typescript
const chartConfigs = {
  mvrv_ratio:          { domain: ['auto', 'auto'], padding: true },
  total_holders:       { domain: ['auto', 'auto'], padding: true },
  total_utxos:         { domain: ['auto', 'auto'], padding: true },
  gini_coefficient:    { domain: [0, 1],           padding: false },
  sth_percentage:      { domain: [0, 100],         padding: false },
  supply_in_profit_pct:{ domain: [0, 100],         padding: false },
  current_price:       { domain: ['auto', 'auto'], padding: true },
  realized_cap:        { domain: ['auto', 'auto'], padding: true },
}
```

### 4.2 Para domínios 'auto' com padding

Calcular `dataMin * 0.95` e `dataMax * 1.05` para dar respiro visual:

```typescript
domain={[
  (dataMin: number) => dataMin * 0.95,
  (dataMax: number) => dataMax * 1.05,
]}
```

---

## 5. Frontend — Tooltip Refinado

### 5.1 Formatação contextual no tooltip

Manter o tooltip atual mas garantir que o timestamp mostrado reflete o bucket (não o raw timestamp):

- **24h**: `"14:00"`
- **7d**: `"Mon 08, 14:00"`
- **30d**: `"Mar 08"`
- **90d**: `"Mar 06 - Mar 08"` (mostrar range do bucket)
- **all**: `"Mar 2025"`

---

## 6. Ordem de Execução

| Etapa | Tarefa | Arquivo(s) |
|-------|--------|------------|
| 1 | Implementar lógica de bucketing/agrupamento na API | `app/api/metrics/history/route.ts` |
| 2 | Testar API com cada range e verificar pontos retornados | — |
| 3 | Atualizar formatXAxis com lógica por range | `components/metrics/historical-charts.tsx` |
| 4 | Configurar tick count no XAxis | `components/metrics/historical-charts.tsx` |
| 5 | Ajustar Y-axis domains com padding | `components/metrics/historical-charts.tsx` |
| 6 | Refinar tooltips com formatação por range | `components/metrics/historical-charts.tsx` |
| 7 | Testar visualmente todos os ranges e métricas | — |

---

## 7. Critérios de Sucesso

- [ ] Cada range retorna ~24-42 pontos (não centenas)
- [ ] X-axis com 6-8 ticks legíveis em qualquer range
- [ ] Y-axis com escala adequada (sem espaço desperdiçado)
- [ ] Tooltips com timestamps formatados por range
- [ ] Gráficos responsivos e com boa performance
- [ ] Métricas de contagem (holders, UTXOs) usam MAX, demais usam AVG
