#!/usr/bin/env python3
"""
CUSTODIA NA FILA RESIDENCIAL: mede no no + no indice da casa quem, entre as
maiores carteiras que recebem LOTE DE MORADOR, se comporta como custodia.

Pergunta que esta ferramenta responde, e so ela: das N maiores carteiras da fila
residencial que NAO tem rotulo e NAO estao na tag institucional, quais batem os
sinais de custodia do masterplan secao 12.1, e com que numero.

⚠️ SO LE. Nao escreve em public/, data/, supabase/ nem no gerador. Saida em
stdout e, com --json, no caminho que voce passar.

⚠️ NAO TOCA no ord.service nem no redb. O no entra aqui por bitcoin-cli
(getrawtransaction/getblockheader), que e leitura pura. O grafo de runes vem de
`dog_transactions`, que e o indice que o dog_scanner ja destilou do no.

─────────────────────────────────────────────────────────────────────────────
AS QUATRO MEDIDAS, E O QUE CADA UMA VALE

  a. destinos   enderecos distintos que a carteira JA PAGOU, pela regra do
                delta (so conta saida em tx onde o DOG da carteira diminuiu,
                destino com has_dog e sem is_change; troco nao e transferencia).
                E a trava de saida da regra: quem nunca pagou ninguem nao pode
                ser acusado de mover dinheiro alheio.

  b. sobreposicao  |pagadores ∩ destinos| / |destinos|. Cliente de corretora
                deposita de um endereco e saca para OUTRO, entao o valor e BAIXO
                na corretora e ALTO no marketplace, onde o vendedor recebe de
                volta o que nao vendeu. Calibrada em 13/09: pessoa 0%, CoinEx 2%,
                ponte Stacks 63%.

  c. ritmo      R de Rayleigh sobre a hora UTC dos DEPOSITOS. Servico opera 24 h,
                pessoa dorme.

     ⚠️ DUAS ARMADILHAS MEDIDAS, e as duas derrubam o limiar fixo de R < 0,15:

       1. R esperado sob uniformidade e 0,886/raiz(n). Em n pequeno o limiar fixo
          e ruido puro, e por isso a regra exige n >= 100. Isso a secao 12.1 ja
          dizia.
       2. O QUE A SECAO 12.1 NAO DIZIA: em n GRANDE o limiar fixo inverte de
          sinal. Com n = 548, R = 0,115 da Z = n·R² = 7,3 e p = 0,0007, ou seja
          pico diario ESTATISTICAMENTE SIGNIFICATIVO, que e assinatura de gente
          num fuso, nao de mesa 24 h. Por isso esta ferramenta imprime Z e p
          junto de R, e a leitura honesta e por p, nunca por R sozinho.

     ⚠️ E O VIES DE FUNDO: o horario do deposito e o relogio de QUEM PAGA, nao o
        do dono da carteira. Carteira com muitos pagadores espalhados pelo mundo
        da R baixo mesmo sendo de uma pessoa so. O ritmo separa "um pagador num
        fuso" de "muitos pagadores", nao "servico" de "pessoa".

  d. lth_pct    quanto do saldo e antigo, direto do snapshot.

     ⚠️ ARMADILHA MEDIDA AQUI (22/09): lth_pct mede a idade do UTXO, NAO a idade
        da posse. Carteira que consolida sozinha o tempo todo aparece com
        lth 0,03% sem nunca ter vendido nada. Provado em
        bc1pczdz…: a UTXO de 775.193.446 DOG que responde por quase todo o saldo
        dela nasceu da tx 350a7e4b… (altura 964.365), cuja PRIMEIRA ENTRADA e a
        propria bc1pczdz…. lth baixo sozinho nao e sinal de custodia.

─────────────────────────────────────────────────────────────────────────────
A LICAO QUE MANDA (masterplan secao 12.1): rotulo e infraestrutura, heuristica
e ultimo recurso. Esta ferramenta existe para achar quem MERECE ROTULO, nao para
substituir o rotulo. Duas regras duras na leitura da saida:

  - um sinal so e SUSPEITA, nunca acusacao. Precisa de DOIS.
  - tirar terra de uma pessoa honesta e pior que deixar uma corretora passar.

Uso:
  python3 scripts/city/custodia_no.py --topo 40
  python3 scripts/city/custodia_no.py --topo 15 --json /tmp/custodia.json
  python3 scripts/city/custodia_no.py --enderecos bc1p...,bc1q...
"""

