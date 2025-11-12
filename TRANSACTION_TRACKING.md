# 🔄 Sistema de Tracking de Transações DOG

**Versão:** 2.0 (otimizado para 32GB RAM)  
**Data:** 01/11/2025  
**Status:** Pronto para teste

---

## 📋 O que o Sistema Faz

### Workflow Completo:

```
1. 🔔 Detecta novo bloco Bitcoin (a cada 30s)
        ↓
2. 🔍 Rastreia TODAS transações DOG no bloco
   ├── Identifica senders (quem enviou) ✅
   ├── Identifica receivers (quem recebeu) ✅
   └── Calcula valores movidos ✅
        ↓
3. 💾 Salva transações → dog_transactions.json
   └── Frontend /transactions consome este arquivo
        ↓
4. 👥 Atualiza holders → dog_holders_by_address.json
   └── Frontend /holders sempre atualizado
        ↓
5. 🔄 Aguarda próximo bloco e repete
```

---

## 📁 Arquivos Criados

### 1. **`dog_block_monitor.py`** (Script Principal)
- Monitora blocos 24/7
- Rastreia transações DOG
- Atualiza holders automaticamente
- Salva estado (pode parar e retomar)
- Recupera blocos perdidos se ficar offline

### 2. **`test_monitor.py`** (Script de Teste)
- Testa cada componente separadamente
- Valida conexões (Bitcoin Core + Ord)
- Testa resolução de senders (o que dava erro!)
- Valida antes de rodar em produção

---

## 🧪 COMO TESTAR

### Passo 1: Executar Testes

```bash
cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1
python3 scripts/test_monitor.py
```

**O que vai testar:**
- ✅ Conexão com Bitcoin Core
- ✅ Conexão com Ord
- ✅ Extração de UTXOs DOG
- ✅ **Resolução de Senders (CRÍTICO!)** ⬅️ O que dava erro
- ✅ Análise de transação DOG
- ✅ Atualização de holders

**Resultado esperado:**
```
🎉 SISTEMA PRONTO PARA PRODUÇÃO!
🎯 RESULTADO: 5/5 testes passaram
```

---

### Passo 2: Testar com 1 Bloco (Dry Run)

Se os testes passarem, testar processamento de 1 bloco:

```bash
cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1
python3 -c "
from scripts.dog_block_monitor import DogBlockMonitor
import subprocess

# Obter bloco atual
result = subprocess.run(['bitcoin-cli', 'getblockcount'], capture_output=True, text=True)
current_block = int(result.stdout.strip())

# Processar apenas o bloco atual (teste)
monitor = DogBlockMonitor()
monitor.process_new_block(current_block)
print('✅ Teste de 1 bloco concluído!')
"
```

**Tempo esperado:** 2-5 minutos (dependendo de quantas TXs DOG tem)

---

### Passo 3: Rodar em Produção

Se tudo funcionou:

```bash
cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1
nohup python3 scripts/dog_block_monitor.py > logs/monitor.log 2>&1 &
```

**Monitorar:**
```bash
# Ver logs em tempo real
tail -f data/logs/dog_block_monitor.log

# Ver status
ps aux | grep dog_block_monitor

# Parar
pkill -f dog_block_monitor
```

---

## 🔥 Vantagens do Sistema Novo

### ✅ Otimizado para 32GB RAM

| Item | Antes (16GB) | Agora (32GB) |
|------|--------------|--------------|
| RAM Disponível | ~12GB | ~27GB |
| Bitcoin + Ord + Script | ❌ Travava | ✅ Roda junto |
| Timeout | Frequente | Raro |
| Performance | Lenta | Rápida |

### ✅ Resolve Problemas Anteriores

**Problema:** Resolução de senders falhava
- **Solução:** Timeout maior + melhor tratamento de erros

**Problema:** Sistema travava
- **Solução:** 32GB RAM + processamento otimizado

**Problema:** Perdia dados se caísse
- **Solução:** Salva estado + recupera blocos perdidos

---

## 📊 Uso de Recursos Estimado

| Processo | RAM | CPU | Disco I/O |
|----------|-----|-----|-----------|
| Bitcoin Core | 8-10 GB | 5-10% | Médio |
| Ord | 4-6 GB | 10-20% | Alto |
| dog_block_monitor.py | 0.5-1 GB | 20-40% | Baixo |
| Sistema + Apps | 4-6 GB | 10-20% | Baixo |
| **TOTAL** | ~20 GB | ~50-80% | OK |
| **Reserva** | **12 GB** | - | - |

✅ **Sobra RAM e CPU!**

---

## 🎯 Dados Gerados

### 1. `dog_transactions.json` (backend/data/)
```json
{
  "timestamp": "2025-11-01T...",
  "total_transactions": 1234,
  "last_block": 921809,
  "transactions": [
    {
      "txid": "abc123...",
      "block_height": 921809,
      "timestamp": "2025-11-01T...",
      "type": "transfer",
      "senders": [
        {"address": "bc1...", "amount_dog": 1000.0}
      ],
      "receivers": [
        {"address": "bc1...", "amount_dog": 1000.0}
      ],
      "total_dog_moved": 1000.0
    }
  ]
}
```

### 2. `dog_holders_by_address.json` (atualizado após cada bloco)

Usado pelo frontend `/holders`

---

## 🐛 Troubleshooting

### Se der erro de "Sender resolution failed":
- **Causa:** Bitcoin Core não tem `txindex=1`
- **Solução:** Já está configurado em `~/.bitcoin/bitcoin.conf`

### Se consumir muita RAM:
- **Causa:** Muitas TXs no bloco
- **Solução:** 32GB é suficiente, mas pode ajustar timeout

### Se travar:
- **Causa:** Timeout muito curto
- **Solução:** Timeouts já otimizados (10s por operação)

---

## 📝 Próximos Passos

1. ✅ Rodar `test_monitor.py` para validar
2. ✅ Testar com 1 bloco
3. ✅ Deixar rodando em produção
4. ✅ Frontend `/transactions` vai consumir os dados automaticamente

---

## 🚀 Frontend Integration

O frontend já tem a rota `/transactions` preparada.

Quando o monitor estiver rodando:
- Dados serão salvos em `backend/data/dog_transactions.json`
- Frontend consome via API ou SSE
- Transações aparecem em tempo real

**Sistema completo de tracking de transações DOG!** 🐕🔥

---

**Próximo comando:**
```bash
python3 scripts/test_monitor.py
```

