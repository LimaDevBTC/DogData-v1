#!/usr/bin/env python3
"""
O GERADOR DA DOGCITY. Implementa o capítulo 6 do plano-diretor.md.

Estrutura, de fora para dentro:
  disco -> 12 setores de 30 graus, cada um com malha própria girada k x 7,5 graus
        -> quartos de 540 m (3 x 3 células de 180 m; a do meio é praça, 8 viram quarteirão)
        -> quarteirão de 168 x 168 m
        -> 84 lotes de 300 m² (14 colunas x 6 fileiras de 12 x 25 m)

Endereço: S{setor}-Q{quarto}-B{quarteirão}-L{lote}.

⚠️ A CHAVE DE ORDENAÇÃO. O plano diretor pede (altura de bloco, txindex, vout,
endereço) e diz que o CSV não tem os três primeiros. Medi e achei um substituto
que já está em casa: `(ts, txid, vout)` do UTXO mais antigo, de
data/dog_utxos_by_address.json, dá ZERO colisões em 52.996 carteiras.
Ele é melhor que desempate por endereço por segurança: endereço é grindável, dá
para gerar endereços até sair um que ordena cedo; txid e vout são escolhidos por
quem ENVIA, nunca por quem recebe.
Ressalva honesta: `ts` é o carimbo do bloco, e carimbo de bloco no Bitcoin NÃO é
estritamente crescente (a regra é ser maior que a mediana dos 11 anteriores).
Então um punhado de carteiras em blocos adjacentes pode sair fora da ordem real
da cadeia. Trocar `ts` por altura de bloco é refinamento posterior e mexe em
pouca posição.
"""
import csv, json, math, struct, sys, os, collections

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def p(*a): return os.path.join(RAIZ, *a)

# ── o tabuleiro (plano-diretor.md cap. 6.3) ────────────────────────────────
R_SITIO      = 3500
R_INICIO     = 1300      # nada começa antes do fim da rampa do platô
SETORES      = 12
GIRO_SETOR   = 7.5       # graus por setor; 12 x 7,5 = 90, e a malha quadrada fecha
BULEVAR      = 34.0      # largura do bulevar radial sobre cada costura
CELULA       = 180.0     # passo da malha
QUARTEIRAO   = 168.0     # e 12 m de via entre quarteirões
QUARTO       = 3         # 3 x 3 células; a do meio é a praça do quarto
LOTE_COLS, LOTE_ROWS = 14, 6      # 84 lotes
LOTE_W, LOTE_D = 12.0, 25.0       # 300 m²
DECLIVE_MAX  = 4.0       # correção do júri: o tecido não cabe em 3 graus

PLATO_R, PLATO_FUNDE = 960, 1300
PARQUE_RUMO, PARQUE_DIST, PARQUE_DISCO = 43.0, 5200.0, 3600.0
# ⚠️ O SPACEPORT SAIU DO SÍTIO em 28/08/2026 e por isso NÃO É MAIS MÁSCARA.
# Ele estava em (-140, 3090), raio 3.093 m, e foi para o raio 4.400 porque
# foguete não atravessa a abóbada (SPACEPORT_SHIFT em app/city/plaza/orbit-layer.ts).
# Isso DEVOLVE 845 x 599 m, meio quilômetro quadrado, para dentro do loteamento.
# Fica registrado aqui em vez de apagado, para ninguém "consertar" de volta.
SPACEPORT_APOSENTADO = (-140.0, 3090.0, 845.0, 599.0)

# O coliseu da batalha: elipse GIRADA, não retângulo. O plano diretor reservava
# 760 x 364 alinhado aos eixos, e a peça de verdade é um hipódromo de meio-eixos
# 372 x 217 girado 225 graus, igual ao campo (app/city/plaza/coliseu.ts). Aqui
# ele entra com 40 m de folga de acesso em volta: 412 x 257.
# ⚠️ O COLISEU NÃO ESTÁ CONSTRUÍDO, e a reserva existe justamente por isso: o
# fundador congelou a obra e mandou guardar o lugar. Lote plantado aqui teria de
# ser desfeito depois, e lote atribuído não se desfaz.
COLISEU_CX, COLISEU_CZ = -2120.0, 2120.0
COLISEU_A, COLISEU_B = 412.0, 257.0
COLISEU_ROT = 5 * math.pi / 4

# ⚠️ O LOTE PARA NA ABÓBADA, NÃO NA BORDA DO SÍTIO. A casca de colmeia fecha em
# 3.500 e a saia desce ali até o chão. Lote além disso ficaria FORA da cidade
# pressurizada. 3.480 deixa a
# calçada de serviço no pé da saia.
R_ABOBADA = 3480
DSC_RUMO  = 68.7

