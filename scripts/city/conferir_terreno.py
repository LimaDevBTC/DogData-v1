#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════════
# O CONFERIDOR DE TERRENO: as duas pontas medem o mesmo chão?
#
# ⚠️ POR QUE ISTO EXISTE, e a resposta é um defeito que já aconteceu TRÊS VEZES.
# O relevo da DogCity é descrito em dois lugares que não se importam: `terrain.ts`
# + `vex.ts` (o que a câmera desenha) e `scripts/gerar_cidade.py` (o que decide
# onde nasce lote, onde há água e onde o declive passa do limite). Enquanto as
# constantes forem COPIADAS de um lado para o outro, elas vão divergir em
# silêncio, e divergiram: primeiro na prancha `app/city/plan` (um `const VEX = 2`
# cravado, registrado no cabeçalho de vex.ts), depois no gerador, que ficou sem
# exagero nenhum e com o platô da praça no par velho (960/1.300 contra
# 1.470/1.830), e por fim o mesmo platô de novo, 1.470/1.830 contra os 2.400/2.760
# que a cena desenha desde 05/09. Nos três casos ninguém percebeu, e pelo mesmo
# motivo: os dois números eram plausíveis.
#
# Disciplina não resolve isso; medição resolve. Este script amostra as duas
# pontas no mesmo ponto e reprova quando elas se afastam.
#
# ⚠️ E NÃO BASTA EXISTIR: ELE PRECISA SER RODADO. Entre 05/09 e 22/09 ninguém
# rodou, e nesses 17 dias o platô divergiu 930 m com o teste de igualdade já
# escrito aqui dentro, pronto para reprovar. Conferidor parado é conferidor que
# não existe. Rodar faz parte do portão, não é opcional.
#
# ⚠️ O QUE ELE COMPARA, E O QUE ELE NÃO COMPARA. A ponta da cena é
# `superficieAt`, que tem MAIS coisa que o gerador conhece: pódio da abóbada,
# vala dos canais, cova do parque, montes. O gerador guarda esses lugares por
# MÁSCARA (`em_canal`, `parque_alcance`, ...), não por cota. Então a conferência
# roda onde o lote de fato nasce e SEPARA o resíduo: a coluna "base" é a que tem
# de fechar; a coluna "com feição" é informativa.
#
# ── COMO SE RODA ───────────────────────────────────────────────────────────
#   1) o dev server no ar, porque `topo.mjs` lê a cena pelo navegador:
#        npm run dev
#   2) a topografia da cena, uma vez a cada mudança de terrain.ts/vex.ts:
#        node scripts/city/topo.mjs --n=1400 --raio=7200 --saida=/tmp/topo
#   3) a conferência:
#        python3 scripts/city/conferir_terreno.py --topo=/tmp/topo
#      opções: --topo=<pasta> (padrão /tmp/topo), --tolerancia=<m> (padrão 1,5)
#   Sai 0 quando as duas pontas fecham e 1 quando não fecham.
#
# ⚠️ ELE TAMBÉM É MÓDULO, E ISSO É CONTRATO. `conferir_lotes.py` importa
# `monta_chao()` para conferir a cota GRAVADA de cada lote contra o chão que o
# gerador desenha, e assim existe UMA reconstrução do chão no projeto, não duas.
# Por isso nada que precise de `/tmp/topo` pode rodar no nível do módulo: tudo o
# que MEDE está dentro de `main()`, e tudo o que MONTA o chão está em
# `monta_chao()`, que nunca derruba quem importa: ela levanta
# `TerrenoIndisponivel`, e quem chama diz INDISPONÍVEL em vez de aprovar.
# ═══════════════════════════════════════════════════════════════════════════
import json, math, re, struct, sys, os

arg = lambda k, d: next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith(f'--{k}=')), d)
RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
p = lambda *a: os.path.join(RAIZ, *a)
p_ts = lambda nome: p('app/city/plaza', nome)


class TerrenoIndisponivel(RuntimeError):
    """a reconstrução do chão do gerador não fechou.

    ⚠️ ISTO NÃO É "PASSOU". Quem chama tem de dizer INDISPONÍVEL e reprovar a
    rodada: um portão que aprova o que não conseguiu medir é o portão que deu
    15 de 15 na cidade errada."""


