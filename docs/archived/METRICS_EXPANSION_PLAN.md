# 📊 Plano de Expansão - Aba Metrics (Indicadores On-Chain)

## 🎯 Objetivo

Criar uma nova aba "Metrics" no DogData com indicadores on-chain profissionais similares ao CoinGlass, CryptoQuant e outras plataformas de análise de Bitcoin, mas adaptados especificamente para DOG Rune.

## 📈 Indicadores Propostos

### 1. **Holder Distribution Metrics** (Distribuição de Holders)

#### 1.1 Short-Term vs Long-Term Holders
- **Short-Term Holders (STH)**: UTXOs que não se moveram por < 155 dias (~5 meses)
- **Long-Term Holders (LTH)**: UTXOs que não se moveram por ≥ 155 dias
- **Métrica**: % de supply em cada categoria
- **Visualização**: Gráfico de linha temporal mostrando a evolução

#### 1.2 Holder Age Distribution
- **0-1 dia**: Recém recebidos
- **1-7 dias**: Muito novos
- **7-30 dias**: Novos
- **30-90 dias**: Médio prazo
- **90-180 dias**: Longo prazo
- **180+ dias**: Muito longo prazo (HODLers)
- **Visualização**: Gráfico de pizza + barras empilhadas

#### 1.3 HODL Waves
- Distribuição do supply por faixas de idade dos UTXOs
- Similar ao "Bitcoin HODL Waves" do Glassnode
- **Visualização**: Heatmap temporal mostrando a evolução

### 2. **Supply Metrics** (Métricas de Supply)

#### 2.1 Realized Cap (Cap Realizado)
- Soma do valor de cada UTXO multiplicado pelo preço quando foi recebido
- Indica o "custo médio" dos holders
- **Fórmula**: Σ(amount × price_at_receipt)

#### 2.2 MVRV Ratio (Market Value to Realized Value)
- **Fórmula**: Market Cap / Realized Cap
- Indica se o token está sobrevalorizado ou subvalorizado
- Valores > 3.7 geralmente indicam topo
- Valores < 1.0 geralmente indicam fundo

#### 2.3 Supply in Profit/Loss
- % do supply que está em lucro vs prejuízo
- Baseado no preço médio de compra vs preço atual
- **Visualização**: Gráfico de área mostrando evolução

#### 2.4 Supply Distribution by Age
- Quantidade de DOG em cada faixa etária
- Mostra concentração de supply por tempo de holding

### 3. **Transaction Metrics** (Métricas de Transações)

#### 3.1 Active Addresses
- Endereços únicos que enviaram ou receberam DOG em um período
- **Períodos**: 24h, 7d, 30d
- **Visualização**: Gráfico de linha temporal

#### 3.2 Transaction Volume
- Volume total de DOG movimentado
- **Períodos**: 24h, 7d, 30d
- Separar por: Recebido, Enviado, Transferido

#### 3.3 Transaction Count
- Número de transações DOG por dia
- **Visualização**: Gráfico de barras temporal

#### 3.4 Average Transaction Size
- Tamanho médio das transações
- **Visualização**: Gráfico de linha mostrando tendência

#### 3.5 Large Transactions (Whales)
- Transações acima de um threshold (ex: 1M DOG)
- Contagem e volume de transações de baleias
- **Visualização**: Timeline de grandes movimentações

### 4. **Network Activity Metrics** (Métricas de Atividade)

#### 4.1 New Holders
- Novos endereços que receberam DOG pela primeira vez
- **Períodos**: Diário, Semanal, Mensal
- **Visualização**: Gráfico de barras

#### 4.2 Lost/Inactive Supply
- Supply que não se moveu por períodos longos (ex: 1+ ano)
- Considerado "perdido" ou "HODLed"
- **Visualização**: Gráfico de linha mostrando crescimento

#### 4.3 UTXO Count Trends
- Evolução do número total de UTXOs
- Mostra fragmentação ou consolidação
- **Visualização**: Gráfico de linha temporal

#### 4.4 Average UTXO Size
- Tamanho médio dos UTXOs
- Indica se há consolidação ou fragmentação
- **Visualização**: Gráfico de linha

### 5. **Holder Behavior Metrics** (Comportamento de Holders)

#### 5.1 Accumulation vs Distribution
- Endereços acumulando (recebendo mais do que enviando)
- Endereços distribuindo (enviando mais do que recebendo)
- **Visualização**: Gráfico de barras comparativo

