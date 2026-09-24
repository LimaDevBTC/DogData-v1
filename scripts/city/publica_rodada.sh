#!/bin/bash
# Publica a rodada do palco (masterplan §42). ⚠️ ESTE É O DEPLOY: o que ele copia para
# a árvore o bot empurra para produção na próxima hora cheia. Só roda se o portão do
# palco disse APROVADO e o merkle do palco existe.
set -e
cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1
PALCO=${PALCO:-/home/bitmax/Projects/bitcoin-fullstack/dogcity-palco}
grep -q "^APROVADO" $PALCO/log/5_portao.log || { echo "o portão do palco não aprovou; nada publicado"; exit 1; }
[ -s $PALCO/data/dogcity_merkle.json ] || { echo "falta o merkle do palco; nada publicado"; exit 1; }
C=$PALCO/public/city
for f in cidade.json cidade-malha.json cidade-lotes.bin cidade-lotes-v4.bin cidade-cotas.bin \
         escrituras.bin escrituras.json; do
  [ -f $C/$f ] && cp -v $C/$f public/city/$f
done
[ -f $C/mapa/vias.json ] && cp -v $C/mapa/vias.json public/city/mapa/vias.json
for f in $PALCO/data/dogcity_*.csv $PALCO/data/dogcity_*.json $PALCO/data/dogcity_merkle_folhas.txt \
         $PALCO/data/superficie.f32 $PALCO/data/superficie.json $PALCO/data/superficie_lotes.csv; do
  [ -f "$f" ] && cp -v "$f" data/
done
cp -v $PALCO/app/dogcity/dogcity-data.ts app/dogcity/dogcity-data.ts
# ⚠️ a carta muda de NOME (v3 -> v4): o CDN serve a imagem velha pelo nome velho
if [ -f $PALCO/landing/citymap-1600-v4.webp ]; then
  cp -v $PALCO/landing/citymap-1600-v4.webp $PALCO/landing/citymap-3200-v4.png public/landing/
  cp -v $PALCO/carta.svg public/city/carta.svg
  sed -i 's/citymap-1600-v3\.webp/citymap-1600-v4.webp/g' app/dogcity/sections/map-full.tsx app/dogcity/sections/city-map.tsx
  echo "landing aponta para citymap-1600-v4.webp"
fi
echo
echo "publicado na árvore; o bot empurra na próxima hora cheia."
echo "root: $(python3 -c "import json;print(json.load(open('data/dogcity_merkle.json'))['root'])")"
echo "falta: python3 scripts/city/sobe_lookup.py  (escrita em produção do lookup, fundador)"
