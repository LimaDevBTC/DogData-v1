# 📊 Análise Completa do Projeto DogData

**Data:** 2026-01-07  
**Objetivo:** Mapear tudo que já existe antes de propor novas funcionalidades

---

## 🎯 Visão Geral do Projeto

O **DogData** é uma plataforma completa de análise forense e exploração de dados on-chain para o DOG Rune (DOG•GO•TO•THE•MOON). O sistema já possui uma base sólida de dados e funcionalidades.

---

## 📁 Estrutura de Dados Atual

### ✅ Dados que JÁ TEMOS

#### 1. **Holders (Atualizado Diariamente)**
- **Arquivo:** `data/dog_holders_by_address.json` + `public/data/dog_holders_by_address.json`
- **Conteúdo:**
  ```json
  {
    "timestamp": "2026-01-07T02:51:25.661480",
    "total_holders": 90734,
    "total_utxos": 260207,
    "holders": [
      {
        "address": "bc1p50n9...",
        "total_amount": 400273861164599,
        "total_dog": 4002738611.64599,
        "utxo_count": 2058,
        "rank": 1
      }
    ]
  }
  ```
- **Atualização:** Script `update_holders_and_fees.py` roda diariamente
- **Dados disponíveis:**
  - ✅ Endereço de cada holder
  - ✅ Saldo total (em sats e DOG)
  - ✅ Número de UTXOs por holder
  - ✅ Ranking atual
  - ✅ Timestamp da última atualização

#### 2. **Transações (Cache em Upstash KV)**
- **Fonte:** Upstash KV (key: `dog:transactions`)
- **Atualização:** API `/api/update-transactions` (cron job a cada 3 minutos)
- **Estrutura:**
  ```json
  {
    "transactions": [
      {
        "txid": "...",
        "block_height": 840000,
        "timestamp": "2024-01-01T00:00:00Z",
        "senders": [
          {
            "address": "...",
            "amount": 1000000,
            "amount_dog": 10.0,
            "has_dog": true
          }
        ],
        "receivers": [
          {
            "address": "...",
            "amount": 1000000,
            "amount_dog": 10.0,
            "has_dog": true,
            "is_change": false
          }
        ],
        "total_dog_in": 10.0,
        "total_dog_out": 10.0,
        "total_dog_moved": 10.0,
        "net_transfer": 5.0,
        "change_amount": 5.0,
        "fee_sats": 1000
      }
    ],
    "metrics": {
      "last24h": {
        "txCount": 100,
        "totalDogMoved": 50000,
        "activeWalletCount": 500,
        "topActiveWallet": {...},
        "topVolumeWallet": {...},
        "feesSats": 100000,
        "seriesPerBlock": [...]
      }
    }
  }
  ```
- **Dados disponíveis:**
  - ✅ TXID de cada transação
  - ✅ Block height
  - ✅ Timestamp (ISO)
  - ✅ Senders (endereços + valores)
  - ✅ Receivers (endereços + valores)
  - ✅ Net transfer (excluindo change)
  - ✅ Change amount
  - ✅ Fees (em sats)
  - ✅ Métricas das últimas 24h

#### 3. **Análise Forense do Airdrop**
- **Arquivo:** `data/forensic_behavioral_analysis.json` (49MB)
- **Conteúdo:**
  ```json
  {
    "statistics": {
      "total_analyzed": 75497,
      "still_holding": 29863,
      "sold_everything": 45634,
      "diamond_hands": 21210,
      "by_pattern": {
        "paper_hands": 47657,
        "diamond_paws": 21210,
        "dog_legend": 1530,
        ...
      }
    },
    "profiles": [
      {
        "address": "...",
        "airdrop_rank": 1,
        "current_rank": 5,
        "airdrop_amount": 889806,
        "current_balance": 2500000,
        "percentage_change": 181,
        "rank_change": -4,
        "diamond_score": 85,
        "accumulation_rate": 15000,
        "behavior_pattern": "whale",
        "insights": [...]
      }
    ]
  }
  ```
- **Dados disponíveis:**
  - ✅ 75,490 recipients do airdrop
  - ✅ Saldo atual vs airdrop
  - ✅ Mudança de ranking
  - ✅ Taxa de acumulação
  - ✅ Padrões comportamentais (14 categorias)
  - ✅ Diamond Score (0-100)

#### 4. **Dados de Airdrop**
- **Arquivos:**
  - `data/airdrop_recipients.json` - Lista completa
  - `data/airdrop_analytics.json` - Analytics gerais
  - `data/forensic_airdrop_data.json` - Dados forenses
- **Dados disponíveis:**
  - ✅ Quantidade exata recebida por cada recipient
  - ✅ Ranking do airdrop
  - ✅ Estatísticas de distribuição

---

