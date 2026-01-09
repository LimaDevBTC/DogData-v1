# 📋 Scripts Essenciais - DOG Data v2.0

**Atualizado:** 01/11/2025  
**Total:** 7 scripts (de 50!)

---

## 🔥 SCRIPTS ATIVOS E NECESSÁRIOS

### 1. **Extração de Dados Base**

#### `efficient_dog_extractor.py` (em `/ord/`)
- **Local:** `/home/bitmax/Projects/bitcoin-fullstack/ord/`
- **Função:** Extrai holders atuais do Ord
- **Entrada:** `ord balances`
- **Saída:** `dog_holders_by_address.json` (16MB)
- **Usado por:** Frontend `/holders` + análises
- **Quando rodar:** A cada bloco OU manualmente

---

### 2. **Análise de Airdrop**

#### `forensic_behavior_analyzer.py`
- **Função:** Análise comportamental dos recipients
- **Entrada:** `airdrop_recipients.json` + holders
- **Saída:** `forensic_behavioral_analysis.json` (49MB)
- **Usado por:** Frontend `/airdrop`
- **Quando rodar:** Ocasionalmente (dados não mudam muito)

#### `generate_airdrop_analytics.py`
- **Função:** Analytics gerais do airdrop
- **Entrada:** `airdrop_recipients.json` + holders
- **Saída:** `airdrop_analytics.json` (18MB)
- **Usado por:** API `/api/airdrop/summary`
- **Quando rodar:** Ocasionalmente

#### `forensic_airdrop_extractor.py`
- **Função:** Extração forense do airdrop
- **Entrada:** Bitcoin Core RPC
- **Saída:** `forensic_airdrop_data.json` (59MB)
- **Usado por:** Análises internas
- **Quando rodar:** Raramente (apenas se precisar reprocessar)

---

### 3. **Tracking de Transações (NOVO!)** ⭐

#### `dog_tx_tracker_v2.py`
- **Função:** Rastreia transações DOG de UM bloco
- **Método:** `ord decode` (não causa lock!)
- **Resolve:** Senders + Receivers ✅
- **Saída:** `dog_transactions.json`
- **Usado por:** Frontend `/transactions`
- **Quando rodar:** A cada novo bloco

#### `dog_monitor_24_7.py`
- **Função:** Monitor contínuo 24/7
- **Ações:** 
  - Detecta novos blocos
  - Chama dog_tx_tracker_v2.py
  - Atualiza holders
- **Estado:** Salva progresso (pode retomar)
- **Quando rodar:** Sempre em background

---

### 4. **Testes**

#### `test_monitor.py`
- **Função:** Valida sistema antes de rodar
- **Testes:** Bitcoin, Ord, Senders, etc.
- **Quando rodar:** Antes de iniciar monitor

---

## 🗑️ Scripts REMOVIDOS (não usar)

Total: **43 scripts** em `/data/removed_scripts/`
- Tentativas anteriores
- Sistemas que não funcionaram
- Duplicatas
- Versões antigas

**NÃO deletar ainda** - podem ter lógica útil

---

## 🎯 Workflow Completo Atual

```
EXTRAÇÃO BASE (manual/agendado):
└─> efficient_dog_extractor.py → holders

ANÁLISE AIRDROP (ocasional):
├─> forensic_behavior_analyzer.py → análise comportamental
└─> generate_airdrop_analytics.py → analytics

TRACKING TEMPO REAL (24/7):
└─> dog_monitor_24_7.py
     ├─> Detecta bloco
     ├─> dog_tx_tracker_v2.py → transações
     └─> efficient_dog_extractor.py → holders
```

---

## 📊 Status Atual

| Script | Status | Testado | Produção |
|--------|--------|---------|----------|
| efficient_dog_extractor.py | ✅ Funciona | ✅ | ✅ |
| forensic_behavior_analyzer.py | ✅ Funciona | ✅ | ✅ |
| generate_airdrop_analytics.py | ✅ Funciona | ✅ | ✅ |
| forensic_airdrop_extractor.py | ✅ Funciona | ✅ | ⚠️ Ocasional |
| dog_tx_tracker_v2.py | ✅ Funciona | ✅ | ⏳ Pronto |
| dog_monitor_24_7.py | ✅ Criado | ⏳ Testar | ⏳ Aguardando |
| test_monitor.py | ✅ Funciona | ✅ | - |

---

**De 50 scripts, precisamos de apenas 7!** 🎯
