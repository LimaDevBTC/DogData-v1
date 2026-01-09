# 🐕 DOG DATA - Documentação Completa do Projeto

## 📋 Visão Geral

**DOG DATA** é uma plataforma profissional de análise on-chain para a rune DOG•GO•TO•THE•MOON, fornecendo dados em tempo real, análise forense e métricas exclusivas baseadas em UTXO.

---

## 🏗️ Estrutura do Projeto

### Páginas do Site (6 Abas)

1. **Overview** (`/`) - Dashboard principal com métricas gerais
2. **Transactions** (`/transactions`) - Rastreamento de transações on-chain em tempo real
3. **Holders** (`/holders`) - Lista completa de 90k+ holders com rankings
4. **Markets** (`/markets`) - Dados de mercado de múltiplas exchanges
5. **Airdrop Analysis** (`/airdrop`) - Análise forense completa dos 75k recipients
6. **On-Chain Metrics** (`/metrics`) - Indicadores UTXO-based exclusivos ⭐ NOVO

### Script Principal

#### `update_holders_and_fees.py` ⭐ ÚNICO SCRIPT NECESSÁRIO
**Função:** Atualização completa de todos os dados
- **Holders:** Extrai lista completa via Ord indexer
- **Fees:** Calcula fees de transações via Bitcoin Core RPC
- **Métricas UTXO:** Atualiza histórico diário de UTXO count

**Uso:**
```bash
python3 scripts/update_holders_and_fees.py
```

**Quando rodar:** Diariamente ou após atualizações importantes

**Arquivos gerados:**
- `data/dog_holders.json` e `dog_holders_by_address.json`
- `public/data/dog_holders.json` (cópia para Vercel)
- `data/utxo_count_history.json`

---

## 📊 Dados Disponíveis

### Holders
- **90,726 holders** Bitcoin L1
- **10,418 holders** Solana
- **304 holders** Stacks
- **Total:** 101,448 holders
- Saldos, UTXO counts, rankings completos

### Transações
- Últimas 500 transações on-chain
- Métricas 24h (volume, active wallets, top wallets)
- Fees pagas aos mineradores
- Rastreamento de novos holders

### Airdrop
- **75,490 recipients** analisados
- **14 categorias comportamentais**
- **Diamond Score** (0-100) para cada recipient
- Análise de retenção e acumulação

### Métricas On-Chain
- UTXO count trends
- Holder concentration (Gini)
- Top holders supply %
- Distribuição de UTXOs por tamanho
- *Em desenvolvimento:* STH/LTH, HODL Waves, MVRV

---

## 🔧 Infraestrutura

### Requisitos
- **Bitcoin Core** rodando localmente
- **Ord indexer** com dados completos
- **Node.js 18+** para frontend
- **Python 3.9+** para scripts

### Serviços Externos
- **Upstash KV** - Cache de transações
- **Vercel** - Deploy do frontend
- **APIs de Exchanges** - Preços (Kraken, Gate.io, MEXC, etc.)

---

## 🚀 Como Usar

### Setup Inicial
```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente (.env.local)
UPSTASH_KV_REST_API_URL=...
UPSTASH_KV_REST_API_TOKEN=...

# 3. Iniciar serviços
./manage_services.sh start

# 4. Rodar script de atualização
python3 scripts/update_holders_and_fees.py
python3 scripts/update_utxo_metrics.py

# 5. Iniciar servidor de desenvolvimento
npm run dev
```

### Atualização Diária
```bash
# 1. Verificar serviços
./manage_services.sh status

# 2. Atualizar tudo (holders, fees e métricas)
python3 scripts/update_holders_and_fees.py

# 3. Commit e push (se necessário)
git add .
git commit -m "Update data"
git push
```

### Automatização (Cron)
```bash
# Adicionar ao crontab (editar com: crontab -e)
0 2 * * * cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1 && python3 scripts/update_holders_and_fees.py >> logs/update.log 2>&1
```

---

## 📁 Estrutura de Arquivos

```
DogData-v1/
├── app/                          # Next.js app directory
│   ├── page.tsx                  # Overview
│   ├── transactions/             # Transactions page
│   ├── holders/                  # Holders page
│   ├── markets/                  # Markets page
│   ├── airdrop/                  # Airdrop analysis
│   ├── metrics/                  # On-chain metrics ⭐ NOVO
│   └── api/                      # API routes
├── scripts/                       # Scripts Python
│   ├── update_holders_and_fees.py    # ⭐ PRINCIPAL
│   ├── update_utxo_metrics.py        # ⭐ NOVO
│   └── archived/                 # Scripts obsoletos
├── data/                         # Dados JSON
│   ├── dog_holders.json
│   ├── dog_holders_by_address.json
│   └── utxo_count_history.json
├── public/data/                  # Dados públicos (servidos estaticamente)
│   └── dog_holders.json
├── docs/                         # Documentação
│   ├── PROJETO_COMPLETO.md      # Este arquivo
│   ├── ON_CHAIN_METRICS_PLAN.md # Plano de métricas
│   └── archived/                 # Docs obsoletos
└── components/                   # Componentes React
```

---

## 🔑 APIs Principais

### Frontend → Backend
- `/api/dog-rune/holders` - Lista de holders
- `/api/dog-rune/stats` - Estatísticas gerais
- `/api/dog-rune/transactions-kv` - Transações + métricas 24h
- `/api/metrics/utxo` - Métricas de UTXO
- `/api/metrics/holder-concentration` - Concentração de holders
- `/api/metrics/utxo-count-history` - Histórico de UTXO count
- `/api/markets` - Dados de mercado
- `/api/forensic/profiles` - Perfis comportamentais

---

## 🎯 Roadmap

### ✅ Concluído
- Sistema completo de holders
- Rastreamento de transações
- Análise forense de airdrop
- Métricas básicas on-chain

### 🚧 Em Desenvolvimento
- Indicadores avançados (STH/LTH, HODL Waves)
- Script de análise de idade de UTXOs
- Gráficos interativos

### 📋 Planejado
- Realized Cap / MVRV
- Supply in Profit/Loss
- Coin Days Destroyed
- Análises de whale movements

---

## 📝 Notas Importantes

- **Dados atualizados:** Scripts devem rodar regularmente para manter dados atualizados
- **Cache:** APIs usam cache de 5 minutos para performance
- **Performance:** Cálculos otimizados (Gini O(n log n), chamadas paralelas)
- **Backup:** Sempre commitar mudanças importantes no Git

---

**Última atualização:** 2026-01-07  
**Status:** ✅ Produção

