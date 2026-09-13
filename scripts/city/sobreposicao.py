#!/usr/bin/env python3
"""Varre o top 500 procurando ASSINATURA DE CUSTODIA pela SOBREPOSICAO entre quem paga e
quem recebe.

Calibrado contra verdade externa em 2026-09-13:
  pessoa (pos 22)         0%   372 pagadores, 191 destinos, ZERO em comum
  corretora (CoinEx)      2%   cliente deposita num endereco e saca para OUTRO
  ponte Stacks (conhecida) 63%  <- endereco dado pelo fundador
  pos 49                  69%

Regra do delta (lei do projeto): so conta saida em transacao onde o DOG da carteira DIMINUIU,
destino com has_dog e sem is_change. Troco nao e transferencia.

⚠️ Cuidado com IO do Supabase (incidente de 26/08): teto de linhas por carteira e pausa entre
chamadas. PostgREST com `cs.` usa o indice GIN de `addresses`.
"""
import json, io, os, time, urllib.request, urllib.parse, collections

RAIZ = '/home/bitmax/Projects/bitcoin-fullstack/DogData-v1'
SNAP = os.path.join(RAIZ, 'data', 'snapshots')
SCR = '/tmp/claude-1000/-home-bitmax-Projects-bitcoin-fullstack/df22a3c1-6af6-4f08-9816-452773b035e4/scratchpad'
TETO_LINHAS = int(os.environ.get('TETO_LINHAS', '4000'))
PAGINA = 1000
PAUSA = float(os.environ.get('PAUSA', '0.12'))
TOPO = int(os.environ.get('TOPO', '500'))

env = {}
for arq in ('.env.local', '.env'):
    p = os.path.join(RAIZ, arq)
    if not os.path.exists(p): continue
    for l in io.open(p, encoding='utf-8', errors='ignore'):
        l = l.strip()
        if '=' in l and not l.startswith('#'):
            k, v = l.split('=', 1)
            env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
URL = env['SUPABASE_URL'].rstrip('/')
KEY = env['SUPABASE_SERVICE_ROLE_KEY']

def pega(addr):
    """todas as tx de dog_transactions que tocam o endereco, com teto"""
    fora = []
    for ini in range(0, TETO_LINHAS, PAGINA):
        q = urllib.parse.urlencode({'addresses': 'cs.{%s}' % addr,
                                    'select': 'senders,receivers'})
        r = urllib.request.Request(URL + '/rest/v1/dog_transactions?' + q,
            headers={'apikey': KEY, 'Authorization': 'Bearer ' + KEY,
                     'Range-Unit': 'items', 'Range': '%d-%d' % (ini, ini + PAGINA - 1)})
        for t in range(4):
            try:
                with urllib.request.urlopen(r, timeout=120) as z:
                    lote = json.loads(z.read())
                break
            except Exception:
                if t == 3: raise
                time.sleep(3 * (t + 1))
        fora.extend(lote)
        if len(lote) < PAGINA: break
        time.sleep(PAUSA)
    return fora

def perfil(addr, linhas):
    pagou, recebeu = set(), set()
    vin = collections.Counter(); vout = collections.Counter()
    for d in linhas:
        try:
            S = json.loads(d['senders']) if isinstance(d['senders'], str) else d['senders']
            R = json.loads(d['receivers']) if isinstance(d['receivers'], str) else d['receivers']
        except Exception:
            continue
        meu_in = sum(float(e.get('amount_dog') or 0) for e in R if e.get('address') == addr)
        meu_out = sum(float(e.get('amount_dog') or 0) for e in S if e.get('address') == addr)
        delta = meu_in - meu_out
        if delta > 0:
            for e in S:
                a = e.get('address')
                if a and a != addr and e.get('has_dog'):
                    pagou.add(a); vin[a] += float(e.get('amount_dog') or 0)
        elif delta < 0:
            for e in R:
                a = e.get('address')
                if a and a != addr and e.get('has_dog') and not e.get('is_change'):
                    recebeu.add(a); vout[a] += float(e.get('amount_dog') or 0)
    comum = pagou & recebeu
    # razao de devolucao nas 20 maiores contrapartes que estao dos dois lados
    raz = []
    for a in sorted(comum, key=lambda a: -vin[a])[:20]:
        if vin[a] > 0: raz.append(round(vout[a] / vin[a], 3))
    return {'pagadores': len(pagou), 'destinos': len(recebeu), 'comum': len(comum),
            'sobrep': round(len(comum) / max(1, len(recebeu)), 3),
            'razoes': raz,
            'devolve_exato': sum(1 for r in raz if 0.90 <= r <= 1.10),
            'tx': len(linhas), 'contrapartes': sorted(pagou | recebeu)}

ordem = json.load(io.open(os.path.join(SNAP, 'dog_snapshot_966670_ordem.json'),
                          encoding='utf-8'))['ordem'][:TOPO]
EXTRA = {'bc1qlfedd4elqxpkd7sae45z8mltjwp0fw44sk0a20x4e7athh9yru3s6nmxm6': 'ponte Stacks',
         'bc1qmscmeqqxqz7vkfscfs8pvl98gkdkcr8e0egkhm': 'CoinEx'}
alvos = [(x['posicao'], x['address'], x['dog']) for x in ordem]
for a, n in EXTRA.items():
    if not any(t[1] == a for t in alvos): alvos.append((-1, a, 0))

saida = os.path.join(SNAP, 'dog_966670_sobreposicao.json')
feito = {}
if os.path.exists(saida):
    feito = {d['address']: d for d in json.load(io.open(saida, encoding='utf-8'))['linhas']}
    print('retomando de %d ja feitos' % len(feito), flush=True)

t0 = time.time()
res = list(feito.values())
for i, (pos, addr, dog) in enumerate(alvos):
    if addr in feito: continue
    try:
        p = perfil(addr, pega(addr))
    except Exception as e:
        print('  ERRO pos %s: %s' % (pos, e), flush=True); continue
    p.update({'posicao': pos, 'address': addr, 'dog': dog})
    res.append(p)
    if p['sobrep'] >= 0.30 and p['destinos'] >= 10:
        print('  ⚑ pos %-6s sobrep %.0f%%  %d/%d  devolve_exato %d  %s' %
              (pos, p['sobrep'] * 100, p['comum'], p['destinos'], p['devolve_exato'],
               EXTRA.get(addr, '')), flush=True)
    if (i + 1) % 25 == 0:
        dt = time.time() - t0
        print('  %d/%d  %.1f min decorridos' % (i + 1, len(alvos), dt / 60), flush=True)
        json.dump({'linhas': res}, io.open(saida, 'w', encoding='utf-8'), ensure_ascii=False)
    time.sleep(PAUSA)

json.dump({'linhas': res}, io.open(saida, 'w', encoding='utf-8'), ensure_ascii=False)
print('gravado: %s  (%d carteiras)' % (saida, len(res)), flush=True)