# ── OS LEITORES DA CENA ────────────────────────────────────────────────────
# ⚠️ CONSTANTE DA CENA SE LÊ, NUNCA SE COPIA. É a única coisa que impede a
# quarta divergência, e é a mesma regra que o gerador cumpre com os `_ts_const`
# dele. Estes quatro leitores são os MESMOS do gerador, de propósito: o bloco
# dele é executado aqui dentro com eles no lugar.
def _ts_const(caminho, chave):
    txt = open(p_ts(caminho), encoding='utf-8').read()
    m = re.search(rf'\b{chave}\s*(?::[^=\n]*)?[:=]\s*\[\s*(-?[0-9.]+)\s*,\s*(-?[0-9.]+)', txt)
    if m: return (float(m.group(1)), float(m.group(2)))
    m = re.search(rf'\b{chave}\s*(?::[^=\n]*)?[:=]\s*(?:[A-Za-z_][A-Za-z0-9_.]*\()?\s*(-?[0-9.]+)', txt)
    if m: return float(m.group(1))
    raise TerrenoIndisponivel(f'nao achei {chave} em {caminho}')


def _ts_lista(caminho, chave):
    txt = open(p_ts(caminho), encoding='utf-8').read()
    m = re.search(rf'\b{chave}\s*(?::[^=\n]*)?[:=]\s*\[([^\]]*)\]', txt)
    if not m: raise TerrenoIndisponivel(f'nao achei a lista {chave} em {caminho}')
    return [float(t) for t in re.findall(r'-?[0-9.]+', m.group(1))]


def _ts_fileiras(caminho, chave):
    txt = open(p_ts(caminho), encoding='utf-8').read()
    m = re.search(rf'\b{chave}\b[^=]*=\s*\[(.*?)\n\]', txt, re.S)
    if not m: raise TerrenoIndisponivel(f'nao achei as fileiras {chave} em {caminho}')
    return [(float(a.group(1)), int(a.group(2)), int(a.group(3))) for a in
            re.finditer(r'\{\s*r:\s*(-?[0-9.]+)\s*,\s*sentido:\s*([+-]?1)\s*,\s*tier:\s*([0-9]+)', m.group(1))]


def _ts_ilhas(caminho, chave):
    txt = open(p_ts(caminho), encoding='utf-8').read()
    m = re.search(rf'\b{chave}\b[^=]*=\s*\[(.*?)\n\]', txt, re.S)
    if not m: raise TerrenoIndisponivel(f'nao achei as ilhas {chave} em {caminho}')
    return [(float(a.group(1)), float(a.group(2)), float(a.group(3)),
             [float(t) for t in a.group(4).split(',')]) for a in
            re.finditer(r"x:\s*(-?[0-9.]+)\s*,\s*z:\s*(-?[0-9.]+)\s*,\s*giro:\s*(-?[0-9.]+)\s*,\s*r:\s*\[([^\]]*)\]", m.group(1))]


def ler_ts(caminho, chaves):
    txt = open(p(caminho), encoding='utf-8').read()
    out = {}
    for k in chaves:
        # ⚠️ O VALOR PODE VIR DENTRO DE UMA CHAMADA. `park-site.ts` escreve
        # `const BEARING = THREE.MathUtils.degToRad(43)`, e um regex que só aceita
        # número solto cairia no default em silêncio, que é a mesma doença que
        # este script existe para pegar.
        # ⚠️ O PREFIXO DA CHAMADA NÃO PODE ACEITAR DÍGITO. Com `[A-Za-z0-9_.]*`
        # o prefixo comia o próprio número (`4500` -> prefixo `450`, valor `0`) e
        # o script passou a ler zero em tudo, calado. O prefixo tem de começar por
        # letra e terminar em parêntese, ou não existir.
        mm = re.search(rf'{k}\s*=\s*(?:[A-Za-z_][A-Za-z0-9_.]*\()?\s*(-?[0-9.]+)', txt)
        if mm: out[k] = float(mm.group(1))
        else: print(f'  aviso: nao achei {k} em {caminho}')
    return out


# ── A PONTA DO GERADOR, LIDA DO PRÓPRIO GERADOR ────────────────────────────
_QUERO_CONST = ('VEX_CIDADE', 'VEX_HORIZONTE', 'VEX_R_CIDADE', 'VEX_R_HORIZONTE',
                'PLATO_R', 'PLATO_FUNDE', 'PODIO_Y', 'PODIO_R0', 'PODIO_R1',
                'PODIO_R2', 'PODIO_R3', 'PODIO_R3_PARQUE')
