#!/usr/bin/env python3
"""
DOG Transaction Accounting Audit

Verifica anomalias na contabilidade de transações DOG:
  1. Conservação: total_in == total_out (DOG não é criado nem destruído)
  2. Change detection: net_transfer vs total_dog_moved consistentes
  3. UTXO integrity: outpoints gastos existiam no UTXO set
  4. Duplicate txids: mesma tx registada mais de uma vez
  5. Negative/zero transfers: net_transfer negativo ou inconsistente
  6. Unknown addresses: receivers com address='unknown'
  7. Type classification: tipo correto baseado em senders/receivers
  8. Metrics consistency: totalDogMoved no Redis bate com soma das txs

Uso:
    python3 scripts/audit_dog_txs.py              # audita Redis + blocos locais
    python3 scripts/audit_dog_txs.py --blocks     # só blocos locais
    python3 scripts/audit_dog_txs.py --redis      # só Redis
    python3 scripts/audit_dog_txs.py --block 944500  # bloco específico via bitcoin-cli
"""

import json
import os
import sys
import subprocess
import argparse
from pathlib import Path
from collections import defaultdict
from datetime import datetime, timezone

try:
    from dotenv import load_dotenv
    env_local = Path(__file__).parent.parent / '.env.local'
    if env_local.exists():
        load_dotenv(env_local, override=True)
except ImportError:
    pass

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_DIR = PROJECT_ROOT / 'data'
TX_LOG_DIR = DATA_DIR / 'dog_transactions'
UTXO_SET_FILE = DATA_DIR / 'dog_utxo_set.json'

UPSTASH_URL = os.environ.get('UPSTASH_KV_REST_API_URL', '')
UPSTASH_TOKEN = os.environ.get('UPSTASH_KV_REST_API_TOKEN', '')

DOG_FACTOR = 10 ** 5
DOG_RUNE_ID = '840000:3'
BITCOIN_CLI = 'bitcoin-cli'

# Tolerância para erros de ponto flutuante (5 casas decimais = 1 sat de DOG)
EPSILON = 0.00002


# ─── Colours ──────────────────────────────────────────────────────────────────

RED    = '\033[91m'
YELLOW = '\033[93m'
GREEN  = '\033[92m'
CYAN   = '\033[96m'
RESET  = '\033[0m'
BOLD   = '\033[1m'

def ok(msg):    print(f'  {GREEN}✓{RESET} {msg}')
def warn(msg):  print(f'  {YELLOW}⚠{RESET}  {msg}')
def err(msg):   print(f'  {RED}✗{RESET} {msg}')
def info(msg):  print(f'  {CYAN}→{RESET} {msg}')
def header(msg): print(f'\n{BOLD}{msg}{RESET}')


# ─── Data loaders ─────────────────────────────────────────────────────────────

def load_local_blocks():
    """Load all block JSON files from data/dog_transactions/."""
    txs = []
    if not TX_LOG_DIR.exists():
        return txs
    for f in sorted(TX_LOG_DIR.glob('block_*.json')):
        try:
            data = json.loads(f.read_text())
            txs.extend(data.get('transactions', []))
        except Exception as e:
            warn(f'Failed to load {f.name}: {e}')
    return txs


def load_redis_txs():
    """Load transactions from Upstash Redis."""
    if not UPSTASH_URL or not UPSTASH_TOKEN:
        warn('Upstash not configured — skipping Redis audit')
        return None, None
    try:
        import requests
        headers = {'Authorization': f'Bearer {UPSTASH_TOKEN}'}
        resp = requests.get(f'{UPSTASH_URL}/get/dog:transactions', headers=headers, timeout=15)
        resp.raise_for_status()
        raw = resp.json().get('result')
        if not raw:
            warn('Redis key dog:transactions is empty')
            return [], None
        data = json.loads(raw)
        return data.get('transactions', []), data.get('metrics', {})
    except Exception as e:
        err(f'Redis load failed: {e}')
        return None, None


def load_utxo_set():
    if UTXO_SET_FILE.exists():
        return json.loads(UTXO_SET_FILE.read_text())
    return {}


