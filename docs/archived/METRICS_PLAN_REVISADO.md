# 📊 Plano Revisado - Aba Metrics (Baseado em Análise Completa)

## 🎯 Objetivo

Criar uma nova aba "Metrics" no DogData com indicadores on-chain profissionais, **aproveitando ao máximo os dados que já temos** e identificando o que realmente falta.

---

## ✅ O QUE JÁ TEMOS (Base Sólida)

### Dados Disponíveis
1. ✅ **Holders completos** - 90,734 holders com saldos, UTXO count, ranking
2. ✅ **Transações recentes** - Últimas 500 transações com senders, receivers, fees
3. ✅ **Métricas 24h** - Já calculadas: txCount, volume, active wallets, top wallets
4. ✅ **Análise forense** - 75,490 recipients com padrões comportamentais
5. ✅ **Snapshots** - Podemos comparar snapshots de holders de diferentes datas

### APIs Funcionais
1. ✅ `/api/dog-rune/stats` - Stats gerais
2. ✅ `/api/dog-rune/holders` - Lista de holders
3. ✅ `/api/dog-rune/transactions-kv` - Transações + métricas 24h
4. ✅ `/api/forensic/summary` - Análise forense

---

## 🚀 FASE 1: MVP - Indicadores que JÁ PODEMOS FAZER (1-2 semanas)

### Indicadores Imediatos (Sem Dados Adicionais)

#### 1. **Transaction Metrics** ✅ Dados Disponíveis
- **Active Addresses** (24h, 7d, 30d)
  - **Fonte:** Cache de transações
  - **Cálculo:** Contar endereços únicos em `senders` + `receivers`
  - **Já temos:** `activeWalletCount` nas métricas 24h

- **Transaction Volume** (24h, 7d, 30d)
  - **Fonte:** Cache de transações
  - **Cálculo:** Somar `total_dog_moved` ou `net_transfer`
  - **Já temos:** `totalDogMoved` nas métricas 24h

- **Transaction Count** (24h, 7d, 30d)
  - **Fonte:** Cache de transações
  - **Cálculo:** Contar transações por período
  - **Já temos:** `txCount` nas métricas 24h

- **Average Transaction Size**
  - **Fonte:** Cache de transações
  - **Cálculo:** `totalDogMoved / txCount`
  - **Já temos:** `avgDogPerTx` nas métricas 24h

- **Large Transactions (Whales)**
  - **Fonte:** Cache de transações
  - **Cálculo:** Filtrar transações com `net_transfer > threshold`
  - **Threshold sugerido:** 1M DOG

#### 2. **Holder Metrics** ✅ Dados Disponíveis
- **Holder Concentration (Gini Coefficient)**
  - **Fonte:** `dog_holders_by_address.json`
  - **Cálculo:** Calcular Gini da distribuição de saldos
  - **Implementação:** Fórmula padrão de Gini

- **Top Holders Distribution**
  - **Fonte:** `dog_holders_by_address.json`
  - **Cálculo:** % do supply nos top 10, 50, 100, 1000
  - **Implementação:** Somar saldos dos top N e dividir por supply total

- **UTXO Count Trends**
  - **Fonte:** Comparar snapshots de `dog_holders_by_address.json`
  - **Cálculo:** Comparar `total_utxos` de diferentes datas
  - **Implementação:** Manter histórico de snapshots ou comparar arquivos antigos

- **Average UTXO Size**
  - **Fonte:** `dog_holders_by_address.json`
  - **Cálculo:** `total_supply / total_utxos`
  - **Implementação:** Já temos os dados

#### 3. **Network Activity** ✅ Dados Disponíveis (Parcial)
- **New Holders** (Comparando Snapshots)
  - **Fonte:** Comparar `dog_holders_by_address.json` de diferentes datas
  - **Cálculo:** Endereços no snapshot atual que não estavam no anterior
  - **Implementação:** Comparar sets de endereços

- **Lost Holders** (Comparando Snapshots)
  - **Fonte:** Comparar snapshots
  - **Cálculo:** Endereços no snapshot anterior que não estão no atual
  - **Implementação:** Comparar sets de endereços

