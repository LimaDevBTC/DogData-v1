#!/usr/bin/env python3
"""Auditoria da impressao "Empurrao": a tx que credita a carteira tem 1 input e 2 outputs.
Uso: python3 scripts/regua/empurrao.py [rotulados|top20|controle|todos]
Mede, por carteira: empurrao cru (como proposto), empurrao restrito a CREDITO EXTERNO
(carteira nao aparece em nenhum vin), fracao de tx onde a propria carteira e input,
medianas de vin/vout e presenca de OP_RETURN. Cache em JSON para nao repetir RPC.
"""
import json, os, sys, base64, http.client, random, statistics, time
from collections import Counter

BASE = 'data/snapshots/'
CACHE = '/tmp/claude-1000/-home-bitmax-Projects-bitcoin-fullstack/df22a3c1-6af6-4f08-9816-452773b035e4/scratchpad/emp_cache.json'
AIR = 889806.0

O = {x['address']: x for x in json.load(open(BASE + 'dog_snapshot_966670_ordem.json'))['ordem']}
PE = json.load(open(BASE + 'dog_snapshot_966670_utxos.json'))['por_endereco']
H = {x['address']: x for x in json.load(open(BASE + 'dog_snapshot_966670.json'))['holders']}

ROT = [(6,'CoinEx/deposit'),(10,'distributor A'),(11,'distributor B'),(18743,'Gate.io/hot'),
       (82761,'Kraken/hot'),(82762,'treasury/cold'),(82764,'desk'),(82789,'marketplace 1'),
       (83041,'marketplace 2'),(83064,'marketplace 3'),(83960,'Bitget/hot')]
BYPOS = {x['posicao']: x['address'] for x in O.values()}

cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}

def rpc(txids):
    falta = [t for t in txids if t not in cache]
    if falta:
        cook = open(os.path.expanduser('~/.bitcoin/.cookie')).read().strip()
        auth = 'Basic ' + base64.b64encode(cook.encode()).decode()
        for i in range(0, len(falta), 200):
            lote = falta[i:i+200]
            body = json.dumps([{"jsonrpc":"1.0","id":t,"method":"getrawtransaction","params":[t,2]} for t in lote])
            c = http.client.HTTPConnection('127.0.0.1', 8332, timeout=600)
            c.request('POST', '/', body, {'Authorization': auth, 'Content-Type': 'application/json'})
            for e in json.loads(c.getresponse().read()):
                if e.get('result'):
                    t = e['result']
                    # guarda so o minimo: vin addresses, nvin, nvout, op_return, valores dos vout
                    cache[e['id']] = {
                        'nvin': len(t['vin']),
                        'nvout': len(t['vout']),
                        'vin_addr': sorted({((v.get('prevout') or {}).get('scriptPubKey') or {}).get('address')
                                            for v in t['vin']} - {None}),
                        'opret': sum(1 for v in t['vout'] if v['scriptPubKey'].get('type') == 'nulldata'),
                        'vout_addr': [(v['scriptPubKey'] or {}).get('address') for v in t['vout']],
                        'coinbase': any('coinbase' in v for v in t['vin']),
                    }
            c.close()
            print(f'   rpc {i+len(lote)}/{len(falta)}', file=sys.stderr)
        json.dump(cache, open(CACHE, 'w'))
    return cache

def amostra(addr, k, seed=11):
    u = PE.get(addr, [])
    if len(u) <= k:
        return list(u)
    return random.Random(seed).sample(u, k)

def medir(addr, k=12, seed=11):
    sam = amostra(addr, k, seed)
    rpc(sorted({x['txid'] for x in sam}))
    n = e12 = auto = ext = ext12 = opr12 = 0
    vins, vouts = [], []
    for x in sam:
        t = cache.get(x['txid'])
        if not t:
            continue
        n += 1
        vins.append(t['nvin']); vouts.append(t['nvout'])
        um2 = (t['nvin'] == 1 and t['nvout'] == 2)
        prop = addr in t['vin_addr']
        if um2: e12 += 1
        if prop: auto += 1
        else:
            ext += 1
            if um2: ext12 += 1
        if um2 and t['opret']: opr12 += 1
    if n == 0:
        return None
    return {'n': n, 'empurrao': e12/n, 'auto': auto/n,
            'ext': ext, 'empurrao_ext': (ext12/ext if ext else None),
            'e12': e12, 'ext12': ext12, 'opr12': opr12,
            'vin_med': statistics.median(vins), 'vout_med': statistics.median(vouts),
            'vin_max': max(vins)}

def linha(rot, pos, addr, k, seed=11):
    m = medir(addr, k, seed)
    if not m:
        return f'{rot:16s} pos {pos:>6} SEM DADO'
    ee = '   n/a' if m['empurrao_ext'] is None else f'{m["empurrao_ext"]*100:5.0f}%'
    return (f'{rot:16s} pos {pos:>6} n={m["n"]:3d}/{len(PE.get(addr,[])):5d} '
            f'empurrao={m["empurrao"]*100:5.1f}% ({m["e12"]}/{m["n"]})  '
            f'ext={m["ext"]:3d} empurrao_ext={ee} ({m["ext12"]}/{m["ext"]})  '
            f'auto={m["auto"]*100:5.1f}%  vin_med={m["vin_med"]:.0f} vout_med={m["vout_med"]:.0f} '
            f'vin_max={m["vin_max"]:3d}  op_ret_em_1x2={m["opr12"]}')


