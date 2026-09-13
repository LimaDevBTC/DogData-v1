#!/usr/bin/env python3
"""Conta PAGADORES DISTINTOS por carteira: quantos enderecos diferentes financiaram
os UTXOs que a carteira tinha no bloco 966.670.

Serve para separar CUSTODIA de CONVICCAO no topo da regua de posicionamento.
Uma pessoa compra de poucas contrapartes; um servico recebe de centenas.

Escopo: so os UTXOs que existiam no snapshot, que sao exatamente os que a regua
pontua. Historico ja gasto nao entra, de proposito.

ARMADILHA MEDIDA: contar endereco de input cru INFLA, porque quem paga um valor
grande consolida varios UTXOs proprios numa tx (a posicao 5 tem 18 tx de credito e
171 enderecos de input, ou seja ~9,5 por tx: e um pagador so). Por isso o indice
final e min(pagadores, eventos): uma transacao vale no maximo um pagador.
"""
import json, io, os, sys, time, http.client, base64, collections

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SNAP = os.path.join(RAIZ, 'data', 'snapshots')
CACHE = os.environ.get('CACHE_PAGADORES',
    '/tmp/claude-1000/-home-bitmax-Projects-bitcoin-fullstack/df22a3c1-6af6-4f08-9816-452773b035e4/scratchpad/inputs.jsonl')
TOPO = int(os.environ.get('TOPO', '500'))
LOTE = 200

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
    """chamadas = [(metodo, [params]), ...] -> [resultado, ...] na mesma ordem"""
    corpo = json.dumps([{'jsonrpc': '2.0', 'id': i, 'method': m, 'params': p}
                        for i, (m, p) in enumerate(chamadas)])
    for tentativa in range(5):
        try:
            cx = http.client.HTTPConnection('127.0.0.1', 8332, timeout=180)
            cx.request('POST', '/', corpo,
                       {'Authorization': 'Basic ' + A, 'Content-Type': 'application/json'})
            r = cx.getresponse()
            dados = json.loads(r.read())
            cx.close()
            fora = {}
            for item in dados:
                fora[item['id']] = item.get('result')
            return [fora.get(i) for i in range(len(chamadas))]
        except Exception as e:
            if tentativa == 4: raise
            time.sleep(2 * (tentativa + 1))

# ---- entrada
utx = json.load(io.open(os.path.join(SNAP, 'dog_snapshot_966670_utxos.json'),
                        encoding='utf-8'))['por_endereco']
ordem = json.load(io.open(os.path.join(SNAP, 'dog_snapshot_966670_ordem.json'),
                          encoding='utf-8'))['ordem'][:TOPO]

quer = set()
for x in ordem:
    for u in (utx.get(x['address']) or []):
        quer.add(u['txid'])
print(f'{len(ordem)} carteiras, {len(quer):,} transacoes de credito', flush=True)

# ---- cache do que ja foi buscado
tenho = {}
if os.path.exists(CACHE):
    for l in io.open(CACHE, encoding='utf-8'):
        try:
            d = json.loads(l)
            tenho[d['t']] = d['i']
        except Exception:
            pass
    print(f'cache: {len(tenho):,} ja lidas', flush=True)

falta = sorted(quer - set(tenho))
print(f'falta buscar {len(falta):,}', flush=True)

t0 = time.time()
with io.open(CACHE, 'a', encoding='utf-8') as saida:
    for k in range(0, len(falta), LOTE):
        parte = falta[k:k + LOTE]
        res = rpc_lote([('getrawtransaction', [t, 2]) for t in parte])
        for t, d in zip(parte, res):
            ins = []
            if d:
                for v in d.get('vin', []):
                    a = (v.get('prevout') or {}).get('scriptPubKey', {}).get('address')
                    if a: ins.append(a)
            ins = sorted(set(ins))
            tenho[t] = ins
            saida.write(json.dumps({'t': t, 'i': ins}) + '\n')
        saida.flush()
        feito = k + len(parte)
        if (k // LOTE) % 10 == 0 or feito >= len(falta):
            dt = time.time() - t0
            rit = feito / dt if dt else 0
            print(f'  {feito:,}/{len(falta):,}  {rit:.0f} tx/s  '
                  f'faltam {(len(falta)-feito)/rit/60:.1f} min' if rit else '', flush=True)

# ---- agregacao por carteira
print('\nagregando...', flush=True)
linhas = []
for x in ordem:
    meu = x['address']
    txs = {u['txid'] for u in (utx.get(meu) or [])}
    pag = set()
    semdado = 0
    for t in txs:
        ins = tenho.get(t)
        if ins is None:
            semdado += 1; continue
        pag.update(a for a in ins if a != meu)
    linhas.append({
        'posicao': x['posicao'], 'address': meu, 'dog': x['dog'],
        'utxo_count': x['utxo_count'], 'assinou': x['assinou'],
        'eventos': len(txs), 'pagadores': len(pag),
        'indice': min(len(pag), len(txs)), 'tx_sem_dado': semdado,
    })

alvo = os.path.join(SNAP, f'dog_966670_pagadores_top{TOPO}.json')
json.dump({'gerado_de': 'dog_snapshot_966670_utxos.json', 'topo': TOPO,
           'definicao': 'pagadores = enderecos distintos de input das tx que creditaram a carteira; '
                        'indice = min(pagadores, eventos) porque uma tx vale no maximo um pagador',
           'linhas': linhas},
          io.open(alvo, 'w', encoding='utf-8'), ensure_ascii=False)
print(f'gravado: {alvo}', flush=True)
sem = sum(1 for l in linhas if l['tx_sem_dado'])
print(f'carteiras com alguma tx sem dado: {sem}', flush=True)
