# DOG METRICS — Plano de Implementação (vivo)

> Documento de execução para o catálogo on-chain estilo ChartInspect/Glassnode.
> Deriva do esboço `dogmetrics.md` + achados da Fase 0 (spike) + auditoria do código real.
> **Regra:** este arquivo é a fonte de verdade. Atualizar o status de cada task ao concluir. Não inventar dados/caminhos — toda afirmação aqui foi verificada no código.

**Última atualização:** 2026-06-10
**Decisões do dono:** (1) fundação acurada PRIMEIRO — todo chart nasce com história completa; (2) engine de chart = Recharts por ora (reavaliar lightweight-charts depois); (3) alvo honesto ~45-50 métricas.

Legenda de status: ⬜ pendente · 🟡 em andamento · ✅ feito · ⏸️ bloqueado · ❌ descartado

---

## 0. Sumário da auditoria (verificado em 2026-06-10)

**O que JÁ existe e funciona:**
- Live scanner `scripts/dog_block_scanner.py` — no bloco **953141** (rodou 2026-06-10). `scan_block()` já retorna `(tx_data, new_utxos, spent_outpoints)` → **os spends já são computados**, apenas descartados após atualizar o UTXO set vivo (linhas 1032-1037).
- `scripts/replay_dog_history.py` — **reusa** `scanner.scan_block()` (mesmo engine). Já rodou até bloco **947636** (343k txs). Mesmo loop create/spend (linhas 181-188).
- `scripts/update_holders_and_fees.py` — calcula cost basis per-outpoint de produção (preço no bloco de criação). **Esta é a metodologia canônica** que o backfill deve reproduzir (linhas 490-535, `get_price_at_timestamp` 667).
- `data/dog_transactions/block_*.json` — 85.737 arquivos (blocos 840647→952861), fluxo senders/receivers por bloco.
- Supabase: `dog_transactions` (migration 002), `dog_metrics_history` (collect_metrics_history.ts insere; ~3 linhas só — forward-only recém-ligado).
- UI: `components/charts/onchain-chart.tsx` (componente-padrão Glassnode), `registry.ts` (9 métricas), `app/charts/page.tsx` (`/charts`), `components/charts/format.ts`. **Já renderiza HTTP 200.**
- Fase 0: `scripts/spike_reconstruct_history.py` + `data/spike_reconstructed_history.json` (776 pontos diários; scaffold reaproveitável).

**O que NÃO existe:**
- ❌ Tabela/log `utxo_events` (grep zerado) — a fundação. **Mas o dado que ela precisa já é calculado em `scan_block`.**
- ❌ `price_history` acurado até hoje — `data/dog_price_history.json` para em **2026-01-07** (5 meses defasado).
- ❌ `metric_series` (série temporal genérica por métrica).

**Achados da Fase 0 (de-risking):**
- Reconstrução offline pelos block files = **6% de supply fantasma** (5.98B DOG) por receives faltando. Reordenação intra-bloco testada → não resolve = são gaps reais de dados.
- O deficit **surge no bloco ~80k (≈947k)**, exatamente onde o replay parou e o live scanner (com design flaw de dropar tx de input desconhecido) assumiu. **Hipótese forte: o gap está na cauda pós-947636, não no histórico.** → Re-rodar o replay até o tip deve fechar a maior parte. **A validar na F1-T4.**
- `realized_cap` reconstruído 77% off + supply-in-profit travado em ~98% (real 22%) — cost basis errado por (a) preço defasado, (b) FIFO-lote ≠ sobrevivência por outpoint. **Resolvido movendo para eventos por outpoint.**

**Docs antigos (referência, parcialmente superados):** `docs/ON_CHAIN_METRICS_PLAN.md`, `docs/METRICS_MISSING_ANALYSIS.md`, `docs/UTXO_METRICS_SETUP.md`.

---

## 1. Arquitetura-alvo

