#!/usr/bin/env python3
"""Auditoria da impressao "memo em tag impar do runestone" (marca de MAQUINA).

Reimplementacao independente do teste proposto: le o OP_RETURN da tx que criou
cada UTXO de $DOG do snapshot 966.670, concatena os pushes depois de OP_RETURN
OP_13, decodifica os varints LEB128 e coleta as TAGS antes do corpo (tag 0).
Dispara se alguma tag esta fora da especificacao de runes.

Uso:
  python3 scripts/regua/memo_tag.py rotulados     # 13 rotulados + pos 1..20
  python3 scripts/regua/memo_tag.py controle      # 300 carteiras comuns
  python3 scripts/regua/memo_tag.py top500        # varre o top 500 (cap por carteira)
  python3 scripts/regua/memo_tag.py memotx        # dossie das tx com memo achadas
"""
import json, sys, os, base64, http.client, random, collections, time

B = 'data/snapshots/'
SCR = '/tmp/claude-1000/-home-bitmax-Projects-bitcoin-fullstack/df22a3c1-6af6-4f08-9816-452773b035e4/scratchpad/'
CACHE = SCR + 'memo_txcache.json'

SPEC = {0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 126, 127}

H = {x['address']: x for x in json.load(open(B + 'dog_snapshot_966670.json'))['holders']}
ORD = json.load(open(B + 'dog_snapshot_966670_ordem.json'))['ordem']
O = {x['address']: x for x in ORD}
POS = {v['posicao']: k for k, v in O.items()}
PE = json.load(open(B + 'dog_snapshot_966670_utxos.json'))['por_endereco']

MKT = {'bc1pjywvrxfrsr25dkl9gmtuy8w7w8a7mg7vz0j89v3g6d0x8suvgg6qdchqul',
       'bc1pacdg0ayufh9qlyx52w73eejpka8srsgnuwraaeu2t8mlf3h70tkq0keg74',
       'bc1pud2j5tpy5s3c5u6y7e2lqn8tp5208q0mmxjtjqncmzp9wyj5gssswnz8nk'}

ROTULOS = [('CoinEx/deposit', 6), ('distributor A', 10), ('distributor B', 11),
           ('distributor C', 16), ('Gate.io/hot', 18743), ('Kraken/hot', 82761),
           ('treasury/cold', 82762), ('desk', 82764), ('marketplace 1', 82789),
           ('marketplace 2', 83041), ('marketplace 3', 83064), ('Bitget/hot', 83960)]

# ---------------------------------------------------------------- no (JSON-RPC)
_cache = {}
if os.path.exists(CACHE):
    _cache = json.load(open(CACHE))


def _auth():
    cook = open(os.path.expanduser('~/.bitcoin/.cookie')).read().strip()
    return 'Basic ' + base64.b64encode(cook.encode()).decode()


def _trim(t):
    """guarda: enderecos de input, e para cada vout [valor_sat, tipo, endereco, hex_se_opreturn]"""
    vin = []
    for v in t['vin']:
        sp = (v.get('prevout') or {}).get('scriptPubKey') or {}
        vin.append(sp.get('address'))
    vout = []
    for v in t['vout']:
        sp = v['scriptPubKey'] or {}
        h = sp.get('hex') if sp.get('type') == 'nulldata' else None
        vout.append([int(round(v['value'] * 1e8)), sp.get('type'), sp.get('address'), h])
    return {'vin': vin, 'vout': vout, 'nin': len(t['vin']), 'nout': len(t['vout'])}


def buscar(txids):
    falta = sorted({t for t in txids if t not in _cache})
    if not falta:
        return
    auth = _auth()
    t0 = time.time()
    for i in range(0, len(falta), 200):
        lote = falta[i:i + 200]
        body = json.dumps([{"jsonrpc": "1.0", "id": t, "method": "getrawtransaction",
                            "params": [t, 2]} for t in lote])
        c = http.client.HTTPConnection('127.0.0.1', 8332, timeout=1200)
        c.request('POST', '/', body, {'Authorization': auth, 'Content-Type': 'application/json'})
        for e in json.loads(c.getresponse().read()):
            if e.get('result'):
                _cache[e['id']] = _trim(e['result'])
        c.close()
    print('  [no] %d tx novas em %.0fs (cache=%d)' % (len(falta), time.time() - t0, len(_cache)),
          file=sys.stderr)
    json.dump(_cache, open(CACHE, 'w'))