#### 4. **Holder Behavior** ✅ Dados Disponíveis (Parcial)
- **Accumulation vs Distribution** (Comparando Snapshots)
  - **Fonte:** Comparar saldos de holders entre snapshots
  - **Cálculo:** 
    - Accumulation: Saldo aumentou
    - Distribution: Saldo diminuiu
  - **Implementação:** Comparar snapshots de holders

---

## 📈 FASE 2: Coleta de Dados Históricos (2-3 semanas)

### Scripts Necessários

#### 1. **Script de Análise de UTXO Age** ⭐ Prioridade Alta
```python
# scripts/analyze_utxo_age.py
```
**Função:**
- Para cada UTXO atual, encontrar quando foi criado (block_height)
- Rastrear quando foi gasto (se foi)
- Calcular idade atual em dias
- Salvar histórico

**Dados necessários:**
- Lista de UTXOs (já temos via `ord balances`)
- Block height de criação (precisa rastrear)
- Block height de gasto (precisa rastrear)

**Saída:**
```json
{
  "utxo_age_history": [
    {
      "txid": "...",
      "vout": 0,
      "address": "...",
      "amount": 1000000,
      "created_block": 840000,
      "created_timestamp": "2024-01-01T00:00:00Z",
      "spent_block": null,
      "spent_timestamp": null,
      "age_days": 365,
      "status": "unspent"
    }
  ]
}
```

#### 2. **Script de Snapshot Diário**
```python
# scripts/daily_metrics_snapshot.py
```
**Função:**
- Rodar diariamente após `update_holders_and_fees.py`
- Salvar snapshot de holders
- Calcular métricas do dia
- Manter histórico

**Saída:**
```json
{
  "date": "2026-01-07",
  "block_height": 840000,
  "metrics": {
    "total_holders": 90734,
    "total_utxos": 260207,
    "active_addresses_24h": 1000,
    "transaction_volume_24h": 50000000,
    "new_holders_24h": 50
  },
  "holders_snapshot": [...]
}
```

#### 3. **Script de Histórico de Preços**
```python
# scripts/collect_price_history.py
```
**Função:**
- Coletar preço do DOG diariamente
- Salvar histórico
- Usar múltiplas fontes (exchanges)

**Saída:**
```json
{
  "price_history": [
    {
      "date": "2026-01-07",
      "price_usd": 0.00163,
      "price_btc": 0.00000001,
      "market_cap": 1000000000,
      "volume_24h": 50000000
    }
  ]
}
```

---

## 🎯 FASE 3: Indicadores Avançados (2-3 semanas)

### Indicadores que Precisam de Dados Históricos

#### 1. **Short-Term vs Long-Term Holders**
- **Dados necessários:** Idade dos UTXOs (Fase 2)
- **Cálculo:** 
  - STH: UTXOs < 155 dias
  - LTH: UTXOs ≥ 155 dias
- **Visualização:** Gráfico de linha temporal

#### 2. **HODL Waves**
- **Dados necessários:** Idade dos UTXOs (Fase 2)
- **Cálculo:** Distribuição de supply por faixas de idade
- **Visualização:** Heatmap temporal

#### 3. **Realized Cap / MVRV**
- **Dados necessários:** Preço histórico + Idade dos UTXOs
- **Cálculo:**
  - Realized Cap: Σ(amount × price_at_receipt)
  - MVRV: Market Cap / Realized Cap
- **Visualização:** Gráfico de linha temporal

#### 4. **Supply in Profit/Loss**
- **Dados necessários:** Preço histórico + Idade dos UTXOs
- **Cálculo:** % do supply com preço atual > preço médio de compra
- **Visualização:** Gráfico de área

#### 5. **Coin Days Destroyed**
- **Dados necessários:** Idade dos UTXOs quando gastos
- **Cálculo:** Σ(amount × age_days) para UTXOs gastos
- **Visualização:** Gráfico de linha temporal

---

## 📊 Estrutura da Página Metrics

### Layout Proposto

