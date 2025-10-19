# 🔬 Guia de Análise Forense do Airdrop DOG

## 🎯 Objetivo

Criar a **MAIOR BASE DE DADOS DA COMUNIDADE** sobre o airdrop DOG com insights exclusivos e análise comportamental profunda.

---

## 📊 O Que Este Sistema Faz

### 1. **Extração Forense** 🔍
- Quantidade EXATA que cada carteira recebeu
- Ranking original do airdrop (quem recebeu mais)
- Histórico completo de recebimentos
- Primeira e última transação de airdrop
- Total de vezes que recebeu

### 2. **Análise Comportamental** 🧠
- Posição ATUAL nos holders
- Quanto acumulou/vendeu desde o airdrop
- Taxa de retenção individual
- Mudança de ranking (subiu/caiu quanto)
- Padrão comportamental (14 categorias)
- Diamond Score (0-100)
- Velocidade de acumulação/venda
- Insights personalizados

### 3. **Categorias Comportamentais** 📈

#### Elite (Diamond Score 90-100)
- 💎 **Diamond Hands** - Mantém 100% do airdrop
- 🐋 **Mega Whale** - Acumulou 10x+ o airdrop
- 🐳 **Whale** - Acumulou 5x-10x

#### Strong (Score 70-89)
- 📈 **Mega Accumulator** - Acumulou 2x-5x
- 💪 **Strong Accumulator** - Acumulou 50%+
- 📊 **Accumulator** - Acumulou 10%+

#### Stable (Score 50-69)
- 🤝 **Holder** - Mantém estável
- 💪 **Strong Holder** - Mantém 90%+
- 😐 **Moderate Holder** - Mantém 75%+

#### Weak (Score 25-49)
- 😰 **Weak Holder** - Mantém 50%+
- 📉 **Heavy Seller** - Vendeu 50%+

#### Dumpers (Score 0-24)
- 🚨 **Active Dumper** - Vendeu 75%+
- ⚠️ **Almost Sold** - Resta menos de 10%
- 📄 **Paper Hands** - Vendeu TUDO

---

## 🚀 Como Usar

### Passo 1: Extração Forense

```bash
cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1
python3 scripts/forensic_airdrop_extractor.py
```

**O que faz:**
- Busca TODAS as transações da carteira distribuidora
- Extrai quantidade exata recebida por cada endereço
- Identifica primeiro e último recebimento
- Cria ranking do airdrop

**Tempo:** ~10-15 minutos  
**Saída:** `data/forensic_airdrop_data.json`

### Passo 2: Análise Comportamental

```bash
python3 scripts/forensic_behavior_analyzer.py
```

**O que faz:**
- Cruza dados do airdrop com holders atuais
- Calcula mudanças absolutas e percentuais
- Classifica padrões comportamentais
- Gera diamond score e insights
- Identifica top performers e dumpers

**Tempo:** Segundos  
**Saída:** `data/forensic_behavioral_analysis.json`

---

## 📁 Estrutura de Dados

### `forensic_airdrop_data.json`

```json
{
  "timestamp": "2024-10-17T...",
  "statistics": {
    "total_recipients": 75490,
    "total_distributed_estimate": 67000000000,
    "average_per_recipient": 889806
  },
  "top_recipients": [
    {
      "rank": 1,
      "address": "bc1q...",
      "amount_received": 5000000,
      "receive_count": 3
    }
  ],
  "recipients": [...]
}
```

### `forensic_behavioral_analysis.json`

