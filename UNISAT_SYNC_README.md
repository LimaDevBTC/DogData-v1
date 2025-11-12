# 🐕 Unisat DOG Sync - Documentação

## ✅ **Problema Resolvido**

**Antes:** Script Python local (`dog_tx_tracker_v3.py`) não conseguia obter valores corretos dos **inputs** das transações DOG. Os inputs apareciam com `amount_dog: 0.0`.

**Agora:** Script `unisat_dog_sync.py` busca dados da **Unisat API gratuita** com valores EXATOS de inputs e outputs.

---

## 🎯 **Como Funciona**

### **Arquitetura Híbrida:**

```
┌─────────────────────────────────────────────────┐
│  API Unisat (gratuita, sem API key)             │
│  - 2.9M+ eventos DOG históricos                 │
│  - Valores exatos de inputs/outputs             │
│  - Atualização em tempo real                    │
└───────────────┬─────────────────────────────────┘
                │
                ↓ (a cada 10 minutos)
┌─────────────────────────────────────────────────┐
│  Script Python: unisat_dog_sync.py              │
│  - Busca 3500 eventos (últimas ~1000 TXs)      │
│  - Agrupa por TXID                              │
│  - Processa e formata                           │
└───────────────┬─────────────────────────────────┘
                │
                ↓
┌─────────────────────────────────────────────────┐
│  JSON Local: dog_transactions.json              │
│  - ~1000 transações mais recentes               │
│  - ~300KB                                       │
│  - Valores corretos de inputs                  │
└───────────────┬─────────────────────────────────┘
                │
                ↓
┌─────────────────────────────────────────────────┐
│  Frontend Next.js: /transactions                │
│  - Lê JSON local (super rápido)                │
│  - Exibe senders com valores                   │
│  - Zero latência para usuários                 │
└─────────────────────────────────────────────────┘
```

---

## 📊 **Dados Obtidos**

### **Por Transação:**
```json
{
  "txid": "8323bf8...",
  "block_height": 921963,
  "timestamp": "2025-11-02T18:15:14",
  "type": "transfer",
  "senders": [
    {
      "address": "bc1p060mk8...",
      "amount_dog": 120000.0,      ← ✅ VALOR CORRETO!
      "has_dog": true
    }
  ],
  "receivers": [
    {
      "address": "bc1pnkyrk...",
      "amount_dog": 559963.19,
      "vout": 1
    }
  ],
  "total_dog_moved": 559963.19,
  "sender_count": 8,
  "receiver_count": 3
}
```

---

## 🚀 **Como Usar**

### **1. Executar Manualmente:**
```bash
cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1
python3 scripts/unisat_dog_sync.py
```

**Tempo de execução:** ~7-8 minutos (API Unisat está lenta, 50-60s por batch)

**Resultado:**
- ✅ Atualiza `public/data/dog_transactions.json`
- ✅ ~1000 transações mais recentes
- ✅ Valores corretos nos inputs

---

### **2. Configurar Automação (Recomendado):**

#### **Opção A: Cron (Toda hora)**
```bash
# Editar crontab
crontab -e

# Adicionar linha (roda a cada hora no minuto 5):
5 * * * * cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1 && /usr/bin/python3 scripts/unisat_dog_sync.py >> logs/unisat_sync.log 2>&1
```

#### **Opção B: Systemd Timer (Mais robusto)**
Criar arquivo de serviço:
```bash
sudo nano /etc/systemd/system/dogdata-unisat-sync.service
```

Conteúdo:
```ini
[Unit]
Description=DogData Unisat Sync
After=network.target

[Service]
Type=oneshot
User=bitmax
WorkingDirectory=/home/bitmax/Projects/bitcoin-fullstack/DogData-v1
ExecStart=/usr/bin/python3 scripts/unisat_dog_sync.py
StandardOutput=append:/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/logs/unisat_sync.log
StandardError=append:/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/logs/unisat_sync.log
```

Criar timer:
```bash
sudo nano /etc/systemd/system/dogdata-unisat-sync.timer
```

Conteúdo:
```ini
[Unit]
Description=DogData Unisat Sync Timer

[Timer]
OnBootSec=5min
OnUnitActiveSec=1h
Persistent=true

[Install]
WantedBy=timers.target
```

