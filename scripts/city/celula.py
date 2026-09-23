#!/usr/bin/env python3
"""A CÉLULA DA TEIA: o lote como fração do trapézio entre duas faces e dois radiais.

Masterplan §37, §40 e §41. Fundador, 23/09/2026: "Os lotes devem ter o formato de
células que se encaixem, não serem forçados a entrar numa grade num formato
diferente".

Este módulo é geometria e alocação, e mais nada. A máscara (água, peça, canal,
declive), a altura do chão e a curva de área chegam do gerador por parâmetro, para
que o que está aqui possa ser testado sozinho (`python3 celula.py --teste`).

⚠️ O QUADRO É O DA CENA. Rumo θ medido de −z para +x; ponto = (sin θ·r, −cos θ·r).
A face do dodecágono tem o meio em 15° + 30°k, os vértices nas 12 avenidas, e o anel
da teia é desenhado com a APÓTEMA em `ANEIS[i]` (`raioDodeca` em vias.ts). Medido em
23/09 no dump da cena: 3.623 trechos retos de anel batem no metro. O gerador do §36
tratava o número como VÉRTICE e nascia 3,4% para dentro da rua; não repita.

⚠️ A COORDENADA DA FILEIRA É w = tan(θ − φ), com φ o rumo do meio da face. Nela uma
reta RADIAL é w constante e uma reta PARALELA À FACE é apótema d constante, então a
região {d ∈ [d0, d1], w ∈ [w0, w1]} é exatamente o trapézio de laterais radiais, e a
área dela é (d1² − d0²)/2 · (w1 − w0), sem aproximação. É por isso que o lote
encaixa: toda divisa de lote é radial ou paralela à face, igual à rua.

⚠️ A CÉLULA NUNCA ATRAVESSA UM VÉRTICE. Os vértices caem a cada 30° = 14 passos de
360/168, e a célula ocupa 1 ou 2 passos começando em índice par, então as duas faces
dela são retas paralelas. Se alguém mudar N_RAD ou a dobra, `Celula` confere e aborta.
"""
import math

P30 = math.pi / 6

# ── geometria ───────────────────────────────────────────────────────────────
def rel(t):
    """distância angular (rad) ao meio da face mais próxima, em [−15°, +15°)"""
    return ((t % P30) + P30) % P30 - P30 / 2

def face_de(t):
    """rumo (rad) do meio da face do dodecágono que cobre o rumo t"""
    return t - rel(t)

def ponto(d, w, fi):
    """o ponto da reta paralela à face `fi`, a apótema `d`, na coordenada w = tan(θ − fi)"""
    s, c = math.sin(fi), math.cos(fi)
    return (d * (s + w * c), d * (-c + w * s))

def dw_de(x, z, fi):
    """inversa de `ponto`: (d, w) de um ponto no quadro da face `fi`"""
    s, c = math.sin(fi), math.cos(fi)
    d = x * s - z * c
    return d, (x * c + z * s) / d

def rumo(x, z):
    return math.atan2(x, -z) % (2 * math.pi)

def area_trapezio(d0, d1, w0, w1):
    return abs(d1 * d1 - d0 * d0) / 2.0 * abs(w1 - w0)

def shoelace(P):
    s = 0.0
    for (x0, z0), (x1, z1) in zip(P, P[1:] + P[:1]):
        s += x0 * z1 - x1 * z0
    return abs(s) / 2.0

def centroide(P):
    """centróide de área de um polígono simples"""
    a = cx = cz = 0.0
    for (x0, z0), (x1, z1) in zip(P, P[1:] + P[:1]):
        cr = x0 * z1 - x1 * z0
        a += cr; cx += (x0 + x1) * cr; cz += (z0 + z1) * cr
    if abs(a) < 1e-9:
        return sum(p[0] for p in P) / len(P), sum(p[1] for p in P) / len(P)
    return cx / (3 * a), cz / (3 * a)

