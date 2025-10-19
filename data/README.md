# 📁 Estrutura de Dados - DOG Data v2.0

## 🏗️ Arquitetura

```
data/
├── blocks/              # Transações por bloco (1 arquivo por bloco)
│   ├── 919363.json
│   ├── 919364.json
│   └── ...
│
├── holders/             # Estado atual dos holders
│   └── current.json     # Lista atualizada de holders
│
├── snapshots/           # Snapshots periódicos (backup)
│   ├── 919300.json      # A cada 100 blocos
│   ├── 919400.json
│   └── ...
│
├── index/               # Índices para busca rápida
│   ├── state.json       # Estado do sistema
│   └── stats.json       # Estatísticas gerais
│
└── temp/                # Arquivos temporários
    └── processing.lock  # Lock durante processamento
```

---

## 📋 Formato dos Arquivos

### `/blocks/{height}.json`
Contém todas as transações DOG de um bloco específico.

```json
{
  "block_height": 919363,
  "block_hash": "0000000000000000000...",
  "block_time": "2025-10-16T17:30:00Z",
  "tx_count": 5,
  "total_dog_moved": 125000000.50,
  "transactions": [
    {
      "txid": "abc123...",
      "position": 42,
      "inputs": [
        {
          "address": "bc1p50n9...",
          "amount": 1000000.50,
          "rank": 1,
          "is_holder": true
        }
      ],
      "outputs": [
        {
          "address": "bc1qj7d...",
          "amount": 1000000.50,
          "rank": 3,
          "is_new": false
        }
      ]
    }
  ]
}
```

### `/holders/current.json`
Estado atual de todos os holders.

```json
{
  "updated_at": "2025-10-16T17:30:00Z",
  "block_height": 919363,
  "total_holders": 93351,
  "total_supply": 100000000000,
  "circulating": 99976513008.33,
  "holders": [
    {
      "rank": 1,
      "address": "bc1p50n9...",
      "balance": 4184964196.28607,
      "percentage": 4.18,
      "utxo_count": 2101
    }
  ]
}
```

### `/snapshots/{height}.json`
Backup do estado dos holders a cada 100 blocos.
Mesmo formato de `/holders/current.json`

### `/index/state.json`
Estado do sistema de processamento.

```json
{
  "last_processed_block": 919363,
  "last_holders_update": 919363,
  "processing": false,
  "started_at": "2025-10-16T14:00:00Z",
  "total_blocks_processed": 145,
  "total_transactions": 1523
}
```

### `/index/stats.json`
Estatísticas gerais.

```json
{
  "updated_at": "2025-10-16T17:30:00Z",
  "current_block": 919363,
  "total_holders": 93351,
  "total_transactions": 1523,
  "blocks_range": {
    "first": 919219,
    "last": 919363
  },
  "top_24h": {
    "transactions": 245,
    "volume": 15000000.00,
    "new_holders": 12
  }
}
```

---

## 🔄 Fluxo de Atualização

### 1. Monitor Principal
```
Loop infinito:
  1. Verificar novo bloco
  2. SE novo bloco:
     a. Processar transações do bloco
     b. Salvar em /blocks/{height}.json
     c. Atualizar /index/state.json
  3. SE não está processando bloco:
     a. Atualizar holders
     b. Salvar em /holders/current.json
     c. SE altura % 100 == 0:
        - Salvar snapshot
  4. Aguardar 10 segundos
```

### 2. Processamento de Blocos
```
Para cada bloco novo:
  1. bitcoin-cli getblockhash {height}
  2. bitcoin-cli getblock {hash} 2
  3. Filtrar transações com DOG
  4. Para cada TX com DOG:
     a. Buscar inputs (endereços que enviaram)
     b. Buscar outputs (endereços que receberam)
     c. Consultar holders atuais para ranking
     d. Identificar novos holders
  5. Salvar /blocks/{height}.json
  6. Atualizar estatísticas
```

### 3. Atualização de Holders
```
Quando NÃO estiver processando blocos:
  1. Rodar efficient_dog_extractor.py
  2. Processar todos os UTXOs
  3. Calcular rankings
  4. Salvar /holders/current.json
  5. SE altura % 100 == 0:
     - Copiar para /snapshots/{height}.json
```

---

## 🎯 Regras de Negócio

### Identificação de Novos Holders
```python
def is_new_holder(address, current_holders, amount_received):
    holder = current_holders.get(address)
    
    # Se não está na lista, é novo
    if not holder:
        return True
    
    # Se o saldo total é igual ao que acabou de receber, é novo
    # (considerando que holders já foi atualizado)
    if abs(holder['balance'] - amount_received) < 0.00001:
        return True
    
    return False
```

### Cálculo de Ranking
```python
def get_ranking(address, current_holders):
    for rank, holder in enumerate(current_holders, 1):
        if holder['address'] == address:
            return rank
    return None  # Não é holder
```

---

## 📊 Performance

### Tamanho Estimado de Arquivos
- Bloco sem TX DOG: ~200 bytes
- Bloco com 5 TX DOG: ~5KB
- Holders completo: ~15MB
- Snapshot: ~15MB
- Total por 100 blocos: ~15MB (snapshots) + ~500KB (blocos)

### Com 1 ano de dados:
- Blocos: ~52.500 arquivos × 5KB = ~260MB
- Snapshots: 525 arquivos × 15MB = ~7.8GB
- Total: ~8GB

---

## 🔒 Controle de Concorrência

### Lock de Processamento
```python
# Antes de processar
if os.path.exists('data/temp/processing.lock'):
    print("Já está processando!")
    return

# Criar lock
with open('data/temp/processing.lock', 'w') as f:
    f.write(json.dumps({
        'started_at': datetime.now().isoformat(),
        'type': 'block_processing',  # ou 'holders_update'
        'block': current_block
    }))

try:
    # Processar...
    pass
finally:
    # Remover lock
    os.remove('data/temp/processing.lock')
```

---

## 🚀 Inicialização do Sistema

### Primeira vez (Start Fresh)
```bash
1. python3 scripts/initialize_system.py
   → Pega bloco atual do Bitcoin Core
   → Processa holders atuais
   → Salva /holders/current.json
   → Salva /index/state.json com bloco inicial
   → Cria snapshot inicial

2. python3 scripts/monitor.py
   → Inicia monitoramento contínuo
```

### Recuperação após parada
```bash
1. python3 scripts/monitor.py
   → Lê /index/state.json
   → Pega último bloco processado
   → Processa blocos faltantes
   → Continua monitoramento
```


