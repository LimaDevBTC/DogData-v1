#!/usr/bin/env python3
"""Mede pagadores distintos nos enderecos COM ROTULO CONHECIDO que estao no snapshot.
Sao o unico gabarito externo para calibrar onde cortar. Reusa o cache do pagadores.py.
"""
import json, io, os, sys, time, http.client, base64

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SNAP = os.path.join(RAIZ, 'data', 'snapshots')
CACHE = os.environ.get('CACHE_PAGADORES',
    '/tmp/claude-1000/-home-bitmax-Projects-bitcoin-fullstack/df22a3c1-6af6-4f08-9816-452773b035e4/scratchpad/inputs.jsonl')

ROTULOS = {
 'bc1plzs2lltvv29k603w5m0aqma5e8w0n3pc77dt89l5w9hurmdfgd0swdhspn': 'Kraken/hot',
 'bc1qmscmeqqxqz7vkfscfs8pvl98gkdkcr8e0egkhm': 'CoinEx/deposit',
 '1FWQiwK27EnGXb6BiBMRLJvunJQZZPMcGd': 'Bitget/hot',
 '1G47mSr3oANXMafVrR8UC4pzV7FEAzo3r9': 'Gate.io/hot',
 'bc1p6vly9m3e7yh5hwwkz92l89w2qqhyj4htkqewml963g7kn9k79qase0ukl3': 'distributor',
 'bc1p4pkr90vrqspmfddplde05v55gelkvcjwhsu93c9m5zu9gwwvgz0qap0vkn': 'distributor',
 'bc1pw56l62nnaneldkuyyqlr4jh2tptn779c4d06tdmkd0h7xfq59jtquvtxwl': 'distributor',
 'bc1pjywvrxfrsr25dkl9gmtuy8w7w8a7mg7vz0j89v3g6d0x8suvgg6qdchqul': 'marketplace',
 'bc1pacdg0ayufh9qlyx52w73eejpka8srsgnuwraaeu2t8mlf3h70tkq0keg74': 'marketplace',
 'bc1pud2j5tpy5s3c5u6y7e2lqn8tp5208q0mmxjtjqncmzp9wyj5gssswnz8nk': 'marketplace',
 'bc1pzsx4xvghxmc0prv4mys0xdly9dh9js3e88e4m24k5gxzkeskx30s4qzjud': 'treasury/cold',
 'bc1pqdtrwkjwdutzs5z8f75gc5srhcwewx4u77pdnumc0fh7l47aanqqa8n4da': 'desk/fee',
 'bc1peczzt9rq30pdaj3v9ne86u6v83mfq29rxxgnqxl96uknddzekm9qfreae9': 'desk',
 'bc1prdyzwdg0rcdgf9cg0a4zyx0cq3mdr3n6mcym95f3eg4dexfvnsjq200ly4': 'desk',
 'bc1p8d8kexdxatnfejdvd9dq7uky4m9wjxl59r3dnqg7nqq9gaxz2jxq6ntach': 'desk',
 'bc1pu03udw507wj58y5lv3dky03lxuj0m74uqdnqllckv3s32sw9ahrscjch8j': 'Bitget/deposit',
 'bc1pt02fw3aty825yaujdnmzml0qny28l9ecc77df2vgc26qfcket3hqc634ar': 'Bitget/deposit',
 'bc1p52673nrtsed5n5nal7cm02u6pg63p0e6u4nm2fhm90xd8r4w3ass090zzy': 'Bitget/deposit',
 'bc1p0jm3ucw8sh7edx37lw06ce9aaem09tcx2yr2zuenqr33hqce3lps67k0ns': 'Bitget/fee',
 'bc1qhuv3dhpnm0wktasd3v0kt6e4aqfqsd0uhfdu7d': 'Binance/hot',
 'bc1pf57ydds0ldxyrhq9s2p4ecnxe4hr0taxvgjpza3tjlyrpukt0fnqxwd6xs': 'Kraken/deposit',
 'bc1pap56p2rgmqgk4rc0vxpkldszhgldx49cfs3zer8e2k7q9q6x079scfa8nx': 'Kraken/treasury',
 'bc1pwxdpn5c9weqctt8yx3kpxmyv0ej6dvgcssp3hzdg7c5t7n468mxq9zt477': 'Kraken/withdrawal',
}

