#!/usr/bin/env python3
"""Mede a impressao 'Patrocinador unico' (ancora) de forma independente.
Uso: python3 ancora.py <etapa>
Cache compacto de tx em CACHE (jsonl) para nao repetir chamada ao no.
"""
import json, sys, os, random, base64, http.client
from collections import Counter, defaultdict

BASE = '/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/data/snapshots/'
SCR = '/tmp/dogcity_ancora_cache/'
import os as _os; _os.makedirs(SCR, exist_ok=True)
CACHE = SCR + 'txcache.jsonl'
ANCORA = 'bc1pqdtrwkjwdutzs5z8f75gc5srhcwewx4u77pdnumc0fh7l47aanqqa8n4da'
MKT = ['bc1pjywvrxfrsr25dkl9gmtuy8w7w8a7mg7vz0j89v3g6d0x8suvgg6qdchqul',
       'bc1pacdg0ayufh9qlyx52w73eejpka8srsgnuwraaeu2t8mlf3h70tkq0keg74',
       'bc1pud2j5tpy5s3c5u6y7e2lqn8tp5208q0mmxjtjqncmzp9wyj5gssswnz8nk']
AIR_BASE = 88980600000  # 889806 DOG em unidades base (5 decimais)

def carrega_utxos():
    return json.load(open(BASE + 'dog_snapshot_966670_utxos.json'))['por_endereco']

def carrega_ordem():
    return json.load(open(BASE + 'dog_snapshot_966670_ordem.json'))['ordem']

# ---------------- cache ----------------
_cache = None
def cache():
    global _cache
    if _cache is None:
        _cache = {}
        if os.path.exists(CACHE):
            for ln in open(CACHE):
                try:
                    r = json.loads(ln)
                except Exception:
                    continue
                _cache[r['txid']] = r
    return _cache

def compacta(t):
    ins = []
    for v in t['vin']:
        p = v.get('prevout') or {}
        a = (p.get('scriptPubKey') or {}).get('address')
        ins.append([a, int(round(p.get('value', 0) * 1e8))])
    outs = []
    for v in t['vout']:
        a = (v['scriptPubKey'] or {}).get('address')
        outs.append([a, int(round(v['value'] * 1e8)),
                     1 if (v['scriptPubKey'].get('type') == 'nulldata') else 0])
    return {'txid': t['txid'], 'ins': ins, 'outs': outs}

def rpc(txids):
    """busca o que falta no cache"""
    c = cache()
    falta = sorted({t for t in txids if t not in c})
    if not falta:
        return
    cook = open(os.path.expanduser('~/.bitcoin/.cookie')).read().strip()
    auth = 'Basic ' + base64.b64encode(cook.encode()).decode()
    f = open(CACHE, 'a')
    for i in range(0, len(falta), 200):
        lote = falta[i:i + 200]
        body = json.dumps([{"jsonrpc": "1.0", "id": t, "method": "getrawtransaction",
                            "params": [t, 2]} for t in lote])
        cn = http.client.HTTPConnection('127.0.0.1', 8332, timeout=600)
        cn.request('POST', '/', body, {'Authorization': auth, 'Content-Type': 'application/json'})
        resp = json.loads(cn.getresponse().read())
        cn.close()
        for e in resp:
            if e.get('result'):
                r = compacta(e['result'])
                c[r['txid']] = r
                f.write(json.dumps(r) + '\n')
        f.flush()
        print('  lote %d/%d, cache=%d' % (i // 200 + 1, (len(falta) + 199) // 200 + 0, len(c)),
              file=sys.stderr)
    f.close()

# ---------------- medidas por tx ----------------
def ins_addrs(r):
    return {a for a, v in r['ins'] if a}

def patrocinador(r):
    """input de maior valor em sat que TAMBEM recebe troco em BTC (>546 sat) na mesma tx.
    generico, sem usar rotulo."""
    outs = defaultdict(int)
    for a, v, nd in r['outs']:
        if a:
            outs[a] += v
    cand = sorted([(v, a) for a, v in r['ins'] if a], reverse=True)
    for v, a in cand:
        if outs.get(a, 0) > 546:
            return a
    return cand[0][1] if cand else None

def e_pacote(base_units):
    """valor reduz a fracao de denominador <= 10.000 sobre a alocacao"""
    from math import gcd
    g = gcd(int(base_units), AIR_BASE)
    return (AIR_BASE // g) <= 10000

def amostra(lst, k, seed):
    r = random.Random(seed)
    return lst if len(lst) <= k else r.sample(lst, k)

def mede(addr, utxos, k=12, seed=966670):
    sam = amostra(utxos, k, seed)
    rpc([x['txid'] for x in sam])
    c = cache()
    n = anc = ancx = nx = pat_top = 0
    pats = Counter()
    pacote = 0
    for x in sam:
        r = c.get(x['txid'])
        if not r:
            continue
        n += 1
        ia = ins_addrs(r)
        externo = addr not in ia          # credito externo de verdade
        if externo:
            nx += 1
        if ANCORA in ia:
            anc += 1
            if externo:
                ancx += 1
        p = patrocinador(r)
        if p:
            pats[p] += 1
        # pacote: valor do vout creditado
        try:
            v = r['outs'][x['vout']]
            pacote += 1 if e_pacote(round(x['dog'] * 1e5)) else 0
        except Exception:
            pass
    if n == 0:
        return None
    dom, domn = pats.most_common(1)[0] if pats else (None, 0)
    return {'n': n, 'nx': nx, 'anc': anc / n, 'ancx': (ancx / nx if nx else None),
            'dom': dom, 'domf': domn / n, 'dom_tem_dog': None,
            'pacote': pacote / n}

# ---------------- auditoria (rode: python3 scripts/regua/ancora_audit.py) ----------------
if __name__ == '__main__':
    O = carrega_ordem(); PE = carrega_utxos(); byp = {x['posicao']: x for x in O}
    H = {x['address']: x for x in O}
    ROT = [(6,'CoinEx dep'),(10,'distrib A'),(11,'distrib B'),(16,'distrib C?'),(18743,'Gate hot'),
           (82761,'Kraken hot'),(82762,'treasury'),(82764,'desk'),(82789,'mkt1'),(83041,'mkt2'),
           (83064,'mkt3'),(83960,'Bitget hot'),(18,'ctrl pos18'),(311,'ctrl pos311')]
    print('%-12s %6s %5s %5s %6s %6s' % ('alvo','pos','n','next','anc%','pacote%'))
    for p, nome in ROT + [(i, 'top%d' % i) for i in range(1, 21)]:
        a = byp[p]['address']; m = mede(a, PE.get(a, []), k=26)
        if not m: print('%-12s %6d  sem amostra' % (nome, p)); continue
        print('%-12s %6d %5d %5d %5.0f%% %6.0f%%' % (nome, p, m['n'], m['nx'], m['anc']*100, m['pacote']*100))
    # natureza da ancora: beneficiario constante
    c = cache(); anc = [r for r in c.values() if ANCORA in ins_addrs(r)]
    P1 = byp[1]['address']
    ben = sum(1 for r in anc if any(x[0] == P1 and x[1] <= 1000 for x in r['outs']))
    pg = sum(1 for r in anc if any(x[0] and x[1] > 1000 and x[0] != ANCORA for x in r['outs']))
    print('\nancora: %d tx no cache, pos1 recebe rune em %d (%.0f%%), tx com pagamento em BTC a terceiro: %d'
          % (len(anc), ben, 100*ben/max(len(anc),1), pg))
