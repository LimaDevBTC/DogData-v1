#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════════
# O CONFERIDOR DE TERRENO: as duas pontas medem o mesmo chão?
#
# ⚠️ POR QUE ISTO EXISTE, e a resposta é um defeito que já aconteceu DUAS VEZES.
# O relevo da DogCity é descrito em dois lugares que não se importam: `terrain.ts`
# + `vex.ts` (o que a câmera desenha) e `scripts/gerar_cidade.py` (o que decide
# onde nasce lote, onde há água e onde o declive passa do limite). Enquanto as
# constantes forem COPIADAS de um lado para o outro, elas vão divergir em
# silêncio — e divergiram: primeiro na prancha `app/city/plan` (um `const VEX = 2`
# cravado, registrado no cabeçalho de vex.ts), depois no gerador, que ficou sem
# exagero nenhum e com o platô da praça no par velho (960/1.300 contra
# 1.470/1.830). Nos dois casos ninguém percebeu, e pelo mesmo motivo: os dois
# números eram plausíveis.
#
# Disciplina não resolve isso; medição resolve. Este script amostra as duas
# pontas no mesmo ponto e reprova quando elas se afastam.
#
# ⚠️ O QUE ELE COMPARA, E O QUE ELE NÃO COMPARA. A ponta da cena é
# `superficieAt`, que tem MAIS coisa que o gerador conhece: pódio da abóbada,
# vala dos canais, bacia do Lago da Praça, cova do parque, montes. O gerador
# guarda esses lugares por MÁSCARA (`em_canal`, `parque_alcance`, ...), não por
# cota. Então a conferência roda onde o lote de fato nasce e SEPARA o resíduo:
# a coluna "base" é a que tem de fechar; a coluna "com feição" é informativa.
#
#   1) node scripts/city/topo.mjs --n=1400 --raio=7200 --saida=/tmp/topo
#   2) python3 scripts/city/conferir_terreno.py --topo=/tmp/topo
# ═══════════════════════════════════════════════════════════════════════════
import json, math, struct, sys, os

arg = lambda k, d: next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith(f'--{k}=')), d)
TOPO = arg('topo', '/tmp/topo')
TOL = float(arg('tolerancia', '1.5'))          # metros
RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
p = lambda *a: os.path.join(RAIZ, *a)

meta = json.load(open(f'{TOPO}/topo.json'))
n2, raio, cel2 = meta['n'], meta['raio'], meta['celulaM']
H2 = struct.unpack(f'<{n2*n2}f', open(f'{TOPO}/topo.f32', 'rb').read())
def cena(x, z):
    i = int(round((x + raio) / cel2)); j = int(round((z + raio) / cel2))
    return H2[j * n2 + i] if 0 <= i < n2 and 0 <= j < n2 else None

# ── a ponta do gerador, reconstruída a partir das MESMAS constantes ────────
m = json.load(open(p('public/lunar/btc-core-heightmap.json')))
n, cell = m['cols'], m['cellSizeM']; half = (n - 1) / 2
alt = list(struct.unpack(f'<{n*n}f', open(p('public/lunar/btc-core-heightmap.f32'), 'rb').read(n*n*4)))
Hh = lambda i, j: alt[min(n-1, max(0, j))*n + min(n-1, max(0, i))]

G = {}
exec(compile('\n'.join(l for l in open(p('scripts/gerar_cidade.py'), encoding='utf-8').read().split('\n')
             if l.startswith(('VEX_', 'PLATO_R, PLATO_FUNDE', 'PODIO_'))), '<constantes>', 'exec'), G)
VEX_C, VEX_H = G['VEX_CIDADE'], G['VEX_HORIZONTE']
VEX_RC, VEX_RH = G['VEX_R_CIDADE'], G['VEX_R_HORIZONTE']
PLATO_R, PLATO_FUNDE = G['PLATO_R'], G['PLATO_FUNDE']
PY_, PR0, PR1 = G['PODIO_Y'], G['PODIO_R0'], G['PODIO_R1']
PR2, PR3, PR3P = G['PODIO_R2'], G['PODIO_R3'], G['PODIO_R3_PARQUE']
print(f'gerador: exagero {VEX_C} -> {VEX_H} entre r {VEX_RC:.0f} e {VEX_RH:.0f}; '
      f'plato {PLATO_R} -> {PLATO_FUNDE}; podio {PY_:.0f} m de {PR0:.0f} a {PR3:.0f}')

def ler_ts(caminho, chaves):
    txt = open(p(caminho), encoding='utf-8').read()
    import re
    out = {}
    for k in chaves:
        # ⚠️ O VALOR PODE VIR DENTRO DE UMA CHAMADA. `park-site.ts` escreve
        # `const BEARING = THREE.MathUtils.degToRad(43)`, e um regex que só aceita
        # número solto cairia no default em silêncio — que é a mesma doença que
        # este script existe para pegar.
        # ⚠️ O PREFIXO DA CHAMADA NÃO PODE ACEITAR DÍGITO. Com `[A-Za-z0-9_.]*`
        # o prefixo comia o próprio número (`4500` -> prefixo `450`, valor `0`) e
        # o script passou a ler zero em tudo, calado. O prefixo tem de começar por
        # letra e terminar em parêntese, ou não existir.
        mm = re.search(rf'{k}\s*=\s*(?:[A-Za-z_][A-Za-z0-9_.]*\()?\s*(-?[0-9.]+)', txt)
        if mm: out[k] = float(mm.group(1))
        else: print(f'  aviso: nao achei {k} em {caminho}')
    return out
