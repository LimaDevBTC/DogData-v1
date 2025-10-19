# Exploração da API do Ord para DOG•GO•TO•THE•MOON

**Data**: 16 de outubro de 2025  
**Versão do Ord**: 0.23.2  
**Índice**: 177GB (bloco 918761, 207.986 runes indexadas)

## 📋 Resumo Executivo

A API do Ord Server fornece dados sobre runes através de endpoints HTTP com suporte a JSON (via header `Accept: application/json`). No entanto, a API tem **limitações significativas** para nosso caso de uso de monitoramento de transações e holders do DOG.

## ✅ Endpoints Funcionais Descobertos

### 1. **GET /rune/DOG•GO•TO•THE•MOON** (ou pelo ID: `/rune/840000:3`)
**Método**: GET  
**Header**: `Accept: application/json`  
**Retorna**: Informações gerais da rune

```json
{
  "entry": {
    "block": 840000,
    "burned": 2348699167000,
    "divisibility": 5,
    "etching": "e79134080a83fe3e0e06ed6990c5a9b63b362313341745707a2bff7d788a1375",
    "mints": 0,
    "number": 3,
    "premine": 10000000000000000,
    "spaced_rune": "DOG•GO•TO•THE•MOON",
    "symbol": "🐕",
    "terms": null,
    "timestamp": 1713571767,
    "turbo": false
  },
  "id": "840000:3",
  "mintable": false,
  "parent": "e79134080a83fe3e0e06ed6990c5a9b63b362313341745707a2bff7d788a1375i0"
}
```

**Dados disponíveis:**
- ✅ Nome da rune
- ✅ Supply total (premine)
- ✅ Quantidade queimada (burned)
- ✅ Divisibilidade
- ✅ Símbolo
- ✅ Bloco de criação
- ✅ Transaction de etching

### 2. **GET /runes**
**Método**: GET  
**Header**: `Accept: application/json`  
**Retorna**: Lista paginada de todas as runes

```json
{
  "entries": [[runeId, runeData], ...],
  "more": true,
  "prev": null,
  "next": 1
}
```

**Uso**: Lista todas as runes com paginação. Útil para navegação, mas não específico para DOG.

### 3. **GET /tx/{txid}**
**Método**: GET  
**Header**: `Accept: application/json`  
**Retorna**: Dados da transação incluindo informações de rune (se houver etching)

```json
{
  "chain": "mainnet",
  "etching": "DOG•GO•TO•THE•MOON",
  "inscription_count": 1,
  "transaction": {
    "version": 2,
    "lock_time": 0,
    "input": [...],
    "output": [...]
  },
  "txid": "e79134080a83fe3e0e06ed6990c5a9b63b362313341745707a2bff7d788a1375"
}
```

**Limitação**: Apenas mostra "etching" na transação de criação. **NÃO mostra transferências de runes**.

### 4. **GET /output/{txid}:{vout}**
**Método**: GET  
**Header**: `Accept: application/json`  
**Retorna**: Informações de um output específico (UTXO)

```json
{
  "address": "bc1p...",
  "confirmations": 79363,
  "indexed": false,
  "inscriptions": [],
  "outpoint": "txid:vout",
  "runes": {},  // ⚠️ Vazio se o UTXO já foi gasto
  "sat_ranges": null,
  "script_pubkey": "...",
  "spent": true,
  "transaction": "...",
  "value": 10000
}
```

**Limitação crítica**: O campo `runes` aparece **vazio** em UTXOs já gastos (`spent: true`). Isso significa que não conseguimos rastrear o histórico de transferências de runes passadas.

### 5. **GET /status**
**Método**: GET  
**Retorna**: Status do índice do Ord

```json
{
  "height": 918761,
  "runes": 207986,
  "inscriptions": 19085050,
  ...
}
```

**Uso**: Verificar se o índice está atualizado.

## ❌ Endpoints NÃO Disponíveis

Testamos os seguintes endpoints que **NÃO existem** ou não retornam dados:

- ❌ `/rune/{name}/balances` - Não existe
- ❌ `/rune/{name}/holders` - Não existe
- ❌ `/rune/{name}/transactions` - Não existe
- ❌ `/address/{address}` - Não retorna JSON
- ❌ `/r/rune/{name}` - Não existe

## 🚨 Limitações Críticas para Nosso Projeto

### 1. **Sem API de Holders**
- A API do Ord **NÃO fornece** uma lista de holders (endereços) e seus saldos
- Precisaríamos varrer todos os outputs não gastos de todas as transações para construir essa lista manualmente

