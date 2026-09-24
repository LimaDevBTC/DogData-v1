#!/bin/bash
# Rodada de selagem da DogCity, NO PALCO (masterplan §31, §40, §42).
#
# ⚠️ NADA AQUI TOCA ARQUIVO RASTREADO. O bot de `cron` empurra a árvore inteira para
# produção de hora em hora, então a rodada inteira acontece fora dela: os dados em
# $PALCO/data e os arquivos da cena em public/city/_v4teste/ (gitignored), que a cena
# lê com `?reg=_v4teste`. Publicar é outro script, `publica_rodada.sh`, e só depois de
# o portão aprovar o palco.
set -o pipefail
cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1 || exit 1
REPO=$PWD
PALCO=${PALCO:-/home/bitmax/Projects/bitcoin-fullstack/dogcity-palco}
REG=_v4teste
L=$PALCO/log
mkdir -p $PALCO/data $PALCO/public $PALCO/app/dogcity $L public/city/$REG/mapa
# o gerador grava em $PALCO/public/city/..., que É public/city/_v4teste (servido pela cena)
[ -L $PALCO/public/city ] || ln -s $REPO/public/city/$REG $PALCO/public/city
: > $L/resumo.txt
log() { echo "$*  $(date +%H:%M:%S)" | tee -a $L/resumo.txt; }
passo() { # nome, comando...
  local n=$1; shift
  log "== $n"
  "$@" > $L/$n.log 2>&1
  local rc=$?
  log "   rc=$rc  $(tail -1 $L/$n.log | cut -c1-160)"
  [ $rc -eq 0 ] || { log "PAROU em $n (nada rastreado foi tocado)"; exit $rc; }
}
GERA="env SAIDA_DIR=$PALCO SUPERFICIE_DIR=$PALCO/data VIAS_MASCARA=$PALCO/public/city/mapa/vias.json python3 scripts/gerar_cidade.py"

# ⚠️ §40: DUAS PASSADAS DO GERADOR. A primeira põe canais e arteriais no lugar novo; o
# chão da cena (que cava o canal a partir da malha) só muda depois dela, e a impressão
# digital do chão vê módulo, não dado. Então: assa, gera, reassa, gera.
passo 1_assar        node scripts/city/assar_superficie.mjs --reg=$REG --saida=$PALCO/data
passo 2a_gerar       $GERA
passo 2b_reassar     node scripts/city/assar_superficie.mjs --reg=$REG --saida=$PALCO/data
passo 2c_gerar       $GERA
passo 2d_vias_json   env SUPERFICIE_DIR=$PALCO/data node scripts/city/mapa/assar-vias.mjs --reg=$REG --saida=$PALCO/public/city/mapa/vias.json
passo 3_vias         node scripts/city/vias-varredura.mjs --reg=$REG --cel=6 --dilata=1
passo 4_assar_pontos node scripts/city/assar_superficie.mjs --reg=$REG --saida=$PALCO/data \
                          --pontos=$PALCO/data/dogcity_lotes.csv
# a página muda junto com a cidade: a cópia do palco leva a razão entregue (§42: 1,000)
sed 's/^  mediana: "[0-9.]*",/  mediana: "1.000",/' app/dogcity/dogcity-data.ts \
    > $PALCO/app/dogcity/dogcity-data.ts
passo 5_portao       python3 scripts/city/conferir_lotes.py --cidade=$PALCO \
                          --superficie=$PALCO/data --vias=$PALCO/public/city/mapa/vias.json \
                          --entrega=$PALCO/app/dogcity/dogcity-data.ts
grep -q "^APROVADO" $L/5_portao.log || { log "REPROVADO: $(grep -E '^ *FALHA' $L/5_portao.log | cut -c1-110 | tr '\n' '|')"; exit 2; }
passo 6_merkle       python3 scripts/city/merkle.py --csv=$PALCO/data/dogcity_lotes.csv \
                          --cemiterio=$PALCO/data/dogcity_cemiterio.csv \
                          --bin=$PALCO/public/city/cidade-lotes-v4.bin \
                          --cidade-json=$PALCO/public/city/cidade.json --saida=$PALCO/data
passo 7_escrituras   node scripts/city/gerar_escrituras.mjs --csv=$PALCO/data/dogcity_lotes.csv \
                          --cemiterio=$PALCO/data/dogcity_cemiterio.csv \
                          --merkle=$PALCO/data/dogcity_merkle.json --saida=$PALCO/public/city
passo 8_lookup_dry   python3 scripts/city/sobe_lookup.py --dry-run --csv=$PALCO/data/dogcity_lotes.csv \
                          --cemiterio=$PALCO/data/dogcity_cemiterio.csv
log "PALCO APROVADO E SELADO. Publicar: bash scripts/city/publica_rodada.sh"
