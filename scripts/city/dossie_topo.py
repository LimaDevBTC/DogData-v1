#!/usr/bin/env python3
"""Dossie por carteira do topo da regua: reune TODOS os sinais medidos e mostra a evidencia
de cada lado, para a decisao de quem nao deve ficar na Orla Nobre ser tomada olhando prova.

NAO decide nada sozinho. Emite evidencia.

Sinais, e de onde vem cada um:
  R        teste de Rayleigh na hora UTC do deposito. baixo = uniforme 24h = automatico
           ⚠️ calculado SO sobre deposito que NAO e recebimento de airdrop, porque quem
           recebeu airdrop herda o relogio do distribuidor
  pacote   fracao do VALOR recebido em multiplo ou divisor exato de 889.806 (marca de
           marketplace; CEX transfere valor arbitrario e da 0%)
  hub      quantas carteiras distintas do top 500 ESTA carteira financia (>= 15 e decisivo)
  de_hub   fracao dos depositos que vem de infraestrutura
  auto     fracao das tx de credito em que a propria carteira e input (troco e consolidacao
           de quem OPERA; comprador de varejo da 0%, porque paga pelo endereco irmao)
  taxa     fracao das tx de credito que pagam um coletor de taxa de marketplace descoberto
           por frequencia (marca de compra de varejo)
  script   P2TR e o varejo de runes; legado e segwit v0 no topo e infraestrutura
"""
import json, io, os, sys, time, math, random, collections
from fractions import Fraction

RAIZ = '/home/bitmax/Projects/bitcoin-fullstack/DogData-v1'
SNAP = os.path.join(RAIZ, 'data', 'snapshots')
SCR = '/tmp/claude-1000/-home-bitmax-Projects-bitcoin-fullstack/df22a3c1-6af6-4f08-9816-452773b035e4/scratchpad'
TOPO = int(os.environ.get('TOPO', '60'))
AIR = 88980600000

rot = {}
for s in json.load(io.open(os.path.join(SCR, 'rot.json'), encoding='utf-8')):
    a, e, r = s.split('|'); rot[a] = e + ('/' + r if r else '')

utx = json.load(io.open(os.path.join(SNAP, 'dog_snapshot_966670_utxos.json'),
                        encoding='utf-8'))['por_endereco']
ordem = json.load(io.open(os.path.join(SNAP, 'dog_snapshot_966670_ordem.json'),
                          encoding='utf-8'))['ordem']
holders = {h['address']: h for h in json.load(io.open(
    os.path.join(SNAP, 'dog_snapshot_966670.json'), encoding='utf-8'))['holders']}

forma = {}
cam = os.path.join(SCR, 'forma.jsonl')
if os.path.exists(cam):
    for l in io.open(cam, encoding='utf-8'):
        try:
            d = json.loads(l); forma[d['t']] = d
        except Exception: pass
print(f'forma: {len(forma):,} transacoes lidas', flush=True)

def pac(dog):
    u = int(round(dog * 1e5))
    return u > 0 and Fraction(u, AIR).denominator <= 10000

# --- hubs de ENTRADA, descobertos por frequencia
financia = collections.Counter()
for x in ordem[:500]:
    a0 = x['address']
    for a in {a for u in (utx.get(a0) or []) for a in (forma.get(u['txid'], {}).get('i') or [])
              if a != a0}:
        financia[a] += 1
hubs = {a for a, c in financia.items() if c >= 20}

# --- coletores de TAXA, descobertos por frequencia no lado das saidas:
# endereco que aparece como saida em MUITAS tx de credito, com valor tipicamente PEQUENO
saiu = collections.Counter()
val = collections.defaultdict(list)
alvo = {x['address'] for x in ordem[:500]}
vistas = set()
for a0 in alvo:
    for u in (utx.get(a0) or []):
        t = u['txid']
        if t in vistas: continue
        vistas.add(t)
        for ad, sats in (forma.get(t, {}).get('o') or []):
            if ad and ad not in alvo:
                saiu[ad] += 1; val[ad].append(sats)