# ⚠️ FILTRO POR ALVO DA ATRIBUIÇÃO, NUNCA POR PREFIXO DE LINHA. Até 22/09 este
# arquivo pescava as constantes com `l.startswith(('VEX_', 'PLATO_R, PLATO_FUNDE',
# 'PODIO_'))`, ou seja casava o TEXTO da linha inteira. No dia em que o gerador
# passou a LER o platô da cena, a linha virou `PLATO_R     = _ts_const(...)`, o
# prefixo `'PLATO_R, PLATO_FUNDE'` deixou de casar, `G['PLATO_R']` virou
# KeyError e o conferidor parou de rodar com traceback. Conferidor que quebra
# quando o código melhora vira conferidor desligado, que foi o que aconteceu.
# Agora o filtro olha o LADO ESQUERDO do `=` e o valor é executado com os
# leitores da cena no escopo, então literal e `_ts_const(...)` funcionam iguais.
_ALVO = re.compile(r'^([A-Z_][A-Z_0-9]*(?:\s*,\s*[A-Z_][A-Z_0-9]*)*)\s*=\s*\S')


def _consts_do_gerador(src):
    G = {'_ts_const': _ts_const, 'math': math}
    for l in src.split('\n'):
        m = _ALVO.match(l)
        if not m or not any(t.strip() in _QUERO_CONST for t in m.group(1).split(',')): continue
        try:
            exec(compile(l, '<constantes do gerador>', 'exec'), G)
        except Exception as e:
            raise TerrenoIndisponivel(f'nao consegui avaliar `{l.strip()[:70]}`: {e}')
    falta = [k for k in _QUERO_CONST if k not in G]
    if falta:
        raise TerrenoIndisponivel('o gerador nao expoe mais: ' + ', '.join(falta))
    return G


# ⚠️ A ALÇA E A ORLA DA BAÍA NÃO ERAM MODELADAS AQUI, E POR ISSO A TOLERÂNCIA DE
# 1,5 m NÃO QUERIA DIZER NADA NAQUELA FAIXA. Este conferidor reconstruía relevo
# cru, platô e pódio, e parava aí: contra a cena, que esculpe uma plataforma em
# −30 na alça e outra na orla da baía, o resíduo era de dezenas de metros, e a
# grade fixa mediria justamente isso como se fosse defeito, ou (pior) seria
# calibrada para tolerá-lo.
#
# ⚠️ E A SAÍDA NÃO É REESCREVER AS DUAS FUNÇÕES AQUI. Reimplementar medição fora
# do gerador é exatamente a doença que este arquivo existe para pegar; uma
# terceira cópia das mesmas fórmulas divergiria das outras duas em silêncio. O
# que ele faz é EXECUTAR o bloco do próprio gerador, o mesmo texto, com os
# mesmos leitores de constante da cena. Se o gerador mudar, isto muda junto.
def _carrega_esculpido(src):
    _ANC_INI, _ANC_FIM = 'ALCA_PLATAFORMA_Y = _ts_const', 'def altura(x, z):'
    # ⚠️ ÂNCORA QUE SOME NÃO PODE VIRAR TRACEBACK. O gerador é editado com
    # frequência e as duas âncoras são texto dele, não contrato: se uma sair de
    # lugar, este arquivo tem de DIZER que não conseguiu medir, e quem chama
    # reprova por INDISPONÍVEL. Morrer com ValueError faria o portão parecer
    # quebrado em vez de acusar.
    if _ANC_INI not in src or _ANC_FIM not in src:
        raise TerrenoIndisponivel(
            f'ancora sumiu do gerador: {"`"+_ANC_INI+"`" if _ANC_INI not in src else ""}'
            f'{" e " if _ANC_INI not in src and _ANC_FIM not in src else ""}'
            f'{"`"+_ANC_FIM+"`" if _ANC_FIM not in src else ""}')
    ini, fim = src.index(_ANC_INI), src.index(_ANC_FIM)
    if fim <= ini:
        raise TerrenoIndisponivel('o gerador trocou a ordem: `def altura` vem antes da alça')

    ns = {'math': math, 're': re, 'os': os, 'sys': sys,
          '_ts_const': _ts_const, '_ts_lista': _ts_lista,
          '_ts_fileiras': _ts_fileiras, '_ts_ilhas': _ts_ilhas,
          'ALCA_TERRA_ARCO': _ts_const('teia.ts', 'ALCA_TERRA'),
          'ALCA_R_BAIA': _ts_const('alca.ts', 'ALCA_R_BAIA'),
          'ALCA_R_MAR': _ts_const('alca.ts', 'ALCA_R_MAR'),
          'ALCA_PRAIA': _ts_const('alca.ts', 'ALCA_PRAIA_LARGURA')}
    try:
        exec(compile(src[ini:fim], 'gerar_cidade:esculpido', 'exec'), ns)
    except Exception as e:
        raise TerrenoIndisponivel(f'o bloco esculpido do gerador nao executa: {type(e).__name__}: {e}')
    for k in ('alca_altura', 'orla_baia_altura'):
        if k not in ns: raise TerrenoIndisponivel(f'o gerador nao define mais `{k}`')
    return ns


