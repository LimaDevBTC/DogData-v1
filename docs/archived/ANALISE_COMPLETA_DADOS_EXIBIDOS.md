# 📊 Análise Completa - Dados Exibidos nas 6 Abas do DogData

## 🎯 Objetivo

Documentação completa de **TODOS os dados e métricas** atualmente apresentados em cada uma das 6 abas do site, para entender completamente o que já temos antes de expandir com a nova aba "Metrics".

---

## 📑 Estrutura das 6 Abas

### 1. **Overview** (`/` ou `/overview`)
### 2. **Transactions** (`/transactions`)
### 3. **Holders** (`/holders`)
### 4. **Markets** (`/markets`)
### 5. **Airdrop Analysis** (`/airdrop`)
### 6. **Bitcoin Network** (`/bitcoin-network`)

---

## 1️⃣ OVERVIEW - Página Principal

### 📊 **Key Metrics (Cards Principais)**

#### **Total Holders**
- **Valor Total:** 101,451 holders
- **Breakdown por Rede:**
  - Bitcoin L1: 90,734 holders
  - Solana: 10,414 holders
  - Stacks: 303 holders
- **Fonte:** Dados atualizados manualmente + API `/api/dog-rune/holders`

#### **Volume 24h**
- Volume de trading em USD
- **Fonte:** API `/api/markets` → `marketData.totalVolume`
- **Formato:** Currency compact (ex: $1.2M)

#### **Market Cap**
- Market Cap calculado: `price × circulatingSupply`
- **Variação 24h:** Percentual de mudança (com indicador verde/vermelho)
- **Fonte:** 
  - Preço: Kraken → Gate.io → MEXC → CoinGecko (fallback em cascata)
  - Circulating Supply: API `/api/dog-rune/data`

#### **C2 Blockchain Treasury**
- **Valor:** 600,085,932 DOG
- **Target:** 1,000,000,000 DOG
- **Progresso:** Barra de progresso com percentual
- **Valor USD:** Calculado dinamicamente
- **Link:** https://www.c2dog.com

#### **Total On-Chain Transactions 24h**
- Contagem de transações on-chain nas últimas 24 horas
- **Fonte:** API `/api/dog-rune/transactions-kv?summary=1` → `metrics.last24h.txCount`

#### **Total Supply**
- Supply total da rune DOG
- **Fonte:** API `/api/dog-rune/data` → `totalSupply`
- **Formato:** Bilhões (ex: 100B)

#### **Burned**
- Quantidade de DOG queimados
- **Fonte:** API `/api/dog-rune/data` → `burned`
- **Formato:** Milhões (ex: 23.350M)

#### **Circulating Supply**
- Supply em circulação
- **Fonte:** API `/api/dog-rune/data` → `circulatingSupply`
- **Formato:** Bilhões com 5 casas decimais (ex: 99.97650B)

### 📈 **Multi-Exchange Prices**
- Componente `PriceCards` que exibe preços de múltiplas exchanges
- **Fonte:** APIs individuais de preço (Kraken, Gate.io, MEXC, etc.)

### 📊 **Price Chart**
- Widget TradingView integrado
- Gráfico de preço em tempo real
- **Altura:** 600px

---

## 2️⃣ TRANSACTIONS - Página de Transações

### 📊 **Stats Cards (Topo da Página)**

#### **New Holders (24h)**
- Contagem de novos holders nas últimas 24 horas
- **Cálculo:** Receivers que receberam DOG e não estavam no ranking anterior
- **Fonte:** Cálculo local baseado em transações + holders

#### **Last Block Processed**
- Último bloco processado pelo tracker
- **Fonte:** API `/api/dog-rune/transactions-kv` → `last_block`

#### **Last Update**
- Timestamp da última atualização
- **Controles:**
  - Botão de refresh manual
  - Toggle Auto Refresh (ON/OFF)
  - Auto refresh a cada 3 minutos quando ativado
- **Fonte:** API `/api/dog-rune/transactions-kv` → `last_updated`

### 📊 **Métricas 24h (Grid de Cards)**

#### **Total Transactions (24h)**
- Contagem total de transações on-chain
- **Fonte:** `metrics24h.txCount`

#### **Total Active Wallets (24h)**
- Carteiras únicas que enviaram ou receberam DOG
- **Fonte:** `metrics24h.activeWalletCount`

#### **On-Chain Volume (24h)**
- Volume total de DOG movido on-chain
- **Fonte:** `metrics24h.totalDogMoved`
- **Formato:** DOG (ex: 50,000,000.00 DOG)

#### **Most Active Wallet (24h)**
- Carteira com mais transações
- **Dados:**
  - Endereço (com AddressBadge)
  - Número de transações
  - Holder Rank (se disponível)