import argparse
import base64
import collections
import http.client
import io
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SNAP = os.path.join(RAIZ, 'data', 'snapshots')
ORDEM_RES = os.path.join(SNAP, 'dog_966670_ordem_residencial.json')
TAG_INST = os.path.join(SNAP, 'dog_966670_tag_institucional.json')

PAGINA = 1000
TETO_LINHAS = int(os.environ.get('TETO_LINHAS', '40000'))
PAUSA = float(os.environ.get('PAUSA', '0.12'))


# ── credenciais ──────────────────────────────────────────────────────────────

def ambiente():
    env = {}
    for arq in ('.env.local', '.env'):
        p = os.path.join(RAIZ, arq)
        if not os.path.exists(p):
            continue
        for linha in io.open(p, encoding='utf-8', errors='ignore'):
            linha = linha.strip()
            if '=' in linha and not linha.startswith('#'):
                k, v = linha.split('=', 1)
                env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    return env


def auth_no():
    """cookie do bitcoind, ou rpcuser/rpcpassword do bitcoin.conf"""
    cookie = os.path.expanduser('~/.bitcoin/.cookie')
    if os.path.exists(cookie):
        return base64.b64encode(io.open(cookie, 'rb').read().strip()).decode()
    u = p = None
    conf = os.path.expanduser('~/.bitcoin/bitcoin.conf')
    if os.path.exists(conf):
        for linha in io.open(conf):
            if linha.startswith('rpcuser='):
                u = linha.split('=', 1)[1].strip()
            if linha.startswith('rpcpassword='):
                p = linha.split('=', 1)[1].strip()
    if not u:
        return None
    return base64.b64encode(f'{u}:{p}'.encode()).decode()


def rpc(metodo, params, _a=[None]):
    if _a[0] is None:
        _a[0] = auth_no()
    corpo = json.dumps({'jsonrpc': '2.0', 'id': 0, 'method': metodo, 'params': params})
    for tentativa in range(4):
        try:
            cx = http.client.HTTPConnection('127.0.0.1', 8332, timeout=120)
            cx.request('POST', '/', corpo,
                       {'Authorization': 'Basic ' + _a[0], 'Content-Type': 'application/json'})
            fora = json.loads(cx.getresponse().read())
            cx.close()
            return fora.get('result')
        except Exception:
            if tentativa == 3:
                raise
            time.sleep(2 * (tentativa + 1))


# ── indice de runes da casa ──────────────────────────────────────────────────

def linhas_do_endereco(env, addr):
    """toda tx de dog_transactions que toca o endereco.

    ⚠️ USA `cs.` do PostgREST, que e o operador @> e cai no indice GIN de
    `addresses`. `= any(...)` ignora o GIN: 20 s contra 12 ms (incidente de IO
    de 26/08).
    """
    url = env['SUPABASE_URL'].rstrip('/')
    key = env['SUPABASE_SERVICE_ROLE_KEY']
    fora = []
    for ini in range(0, TETO_LINHAS, PAGINA):
        q = urllib.parse.urlencode({
            'addresses': 'cs.{%s}' % addr,
            'select': 'txid,block_height,timestamp,senders,receivers',
        })
        req = urllib.request.Request(
            url + '/rest/v1/dog_transactions?' + q,
            headers={'apikey': key, 'Authorization': 'Bearer ' + key,
                     'Range-Unit': 'items', 'Range': '%d-%d' % (ini, ini + PAGINA - 1)})
        for tentativa in range(4):
            try:
                with urllib.request.urlopen(req, timeout=180) as z:
                    lote = json.loads(z.read())
                break
            except Exception:
                if tentativa == 3:
                    raise
                time.sleep(3 * (tentativa + 1))
        fora.extend(lote)
        if len(lote) < PAGINA:
            break
        time.sleep(PAUSA)
    return fora


def lista(campo):
    """senders/receivers chegam como TEXTO JSON dentro de uma coluna jsonb.

    ⚠️ E por isso que `senders -> 0 ->> 'address'` devolve vazio em silencio no
    banco: jsonb_typeof e 'string' nas 1.016.685 linhas, nao 'array'. Em SQL o
    caminho e `(senders #>> '{}')::jsonb`; aqui e json.loads duas vezes.
    """
    if campo is None:
        return []
    if isinstance(campo, str):
        try:
            campo = json.loads(campo)
        except Exception:
            return []
    if isinstance(campo, str):
        try:
            campo = json.loads(campo)
        except Exception:
            return []
    return campo if isinstance(campo, list) else []