_CHAO = {}


def monta_chao():
    """reconstrói `altura(x, z)` do gerador e devolve {'altura', 'const', 'esc', 'avisos'}.

    Memoizada: o heightmap e o bloco esculpido são lidos uma vez por processo.
    Levanta `TerrenoIndisponivel` quando o gerador mudou de forma."""
    if _CHAO: return _CHAO
    avisos = []
    src = open(p('scripts/gerar_cidade.py'), encoding='utf-8').read()
    G = _consts_do_gerador(src)
    esc = _carrega_esculpido(src)

    m = json.load(open(p('public/lunar/btc-core-heightmap.json')))
    n, cell = m['cols'], m['cellSizeM']
    half = (n - 1) / 2
    alt = list(struct.unpack(f'<{n*n}f', open(p('public/lunar/btc-core-heightmap.f32'), 'rb').read(n*n*4)))
    Hh = lambda i, j: alt[min(n-1, max(0, j))*n + min(n-1, max(0, i))]

    VEX_C, VEX_H = G['VEX_CIDADE'], G['VEX_HORIZONTE']
    VEX_RC, VEX_RH = G['VEX_R_CIDADE'], G['VEX_R_HORIZONTE']
    PLATO_R, PLATO_FUNDE = G['PLATO_R'], G['PLATO_FUNDE']
    PY_, PR0, PR1 = G['PODIO_Y'], G['PODIO_R0'], G['PODIO_R1']
    PR2, PR3, PR3P = G['PODIO_R2'], G['PODIO_R3'], G['PODIO_R3_PARQUE']

    pk = ler_ts('app/city/plaza/park-site.ts', ['DIST', 'BEARING'])
    PCX = math.sin(math.radians(pk.get('BEARING', 43))) * pk.get('DIST', 11800)
    PCZ = -math.cos(math.radians(pk.get('BEARING', 43))) * pk.get('DIST', 11800)

    # ⚠️ A BACIA DO LAGO DA PRAÇA NÃO VEM DE GRAÇA, e é por isso que ela está
    # escrita aqui. O bloco executado acima para em `def altura`, então
    # `bacia_praca` é CARREGADA mas ninguém a chama: quem chama é a linha lá
    # embaixo. Sem ela este conferidor mede o gerador de ontem contra a cena de
    # hoje, o resíduo do anel r < 2.344 continua na tela e a leitura natural
    # vira "afrouxa a tolerância", que é o modo clássico de esconder
    # divergência neste repo.
    bacia = esc.get('bacia_praca')
    if bacia is None:
        avisos.append('o gerador ainda nao tem `bacia_praca`: a bacia do Lago da Praca sai da '
                      'conta e o residuo em r < 2.344 e do GERADOR, nao deste conferidor')
        bacia = lambda r: 0.0

    def exagero_em(r):
        if r <= VEX_RC: return VEX_C
        if r >= VEX_RH: return VEX_H
        t = (r - VEX_RC) / (VEX_RH - VEX_RC)
        return VEX_C + (VEX_H - VEX_C) * (t*t*(3-2*t))

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

    def _esculpe(x, z, base):
        """a alça primeiro, a orla da baía por fora: a MESMA ordem de `altura()` no
        gerador e de `heightAt` em terrain.ts. Trocar a ordem apaga as pontas dos
        dedos, que é o motivo de ela estar escrita em três lugares."""
        return esc['orla_baia_altura'](x, z, esc['alca_altura'](x, z, base))

    def altura(x, z):
        fi = min(n-1.001, max(0, x/cell+half)); fj = min(n-1.001, max(0, z/cell+half))
        i, j = int(fi), int(fj); u, v = fi-i, fj-j
        b = (Hh(i,j)*(1-u)*(1-v) + Hh(i+1,j)*u*(1-v) + Hh(i,j+1)*(1-u)*v + Hh(i+1,j+1)*u*v) * exagero_em(math.hypot(x, z))
        r = math.hypot(x, z)
        if r < PLATO_FUNDE:
            b = 0.0 if r <= PLATO_R else b * ((lambda t: t*t*(3-2*t))((r - PLATO_R) / (PLATO_FUNDE - PLATO_R)))
        # ⚠️ A BACIA ENTRA AQUI, na mesma posição de `bbAt` (terrain.ts) e de
        # `altura()` no gerador: DEPOIS do platô e ANTES do pódio. Trocar a
        # ordem com o pódio mudaria a cota de todo o anel do platô.
        b -= bacia(r)
        w = podio_peso(x, z)
        return _esculpe(x, z, b*(1.0-w) + PY_*w)

    _CHAO.update({'altura': altura, 'const': G, 'esc': esc, 'avisos': avisos,
                  'fonte': p('scripts/gerar_cidade.py'), 'src': src})
    return _CHAO