ts = ler_ts('app/city/plaza/vex.ts', ['VEX_CIDADE', 'VEX_HORIZONTE', 'VEX_R_CIDADE', 'VEX_R_HORIZONTE'])
tt = ler_ts('app/city/plaza/terrain.ts', ['PLATO_R', 'PLATO_FIM'])
td = ler_ts('app/city/plaza/dome.ts', ['PODIO_Y', 'PODIO_R0', 'PODIO_R1', 'PODIO_R2', 'PODIO_R3', 'PODIO_R3_PARQUE'])
pk = ler_ts('app/city/plaza/park-site.ts', ['DIST', 'BEARING'])
print(f'cena:    exagero {ts.get("VEX_CIDADE")} -> {ts.get("VEX_HORIZONTE")} entre '
      f'r {ts.get("VEX_R_CIDADE"):.0f} e {ts.get("VEX_R_HORIZONTE"):.0f}; '
      f'plato {tt.get("PLATO_R"):.0f} -> {tt.get("PLATO_FIM"):.0f}')

falhas = []
for nome, a, b in [('VEX_CIDADE', VEX_C, ts.get('VEX_CIDADE')), ('VEX_HORIZONTE', VEX_H, ts.get('VEX_HORIZONTE')),
                   ('VEX_R_CIDADE', VEX_RC, ts.get('VEX_R_CIDADE')), ('VEX_R_HORIZONTE', VEX_RH, ts.get('VEX_R_HORIZONTE')),
                   ('PLATO_R', PLATO_R, tt.get('PLATO_R')), ('PLATO_FIM', PLATO_FUNDE, tt.get('PLATO_FIM')),
                   ('PODIO_Y', PY_, td.get('PODIO_Y')), ('PODIO_R0', PR0, td.get('PODIO_R0')),
                   ('PODIO_R1', PR1, td.get('PODIO_R1')), ('PODIO_R2', PR2, td.get('PODIO_R2')),
                   ('PODIO_R3', PR3, td.get('PODIO_R3')), ('PODIO_R3_PARQUE', PR3P, td.get('PODIO_R3_PARQUE'))]:
    if b is None or abs(a - b) > 1e-6: falhas.append(f'{nome}: gerador {a} contra cena {b}')

def exagero_em(r):
    if r <= VEX_RC: return VEX_C
    if r >= VEX_RH: return VEX_H
    t = (r - VEX_RC) / (VEX_RH - VEX_RC)
    return VEX_C + (VEX_H - VEX_C) * (t*t*(3-2*t))
PCX = math.sin(math.radians(pk.get('BEARING', 43))) * pk.get('DIST', 11800)
PCZ = -math.cos(math.radians(pk.get('BEARING', 43))) * pk.get('DIST', 11800)
def podio_peso(x, z):
    r = math.hypot(x, z)
    if r <= PR0: return 0.0
    nl = math.hypot(x, z) or 1
    cos = (x*PCX + z*PCZ) / (nl * math.hypot(PCX, PCZ))
    C1, C0 = math.cos(math.radians(42)), math.cos(math.radians(78))
    tq = min(1.0, max(0.0, (cos - C0) / (C1 - C0)))
    R3 = PR3 + (PR3P - PR3) * (tq*tq*(3-2*tq))
    if r >= R3: return 0.0
    if PR1 <= r <= PR2: return 1.0
    t = (r-PR0)/(PR1-PR0) if r < PR1 else (R3-r)/(R3-PR2)
    return t*t*(3-2*t)
def altura(x, z):
    fi = min(n-1.001, max(0, x/cell+half)); fj = min(n-1.001, max(0, z/cell+half))
    i, j = int(fi), int(fj); u, v = fi-i, fj-j
    b = (Hh(i,j)*(1-u)*(1-v) + Hh(i+1,j)*u*(1-v) + Hh(i,j+1)*(1-u)*v + Hh(i+1,j+1)*u*v) * exagero_em(math.hypot(x, z))
    r = math.hypot(x, z)
    if r < PLATO_FUNDE:
        b = 0.0 if r <= PLATO_R else b * ((lambda t: t*t*(3-2*t))((r - PLATO_R) / (PLATO_FUNDE - PLATO_R)))
    w = podio_peso(x, z)
    return b*(1.0-w) + PY_*w

# ── a amostra: onde o lote de fato nasce ──────────────────────────────────
FMT = '<hhBBHBBBH'; REG = struct.calcsize(FMT)
buf = open(p('public/city/cidade-lotes.bin'), 'rb').read()
difs = []
for k in range(0, len(buf)//REG, 3):
    x, z, *_ = struct.unpack_from(FMT, buf, k*REG)
    c = cena(x, z)
    if c is None: continue
    difs.append(abs(c - altura(x, z)))
difs.sort()
if difs:
    med = difs[len(difs)//2]; p90 = difs[int(len(difs)*.9)]; p99 = difs[int(len(difs)*.99)]
    print(f'\n{len(difs)} lotes amostrados, |cena - gerador|:')
    print(f'   mediana {med:.2f} m   p90 {p90:.2f} m   p99 {p99:.2f} m   max {difs[-1]:.2f} m')
    print(f'   acima de {TOL} m: {sum(1 for d in difs if d > TOL)} ({100*sum(1 for d in difs if d > TOL)/len(difs):.1f}%)')
    if med > TOL: falhas.append(f'mediana {med:.2f} m acima da tolerancia de {TOL} m')

if falhas:
    print('\nREPROVADO:'); [print('  - ' + f) for f in falhas]; sys.exit(1)
print('\nas duas pontas medem o mesmo chao (dentro da tolerancia).')