```
 CHAIN ──► scan_block() [JÁ EXISTE] ──► emite utxo_events (CREATE/SPEND + preço)  ◄── F1
                                              │
                                   Supabase: utxo_events (1 linha/outpoint)        ◄── F1
                                              │
                          aggregator (reusa scaffold do spike)                     ◄── F2
                                              │
                                   Supabase: metric_series (metric_key,date,cohort,value) ◄── F2
                                              │
                          /api/metrics/{metric}?from&to&resolution                  ◄── F3
                                              │
                   registry.ts + OnChainChart (Recharts) → /charts                 ◄── parcialmente FEITO
```

Princípio: **a relê pesada roda uma vez (F1); adicionar a métrica #40 depois é só aggregator + registry**, sem tocar na chain.

---

## 2. Tarefas executáveis

### F1 — Fundação `utxo_events` + `price_history` *(caminho crítico)*

| ID | Task | Status | Critério de auditoria (DoD) |
|----|------|--------|------------------------------|
| F1-T1 | Desenhar schema `utxo_events` + migration SQL | ✅ | FEITO 2026-06-10: `migrations/005_utxo_events.sql` (1 linha/outpoint, INSERT no create + UPDATE no spend; índices live/created/spent/ts; RLS service-role). Particionamento dispensado a 1-2M linhas (decisão documentada na migration) |
| F1-T2 | Instrumentar `scan_block`/`process_dog_tx` para emitir eventos CREATE (outpoint, address, amount_dog, block, ts, price) e marcar SPEND (outpoint, block, ts, price) | ⬜ | Um único ponto de emissão cobre live scanner E replay (ambos passam por `scan_block`). Sem alterar shape do `utxo_set` vivo. Flag `--emit-events` para não impactar runs normais |
| F1-T3 | Estender/validar `price_history` até hoje (Kraken diário primário, Gate fallback) + persistir no Supabase | ⬜ | `price_history` sem buraco 2026-01-07→hoje; investigar por que o cron parou; fonte canônica documentada; gap pré-listagem (≈4 dias) tratado |
| F1-T4 | Re-rodar replay 840001→tip com `--emit-events`, recuperando os 2 blocos falhos (844443, 844446) | ⏸️ F1-T2 | Janela com scanner parado (lock ord, ver [[project_ord_service_lock]]). `utxo_events` populada para toda a história |
| F1-T5 | **Validação de reconciliação** | ⏸️ F1-T4 | (a) UTXOs vivos em `utxo_events` (spent IS NULL) == `ord balances` por endereço; (b) realized_cap/MVRV/supply-in-profit reconstruídos batem com `utxo_age_stats` de produção dentro de ~1%; (c) deficit de supply < 0.5% (vs 6% do spike) |
| F1-T6 | Live scanner emite eventos continuamente (going forward) | ⏸️ F1-T2 | Após cada bloco novo, novas linhas CREATE e updates SPEND aparecem em `utxo_events` |

### F2 — Aggregator + `metric_series`

| ID | Task | Status | Critério de auditoria (DoD) |
|----|------|--------|------------------------------|
| F2-T1 | Migration `metric_series` (metric_key, date, cohort, value) | ⏸️ F1 | `migrations/006_metric_series.sql`; PK (metric_key, date, cohort) |
| F2-T2 | Reescrever o aggregator do spike para consumir `utxo_events` (não block files) | ⏸️ F1-T5 | Reusa lógica de `spike_reconstruct_history.py`; cost basis = `created_price`; gera painéis diários acurados |
| F2-T3 | Backfill `metric_series` com Tier 0 desde o etching | ⏸️ F2-T2 | Série diária 2024-04 → hoje para realized_cap, MVRV, supply-in-profit/loss, gini, top-N, holders, utxos, STH/LTH, avg/median age |
| F2-T4 | Cron diário: novo snapshot → `metric_series` | ⏸️ F2-T2 | Roda após `automated_update.py`; idempotente por (metric,date) |

### F3 — API + Tier 0/1 (todos com história completa)