def perfil(addr, linhas, ate_altura=None):
    pagadores, destinos = set(), set()
    n_dep = n_sai = 0
    cx = cy = 0.0
    recebido = enviado = 0.0
    primeiro = ultimo = None
    for d in linhas:
        if ate_altura is not None and (d.get('block_height') or 0) > ate_altura:
            continue
        S, R = lista(d.get('senders')), lista(d.get('receivers'))
        entra = sum(float(e.get('amount_dog') or 0) for e in R if e.get('address') == addr)
        sai = sum(float(e.get('amount_dog') or 0) for e in S if e.get('address') == addr)
        ts = d.get('timestamp')
        if ts:
            primeiro = ts if primeiro is None or ts < primeiro else primeiro
            ultimo = ts if ultimo is None or ts > ultimo else ultimo
        if entra > sai:
            n_dep += 1
            recebido += entra - sai
            for e in S:
                if e.get('address') != addr and e.get('has_dog'):
                    pagadores.add(e['address'])
            seg = segundos_do_dia(ts)
            if seg is not None:
                ang = 2 * math.pi * seg / 86400.0
                cx += math.cos(ang)
                cy += math.sin(ang)
        elif sai > entra:
            n_sai += 1
            enviado += sai - entra
            for e in R:
                if e.get('address') != addr and e.get('has_dog') and not e.get('is_change'):
                    destinos.add(e['address'])
    comum = pagadores & destinos
    R_ray = math.hypot(cx, cy) / n_dep if n_dep else float('nan')
    Z = n_dep * R_ray * R_ray if n_dep else float('nan')
    return {
        'tx': sum(1 for d in linhas
                  if ate_altura is None or (d.get('block_height') or 0) <= ate_altura),
        'n_dep': n_dep, 'n_saida': n_sai,
        'pagadores': len(pagadores), 'destinos': len(destinos), 'comum': len(comum),
        'sobrep': (len(comum) / len(destinos)) if destinos else 0.0,
        'recebido': recebido, 'enviado': enviado,
        'R': R_ray,
        'R_esperado_uniforme': (0.886 / math.sqrt(n_dep)) if n_dep else float('nan'),
        'rayleigh_Z': Z,
        'rayleigh_p': math.exp(-Z) if n_dep else float('nan'),
        'primeiro': primeiro, 'ultimo': ultimo,
    }


def segundos_do_dia(ts):
    if not ts:
        return None
    try:
        hhmmss = ts.split('T')[1] if 'T' in ts else ts.split(' ')[1]
        hhmmss = hhmmss.split('+')[0].split('.')[0]
        h, m, s = (int(x) for x in hhmmss.split(':'))
        return h * 3600 + m * 60 + s
    except Exception:
        return None


# ── sinais ───────────────────────────────────────────────────────────────────

def sinais(p, lth_pct):
    """os quatro sinais da regra, cada um com o numero que o sustenta.

    Devolve (fortes, fracos). Sinal fraco NAO conta para o par: lth baixo e
    consequencia de consolidacao, nao prova de custodia.
    """
    fortes, fracos = [], []
    if p['destinos'] >= 300:
        fortes.append('fluxo: %d destinos' % p['destinos'])
    if p['destinos'] >= 10 and p['sobrep'] >= 0.50:
        fortes.append('deposito e resgate: %.0f%%' % (p['sobrep'] * 100))
    if p['n_dep'] >= 100 and p['R'] < 0.15:
        # ⚠️ p alto = compativel com 24 h. p baixo = pico diario, e ai o R baixo
        # esta mentindo por causa do n grande.
        if p['rayleigh_p'] >= 0.05:
            fortes.append('ritmo: n=%d R=%.3f p=%.2f' % (p['n_dep'], p['R'], p['rayleigh_p']))
        else:
            fracos.append('ritmo REPROVADO no p: n=%d R=%.3f Z=%.1f p=%.4f (pico diario real)'
                          % (p['n_dep'], p['R'], p['rayleigh_Z'], p['rayleigh_p']))
    if lth_pct is not None and lth_pct < 10:
        fracos.append('lth %.2f%% (pode ser so consolidacao)' % lth_pct)
    if p['destinos'] >= 100 and p['destinos'] < 300:
        fracos.append('fluxo abaixo do limiar: %d destinos' % p['destinos'])
    return fortes, fracos


def veredito(p, fortes):
    if not p['destinos']:
        return 'fora: trava de saida (nunca pagou ninguem)'
    if len(fortes) >= 2:
        return 'provada-no-no'
    if len(fortes) == 1:
        return 'suspeita'
    return 'limpa'