## 🔌 APIs Existentes

### ✅ APIs Já Implementadas

#### 1. **DOG Rune Stats**
- **Endpoint:** `GET /api/dog-rune/stats`
- **Retorna:**
  - Total holders
  - Total supply / Circulating supply
  - Top 10 holders
  - Metadata (runeId, divisibility)

#### 2. **Holders**
- **Endpoint:** `GET /api/dog-rune/holders?page=1&limit=25`
- **Retorna:**
  - Lista paginada de holders
  - Ranking, saldo, UTXO count
  - Paginação completa

#### 3. **Transactions (Cache)**
- **Endpoint:** `GET /api/dog-rune/transactions-kv`
- **Retorna:**
  - Últimas 500 transações DOG
  - Métricas das últimas 24h
  - Top wallets ativas
  - Volume por bloco

#### 4. **Update Transactions**
- **Endpoint:** `GET /api/update-transactions?secret=XXX`
- **Função:**
  - Busca eventos da Unisat/Xverse API
  - Processa e agrupa por TXID
  - Calcula net_transfer, change
  - Salva no Upstash KV
  - Calcula fees (via Bitcoin Core RPC)

#### 5. **Forensic Analysis**
- **Endpoints:**
  - `GET /api/forensic/summary` - Estatísticas gerais
  - `GET /api/forensic/profiles?page=1&pattern=whale` - Perfis filtrados
  - `GET /api/forensic/recipient/:address` - Perfil individual

#### 6. **Airdrop**
- **Endpoints:**
  - `GET /api/airdrop/summary` - Summary do airdrop
  - `GET /api/airdrop/recipients` - Lista de recipients

#### 7. **Markets**
- **Endpoint:** `GET /api/markets`
- **Retorna:** Dados de preço de múltiplas exchanges

---

## 📊 Métricas Já Calculadas

### ✅ Métricas que JÁ EXISTEM

#### 1. **Métricas de Transações (24h)**
- ✅ Transaction Count (últimas 24h)
- ✅ Total DOG Moved (últimas 24h)
- ✅ Active Wallet Count (últimas 24h)
- ✅ Volume Wallet Count (últimas 24h)
- ✅ Top Active Wallet
- ✅ Top Volume Wallet
- ✅ Top Out Wallet
- ✅ Top In Wallet
- ✅ Top Out Wallets (lista)
- ✅ Top In Wallets (lista)
- ✅ Fees (total em sats e BTC)
- ✅ Series per Block (txCount + dogMoved por bloco)

#### 2. **Métricas de Holders**
- ✅ Total Holders
- ✅ Total UTXOs
- ✅ Ranking de cada holder
- ✅ Saldo por holder
- ✅ UTXO count por holder

#### 3. **Métricas de Airdrop**
- ✅ Total Recipients (75,490)
- ✅ Still Holding vs Sold Everything
- ✅ Diamond Hands count
- ✅ Accumulators count
- ✅ Dumpers count
- ✅ Retention Rate
- ✅ Accumulator Rate
- ✅ Dumper Rate
- ✅ 14 Padrões Comportamentais

#### 4. **Métricas Comportamentais**
- ✅ Diamond Score (0-100)
- ✅ Percentage Change (desde airdrop)
- ✅ Rank Change (mudança de posição)
- ✅ Accumulation Rate (DOG/dia)
- ✅ Retention Rate (% mantido)

---

## 🔍 Dados que FALTAM para Indicadores On-Chain

### ❌ Dados que NÃO TEMOS (mas precisamos)

#### 1. **Histórico de UTXO Age**
- ❌ Quando cada UTXO foi criado (block_height)
- ❌ Quando cada UTXO foi gasto (se foi)
- ❌ Idade atual de cada UTXO (em dias)
- ❌ Status (unspent/spent)

**O que temos:**
- ✅ Lista atual de UTXOs (via `ord balances`)
- ✅ Endereço de cada UTXO
- ✅ Quantidade de cada UTXO

**O que falta:**
- ❌ Block height de criação
- ❌ Block height de gasto (se gasto)
- ❌ Histórico de movimentação

#### 2. **Histórico de Preços**
- ❌ Preço do DOG em cada momento histórico
- ❌ Market cap histórico
- ❌ Volume histórico

**O que temos:**
- ✅ Preço atual (via APIs de exchanges)
- ✅ Market cap atual

**O que falta:**
- ❌ Histórico de preços (para calcular Realized Cap, MVRV, etc)

#### 3. **Histórico de Holders**
- ❌ Snapshots diários de holders
- ❌ Evolução do número de holders ao longo do tempo
- ❌ Novos holders por dia

**O que temos:**
- ✅ Snapshot atual de holders
- ✅ Timestamp da última atualização

**O que falta:**
- ❌ Histórico de snapshots
- ❌ Comparação temporal

