#!/usr/bin/env python3
"""Modo de comparação: roda a forma antiga (binário `ord`) e a nova (HTTP) e acusa
qualquer diferença. Sai com código 1 se achar uma.

    # balances: o `ord balances` não abre o índice com o servidor ligado, então a
    # forma CLI roda ANTES (servidor desligado) e grava o dump; o servidor sobe
    # depois e a leitura HTTP é comparada com o dump.
    python3 scripts/ord_http_compare.py balances --run-cli --keep /tmp/ord-balances.json
    python3 scripts/ord_http_compare.py balances --cli-file /tmp/ord-balances.json --wallets 12

    # decode: `ord decode --txid` não toca o índice (fala com o bitcoind), então as
    # duas formas rodam lado a lado com o servidor ligado.
    python3 scripts/ord_http_compare.py decode --blocks 972240,972241 --per-block 6
    python3 scripts/ord_http_compare.py decode --txids <txid>,<txid>

    # dump: grava /tmp/ord-dog-balances.json por HTTP (entrada do compare-utxo-vs-ord.py)
    python3 scripts/ord_http_compare.py dump

Para a comparação de balances valer, o dump e a leitura HTTP têm de ser da MESMA
altura (o script imprime a altura do servidor e a do bitcoind).
"""
import argparse
import json
import subprocess
import sys

import ord_http as oh


def bitcoin_cli(*args, timeout=120):
    r = subprocess.run(['bitcoin-cli', *map(str, args)], capture_output=True, text=True,
                       timeout=timeout)
    if r.returncode != 0:
        raise RuntimeError(f'bitcoin-cli {args[:2]}: {r.stderr.strip()[:200]}')
    return r.stdout.strip()


def address_from_bitcoin(op):
    """Endereço do outpoint visto pelo bitcoind (a resolução que os scripts já usavam)."""
    txid, vout = op.split(':')
    out = bitcoin_cli('gettxout', txid, vout)
    if out:
        spk = json.loads(out)['scriptPubKey']
    else:
        spk = json.loads(bitcoin_cli('getrawtransaction', txid, 'true'))['vout'][int(vout)]['scriptPubKey']
    return spk.get('address') or (spk.get('addresses') or [None])[0]


def cmd_balances(a):
    if a.cli_file:
        cli = oh._dog_section_from_file(a.cli_file)
        print(f'CLI: {len(cli)} UTXOs de DOG lidos de {a.cli_file}')
    elif a.run_cli:
        cli = oh.dog_balances_cli(dump_path=a.keep)
        print(f'CLI: {len(cli)} UTXOs de DOG (servidor desligado)')
    elif a.against_scanner:
        # referência independente: o set do scanner (replay do bloco a bloco), só amounts
        cli = {k: {'amount': v} for k, v in oh._load_json_retry(oh.UTXO_SET_FILE).items()}
        print(f'scanner: {len(cli)} UTXOs de DOG em {oh.UTXO_SET_FILE.name}')
    else:
        sys.exit('use --cli-file, --run-cli ou --against-scanner')

    info = {}
    # candidates=cli: servidor congelado na altura do dump (--no-sync), os outpoints
    # do dump são os candidatos; padrão: o caminho de produção (set do scanner).
    try:
        http = oh.dog_balances_http(candidates=list(cli) if a.candidates == 'cli' else None,
                                    info_out=info)
    except oh.OrdHttpError as e:
        print(f'HTTP: {type(e).__name__}: {e}')
        print('DIFERENTE')
        return 1
    try:
        node = bitcoin_cli('getblockcount')
    except Exception:
        node = '?'
    print(f'HTTP: {len(http)} UTXOs de DOG, altura do servidor {oh.block_height()}, bitcoind {node}')

    d = oh.diff_balances(cli, http)
    bad = any(d.values())
    print(f"só no CLI: {len(d['so_no_cli'])} | só no HTTP: {len(d['so_no_http'])} | "
          f"amount diferente: {len(d['amount_diferente'])} | "
          f"divisibilidade/símbolo: {len(d['divisibilidade_ou_simbolo'])}")
    for k in ('so_no_cli', 'so_no_http'):
        for op in d[k][:5]:
            print(f'  {k}: {op}')
    for op, v in list(d['amount_diferente'].items())[:5]:
        print(f'  amount {op}: cli={v[0]} http={v[1]}')
    cli_total = sum(v['amount'] for v in cli.values())
    http_total = sum(v['amount'] for v in http.values())
    print(f'soma CLI {cli_total} | soma HTTP {http_total}')

    if a.wallets:
        by_addr = {}
        for op, o in info.items():
            if op in http:
                by_addr.setdefault(o.get('address'), []).append(op)
        ranked = sorted(by_addr, key=lambda ad: -sum(http[op]['amount'] for op in by_addr[ad]))
        top = ranked[:3]
        rest = [ad for ad in ranked[3:]]
        multi = [ad for ad in rest if len(by_addr[ad]) > 1]
        single = [ad for ad in rest if len(by_addr[ad]) == 1]
        pick = top + oh.sample(multi, max(0, a.wallets - 6)) + oh.sample(single, 3)
        print(f'carteiras: {len(by_addr)} no HTTP; amostra de {len(pick)}')
        for ad in pick:
            ops = by_addr[ad]
            h = sum(http[op]['amount'] for op in ops)
            c = sum(cli.get(op, {'amount': 0})['amount'] for op in ops)
            wrong = [op for op in oh.sample(ops, 40) if address_from_bitcoin(op) != ad]  # até 40 por carteira
            ok = (h == c) and not wrong
            bad |= not ok
            print(f"  {'OK ' if ok else 'DIF'} {ad} utxos={len(ops)} http={h} cli={c} "
                  f"endereco_bitcoind_diferente={len(wrong)}")

    print('IGUAL' if not bad else 'DIFERENTE')
    return 1 if bad else 0