- **Fonte:** `metrics24h.topActiveWallet`

#### **Largest DOG Inflow (24h)**
- Maior entrada de DOG
- **Dados:**
  - Endereço (com AddressBadge)
  - Quantidade recebida
  - Holder Rank (se disponível)
  - **Filtro:** Só mostra se a carteira ainda mantém os tokens recebidos
- **Fonte:** `metrics24h.topInWallet`

#### **Largest DOG Outflow (24h)**
- Maior saída de DOG
- **Dados:**
  - Endereço (com AddressBadge)
  - Quantidade enviada
  - Holder Rank (se disponível)
- **Fonte:** `metrics24h.topOutWallet`

#### **Miner Fees (24h)**
- Taxas pagas aos mineradores Bitcoin
- **Dados:**
  - Valor em BTC
  - Valor em sats
- **Fonte:** `metrics24h.feesBtc` e `metrics24h.feesSats`

#### **Avg DOG per Tx (24h)**
- Média de DOG por transação
- **Fonte:** `metrics24h.avgDogPerTx`

#### **Avg Transactions per Block (24h)**
- Média de transações por bloco
- **Dados:**
  - Valor médio
  - Número de blocos processados
- **Fonte:** `metrics24h.avgTxPerBlock` e `metrics24h.blockCount`

### 📊 **Top Inflow Wallets (24h)**
- Tabela com top 5 carteiras que receberam mais DOG
- **Colunas:**
  - Rank
  - Wallet (endereço + AddressBadge + Holder Rank)
  - DOG Inflow
- **Filtro:** Só inclui carteiras que ainda mantêm os tokens recebidos
- **Fonte:** `metrics24h.topInWallets`

### 🔍 **Transaction Search**
- Busca por TXID
- **Funcionalidades:**
  - Busca local primeiro (no cache)
  - Fallback para API `/api/dog-rune/search-tx`
  - Exibe detalhes completos da transação encontrada

### 📋 **Transaction History (Tabela)**
- Lista das últimas 500 transações
- **Colunas:**
  - **Block:** Altura do bloco
  - **From:** Endereço do sender principal (com AddressBadge)
  - **To:** Endereço do receiver principal (com AddressBadge + Holder Rank + Badge "NEW HOLDER" se aplicável)
  - **DOG Moved:** Valor líquido enviado (net_transfer ou total_dog_moved)
  - **Flow:** Número de senders → número de receivers
  - **Time:** Timestamp formatado
  - **TXID:** ID da transação (truncado) + botões Copy e External Link
- **Funcionalidades:**
  - Click na linha expande detalhes completos
  - Detalhes incluem:
    - TXID completo
    - Block Height
    - Amount Sent
    - Timestamp
    - Change returned (se houver)
    - Lista completa de Inputs (senders)
    - Lista completa de Outputs (receivers) com flag "SELF" para change
- **Fonte:** API `/api/dog-rune/transactions-kv` → `transactions[]`
- **Auto-refresh:** A cada 3 minutos (se ativado)

### 🔔 **Banner de Novas Transações**
- Aparece quando novos blocos são detectados
- Mostra quantas novas transações foram adicionadas
- Botão para recarregar a página

---

## 3️⃣ HOLDERS - Página de Holders

### 📊 **Stats Cards (Topo)**

#### **Total Holders**
- **Breakdown:**
  - Bitcoin L1: 90,734 (dinâmico do JSON)
  - Solana: 10,414 (manual)
  - Stacks: 303 (manual)
- **Total:** 101,451
- **Fonte:** 
  - Bitcoin: `/data/dog_holders_by_address.json`
  - Solana/Stacks: Valores hardcoded

#### **New Holders (24h)**
- Novos holders nas últimas 24 horas
- **Cálculo:** Receivers que receberam DOG e não estavam no ranking
- **Fonte:** Cálculo local baseado em transações

#### **Total Supply / Circulating Supply**
- Dados da rune
- **Fonte:** API `/api/dog-rune/stats`

### 📊 **Gráfico de Distribuição**
- **HoldersDistributionChart**
- Distribuição de holders por faixas de saldo
- **Dados:** Todos os holders do JSON
- **Fonte:** `/data/dog_holders_by_address.json`

### 📊 **Top 100 Whales Movement**
- **Top100WhalesMovement**
- Movimentação dos top 100 holders
- Análise de mudanças de saldo

### 🔍 **Busca**
- Busca por endereço ou nome (carteiras verificadas)
- **Funcionalidades:**
  - Autocomplete com sugestões
  - Busca por nome de carteiras verificadas
  - Busca por endereço (parcial ou completo)
- **Resultado:** Exibe detalhes completos do holder encontrado

