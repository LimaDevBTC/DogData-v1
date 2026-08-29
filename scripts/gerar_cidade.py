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
# ⚠️ O RAIO É UM NÚMERO SÓ, e ele tem teto de DADO, não de vontade: o heightmap
# em public/lunar/btc-core-heightmap.json tem 137 células de 59,2 m, ou seja
# meia-largura de 4.027 m. Acima disso o terreno acaba e é preciso regerar o
# recorte a partir do tile SLDEM2015. Override por ambiente para medir o preço
# de crescer sem editar o arquivo: R=4000 python3 scripts/gerar_cidade.py
R_SITIO      = float(os.environ.get('R', 4500))
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
R_ABOBADA = R_SITIO - 20

# ── O CONTORNO DEIXA DE SER CÍRCULO ────────────────────────────────────────
# Os lobos não são gosto, são conserto de um defeito medido, e a razão está no
# cabeçalho de gerar_forma_filotaxia.py: com o raio função pura do posto o
# empacotamento não faz anel, mas a IDADE faz, e cada coorte ocupa uma coroa
# limpa. Como prédio comum tem padrão por bairro (regra 5), a cidade subiria
# anelada, que é o que a regra 3 proíbe. Modular o raio pelo ângulo transforma
# coroa em pétala, e as reentrâncias entre pétalas viram cunhas verdes que
# entram até perto da praça.
# 5 é de Fibonacci, que é o pedido estético do fundador (concha, pinha).
# ⚠️ Isto só é possível porque a área agora é variável: o tecido soma 16,33 km²
# e o disco livre tem mais que isso, então sobra folga para ter FORMA. Com o
# lote fixo de 300 m² não sobrava, e por isso o plano diretor encheu o disco.
LOBOS = 5
LOBO_AMP = 0.12
LOBO_FASE = math.radians(18)

def raio_borda(x, z):
    return R_ABOBADA * (1 - LOBO_AMP + LOBO_AMP * math.cos(LOBOS * (math.atan2(z, x) - LOBO_FASE)))

# ── a curva da área (masterplan §9, decisão 1 de 28/08) ────────────────────
# Área proporcional à RAIZ do saldo, com gradiente centro-periferia. Medido:
# a média é 308 m² por carteira e não tem como fugir disso, então premium só
# existe tirando de alguém. A raiz dá razão de 805x entre o maior e o menor;
# o proporcional puro daria 648.082x e faria cem latifundiários.
EXPOENTE = 0.5
GRADIENTE = 1.0        # borda com 2,7x a área por DOG do centro
TECIDO_ALVO = 16.33e6  # m² da metade do holder
LOTE_MIN_FRENTE = 5.0  # nenhum lote fica mais estreito que isto
FILA_PROF = 25.0       # profundidade padrão da fileira
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
    if r < R_INICIO or r > raio_borda(x, z): return False
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

# ── a ordem de passo: agora são PRATELEIRAS, não vagas ─────────────────────
# ⚠️ MUDOU DE VAGA PARA METRO DE TESTADA em 28/08. Antes o quarteirão era 84
# caixas de 12 x 25 m e cada carteira pegava uma. Com área variável isso não
# serve: dar uma vaga de 300 m² para um lote de 50 desperdiça 250, e são 2.051
# lotes abaixo de 60 m². Agora cada quarteirão oferece 6 prateleiras de 25 m de
# profundidade e a carteira consome TESTADA conforme a área que lhe cabe.
# Frente variável ao longo da rua é exatamente o que cidade velha parece.
PROF = FILA_PROF
def prateleiras_de(s):
    """Por setor, as prateleiras em ordem de chegada: mais perto da praça primeiro."""
    out = []
    for q in sorted(T[s], key=lambda q: q['r']):
        for b in sorted(q['quarteiroes'], key=lambda b: b['r']):
            # o quarteirão de borda entra com a testada proporcional ao que
            # sobrou dele depois da máscara (relevo, bulevar, coliseu, borda)
            frac = len(b['lotes']) / (LOTE_COLS * LOTE_ROWS)
            util = QUARTEIRAO * frac
            ang = math.radians(s * GIRO_SETOR)
            ca, sa = math.cos(ang), math.sin(ang)
            for fila in range(LOTE_ROWS):
                oz = (fila - (LOTE_ROWS - 1) / 2) * PROF * 1.12
                out.append({'bx': b['x'], 'bz': b['z'], 'oz': oz, 'ca': ca, 'sa': sa,
                            'x0': -util / 2, 'livre': util, 'r': b['r']})
    return out
PASSO = [prateleiras_de(s) for s in range(SETORES)]

