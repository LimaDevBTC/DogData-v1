# 📜 Scripts DOG DATA

## ✅ Script Principal

### `update_holders_and_fees.py` ⭐ ÚNICO SCRIPT NECESSÁRIO
**Função:** Atualização completa de todos os dados

**O que faz:**
1. **Holders:** Extrai lista completa via Ord indexer
2. **Fees:** Calcula fees de transações via Bitcoin Core RPC
3. **Métricas UTXO:** Atualiza histórico diário de UTXO count

**Uso:**
```bash
python3 scripts/update_holders_and_fees.py
```

**Quando rodar:** Diariamente ou após atualizações importantes

**Dependências:**
- Bitcoin Core rodando
- Ord indexer configurado
- Variáveis de ambiente: `UPSTASH_KV_REST_API_URL`, `UPSTASH_KV_REST_API_TOKEN`

**Arquivos gerados:**
- `data/dog_holders.json`
- `data/dog_holders_by_address.json`
- `public/data/dog_holders.json` (cópia para Vercel)
- `public/data/dog_holders_by_address.json` (cópia para Vercel)
- `data/utxo_count_history.json`

---

## 📁 Scripts Arquivados

Scripts obsoletos ou não utilizados foram movidos para `scripts/archived/`:
- Scripts antigos de monitoramento
- Extractors de airdrop (já concluído)
- Scripts de teste e desenvolvimento
- Scripts duplicados ou substituídos

---

## 🔄 Workflow Recomendado

```bash
# 1. Verificar serviços
./manage_services.sh status

# 2. Atualizar tudo (holders, fees e métricas)
python3 scripts/update_holders_and_fees.py

# 3. Commit (se necessário)
git add .
git commit -m "Update data"
git push
```

---

## ⚙️ Automação (Cron)

```bash
# Editar crontab
crontab -e

# Adicionar (roda diariamente às 2h)
0 2 * * * cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1 && python3 scripts/update_holders_and_fees.py >> logs/update.log 2>&1
```

---

**Última atualização:** 2026-01-07