```json
{
  "timestamp": "2024-10-17T...",
  "statistics": {
    "total_analyzed": 75490,
    "still_holding": 29932,
    "accumulated": 3750,
    "dumping": 5000,
    "diamond_hands": 15000,
    "retention_rate": 39.7
  },
  "top_performers": {
    "diamond_hands": [...],
    "accumulators": [...],
    "dumpers": [...]
  },
  "all_profiles": [
    {
      "address": "bc1q...",
      "airdrop_rank": 1,
      "airdrop_amount": 5000000,
      "current_balance": 25000000,
      "current_rank": 5,
      "absolute_change": 20000000,
      "percentage_change": 400,
      "retention_rate": 500,
      "rank_change": -4,
      "behavior_pattern": "mega_whale",
      "behavior_category": "🐋 Mega Whale (10x+)",
      "accumulation_rate": 50000,
      "is_dumping": false,
      "diamond_score": 95,
      "insights": [
        "Accumulated 400% since airdrop",
        "Climbed 4 positions in ranking",
        "Fast accumulator: +50,000 DOG/day",
        "⭐ Elite holder"
      ]
    }
  ]
}
```

---

## 🎯 Insights Que Podemos Gerar

### 1. **Top Performers**
- Quem mais acumulou desde o airdrop
- Maiores diamond hands (nunca venderam)
- Quem subiu mais no ranking

### 2. **Dumpers & Sell Pressure**
- Quem está vendendo agressivamente
- Velocidade de venda (DOG/day)
- Recipients que quase venderam tudo

### 3. **Correlações**
- Quantidade recebida vs comportamento
- Ranking original vs comportamento atual
- Padrões temporais de venda/acumulação

### 4. **Estatísticas Exclusivas**
- Taxa média de retenção por categoria
- Distribuição de diamond scores
- Mudanças médias de ranking por padrão

---

## 💡 Próximos Passos

### 1. **Atualizar Backend API**
Adicionar novos endpoints:
- `/api/forensic/top-performers`
- `/api/forensic/dumpers`
- `/api/forensic/recipient/:address`
- `/api/forensic/stats`

### 2. **Dashboard Interativo**
- Gráficos de distribuição
- Filtros avançados (por score, padrão, mudança)
- Busca por endereço
- Timeline de comportamento

### 3. **Análises Avançadas**
- Clustering de padrões similares
- Predição de comportamento futuro
- Identificação de carteiras relacionadas
- Análise de volume negociado

---

## 🔄 Workflow Completo

```bash
# 1. Atualizar holders
cd /home/bitmax/Projects/bitcoin-fullstack/ord
python3 efficient_dog_extractor.py

# 2. Executar análise forense (primeira vez ou para atualizar)
cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1
python3 scripts/forensic_airdrop_extractor.py

# 3. Gerar análise comportamental
python3 scripts/forensic_behavior_analyzer.py

# 4. Recarregar backend
curl -X POST http://localhost:3001/api/reload-data
```

---

## 📊 Métricas Principais

### Diamond Score Calculation
```
Base Score: Baseado em retention rate e accumulation
+ Bonus: Mudança positiva de ranking
- Penalty: Mudança negativa de ranking
```

### Behavior Classification
```
Mega Whale: +1000% change
Whale: +500% to +1000%
Mega Accumulator: +200% to +500%
Strong Accumulator: +50% to +200%
Accumulator: +10% to +50%
Holder: 0% to +10%
Strong Holder: 90%+ retention
Moderate Holder: 75-90% retention
Weak Holder: 50-75% retention
Heavy Seller: 25-50% retention
Active Dumper: 10-25% retention
Almost Sold: <10% retention
Paper Hands: 0% (sold everything)
```

---

## 🎁 Valor Para a Comunidade

### Insights Exclusivos:
✅ Primeira base de dados completa do airdrop DOG  
✅ Tracking individual de cada recipient  
✅ Padrões comportamentais identificados  
✅ Diamond score único  
✅ Análise de sell pressure em tempo real  
✅ Identificação de whales verdadeiras  

### Casos de Uso:
- Investidores: Identificar sell pressure
- Comunidade: Ver comportamento dos holders
- Análise: Padrões de mercado
- Transparência: Dados públicos e verificáveis

---

**Criado em:** 17 de Outubro de 2024  
**Status:** 🔥 Sistema forense pronto para execução!