#### 4. **Histórico de Transações Completo**
- ❌ Todas as transações desde o início (não só últimas 500)
- ❌ Histórico de volumes por período
- ❌ Histórico de active addresses

**O que temos:**
- ✅ Últimas 500 transações (cache)
- ✅ Métricas das últimas 24h

**O que falta:**
- ❌ Histórico completo
- ❌ Séries temporais longas

---

## 🛠️ Scripts Existentes

### ✅ Scripts que JÁ FUNCIONAM

#### 1. **update_holders_and_fees.py** ⭐ (Principal)
- **Função:** Atualiza holders e calcula fees
- **Frequência:** Diária (manual)
- **Faz:**
  - Extrai UTXOs DOG do Ord
  - Agrupa por endereço
  - Calcula saldos e rankings
  - Calcula fees de transações (prioridade últimas 24h)
  - Salva em JSON local + public/data/
  - Atualiza cache no Upstash

#### 2. **update_transactions_cache.py**
- **Função:** Mantém cache de transações atualizado
- **Frequência:** A cada 10 minutos (daemon)
- **Faz:**
  - Busca últimas transações da Unisat
  - Mescla com cache existente
  - Mantém últimas 500 transações
  - Salva em JSON local

#### 3. **forensic_behavior_analyzer.py**
- **Função:** Análise comportamental dos recipients
- **Frequência:** Ocasional
- **Faz:**
  - Compara airdrop vs saldo atual
  - Classifica padrões comportamentais
  - Calcula Diamond Score
  - Gera insights personalizados

#### 4. **dog_block_monitor.py**
- **Função:** Monitora blocos e rastreia transações DOG
- **Status:** Criado mas não em produção
- **Faz:**
  - Detecta novos blocos
  - Rastreia transações DOG
  - Atualiza holders
  - Salva estado

---

## 📈 Páginas do Frontend

### ✅ Páginas Já Implementadas

#### 1. **Overview** (`/`)
- Estatísticas gerais
- Total holders
- Market cap
- Price chart (TradingView)
- Volume 24h
- Network stats

#### 2. **Holders** (`/holders`)
- Lista completa de holders
- Paginação
- Busca por endereço
- SSE para updates em tempo real
- Gráfico de distribuição
- Top 100 Whales Movement

#### 3. **Transactions** (`/transactions`)
- Lista de transações
- Filtros (All, Inflow, Outflow, Transfer)
- Métricas 24h
- Top wallets
- Detalhes de cada transação
- Fees

#### 4. **Airdrop Analysis** (`/airdrop`)
- Estatísticas do airdrop
- Recipients por categoria
- Filtros comportamentais
- Hall of Fame

#### 5. **Bitcoin Network** (`/bitcoin-network`)
- Info da blockchain
- Network stats

#### 6. **Markets** (`/markets`)
- Preços de múltiplas exchanges
- Volume 24h

---

## 🎯 O que JÁ PODEMOS Fazer com os Dados Atuais

### ✅ Indicadores que JÁ PODEMOS CALCULAR

#### 1. **Active Addresses** ✅
- **Dados necessários:** ✅ Temos
- **Cálculo:** Contar endereços únicos em transações das últimas 24h/7d/30d
- **Fonte:** Cache de transações já tem isso parcialmente

#### 2. **Transaction Volume** ✅
- **Dados necessários:** ✅ Temos
- **Cálculo:** Somar `total_dog_moved` ou `net_transfer` das transações
- **Fonte:** Cache de transações já calcula isso

#### 3. **Transaction Count** ✅
- **Dados necessários:** ✅ Temos
- **Cálculo:** Contar transações por período
- **Fonte:** Cache de transações

#### 4. **New Holders** ✅ (Parcial)
- **Dados necessários:** ✅ Temos (com histórico)
- **Cálculo:** Comparar snapshot atual vs anterior
- **Fonte:** Comparar `dog_holders_by_address.json` de diferentes datas

#### 5. **UTXO Count Trends** ✅ (Parcial)
- **Dados necessários:** ✅ Temos (com histórico)
- **Cálculo:** Comparar `total_utxos` de diferentes snapshots
- **Fonte:** Comparar `dog_holders_by_address.json` de diferentes datas

#### 6. **Holder Concentration (Gini)** ✅
- **Dados necessários:** ✅ Temos
- **Cálculo:** Calcular Gini coefficient da distribuição atual
- **Fonte:** `dog_holders_by_address.json` tem todos os saldos

#### 7. **Large Transactions (Whales)** ✅
- **Dados necessários:** ✅ Temos
- **Cálculo:** Filtrar transações acima de threshold
- **Fonte:** Cache de transações

