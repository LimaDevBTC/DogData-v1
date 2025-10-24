# 🔍 Auditoria de Scripts - DOG Data

## 📊 Estado Atual (22/10/2025)

### ✅ **Scripts ATIVOS e Funcionais**

#### 1. **`DogData-v1/scripts/forensic_behavior_analyzer.py`** ✅
- **Função**: Analisa comportamento dos holders do airdrop
- **Inputs**: 
  - `data/forensic_airdrop_data.json`
  - `backend/data/dog_holders_by_address.json`
- **Output**: `data/forensic_behavioral_analysis.json`
- **Status**: ✅ **MANTER** - Essencial para análise de comportamento
- **Uso**: Frontend mostra patterns (Accumulators, Holders, Sellers)

#### 2. **`DogData-v1/scripts/forensic_airdrop_extractor.py`** ✅
- **Função**: Extrai dados forenses do airdrop original
- **Output**: `data/forensic_airdrop_data.json`
- **Status**: ✅ **MANTER** - Usado pelo forensic_behavior_analyzer.py
- **Nota**: Já foi executado, dados já extraídos

#### 3. **`ord/extract_dog_holders_by_address.js`** ✅ **PRINCIPAL**
- **Função**: **EXTRATOR PRINCIPAL DE HOLDERS**
- **O que faz**:
  1. Executa `ord --data-dir data balances`
  2. Filtra runa DOG•GO•TO•THE•MOON
  3. Para cada UTXO, consulta endereço via `bitcoin-cli gettxout`
  4. Agrupa por endereço
  5. Calcula total de DOG por holder
  6. Conta UTXOs por holder
- **Output**: `../DogData-v1/backend/data/dog_holders_by_address.json`
- **Status**: ✅ **ESTE É O SCRIPT CORRETO PARA ATUALIZAR HOLDERS!**
- **Requisitos**: Bitcoin Core RPC + Ord indexado

---

### ⚠️ **Scripts de Suporte (Manter)**

#### 4. **`DogData-v1/scripts/monitor_v2.py`** ⚠️
- **Função**: Monitor em tempo real de novos blocos
- **Status**: ⚠️ **REVISAR** - Monitor de transações está desabilitado no frontend
- **Nota**: Se não usarmos transações em tempo real, pode ser removido

#### 5. **`DogData-v1/scripts/process_block.py`** ⚠️
- **Função**: Processa bloco específico (usado pelo monitor_v2.py)
- **Status**: ⚠️ **DEPENDE DO MONITOR_V2**

---

### ❌ **Scripts OBSOLETOS (Não estamos usando)**

#### 6. **Scripts de Transações** ❌
- `DogData-v1/scripts/audit_transactions.py`
- `DogData-v1/scripts/dog_transaction_finder.py`
- **Motivo**: Frontend de transações está com "Coming Soon"
- **Ação**: ❌ **MOVER PARA `data/removed_scripts/`**

#### 7. **Scripts de Airdrop Redundantes** ❌
- `DogData-v1/scripts/analyze_airdrop.py`
- `DogData-v1/scripts/extract_airdrop_via_api.py`
- `DogData-v1/scripts/trace_airdrop_distribution.py`
- `DogData-v1/scripts/airdrop_analyzer.py`
- **Motivo**: `forensic_airdrop_extractor.py` já faz tudo
- **Ação**: ❌ **MOVER PARA `data/removed_scripts/`**

#### 8. **Scripts JS no `ord/` (Redundantes)** ❌
- `ord/process_dog_holders.js` - apenas processa arquivo, não extrai
- `ord/dog_data_extractor.js` - extrai info da runa (não holders)
- `ord/dog_data_analyzer.js` - ?
- `ord/dog_holders_direct.js` - ?
- `ord/extract_dog_holders_simple.js` - versão simplificada
- `ord/monitor_indexation.js` - ?
- **Ação**: ❌ **REVISAR E LIMPAR** (manter só o `extract_dog_holders_by_address.js`)

#### 9. **`ord/efficient_dog_extractor.py`** ❌
- **Problema**: Script Python no diretório errado
- **Local correto**: Deveria estar em `DogData-v1/scripts/`
- **Status**: Não sabemos se funciona ou é necessário
- **Ação**: ❌ **REVISAR E MOVER OU DELETAR**

---

## 🎯 **Plano de Ação**

### Fase 1: Atualizar Lista de Holders ✅
```bash
cd /home/bitmax/Projects/bitcoin-fullstack/ord
node extract_dog_holders_by_address.js
```

**Requisitos:**
- ✅ Bitcoin Core rodando (porta 8332)
- ✅ Ord indexado
- ✅ RPC configurado (usuário: bitcoin, senha: bitcoin)

**Output esperado:**
- Arquivo atualizado: `DogData-v1/backend/data/dog_holders_by_address.json`
- Campos: `address`, `totalAmount`, `totalDOG`, timestamp, totalHolders, **totalUTXOs**

### Fase 2: Atualizar Análise Comportamental
```bash
cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1
python3 scripts/forensic_behavior_analyzer.py
```

### Fase 3: Limpar Scripts Obsoletos

1. **Mover para `data/removed_scripts/`:**
   - `scripts/audit_transactions.py`
   - `scripts/dog_transaction_finder.py`
   - `scripts/analyze_airdrop.py`
   - `scripts/extract_airdrop_via_api.py`
   - `scripts/trace_airdrop_distribution.py`
   - `scripts/airdrop_analyzer.py`

2. **Limpar `ord/` (manter apenas):**
   - `extract_dog_holders_by_address.js` ✅

3. **Revisar:**
   - `ord/efficient_dog_extractor.py` - decidir se é útil

---

## 📝 **Estrutura Final Recomendada**

```
DogData-v1/
├── scripts/
│   ├── forensic_airdrop_extractor.py     ✅ (dados já extraídos)
│   ├── forensic_behavior_analyzer.py     ✅ (essencial)
│   └── [monitor_v2.py]                   ⚠️  (se usarmos transações)
│
└── data/
    ├── forensic_airdrop_data.json        ✅
    ├── forensic_behavioral_analysis.json ✅
    └── removed_scripts/                  ❌ (scripts antigos)

ord/
└── extract_dog_holders_by_address.js     ✅ PRINCIPAL

backend/
└── data/
    └── dog_holders_by_address.json       ✅ (atualizado pelo script JS)
```

---

## 🚨 **Problemas Identificados**

1. ❌ Script `efficient_dog_extractor.py` está no lugar errado (`ord/`)
2. ❌ Muitos scripts JS redundantes no `ord/`
3. ❌ Scripts de transações não estão sendo usados
4. ❌ Scripts de airdrop duplicados/redundantes
5. ✅ **Script correto identificado:** `ord/extract_dog_holders_by_address.js`

---

## ✅ **Próximos Passos IMEDIATOS**

1. ✅ Verificar se Bitcoin Core está rodando
2. ✅ Verificar se Ord está indexado
3. ✅ Executar `node extract_dog_holders_by_address.js`
4. ✅ Verificar se `dog_holders_by_address.json` foi atualizado
5. ✅ Adicionar campo **totalUTXOs** no card do frontend
6. 🧹 Limpar scripts obsoletos


