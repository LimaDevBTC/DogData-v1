# 🏗️ DOG Data v2.0 - Arquitetura Profissional

## 🎯 Objetivo

Sistema profissional para monitorar transações DOG em tempo real, com:
- ✅ Processamento de blocos em tempo real (bloco a bloco)
- ✅ Atualização ass

íncrona de holders
- ✅ Dados organizados e escaláveis
- ✅ Sem dados históricos (começamos do bloco atual)

---

## 📁 Estrutura de Dados

```
DogData-v1/
└── data/                      # 🆕 NOVA estrutura de dados
    ├── blocks/                # Transações por bloco
    │   ├── 919363.json       # 1 arquivo por bloco
    │   ├── 919364.json
    │   └── ...
    │
    ├── holders/               # Estado atual dos holders
    │   └── current.json      # Lista completa e atualizada
    │
    ├── snapshots/             # Backups a cada 100 blocos
    │   ├── 919300.json
    │   ├── 919400.json
    │   └── ...
    │
    ├── index/                 # Metadados do sistema
    │   ├── state.json        # Estado do processamento
    │   └── stats.json        # Estatísticas gerais
    │
    └── temp/                  # Arquivos temporários
        └── processing.lock   # Lock de processamento
```

---

## 🔄 Fluxo de Funcionamento

```
┌─────────────────────────────────────────────────────────┐
│              🎯 Monitor Principal (monitor_v2.py)        │
└─────────────────────────────────────────────────────────┘
                           ↓
         ┌─────────────────┴─────────────────┐
         ↓                                    ↓
  ┌──────────────┐                    ┌──────────────┐
  │  Novo Bloco? │                    │ Atualizar    │
  │     SIM      │                    │  Holders?    │
  └──────────────┘                    └──────────────┘
         ↓                                    ↓
  ┌──────────────┐                    ┌──────────────┐
  │ Processar    │                    │ Aguardar até │
  │ Bloco        │                    │ não ter      │
  │              │                    │ processamento│
  └──────────────┘                    └──────────────┘
         ↓                                    ↓
  ┌──────────────┐                    ┌──────────────┐
  │ Salvar em    │                    │ Rodar        │
  │ /blocks/     │                    │ extractor    │
  └──────────────┘                    └──────────────┘
         ↓                                    ↓
  ┌──────────────┐                    ┌──────────────┐
  │ Se bloco     │                    │ Salvar em    │
  │ % 100 == 0   │                    │ /holders/    │
  │ → Snapshot   │                    └──────────────┘
  └──────────────┘
         ↓
  ┌──────────────┐
  │ Recarregar   │
  │ Backend      │
  └──────────────┘
```

---

## 🚀 Scripts Criados

### 1. `initialize_system.py` - Inicializador
**Função:** Prepara o sistema para começar do zero

**O que faz:**
1. Obtém bloco atual do Bitcoin Core
2. Extrai holders atuais (efficient_dog_extractor.py)
3. Cria estrutura de dados inicial
4. Salva estado inicial

**Uso:**
```bash
python3 scripts/initialize_system.py
```

**Saída:**
- `/data/holders/current.json` - Holders atuais
- `/data/snapshots/{bloco}.json` - Snapshot inicial
- `/data/index/state.json` - Estado inicial
- `/data/index/stats.json` - Estatísticas iniciais

---

### 2. `process_block.py` - Processador de Blocos
**Função:** Processa um bloco específico

**O que faz:**
1. Obtém dados do bloco via bitcoin-cli
2. Analisa cada transação buscando DOG
3. Identifica inputs (senders) e outputs (receivers)
4. Adiciona ranking consultando holders atuais
5. Salva em `/data/blocks/{height}.json`

**Uso:**
```bash
# Processar bloco específico
python3 scripts/process_block.py 919363

# Processar próximo bloco
python3 scripts/process_block.py
```

---

### 3. `monitor_v2.py` - Monitor Principal
**Função:** Orquestra todo o sistema

**O que faz:**
1. Loop infinito checando novos blocos
2. Quando tem bloco novo:
   - Processa o bloco
   - Salva dados
   - Cria snapshot (se múltiplo de 100)
   - Recarrega backend
3. Quando NÃO tem bloco novo:
   - Atualiza holders (a cada 5 minutos)
   - Recarrega backend

**Uso:**
```bash
python3 scripts/monitor_v2.py
```

**Logs:**
```
2025-10-16 14:00:00 ℹ️  Último bloco processado: 919363
2025-10-16 14:00:10 📦 Processando bloco 919364...
2025-10-16 14:00:15 ✅ Bloco 919364 processado!
2025-10-16 14:05:00 👥 Atualizando holders...
2025-10-16 14:07:30 ✅ Holders atualizados: 93,352
```

---

## 📊 Formato dos Dados

### `/data/blocks/919363.json`
```json
{
  "block_height": 919363,
  "block_hash": "0000000000000000000...",
  "block_time": "2025-10-16T17:30:00Z",
  "tx_count": 3,
  "transactions": [
    {
      "txid": "abc123...",
      "position": 42,
      "inputs": [
        {
          "address": "bc1p50n9...",
          "rank": 1,
          "is_holder": true
        }
      ],
      "outputs": [
        {
          "address": "bc1qj7d...",
          "rank": 3,
          "is_holder": true,
          "is_new": false
        }
      ]
    }
  ]
}
```

