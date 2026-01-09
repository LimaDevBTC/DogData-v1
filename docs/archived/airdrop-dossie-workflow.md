# 🎁 Dossiê do Airdrop DOG - Workflow Completo

## 📋 Visão Geral

O Dossiê do Airdrop rastreia **todos os ~79.000 endereços** que receberam o airdrop original da DOG e compara com os holders atuais para gerar analytics em tempo real.

---

## 🔄 Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────────┐
│  PASSO 1: Rastrear Distribuição do Airdrop (uma vez)           │
│  Script: trace_airdrop_distribution.py                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌──────────────────────────────────────┐
        │  data/airdrop_recipients.json         │
        │  - 79k endereços                     │
        │  - Quantidade recebida por cada um   │
        └──────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PASSO 2: Atualizar Holders (periódico)                        │
│  Script: efficient_dog_extractor.py                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌──────────────────────────────────────┐
        │  ord/dog_holders_by_address.json      │
        │  - Holders atuais                    │
        │  - Saldos atualizados                │
        └──────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PASSO 3: Gerar Analytics (sempre após atualizar holders)      │
│  Script: analyze_airdrop.py                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌──────────────────────────────────────┐
        │  data/airdrop_analytics.json          │
        │  - Comparação completa               │
        │  - Categorização de comportamento    │
        │  - Estatísticas em tempo real        │
        └──────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PASSO 4: Backend serve via API                                 │
│  Endpoints: /api/airdrop/*                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PASSO 5: Frontend exibe dossiê atualizado                     │
│  Página: /airdrop                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Categorias de Recipients

### 🐋 **Whale (10x+)**
- Tem 10x ou mais do airdrop original
- Acumulou MUITO DOG

### 📈 **Mega Accumulator (2x+)**
- Tem 2x-10x do airdrop original
- Comprou bastante DOG

### 📊 **Accumulator**
- Tem mais que o airdrop original (até 2x)
- Comprou mais DOG

### 💎 **Diamond Hands**
- Tem exatamente (±1%) o airdrop original
- Nunca vendeu nem comprou

### 🤝 **Holder (50-99%)**
- Tem 50-99% do airdrop original
- Vendeu um pouco

### 📉 **Weak Holder (<50%)**
- Tem menos de 50% do airdrop original
- Vendeu a maioria

### 📄 **Paper Hands**
- Vendeu TUDO
- Não está mais nos holders

---

## 🚀 Como Usar

### 1️⃣ **Setup Inicial** (executar uma vez)

```bash
# Rastrear toda a distribuição do airdrop
cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1
python3 scripts/trace_airdrop_distribution.py
```

Isso vai:
- Começar na tx mint: `1107d8477c6067fb47ff34aaea37ceb84842db07e4e829817964fcddfd713224`
- Seguir a carteira distribuidora: `bc1pry0ne0yf5pkgqsszmytmqkpzs4aflhr8tfptz9sydqrhxexgujcqqler2t`
- Mapear TODOS os ~79k endereços que receberam DOG
- Salvar em: `data/airdrop_recipients.json`

**⚠️ IMPORTANTE:** Este script só precisa ser executado UMA VEZ (ou quando quiser revalidar os dados)

---

### 2️⃣ **Atualização Regular** (automatizar)

```bash
# 1. Atualizar holders atuais
cd /home/bitmax/Projects/bitcoin-fullstack/ord
python3 efficient_dog_extractor.py

# 2. Atualizar analytics do airdrop
cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1
python3 scripts/analyze_airdrop.py

# 3. Recarregar backend
curl -X POST http://localhost:3001/api/reload-data
```

**🔄 Frequência sugerida:** A cada 1-6 horas

---

### 3️⃣ **Automação** (criar script único)

Criar um script `update_all.sh`:

```bash
#!/bin/bash
echo "🔄 Atualizando dados DOG..."

# Atualizar holders
echo "👥 Atualizando holders..."
cd /home/bitmax/Projects/bitcoin-fullstack/ord
python3 efficient_dog_extractor.py

# Atualizar analytics do airdrop
echo "🎁 Atualizando dossiê do airdrop..."
cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1
python3 scripts/analyze_airdrop.py

# Recarregar backend
echo "🔄 Recarregando backend..."
curl -X POST http://localhost:3001/api/reload-data

echo "✅ Tudo atualizado!"
```

---

## 📊 Estrutura de Dados

### `airdrop_recipients.json`
```json
{
  "timestamp": "2024-10-17T12:00:00",
  "mint_txid": "1107d8...",
  "distributor_address": "bc1pry...",
  "total_recipients": 79000,
  "total_airdropped": 100000000000,
  "recipients": [
    {
      "address": "bc1q...",
      "airdrop_amount": 1000000,
      "rank": 1
    }
  ]
}
```

### `airdrop_analytics.json`
```json
{
  "timestamp": "2024-10-17T12:30:00",
  "analytics": {
    "summary": {
      "total_recipients": 79000,
      "still_holding": 65000,
      "sold_everything": 14000,
      "retention_rate": 82.3,
      "total_airdropped": 100000000000,
      "total_current_balance": 95000000000
    },
    "by_category": {
      "whale": { "count": 150, "percentage": 0.19 },
      "mega_accumulator": { "count": 500, "percentage": 0.63 },
      "accumulator": { "count": 2000, "percentage": 2.53 },
      "diamond_hands": { "count": 15000, "percentage": 18.99 },
      "holder": { "count": 30000, "percentage": 37.97 },
      "weak_holder": { "count": 17350, "percentage": 21.96 },
      "paper_hands": { "count": 14000, "percentage": 17.72 }
    },
    "recipients": [...]
  }
}
```

---

## 🔧 Troubleshooting

### Erro: "Arquivo de recipients não encontrado"
**Solução:** Execute primeiro `trace_airdrop_distribution.py`

### Erro: "Arquivo de holders não encontrado"
**Solução:** Execute `cd ../ord && python3 efficient_dog_extractor.py`

### Erro: "Ord database already open"
**Solução:** Pare o ord server: `pkill -f "ord server"`

---

## 💡 Próximos Passos

1. ✅ Criar endpoints da API no backend
2. ✅ Atualizar frontend para exibir analytics
3. ✅ Adicionar SSE para updates em tempo real
4. 🔄 Configurar cron job para atualização automática

---

## 📝 Notas Importantes

- **Rastreamento é preciso:** Segue a cadeia completa de UTXOs
- **Dados são imutáveis:** A lista de recipients não muda
- **Analytics são dinâmicos:** Atualizam conforme holders mudam
- **Performance:** Rastreamento inicial pode demorar ~10-30min
- **Analytics:** Gera em segundos (apenas comparação)

---

**Criado em:** 17 de Outubro de 2024  
**Última atualização:** 17 de Outubro de 2024