def censo(pos_list, rotulos=None):
    """empurrao medido em TODOS os utxos da carteira (sem amostra), mais anatomia."""
    import statistics as st
    from collections import Counter
    print(f"{'rotulo':16s} {'pos':>6s} {'ntx':>5s} {'emp%':>6s} {'auto%':>6s} {'npag':>5s} "
          f"{'vinmed':>6s} {'voutmed':>7s} {'vinmax':>6s} {'1x2_opret':>9s}")
    for i, pos in enumerate(pos_list):
        a = BYPOS[pos]; u = PE.get(a, [])
        rpc(sorted({x['txid'] for x in u}))
        n = e12 = auto = opr = 0; vins = []; vouts = []; pag = Counter()
        for x in u:
            t = cache.get(x['txid'])
            if not t: continue
            n += 1; vins.append(t['nvin']); vouts.append(t['nvout'])
            if a in t['vin_addr']: auto += 1
            elif t['nvin'] == 1 and t['nvout'] == 2:
                e12 += 1; opr += bool(t['opret'])
                if t['vin_addr']: pag[t['vin_addr'][0]] += 1
        if not n: continue
        nome = (rotulos[i] if rotulos else 'pos')
        print(f"{nome:16s} {pos:6d} {n:5d} {e12/n*100:5.1f}% {auto/n*100:5.1f}% {len(pag):5d} "
              f"{st.median(vins):6.0f} {st.median(vouts):7.0f} {max(vins):6d} {opr:9d}")

if __name__ == '__main__':
    modo = sys.argv[1] if len(sys.argv) > 1 else 'todos'
    K = int(os.environ.get('K', '12'))
    if modo in ('rotulados', 'todos'):
        print(f'=== 13 rotulados (K={K}) ===')
        for pos, nome in ROT:
            print(linha(nome, pos, BYPOS[pos], K))
        print(linha('distributor C?', 16, BYPOS[16], K))
        for p, nome in ((18, 'controle pessoa'), (311, 'controle pessoa')):
            print(linha(nome, p, BYPOS[p], K))
    if modo in ('top20', 'todos'):
        print(f'=== posicoes 1 a 20 (K={K}) ===')
        for p in range(1, 21):
            print(linha('regua', p, BYPOS[p], K))
    if modo == 'censo':
        pl = [6,10,11,18743,82761,82762,82764,82789,83041,83064,83960,16,18,311]
        rt = ['CoinEx/deposit','distributor A','distributor B','Gate.io/hot','Kraken/hot',
              'treasury/cold','desk','marketplace 1','marketplace 2','marketplace 3',
              'Bitget/hot','pos16 distribC?','pessoa pos18','pessoa pos311']
        censo(pl, rt)
    if modo == 'censo_acesas':
        censo([8,10,13,16,25,27,28,36,351,409,681], ['pos']*11)
    if modo in ('controleB', 'todos'):
        cand = sorted(a for a, x in O.items() if x['posicao'] > 500 and len(PE.get(a, [])) >= 50)
        sel = random.Random(966670).sample(cand, 150)
        print(f'=== controle B pareado por utxo (utxo>=50, pos>500, n={len(sel)}, K={K}) ===')
        v = []
        for a in sel:
            m = medir(a, K)
            if m: v.append((O[a]['posicao'], m['empurrao']))
        e = sorted(x for _, x in v)
        print(f'media={sum(e)/len(e)*100:.2f}%  >0:{sum(1 for x in e if x>0)}  '
              f'>=25%:{sum(1 for x in e if x>=.25)}  max={max(e)*100:.0f}%  '
              f'acesas={[p for p,x in v if x>0]}')
    if modo in ('controle', 'todos'):
        cand = sorted(a for a, x in O.items() if x['posicao'] > 500 and H[a]['dog'] >= 100000)
        sel = random.Random(966670).sample(cand, 300)
        print(f'=== controle 300 comuns dog>=100k pos>500 (K={K}) ===')
        res = []
        for a in sel:
            m = medir(a, K)
            if m:
                res.append((O[a]['posicao'], a, m))
        vals = [m['empurrao'] for _, _, m in res]
        ve = [m['empurrao_ext'] for _, _, m in res if m['empurrao_ext'] is not None]
        print(f'n carteiras={len(res)}')
        for lab, v in (('empurrao cru', vals), ('empurrao externo', ve)):
            v = sorted(v)
            q = lambda p: v[min(len(v)-1, int(p*len(v)))]
            print(f'{lab}: media={sum(v)/len(v)*100:.1f}%  p50={q(.5)*100:.0f}%  p75={q(.75)*100:.0f}%  '
                  f'p90={q(.9)*100:.0f}%  p95={q(.95)*100:.0f}%  max={max(v)*100:.0f}%  '
                  f'>=25%:{sum(1 for x in v if x>=0.25)} ({sum(1 for x in v if x>=0.25)/len(v)*100:.1f}%)  '
                  f'>=50%:{sum(1 for x in v if x>=0.5)}  ==100%:{sum(1 for x in v if x>=0.999)}')
        json.dump([[p, a, m] for p, a, m in res], open(os.path.dirname(CACHE)+'/controle.json','w'))