# ── relevo ─────────────────────────────────────────────────────────────────
meta = json.load(open(p('public/lunar/btc-core-heightmap.json')))
n, cell = meta['cols'], meta['cellSizeM']
half = (n - 1) / 2
with open(p('public/lunar/btc-core-heightmap.f32'), 'rb') as f:
    alt = list(struct.unpack(f'<{n*n}f', f.read(n*n*4)))
H = lambda i, j: alt[min(n-1, max(0, j))*n + min(n-1, max(0, i))]

def crua(x, z):
    fi = min(n-1.001, max(0, x/cell+half)); fj = min(n-1.001, max(0, z/cell+half))
    i, j = int(fi), int(fj); u, v = fi-i, fj-j
    return H(i,j)*(1-u)*(1-v) + H(i+1,j)*u*(1-v) + H(i,j+1)*(1-u)*v + H(i+1,j+1)*u*v

def altura(x, z):
    b = crua(x, z); r = math.hypot(x, z)
    if r >= PLATO_FUNDE: return b
    if r <= PLATO_R: return 0.0
    t = (r-PLATO_R)/(PLATO_FUNDE-PLATO_R)
    return b*(t*t*(3-2*t))

grade = [0.0]*(n*n)
for j in range(n):
    for i in range(n):
        x, z = (i-half)*cell, (j-half)*cell
        hx = (altura(x+cell,z)-altura(x-cell,z))/(2*cell)
        hz = (altura(x,z+cell)-altura(x,z-cell))/(2*cell)
        grade[j*n+i] = math.degrees(math.atan(math.hypot(hx,hz)))

def declive(x, z):
    fi = min(n-1.001, max(0, x/cell+half)); fj = min(n-1.001, max(0, z/cell+half))
    i, j = int(fi), int(fj); u, v = fi-i, fj-j
    G = lambda a,b: grade[min(n-1,b)*n+min(n-1,a)]
    return G(i,j)*(1-u)*(1-v)+G(i+1,j)*u*(1-v)+G(i,j+1)*(1-u)*v+G(i+1,j+1)*u*v

prad = math.radians(PARQUE_RUMO)
PCX, PCZ = math.sin(prad)*PARQUE_DIST, -math.cos(prad)*PARQUE_DIST

def rumo_de(x, z):
    return math.degrees(math.atan2(x, -z)) % 360

def dentro_do_coliseu(x, z):
    """A elipse do hipódromo, no quadro girado dele."""
    dx, dz = x - COLISEU_CX, z - COLISEU_CZ
    c, sn = math.cos(COLISEU_ROT), math.sin(COLISEU_ROT)
    lx = dx*c - dz*sn
    lz = dx*sn + dz*c
    return (lx/COLISEU_A)**2 + (lz/COLISEU_B)**2 <= 1.0

def livre(x, z):
    r = math.hypot(x, z)
    if r < R_INICIO or r > R_ABOBADA: return False
    if math.hypot(x-PCX, z-PCZ) < PARQUE_DISCO: return False
    if dentro_do_coliseu(x, z): return False
    # o bulevar de 34 m sobre cada costura de setor é via, não lote
    ru = rumo_de(x, z)
    for s in range(SETORES):
        costura = s * (360/SETORES)
        dang = abs(((ru - costura + 180) % 360) - 180)
        if math.radians(dang) * r < BULEVAR/2: return False
    return declive(x, z) <= DECLIVE_MAX