#### 5.2 Holder Concentration
- Gini Coefficient: Medida de concentração (0 = igual, 1 = máximo)
- Top 10, 50, 100 holders % do supply
- **Visualização**: Gráfico de barras + indicador Gini

#### 5.3 Exchange Flow
- Identificar endereços de exchanges (se possível)
- Inflow/Outflow de exchanges
- **Visualização**: Gráfico de área mostrando fluxo

#### 5.4 Smart Money Indicators
- Endereços que compraram em fundos e venderam em topos
- Identificar "smart money" baseado em timing
- **Visualização**: Lista de endereços + performance

### 6. **Price Correlation Metrics** (Correlação com Preço)

#### 6.1 Exchange Reserve
- Se conseguirmos identificar exchanges
- Quantidade de DOG em exchanges
- **Visualização**: Gráfico de linha temporal

#### 6.2 Whale Movements vs Price
- Correlação entre movimentações de baleias e mudanças de preço
- **Visualização**: Gráfico duplo (preço + movimentações)

#### 6.3 Holder Sentiment
- Baseado em padrões de acumulação/distribuição
- **Visualização**: Indicador de sentimento (Bullish/Bearish/Neutral)

### 7. **Advanced Metrics** (Métricas Avançadas)

#### 7.1 Network Value to Transaction Ratio (NVT)
- **Fórmula**: Market Cap / Transaction Volume (7d)
- Similar ao P/E ratio de ações
- Valores altos = sobrevalorizado

#### 7.2 Spent Output Age Bands (SOAB)
- Idade dos UTXOs quando são gastos
- Mostra se holders antigos estão vendendo
- **Visualização**: Heatmap temporal

#### 7.3 Coin Days Destroyed (CDD)
- Soma de (amount × days_held) para UTXOs gastos
- Indica quando holders de longo prazo movem fundos
- **Visualização**: Gráfico de linha temporal

#### 7.4 Velocity
- Quantas vezes o supply "gira" em um período
- **Fórmula**: Transaction Volume / Average Supply
- **Visualização**: Gráfico de linha

## 🗂️ Estrutura de Dados Necessária

### Dados Atuais Disponíveis
- ✅ Lista completa de UTXOs com DOG
- ✅ Endereços de cada UTXO
- ✅ Quantidade de DOG por UTXO
- ✅ Timestamp de atualização

### Dados Adicionais Necessários

#### 1. Histórico de UTXOs
```json
{
  "utxo_history": [
    {
      "txid": "...",
      "vout": 0,
      "address": "...",
      "amount": 1000000,
      "first_seen_block": 840000,
      "first_seen_timestamp": "2024-01-01T00:00:00Z",
      "last_moved_block": null,
      "last_moved_timestamp": null,
      "age_days": 365,
      "status": "unspent"
    }
  ]
}
```

#### 2. Histórico de Transações
```json
{
  "transactions": [
    {
      "txid": "...",
      "block_height": 840000,
      "timestamp": "2024-01-01T00:00:00Z",
      "inputs": [
        {
          "txid": "...",
          "vout": 0,
          "address": "...",
          "amount": 1000000,
          "age_days": 30
        }
      ],
      "outputs": [
        {
          "address": "...",
          "amount": 500000
        }
      ],
      "volume": 1000000,
      "fee_sats": 1000
    }
  ]
}
```

#### 3. Snapshot Diário de Métricas
```json
{
  "date": "2024-01-01",
  "metrics": {
    "total_holders": 90734,
    "total_utxos": 260207,
    "sth_supply": 0.45,
    "lth_supply": 0.55,
    "realized_cap": 1000000000,
    "mvrv_ratio": 2.5,
    "supply_in_profit": 0.75,
    "active_addresses_24h": 1000,
    "transaction_volume_24h": 50000000,
    "new_holders_24h": 50
  }
}
```

## 🛠️ Implementação

### Fase 1: Coleta de Dados Históricos (2-3 semanas)

#### 1.1 Script de Análise de UTXO Age
```python
# scripts/analyze_utxo_age.py
- Para cada UTXO, encontrar quando foi criado
- Rastrear quando foi gasto (se foi)
- Calcular idade atual
- Salvar histórico diário
```

#### 1.2 Script de Análise de Transações
```python
# scripts/analyze_transactions.py
- Processar todas as transações DOG
- Identificar inputs/outputs
- Calcular volumes e contagens
- Salvar histórico diário
```