# ---------------------------------------------------------------- o runestone
def payload_runestone(t):
    """concatena os pushes depois de OP_RETURN OP_13 do primeiro OP_RETURN valido"""
    for v in t['vout']:
        h = v[3]
        if not h:
            continue
        b = bytes.fromhex(h)
        if len(b) < 2 or b[0] != 0x6a or b[1] != 0x5d:   # OP_RETURN OP_13
            continue
        i = 2
        out = bytearray()
        while i < len(b):
            op = b[i]; i += 1
            if 1 <= op <= 75:
                n = op
            elif op == 0x4c:
                if i >= len(b): return None
                n = b[i]; i += 1
            elif op == 0x4d:
                if i + 1 >= len(b): return None
                n = b[i] | (b[i + 1] << 8); i += 2
            elif op == 0x4e:
                if i + 3 >= len(b): return None
                n = int.from_bytes(b[i:i + 4], 'little'); i += 4
            else:
                return None      # opcode que nao e push: cenotafo
            if i + n > len(b):
                return None
            out += b[i:i + n]; i += n
        return bytes(out)
    return None


def varints(p):
    """LEB128 sem sinal, 128 bits. devolve lista de inteiros; para no primeiro erro"""
    vs = []
    i = 0
    while i < len(p):
        val = 0; sh = 0; ok = False
        while i < len(p):
            b = p[i]; i += 1
            val |= (b & 0x7f) << sh
            if not (b & 0x80):
                ok = True
                break
            sh += 7
            if sh > 133:
                return vs
        if not ok:
            return vs
        vs.append(val)
    return vs


def tags(t):
    """conjunto de tags antes do corpo, ou None se nao tem runestone"""
    p = payload_runestone(t)
    if p is None:
        return None
    vs = varints(p)
    i = 0
    T = set()
    while i + 1 < len(vs):
        if vs[i] == 0:
            break
        T.add(vs[i])
        i += 2
    return T


def marca_memo(t):
    T = tags(t)
    if T is None:
        return False
    return bool(T - SPEC)


# ---------------------------------------------------------------- por carteira
def amostra(rec, k, addr):
    rng = random.Random('memo|' + addr)
    tx = sorted({x['txid'] for x in rec})
    return tx if len(tx) <= k else rng.sample(tx, k)


def medir(addr, k):
    rec = PE.get(addr, [])
    tx = amostra(rec, k, addr)
    buscar(tx)
    n = memo = 0
    ncred = memocred = 0        # credito externo: o proprio endereco NAO e input
    nrune = 0
    tags_vistas = collections.Counter()
    for txid in tx:
        t = _cache.get(txid)
        if not t:
            continue
        n += 1
        T = tags(t)
        if T is not None:
            nrune += 1
            for g in (T - SPEC):
                tags_vistas[g] += 1
        m = bool(T) and bool(T - SPEC)
        if m:
            memo += 1
        ext = addr not in t['vin']
        if ext:
            ncred += 1
            if m:
                memocred += 1
    return {'ntx': len({x['txid'] for x in rec}), 'am': n, 'memo': memo,
            'pct': 100.0 * memo / n if n else None,
            'ncred': ncred, 'memocred': memocred,
            'pct_cred': 100.0 * memocred / ncred if ncred else None,
            'nrune': nrune, 'tags': dict(tags_vistas)}


def linha(rot, addr, k):
    a = medir(addr, k)
    def f(x): return ' -- ' if x is None else '%4.1f%%' % x
    print('%-16s pos %6s n=%-6d am=%-4d memo=%-4d %s | ext am=%-4d memo=%-3d %s | rst=%-4d %s' % (
        rot, O[addr]['posicao'], a['ntx'], a['am'], a['memo'], f(a['pct']),
        a['ncred'], a['memocred'], f(a['pct_cred']), a['nrune'],
        sorted(a['tags'].items()) if a['tags'] else ''))
    return a