def cli_decode(txid):
    r = subprocess.run([oh.ORD_BINARY, 'decode', '--txid', txid], capture_output=True,
                       text=True, timeout=60)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip()[:200])
    return json.loads(r.stdout)


def sample_txids(height, per_block):
    block = json.loads(bitcoin_cli('getblock', bitcoin_cli('getblockhash', height), 2, timeout=300))
    rs, other = [], []
    for tx in block['tx'][1:]:
        asm = ' '.join(v.get('scriptPubKey', {}).get('asm', '') for v in tx.get('vout', []))
        (rs if 'OP_RETURN 13' in asm else other).append(tx['txid'])
    return oh.sample(rs, per_block, seed=height) + oh.sample(other, 2, seed=height + 1), len(rs)


def cmd_decode(a):
    txids = []
    if a.txids:
        txids = a.txids.split(',')
    for h in (int(x) for x in a.blocks.split(',')) if a.blocks else []:
        t, n = sample_txids(h, a.per_block)
        print(f'bloco {h}: {n} txs com runestone; amostra de {len(t)}')
        txids += t
    bad = 0
    for txid in txids:
        c, h = cli_decode(txid), oh.decode(txid)
        same = c == h
        bad += not same
        kind = 'runestone' if c.get('runestone') else ('inscricao' if c.get('inscriptions') else 'vazia')
        print(f"  {'OK ' if same else 'DIF'} {txid} ({kind})")
        if not same:
            print('    cli :', json.dumps(c)[:300])
            print('    http:', json.dumps(h)[:300])
    print(f'{len(txids)} transacoes, {bad} diferentes')
    return 1 if bad else 0


def cmd_dump(a):
    """Grava a seção de DOG lida por HTTP no formato que compare-utxo-vs-ord.py e
    reseed-utxo-from-ord.py esperam (o antigo /tmp/ord-dog-balances.json)."""
    dog = oh.dog_balances_http()
    with open(a.out, 'w') as fh:
        json.dump(dog, fh)
    print(f'{len(dog)} UTXOs de DOG gravados em {a.out}')
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    b = sub.add_parser('balances')
    b.add_argument('--cli-file', help='dump de `ord balances` já gravado')
    b.add_argument('--run-cli', action='store_true', help='roda `ord balances` agora (servidor desligado)')
    b.add_argument('--keep', help='onde gravar o dump do --run-cli')
    b.add_argument('--against-scanner', action='store_true',
                   help='referência = data/dog_utxo_set.json em vez de um dump do CLI')
    b.add_argument('--candidates', choices=['scanner', 'cli'], default='scanner',
                   help='de onde vêm os outpoints candidatos da leitura HTTP')
    b.add_argument('--wallets', type=int, default=0, help='amostra de carteiras (mín. 6)')
    d = sub.add_parser('decode')
    d.add_argument('--txids')
    d.add_argument('--blocks')
    d.add_argument('--per-block', type=int, default=6)
    u = sub.add_parser('dump')
    u.add_argument('--out', default='/tmp/ord-dog-balances.json')
    a = ap.parse_args()
    sys.exit({'balances': cmd_balances, 'decode': cmd_decode, 'dump': cmd_dump}[a.cmd](a))


if __name__ == '__main__':
    main()