```
┌─────────────────────────────────────────────────┐
│  METRICS - On-Chain Indicators                  │
├─────────────────────────────────────────────────┤
│  [24h] [7d] [30d] [All]  [Export]              │
├─────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ Active   │ │ Volume   │ │ Tx Count│         │
│  │ Addresses│ │ 24h      │ │ 24h     │         │
│  │  1,000   │ │ 50M DOG  │ │   100   │         │
│  └──────────┘ └──────────┘ └──────────┘         │
├─────────────────────────────────────────────────┤
│  📊 Transaction Metrics                         │
│  [Gráfico: Volume 30 dias]                     │
│  [Gráfico: Active Addresses 30 dias]          │
│  [Tabela: Large Transactions]                  │
├─────────────────────────────────────────────────┤
│  👥 Holder Metrics                              │
│  [Gráfico: Holder Concentration (Gini)]        │
│  [Gráfico: Top Holders Distribution]           │
│  [Gráfico: UTXO Count Trends]                  │
├─────────────────────────────────────────────────┤
│  🔄 Network Activity                            │
│  [Gráfico: New Holders por dia]                │
│  [Gráfico: Lost Holders por dia]                │
└─────────────────────────────────────────────────┘
```

---

## 🛠️ Implementação - Fase 1 (MVP)

### Passo 1: Criar Estrutura Base (1 dia)
```bash
# Criar página
mkdir -p app/metrics/components
touch app/metrics/page.tsx

# Criar API routes
mkdir -p app/api/metrics/{transaction,holder,network}
```

### Passo 2: API Endpoints Básicos (2-3 dias)
```typescript
// app/api/metrics/transaction/route.ts
// - Active Addresses (24h, 7d, 30d)
// - Transaction Volume
// - Transaction Count
// - Large Transactions

// app/api/metrics/holder/route.ts
// - Holder Concentration (Gini)
// - Top Holders Distribution
// - UTXO Count Trends

// app/api/metrics/network/route.ts
// - New Holders (comparando snapshots)
// - Lost Holders
```

### Passo 3: Frontend Básico (3-4 dias)
```tsx
// app/metrics/page.tsx
// - Dashboard com cards principais
// - Gráficos básicos (Recharts)
// - Filtros de período
// - Tabelas de dados
```

### Passo 4: Adicionar ao Menu (1 dia)
```typescript
// components/header.tsx
// Adicionar "Metrics" ao navigation array
```

---

## 📝 Priorização Final

### 🟢 FASE 1 - MVP (1-2 semanas) - IMPLEMENTAR PRIMEIRO
1. ✅ Active Addresses (24h, 7d, 30d)
2. ✅ Transaction Volume (24h, 7d, 30d)
3. ✅ Transaction Count (24h, 7d, 30d)
4. ✅ Large Transactions (Whales)
5. ✅ Holder Concentration (Gini)
6. ✅ Top Holders Distribution
7. ✅ UTXO Count Trends
8. ✅ New Holders (comparando snapshots)

### 🟡 FASE 2 - Coleta de Dados (2-3 semanas)
9. ⏳ Script de UTXO Age
10. ⏳ Script de Snapshot Diário
11. ⏳ Script de Histórico de Preços

### 🔴 FASE 3 - Indicadores Avançados (2-3 semanas)
12. ⏳ Short/Long Term Holders
13. ⏳ HODL Waves
14. ⏳ Realized Cap / MVRV
15. ⏳ Supply in Profit/Loss
16. ⏳ Coin Days Destroyed

---

## 💡 Diferenciais do Nosso Sistema

### O que JÁ fazemos melhor que outros:
1. ✅ **Análise Forense Completa** - 14 padrões comportamentais
2. ✅ **Diamond Score** - Métrica única 0-100
3. ✅ **Tracking de Fees** - Calculamos fees de todas as transações
4. ✅ **Real-time Updates** - SSE para holders
5. ✅ **Airdrop Analysis** - Análise completa dos 75k recipients

### O que podemos adicionar:
1. 📊 **Indicadores On-Chain** - Similar ao CoinGlass/CryptoQuant
2. 📈 **Métricas Temporais** - Evolução ao longo do tempo
3. 🔍 **Análises Avançadas** - HODL Waves, MVRV, etc

---

## 🎯 Próximos Passos Imediatos

1. ✅ **Aprovar este plano revisado**
2. ⏳ **Criar estrutura base** - Pasta `app/metrics/`
3. ⏳ **Implementar APIs MVP** - 3 endpoints básicos
4. ⏳ **Criar frontend MVP** - Dashboard com 5-8 métricas principais
5. ⏳ **Adicionar ao menu** - Link "Metrics" no header

---

**Status:** 📋 Análise Completa + Plano Revisado  
**Próximo:** 🚀 Implementação Fase 1 (MVP)

