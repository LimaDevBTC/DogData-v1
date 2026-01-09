# 🐕 DOG DATA - Professional On-Chain Analytics Platform

> Real-time DOG rune explorer with exclusive UTXO-based metrics

[![Status](https://img.shields.io/badge/status-production%20ready-brightgreen)]()
[![Holders](https://img.shields.io/badge/holders-101,448-orange)]()
[![UTXOs](https://img.shields.io/badge/utxos-260,207-blue)]()

---

## 🎯 O Que É

**DOG DATA** é uma plataforma completa de análise on-chain para a rune **DOG•GO•TO•THE•MOON**, fornecendo:

- ✅ **101,448 holders** rastreados (Bitcoin L1, Solana, Stacks)
- ✅ **Transações on-chain** em tempo real
- ✅ **Análise forense** de 75,490 airdrop recipients
- ✅ **Métricas UTXO-based** exclusivas (só quem tem node pode fazer)
- ✅ **Dados de mercado** de múltiplas exchanges

---

## 🚀 Quick Start

### Pré-requisitos
- Bitcoin Core rodando
- Ord indexer configurado
- Node.js 18+
- Python 3.9+

### Instalação
```bash
# 1. Instalar dependências
npm install

# 2. Configurar .env.local
UPSTASH_KV_REST_API_URL=...
UPSTASH_KV_REST_API_TOKEN=...

# 3. Iniciar serviços
./manage_services.sh start

# 4. Atualizar dados
python3 scripts/update_holders_and_fees.py
python3 scripts/update_utxo_metrics.py

# 5. Rodar servidor
npm run dev
```

---

## 📊 Páginas Disponíveis

1. **Overview** - Dashboard principal com métricas gerais
2. **Transactions** - Rastreamento de transações on-chain
3. **Holders** - Lista completa de 90k+ holders
4. **Markets** - Dados de mercado de múltiplas exchanges
5. **Airdrop Analysis** - Análise forense completa
6. **On-Chain Metrics** - Indicadores UTXO-based exclusivos ⭐

---

## 🔧 Script Principal

### `update_holders_and_fees.py` ⭐ ÚNICO SCRIPT
Atualização completa: holders, fees e métricas UTXO
```bash
python3 scripts/update_holders_and_fees.py
```

---

## 📁 Estrutura

```
DogData-v1/
├── app/                    # Next.js pages
├── scripts/                # Scripts Python essenciais
├── data/                   # Dados JSON
├── public/data/            # Dados públicos
├── docs/                   # Documentação
└── components/            # Componentes React
```

---

## 📚 Documentação

- **[PROJETO_COMPLETO.md](docs/PROJETO_COMPLETO.md)** - Documentação completa
- **[ON_CHAIN_METRICS_PLAN.md](docs/ON_CHAIN_METRICS_PLAN.md)** - Plano de métricas
- **[ANALISE_COMPLETA_DADOS_EXIBIDOS.md](docs/ANALISE_COMPLETA_DADOS_EXIBIDOS.md)** - Análise dos dados

---

## 🔑 APIs Principais

- `/api/dog-rune/holders` - Lista de holders
- `/api/dog-rune/transactions-kv` - Transações + métricas
- `/api/metrics/utxo` - Métricas de UTXO
- `/api/metrics/holder-concentration` - Concentração
- `/api/markets` - Dados de mercado

---

## 🎯 Roadmap

- ✅ Sistema completo de holders
- ✅ Rastreamento de transações
- ✅ Análise forense
- ✅ Métricas básicas on-chain
- 🚧 Indicadores avançados (STH/LTH, HODL Waves)
- 📋 Realized Cap / MVRV

---

**Status:** ✅ Produção  
**Última atualização:** 2026-01-07
