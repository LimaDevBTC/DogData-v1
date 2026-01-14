# 📊 On-Chain Metrics - Plano Completo de Implementação

## 🎯 Objetivo

Criar uma nova página **"On-Chain Metrics"** com indicadores on-chain profissionais baseados em UTXO, aproveitando nosso acesso exclusivo ao Bitcoin Core node e Ord indexer.

---

## ✅ O QUE JÁ TEMOS (Vantagem Competitiva)

### Dados Disponíveis
1. ✅ **260,207 UTXOs** rastreados via Ord indexer
2. ✅ **90,734 holders** com saldos e UTXO counts
3. ✅ **Acesso ao Bitcoin Core RPC** (gettxout, getrawtransaction, etc.)
4. ✅ **Histórico de transações** (últimas 500+)
5. ✅ **Block heights** de todas as transações
6. ✅ **Scripts Python** para extrair dados do Ord

### Infraestrutura
- ✅ Bitcoin Core rodando localmente
- ✅ Ord indexer com dados completos
- ✅ Scripts de atualização funcionais
- ✅ APIs Next.js para servir dados

---

## 🚀 FASE 1: MVP - Indicadores Imediatos (Sem Dados Adicionais)

### 1. **UTXO Count Trends** ⭐
- **Dados:** Já temos `total_utxos: 260207`
- **Implementação:**
  - Salvar snapshot diário de `total_utxos`
  - Criar gráfico de linha temporal
  - Mostrar tendência (crescimento/declínio)
- **Arquivo:** `data/utxo_count_history.json`

### 2. **Average UTXO Size**
- **Dados:** `total_supply / total_utxos`
- **Cálculo:** 100,000,000,000 / 260,207 = ~384,500 DOG por UTXO
- **Visualização:** Card com valor atual + tendência

### 3. **UTXO Distribution by Size**
- **Dados:** Agrupar UTXOs por faixas de tamanho
- **Faixas sugeridas:**
  - < 1K DOG
  - 1K - 10K DOG
  - 10K - 100K DOG
  - 100K - 1M DOG
  - 1M - 10M DOG
  - > 10M DOG
- **Visualização:** Gráfico de pizza ou barras

### 4. **Holder Concentration (Gini Coefficient)**
- **Dados:** Já temos saldos de todos os holders
- **Cálculo:** Coeficiente de Gini baseado em distribuição de saldos
- **Visualização:** Card com valor (0-1) + gráfico de Lorenz curve

### 5. **Top 10/100/1000 Holders Supply %**
- **Dados:** Já temos ranking completo
- **Cálculo:** % do supply detido pelos top N holders
- **Visualização:** Cards com múltiplos percentuais

### 6. **Active Addresses (24h, 7d, 30d)**
- **Dados:** Já calculamos nas métricas 24h
- **Expansão:** Calcular para 7d e 30d
- **Visualização:** Cards com comparação temporal

### 7. **Large Transactions (Whales)**
- **Dados:** Já temos nas transações
- **Filtro:** Transações > 1M DOG, > 10M DOG, > 100M DOG
- **Visualização:** Tabela com top transações grandes

---

## 🔧 FASE 2: Indicadores que Precisam de Dados Adicionais

### 1. **UTXO Age Analysis** ⭐⭐⭐ PRIORIDADE MÁXIMA

#### O que precisamos:
- **Block height de criação** de cada UTXO
- **Timestamp** de quando cada UTXO foi criado
- **Idade atual** de cada UTXO (em dias)

#### Implementação:
```python
# scripts/analyze_utxo_age.py
# Para cada UTXO:
# 1. Pegar txid e vout do UTXO
# 2. Usar Bitcoin Core RPC: getrawtransaction(txid) → block_height
# 3. Calcular idade: current_block - creation_block
# 4. Salvar em data/utxo_age_data.json
```

#### Estrutura de dados:
```json
{
  "utxo_age_data": {
    "last_updated": "2024-01-01T00:00:00Z",
    "current_block": 850000,
    "utxos": [
      {
        "txid": "...",
        "vout": 0,
        "address": "...",
        "amount": 1000000,
        "creation_block": 840000,
        "creation_timestamp": "2024-01-01T00:00:00Z",
        "age_days": 155,
        "age_category": "LTH" // STH ou LTH
      }
    ],
    "summary": {
      "total_utxos": 260207,
      "sth_count": 150000,  // < 155 dias
      "lth_count": 110207,  // >= 155 dias
      "sth_supply": 50000000000,
      "lth_supply": 50000000000
    }
  }
}
```

