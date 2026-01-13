# 📊 Análise: O que falta para Realized Cap / MVRV e Supply in Profit/Loss

## 🎯 Métricas que queremos implementar

### 1. Realized Cap / MVRV Ratio
- **Realized Cap**: Soma de (amount de cada UTXO × preço de DOG quando o UTXO foi criado)
- **MVRV Ratio**: Market Cap / Realized Cap
- **Uso**: Indicador de valuation. MVRV > 3.7 = overvalued, MVRV < 1.0 = undervalued

### 2. Supply in Profit/Loss
- **Supply in Profit**: Porcentagem do supply onde preço atual > preço de compra
- **Supply in Loss**: Porcentagem do supply onde preço atual < preço de compra
- **Uso**: Indica se holders estão em profit ou loss, ajuda a entender pressão de venda

---

## ✅ O que JÁ TEMOS

### Dados de UTXO disponíveis:
1. **260,209 UTXOs** rastreados (100% do supply)
2. **Idade de cada UTXO** (age_days) - já calculada
3. **Timestamp de criação** (block_time) - disponível via `get_utxo_age_days()`
4. **Amount de cada UTXO** (em smallest units, divisibility 100,000)
5. **Block height** onde cada UTXO foi criado

### Preço atual de DOG:
- ✅ Múltiplas APIs de exchanges (Kraken, Gate.io, MEXC, Pionex, Bitget, etc.)
- ✅ Preço atual em USD/BTC disponível

### Script Python:
- ✅ `update_holders_and_fees.py` - já calcula idade dos UTXOs
- ✅ Já acessa Bitcoin Core RPC para buscar timestamps de blocos
- ✅ Já tem cache de blocos para otimização

---

## ❌ O que FALTA

### 1. Histórico de Preços de DOG ⚠️ CRÍTICO

**Problema**: Para calcular Realized Cap e Supply in Profit/Loss, precisamos saber o preço de DOG no momento que cada UTXO foi criado.

**O que precisamos**:
- Histórico de preços de DOG desde o início (provavelmente desde ~2024-09-30 ou quando DOG foi criado)
- Formato sugerido: `{ timestamp: price_usd }` ou `{ date: price_usd }`
- Pode ser:
  - Diário (mais simples, menos preciso)
  - Por timestamp exato (mais preciso, mais complexo)
  - Por block height (mais fácil de associar, menos preciso em preço)

**Soluções possíveis**:

#### Opção A: API de Histórico (CoinGecko, CoinMarketCap, etc.)
```python
# CoinGecko tem histórico diário
# https://api.coingecko.com/api/v3/coins/dogecoin/history?date=dd-mm-yyyy
```
- ✅ Pronto para usar
- ❌ Pode não ter histórico de DOG rune especificamente
- ❌ Rate limits podem ser um problema para 260k UTXOs

#### Opção B: Criar nosso próprio histórico (Recomendado)
- Armazenar preço diário desde o início
- Atualizar diariamente com preço atual
- Usar preço mais próximo disponível (ex: se UTXO criado em 2024-10-15 14:30, usar preço de 2024-10-15)
- Formato: `data/dog_price_history.json`
```json
{
  "2024-09-30": 0.00001,
  "2024-10-01": 0.00012,
  "2024-10-02": 0.00015,
  ...
}
```

#### Opção C: Interpolação (Híbrida)
- Se não temos preço exato, usar preço mais próximo
- Se data muito antiga sem preço, usar primeiro preço disponível
- Funciona melhor com histórico mínimo de alguns meses

---

## 🔧 Implementação Necessária

### 1. Script para construir histórico de preços

```python
# scripts/build_price_history.py (NOVO)
def build_price_history():
    """
    Constrói histórico de preços de DOG desde a criação
    - Busca preço atual das exchanges
    - Se possível, busca histórico do CoinGecko/CoinMarketCap
    - Armazena em data/dog_price_history.json
    - Formato: { "YYYY-MM-DD": price_usd, ... }
    """
```

**Estratégia**:
1. Tentar buscar histórico completo do CoinGecko/CoinMarketCap
2. Se não disponível, usar preço atual e backfill com estimativas
3. Atualizar diariamente com preço atual
4. Manter histórico persistente em JSON

### 2. Função para buscar preço histórico

```python
# No update_holders_and_fees.py
def get_dog_price_at_timestamp(timestamp: int) -> Optional[float]:
    """
    Retorna o preço de DOG no timestamp especificado
    - Converte timestamp para data (YYYY-MM-DD)
    - Busca em dog_price_history.json
    - Retorna None se não encontrado
    """
```

### 3. Modificar cálculo de UTXO age para incluir preço

```python
# No update_holders_and_fees.py, função get_utxo_age_days()
def get_utxo_age_and_price(txid: str, vout: int, block_cache: dict = None):
    """
    Retorna (age_days, creation_timestamp, price_at_creation)
    - Age já calculamos
    - Timestamp já temos
    - Preço histórico: NOVO
    """
```

