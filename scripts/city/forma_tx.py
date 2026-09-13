#!/usr/bin/env python3
"""Coleta a FORMA das transacoes que creditaram cada carteira, para reconhecer a compra de
varejo em marketplace (PSBT pre-assinado) em vez de tentar detectar servico.

Hipotese do fundador, 12/09/2026:
  - holder comprando tem tx com PSBT pre-assinado de marketplace
  - 889.806 e numero de MARKETPLACE, inclusive multiplos E divisores, porque sao "pacotes"
  - CEX transfere qualquer valor, sem multiplo nem fracao exata do airdrop

Consequencia estrutural que da o sinal binario: num PSBT de compra o COMPRADOR e INPUT da
transacao que o credita, porque e ele quem paga o BTC. Numa retirada de CEX ele so recebe.

Guarda por txid: enderecos de input, e (endereco, sats) de cada output. O lado das saidas
permite descobrir os coletores de taxa de marketplace por frequencia, sem adivinhar endereco.
"""
import json, io, os, sys, time, http.client, base64, random

RAIZ = '/home/bitmax/Projects/bitcoin-fullstack/DogData-v1'
SNAP = os.path.join(RAIZ, 'data', 'snapshots')
SCR = '/tmp/claude-1000/-home-bitmax-Projects-bitcoin-fullstack/df22a3c1-6af6-4f08-9816-452773b035e4/scratchpad'
CACHE = os.path.join(SCR, 'forma.jsonl')
TOPO = int(os.environ.get('TOPO', '500'))
CONTROLE = int(os.environ.get('CONTROLE', '250'))

ROTULADOS = [
 'bc1plzs2lltvv29k603w5m0aqma5e8w0n3pc77dt89l5w9hurmdfgd0swdhspn',
 'bc1qmscmeqqxqz7vkfscfs8pvl98gkdkcr8e0egkhm',
 '1FWQiwK27EnGXb6BiBMRLJvunJQZZPMcGd', '1G47mSr3oANXMafVrR8UC4pzV7FEAzo3r9',
 'bc1p6vly9m3e7yh5hwwkz92l89w2qqhyj4htkqewml963g7kn9k79qase0ukl3',
 'bc1p4pkr90vrqspmfddplde05v55gelkvcjwhsu93c9m5zu9gwwvgz0qap0vkn',
 'bc1pw56l62nnaneldkuyyqlr4jh2tptn779c4d06tdmkd0h7xfq59jtquvtxwl',
 'bc1pjywvrxfrsr25dkl9gmtuy8w7w8a7mg7vz0j89v3g6d0x8suvgg6qdchqul',
 'bc1pacdg0ayufh9qlyx52w73eejpka8srsgnuwraaeu2t8mlf3h70tkq0keg74',
 'bc1pud2j5tpy5s3c5u6y7e2lqn8tp5208q0mmxjtjqncmzp9wyj5gssswnz8nk',
 'bc1pzsx4xvghxmc0prv4mys0xdly9dh9js3e88e4m24k5gxzkeskx30s4qzjud',
 'bc1peczzt9rq30pdaj3v9ne86u6v83mfq29rxxgnqxl96uknddzekm9qfreae9',
 'bc1prdyzwdg0rcdgf9cg0a4zyx0cq3mdr3n6mcym95f3eg4dexfvnsjq200ly4',
 'bc1p8d8kexdxatnfejdvd9dq7uky4m9wjxl59r3dnqg7nqq9gaxz2jxq6ntach',
]

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
    for t in range(6):
        try:
            cx = http.client.HTTPConnection('127.0.0.1', 8332, timeout=240)
            cx.request('POST', '/', corpo,
                       {'Authorization': 'Basic ' + A, 'Content-Type': 'application/json'})
            d = json.loads(cx.getresponse().read()); cx.close()
            fora = {i['id']: i.get('result') for i in d}
            return [fora.get(i) for i in range(len(chamadas))]
        except Exception:
            if t == 5: raise
            time.sleep(3 * (t + 1))

utx = json.load(io.open(os.path.join(SNAP, 'dog_snapshot_966670_utxos.json'),
                        encoding='utf-8'))['por_endereco']
ordem = json.load(io.open(os.path.join(SNAP, 'dog_snapshot_966670_ordem.json'),
                          encoding='utf-8'))['ordem']

# grupos: topo, rotulados, e um controle aleatorio de carteiras COMUNS com saldo relevante
alvo = {x['address'] for x in ordem[:TOPO]} | set(ROTULADOS)
rnd = random.Random(966670)
comuns = [x for x in ordem[TOPO:] if x['dog'] >= 100000 and (utx.get(x['address']) or [])]
ctrl = {x['address'] for x in rnd.sample(comuns, min(CONTROLE, len(comuns)))}
alvo |= ctrl
json.dump(sorted(ctrl), io.open(os.path.join(SCR, 'controle.json'), 'w'))

quer = set()
for a in alvo:
    for u in (utx.get(a) or []): quer.add(u['txid'])
print(f'{len(alvo)} carteiras (topo {TOPO} + {len(ROTULADOS)} rotulados + {len(ctrl)} controle)',
      flush=True)
print(f'{len(quer):,} transacoes de credito', flush=True)

tenho = set()
if os.path.exists(CACHE):
    for l in io.open(CACHE, encoding='utf-8'):
        try: tenho.add(json.loads(l)['t'])
        except Exception: pass
    print(f'cache: {len(tenho):,}', flush=True)

falta = sorted(quer - tenho)
print(f'falta {len(falta):,}', flush=True)
t0 = time.time()
with io.open(CACHE, 'a', encoding='utf-8') as saida:
    for k in range(0, len(falta), 200):
        parte = falta[k:k + 200]
        for t, d in zip(parte, rpc_lote([('getrawtransaction', [t, 2]) for t in parte])):
            if not d:
                saida.write(json.dumps({'t': t, 'i': [], 'o': [], 'falhou': True}) + '\n'); continue
            ins = sorted({(v.get('prevout') or {}).get('scriptPubKey', {}).get('address')
                          for v in d.get('vin', [])} - {None})
            outs = []
            for v in d.get('vout', []):
                a = v.get('scriptPubKey', {}).get('address')
                outs.append([a, int(round(v.get('value', 0) * 1e8))])
            saida.write(json.dumps({'t': t, 'i': ins, 'o': outs,
                                    'nin': len(d.get('vin', []))}) + '\n')
        saida.flush()
        f = k + len(parte)
        if (k // 200) % 10 == 0 or f >= len(falta):
            dt = time.time() - t0; r = f / dt if dt else 0
            print(f'  {f:,}/{len(falta):,}  {r:.0f} tx/s  faltam {(len(falta)-f)/r/60:.1f} min'
                  if r else f'  {f:,}/{len(falta):,}', flush=True)
print('coleta pronta', flush=True)