### 2. **Short-Term vs Long-Term Holders (STH/LTH)** ⭐⭐⭐

#### Definição:
- **STH (Short-Term Holders):** UTXOs com idade < 155 dias (~5 meses)
- **LTH (Long-Term Holders):** UTXOs com idade >= 155 dias

#### Métricas:
- **STH Supply:** % do supply em STH
- **LTH Supply:** % do supply em LTH
- **STH Count:** Número de UTXOs STH
- **LTH Count:** Número de UTXOs LTH
- **STH/LTH Ratio:** Razão entre os dois

#### Visualização:
- Cards com valores atuais
- Gráfico de linha temporal (STH vs LTH ao longo do tempo)
- Gráfico de área empilhada

### 3. **HODL Waves** ⭐⭐

#### Definição:
Distribuição do supply por faixas de idade dos UTXOs

#### Faixas sugeridas:
- < 1 dia
- 1-7 dias
- 1 semana - 1 mês
- 1-3 meses
- 3-6 meses
- 6-12 meses
- 1-2 anos
- > 2 anos

#### Visualização:
- **Heatmap temporal** (como Glassnode)
- Eixo X: Tempo
- Eixo Y: Faixas de idade
- Cor: % do supply

### 4. **Realized Cap / MVRV Ratio** ⭐⭐

#### Realized Cap:
- Soma do valor de cada UTXO multiplicado pelo preço quando foi recebido
- **Cálculo:** Σ(amount × price_at_receipt)

#### MVRV Ratio:
- **Market Cap / Realized Cap**
- Indica se o preço está acima ou abaixo do preço médio de compra

#### Dados necessários:
- ✅ Idade dos UTXOs (Fase 2)
- ❌ Preço histórico (precisamos coletar)

#### Implementação:
- Criar script para coletar preço histórico diário
- Armazenar em `data/price_history.json`
- Calcular Realized Cap usando preço no momento da criação do UTXO

### 5. **Supply in Profit/Loss** ⭐⭐

#### Definição:
% do supply que está em lucro ou prejuízo

#### Cálculo:
- Para cada UTXO: comparar preço atual vs preço quando foi recebido
- Se `current_price > purchase_price` → em lucro
- Se `current_price < purchase_price` → em prejuízo

#### Visualização:
- Gráfico de área empilhada (% em lucro vs % em prejuízo)
- Card com valores atuais

### 6. **Coin Days Destroyed (CDD)** ⭐

#### Definição:
Soma de (amount × age_days) para UTXOs que foram gastos

#### Cálculo:
- Rastrear quando UTXOs são gastos
- Calcular idade no momento do gasto
- CDD = Σ(amount × age_days) para UTXOs gastos

#### Dados necessários:
- ✅ Rastrear gastos de UTXOs (via transações)
- ✅ Idade dos UTXOs quando gastos

---

## 📁 Estrutura de Arquivos

```
DogData-v1/
├── app/
│   └── metrics/
│       └── page.tsx                    # Nova página On-Chain Metrics
├── components/
│   └── metrics/
│       ├── utxo-count-chart.tsx         # Gráfico UTXO Count Trends
│       ├── sth-lth-chart.tsx             # Gráfico STH vs LTH
│       ├── hodl-waves-heatmap.tsx       # Heatmap HODL Waves
│       ├── realized-cap-chart.tsx        # Gráfico Realized Cap / MVRV
│       ├── supply-profit-loss-chart.tsx  # Gráfico Supply in Profit/Loss
│       ├── holder-concentration-chart.tsx # Gráfico Gini / Lorenz
│       └── utxo-distribution-chart.tsx   # Distribuição de UTXOs
├── scripts/
│   ├── analyze_utxo_age.py               # ⭐ Script para calcular idade dos UTXOs
│   ├── collect_price_history.py          # Script para coletar preço histórico
│   └── update_utxo_metrics.py            # Script para atualizar métricas diárias
├── data/
│   ├── utxo_count_history.json           # Histórico de UTXO count
│   ├── utxo_age_data.json                # Dados de idade dos UTXOs
│   ├── price_history.json                # Preço histórico diário
│   └── utxo_metrics_daily.json           # Métricas diárias consolidadas
└── app/api/
    └── metrics/
        ├── utxo-count/route.ts           # API UTXO count history
        ├── utxo-age/route.ts             # API UTXO age data
        ├── sth-lth/route.ts              # API STH/LTH metrics
        ├── hodl-waves/route.ts           # API HODL Waves data
        ├── realized-cap/route.ts         # API Realized Cap / MVRV
        └── supply-profit/route.ts        # API Supply in Profit/Loss
```