def get_live_tx(txid):
    """Fetch a tx from local Bitcoin node."""
    try:
        raw = subprocess.run(
            [BITCOIN_CLI, 'getrawtransaction', txid, 'true'],
            capture_output=True, text=True, timeout=30
        )
        if raw.returncode == 0:
            return json.loads(raw.stdout)
    except Exception:
        pass
    return None


# ─── Audit checks ─────────────────────────────────────────────────────────────

def audit_transactions(txs, label='transactions', utxo_set=None, live_check=False):
    """Run all accounting checks on a list of transactions."""
    header(f'── Auditoria: {label} ({len(txs)} txs) ──')

    anomalies = []
    seen_txids = {}

    stats = {
        'total': len(txs),
        'conservation_ok': 0,
        'conservation_fail': 0,
        'change_ok': 0,
        'change_suspicious': 0,
        'duplicate': 0,
        'unknown_addr': 0,
        'type_mismatch': 0,
        'negative_transfer': 0,
        'zero_transfer': 0,
        'utxo_mismatch': 0,
    }

    for tx in txs:
        txid = tx.get('txid', '?')
        short = f'{txid[:8]}...{txid[-6:]}' if len(txid) > 14 else txid
        block = tx.get('block_height', 0)

        # ── 1. Duplicate txid ────────────────────────────────────────────────
        if txid in seen_txids:
            stats['duplicate'] += 1
            msg = f'DUPLICATE txid {short} (also in block {seen_txids[txid]})'
            anomalies.append(('DUPLICATE', txid, block, msg))
        else:
            seen_txids[txid] = block

        senders   = tx.get('senders', [])
        receivers = tx.get('receivers', [])
        total_in  = tx.get('total_dog_in', 0)
        total_out = tx.get('total_dog_out', 0)
        net       = tx.get('net_transfer', 0)
        change    = tx.get('change_amount', 0)
        moved     = tx.get('total_dog_moved', 0)
        tx_type   = tx.get('type', 'transfer')

        # ── 2. DOG conservation: in ≈ out ───────────────────────────────────
        # DOG is conserved — total input must equal total output (modulo burns)
        # Burns: receivers empty → all DOG burned, that's valid
        # Mints (receive_only): total_in=0 is fine for airdrop/genesis
        if tx_type not in ('burn', 'receive_only'):
            if total_in > EPSILON and abs(total_in - total_out) > EPSILON:
                ratio = abs(total_in - total_out) / max(total_in, 1)
                if ratio > 0.001:  # >0.1% discrepancy
                    stats['conservation_fail'] += 1
                    msg = f'CONSERVATION FAIL {short}: in={total_in:.5f} out={total_out:.5f} diff={total_in-total_out:.5f} DOG'
                    anomalies.append(('CONSERVATION', txid, block, msg))
                else:
                    stats['conservation_ok'] += 1
            else:
                stats['conservation_ok'] += 1

        # ── 3. net_transfer consistency ──────────────────────────────────────
        # net_transfer = total_out - change_amount
        expected_net = round(total_out - change, 5)
        if abs(net - expected_net) > EPSILON:
            msg = f'NET_TRANSFER MISMATCH {short}: net={net} but total_out-change={expected_net}'
            anomalies.append(('NET_MISMATCH', txid, block, msg))

        # ── 4. Negative or zero net_transfer on real transfers ───────────────
        if tx_type == 'transfer' and net < 0:
            stats['negative_transfer'] += 1
            msg = f'NEGATIVE net_transfer {short}: net={net:.5f} (change={change:.5f}, out={total_out:.5f})'
            anomalies.append(('NEGATIVE', txid, block, msg))

        if tx_type == 'transfer' and net == 0 and total_out > 0:
            stats['zero_transfer'] += 1
            msg = f'ZERO net_transfer {short}: all {total_out:.2f} DOG classified as change'
            anomalies.append(('ZERO_TRANSFER', txid, block, msg))

        # ── 5. total_dog_moved should equal net_transfer (our convention) ────
        # After the fix, total_dog_moved == net_transfer. Old data may differ.
        if abs(moved - net) > EPSILON and moved != total_out:
            msg = f'MOVED≠NET {short}: moved={moved:.5f} net={net:.5f} out={total_out:.5f}'
            anomalies.append(('MOVED_NET_DIFF', txid, block, msg))

        # ── 6. Unknown addresses ─────────────────────────────────────────────
        unknown_recv = [r for r in receivers if r.get('address') == 'unknown']
        if unknown_recv:
            stats['unknown_addr'] += 1
            dog_unknown = sum(r.get('amount_dog', 0) for r in unknown_recv)
            msg = f'UNKNOWN addr {short}: {len(unknown_recv)} output(s) with {dog_unknown:.2f} DOG to unknown'
            anomalies.append(('UNKNOWN_ADDR', txid, block, msg))

        # ── 7. Change without senders (impossible in real Bitcoin) ───────────
        if change > 0 and not senders:
            msg = f'CHANGE WITHOUT SENDERS {short}: change={change:.5f} but no senders'
            anomalies.append(('CHANGE_NO_SENDER', txid, block, msg))

        # ── 8. Type classification consistency ───────────────────────────────
        n_senders   = len(senders)
        n_receivers = len([r for r in receivers if not r.get('is_change', False)])

        expected_type = 'transfer'
        if n_senders == 0:
            expected_type = 'receive_only'
        elif n_receivers == 0 and n_senders > 0:
            expected_type = 'burn'
        elif n_senders > 1 and n_receivers == 1:
            expected_type = 'consolidation'

        if tx_type != expected_type and not (tx_type == 'transfer' and expected_type == 'consolidation'):
            stats['type_mismatch'] += 1
            msg = f'TYPE MISMATCH {short}: stored={tx_type} expected={expected_type} (senders={n_senders}, receivers={n_receivers})'
            anomalies.append(('TYPE_MISMATCH', txid, block, msg))

        # ── 9. change_amount > total_out (impossible) ────────────────────────
        if change > total_out + EPSILON:
            msg = f'CHANGE > TOTAL_OUT {short}: change={change:.5f} > out={total_out:.5f}'
            anomalies.append(('CHANGE_OVERFLOW', txid, block, msg))

        # ── 10. Receiver amounts sum check ───────────────────────────────────
        recv_sum = round(sum(r.get('amount_dog', 0) for r in receivers), 5)
        if abs(recv_sum - total_out) > EPSILON:
            msg = f'RECEIVER SUM MISMATCH {short}: sum(receivers)={recv_sum:.5f} vs total_out={total_out:.5f}'
            anomalies.append(('RECV_SUM', txid, block, msg))

        # ── 11. Live node verification (optional, slow) ───────────────────────
        if live_check and utxo_set is not None:
            live_tx = get_live_tx(txid)
            if live_tx:
                # Verify output count matches
                live_outputs = len([v for v in live_tx.get('vout', [])
                                   if v.get('scriptPubKey', {}).get('type') != 'nulldata'])
                stored_receivers = len(receivers)
                if live_outputs != stored_receivers and stored_receivers > 0:
                    stats['utxo_mismatch'] += 1
                    msg = f'OUTPUT COUNT {short}: stored={stored_receivers} live={live_outputs} non-OP_RETURN outputs'
                    anomalies.append(('OUTPUT_MISMATCH', txid, block, msg))

        # ── 12. Suspiciously high change ratio ───────────────────────────────
        if total_out > 0:
            change_ratio = change / total_out
            if change_ratio > 0.99 and total_out > 1_000_000:
                stats['change_suspicious'] += 1
                msg = f'SUSPICIOUS CHANGE {short}: {change_ratio*100:.1f}% of {total_out:.2f} DOG is change — only {net:.2f} DOG transferred'
                anomalies.append(('HIGH_CHANGE_RATIO', txid, block, msg))
            else:
                stats['change_ok'] += 1

    # ─── Summary ──────────────────────────────────────────────────────────────

    print()
    critical   = [a for a in anomalies if a[0] in ('CONSERVATION', 'NEGATIVE', 'DUPLICATE', 'CHANGE_OVERFLOW', 'RECV_SUM')]
    warnings   = [a for a in anomalies if a[0] in ('ZERO_TRANSFER', 'UNKNOWN_ADDR', 'HIGH_CHANGE_RATIO', 'NET_MISMATCH', 'MOVED_NET_DIFF')]
    infos      = [a for a in anomalies if a[0] in ('TYPE_MISMATCH', 'CHANGE_NO_SENDER', 'OUTPUT_MISMATCH')]

    if critical:
        err(f'{len(critical)} CRITICAL anomalias:')
        for _, txid, block, msg in critical[:20]:
            err(f'  Block {block}: {msg}')
    else:
        ok('Nenhuma anomalia crítica')

    if warnings:
        warn(f'{len(warnings)} avisos:')
        for _, txid, block, msg in warnings[:20]:
            warn(f'  Block {block}: {msg}')
    else:
        ok('Nenhum aviso')

    if infos:
        info(f'{len(infos)} informativos:')
        for _, txid, block, msg in infos[:20]:
            info(f'  Block {block}: {msg}')

    print()
    info(f'Totais: {stats["total"]} txs | conservation ok={stats["conservation_ok"]} fail={stats["conservation_fail"]}')
    info(f'Change: ok={stats["change_ok"]} suspicious={stats["change_suspicious"]}')
    info(f'Outros: duplicates={stats["duplicate"]} unknown_addr={stats["unknown_addr"]} zero_transfer={stats["zero_transfer"]} negative={stats["negative_transfer"]}')

    return anomalies, stats