# ⚠️ AMOSTRAR SÓ ONDE O LOTE NASCE DEIXOU PASSAR 43 METROS. Até 20/09 nenhum
# lote ia além de φ 5.500, então a alça inteira ficava fora desta amostra, e o
# erro de 43 m entre a plataforma que a cena esculpe (-30) e o pódio que o
# gerador aplicava (+13) atravessou esta conferência sem um aviso (masterplan
# §21). Conferência que não amostra onde o defeito mora não é conferência.
#
# Agora a amostra tem DUAS partes: os lotes gravados, que é onde a cidade está,
# e uma grade fixa de rumos e raios que cobre o sítio inteiro, inclusive a alça,
# o cinturão e a coroa, que é onde a cidade AINDA NÃO está mas o chão já é
# desenhado.
GRADE_RUMOS = range(0, 360, 5)
GRADE_RAIOS = list(range(600, 9000, 200))
# ⚠️ OS CORTES DA CAUDA ESTÃO ESCRITOS AQUI, ANTES DA RODADA, de propósito.
# Critério escolhido depois de ver o número vira critério que cabe no número.
CAUDA_FRACAO = 0.005      # no máximo 0,5% dos lotes acima da tolerância
CAUDA_PIOR = 10.0         # e o pior lote no máximo a 10 tolerâncias do chão
CAUDA_TOL = lambda tol: CAUDA_PIOR * tol