### 📋 **Lista de Holders (Tabela)**
- Lista paginada de todos os holders
- **Colunas:**
  - **Rank:** Posição no ranking
  - **Address:** Endereço (com AddressBadge se verificado)
  - **Balance:** Saldo total em DOG
  - **UTXOs:** Número de UTXOs
  - **Airdrop:** Badge se é recipient do airdrop
- **Paginação:**
  - 25 itens por página (padrão)
  - Navegação: Primeira, Anterior, Próxima, Última
  - Campo "Go to page"
  - Indicador de página atual
- **Fonte:** `/data/dog_holders_by_address.json`
- **SSE:** Updates automáticos via Server-Sent Events

### 📊 **Detalhes do Holder (Expandido)**
- Ao clicar em um holder, exibe:
  - Endereço completo
  - Rank atual
  - Saldo total
  - Número de UTXOs
  - Se é airdrop recipient (e quantidade recebida)
  - Links para exploradores

---

## 4️⃣ MARKETS - Página de Mercados

### 📊 **Market Overview Cards**

#### **Price**
- Preço atual em USD
- **Variação 24h:** Percentual com indicador verde/vermelho
- **Fonte:** API `/api/markets` → `marketData.price` e `marketData.priceChange24h`

#### **Market Cap**
- Market Cap em USD
- **Fonte:** API `/api/markets` → `marketData.marketCap`
- **Formato:** Currency compact (ex: $162.00M)

#### **Volume 24h**
- Volume de trading em 24h
- **Fonte:** API `/api/markets` → `marketData.totalVolume`
- **Formato:** Currency compact

#### **Markets Count**
- Número de exchanges ativas
- **Fonte:** Contagem de `tickers[]` da API

### 📊 **Exchange Markets Table**
- Tabela com todas as exchanges
- **Colunas:**
  - **#:** Posição
  - **Exchange:** Nome da exchange (com indicador de Trust Score)
  - **Pair:** Par de trading (ex: DOG/USD)
  - **Price:** Preço atual
  - **Volume 24h:** Volume em USD + Volume em DOG
  - **Spread:** Spread percentual (com cores: verde < 0.3%, amarelo < 0.6%, vermelho >= 0.6%)
- **Ordenação:**
  - Bitflow sempre no topo
  - Outras exchanges ordenáveis por: Volume, Spread, Price
  - Ordem: Ascendente ou Descendente
- **Trust Score:** Indicador visual (verde/amarelo/vermelho)
- **Fonte:** API `/api/markets` → `tickers[]`
- **Auto-refresh:** A cada 60 segundos

### ⚠️ **Cache Info**
- Aviso quando dados estão em cache (API temporariamente indisponível)
- Mostra idade do cache em segundos

---

## 5️⃣ AIRDROP ANALYSIS - Análise Forense

### 📊 **Summary Cards (Topo)**

#### **Total Recipients**
- Total de recipients do airdrop
- **Valor:** 75,490

#### **Still Holding**
- Recipients que ainda têm DOG
- **Fonte:** `summary.still_holding`

#### **Sold Everything**
- Recipients que venderam tudo
- **Fonte:** `summary.sold_everything`

#### **Retention Rate**
- Taxa de retenção (%)
- **Fonte:** `summary.retention_rate`

#### **Total Current Balance**
- Saldo total atual de todos os recipients
- **Fonte:** `summary.total_current_balance`

#### **Recipients with Multiple**
- Recipients que acumularam mais DOG
- **Fonte:** `summary.recipients_with_multiple`

### 📊 **Forensic Stats**
- Estatísticas forenses detalhadas
- **Dados:**
  - Total analisado
  - Still holding
  - Sold everything
  - Accumulated
  - Dumping
  - Diamond hands
  - Retention rate
  - Distribuição por padrão comportamental

### 🎯 **Behavioral Categories (Filtros)**
- **All:** Todos os recipients
- **Accumulators:** 
  - Satoshi Visionary
  - BTC Maximalist
  - Rune Master
  - Ordinal Believer
  - DOG Legend
- **Holders:**
  - Diamond Paws (mantêm exatamente 100%)
- **Sellers:**
  - HODL Hero
  - Steady Holder
  - Profit Taker
  - Early Exit
  - Panic Seller
  - Paper Hands

### 📋 **Behavioral Profiles Table**
- Lista paginada de perfis comportamentais
- **Colunas:**
  - **Airdrop Rank:** Posição no ranking do airdrop
  - **Address:** Endereço (com AddressBadge)
  - **Airdrop Amount:** Quantidade recebida no airdrop
  - **Current Balance:** Saldo atual
  - **Current Rank:** Rank atual (se ainda tem DOG)
  - **Change:** Mudança absoluta e percentual
  - **Retention Rate:** Taxa de retenção individual
  - **Rank Change:** Mudança de posição no ranking
  - **Behavior Pattern:** Padrão comportamental
  - **Diamond Score:** Score de 0-100
  - **Insights:** Lista de insights personalizados
