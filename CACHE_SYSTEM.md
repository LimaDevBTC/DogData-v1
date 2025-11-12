# 🔄 Sistema de Cache de Transações DOG

## 📋 Visão Geral

Sistema **self-cleaning** que mantém as últimas 1000 transações DOG sempre atualizadas no cache JSON local.

### ✨ Funcionalidades

- **FIFO Automático**: Mantém sempre as últimas 1000 transações
- **Atualização Periódica**: A cada 10 minutos busca novas transações
- **Busca Inteligente**: Cache local + fallback para API Unisat
- **Zero Manutenção**: Sistema totalmente automatizado

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────┐
│  dog_transactions.json (1000 TXs mais recentes) │
└──────────────────┬──────────────────────────────┘
                   │
                   │ Atualizado a cada 10min
                   │
┌──────────────────▼──────────────────────────────┐
│  update_transactions_cache.py (Script Python)   │
│  - Busca últimas 100 TXs da Unisat             │
│  - Mescla com cache existente                  │
│  - Remove TXs antigas (> 1000)                 │
│  - Salva JSON atualizado                       │
└──────────────────┬──────────────────────────────┘
                   │
                   │ Gerenciado por
                   │
┌──────────────────▼──────────────────────────────┐
│  transactions_cache_daemon.sh (Daemon)          │
│  - Roda em background                          │
│  - Loop infinito com sleep(600)                │
│  - Logs em logs/transactions_cache.log         │
└─────────────────────────────────────────────────┘
```

## 🚀 Uso

### Iniciar o Daemon

```bash
./scripts/manage_cache_daemon.sh start
```

### Verificar Status

```bash
./scripts/manage_cache_daemon.sh status
```

### Ver Logs em Tempo Real

```bash
./scripts/manage_cache_daemon.sh logs
```

### Atualizar Manualmente (agora)

```bash
./scripts/manage_cache_daemon.sh update-now
```

### Parar o Daemon

```bash
./scripts/manage_cache_daemon.sh stop
```

### Reiniciar o Daemon

```bash
./scripts/manage_cache_daemon.sh restart
```

## 🔍 Busca de Transações

### Frontend (Página `/transactions`)

1. **Busca Local**: Primeiro busca nas 1000 TXs do cache
2. **Fallback API**: Se não encontrar, busca na Unisat via `/api/dog-rune/search-tx`
3. **Resultado**: Usuário sempre encontra a TX, mesmo que antiga

### Exemplo

```typescript
// Usuário busca: 5e5ae27ba2f6c5ddce9fbff4e5b8aeb458e2b5b8300bec469f72ec6a2e538574

// 1. Busca no cache (instantâneo)
const tx = transactions.find(t => t.txid.includes(searchTxid))

// 2. Se não encontrou, busca na API (5-10s)
if (!tx) {
  const response = await fetch(`/api/dog-rune/search-tx?txid=${searchTxid}`)
  const txData = await response.json()
}
```

## 📊 Estrutura do Cache

### `dog_transactions.json`

```json
{
  "total_transactions": 1000,
  "last_block": 922184,
  "last_updated": "2025-11-03T17:30:00.000Z",
  "transactions": [
    {
      "txid": "...",
      "block_height": 922184,
      "timestamp": 1730659800,
      "type": "transfer",
      "senders": [...],
      "receivers": [...],
      "net_transfer": 5000.0,
      "..."
    },
    // ... 999 mais
  ]
}
```

## ⚙️ Configuração

### Parâmetros Ajustáveis

**`update_transactions_cache.py`:**
- `MAX_TRANSACTIONS = 1000` - Número de TXs no cache
- `limit=100` - TXs buscadas por atualização

**`transactions_cache_daemon.sh`:**
- `sleep 600` - Intervalo entre atualizações (10min = 600s)

## 🛠️ Troubleshooting

### Daemon não inicia

```bash
# Verificar se já está rodando
ps aux | grep transactions_cache_daemon

# Remover PID file manualmente
rm -f /tmp/dog_cache_daemon.pid

# Tentar novamente
./scripts/manage_cache_daemon.sh start
```

### Cache não atualiza

```bash
# Ver logs
./scripts/manage_cache_daemon.sh logs

# Atualizar manualmente
./scripts/manage_cache_daemon.sh update-now
```

### API Unisat lenta

- O script usa timeout de 120s
- Se falhar, tenta novamente em 10min
- Cache antigo permanece válido

## 📝 Logs

Os logs ficam em: `logs/transactions_cache.log`

Formato:
```
[2025-11-03 17:30:00] Atualizando cache...
🚀 Iniciando atualização do cache de transações...
📦 Cache atual: 1000 transações, último bloco: 922184
🔄 Buscando últimas 100 transações da Unisat...
✅ 100 eventos recebidos
🆕 5 novas transações detectadas
✂️ Removendo 5 transações antigas
✅ Cache atualizado!
```

## 🎯 Performance

- **Cache local**: < 100ms
- **Busca API**: 5-10s
- **Atualização**: ~30s (depende da Unisat)
- **Intervalo**: 10 minutos
- **Tamanho JSON**: ~1.3MB (1000 TXs)

## 🔐 Segurança

- ✅ Não expõe API keys
- ✅ Read-only do cache
- ✅ Timeout em todas as requisições
- ✅ Logs com timestamps
- ✅ Validação de dados JSON

## 🚦 Status do Sistema

Para verificar se tudo está funcionando:

```bash
# 1. Daemon rodando?
./scripts/manage_cache_daemon.sh status

# 2. Cache atualizado?
ls -lh public/data/dog_transactions.json

# 3. Logs recentes?
tail -20 logs/transactions_cache.log
```