### `/data/holders/current.json`
```json
{
  "updated_at": "2025-10-16T17:30:00Z",
  "block_height": 919363,
  "total_holders": 93351,
  "total_supply": 100000000000,
  "circulating": 99976513008.33,
  "burned": 23486991.67,
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

### `/data/index/state.json`
```json
{
  "last_processed_block": 919363,
  "last_holders_update": 919363,
  "processing": false,
  "started_at": "2025-10-16T14:00:00Z",
  "total_blocks_processed": 145,
  "total_transactions": 1523,
  "mode": "live"
}
```

---

## 🎯 Plano de Execução

### **Passo 1: Inicializar Sistema**
```bash
cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1
python3 scripts/initialize_system.py
```

**Isso vai:**
- ✅ Obter bloco atual (ex: 919363)
- ✅ Extrair todos os holders atuais (~5 minutos)
- ✅ Criar estrutura de dados
- ✅ Preparar sistema para começar

**Resultado esperado:**
```
================================================================================
✅ SISTEMA INICIALIZADO COM SUCESSO!
================================================================================

📦 Bloco inicial: 919363
👥 Total de holders: 93,351
🐕 Supply circulante: 99,976,513,008.33 DOG
🔥 Queimado: 23,486,991.67 DOG

📁 Arquivos criados:
   ✓ data/holders/current.json
   ✓ data/snapshots/919363.json
   ✓ data/index/state.json
   ✓ data/index/stats.json

🚀 Próximo passo: Rodar o monitor
   python3 scripts/monitor_v2.py
```

---

### **Passo 2: Iniciar Monitor**
```bash
python3 scripts/monitor_v2.py
```

**Isso vai:**
- ✅ Monitorar novos blocos a cada 10 segundos
- ✅ Processar blocos automaticamente
- ✅ Atualizar holders a cada 5 minutos
- ✅ Criar snapshots a cada 100 blocos
- ✅ Recarregar backend automaticamente

**Logs esperados:**
```
================================================================================
🚀 DOG Data Monitor v2.0 - INICIADO
================================================================================
Último bloco processado: 919363
Total de transações: 0
Monitoramento iniciado. Pressione Ctrl+C para parar.

2025-10-16 14:00:10 📦 Processando bloco 919364...
2025-10-16 14:00:15 ✅ Bloco 919364 processado!
2025-10-16 14:05:00 👥 Atualizando holders...
2025-10-16 14:07:30 ✅ Holders atualizados: 93,352
```

---

### **Passo 3: Atualizar Backend (TODO)**
O backend precisará ser atualizado para ler da nova estrutura:

```javascript
// Ler holders de data/holders/current.json
// Ler transações de data/blocks/*.json
// API endpoints já funcionam, só mudar fonte de dados
```

---

### **Passo 4: Atualizar Frontend (TODO)**
Frontend continua funcionando, backend que muda a fonte.

---

## ✅ Vantagens da Nova Arquitetura

| Aspecto | ❌ Antes | ✅ Depois |
|---------|---------|-----------|
| **Organização** | Tudo misturado | Separado por função |
| **Escalabilidade** | 1 arquivo gigante | 1 arquivo por bloco |
| **Performance** | Lê tudo sempre | Lê só o necessário |
| **Sincronização** | Dados desconectados | Estado consistente |
| **Recuperação** | Difícil | Snapshots + state.json |
| **Manutenção** | Complexa | Simples e clara |
| **Blocos faltantes** | Comum | Processamento sequencial |
| **Rankings** | Imprecisos | Sempre atualizados |

---

## 🔧 Próximos Passos

1. ✅ Scripts criados e documentados
2. ⏳ **AGORA:** Rodar `initialize_system.py`
3. ⏳ Testar `monitor_v2.py`
4. ⏳ Atualizar backend para ler nova estrutura
5. ⏳ Testar frontend
6. ⏳ Colocar em produção

---

## 📝 Notas Importantes

### Dados Antigos
- ❌ **Descartados** - Começamos do zero
- ✅ Apenas dados do bloco atual em diante
- ✅ Estrutura profissional e escalável

### Performance
- Processamento de bloco: ~5-10 segundos
- Atualização de holders: ~5 minutos
- Snapshots: ~1 segundo (cópia de arquivo)

### Recursos
- Disco: ~8GB por ano
- RAM: ~2GB (durante atualização de holders)
- CPU: Baixo (picos durante processamento)

---

## 🆘 Troubleshooting

### Monitor não inicia
```bash
# Verificar se sistema foi inicializado
ls -la data/index/state.json

# Se não existe, rodar:
python3 scripts/initialize_system.py
```

### Bitcoin Core não responde
```bash
# Verificar se está rodando
bitcoin-cli getblockcount

# Se não, iniciar:
bitcoind -daemon
```

### Lock travado
```bash
# Remover lock manualmente
rm data/temp/processing.lock
```

---

**🚀 Sistema pronto para começar!**