def audit_metrics(txs, redis_metrics):
    """Verify Redis metrics match transaction data."""
    header('── Verificação de Métricas Redis ──')

    if not redis_metrics or not redis_metrics.get('last24h'):
        warn('Sem métricas no Redis para verificar')
        return

    m = redis_metrics['last24h']
    cutoff = (datetime.now(timezone.utc).timestamp() - 86400)

    recent = [tx for tx in txs if tx.get('timestamp', '') >= datetime.fromtimestamp(cutoff, tz=timezone.utc).isoformat()]

    redis_count   = m.get('txCount', 0)
    redis_volume  = m.get('totalDogMoved', 0)
    actual_count  = len(recent)
    actual_volume = round(sum(tx.get('net_transfer', tx.get('total_dog_moved', 0)) for tx in recent), 2)

    if abs(redis_count - actual_count) > 2:
        warn(f'txCount diverge: Redis={redis_count} actual={actual_count}')
    else:
        ok(f'txCount ok: {redis_count}')

    if actual_volume > 0 and abs(redis_volume - actual_volume) / actual_volume > 0.05:
        warn(f'totalDogMoved diverge: Redis={redis_volume:,.2f} actual={actual_volume:,.2f} ({abs(redis_volume-actual_volume)/actual_volume*100:.1f}% diff)')
    else:
        ok(f'totalDogMoved ok: {redis_volume:,.2f} DOG (last 24h)')