### 4. Calcular Realized Cap e Supply in Profit/Loss

```python
# No update_holders_and_fees.py
def calculate_realized_cap_and_profit_loss(utxo_details, current_price):
    """
    Calcula:
    1. Realized Cap = Σ (amount × price_at_creation)
    2. Supply in Profit = Σ (amount onde current_price > price_at_creation)
    3. Supply in Loss = Σ (amount onde current_price < price_at_creation)
    """
    
    realized_cap = 0
    supply_in_profit = 0
    supply_in_loss = 0
    total_supply = 0
    
    for utxo in utxo_details:
        amount_dog = utxo['amount'] / 100000  # Converter para DOG
        price_at_creation = utxo['price_at_creation']
        current_price_usd = current_price
        
        # Realized Cap
        realized_cap += amount_dog * price_at_creation
        
        # Profit/Loss
        if current_price_usd > price_at_creation:
            supply_in_profit += amount_dog
        else:
            supply_in_loss += amount_dog
        
        total_supply += amount_dog
    
    realized_cap_usd = realized_cap
    market_cap = total_supply * current_price_usd
    mvrv_ratio = market_cap / realized_cap_usd if realized_cap > 0 else 0
    
    return {
        'realized_cap': realized_cap_usd,
        'market_cap': market_cap,
        'mvrv_ratio': mvrv_ratio,
        'supply_in_profit': supply_in_profit,
        'supply_in_loss': supply_in_loss,
        'supply_in_profit_pct': (supply_in_profit / total_supply * 100) if total_supply > 0 else 0,
        'supply_in_loss_pct': (supply_in_loss / total_supply * 100) if total_supply > 0 else 0
    }
```

---

## 📋 Plano de Implementação

### Fase 1: Histórico de Preços (1-2 horas)
1. ✅ Criar script `build_price_history.py`
2. ✅ Buscar preço atual
3. ✅ Tentar buscar histórico do CoinGecko/CoinMarketCap
4. ✅ Criar `data/dog_price_history.json` com formato diário
5. ✅ Adicionar atualização diária no cron

### Fase 2: Integração com UTXO (2-3 horas)
1. ✅ Adicionar função `get_dog_price_at_timestamp()`
2. ✅ Modificar `get_utxo_age_days()` para retornar também preço
3. ✅ Salvar `price_at_creation` junto com age em `utxo_age_stats`

### Fase 3: Cálculo das Métricas (1-2 horas)
1. ✅ Criar função `calculate_realized_cap_and_profit_loss()`
2. ✅ Adicionar cálculo no script `update_holders_and_fees.py`
3. ✅ Salvar resultados em `dog_holders.json`

### Fase 4: API e Frontend (2-3 horas)
1. ✅ Criar API route `/api/metrics/realized-cap`
2. ✅ Criar API route `/api/metrics/supply-profit-loss`
3. ✅ Atualizar página `/metrics` com novos gráficos
4. ✅ Criar visualizações modernas estilo TradingView

---

## 🚨 Desafios e Considerações

### 1. Histórico de Preços Incompleto
- **Problema**: DOG pode não ter histórico completo desde o início
- **Solução**: Usar primeiro preço disponível para UTXOs muito antigos, ou estimativa baseada em airdrop

### 2. Performance
- **260,209 UTXOs** para calcular
- **Solução**: Processar em batch, usar cache de preços, otimizar consultas

### 3. Precisão
- **Problema**: Preço diário pode não ser exato para UTXOs criados em horários específicos
- **Impacto**: Baixo, erro provavelmente < 1-2% para métricas agregadas

### 4. Atualização Contínua
- **Preço atual**: Já atualizamos via APIs
- **Histórico**: Atualizar diariamente com preço de fechamento

---

## ✅ Resumo: O que falta

1. **Histórico de preços de DOG** (CRÍTICO)
   - Arquivo JSON com preços diários desde início
   - Script para construir/atualizar histórico
   - Função para buscar preço por timestamp

2. **Integração no script Python**
   - Adicionar `price_at_creation` ao cálculo de UTXO
   - Calcular Realized Cap
   - Calcular Supply in Profit/Loss

3. **API Routes**
   - `/api/metrics/realized-cap`
   - `/api/metrics/supply-profit-loss`

4. **Frontend**
   - Gráficos modernos para as novas métricas
   - Cards informativos
   - Visualizações estilo TradingView

---

## 🎯 Próximos Passos

1. **Criar script `build_price_history.py`** para construir histórico
2. **Integrar no `update_holders_and_fees.py`** para calcular as métricas
3. **Criar API routes** para servir os dados
4. **Atualizar página `/metrics`** com novos gráficos

**Tempo estimado**: 6-8 horas de desenvolvimento