### 2. **Sem Histórico de Transferências**
- A API **NÃO retorna** dados de runes em UTXOs já gastos
- Não conseguimos rastrear transações passadas de DOG
- Só conseguimos ver runes em UTXOs ativos (não gastos)

### 3. **Sem Lista de Transações por Rune**
- A API **NÃO tem** endpoint para listar todas as transações de uma rune específica
- Precisaríamos varrer todos os blocos manualmente

### 4. **Sem Ranking de Holders**
- Como não temos lista de holders, não conseguimos calcular o ranking diretamente da API

## 📊 Comparação: API do Ord vs. Nossos Scripts Python

| Funcionalidade | API do Ord | Scripts Python | Vencedor |
|----------------|-----------|----------------|----------|
| **Lista de Holders** | ❌ Não disponível | ✅ `dog_holders_by_address.json` | 🐍 Python |
| **Ranking de Holders** | ❌ Não disponível | ✅ Calculado no backend | 🐍 Python |
| **Histórico de Transações** | ❌ Só transações ativas | ✅ `dog_transactions.json` | 🐍 Python |
| **Identificar Novos Holders** | ❌ Impossível | ✅ Lógica no backend | 🐍 Python |
| **Rastrear Senders** | ❌ Impossível (UTXOs gastos) | ✅ `all_inputs` com `has_dog` | 🐍 Python |
| **Performance** | ✅ Rápido (servidor dedicado) | ⚠️ Lento (processa blocos) | 🌐 Ord |
| **Atualização em tempo real** | ✅ Sempre atualizado | ⚠️ Precisa rodar scripts | 🌐 Ord |
| **Consumo de recursos** | ✅ Baixo (só queries) | ❌ Alto (CPU + RAM) | 🌐 Ord |
| **Dados gerais da rune** | ✅ Completo | ✅ Completo | 🤝 Empate |

## 🎯 Conclusão

### ⚠️ A API do Ord **NÃO É SUFICIENTE** para substituir nossos scripts Python

**Razões:**
1. Não fornece lista de holders
2. Não rastreia histórico de transferências (só UTXOs ativos)
3. Não tem endpoint de transações por rune
4. Não consegue identificar senders (UTXOs gastos retornam `runes: {}`)

### 💡 Alternativas Possíveis

#### Opção 1: **Híbrido - Usar API do Ord + Scripts Python** (RECOMENDADO)
- **Ord API**: Dados gerais da rune (supply, burned, etc.)
- **Scripts Python**: Holders, transações, ranking
- **Vantagem**: Reduz carga nos scripts (não precisa buscar metadados da rune)
- **Desvantagem**: Ainda precisa rodar os scripts pesados

#### Opção 2: **Servidor Dedicado**
- Mover os scripts Python para um servidor na nuvem (AWS, DigitalOcean, etc.)
- Deixar o PC local apenas para frontend
- **Vantagem**: PC não fica sobrecarregado
- **Desvantagem**: Custo mensal do servidor

#### Opção 3: **Otimizar Scripts Python**
- Processar apenas blocos novos (incremental)
- Usar cache mais agressivo
- Reduzir intervalo de atualização
- **Vantagem**: Sem custos adicionais
- **Desvantagem**: Ainda consome recursos locais

#### Opção 4: **API Externa (UniSat, OKX, etc.)**
- Usar APIs de terceiros que já processam dados de runes
- **Vantagem**: Zero processamento local
- **Desvantagem**: 
  - Dependência de terceiros
  - Possíveis custos
  - Rate limits
  - Pode não ter todos os dados que precisamos

## 🔍 Próximos Passos Sugeridos

1. **Testar APIs externas** (UniSat, OKX, Ordinals.com) para ver se têm:
   - Lista de holders do DOG
   - Histórico completo de transações
   - Ranking atualizado
   
2. **Avaliar custo-benefício** de um servidor dedicado:
   - VPS com 8GB RAM: ~$20-40/mês
   - Deixar rodando 24/7 sem sobrecarregar PC

3. **Otimizar scripts atuais** como solução temporária:
   - Processar apenas blocos novos
   - Cachear resultados por mais tempo
   - Rodar em horários de menor uso

## 📝 Notas Técnicas

- **Endpoint base**: `http://localhost:8080`
- **Header obrigatório para JSON**: `Accept: application/json`
- **URL encoding necessário**: `DOG•GO•TO•THE•MOON` → `DOG%E2%80%A2GO%E2%80%A2TO%E2%80%A2THE%E2%80%A2MOON`
- **Tamanho do índice completo**: ~177GB
- **Localização do índice**: `/home/bitmax/Projects/bitcoin-fullstack/ord/data/index.redb`