#### 1.3 Script de Snapshot Diário
```python
# scripts/daily_metrics_snapshot.py
- Calcular todas as métricas diariamente
- Salvar snapshot em JSON
- Manter histórico completo
```

### Fase 2: API e Backend (1-2 semanas)

#### 2.1 Endpoints da API
```typescript
// app/api/metrics/
- /api/metrics/holders-distribution
- /api/metrics/supply-metrics
- /api/metrics/transaction-metrics
- /api/metrics/network-activity
- /api/metrics/holder-behavior
- /api/metrics/price-correlation
- /api/metrics/advanced
- /api/metrics/historical (para gráficos temporais)
```

#### 2.2 Cache e Performance
- Usar Upstash KV para cache
- Atualizar métricas diariamente
- Cache de 1 hora para queries

### Fase 3: Frontend - Página Metrics (2-3 semanas)

#### 3.1 Estrutura da Página
```
app/metrics/
  - page.tsx (página principal)
  - components/
    - holders-distribution-chart.tsx
    - supply-metrics-chart.tsx
    - transaction-metrics-chart.tsx
    - network-activity-chart.tsx
    - holder-behavior-chart.tsx
    - price-correlation-chart.tsx
    - advanced-metrics-chart.tsx
    - metrics-dashboard.tsx
```

#### 3.2 Componentes de Visualização
- Usar Recharts ou Chart.js
- Gráficos interativos com zoom
- Tooltips informativos
- Export de dados (CSV/JSON)

#### 3.3 Layout
- Dashboard com cards de métricas principais
- Seções expansíveis para cada categoria
- Filtros de período (24h, 7d, 30d, All)
- Comparação temporal

### Fase 4: Integração e Refinamento (1 semana)

#### 4.1 Adicionar ao Menu
- Adicionar "Metrics" ao Header
- Adicionar ao Footer
- Ícone: TrendingUp ou BarChart3

#### 4.2 Otimizações
- Lazy loading de gráficos
- Virtualização para grandes datasets
- Compressão de dados históricos

## 📊 Priorização de Implementação

### MVP (Minimum Viable Product) - 2 semanas
1. ✅ Short-Term vs Long-Term Holders
2. ✅ Holder Age Distribution
3. ✅ Active Addresses (24h, 7d, 30d)
4. ✅ Transaction Volume
5. ✅ Supply in Profit/Loss
6. ✅ New Holders

### Fase 2 - 2 semanas
7. ✅ HODL Waves
8. ✅ Realized Cap / MVRV
9. ✅ Large Transactions (Whales)
10. ✅ UTXO Count Trends
11. ✅ Holder Concentration (Gini)

### Fase 3 - 2 semanas
12. ✅ Accumulation vs Distribution
13. ✅ Coin Days Destroyed
14. ✅ Spent Output Age Bands
15. ✅ Network Value to Transaction Ratio
16. ✅ Velocity

## 🎨 Design e UX

### Tema Visual
- Manter consistência com o design atual (dark theme, orange accents)
- Cards com glassmorphism
- Gráficos com cores temáticas (orange para DOG)
- Animações suaves

### Responsividade
- Mobile-first approach
- Gráficos responsivos
- Tabelas scrolláveis em mobile
- Menu colapsável

## 📝 Notas Técnicas

### Performance
- Processar métricas em background (cron job)
- Usar índices no banco de dados
- Cache agressivo
- Paginação para dados históricos

### Escalabilidade
- Considerar usar TimescaleDB para dados temporais
- Particionar dados por data
- Compressão de dados antigos (> 1 ano)

### Manutenção
- Logs detalhados
- Monitoramento de performance
- Alertas para falhas no cálculo
- Documentação de cada métrica

## 🚀 Próximos Passos

1. **Aprovação do Plano**: Revisar e ajustar conforme necessário
2. **Setup Inicial**: Criar estrutura de pastas e arquivos base
3. **Fase 1 - Coleta**: Implementar scripts de análise
4. **Fase 2 - API**: Criar endpoints e lógica de cálculo
5. **Fase 3 - Frontend**: Desenvolver interface visual
6. **Fase 4 - Polimento**: Refinamentos e otimizações

## 📚 Referências

- [Glassnode Metrics](https://glassnode.com/metrics)
- [CoinMetrics](https://coinmetrics.io/)
- [CryptoQuant](https://cryptoquant.com/)
- [Bitcoin HODL Waves](https://hodlwaves.net/)

---

**Autor**: DOG DATA Team  
**Data**: 2026-01-07  
**Versão**: 1.0