---

## 🎨 Design da Página

### Layout Proposto:

```
┌─────────────────────────────────────────────────────────┐
│  ON-CHAIN METRICS - UTXO-Based Indicators              │
├─────────────────────────────────────────────────────────┤
│  [24h] [7d] [30d] [90d] [All]  [Export] [Refresh]     │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │ UTXO     │ │ Avg UTXO  │ │ STH      │ │ LTH      ││
│  │ Count    │ │ Size      │ │ Supply   │ │ Supply   ││
│  │ 260,207  │ │ 384.5K    │ │ 45.2%    │ │ 54.8%    ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘│
├─────────────────────────────────────────────────────────┤
│  [Gráfico: UTXO Count Trends]                          │
├─────────────────────────────────────────────────────────┤
│  [Gráfico: STH vs LTH Supply Over Time]               │
├─────────────────────────────────────────────────────────┤
│  [Heatmap: HODL Waves]                                 │
├─────────────────────────────────────────────────────────┤
│  [Gráfico: Realized Cap / MVRV Ratio]                  │
├─────────────────────────────────────────────────────────┤
│  [Gráfico: Supply in Profit/Loss]                     │
├─────────────────────────────────────────────────────────┤
│  [Gráfico: Holder Concentration (Gini)]               │
├─────────────────────────────────────────────────────────┤
│  [Gráfico: UTXO Distribution by Size]                   │
└─────────────────────────────────────────────────────────┘
```

---

## 📝 Implementação - Ordem de Prioridade

### Semana 1: MVP (Indicadores Imediatos)
1. ✅ Criar página `/metrics`
2. ✅ Implementar UTXO Count Trends
3. ✅ Implementar Average UTXO Size
4. ✅ Implementar UTXO Distribution
5. ✅ Implementar Holder Concentration (Gini)
6. ✅ Implementar Top Holders Supply %

### Semana 2: Script de UTXO Age
1. ⭐ Criar `scripts/analyze_utxo_age.py`
2. ⭐ Testar com sample de UTXOs
3. ⭐ Processar todos os 260k UTXOs
4. ⭐ Salvar em `data/utxo_age_data.json`

### Semana 3: Indicadores Avançados
1. ✅ Implementar STH/LTH metrics
2. ✅ Implementar HODL Waves
3. ✅ Criar script de coleta de preço histórico
4. ✅ Implementar Realized Cap / MVRV

### Semana 4: Finalização
1. ✅ Implementar Supply in Profit/Loss
2. ✅ Implementar Coin Days Destroyed
3. ✅ Otimizações e testes
4. ✅ Documentação

---

## 🔑 Diferenciais Competitivos

### O que só NÓS podemos fazer:
1. ✅ **Acesso direto ao node** - Dados em tempo real
2. ✅ **260k+ UTXOs rastreados** - Dataset completo
3. ✅ **Análise de idade de UTXOs** - Via Bitcoin Core RPC
4. ✅ **Indicadores exclusivos** - Não disponíveis em outras plataformas
5. ✅ **Dados históricos** - Podemos construir histórico desde o início

### Vantagens:
- **Precisão:** Dados direto da blockchain
- **Completude:** Todos os UTXOs, não amostras
- **Velocidade:** Sem dependência de APIs externas
- **Exclusividade:** Indicadores únicos para DOG

---

## 🚀 Próximos Passos

1. **Criar estrutura básica da página**
2. **Implementar indicadores MVP (Semana 1)**
3. **Desenvolver script de UTXO Age (Semana 2)**
4. **Expandir com indicadores avançados (Semanas 3-4)**

---

**Status:** 📋 Planejamento Completo  
**Próxima Ação:** Criar página `/metrics` e começar implementação MVP