def main():
    TOL = float(arg('tolerancia', '1.5'))          # metros
    TOPO = arg('topo', '/tmp/topo')
    falhas = []

    try:
        chao = monta_chao()
    except TerrenoIndisponivel as e:
        print(f'INDISPONIVEL: {e}')
        print('  o chao do gerador nao pode ser reconstruido, entao NADA foi medido.')
        print('  isto NAO e aprovacao: rode de novo depois de conferir as ancoras.')
        return 1
    altura = chao['altura']
    for a in chao['avisos']: print(f'  aviso: {a}')

    if not os.path.exists(f'{TOPO}/topo.json'):
        print(f'INDISPONIVEL: nao achei {TOPO}/topo.json.')
        print('  rode antes, com o dev server no ar:')
        print('    node scripts/city/topo.mjs --n=1400 --raio=7200 --saida=' + TOPO)
        return 1
    meta = json.load(open(f'{TOPO}/topo.json'))
    n2, raio, cel2 = meta['n'], meta['raio'], meta['celulaM']
    H2 = struct.unpack(f'<{n2*n2}f', open(f'{TOPO}/topo.f32', 'rb').read())
    def cena(x, z):
        i = int(round((x + raio) / cel2)); j = int(round((z + raio) / cel2))
        return H2[j * n2 + i] if 0 <= i < n2 and 0 <= j < n2 else None

    G = chao['const']
    print(f'gerador: exagero {G["VEX_CIDADE"]} -> {G["VEX_HORIZONTE"]} entre '
          f'r {G["VEX_R_CIDADE"]:.0f} e {G["VEX_R_HORIZONTE"]:.0f}; '
          f'plato {G["PLATO_R"]} -> {G["PLATO_FUNDE"]}; '
          f'podio {G["PODIO_Y"]:.0f} m de {G["PODIO_R0"]:.0f} a {G["PODIO_R3"]:.0f}')

    ts = ler_ts('app/city/plaza/vex.ts', ['VEX_CIDADE', 'VEX_HORIZONTE', 'VEX_R_CIDADE', 'VEX_R_HORIZONTE'])
    tt = ler_ts('app/city/plaza/terrain.ts', ['PLATO_R', 'PLATO_FIM'])
    td = ler_ts('app/city/plaza/dome.ts', ['PODIO_Y', 'PODIO_R0', 'PODIO_R1', 'PODIO_R2', 'PODIO_R3', 'PODIO_R3_PARQUE'])
    print(f'cena:    exagero {ts.get("VEX_CIDADE")} -> {ts.get("VEX_HORIZONTE")} entre '
          f'r {ts.get("VEX_R_CIDADE"):.0f} e {ts.get("VEX_R_HORIZONTE"):.0f}; '
          f'plato {tt.get("PLATO_R"):.0f} -> {tt.get("PLATO_FIM"):.0f}')

    for nome, a, b in [('VEX_CIDADE', G['VEX_CIDADE'], ts.get('VEX_CIDADE')),
                       ('VEX_HORIZONTE', G['VEX_HORIZONTE'], ts.get('VEX_HORIZONTE')),
                       ('VEX_R_CIDADE', G['VEX_R_CIDADE'], ts.get('VEX_R_CIDADE')),
                       ('VEX_R_HORIZONTE', G['VEX_R_HORIZONTE'], ts.get('VEX_R_HORIZONTE')),
                       ('PLATO_R', G['PLATO_R'], tt.get('PLATO_R')),
                       ('PLATO_FIM', G['PLATO_FUNDE'], tt.get('PLATO_FIM')),
                       ('PODIO_Y', G['PODIO_Y'], td.get('PODIO_Y')),
                       ('PODIO_R0', G['PODIO_R0'], td.get('PODIO_R0')),
                       ('PODIO_R1', G['PODIO_R1'], td.get('PODIO_R1')),
                       ('PODIO_R2', G['PODIO_R2'], td.get('PODIO_R2')),
                       ('PODIO_R3', G['PODIO_R3'], td.get('PODIO_R3')),
                       ('PODIO_R3_PARQUE', G['PODIO_R3_PARQUE'], td.get('PODIO_R3_PARQUE'))]:
        if b is None or abs(a - b) > 1e-6: falhas.append(f'{nome}: gerador {a} contra cena {b}')

    # ── A BORDA DA BACIA NÃO TEM CONSTANTE NOMEADA NA CENA, e por isso ela é o
    # único par que os dois lados COPIAM em vez de ler: `R_AGUA_OUT = LAGO_R1 +
    # 40` e `R_CIDADE_SECA = R_AGUA_OUT + 950` são expressões, não `const` com
    # nome. Então a trava é sobre o TEXTO das duas expressões, dos dois lados:
    # no dia em que a cena alargar a subida da cidade, o portão grita em vez de
    # o registro mentir em silêncio.
    _cena_txt = open(p('app/city/plaza/terrain.ts'), encoding='utf-8').read()
    for _nome, _re in (('R_AGUA_OUT', r'R_AGUA_OUT\s*=\s*LAGO_R1\s*\+\s*(-?[0-9.]+)'),
                       ('R_CIDADE_SECA', r'R_CIDADE_SECA\s*=\s*R_AGUA_OUT\s*\+\s*(-?[0-9.]+)')):
        _a = re.search(_re, chao['src'])
        _b = re.search(_re, _cena_txt)
        if not _b: falhas.append(f'{_nome}: nao achei a expressao na cena (terrain.ts mudou de forma)')
        elif not _a: falhas.append(f'{_nome}: nao achei a expressao no gerador (a bacia saiu de la?)')
        elif abs(float(_a.group(1)) - float(_b.group(1))) > 1e-6:
            falhas.append(f'{_nome}: gerador soma {_a.group(1)} e a cena soma {_b.group(1)}')

    # ── a amostra: onde o lote de fato nasce ──────────────────────────────
    FMT = '<hhBBHBHHH'; REG = struct.calcsize(FMT)   # registro v3: 15 B, frente/fundo em dm
    buf = open(p('public/city/cidade-lotes.bin'), 'rb').read()
    difs = []
    for k in range(0, len(buf)//REG, 3):
        x4, z4, *_ = struct.unpack_from(FMT, buf, k*REG)
        # ⚠️ registro v3: a posição é em QUARTOS DE METRO (ver tecido.ts)
        x, z = x4 / 4.0, z4 / 4.0
        c = cena(x, z)
        if c is None: continue
        difs.append(abs(c - altura(x, z)))
    # a segunda metade da amostra: a grade fixa, que cobre onde ainda não há lote
    gdifs, gpior = [], (0.0, 0.0, 0.0)
    for ru in GRADE_RUMOS:
        for rr in GRADE_RAIOS:
            a_ = math.radians(ru)
            x, z = math.sin(a_) * rr, -math.cos(a_) * rr
            c = cena(x, z)
            if c is None: continue
            d = abs(c - altura(x, z))
            gdifs.append(d)
            if d > gpior[0]: gpior = (d, ru, rr)
    gdifs.sort()
    if gdifs:
        print(f'\n{len(gdifs)} pontos da GRADE (rumo a cada 5 graus, raio a cada 200 m), '
              f'|cena - gerador|:')
        print(f'   mediana {gdifs[len(gdifs)//2]:.2f} m   p90 {gdifs[int(len(gdifs)*.9)]:.2f} m   '
              f'max {gdifs[-1]:.2f} m   no rumo {gpior[1]:.0f} raio {gpior[2]:.0f}')
        _fora = sum(1 for d in gdifs if d > TOL)
        print(f'   acima de {TOL} m: {_fora} ({100*_fora/len(gdifs):.1f}%)')
        if _fora > len(gdifs) * 0.02:
            falhas.append(f'grade: {_fora} pontos acima de {TOL} m, pior {gdifs[-1]:.2f} m')

    difs.sort()
    if difs:
        med = difs[len(difs)//2]; p90 = difs[int(len(difs)*.9)]; p99 = difs[int(len(difs)*.99)]
        _fora = sum(1 for d in difs if d > TOL)
        print(f'\n{len(difs)} lotes amostrados, |cena - gerador|:')
        print(f'   mediana {med:.2f} m   p90 {p90:.2f} m   p99 {p99:.2f} m   max {difs[-1]:.2f} m')
        print(f'   acima de {TOL} m: {_fora} ({100*_fora/len(difs):.1f}%), '
              f'corte {CAUDA_FRACAO*100:.1f}%; pior admitido {CAUDA_TOL(TOL):.1f} m')
        # ⚠️ A MEDIANA É CEGA A DEFEITO LOCALIZADO, E FOI ASSIM QUE 8.171 COTAS
        # ERRADAS ATRAVESSARAM ESTA CONFERÊNCIA. Em 22/09 o registro selado tinha
        # 12,2% dos lotes do tecido com a cota a mais de 1,5 m do chão desenhado,
        # 1.644 deles acima de 30 m e o pior em 56,6 m, e a MEDIANA era 0,00:
        # metade da cidade fechava perfeito e a outra ponta estava 56 m no ar.
        # Defeito de chão nunca é uniforme, ele mora na FEIÇÃO (bacia, vala,
        # pódio, plataforma), então o que reprova tem de ser a CAUDA.
        if med > TOL: falhas.append(f'mediana {med:.2f} m acima da tolerancia de {TOL} m')
        if _fora > len(difs) * CAUDA_FRACAO:
            falhas.append(f'{_fora} lotes ({100*_fora/len(difs):.1f}%) acima de {TOL} m, '
                          f'p99 {p99:.2f} m, pior {difs[-1]:.2f} m '
                          f'(corte: {CAUDA_FRACAO*100:.1f}%)')
        if difs[-1] > CAUDA_TOL(TOL):
            falhas.append(f'pior lote a {difs[-1]:.2f} m do chao desenhado '
                          f'(corte: {CAUDA_TOL(TOL):.1f} m)')

    if falhas:
        print('\nREPROVADO:'); [print('  - ' + f) for f in falhas]; return 1
    print('\nas duas pontas medem o mesmo chao (dentro da tolerancia).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