| ID | Task | Status | Critério de auditoria (DoD) |
|----|------|--------|------------------------------|
| F3-T1 | Endpoint genérico `/api/metrics/{metric}?from&to&resolution=1d\|1h` → `[{t,v}]` + meta | ⏸️ F2 | Lê `metric_series`; cache; freshness no payload |
| F3-T2 | Expandir `registry.ts` com Tier 1 cost-basis: MVRV-Z, Realized Price, NUPL, HODL Waves, STH/LTH Cost Basis & MVRV, Cohort Supply (Shrimp→Humpback) | ⏸️ F2 | Cada métrica = 1 entrada; renderiza no `/charts` |
| F3-T3 | Tier 1 puro-preço: Mayer Multiple, MAs, RSI, drawdown ATH, retornos mensais, volatilidade | ⏸️ F1-T3 | Derivado só de `price_history` |
| F3-T4 | `/charts`: catálogo navegável por categoria + descrição/interpretação por métrica + disclaimer de "1 ciclo de amostra" | 🟡 parcial | Página existe; falta categorias completas + textos + disclaimer |

### F4 — Tier 2 (SOPR / CDD / Cointime) — destravado por `spent_price`

| ID | Task | Status | DoD |
|----|------|--------|-----|
| F4-T1 | SOPR + aSOPR + STH/LTH-SOPR + SOPR by Age | ⏸️ F1 | Usa `spent_price/created_price` de `utxo_events` |
| F4-T2 | Realized Profit & Loss (diário) + Net Realized P&L + by Age/cohort | ⏸️ F1 | |
| F4-T3 | CDD + STH/LTH CDD + Dormancy + Average Dormancy | ⏸️ F1 | |
| F4-T4 | Liveliness + framework Cointime (NVT/RVT, Vaulted vs Active, AVIV) | ⏸️ F4-T3 | |
| F4-T5 | Revived Supply by Age + Net Position Change (STH/LTH, hodler) + Velocity | ⏸️ F1 | |

### F5 — Tier 3 composites + exclusivas DOG + gating

| ID | Task | Status | DoD |
|----|------|--------|-----|
| F5-T1 | DOG Risk Index (MVRV-Z + NUPL + SOPR + concentração, normalizado 0-1) | ⏸️ F4 | Nome próprio (não copiar nomes proprietários do ChartInspect) |
| F5-T2 | DOG Fear & Greed Index | ⏸️ F4 | |
| F5-T3 | Exclusivas: Diamond Score Index, Airdrop Retention Curve, OG Spending Events, Cross-Chain Supply Migration, Forensic Behavior Distribution | ⏸️ F1 | Usa dados que só temos ([[project_holders_by_age_feature]], [[project_behavioral_patterns]], [[project_external_holders_sources]], [[project_diamond_paws_lost_estimate]]) |
| F5-T4 | Gating: Tier 0+1 grátis / Tier 2+3 pago em $DOG; openapi.json + llms.txt só quando funcionarem | ⏸️ F4 | |

---

## 3. Riscos / cuidados (do esboço + auditoria)

- **Janela do scanner parado (F1-T4):** lock single-writer do ord; agendar e restaurar o scanner ao fim.
- **Honestidade estatística:** ~2 anos = 1 ciclo; disclaimer obrigatório nas zonas de topo/fundo (F3-T4).
- **Storage:** `utxo_events` ~1-2M linhas lifetime; particionar por mês.
- **Não aplicável a DOG:** mining (Puell/Thermocap) — supply 100% no etching. Substituir por Airdrop Economics (F5-T3).

---

## 4. Log de progresso

- **2026-06-10** — Auditoria + Fase 0 concluídas. Plano criado. Confirmado: spends já computados em `scan_block`; `utxo_events` não existe; gap de 6% provavelmente na cauda pós-947636.
- **2026-06-10** — ✅ **F1-T1**: `migrations/005_utxo_events.sql` criada. Próximo: **F1-T2** (instrumentar `scan_block` — design pronto para revisão, abaixo, antes de aplicar no scanner live).