- **Paginação:** 50 itens por página
- **Ordenação:** Por padrão, por saldo atual (DESC)
- **Fonte:** API `/api/forensic/profiles`

### 🔍 **Search**
- Busca por endereço
- Exibe perfil completo do recipient encontrado

### 📊 **Charts/Visualizations**
- Gráficos de distribuição por padrão comportamental
- Análise de retenção
- Distribuição de Diamond Scores

---

## 6️⃣ BITCOIN NETWORK - Rede Bitcoin

### 📊 **Network Stats Cards**
- **NetworkStatsCards** component
- Estatísticas principais da rede Bitcoin:
  - Hash Rate
  - Difficulty
  - Block Height
  - Block Time
  - Transactions per Block
  - Mempool Size
  - Network Fees
  - Etc.
- **Fonte:** API Bitcoin (via `BitcoinApiService`)

### 📈 **Bitcoin Price Chart**
- **BitcoinTradingViewChart**
- Gráfico TradingView do preço do Bitcoin
- **Altura:** 600px

### 📊 **Network Analytics Charts**

#### **Hashrate Chart**
- **HashrateChart** component
- Gráfico de hash rate ao longo do tempo
- **Fonte:** Dados históricos da rede Bitcoin

#### **Mempool Chart**
- **MempoolChart** component
- Gráfico do tamanho do mempool
- **Fonte:** Dados em tempo real da rede Bitcoin

### 📋 **Recent Blocks**
- Lista dos últimos 10 blocos
- **Dados por bloco:**
  - Block Height
  - Número de transações
  - Tamanho do bloco
  - Miner (se disponível)
  - Timestamp
  - Reward (em BTC)
- **Fonte:** `data.recentBlocks[]`

### 🏆 **Top Mining Pools (7 Days)**
- Lista dos top 10 mining pools
- **Dados por pool:**
  - Nome do pool
  - Número de blocos minerados
  - Average Match Rate (%)
  - Average Fee Delta (%)
- **Fonte:** `data.miningPools[]`
- **Período:** Últimos 7 dias

### 🔄 **Auto-Update**
- Atualização automática a cada 30 segundos
- Indicador visual quando está atualizando

---

## 📊 Resumo dos Dados por Categoria

### ✅ **Dados On-Chain DOG**
1. **Holders:**
   - 90,734 holders Bitcoin L1
   - Saldos individuais
   - UTXO counts
   - Ranking completo
   - Identificação de airdrop recipients

2. **Transações:**
   - Últimas 500 transações
   - Senders e receivers
   - Valores movidos
   - Fees pagas
   - Timestamps
   - Block heights

3. **Métricas 24h:**
   - Transaction count
   - Volume movido
   - Active wallets
   - Top wallets (active, inflow, outflow)
   - Average transaction size
   - Miner fees

4. **Supply:**
   - Total supply
   - Circulating supply
   - Burned amount

### ✅ **Dados de Mercado**
1. **Preços:**
   - Múltiplas exchanges (Kraken, Gate.io, MEXC, CoinGecko)
   - Variação 24h
   - Volume 24h
   - Market cap

2. **Exchanges:**
   - Lista completa de exchanges
   - Preços por exchange
   - Volumes por exchange
   - Spreads
   - Trust scores

### ✅ **Dados Forenses**
1. **Airdrop Recipients:**
   - 75,490 recipients
   - Quantidades recebidas
   - Saldos atuais
   - Mudanças de saldo
   - Padrões comportamentais

2. **Análise Comportamental:**
   - 14 categorias comportamentais
   - Diamond Score (0-100)
   - Retention rates
   - Insights personalizados

### ✅ **Dados Bitcoin Network**
1. **Network Stats:**
   - Hash rate
   - Difficulty
   - Block height
   - Block time
   - Mempool size
   - Network fees

2. **Mining:**
   - Recent blocks
   - Mining pools
   - Pool statistics

---

## 🎯 Conclusão

### O que JÁ TEMOS:
- ✅ Dados completos de holders (90k+)
- ✅ Transações on-chain (últimas 500)
- ✅ Métricas 24h calculadas
- ✅ Dados de mercado (preços, volumes)
- ✅ Análise forense completa (75k recipients)
- ✅ Dados da rede Bitcoin

### O que PODEMOS EXPANDIR:
- 📊 Indicadores on-chain avançados (STH/LTH, HODL Waves, MVRV, etc.)
- 📈 Gráficos temporais históricos
- 🔍 Análises de concentração
- 📉 Indicadores de sentimento
- 🐋 Análises de whale movements

---

**Última atualização:** 2024
**Status:** ✅ Análise completa das 6 abas concluída