taxas = set()
for a, c in saiu.items():
    if c < 30: continue
    v = sorted(val[a]); med = v[len(v) // 2]
    if med <= 100000:            # <= 0,001 BTC de mediana: e taxa, nao pagamento
        taxas.add(a)
print(f'{len(hubs)} hubs de entrada, {len(taxas)} coletores de taxa descobertos '
      f'(em {len(vistas):,} tx)', flush=True)
if taxas:
    print('  maiores coletores de taxa:')
    for a in sorted(taxas, key=lambda a: -saiu[a])[:10]:
        v = sorted(val[a]); med = v[len(v) // 2]
        print(f"    {saiu[a]:>6} tx  mediana {med:>9,} sats  {a[:48]}  {rot.get(a,'')}")

def tipo(a):
    return ('P2TR' if a.startswith('bc1p') else 'P2WPKH' if a.startswith('bc1q')
            else 'P2SH' if a.startswith('3') else 'P2PKH' if a.startswith('1') else '?')

def dossie(x):
    a = x['address']
    us = utx.get(a) or []
    if not us: return None
    h = holders.get(a, {})
    air = float(h.get('airdrop_amount') or 0)
    # deposito que NAO e recebimento de airdrop: nao e pacote, OU nao vem de hub de distribuicao
    proprios = [u for u in us if not (pac(u['dog']) and any(
        z in hubs for z in (forma.get(u['txid'], {}).get('i') or [])))]
    base = proprios if len(proprios) >= 30 else us
    C = S = 0.0
    for u in base:
        t = time.gmtime(u['ts']); ang = 2 * math.pi * ((t.tm_hour * 3600 + t.tm_min * 60 + t.tm_sec) / 86400)
        C += math.cos(ang); S += math.sin(ang)
    R = math.hypot(C, S) / len(base) if base else 0
    tot = sum(u['dog'] for u in us) or 1e-9
    vp = sum(u['dog'] for u in us if pac(u['dog'])) / tot
    txs = {u['txid'] for u in us}
    comdado = [t for t in txs if t in forma]
    auto = sum(1 for t in comdado if a in (forma[t].get('i') or [])) / max(1, len(comdado))
    taxa = sum(1 for t in comdado if any(ad in taxas for ad, _ in (forma[t].get('o') or []))) / max(1, len(comdado))
    dehub = sum(1 for u in us if any(z in hubs for z in (forma.get(u['txid'], {}).get('i') or []))) / len(us)
    return dict(pos=x['posicao'], dog=x['dog'], n=len(us), nbase=len(base), R=R, pacote=vp,
                hub=financia.get(a, 0), de_hub=dehub, auto=auto, taxa=taxa, tipo=tipo(a),
                assinou=x['assinou'], air=air, rot=rot.get(a, ''), cob=len(comdado) / max(1, len(txs)))

print()
print('=' * 118)
print(f'  DOSSIE DO TOP {TOPO}')
print('=' * 118)
print(f"  {'pos':>4} {'DOG':>15} {'n':>6} {'R':>6} {'pacote':>7} {'hub':>4} {'de_hub':>7} "
      f"{'auto':>6} {'taxa':>6} {'tipo':<7} {'assin':>6} {'cob':>5}  rotulo")
linhas = []
for x in ordem[:TOPO]:
    d = dossie(x)
    if not d: continue
    linhas.append(d)
    print(f"  {d['pos']:>4} {d['dog']:>15,.0f} {d['n']:>6,} {d['R']:>6.3f} {d['pacote']:>6.0%} "
          f"{d['hub']:>4} {d['de_hub']:>6.0%} {d['auto']:>5.0%} {d['taxa']:>5.0%} {d['tipo']:<7} "
          f"{d['assinou']:>6,} {d['cob']:>4.0%}  {d['rot']}")

# controle
rnd = random.Random(966670)
ctrl = json.load(io.open(os.path.join(SCR, 'controle.json'), encoding='utf-8')) \
    if os.path.exists(os.path.join(SCR, 'controle.json')) else []
cd = [dossie({'posicao': -1, 'address': a, 'dog': holders.get(a, {}).get('dog', 0),
              'assinou': 0}) for a in ctrl]
cd = [c for c in cd if c and c['n'] >= 20]
if cd:
    print()
    print('=' * 118)
    print(f'  CONTROLE de {len(cd)} carteiras comuns sorteadas (n >= 20 depositos)')
    print('=' * 118)
    for k in ('R', 'pacote', 'auto', 'taxa', 'de_hub'):
        v = sorted(c[k] for c in cd)
        print(f"  {k:>7}: p10 {v[len(v)//10]:.3f}  mediana {v[len(v)//2]:.3f}  "
              f"p90 {v[len(v)*9//10]:.3f}")
    print(f"  {'hub':>7}: quantas do controle financiam 3+ do top 500: "
          f"{sum(1 for c in cd if c['hub']>=3)} de {len(cd)}")

json.dump({'topo': linhas, 'controle': cd},
          io.open(os.path.join(SNAP, 'dog_966670_dossie_topo.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print(f"\ngravado: {SNAP}/dog_966670_dossie_topo.json")