# ── a área de cada carteira (masterplan §9, decisões 1 e 3) ────────────────
# area = k · saldo^EXPOENTE · (r/R_INICIO)^GRADIENTE, com k calibrado para a
# soma dar exatamente o tecido alvo. O raio entra depois, quando a carteira já
# tem lugar; aqui vale o raio médio, e a calibração se refaz no fim.
soma_raiz = sum(elig[a] ** EXPOENTE for _, _, _, a in carteiras)
def area_de(dog, r):
    return K_AREA * (dog ** EXPOENTE) * ((r / R_INICIO) ** GRADIENTE)
def _mg():
    sm = w = 0.0
    for i in range(2000):
        r = R_INICIO + (R_ABOBADA - R_INICIO) * (i + 0.5) / 2000
        sm += (r / R_INICIO) ** GRADIENTE * r; w += r
    return sm / w
K_AREA = 0.0   # calibrado adiante, contra o tecido que sobrou depois dos lobos

# ── capacidade agora é ÁREA, não contagem ──────────────────────────────────
cap_area = [sum(pr['livre'] for pr in PASSO[s]) * PROF for s in range(SETORES)]
CAP_AREA = sum(cap_area)
# ⚠️ A CURVA SE CALIBRA CONTRA O TECIDO QUE EXISTE, não contra um alvo escrito
# à mão. A primeira versão mirava os 16,33 km² do plano diretor e o contorno
# lobado só deixou 12,51: 9.613 carteiras ficaram sem lote, caladas. Agora o
# lobo é uma alavanca de gosto com preço medido, e o preço aparece no tamanho
# do lote de todo mundo, não numa carteira que some.
# O 0,97 é folga de empacotamento: a última carteira de cada prateleira raramente
# fecha a testada exata.
K_AREA = (CAP_AREA * 0.97) / (_mg() * soma_raiz)
print(f'tecido disponível: {CAP_AREA/1e6:.2f} km² | curva: expoente {EXPOENTE}, '
      f'gradiente {GRADIENTE}, k = {K_AREA:.6g}', file=sys.stderr)
for s in range(SETORES):
    print(f'  setor {s+1:2d} (rumo {s*30:3d}): {len(T[s]):3d} quartos, '
          f'{sum(len(q["quarteiroes"]) for q in T[s]):4d} quarteirões, '
          f'{cap_area[s]/1e4:8,.1f} ha', file=sys.stderr)

