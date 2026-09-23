#!/usr/bin/env python3
"""Converte o registro v3 (retângulo: x, z, frente, prof, giro) no contrato v4 (§41).

⚠️ FERRAMENTA DE TRANSIÇÃO, NÃO FONTE. Ela existe para os leitores (cena, mapa 2D,
carta, merkle, portão) migrarem para os 4 cantos ANTES de o gerador novo terminar a
rodada, contra dados reais. Todo lote sai com `geo = 3` (retângulo legado), que o
portão reprova de propósito: nada convertido por aqui pode ser selado.

Uso:
  python3 scripts/city/v4_de_v3.py [--csv=data/dogcity_lotes.csv] [--saida=DIR]
Grava em DIR (padrão: scratch/v4_teste) o CSV v4 e o cidade-lotes-v4.bin.
"""
import csv, math, os, struct, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
args = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
CSV = os.path.join(RAIZ, args.get('csv', 'data/dogcity_lotes.csv'))
SAIDA = args.get('saida', '/tmp/claude-1000/-home-bitmax-Projects-bitcoin-fullstack/'
                 '8c325219-1e13-44e6-9724-1b09f71f34c8/scratchpad/v4_teste')
os.makedirs(SAIDA, exist_ok=True)

FMT = '<8hBBHB'                     # §41: 4 cantos int16 em quartos de metro + 5 bytes
assert struct.calcsize(FMT) == 21

def cantos(x, z, w, d, giro):
    """o retângulo legado, com a MESMA conta de conferir_lotes.py `cantos()`"""
    ca, sa = math.cos(giro), math.sin(giro)
    return [(x + dx*ca - dz*sa, z + dx*sa + dz*ca)
            for dx, dz in ((-w/2, -d/2), (w/2, -d/2), (w/2, d/2), (-w/2, d/2))]

linhas = list(csv.DictReader(open(CSV, newline='')))
cab = list(linhas[0].keys()) + ['p0x_m', 'p0z_m', 'p1x_m', 'p1z_m',
                                'p2x_m', 'p2z_m', 'p3x_m', 'p3z_m', 'geo']
buf = bytearray()
with open(os.path.join(SAIDA, 'dogcity_lotes_v4.csv'), 'w', newline='') as f:
    wr = csv.DictWriter(f, fieldnames=cab)
    wr.writeheader()
    for r in linhas:
        c = cantos(float(r['x_m']), float(r['z_m']), float(r['frente_m']),
                   float(r['prof_m']), math.radians(float(r['giro_graus'])))
        for i, (px, pz) in enumerate(c):
            r[f'p{i}x_m'] = f'{px:.2f}'; r[f'p{i}z_m'] = f'{pz:.2f}'
        r['geo'] = '3'
        wr.writerow(r)
        fl = (1 if r['dsc'] == '1' else 0) | (int(r['forma']) & 7) << 1 | (3 << 4)
        buf += struct.pack(FMT, *[int(round(v * 4)) for p in c for v in p],
                           int(r['setor']) - 1, int(r['coorte']),
                           min(65535, int(r['familia'])), fl)
open(os.path.join(SAIDA, 'cidade-lotes-v4.bin'), 'wb').write(buf)
print(f'{len(linhas)} lotes -> {SAIDA} (CSV v4 + bin de {len(buf)} bytes, geo=3 em todos)')