#### 8. **Average Transaction Size** ✅
- **Dados necessários:** ✅ Temos
- **Cálculo:** `total_dog_moved / tx_count`
- **Fonte:** Cache de transações

#### 9. **Top Holders Distribution** ✅
- **Dados necessários:** ✅ Temos
- **Cálculo:** % do supply nos top 10, 50, 100
- **Fonte:** `dog_holders_by_address.json`

#### 10. **Accumulation vs Distribution** ✅ (Parcial)
- **Dados necessários:** ✅ Temos (com histórico)
- **Cálculo:** Comparar saldos atuais vs anteriores
- **Fonte:** Comparar snapshots de holders

---

## ❌ O que NÃO PODEMOS Fazer AINDA

### Indicadores que PRECISAM de Dados Adicionais

#### 1. **Short-Term vs Long-Term Holders**
- **Falta:** Idade de cada UTXO (quando foi criado)
- **Solução:** Rastrear block_height de criação de cada UTXO

#### 2. **HODL Waves**
- **Falta:** Distribuição de supply por idade dos UTXOs
- **Solução:** Calcular idade de cada UTXO e agrupar por faixas

#### 3. **Realized Cap / MVRV**
- **Falta:** Preço histórico do DOG em cada momento
- **Solução:** Coletar histórico de preços ou usar aproximação

#### 4. **Supply in Profit/Loss**
- **Falta:** Preço médio de compra de cada holder
- **Solução:** Rastrear quando cada UTXO foi recebido e preço naquele momento

#### 5. **Coin Days Destroyed**
- **Falta:** Idade dos UTXOs quando são gastos
- **Solução:** Rastrear quando UTXOs são gastos e sua idade

#### 6. **Spent Output Age Bands**
- **Falta:** Idade dos UTXOs quando são gastos
- **Solução:** Mesmo que acima

#### 7. **Lost/Inactive Supply**
- **Falta:** Histórico de quando UTXOs foram criados
- **Solução:** Rastrear criação de UTXOs

#### 8. **Velocity**
- **Falta:** Histórico de volumes
- **Solução:** Manter histórico de transaction volumes

---

## 💡 Oportunidades Imediatas

### 🚀 O que PODEMOS IMPLEMENTAR AGORA (sem dados adicionais)

#### 1. **Dashboard de Métricas Básicas**
- Active Addresses (24h, 7d, 30d) - ✅ Dados disponíveis
- Transaction Volume (24h, 7d, 30d) - ✅ Dados disponíveis
- Transaction Count (24h, 7d, 30d) - ✅ Dados disponíveis
- New Holders (comparando snapshots) - ✅ Dados disponíveis
- UTXO Count Trends - ✅ Dados disponíveis
- Holder Concentration (Gini) - ✅ Dados disponíveis
- Large Transactions Timeline - ✅ Dados disponíveis
- Average Transaction Size - ✅ Dados disponíveis

#### 2. **Gráficos Temporais**
- Volume por dia (últimos 30 dias)
- Active Addresses por dia
- Transaction Count por dia
- New Holders por dia
- UTXO Count ao longo do tempo

#### 3. **Análises Comparativas**
- Top 10/50/100 holders % do supply
- Distribuição de saldos (histograma)
- Acumulação vs Distribuição (comparando snapshots)

---

## 📝 Conclusão

### ✅ O que JÁ TEMOS (Base Sólida)
1. ✅ Lista completa de holders atualizada diariamente
2. ✅ Cache de últimas 500 transações com métricas
3. ✅ Análise forense completa do airdrop
4. ✅ APIs funcionais para todos os dados
5. ✅ Frontend completo com múltiplas páginas
6. ✅ Scripts automatizados de atualização

### ❌ O que FALTA para Indicadores Avançados
1. ❌ Histórico de idade dos UTXOs (quando foram criados)
2. ❌ Histórico de preços do DOG
3. ❌ Snapshots históricos de holders
4. ❌ Histórico completo de transações (não só últimas 500)

### 🎯 Recomendação

**FASE 1 - MVP de Metrics (1-2 semanas):**
Implementar indicadores que JÁ PODEMOS calcular com os dados atuais:
- Active Addresses
- Transaction Volume/Count
- New Holders (comparando snapshots)
- UTXO Count Trends
- Holder Concentration
- Large Transactions

**FASE 2 - Coleta de Dados Históricos (2-3 semanas):**
- Script para rastrear idade dos UTXOs
- Script para coletar histórico de preços
- Sistema de snapshots diários de holders
- Histórico completo de transações

**FASE 3 - Indicadores Avançados (2-3 semanas):**
- Short/Long Term Holders
- HODL Waves
- Realized Cap / MVRV
- Supply in Profit/Loss
- Coin Days Destroyed

---

**Próximo Passo:** Criar plano detalhado baseado nesta análise, focando primeiro no que já podemos fazer!