# ── o condomínio do DSC: as prateleiras mais internas do setor do rumo 68,7 ─
S_DSC = int(DSC_RUMO // (360/SETORES))

# ── cota por setor: por ÁREA pedida, não por cabeça ────────────────────────
# ⚠️ A cota mudou de contagem para área junto com a curva. Duas carteiras não
# pesam mais igual: uma de 4 ha ocupa o mesmo que 800 do portão.
r_medio = [ (sum(pr['r'] for pr in PASSO[s]) / max(1, len(PASSO[s]))) for s in range(SETORES) ]
def area_nominal(dog, s):
    return K_AREA * (dog ** EXPOENTE) * ((max(r_medio[s], R_INICIO) / R_INICIO) ** GRADIENTE)

gerais = [c for c in carteiras if c[3] not in dsc]
capg = list(cap_area)
usado = [0.0]*SETORES
destino = []
for c in gerais:
    melhor, mfolga = -1, -1e18
    for s in range(SETORES):
        pedido = area_nominal(elig[c[3]], s)
        if usado[s] + pedido > capg[s]: continue
        folga = (capg[s] - usado[s]) / capg[s]
        if folga > mfolga: mfolga, melhor = folga, s
    if melhor < 0:
        melhor = max(range(SETORES), key=lambda s: capg[s] - usado[s])
    usado[melhor] += area_nominal(elig[c[3]], melhor)
    destino.append(melhor)

# ── planta: consome TESTADA das prateleiras ───────────────────────────────
# ⚠️ DUAS PASSADAS, e a segunda não é luxo. A primeira versão calibrava a curva
# contra a área disponível e a cidade saía com 78% dela ocupada: a mediana caiu
# para 150 m² quando a curva prometia 230. O que come a diferença é o
# empacotamento, e ele não tem fórmula fechada: a frente mínima de 5 m gasta
# 125 m² de prateleira num lote de 21, e a última carteira de cada fileira
# quase nunca fecha a testada exata. Então a passada 1 MEDE o desperdício e a
# passada 2 corrige o k por ele.
cursor = [0]*SETORES
saida = []
# ⚠️ O EMPACOTAMENTO PROCURA PRATELEIRA, NÃO ACEITA A PRIMEIRA. A versão de
# estreia pegava a primeira prateleira com qualquer sobra e espremia o lote nela:
# um lote de 1.600 m² caindo numa sobra de 6 m virava um corredor de 6 por 266 m,
# a profundidade batia no teto de 255 e o resto da área EVAPORAVA. Era isso que
# segurava o aproveitamento em 80% e fazia a bisseção parar cedo, com o lote de
# todo mundo menor do que a terra permitia.
# Agora: calcula a testada natural, varre uma JANELA de prateleiras à frente
# procurando uma que caiba inteira, e só se nenhuma couber usa a de maior sobra,
# com a profundidade compensando. A janela é curta de propósito: o lote tem de
# ficar perto do lugar que a idade lhe deu, senão a regra 1 vira enfeite.
JANELA = 24
PROF_MAX = PROF * 3          # 75 m: o lote fundo ainda cabe na faixa do quarteirão

def coloca(s, dog, addr):
    """Consome testada e devolve (x, z, frente, prof)."""
    n = len(PASSO[s])
    while cursor[s] < n and PASSO[s][cursor[s]]['livre'] < LOTE_MIN_FRENTE:
        cursor[s] += 1
    if cursor[s] >= n: return None
    base = cursor[s]
    area = area_de(dog, max(PASSO[s][base]['r'], R_INICIO))
    frente_nat = max(area / PROF, LOTE_MIN_FRENTE)

    escolhida, folgada = -1, -1
    for k in range(base, min(n, base + JANELA)):
        livre = PASSO[s][k]['livre']
        if livre + 1e-9 >= frente_nat:
            escolhida = k; break
        if livre > folgada: folgada, escolhida_alt = livre, k
    if escolhida < 0:
        # ninguém comporta a testada natural: usa a de maior sobra e afunda o lote
        escolhida = escolhida_alt if folgada >= LOTE_MIN_FRENTE else -1
        if escolhida < 0:
            cursor[s] = base + JANELA
            return coloca(s, dog, addr) if cursor[s] < n else None

    pr = PASSO[s][escolhida]

    # ⚠️ O GIGANTE PEGA PRATELEIRA INTEIRA. Sem este ramo o teto de profundidade
    # decapita o topo da curva: o maior lote caía de 30.244 para 12.600 m², que é
    # exatamente 168 x 75, e a área perdida ia parar no lote dos outros. São umas
    # poucas dezenas de carteiras, mas são justamente as que a regra da raiz
    # existe para tratar, então truncar aqui esvazia a regra.
    if area > PROF_MAX * QUARTEIRAO:
        fatias = max(1, min(LOTE_ROWS, math.ceil(area / (QUARTEIRAO * PROF))))
        tomadas = 0
        for k in range(escolhida, min(n, escolhida + fatias)):
            PASSO[s][k]['x0'] += PASSO[s][k]['livre']
            PASSO[s][k]['livre'] = 0.0
            tomadas += 1
        prof_g = min(255.0, area / QUARTEIRAO)
        lxg, lzg = pr['bx'], pr['bz'] + pr['oz'] + (tomadas - 1) * PROF * 0.56
        return (lxg*pr['ca'] - lzg*pr['sa'], lxg*pr['sa'] + lzg*pr['ca'],
                QUARTEIRAO, prof_g)

    frente = min(frente_nat, pr['livre'])
    prof_real = area / frente
    if prof_real > PROF_MAX:
        # ainda fundo demais: alarga até o limite da sobra e aceita o que couber
        frente = pr['livre']
        prof_real = min(PROF_MAX, area / frente)
    ox = pr['x0'] + frente / 2
    pr['x0'] += frente; pr['livre'] -= frente
    lx, lz = pr['bx'] + ox, pr['bz'] + pr['oz']
    wx = lx*pr['ca'] - lz*pr['sa']
    wz = lx*pr['sa'] + lz*pr['ca']
    return (wx, wz, frente, min(255.0, prof_real))

def uma_passada():
    global PASSO, cursor, saida
    PASSO = [prateleiras_de(s) for s in range(SETORES)]
    cursor = [0]*SETORES
    saida = []
    for c, s in zip(gerais, destino):
        r = coloca(s, elig[c[3]], c[3])
        if r is None:
            alt = max(range(SETORES), key=lambda t: sum(pr['livre'] for pr in PASSO[t][cursor[t]:]))
            r = coloca(alt, elig[c[3]], c[3])
            s = alt
        if r is None: continue
        saida.append((r[0], r[1], s, c[3], r[2], r[3]))
    for a in sorted(dsc):
        r = coloca(S_DSC, elig[a], a)
        if r: saida.append((r[0], r[1], S_DSC, a, r[2], r[3]))
    return sum(w*d for _,_,_,_,w,d in saida)

# ⚠️ BISSEÇÃO, e a razão é que as duas coisas brigam: k maior dá lote maior e
# k grande demais deixa carteira sem lote. A regra é inegociável (todo elegível
# tem endereço), então a busca é pelo MAIOR k em que ainda cabe todo mundo, e o
# resultado guardado é sempre o de uma passada completa.
alvo = CAP_AREA * 0.97
k_bom, saida_boa = None, None
k_lo, k_hi = K_AREA, None
for tentativa in range(6):
    obtido = uma_passada()
    coube = len(saida) >= N
    med = sorted(w*d for _,_,_,_,w,d in saida)[len(saida)//2] if saida else 0
    print(f'  passada {tentativa+1}: k={K_AREA:.5g}  {len(saida):,} plantadas, '
          f'{obtido/1e6:.2f} km² ({obtido/alvo*100:.0f}% do alvo), mediana {med:,.0f} m²'
          f'  {"cabe" if coube else "NAO CABE"}', file=sys.stderr)
    if coube:
        k_bom, saida_boa, k_lo = K_AREA, list(saida), K_AREA
        if k_hi is None:
            K_AREA /= max(0.55, obtido/alvo)      # primeiro salto: mira o desperdício medido
            continue
    else:
        k_hi = K_AREA
    if k_hi is None: break
    if (k_hi - k_lo) / k_lo < 0.02: break
    K_AREA = (k_lo + k_hi) / 2
if saida_boa is not None:
    saida, K_AREA = saida_boa, k_bom

print(f'plantadas {len(saida):,} de {N:,}', file=sys.stderr)
areas = sorted(w*d for _,_,_,_,w,d in saida)
if areas:
    print(f'lote: menor {areas[0]:,.0f} m² | mediana {areas[len(areas)//2]:,.0f} | '
          f'p99 {areas[int(len(areas)*.99)]:,.0f} | maior {areas[-1]:,.0f}', file=sys.stderr)
    print(f'área somada dos lotes: {sum(areas)/1e6:.2f} km²', file=sys.stderr)

# ── grava ──────────────────────────────────────────────────────────────────
posto = {c[3]: i for i, c in enumerate(carteiras)}
UTX = {}
with open(p('data/holders_by_age.csv'), newline='') as f:
    for row in csv.DictReader(f):
        try: UTX[row['address']] = int(float(row.get('utxo_count') or 1))
        except (ValueError, KeyError): pass
def forma_de(u):
    if u <= 1: return 0        # massa única: casa no centro, fazenda na borda
    if u <= 3: return 1        # pátio, geminada
    if u <= 9: return 2        # condomínio baixo
    if u <= 99: return 3       # torre
    return 4                   # quarteirão com várias torres
buf = bytearray()
for x, z, s, a, w, d in saida:
    coorte = min(7, posto[a]*8//N)
    fam = familia_de.get(a, 0)
    fl = (1 if a in dsc else 0) | (forma_de(UTX.get(a, 1)) << 1)
    buf += struct.pack('<hhBBHBBB', int(round(x)), int(round(z)), s, coorte,
                       min(65535, fam), fl,
                       max(1, min(255, int(round(w)))), max(1, min(255, int(round(d)))))
open(p('public/city/cidade-lotes.bin'), 'wb').write(buf)
json.dump({
    'esquema': 'int16 x, int16 z, uint8 setor, uint8 coorte, uint16 familia, '
               'uint8 flags(bit0=DSC, bits1-3=forma por utxo_count), uint8 frente_m, uint8 prof_m',
    'chave': '(ts, txid, vout) do UTXO mais antigo; zero colisoes',
    'curva': {'expoente': EXPOENTE, 'gradiente': GRADIENTE, 'k': K_AREA,
              'lobos': LOBOS, 'loboAmp': LOBO_AMP},
    'setores': SETORES, 'giroPorSetor': GIRO_SETOR, 'bulevar_m': BULEVAR,
    'celula_m': CELULA, 'quarteirao_m': QUARTEIRAO,
    'declive_max': DECLIVE_MAX, 'raioInicio': R_INICIO, 'raioSitio': R_SITIO,
    'raioBorda': R_ABOBADA,
    'tecidoDisponivel_km2': round(CAP_AREA/1e6, 3),
    'capacidadeHaPorSetor': [round(a/1e4, 1) for a in cap_area],
    'areaLotes_km2': round(sum(areas)/1e6, 3) if areas else 0,
    'loteMediana_m2': round(areas[len(areas)//2]) if areas else 0,
    'loteMenor_m2': round(areas[0]) if areas else 0,
    'loteMaior_m2': round(areas[-1]) if areas else 0,
    'carteiras': N, 'plantadas': len(saida),
    'enclaves': len(familias_grandes), 'carteirasEmEnclave': len(familia_de),
    'dsc': len(dsc), 'setorDSC': S_DSC+1,
    'quartos': sum(len(T[s]) for s in range(SETORES)),
    'quarteiroes': sum(len(q['quarteiroes']) for s in range(SETORES) for q in T[s]),
}, open(p('public/city/cidade.json'), 'w'), indent=1)
print('gravado public/city/cidade.{json} + cidade-lotes.bin', file=sys.stderr)