def cantos_trapezio(d_frente, d_fundo, wa, wb, fi):
    """os 4 cantos na ordem do contrato (§41): p0 p1 na frente em rumo crescente,
    p2 p3 no fundo, p3 atrás de p0."""
    return [ponto(d_frente, wa, fi), ponto(d_frente, wb, fi),
            ponto(d_fundo, wb, fi), ponto(d_fundo, wa, fi)]

def cantos_fatia(r_frente, r_fundo, t0, t1):
    """fatia de anel centrada na origem (geo = 1): p0 p1 no arco da frente"""
    P = lambda r, t: (math.sin(t) * r, -math.cos(t) * r)
    return [P(r_frente, t0), P(r_frente, t1), P(r_fundo, t1), P(r_fundo, t0)]

def area_fatia(r0, r1, t0, t1):
    return abs(r1 * r1 - r0 * r0) / 2.0 * abs(t1 - t0)

def centroide_fatia(r0, r1, t0, t1):
    """centróide de área da fatia de anel"""
    dt = abs(t1 - t0)
    if dt < 1e-12: return (0.0, 0.0)
    ra, rb = min(r0, r1), max(r0, r1)
    rc = (2.0 / 3.0) * (rb**3 - ra**3) / (rb**2 - ra**2) * math.sin(dt / 2) / (dt / 2)
    tm = (t0 + t1) / 2
    return (math.sin(tm) * rc, -math.cos(tm) * rc)