def audit_utxo_integrity(txs, utxo_set):
    """Check if the UTXO set appears consistent with transaction history."""
    header('── Integridade do UTXO Set ──')

    info(f'UTXO set: {len(utxo_set)} outpoints')
    total_dog = sum(v / DOG_FACTOR for v in utxo_set.values())
    info(f'DOG total no UTXO set: {total_dog:,.2f} DOG')

    # Check for zero-value UTXOs
    zero = [k for k, v in utxo_set.items() if v <= 0]
    if zero:
        warn(f'{len(zero)} UTXOs com valor zero ou negativo')
        for k in zero[:5]:
            warn(f'  {k}: {utxo_set[k]}')
    else:
        ok('Nenhum UTXO com valor zero/negativo')

    # Check for malformed outpoints
    bad = [k for k in utxo_set.keys() if ':' not in k or len(k.split(':')) != 2]
    if bad:
        warn(f'{len(bad)} outpoints malformados')
        for k in bad[:5]:
            warn(f'  {k}')
    else:
        ok('Todos os outpoints têm formato correto (txid:vout)')

    # Check for suspiciously large single UTXOs
    large = [(k, v / DOG_FACTOR) for k, v in utxo_set.items() if v / DOG_FACTOR > 500_000_000]
    if large:
        warn(f'{len(large)} UTXOs com >500M DOG (verificar se legítimo):')
        for k, dog in sorted(large, key=lambda x: -x[1])[:5]:
            warn(f'  {k[:20]}...: {dog:,.2f} DOG')
    else:
        ok('Nenhum UTXO suspeito (>500M DOG)')