if __name__ == '__main__':
    modo = sys.argv[1] if len(sys.argv) > 1 else 'rotulados'
    K = int(sys.argv[2]) if len(sys.argv) > 2 else 300

    if modo == 'rotulados':
        print('=== 13 rotulados de servico (gabarito), cap %d tx/carteira ===' % K)
        res = {}
        for rot, p in ROTULOS:
            res[rot] = linha(rot, POS[p], K)
        print()
        print('=== posicoes 1 a 20 da ordem ===')
        for p in range(1, 21):
            res['pos%d' % p] = linha('pos %d' % p, POS[p], K)
        json.dump(res, open(SCR + 'memo_rotulados.json', 'w'))

    elif modo == 'controle':
        cand = sorted(a for a in PE if H[a]['dog'] >= 100000 and O[a]['posicao'] > 500)
        ctrl = random.Random(966670).sample(cand, 300)
        print('=== controle: 300 de %d candidatas (dog>=100k, pos>500) ===' % len(cand))
        buscar([x['txid'] for a in ctrl for x in PE[a]][:100000])
        out = {}
        tot = totmemo = 0
        cmemo = []
        for a in ctrl:
            r = medir(a, K)
            out[a] = r
            tot += r['am']; totmemo += r['memo']
            if r['memo']:
                cmemo.append((a, r))
        print('carteiras: %d | tx medidas: %d | tx com memo: %d (%.2f%%)' % (
            len(ctrl), tot, totmemo, 100.0 * totmemo / tot))
        print('carteiras com memo>0: %d de %d (%.2f%%)' % (
            len(cmemo), len(ctrl), 100.0 * len(cmemo) / len(ctrl)))
        for a, r in cmemo:
            print('   pos %6d dog=%12.0f n=%-4d memo=%d/%d %s' % (
                O[a]['posicao'], H[a]['dog'], r['ntx'], r['memo'], r['am'], a))
        json.dump({a: r for a, r in out.items()}, open(SCR + 'memo_controle.json', 'w'))

    elif modo == 'top500':
        alvo = [x['address'] for x in ORD if x['posicao'] <= 500]
        print('=== top 500, cap %d tx/carteira ===' % K)
        for i in range(0, len(alvo), 25):
            buscar([t for a in alvo[i:i + 25] for t in amostra(PE.get(a, []), K, a)])
        out = {}
        hit = []
        tot = totmemo = 0
        for a in alvo:
            r = medir(a, K)
            out[a] = r
            tot += r['am']; totmemo += r['memo']
            if r['memo']:
                hit.append((O[a]['posicao'], a, r))
        print('tx medidas %d | com memo %d (%.2f%%)' % (tot, totmemo, 100.0 * totmemo / tot))
        print('carteiras com memo>0: %d de %d' % (len(hit), len(alvo)))
        for p, a, r in sorted(hit):
            print('   pos %4d dog=%13.0f n=%-6d memo=%-4d de %-4d %5.1f%% ext %d/%d %s' % (
                p, H[a]['dog'], r['ntx'], r['memo'], r['am'], r['pct'],
                r['memocred'], r['ncred'], a))
        json.dump(out, open(SCR + 'memo_top500.json', 'w'))

    elif modo == 'ativas':
        # base de gente normal COM MUITOS CREDITOS: e onde um limiar ">0" tem risco real
        cand = sorted(a for a in PE if O[a]['posicao'] > 500 and len({x['txid'] for x in PE[a]}) >= 12)
        am = random.Random(966670).sample(cand, 200)
        print('=== 200 de %d carteiras com >=12 tx de credito, pos>500, cap %d ===' % (len(cand), K))
        for i in range(0, len(am), 20):
            buscar([t for a in am[i:i + 20] for t in amostra(PE.get(a, []), K, a)])
        tot = totmemo = 0
        hit = []
        for a in am:
            r = medir(a, K)
            tot += r['am']; totmemo += r['memo']
            if r['memo']:
                hit.append((O[a]['posicao'], a, r))
        print('tx medidas %d | com memo %d (%.2f%%)' % (tot, totmemo, 100.0 * totmemo / tot))
        print('carteiras com memo>0: %d de 200 (%.1f%%)' % (len(hit), 100.0 * len(hit) / 200))
        print('  com memo em CREDITO EXTERNO: %d de 200 (%.1f%%)' % (
            sum(1 for _, _, r in hit if r['memocred']), 100.0 * sum(1 for _, _, r in hit if r['memocred']) / 200))
        for p, a, r in sorted(hit):
            print('   pos %6d dog=%12.0f n=%-4d memo=%d/%d ext=%d/%d tags=%s %s' % (
                p, H[a]['dog'], r['ntx'], r['memo'], r['am'], r['memocred'], r['ncred'],
                r['tags'], a))

    elif modo == 'memotx':
        # dossie de toda tx com memo no cache: quem paga, quem recebe, quantos destinos
        alvos = collections.defaultdict(list)
        for a in PE:
            for x in PE[a]:
                alvos[x['txid']].append(a)
        rows = []
        for txid, t in _cache.items():
            T = tags(t)
            if T is None or not (T - SPEC):
                continue
            p = payload_runestone(t)
            vs = varints(p)
            rows.append((txid, sorted(T - SPEC), t['nin'], t['nout'],
                         sorted({O[a]['posicao'] for a in alvos.get(txid, [])}),
                         vs[:6]))
        print('tx com memo no cache: %d de %d' % (len(rows), len(_cache)))
        cnt = collections.Counter()
        for r in rows:
            for g in r[1]:
                cnt[g] += 1
        print('tags fora da spec:', cnt.most_common())
        dest = collections.Counter()
        for r in rows:
            for p in r[4]:
                dest[p] += 1
        print('posicoes creditadas por tx com memo (top 20):', dest.most_common(20))
        print('carteiras distintas creditadas por tx com memo: %d' % len(dest))
        for r in sorted(rows, key=lambda z: z[4])[:40]:
            print('  %s tags=%s nin=%-3d nout=%-3d pos=%s' % (r[0][:20], r[1], r[2], r[3], r[4][:6]))