# ── a teia ──────────────────────────────────────────────────────────────────
class Teia:
    """A malha desenhada, lida da cena pelo gerador (nunca copiada).

    aneis        apótemas dos anéis da teia (`ANEIS` de teia.ts)
    dobra        índice do anel onde nasce o nível fino (`NIVEIS[1].r0`)
    n_rad        radiais no nível fino (168)
    hr           meia largura da rua da teia (6 m)
    meia_trav    meia largura da travessa do nível fino (4,5 m)
    avenidas     {j de 168: meia largura} das 12 avenidas
    arteriais    {índice do anel: meia largura} dos arteriais encaixados na face
    canais       [(j de 168, meia largura do corredor, r_ini, r_fim)]
    """
    def __init__(self, aneis, dobra, n_rad, hr, meia_trav, avenidas, arteriais, canais):
        self.aneis, self.dobra, self.n_rad = list(aneis), dobra, n_rad
        self.hr, self.meia_trav = hr, meia_trav
        self.avenidas, self.arteriais, self.canais = dict(avenidas), dict(arteriais), list(canais)
        if n_rad % 12 or (n_rad // 12) % 2:
            raise SystemExit(f'celula: N_RAD={n_rad} não põe vértice em índice par')

    def passo(self, i):
        return 2 if i < self.dobra else 1

    def theta(self, j):
        return 2 * math.pi * j / self.n_rad

    def meia_anel(self, i):
        return max(self.hr, self.arteriais.get(i, 0.0))

    def meia_radial(self, j, r0, r1):
        j %= self.n_rad
        m = self.avenidas.get(j)
        if m is None:
            m = self.hr if j % 2 == 0 else self.meia_trav
        for jc, mc, ri, rf in self.canais:
            if jc % self.n_rad == j and r1 > ri and r0 < rf:
                m = max(m, mc)
        return m

# ── a célula e as fileiras ──────────────────────────────────────────────────
FAIXA, TRAVESSA = 50.0, 9.0      # a faixa de duas fileiras costas com costas, e a via entre faixas
FRENTE_MIN = 5.0                 # nenhum lote fica mais estreito que isto na frente

class Celula:
    """O trapézio útil entre as faces dos anéis i e i+1 e os radiais j0 e j1.

    ⚠️ A LATERAL É RETA RADIAL, NÃO A PARALELA À RUA. A borda da rua radial é
    paralela ao eixo; a lateral do lote passa pelo centro, que é o que faz o lote
    ser fração da célula. O ângulo sai da folga no canto MAIS PERTO do centro, onde
    a reta radial chega mais perto do eixo da rua; para fora a folga só cresce, de
    6,0 a no máximo 6,5 m numa célula de 110 m no anel 0.
    """
    __slots__ = ('i', 'j0', 'j1', 'fi', 'd_in', 'd_out', 'wL', 'wR', 'wL_eixo', 'wR_eixo',
                 'k', 'h', 'faixas', 'fileiras', 'setor', 'q', 'b', 'cortes', 'ok')

    def __init__(self, teia, i, j0, j1):
        if (j0 % 14) and (j1 % 14) and (j0 // 14 != (j1 - 1) // 14):
            raise SystemExit(f'celula: célula ({i},{j0},{j1}) atravessa vértice do dodecágono')
        self.i, self.j0, self.j1 = i, j0, j1
        t0, t1 = teia.theta(j0), teia.theta(j1)
        self.fi = face_de((t0 + t1) / 2)
        self.d_in = teia.aneis[i] + teia.meia_anel(i)
        self.d_out = teia.aneis[i + 1] - teia.meia_anel(i + 1)
        r_in0 = self.d_in / math.cos(t0 - self.fi)
        r_in1 = self.d_in / math.cos(t1 - self.fi)
        r_out0 = self.d_out / math.cos(t0 - self.fi)
        r_out1 = self.d_out / math.cos(t1 - self.fi)
        mL = teia.meia_radial(j0, r_in0, r_out0)
        mR = teia.meia_radial(j1, r_in1, r_out1)
        # ⚠️ A FOLGA É RESOLVIDA NO CANTO, NÃO NO EIXO. O canto da célula está na reta
        # d = d_in no rumo t0 + δ, e a distância dele à reta do radial é
        # d·sin δ / cos(α + δ), com α = t0 − φ. Igualar a `m` dá, exato,
        # tan δ = k·cos α / (1 + k·sin α), k = m/d (e o espelho do outro lado). A
        # primeira versão usava o raio no EIXO (asin(m/r)) e o canto entrava até
        # 0,57 m na meia rua nas células longe do meio da face. Para fora a folga
        # só cresce, porque d cresce.
        kL, kR = mL / self.d_in, mR / self.d_in
        aL, aR = t0 - self.fi, t1 - self.fi
        tL = t0 + math.atan2(kL * math.cos(aL), 1.0 + kL * math.sin(aL))
        tR = t1 - math.atan2(kR * math.cos(aR), 1.0 - kR * math.sin(aR))
        self.wL, self.wR = math.tan(tL - self.fi), math.tan(tR - self.fi)
        self.wL_eixo, self.wR_eixo = math.tan(t0 - self.fi), math.tan(t1 - self.fi)
        D = self.d_out - self.d_in
        self.k = max(1, int(round((D + TRAVESSA) / (FAIXA + TRAVESSA))))
        self.h = (D - (self.k - 1) * TRAVESSA) / (2 * self.k)
        self.faixas = []
        for s in range(self.k):
            a = self.d_in + s * (2 * self.h + TRAVESSA)
            self.faixas.append((a, a + 2 * self.h))
        self.fileiras = []      # preenchido por `fileiras_da_celula`
        self.setor = self.q = self.b = None
        self.cortes = []        # faixas de w tomadas por lote de célula (a travessa some ali)
        self.ok = self.wR - self.wL > 1e-6 and D > 2 * FRENTE_MIN

    def poly(self):
        return cantos_trapezio(self.d_in, self.d_out, self.wL, self.wR, self.fi)

    def travessas(self):
        """o eixo de cada travessa de 9 m, de eixo de radial a eixo de radial,
        partido onde um lote de célula passa por cima"""
        out = []
        for s in range(self.k - 1):
            d = self.faixas[s][1] + TRAVESSA / 2
            trechos = [(self.wL_eixo, self.wR_eixo)]
            for c0, c1 in sorted(self.cortes):
                novo = []
                for a, b in trechos:
                    if c1 <= a or c0 >= b: novo.append((a, b)); continue
                    if c0 > a: novo.append((a, c0))
                    if c1 < b: novo.append((c1, b))
                trechos = novo
            for a, b in trechos:
                if (b - a) * d < 2.0: continue
                (x0, z0), (x1, z1) = ponto(d, a, self.fi), ponto(d, b, self.fi)
                out.append([round(x0, 2), round(z0, 2), round(x1, 2), round(z1, 2)])
        return out

def fileiras_da_celula(c):
    """as 2k fileiras, de dentro para fora. `lado` 0 dá frente para dentro."""
    out = []
    for s, (a, b) in enumerate(c.faixas):
        out.append({'cel': c, 'faixa': s, 'lado': 0, 'df': a, 'db': a + c.h})
        out.append({'cel': c, 'faixa': s, 'lado': 1, 'df': b, 'db': b - c.h})
    for f in out:
        f['A2'] = abs(f['db'] ** 2 - f['df'] ** 2) / 2.0
        f['fi'] = c.fi
    for n in range(0, len(out), 2):
        out[n]['par'], out[n + 1]['par'] = out[n + 1], out[n]
    c.fileiras = out
    return out

# ── amostragem da máscara ao longo da fileira ───────────────────────────────
def intervalos_livres(f, wL, wR, livre_pt, passo_m=3.0, recuo=0.5):
    """os trechos [w0, w1] da fileira onde a máscara deixa lote nascer.

    Amostra três retas paralelas à face (frente, meio, fundo, recuadas `recuo` do
    bordo) a cada `passo_m` metros de frente. Um trecho livre é uma sequência de
    amostras todas livres, encolhida meio passo de cada lado: a divisa do lote
    nunca encosta numa amostra reprovada."""
    df, db, fi = f['df'], f['db'], f['fi']
    sg = 1.0 if db > df else -1.0
    linhas = (df + sg * recuo, (df + db) / 2.0, db - sg * recuo)
    dmin = min(df, db)
    n = max(2, int(math.ceil((wR - wL) * dmin / passo_m)) + 1)
    ws = [wL + (wR - wL) * t / (n - 1) for t in range(n)]
    ok = []
    for w in ws:
        bom = True
        for d in linhas:
            x, z = ponto(d, w, fi)
            if not livre_pt(x, z):
                bom = False; break
        ok.append(bom)
    meio = (ws[1] - ws[0]) / 2.0 if n > 1 else 0.0
    out, ini = [], None
    for k, (w, b) in enumerate(zip(ws, ok)):
        if b and ini is None: ini = k
        if (not b or k == n - 1) and ini is not None:
            fim = k if b else k - 1
            w0 = ws[ini] + (0.0 if ini == 0 else meio)
            w1 = ws[fim] - (0.0 if fim == n - 1 else meio)
            if (w1 - w0) * dmin >= FRENTE_MIN:
                out.append([w0, w1])
            ini = None
    return out

# ── a árvore de capacidade ──────────────────────────────────────────────────
class Arvore:
    """máximo por segmento; `primeiro(q, lo)` = menor índice >= lo com valor >= q"""
    def __init__(self, vals):
        n = 1
        while n < max(1, len(vals)): n *= 2
        self.n, self.t = n, [0.0] * (2 * n)
        for i, v in enumerate(vals): self.t[n + i] = v
        for i in range(n - 1, 0, -1): self.t[i] = max(self.t[2 * i], self.t[2 * i + 1])

    def poe(self, i, v):
        i += self.n; self.t[i] = v; i //= 2
        while i:
            nv = max(self.t[2 * i], self.t[2 * i + 1])
            if self.t[i] == nv: break
            self.t[i] = nv; i //= 2

    def primeiro(self, q, lo=0):
        t, n = self.t, self.n
        if lo >= n or t[1] < q: return -1
        # desce procurando o primeiro nó à direita de lo com valor >= q
        pilha = [(1, 0, n)]
        while pilha:
            no, a, b = pilha.pop()
            if b <= lo or t[no] < q: continue
            if b - a == 1: return a
            m = (a + b) // 2
            pilha.append((2 * no + 1, m, b))
            pilha.append((2 * no, a, m))
        return -1

# ── o alocador de um distrito ───────────────────────────────────────────────
def capacidade(f):
    """a maior área que um lote de FILEIRA pode ter aqui (o maior trecho livre)"""
    melhor = 0.0
    for w0, w1 in f['livre']:
        if (w1 - w0) * min(f['df'], f['db']) >= FRENTE_MIN:
            melhor = max(melhor, (w1 - w0) * f['A2'])
    return melhor

def _tira(livre, a, b):
    """remove [a, b] da lista de trechos livres"""
    out = []
    for w0, w1 in livre:
        if b <= w0 or a >= w1: out.append([w0, w1]); continue
        if a - w0 > 1e-9: out.append([w0, a])
        if w1 - b > 1e-9: out.append([b, w1])
    return out

def _comum(listas, dw):
    """o primeiro w0 em que todas as listas têm [w0, w0 + dw] livre"""
    cands = sorted(w0 for L in listas for w0, _ in L)
    for w0 in cands:
        ok = True
        for L in listas:
            if not any(a <= w0 + 1e-9 and w0 + dw <= b + 1e-9 for a, b in L):
                ok = False; break
        if ok: return w0
    return None

class Distrito:
    """As fileiras de um distrito, em ordem de chegada (de dentro para fora), e a
    árvore que acha a primeira que comporta um lote."""
    LIM_FILEIRA = 1500.0     # m²: até aqui o lote é de fileira (frente ≤ ~60 m)
    LIM_FAIXA = 6000.0       # m²: até aqui é de faixa (as duas fileiras); acima, de célula
    PASSO_QUEIMA = 4.0       # m de frente descartados quando a validação reprova um ponto

    def __init__(self, fileiras):
        self.F = fileiras
        for n, f in enumerate(self.F): f['i'] = n
        self.reinicia()

    def reinicia(self):
        for f in self.F:
            f['livre'] = [list(t) for t in f['livre0']]
            f['lotes'] = []
        for c in {id(f['cel']): f['cel'] for f in self.F}.values():
            c.cortes = []
        self.arv = Arvore([capacidade(f) for f in self.F])
        self.queimada = 0.0

    def _atualiza(self, f):
        self.arv.poe(f['i'], capacidade(f))

    def capacidade_total(self):
        return sum((w1 - w0) * f['A2'] for f in self.F for w0, w1 in f['livre0'])

    def coloca(self, area, valida):
        """Planta um lote de `area` m². `valida(cantos) -> bool` é a máscara fina
        do gerador (canto, declive, lâmina). Devolve o registro do lote ou None."""
        if area <= self.LIM_FILEIRA:
            return self._fileira(area, valida)
        if area <= self.LIM_FAIXA:
            return self._faixa(area, valida) or self._fileira(area, valida)
        return self._celula(area, valida) or self._faixa(area, valida)

    def _fileira(self, area, valida):
        lo = 0
        q = min(area, 100.0)            # o piso de frente faz o lote real >= isto
        while True:
            k = self.arv.primeiro(q, lo)
            if k < 0: return None
            f = self.F[k]
            dmin = min(f['df'], f['db'])
            dw = max(area / f['A2'], FRENTE_MIN / dmin)
            feito = None
            for tr in list(f['livre']):
                w0, w1 = tr
                while w1 - w0 >= dw - 1e-12:
                    C = cantos_trapezio(f['df'], f['db'], w0, w0 + dw, f['fi'])
                    if valida(C):
                        feito = (w0, w0 + dw, C); break
                    q_ = min(dw, self.PASSO_QUEIMA / dmin)
                    f['livre'] = _tira(f['livre'], w0, w0 + q_)
                    self.queimada += q_ * dmin
                    w0 += q_
                if feito: break
            if feito:
                wa, wb, C = feito
                f['livre'] = _tira(f['livre'], wa, wb)
                self._atualiza(f)
                reg = {'fil': f, 'wa': wa, 'wb': wb, 'cantos': C, 'geo': 0, 'tipo': 'fileira',
                       'area': area_trapezio(f['df'], f['db'], wa, wb),
                       'df': f['df'], 'db': f['db']}
                f['lotes'].append(reg)
                return reg
            self._atualiza(f)
            lo = k + 1

    def _faixa(self, area, valida):
        lo = 0
        while True:
            k = self.arv.primeiro(area / 2.2, lo)
            if k < 0: return None
            f = self.F[k]
            lo = k + 1
            if f['lado'] != 0: continue
            g = f['par']
            d0, d1 = f['df'], g['df']              # a faixa inteira, de rua a rua
            dw = max(area / (abs(d1 * d1 - d0 * d0) / 2.0), FRENTE_MIN / d0)
            w0 = _comum([f['livre'], g['livre']], dw)
            while w0 is not None:
                C = cantos_trapezio(d0, d1, w0, w0 + dw, f['fi'])
                if valida(C):
                    for h in (f, g):
                        h['livre'] = _tira(h['livre'], w0, w0 + dw); self._atualiza(h)
                    reg = {'fil': f, 'wa': w0, 'wb': w0 + dw, 'cantos': C, 'geo': 0,
                           'tipo': 'faixa', 'area': area_trapezio(d0, d1, w0, w0 + dw),
                           'df': d0, 'db': d1}
                    f['lotes'].append(reg)
                    return reg
                # o ponto reprovado sai das duas fileiras
                q_ = self.PASSO_QUEIMA / d0
                for h in (f, g): h['livre'] = _tira(h['livre'], w0, w0 + q_)
                w0 = _comum([f['livre'], g['livre']], dw)
            self._atualiza(f); self._atualiza(g)

    def _celula(self, area, valida):
        lo = 0
        while True:
            k = self.arv.primeiro(area / 12.0, lo)
            if k < 0: return None
            f = self.F[k]
            lo = k + 1
            if f['lado'] != 0 or f['faixa'] != 0: continue
            c = f['cel']
            fs = c.fileiras
            d0, d1 = c.d_in, c.d_out
            dw = max(area / (abs(d1 * d1 - d0 * d0) / 2.0), FRENTE_MIN / d0)
            if dw > c.wR - c.wL + 1e-12: continue
            w0 = _comum([h['livre'] for h in fs], dw)
            while w0 is not None:
                C = cantos_trapezio(d0, d1, w0, w0 + dw, c.fi)
                if valida(C):
                    for h in fs:
                        h['livre'] = _tira(h['livre'], w0, w0 + dw); self._atualiza(h)
                    c.cortes.append((w0, w0 + dw))
                    reg = {'fil': f, 'wa': w0, 'wb': w0 + dw, 'cantos': C, 'geo': 0,
                           'tipo': 'celula', 'area': area_trapezio(d0, d1, w0, w0 + dw),
                           'df': d0, 'db': d1}
                    f['lotes'].append(reg)
                    return reg
                q_ = self.PASSO_QUEIMA / d0
                for h in fs: h['livre'] = _tira(h['livre'], w0, w0 + q_)
                w0 = _comum([h['livre'] for h in fs], dw)
            for h in fs: self._atualiza(h)

    def fecha_fileiras(self, valida):
        """⚠️ A SOBRA DE PONTA VAI PARA O VIZINHO. O último lote de uma fileira quase
        nunca fecha a testada exata, e o que sobra é estreito demais para outro lote:
        vira uma tira vazia entre o lote e a rua, que no mapa lê como defeito. Aqui o
        lote de FILEIRA encostado na tira cresce até a rua ou até o próximo lote, se a
        pegada nova ainda passa na máscara. Só cresce, nunca encolhe: a promessa lê a
        área gravada, e ela sobe."""
        ganhos = 0
        for f in self.F:
            dmin = min(f['df'], f['db'])
            lot = sorted((r for r in f['lotes'] if r['tipo'] == 'fileira'), key=lambda r: r['wa'])
            if not lot: continue
            for tr in list(f['livre']):
                w0, w1 = tr
                if (w1 - w0) * dmin >= 2 * FRENTE_MIN: continue
                esq = [r for r in lot if abs(r['wb'] - w0) < 1e-7]
                dir_ = [r for r in lot if abs(r['wa'] - w1) < 1e-7]
                alvo = None
                if esq:
                    r = esq[0]; C = cantos_trapezio(f['df'], f['db'], r['wa'], w1, f['fi'])
                    if valida(C): alvo = (r, r['wa'], w1, C)
                if alvo is None and dir_:
                    r = dir_[0]; C = cantos_trapezio(f['df'], f['db'], w0, r['wb'], f['fi'])
                    if valida(C): alvo = (r, w0, r['wb'], C)
                if alvo is None: continue
                r, wa, wb, C = alvo
                r['wa'], r['wb'], r['cantos'] = wa, wb, C
                r['area'] = area_trapezio(f['df'], f['db'], wa, wb)
                f['livre'] = _tira(f['livre'], w0, w1)
                ganhos += 1
            self._atualiza(f)
        return ganhos

# ── teste ───────────────────────────────────────────────────────────────────
def _teste():
    import random
    random.seed(7)
    # área exata contra shoelace, e a costura entre vizinhos
    for _ in range(2000):
        fi = face_de(random.uniform(0, 2 * math.pi))
        d0 = random.uniform(1400, 7000); d1 = d0 + random.choice([1, -1]) * random.uniform(5, 300)
        w0 = random.uniform(-0.25, 0.2); w1 = w0 + random.uniform(0.001, 0.05)
        C = cantos_trapezio(d0, d1, w0, w1, fi)
        a1, a2 = area_trapezio(d0, d1, w0, w1), shoelace(C)
        assert abs(a1 - a2) < 1e-6 * max(1, a1), (a1, a2)
        for (x, z), (dd, ww) in zip(C, ((d0, w0), (d0, w1), (d1, w1), (d1, w0))):
            d_, w_ = dw_de(x, z, fi)
            assert abs(d_ - dd) < 1e-6 and abs(w_ - ww) < 1e-9
    # a reta radial é w constante
    fi = face_de(math.radians(40))
    t = math.radians(38.5)
    for r in (1500, 3000, 6000):
        x, z = math.sin(t) * r, -math.cos(t) * r
        assert abs(dw_de(x, z, fi)[1] - math.tan(t - fi)) < 1e-12
    # a face do anel da teia (apótema A) passa por raioDodeca(A, θ) em qualquer θ da face
    for A in (1450, 3384, 6727):
        for deg in (0.0, 7.5, 15.0, 22.5, 29.99):
            th = math.radians(deg)
            r = A / math.cos(rel(th))
            x, z = math.sin(th) * r, -math.cos(th) * r
            assert abs(dw_de(x, z, face_de(th))[0] - A) < 1e-6
    # fatia
    C = cantos_fatia(6700, 6600, 0.1, 0.2)
    assert abs(area_fatia(6700, 6600, 0.1, 0.2) - (6700**2 - 6600**2) / 2 * 0.1) < 1e-6
    # árvore
    A = Arvore([0, 3, 1, 5, 2])
    assert A.primeiro(2) == 1 and A.primeiro(4) == 3 and A.primeiro(2, 2) == 3 and A.primeiro(6) == -1
    A.poe(3, 0); assert A.primeiro(4) == -1 and A.primeiro(2, 2) == 4
    print('celula.py: geometria, fatia e árvore conferidas')

if __name__ == '__main__' and '--teste' in __import__('sys').argv:
    _teste()