def auth():
    c = os.path.expanduser('~/.bitcoin/.cookie')
    if os.path.exists(c):
        return base64.b64encode(io.open(c, 'rb').read().strip()).decode()
    u = p = None
    for l in io.open(os.path.expanduser('~/.bitcoin/bitcoin.conf')):
        if l.startswith('rpcuser='): u = l.split('=', 1)[1].strip()
        if l.startswith('rpcpassword='): p = l.split('=', 1)[1].strip()
    return base64.b64encode(f'{u}:{p}'.encode()).decode()

A = auth()

def rpc_lote(chamadas):
    corpo = json.dumps([{'jsonrpc': '2.0', 'id': i, 'method': m, 'params': p}
                        for i, (m, p) in enumerate(chamadas)])
    for t in range(5):
        try:
            cx = http.client.HTTPConnection('127.0.0.1', 8332, timeout=180)
            cx.request('POST', '/', corpo,
                       {'Authorization': 'Basic ' + A, 'Content-Type': 'application/json'})
            d = json.loads(cx.getresponse().read()); cx.close()
            fora = {i['id']: i.get('result') for i in d}
            return [fora.get(i) for i in range(len(chamadas))]
        except Exception:
            if t == 4: raise
            time.sleep(2 * (t + 1))

utx = json.load(io.open(os.path.join(SNAP, 'dog_snapshot_966670_utxos.json'),
                        encoding='utf-8'))['por_endereco']
pos = {x['address']: x for x in json.load(io.open(
    os.path.join(SNAP, 'dog_snapshot_966670_ordem.json'), encoding='utf-8'))['ordem']}

tenho = {}
if os.path.exists(CACHE):
    for l in io.open(CACHE, encoding='utf-8'):
        try:
            d = json.loads(l); tenho[d['t']] = d['i']
        except Exception: pass

quer = set()
for a in ROTULOS:
    for u in (utx.get(a) or []): quer.add(u['txid'])
falta = sorted(quer - set(tenho))
print(f'{len(ROTULOS)} rotulados, {len(quer):,} tx de credito, falta {len(falta):,}', flush=True)

with io.open(CACHE, 'a', encoding='utf-8') as saida:
    for k in range(0, len(falta), 200):
        parte = falta[k:k + 200]
        for t, d in zip(parte, rpc_lote([('getrawtransaction', [t, 2]) for t in parte])):
            ins = sorted({(v.get('prevout') or {}).get('scriptPubKey', {}).get('address')
                          for v in (d or {}).get('vin', [])} - {None})
            tenho[t] = ins
            saida.write(json.dumps({'t': t, 'i': ins}) + '\n')
        saida.flush()
        print(f'  {min(k+200,len(falta)):,}/{len(falta):,}', flush=True)

linhas = []
for a, rot in ROTULOS.items():
    txs = {u['txid'] for u in (utx.get(a) or [])}
    if not txs:
        linhas.append({'rotulo': rot, 'address': a, 'no_snapshot': False}); continue
    pag = set()
    for t in txs:
        pag.update(x for x in (tenho.get(t) or []) if x != a)
    x = pos.get(a, {})
    linhas.append({'rotulo': rot, 'address': a, 'no_snapshot': True,
                   'posicao': x.get('posicao'), 'dog': x.get('dog'),
                   'utxo_count': x.get('utxo_count'), 'assinou': x.get('assinou'),
                   'eventos': len(txs), 'pagadores': len(pag),
                   'indice': min(len(pag), len(txs))})

alvo = os.path.join(SNAP, 'dog_966670_pagadores_rotulados.json')
json.dump({'linhas': linhas}, io.open(alvo, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'\ngravado: {alvo}')
for l in sorted([l for l in linhas if l.get('no_snapshot')], key=lambda l: -l['indice']):
    print(f"  {l['indice']:>6,} indice  {l['pagadores']:>6,} pag / {l['eventos']:>6,} ev  "
          f"pos {l['posicao']:>7,}  {l['rotulo']}")
print('  fora do snapshot: ' + ', '.join(l['rotulo'] for l in linhas if not l.get('no_snapshot')))