Ativar:
```bash
# Criar diretório de logs
mkdir -p /home/bitmax/Projects/bitcoin-fullstack/DogData-v1/logs

# Recarregar systemd
sudo systemctl daemon-reload

# Ativar e iniciar timer
sudo systemctl enable dogdata-unisat-sync.timer
sudo systemctl start dogdata-unisat-sync.timer

# Verificar status
sudo systemctl status dogdata-unisat-sync.timer
```

---

## 🔍 **Verificar Funcionamento**

### **Ver últimas transações sincronizadas:**
```bash
jq '.transactions[0:3] | .[] | {txid, block_height, senders: .sender_count, total: .total_dog_moved}' public/data/dog_transactions.json
```

### **Verificar valores dos inputs:**
```bash
jq '.transactions[0].senders[0] | {address, amount_dog, has_dog}' public/data/dog_transactions.json
```

### **Ver timestamp da última atualização:**
```bash
jq '.last_update' public/data/dog_transactions.json
```

---

## ⚙️ **Limitações da API Unisat**

1. **Rate Limit:** 500 eventos por chamada
   - **Solução:** Script faz múltiplas chamadas (7 batches para 3500 eventos)

2. **Lentidão:** ~50-60 segundos por batch
   - **Motivo:** API pública sem autenticação é lenta
   - **Impacto:** Script leva ~7-8 minutos para completar
   - **Não é problema:** Roda em background, não afeta usuários

3. **Sem API Key:** API gratuita, sem limites diários conhecidos
   - **Bom:** Zero custo
   - **Cuidado:** Pode ter rate limiting se abusar

---

## 📈 **Comparação: Antes vs Depois**

### **Antes (dog_tx_tracker_v3.py):**
```json
"senders": [
  {
    "address": "bc1p...",
    "amount_dog": 0.0,        ← ❌ PROBLEMA
    "has_dog": false
  }
]
```

### **Depois (unisat_dog_sync.py):**
```json
"senders": [
  {
    "address": "bc1p...",
    "amount_dog": 120000.0,   ← ✅ CORRETO!
    "has_dog": true
  }
]
```

---

## 🎨 **Frontend - Como Exibe**

Página `/transactions`:
- ✅ Senders com valores exatos de DOG
- ✅ Receivers com valores
- ✅ Total DOG moved
- ✅ Botões de copiar endereço
- ✅ Mini-logos para carteiras conhecidas
- ✅ Search por TXID

---

## 🐛 **Troubleshooting**

### **Erro: "HTTPSConnectionPool... Read timed out"**
- **Causa:** API Unisat muito lenta
- **Solução:** Script já tem timeout de 120s, deve funcionar
- **Se persistir:** Tentar novamente em alguns minutos

### **Erro: "params invalid"**
- **Causa:** Limite acima de 500
- **Solução:** Script já usa limite correto de 500

### **JSON vazio ou com poucas transações**
- **Causa:** API não respondeu corretamente
- **Solução:** Executar script novamente

---

## 📝 **Logs**

Logs são salvos em:
```
/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/logs/unisat_sync.log
```

Ver últimas linhas:
```bash
tail -50 logs/unisat_sync.log
```

---

## ✅ **Checklist - Setup Completo**

- [x] Script `unisat_dog_sync.py` criado
- [x] Testado e funcionando
- [x] Gerando `dog_transactions.json` com valores corretos
- [x] Frontend `/transactions` exibindo dados
- [ ] Configurar automação (cron ou systemd timer)
- [ ] Testar em produção
- [ ] Monitorar logs por alguns dias

---

## 🎯 **Próximos Passos (Futuro)**

1. **Otimizações:**
   - Cache inteligente (só buscar TXs novas desde último bloco)
   - Usar `height` parameter da API para buscar apenas blocos novos

2. **Analytics:**
   - Script separado para analytics históricas (1x/dia)
   - Volume por dia/semana/mês
   - Top senders/receivers

3. **Monitoramento:**
   - Alertas para transações grandes (>100k DOG)
   - Post no X quando detectar whale movement
   - Canal Telegram com notificações

---

**Criado em:** 2025-11-02  
**Autor:** AI Assistant  
**Status:** ✅ Funcionando em localhost




