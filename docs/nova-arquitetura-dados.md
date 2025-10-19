# 🏗️ Nova Arquitetura de Dados - Inspirada na UniSat

## 🔍 Análise da Estrutura da UniSat

Baseado na análise do UniSat ([uniscan.cc](https://uniscan.cc)), eles organizam os dados da seguinte forma:

### **1. Foco em Endereços (Address-Centric)**
- Cada endereço tem sua própria página
- Histórico completo de transações do endereço
- Balances atuais e históricos
- Não precisam de "ranking global" em tempo real

### **2. Transações Organizadas por Endereço**
```
Address Page:
├── Current Balance (DOG)
├── Transaction History
│   ├── TX 1: Sent 1000 DOG to bc1q...
│   ├── TX 2: Received 500 DOG from 3E8q...
│   └── TX 3: Sent 250 DOG to bc1p...
└── Rune Assets
    └── DOG•GO•TO•THE•MOON: 4,184,964,196 DOG
```

### **3. Transação Individual**
```
Transaction Details:
├── TxID
├── Block Height
├── Timestamp
├── Inputs (todos os inputs, não só DOG)
│   └── Para cada input: address, BTC amount, Runes
├── Outputs (todos os outputs)
│   └── Para cada output: address, BTC amount, Runes
└── Rune Transfers
    ├── From: address A → To: address B → Amount: X DOG
    ├── From: address C → To: address D → Amount: Y DOG
```

---

## 🚨 Problemas da Nossa Estrutura Atual

### **Problema 1: Dados Desconectados**
```
❌ ATUAL:
dog_holders.json          → Snapshot em um momento
dog_transactions.json     → Outro snapshot
Rankings calculados       → Em runtime no backend
```

**Consequência:**
- Holders e transações ficam desincronizados
- Não sabemos o ranking histórico
- "Ex-holders" aparecem sem ranking

---

### **Problema 2: Falta de Histórico**
```
❌ ATUAL:
Só temos o estado ATUAL dos holders
Não sabemos quem ERA holder no bloco X
```

**Consequência:**
- Impossível saber o ranking de um sender no momento da transação
- Aparece como "NEW" ou sem ranking incorretamente

---

### **Problema 3: Transações Incompletas**
```
❌ ATUAL:
Só processamos blocos específicos
Faltam 34 blocos no range 917618-917677
```

**Consequência:**
- Histórico com "buracos"
- Estatísticas imprecisas

---

## ✅ Nova Arquitetura Proposta

### **Estrutura de Diretórios:**
```
DogData-v1/
├── backend/
│   └── data/
│       ├── current/                    # Estado atual
│       │   ├── holders.json           # Holders atuais
│       │   └── stats.json             # Estatísticas gerais
│       │
│       ├── transactions/              # Transações organizadas
│       │   ├── by_block/              # Por bloco
│       │   │   ├── 917618.json
│       │   │   ├── 917619.json
│       │   │   └── ...
│       │   │
│       │   └── by_address/            # Por endereço (cache)
│       │       ├── bc1p50n9...json    # Todas TXs desse endereço
│       │       └── bc1qj7d...json
│       │
│       └── snapshots/                 # Snapshots históricos
│           ├── block_917000.json      # Holders no bloco 917000
│           ├── block_917100.json      # Holders no bloco 917100
│           └── block_917200.json      # A cada 100 blocos
```

---

## 📋 Novos Formatos de Arquivo

### **1. `/current/holders.json`**
```json
{
  "timestamp": "2025-10-16T17:00:00Z",
  "block_height": 919363,
  "total_holders": 93351,
  "total_supply": 100000000000,
  "total_burned": 23486991.67,
  "circulating": 99976513008.33,
  "holders": [
    {
      "rank": 1,
      "address": "bc1p50n9sksy5gwe6fgrxxsqfcp6ndsfjhykjqef64m8067hfadd9efqrhpp9k",
      "balance": 4184964196.28607,
      "percentage": 4.18,
      "first_tx_block": 840125,
      "last_tx_block": 919360,
      "tx_count": 2101
    }
  ]
}
```

### **2. `/transactions/by_block/917618.json`**
```json
{
  "block_height": 917618,
  "block_hash": "0000000000000000000...",
  "timestamp": "2025-10-04T09:59:14Z",
  "tx_count": 8,
  "snapshot_block": 917600,  // Snapshot de holders mais próximo
  "transactions": [
    {
      "txid": "27bd3db128a35e7954f0449bdc2eb951fbe6b737d6c7d8b82efff1197236b252",
      "inputs": [
        {
          "address": "bc1qj7dam98j6ktjcp320qu77y2vrylv49c2k2hkmu",
          "btc_value": 0,
          "runes": {
            "DOG•GO•TO•THE•MOON": 698209135945
          },
          "rank_at_tx": 3,           // 🆕 Ranking no momento da TX
          "balance_at_tx": 705241227059  // 🆕 Saldo no momento da TX
        }
      ],
      "outputs": [
        {
          "address": "bc1q3xawn9l5jqxzeqg7msqs273g4rscwra9m9x8rj",
          "btc_value": 546,
          "runes": {
            "DOG•GO•TO•THE•MOON": 5000000000
          },
          "is_new_holder": true,     // 🆕 Primeira vez recebendo
          "rank_after_tx": 5420      // 🆕 Ranking após a TX
        }
      ],
      "rune_transfers": [
        {
          "rune": "DOG•GO•TO•THE•MOON",
          "from": "bc1qj7dam98j6ktjcp320qu77y2vrylv49c2k2hkmu",
          "to": "bc1q3xawn9l5jqxzeqg7msqs273g4rscwra9m9x8rj",
          "amount": 5000000000,
          "amount_formatted": "50000 DOG"
        }
      ]
    }
  ]
}
```

### **3. `/snapshots/block_917600.json`**
```json
{
  "block_height": 917600,
  "timestamp": "2025-10-04T09:00:00Z",
  "total_holders": 93200,
  "snapshot_type": "full",  // full, incremental
  "holders": {
    "bc1qj7dam98j6ktjcp320qu77y2vrylv49c2k2hkmu": {
      "rank": 3,
      "balance": 2305241227059,
      "tx_count": 1210
    },
    "bc1p50n9...": {
      "rank": 1,
      "balance": 4180000000000,
      "tx_count": 2095
    }
  }
}
```

---

## 🔄 Novo Fluxo de Processamento

### **Script 1: `sync_blocks.py`** (Processa blocos novos)
```python
Objetivo: Processar blocos sequencialmente sem pular

Entrada: Último bloco processado
Saída: Arquivos /transactions/by_block/{height}.json

Lógica:
1. Ler último bloco processado
2. Para cada bloco novo:
   a. Buscar transações DOG do bloco
   b. Para cada transação:
      - Buscar snapshot de holders mais próximo
      - Adicionar rank_at_tx e balance_at_tx
      - Identificar is_new_holder
   c. Salvar /transactions/by_block/{height}.json
3. Atualizar ponteiro de último bloco
```

### **Script 2: `update_holders.py`** (Atualiza holders)
```python
Objetivo: Manter lista de holders atualizada

Entrada: Bloco atual
Saída: 
  - /current/holders.json
  - /snapshots/block_{N}.json (a cada 100 blocos)

Lógica:
1. Processar UTXOs de todos os endereços
2. Calcular balances atuais
3. Ordenar por balance (ranking)
4. Salvar /current/holders.json
5. Se bloco % 100 == 0:
   - Salvar snapshot completo
```

### **Script 3: `build_address_cache.py`** (Cache por endereço)
```python
Objetivo: Criar índice de transações por endereço

Entrada: /transactions/by_block/*.json
Saída: /transactions/by_address/{address}.json

Lógica:
1. Para cada endereço único:
   a. Buscar todas TXs onde endereço aparece
   b. Ordenar por timestamp
   c. Salvar /by_address/{address}.json
2. Usado para página de endereço no frontend
```

---

## 📊 Nova API do Backend

### **Endpoint 1: `/api/transactions`** (Todas as transações)
```javascript
GET /api/transactions?page=1&limit=50&sort=desc

Response:
{
  "transactions": [...],  // Array de TXs
  "pagination": {
    "total": 5420,
    "page": 1,
    "pages": 109
  },
  "complete": true,  // 🆕 Se o histórico está completo
  "missing_blocks": []  // 🆕 Blocos que faltam
}
```

### **Endpoint 2: `/api/address/{address}`** (Dados do endereço)
```javascript
GET /api/address/bc1p50n9...

Response:
{
  "address": "bc1p50n9...",
  "current_rank": 1,
  "balance": 4184964196.28607,
  "first_tx": {
    "block": 840125,
    "txid": "...",
    "timestamp": "..."
  },
  "last_tx": {
    "block": 919360,
    "txid": "...",
    "timestamp": "..."
  },
  "tx_count": 2101,
  "transactions": [...]  // Histórico completo
}
```

### **Endpoint 3: `/api/holders`** (Lista de holders)
```javascript
GET /api/holders?page=1&limit=100

Response:
{
  "timestamp": "2025-10-16T17:00:00Z",
  "block_height": 919363,
  "total_holders": 93351,
  "holders": [
    {
      "rank": 1,
      "address": "bc1p50n9...",
      "balance": 4184964196.28607,
      "percentage": 4.18
    }
  ]
}
```

### **Endpoint 4: `/api/stats`** (Estatísticas gerais)
```javascript
GET /api/stats

Response:
{
  "current_block": 919363,
  "total_holders": 93351,
  "total_supply": 100000000000,
  "circulating": 99976513008.33,
  "burned": 23486991.67,
  "blocks_processed": {
    "first": 840000,
    "last": 919363,
    "total": 79363,
    "complete": false,
    "missing": [917620, 917625, ...]  // 🆕 Blocos faltantes
  }
}
```

---

## 🎯 Plano de Migração

### **Fase 1: Corrigir Processamento Atual** (1-2 dias)
1. ✅ Rodar `sync_blocks.py` para preencher blocos faltantes
2. ✅ Garantir processamento sequencial (sem pular blocos)
3. ✅ Adicionar snapshots de holders a cada 100 blocos

### **Fase 2: Enriquecer Transações** (2-3 dias)
1. ✅ Adicionar `rank_at_tx` em todas as transações
2. ✅ Adicionar `balance_at_tx` 
3. ✅ Corrigir identificação de `is_new_holder`
4. ✅ Adicionar `rank_after_tx` para receivers

### **Fase 3: Reorganizar Arquivos** (1 dia)
1. ✅ Criar estrutura `/current`, `/transactions`, `/snapshots`
2. ✅ Migrar dados para novo formato
3. ✅ Atualizar backend para ler nova estrutura

### **Fase 4: Otimizações** (1-2 dias)
1. ✅ Cache por endereço (`build_address_cache.py`)
2. ✅ Compressão de snapshots antigos
3. ✅ Índice de busca rápida

---

## 🔍 Comparação: Antes vs Depois

| Aspecto | ❌ Antes | ✅ Depois |
|---------|---------|-----------|
| **Sincronização** | Holders e TXs desincronizados | Snapshots garantem sincronia |
| **Ranking Histórico** | Não existe | rank_at_tx em cada TX |
| **Ex-Holders** | Sem ranking | Ranking do último snapshot |
| **Blocos Faltantes** | 34 blocos perdidos | Processamento sequencial |
| **Novos Holders** | Lógica imprecisa | Comparação com snapshot |
| **Performance** | Backend calcula tudo | Dados pré-processados |
| **Escalabilidade** | 1 arquivo JSON gigante | Arquivos por bloco/endereço |

---

## 💡 Vantagens da Nova Arquitetura

1. ✅ **Histórico Completo**: Sem blocos faltando
2. ✅ **Rankings Precisos**: Sempre sabemos o ranking no momento da TX
3. ✅ **Ex-Holders**: Identificados corretamente
4. ✅ **Performance**: Dados pré-calculados
5. ✅ **Escalável**: Fácil adicionar novos blocos
6. ✅ **Auditável**: Snapshots permitem verificação
7. ✅ **Similar ao UniSat**: Estrutura comprovada

---

## 🚀 Próximos Passos

Qual você prefere:

**A) Começar com Fase 1 (corrigir o atual)**
- Mais rápido
- Menos disruptivo
- Melhora gradual

**B) Implementar tudo de uma vez**
- Mais trabalhoso
- Requer migração completa
- Resultado final melhor

**C) Híbrido**
- Implementar novo sistema
- Manter o antigo funcionando
- Migrar aos poucos


