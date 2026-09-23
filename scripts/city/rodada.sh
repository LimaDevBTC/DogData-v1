#!/bin/bash
# Rodada de selagem da DogCity (masterplan §31 + §36): assar → gerar → vias → assar pontos → portão → merkle → escrituras → lookup dry-run → vias.json.
# Para no primeiro erro. Logs em scripts/city/rodada.log/. NUNCA roda sobe_lookup sem --dry-run (a escrita em produção é do fundador).
# Antes de rodar: dev server em :3000 e nenhum agente editando app/city/plaza/* (a superfície assada carrega a digital dos módulos).
set -o pipefail
cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1 || exit 1
L=scripts/city/rodada.log
mkdir -p $L
passo() { # nome, comando...
  local n=$1; shift
  echo "== $n  $(date +%H:%M:%S)" | tee -a $L/resumo.txt
  "$@" > $L/$n.log 2>&1
  local rc=$?
  echo "   rc=$rc  $(date +%H:%M:%S)  $(tail -1 $L/$n.log | cut -c1-160)" | tee -a $L/resumo.txt
  if [ $rc -ne 0 ]; then echo "PAROU em $n" | tee -a $L/resumo.txt; tail -25 $L/$n.log; exit $rc; fi
}
: > $L/resumo.txt
passo 1_assar        node scripts/city/assar_superficie.mjs
passo 2_gerar        python3 scripts/gerar_cidade.py
passo 3_vias         node scripts/city/vias-varredura.mjs --cel=6 --dilata=1
passo 4_assar_pontos node scripts/city/assar_superficie.mjs --pontos=data/dogcity_lotes.csv
passo 5_portao       python3 scripts/city/conferir_lotes.py
grep -q "^APROVADO" $L/5_portao.log || { echo "PORTÃO NÃO APROVOU" | tee -a $L/resumo.txt; grep -E "FALHA|REPROV" $L/5_portao.log | head; exit 2; }
passo 6_merkle       python3 scripts/city/merkle.py
passo 7_escrituras   node scripts/city/gerar_escrituras.mjs
passo 8_lookup_dry   python3 scripts/city/sobe_lookup.py --dry-run
passo 9_vias_json    node scripts/city/mapa/assar-vias.mjs
echo "RODADA 5 COMPLETA $(date +%H:%M:%S)" | tee -a $L/resumo.txt
grep -E "root|lotes|lapides" data/dogcity_merkle.json | head -4