def audit_live_block(height):
    """Fetch a block from the node and compare with stored data."""
    header(f'── Verificação ao Vivo: Bloco {height} ──')

    # Load stored block data
    block_file = TX_LOG_DIR / f'block_{height:07d}.json'
    if not block_file.exists():
        warn(f'Bloco {height} não encontrado em {TX_LOG_DIR}')
        return

    stored = json.loads(block_file.read_text())
    stored_txs = stored.get('transactions', [])
    info(f'Stored: {len(stored_txs)} DOG txs')

    # Fetch from node
    try:
        block_hash = subprocess.run(
            [BITCOIN_CLI, 'getblockhash', str(height)],
            capture_output=True, text=True, timeout=10
        ).stdout.strip()

        block = json.loads(subprocess.run(
            [BITCOIN_CLI, 'getblock', block_hash, '1'],
            capture_output=True, text=True, timeout=30
        ).stdout)

        info(f'Live: {block["nTx"]} txs totais no bloco')

        # Load UTXO set to cross-reference
        utxo_set = load_utxo_set()
        stored_txids = {tx['txid'] for tx in stored_txs}

        for tx in stored_txs:
            txid = tx['txid']
            if txid not in [t for t in block.get('tx', [])]:
                err(f'Tx {txid[:16]}... não está no bloco {height} ao vivo!')

            # Conservation check with live data
            live_tx = get_live_tx(txid)
            if live_tx:
                live_outputs = live_tx.get('vout', [])
                stored_out = tx.get('total_dog_out', 0)
                ok(f'Tx {txid[:8]}...: stored={stored_out:.2f} DOG out, {len(live_outputs)} vouts ao vivo')

    except Exception as e:
        err(f'Erro ao consultar o node: {e}')


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='DOG Transaction Accounting Audit')
    parser.add_argument('--blocks', action='store_true', help='Auditar só blocos locais')
    parser.add_argument('--redis',  action='store_true', help='Auditar só Redis')
    parser.add_argument('--block',  type=int, help='Verificar bloco específico ao vivo')
    parser.add_argument('--live',   action='store_true', help='Verificar txs ao vivo no node (lento)')
    args = parser.parse_args()

    print(f'\n{BOLD}╔══ DOG Transaction Accounting Audit ══╗{RESET}')
    print(f'{BOLD}║ {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")}        ║{RESET}')
    print(f'{BOLD}╚════════════════════════════════════════╝{RESET}')

    utxo_set = load_utxo_set()

    if args.block:
        audit_live_block(args.block)
        return

    do_all = not args.blocks and not args.redis

    if args.blocks or do_all:
        local_txs = load_local_blocks()
        if local_txs:
            audit_transactions(local_txs, f'blocos locais ({TX_LOG_DIR.name})', utxo_set, live_check=args.live)
            audit_utxo_integrity(local_txs, utxo_set)
        else:
            warn('Nenhum bloco local encontrado')

    if args.redis or do_all:
        redis_txs, redis_metrics = load_redis_txs()
        if redis_txs is not None:
            audit_transactions(redis_txs, 'Redis (dog:transactions)', utxo_set, live_check=False)
            if redis_metrics:
                audit_metrics(redis_txs, redis_metrics)

    print(f'\n{GREEN}{BOLD}Auditoria concluída.{RESET}\n')


if __name__ == '__main__':
    main()
