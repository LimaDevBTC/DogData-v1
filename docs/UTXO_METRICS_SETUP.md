# 📊 UTXO Metrics - Setup e Uso

## ✅ Status Atual

- ✅ Script `update_utxo_metrics.py` criado e funcionando
- ✅ Primeiro ponto de dados registrado: 260,207 UTXOs em 2026-01-07
- ✅ API `/api/metrics/utxo-count-history` funcionando
- ✅ Página `/metrics` exibindo dados

## 🔄 Como Usar

### Rodar Manualmente

O script de métricas UTXO está **integrado** no script principal:

```bash
cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1
python3 scripts/update_holders_and_fees.py
```

O script principal atualiza automaticamente:
1. Holders
2. Fees
3. **Métricas UTXO** (histórico diário)

### Automatizar (Cron)

```bash
# Editar crontab
crontab -e

# Adicionar linha (roda todo dia às 2h da manhã)
0 2 * * * cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1 && python3 scripts/update_holders_and_fees.py >> logs/update.log 2>&1
```

**Nota:** Não é mais necessário rodar scripts separados - tudo é feito em um único comando!

## 📁 Estrutura de Dados

### Arquivo: `data/utxo_count_history.json`

```json
{
  "history": [
    {
      "date": "2026-01-07",
      "total_utxos": 260207
    }
  ],
  "last_updated": "2026-01-07T12:08:41.479705",
  "total_points": 1
}
```

### Formato de Cada Entrada

- `date`: Data no formato YYYY-MM-DD
- `total_utxos`: Número total de UTXOs naquela data

## 📊 Visualização

A página `/metrics` já está configurada para exibir:
- Histórico de UTXO count (quando houver dados suficientes)
- Gráfico de tendência temporal
- Comparação entre períodos (24h, 7d, 30d, 90d, all)

## 🎯 Próximos Passos

1. **Acumular dados históricos** (rodar script diariamente)
2. **Implementar gráficos** (Recharts ou Chart.js)
3. **Criar script de UTXO age** (`analyze_utxo_age.py`)
4. **Expandir métricas avançadas** (STH/LTH, HODL Waves, etc.)

## 📈 Dados Esperados

Após algumas semanas rodando diariamente:
- ✅ Tendência de crescimento/declínio de UTXOs
- ✅ Correlação com eventos de mercado
- ✅ Análise de fragmentação de UTXOs
- ✅ Base para indicadores avançados

---

**Última atualização:** 2026-01-07  
**Status:** ✅ Funcionando