# ── entrada ──────────────────────────────────────────────────────────────────

def rotulos(env):
    url = env['SUPABASE_URL'].rstrip('/')
    key = env['SUPABASE_SERVICE_ROLE_KEY']
    req = urllib.request.Request(
        url + '/rest/v1/dog_labels?select=address,entity,role,kind,evidence,internal',
        headers={'apikey': key, 'Authorization': 'Bearer ' + key})
    with urllib.request.urlopen(req, timeout=60) as z:
        return {r['address']: r for r in json.loads(z.read())}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--topo', type=int, default=40,
                    help='quantas das maiores nao rotuladas medir')
    ap.add_argument('--enderecos', default=None,
                    help='lista separada por virgula, no lugar do topo')
    ap.add_argument('--ate-altura', type=int, default=None,
                    help='so conta tx ate esta altura (966670 = o snapshot)')
    ap.add_argument('--json', default=None)
    args = ap.parse_args()

    env = ambiente()
    if 'SUPABASE_URL' not in env:
        sys.exit('faltou SUPABASE_URL em .env.local')

    ordem = json.load(io.open(ORDEM_RES, encoding='utf-8'))['ordem']
    por_addr = {e['address']: e for e in ordem}
    inst = {l['address'] for l in json.load(io.open(TAG_INST, encoding='utf-8'))['linhas']}
    rot = rotulos(env)

    if args.enderecos:
        alvos = [a.strip() for a in args.enderecos.split(',') if a.strip()]
    else:
        cand = [e for e in ordem if e['address'] not in rot and e['address'] not in inst]
        cand.sort(key=lambda e: -e['dog'])
        alvos = [e['address'] for e in cand[:args.topo]]

    # ⚠️ o cruzamento que o gerador nao faz: rotulo NA FILA RESIDENCIAL.
    vazados = [e for e in ordem if e['address'] in rot]
    if vazados:
        print('ROTULADOS QUE RECEBEM LOTE RESIDENCIAL: %d' % len(vazados))
        for e in sorted(vazados, key=lambda x: -x['dog']):
            r = rot[e['address']]
            print('  %10.4f B  %9.1f m2  posres %6d  %s/%s/%s (%s)  %s'
                  % (e['dog'] / 1e9, e['area_m2'], e['posicao_residencial'],
                     r.get('entity') or '-', r.get('role') or '-', r['kind'],
                     r['evidence'], e['address']))
        print()

    saida = []
    print('%-4s %10s %9s %6s %6s %5s %6s %6s %6s %7s %8s  %s'
          % ('#', 'DOG(B)', 'area m2', 'lth%', 'tx', 'dep', 'pagad', 'dest',
             'sobr%', 'R', 'p', 'veredito'))
    for i, addr in enumerate(alvos, 1):
        e = por_addr.get(addr, {})
        linhas = linhas_do_endereco(env, addr)
        p = perfil(addr, linhas, args.ate_altura)
        lth = e.get('lth_pct')
        fortes, fracos = sinais(p, lth)
        v = veredito(p, fortes)
        print('%-4d %10.5f %9.1f %6.2f %6d %5d %6d %6d %6.0f %7.3f %8.4f  %s'
              % (i, e.get('dog', 0) / 1e9, e.get('area_m2', 0), lth if lth is not None else -1,
                 p['tx'], p['n_dep'], p['pagadores'], p['destinos'], p['sobrep'] * 100,
                 p['R'], p['rayleigh_p'], v))
        for s in fortes:
            print('      forte: %s' % s)
        for s in fracos:
            print('      fraco: %s' % s)
        if not linhas:
            print('      ⚠️ ZERO linhas em dog_transactions: buraco de indice, '
                  'confira a UTXO do snapshot no no antes de concluir qualquer coisa')
        saida.append(dict(address=addr, dog=e.get('dog'), area_m2=e.get('area_m2'),
                          lth_pct=lth, veredito=v, fortes=fortes, fracos=fracos, **p))

    if args.json:
        json.dump({'gerado': time.strftime('%Y-%m-%d'),
                   'ate_altura': args.ate_altura,
                   'nota': 'sinal forte conta para o par; fraco nao. '
                           'ritmo so vale com p >= 0,05.',
                   'linhas': saida},
                  io.open(args.json, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
        print('\njson em %s' % args.json)


if __name__ == '__main__':
    main()
