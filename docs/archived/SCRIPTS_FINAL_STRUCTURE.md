# 📁 Estrutura Final de Scripts - DOG Data

**Data da Limpeza:** 22 de Outubro de 2025

---

## ✅ **Scripts ATIVOS (Manter e Usar)**

### **1. Extração de Holders**
📍 **Local:** `/ord/efficient_dog_extractor.py`

**Função:** Extrai lista completa de holders do DOG
- Lê dados do indexador Ord
- Resolve endereços via Bitcoin Core RPC
- Conta UTXOs por endereço
- Gera `backend/data/dog_holders_by_address.json`

**Execução:**
```bash
cd /home/bitmax/Projects/bitcoin-fullstack/ord
python3 efficient_dog_extractor.py
```

**Tempo:** ~7 minutos  
**Output:** 92.669 holders, 270.685 UTXOs

---

### **2. Análise Forense do Airdrop**

#### 2.1. Extrator de Dados do Airdrop
📍 **Local:** `DogData-v1/scripts/forensic_airdrop_extractor.py`

**Função:** Extrai dados originais do airdrop DOG
- Output: `data/forensic_airdrop_data.json`
- **Status:** ✅ Já executado (dados em 17/Out)
- **Nota:** Só precisa rodar novamente se houver mudança nos dados do airdrop

#### 2.2. Analisador Comportamental
📍 **Local:** `DogData-v1/scripts/forensic_behavior_analyzer.py`

**Função:** Analisa comportamento dos recipients do airdrop
- Cruza dados do airdrop com holders atuais
- Classifica em: Accumulators, Holders, Sellers
- Gera patterns detalhados (Diamond Paws, HODL Hero, etc.)
- Output: `data/forensic_behavioral_analysis.json`

**Execução:**
```bash
cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1
python3 scripts/forensic_behavior_analyzer.py
```

**Última Atualização:** 22/Out/2025 - 17:09
**Resultado:**
- 20.191 Diamond Hands
- 4.328 Accumulators  
- 3.644 Dumpers
- 45.615 Paper Hands

---

### **3. Inicialização do Sistema**
📍 **Local:** `DogData-v1/scripts/initialize_system.py`

**Função:** Script de inicialização geral (se necessário)
**Status:** ⚠️ Revisar utilidade

---

## 🗑️ **Scripts REMOVIDOS**

### **Movidos para `DogData-v1/data/removed_scripts/`:**
- ❌ `audit_transactions.py` - análise de transações
- ❌ `dog_transaction_finder.py` - busca de transações
- ❌ `monitor_v2.py` - monitor de blocos em tempo real
- ❌ `process_block.py` - processamento de blocos
- ❌ `analyze_airdrop.py` - análise redundante do airdrop
- ❌ `extract_airdrop_via_api.py` - extração via API
- ❌ `trace_airdrop_distribution.py` - rastreamento redundante
- ❌ `airdrop_analyzer.py` - analisador duplicado

**Motivo:** Feature de transações desabilitada no frontend ("Coming Soon")

### **Movidos para `ord/removed_scripts_js/`:**
- ❌ `extract_dog_holders_by_address.js` - versão JS (substituída por Python)
- ❌ `process_dog_holders.js` - processamento redundante
- ❌ `dog_data_extractor.js` - extrator de info da runa (não holders)
- ❌ `dog_data_analyzer.js` - analisador JS
- ❌ `dog_holders_direct.js` - acesso direto redundante
- ❌ `extract_dog_holders_simple.js` - versão simplificada
- ❌ `monitor_indexation.js` - monitor de indexação

**Motivo:** Script Python `efficient_dog_extractor.py` é mais eficiente e funcional

---

## 🎯 **Fluxo de Atualização de Dados**

### **Atualização Completa:**

```bash
# 1. Extrair holders atualizados
cd /home/bitmax/Projects/bitcoin-fullstack/ord
python3 efficient_dog_extractor.py
# ⏱️ ~7 minutos

# 2. Atualizar análise comportamental
cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1
python3 scripts/forensic_behavior_analyzer.py
# ⏱️ ~5 segundos

# 3. Reiniciar backend (se necessário)
cd backend
pm2 restart dog-backend
# ou
node src/server.js
```

---

## 📊 **Arquivos de Dados Gerados**

### **Backend Data:**
- `backend/data/dog_holders_by_address.json`
  - Total holders
  - Total UTXOs
  - Lista de holders com:
    - `address`
    - `total_dog`
    - `utxo_count`
    - `first_seen` (se disponível)
    - `last_seen` (se disponível)

### **Forensic Data:**
- `data/forensic_airdrop_data.json` - Dados originais do airdrop
- `data/forensic_behavioral_analysis.json` - Análise comportamental
- `data/airdrop_recipients.json` - Lista de recipients (usado pelo frontend)

---

## 🚀 **Frontend Atualizado**

### **Página de Holders:**
✅ Card de **Total UTXOs** adicionado
✅ Mostra **270.685 UTXOs** on-chain
✅ Grid responsivo: 4 cards (desktop), 2 (tablet), 1 (mobile)

### **Página de Airdrop:**
✅ Análise comportamental integrada
✅ Patterns consolidados (Accumulators, Holders, Sellers)
✅ Filtros por categoria

---

## 📝 **Notas Importantes**

1. **Bitcoin Core** deve estar rodando para executar `efficient_dog_extractor.py`
2. **Ord** deve estar indexado (~176GB)
3. **Credenciais RPC:** bitmax / Senhabitcoin2023*
4. A extração processa **270.685 UTXOs** fazendo chamadas `bitcoin-cli gettxout`
5. Análise comportamental depende de ambos arquivos:
   - `forensic_airdrop_data.json` (estático)
   - `dog_holders_by_address.json` (atualizado periodicamente)

---

## ✅ **Status Final**

- ✅ Lista de holders atualizada (22/Out/2025)
- ✅ Análise comportamental atualizada
- ✅ Scripts obsoletos removidos
- ✅ Estrutura limpa e organizada
- ✅ Frontend atualizado com Total UTXOs
- ✅ Documentação completa

---

**Próxima atualização recomendada:** Semanal ou conforme necessidade