def setor_de(x, z):
    return int(rumo_de(x, z) // (360/SETORES))

# ── o tecido: quartos, quarteirões, lotes, por setor ───────────────────────
def tecido():
    """Devolve por setor a lista de quarteirões, cada um com os seus 84 lotes."""
    por_setor = [[] for _ in range(SETORES)]
    passo_q = CELULA * QUARTO                       # 540 m
    alcance = int(R_SITIO / passo_q) + 2
    for s in range(SETORES):
        ang = math.radians(s * GIRO_SETOR)
        ca, sa = math.cos(ang), math.sin(ang)
        vistos = set()
        for qz in range(-alcance, alcance+1):
            for qx in range(-alcance, alcance+1):
                # centro do quarto no referencial girado do setor
                lx, lz = (qx+0.5)*passo_q, (qz+0.5)*passo_q
                wx, wz = lx*ca - lz*sa, lx*sa + lz*ca
                if math.hypot(wx, wz) > R_SITIO + passo_q: continue
                quarteiroes = []
                for cz in range(QUARTO):
                    for cx in range(QUARTO):
                        if cx == 1 and cz == 1: continue      # a praça do quarto
                        blx = lx + (cx-1)*CELULA
                        blz = lz + (cz-1)*CELULA
                        bwx, bwz = blx*ca - blz*sa, blx*sa + blz*ca
                        if setor_de(bwx, bwz) != s: continue
                        lotes = []
                        for ry in range(LOTE_ROWS):
                            for rx in range(LOTE_COLS):
                                ox = (rx - (LOTE_COLS-1)/2) * LOTE_W
                                oz = (ry - (LOTE_ROWS-1)/2) * LOTE_D * 1.12
                                px_, pz_ = blx+ox, blz+oz
                                fx, fz = px_*ca - pz_*sa, px_*sa + pz_*ca
                                if not livre(fx, fz): continue
                                if setor_de(fx, fz) != s: continue
                                lotes.append((fx, fz))
                        if len(lotes) >= 20:      # quarteirão de borda vale, se sobrar meia quadra
                            quarteiroes.append({'x': bwx, 'z': bwz, 'lotes': lotes,
                                                'r': math.hypot(bwx, bwz)})
                if quarteiroes:
                    ch = (round(wx), round(wz))
                    if ch in vistos: continue
                    vistos.add(ch)
                    por_setor[s].append({'x': wx, 'z': wz, 'r': math.hypot(wx, wz),
                                         'quarteiroes': quarteiroes})
    return por_setor

print('medindo o tecido...', file=sys.stderr)
T = tecido()
cap = [sum(len(b['lotes']) for q in T[s] for b in q['quarteiroes']) for s in range(SETORES)]
for s in range(SETORES):
    print(f'  setor {s+1:2d} (rumo {s*30:3d}): {len(T[s]):3d} quartos, '
          f'{sum(len(q["quarteiroes"]) for q in T[s]):4d} quarteirões, {cap[s]:6,d} lotes',
          file=sys.stderr)
CAP = sum(cap)
print(f'CAPACIDADE TOTAL: {CAP:,} lotes', file=sys.stderr)

# ── as carteiras, na ordem de chegada de verdade ───────────────────────────
elig = {}
with open(p('data/holders_by_age.csv'), newline='') as f:
    for row in csv.DictReader(f):
        try: dog = float(row['total_dog'])
        except (ValueError, KeyError): continue
        if dog >= 20000: elig[row['address']] = dog
U = json.load(open(p('data/dog_utxos_by_address.json')))
carteiras = []
for a in elig:
    lst = U.get(a) or []
    if not lst: continue
    v = min(lst, key=lambda x: (x['ts'], x['txid'], x['vout']))
    carteiras.append((v['ts'], v['txid'], v['vout'], a))
carteiras.sort()
N = len(carteiras)
print(f'carteiras ordenadas: {N:,} | chaves distintas: {len({c[:3] for c in carteiras}):,}',
      file=sys.stderr)

# ── as camadas ─────────────────────────────────────────────────────────────
# ⚠️ OS DADOS MORAM NO REPO, NÃO NUM SCRATCHPAD. A primeira versão lia de $S
# com queda para /tmp, e os dois arquivos ficaram no scratchpad de uma sessão
# que morreu: rodar o gerador de novo deu "genealogia ausente" e a cidade saiu
# sem os 185 enclaves de família e sem o condomínio do DSC, calada. Reboot da
# máquina teria levado a genealogia inteira. O $S continua valendo como
# atalho de quem está iterando, mas o padrão é data/.
def entrada(nome, legado):
    aqui = p('data', nome)
    if os.path.exists(aqui): return aqui
    return os.path.join(os.environ.get('S', '/tmp'), legado)

SCR = os.environ.get('S', '/tmp')
familia_de, familias_grandes = {}, {}
try:
    g = json.load(open(entrada('dogcity_genealogia.json', 'genealogia_tudo.json')))
    pai = dict(zip(g['w'], g['p'])); prof = dict(zip(g['w'], g['d']))
    def anc1(x):
        cur, gd = x, 0
        while cur is not None and gd < 60:
            pr = prof.get(cur)
            if pr is None or pr < 1: return None
            if pr == 1: return cur
            cur = pai.get(cur); gd += 1
        return None
    bruto = {}
    for _, _, _, a in carteiras:
        an = anc1(a)
        if an: bruto.setdefault(an, []).append(a)
    # ⚠️ SÓ FAMÍLIA DE 10 OU MAIS VIRA ENCLAVE. Medido: 91,7% das 32.763 famílias
    # têm uma carteira só, então marcar todas seria marcar ninguém.
    fid = 0
    for an, membros in sorted(bruto.items(), key=lambda kv: -len(kv[1])):
        if len(membros) < 10: continue
        fid += 1
        familias_grandes[fid] = {'ancestral': an, 'membros': len(membros)}
        for m in membros: familia_de[m] = fid
    print(f'enclaves de família (10 ou mais): {fid} cobrindo {len(familia_de):,} carteiras',
          file=sys.stderr)
except FileNotFoundError:
    print('genealogia ausente, seguindo sem enclaves', file=sys.stderr)

dsc = set()
try:
    dd = json.load(open(entrada('dogcity_dsc_donos.json', 'dsc_donos.json')))
    dsc = {a for _, a in dd['pares'] if a and a in elig}
    print(f'carteiras DSC que passam no portão: {len(dsc)}', file=sys.stderr)
except FileNotFoundError:
    print('DSC ausente', file=sys.stderr)

# ── a ordem de passo dentro do setor (plano-diretor 6.4 passo 5) ───────────
def ordem_de_passo(s):
    passo = []
    for q in sorted(T[s], key=lambda q: q['r']):
        for b in sorted(q['quarteiroes'], key=lambda b: b['r']):
            ls = sorted(b['lotes'], key=lambda L: (math.hypot(L[0], L[1]),
                                                   rumo_de(L[0], L[1])))
            for L in ls: passo.append(L)
    return passo
PASSO = [ordem_de_passo(s) for s in range(SETORES)]

# ── o condomínio do DSC: os lotes mais internos do setor do rumo 68,7 ──────
S_DSC = int(DSC_RUMO // (360/SETORES))
reserva_dsc = PASSO[S_DSC][:len(dsc)]
livres_dsc = set(range(len(dsc)))
print(f'condomínio DSC no setor {S_DSC+1} (rumo {S_DSC*30}), '
      f'{len(reserva_dsc)} lotes mais internos', file=sys.stderr)

# ── cota por setor e rodízio de maior déficit ──────────────────────────────
gerais = [c for c in carteiras if c[3] not in dsc]
NG = len(gerais)
capg = list(cap); capg[S_DSC] -= len(dsc)
SC = sum(capg)
cota = [NG * capg[s] / SC for s in range(SETORES)]
conta = [0]*SETORES
destino = []
for c in gerais:
    melhor, mdef = -1, -1e18
    for s in range(SETORES):
        if conta[s] >= capg[s]: continue
        defi = cota[s] - conta[s]
        if defi > mdef + 1e-12: mdef, melhor = defi, s
    if melhor < 0: melhor = max(range(SETORES), key=lambda s: capg[s]-conta[s])
    conta[melhor] += 1
    destino.append(melhor)

# ── planta ─────────────────────────────────────────────────────────────────
cursor = [0]*SETORES
cursor[S_DSC] = len(dsc)          # o condomínio já ocupa os mais internos
saida = []
for c, s in zip(gerais, destino):
    idx = cursor[s]
    if idx >= len(PASSO[s]): continue
    x, z = PASSO[s][idx]; cursor[s] += 1
    saida.append((x, z, s, c[3]))
for k, a in enumerate(sorted(dsc)):
    if k >= len(reserva_dsc): break
    x, z = reserva_dsc[k]
    saida.append((x, z, S_DSC, a))
print(f'plantadas {len(saida):,} de {N:,}', file=sys.stderr)

# ── grava ──────────────────────────────────────────────────────────────────
posto = {c[3]: i for i, c in enumerate(carteiras)}
buf = bytearray()
for x, z, s, a in saida:
    coorte = min(7, posto[a]*8//N)
    fam = familia_de.get(a, 0)
    fl = 1 if a in dsc else 0
    buf += struct.pack('<hhBBHB', int(round(x)), int(round(z)), s, coorte,
                       min(65535, fam), fl)
open(p('public/city/cidade-lotes.bin'), 'wb').write(buf)
json.dump({
    'esquema': 'int16 x, int16 z, uint8 setor, uint8 coorte, uint16 familia, uint8 flags(bit0=DSC)',
    'chave': '(ts, txid, vout) do UTXO mais antigo; zero colisoes',
    'setores': SETORES, 'giroPorSetor': GIRO_SETOR, 'bulevar_m': BULEVAR,
    'celula_m': CELULA, 'quarteirao_m': QUARTEIRAO, 'lote_m2': LOTE_W*LOTE_D,
    'declive_max': DECLIVE_MAX, 'raioInicio': R_INICIO, 'raioSitio': R_SITIO,
    'capacidade': CAP, 'capacidadePorSetor': cap,
    'carteiras': N, 'plantadas': len(saida),
    'enclaves': len(familias_grandes), 'carteirasEmEnclave': len(familia_de),
    'dsc': len(dsc), 'setorDSC': S_DSC+1,
    'quartos': sum(len(T[s]) for s in range(SETORES)),
    'quarteiroes': sum(len(q['quarteiroes']) for s in range(SETORES) for q in T[s]),
}, open(p('public/city/cidade.json'), 'w'), indent=1)
print('gravado public/city/cidade.{json} + cidade-lotes.bin', file=sys.stderr)
