#!/usr/bin/env python3
"""
DOG Historical Backfill — blocks 840,000 → 941,110

Estratégia em 2 fases aproveitando os dados já existentes:

FASE 1 — Bootstrap a partir dos dados de airdrop (840,654 → 858,368)
  Temos airdrop_recipients_exact.json com 844 txids, 75,490 recipients,
  blocos 840,654–858,368. Usamos esses dados para:
    a) Construir block files (block_XXXXXXX.json) para os blocos de airdrop
    b) Pre-popular o UTXO set com os outputs do airdrop
  Isso cobre a fase de distribuição sem precisar re-escanear via Bitcoin Core.
  O genesis UTXO (840,000) → gasto no bloco 840,654 (confirmado pelos dados).

FASE 2 — Scan forward via Bitcoin Core (858,369 → 941,110)
  A partir do UTXO set estabelecido pela Fase 1, escaneia bloco a bloco
  com getblock verbosity=2 + getrawtransaction (txindex ativo).
  Detecta qualquer tx que gaste UTXOs DOG conhecidos e mantém a cadeia
  de custódia contínua até o handoff para o scanner live (bloco 941,111).

FASE 3 — Verificação de integridade
  Compara o UTXO set reconstruído com dog_utxo_set.json (estado atual).
  Qualquer UTXO do live sem origem rastreável indica gap.

FASE 4 — Indexação Redis
  Roda build-address-tx-index.ts para indexar tudo no Explorer.

Uso:
    python3 scripts/backfill_dog_history.py              # executa todas as fases
    python3 scripts/backfill_dog_history.py --reset      # reinicia do zero
    python3 scripts/backfill_dog_history.py --phase1     # só fase 1 (airdrop bootstrap)
    python3 scripts/backfill_dog_history.py --phase2     # só fase 2 (scan forward)
    python3 scripts/backfill_dog_history.py --verify     # só verificação
    python3 scripts/backfill_dog_history.py --index      # só indexação Redis
"""

import subprocess
import json
import sys
import time
import logging
import argparse
from datetime import datetime, timezone
from pathlib import Path
from collections import defaultdict

try:
    from dotenv import load_dotenv
    env_local = Path(__file__).parent.parent / '.env.local'
    if env_local.exists():
        load_dotenv(env_local, override=True)
except ImportError:
    pass

# ─── Configurações ────────────────────────────────────────────────────────────

BITCOIN_CLI  = 'bitcoin-cli'
ORD_BINARY   = '/home/bitmax/Projects/bitcoin-fullstack/ord/target/release/ord'
ORD_DATA_DIR = '/home/bitmax/Projects/bitcoin-fullstack/ord/data'

SCRIPT_DIR   = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_DIR     = PROJECT_ROOT / 'data'
TX_LOG_DIR   = DATA_DIR / 'dog_transactions'

BACKFILL_STATE_FILE = DATA_DIR / 'backfill_state.json'
BACKFILL_UTXO_FILE  = DATA_DIR / 'backfill_utxo_set.json'
LIVE_UTXO_FILE      = DATA_DIR / 'dog_utxo_set.json'
AIRDROP_EXACT_FILE  = DATA_DIR / 'airdrop_recipients_exact.json'
FORENSIC_FILE       = DATA_DIR / 'forensic_airdrop_data.json'

# Genesis DOG — etch block 840,000 tx index 3, pointer=1
GENESIS_OUTPOINT = 'e79134080a83fe3e0e06ed6990c5a9b63b362313341745707a2bff7d788a1375:1'
GENESIS_AMOUNT   = 10_000_000_000_000_000  # raw
GENESIS_ADDRESS  = 'bc1pry0ne0yf5pkgqsszmytmqkpzs4aflhr8tfptz9sydqrhxexgujcqqler2t'

# Airdrop phase (confirmado pelos dados existentes)
AIRDROP_START_BLOCK  = 840_654
AIRDROP_END_BLOCK    = 858_368

# Scan phase (após o airdrop até o handoff pro scanner live)
SCAN_START_BLOCK = AIRDROP_END_BLOCK + 1   # 858,369
SCAN_END_BLOCK   = 941_110

DOG_RUNE_ID    = '840000:3'
DOG_FACTOR     = 100_000  # 10^5 (divisibility=5)

SAVE_INTERVAL  = 500
LOG_INTERVAL   = 100

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
log = logging.getLogger('dog-backfill')


# ─── Bitcoin CLI ──────────────────────────────────────────────────────────────

def btc(*args, timeout=60):
    r = subprocess.run([BITCOIN_CLI, *args], capture_output=True, text=True, timeout=timeout)
    if r.returncode != 0:
        raise RuntimeError(f'bitcoin-cli {args[0]}: {r.stderr.strip()}')
    return r.stdout.strip()


def get_block_hash(height):
    return btc('getblockhash', str(height))


def get_block(block_hash, verbosity=2):
    return json.loads(btc('getblock', block_hash, str(verbosity), timeout=180))


def get_raw_tx(txid):
    return json.loads(btc('getrawtransaction', txid, 'true', timeout=30))


def get_tx_fee_sats(tx):
    total_in = 0
    for vin in tx.get('vin', []):
        if 'coinbase' in vin:
            return 0
        try:
            prev = get_raw_tx(vin['txid'])
            total_in += int(prev['vout'][vin['vout']]['value'] * 1e8)
        except Exception:
            return None
    total_out = sum(int(v['value'] * 1e8) for v in tx.get('vout', []))
    return total_in - total_out


# ─── Ord ──────────────────────────────────────────────────────────────────────

def ord_decode(txid):
    try:
        r = subprocess.run(
            [ORD_BINARY, '--data-dir', ORD_DATA_DIR, 'decode', '--txid', txid],
            capture_output=True, text=True, timeout=20
        )
        if r.returncode == 0:
            return json.loads(r.stdout)
    except Exception:
        pass
    return None


# ─── Runestone ────────────────────────────────────────────────────────────────

def has_runestone(tx):
    for vout in tx.get('vout', []):
        if 'OP_RETURN 13' in vout.get('scriptPubKey', {}).get('asm', ''):
            return True
    return False


def get_first_non_opreturn(tx):
    for i, vout in enumerate(tx.get('vout', [])):
        if vout.get('scriptPubKey', {}).get('type') != 'nulldata':
            return i
    return None


def parse_dog_edicts(decoded):
    if not decoded or not decoded.get('runestone'):
        return None
    rs = decoded['runestone']
    if isinstance(rs, dict) and 'Runestone' in rs:
        rs = rs['Runestone']
    edicts = [(e.get('output', 0), e.get('amount', 0))
              for e in rs.get('edicts', []) if e.get('id', '') == DOG_RUNE_ID]
    return edicts if edicts else None


def allocate_dog_outputs(tx, dog_input_total, decoded):
    edicts = parse_dog_edicts(decoded)
    remainder_outputs = set()

    if edicts:
        allocation, allocated = {}, 0
        for out_idx, amount in edicts:
            if amount == 0:
                amount = dog_input_total - allocated
            actual = min(amount, dog_input_total - allocated)
            if actual > 0:
                allocation[out_idx] = allocation.get(out_idx, 0) + actual
                allocated += actual
        remainder = dog_input_total - allocated
        if remainder > 0:
            rs = decoded.get('runestone') if decoded else None
            if isinstance(rs, dict) and 'Runestone' in rs:
                rs = rs['Runestone']
            pointer = rs.get('pointer') if rs else None
            dest = pointer if pointer is not None else get_first_non_opreturn(tx)
            if dest is not None:
                allocation[dest] = allocation.get(dest, 0) + remainder
                remainder_outputs.add(dest)
        return allocation, remainder_outputs

    default = get_first_non_opreturn(tx)
    if default is not None:
        return {default: dog_input_total}, remainder_outputs
    return {}, remainder_outputs


def get_output_address(tx, vout_idx):
    if vout_idx < len(tx.get('vout', [])):
        return tx['vout'][vout_idx].get('scriptPubKey', {}).get('address')
    return None


# ─── Processamento de TX ──────────────────────────────────────────────────────

def process_dog_tx(tx, dog_inputs):
    """Processa uma tx DOG. Retorna (tx_data, new_utxos, spent_outpoints)."""
    txid = tx['txid']
    dog_input_total = sum(a for _, a in dog_inputs)
    decoded = ord_decode(txid) if has_runestone(tx) else None
    allocation, remainder_outputs = allocate_dog_outputs(tx, dog_input_total, decoded)

    # Senders
    sender_amounts = defaultdict(int)
    for outpoint, amount in dog_inputs:
        prev_txid, prev_vout = outpoint.rsplit(':', 1)
        try:
            prev_tx = get_raw_tx(prev_txid)
            addr = get_output_address(prev_tx, int(prev_vout))
            if addr:
                sender_amounts[addr] += amount
        except Exception as e:
            log.warning(f'  Sender resolve falhou {outpoint}: {e}')

    senders = [
        {'address': addr, 'amount': amt,
         'amount_dog': round(amt / DOG_FACTOR, 5), 'has_dog': True}
        for addr, amt in sender_amounts.items()
    ]

    # Receivers
    sender_addr_set = set(sender_amounts.keys())
    receivers, new_utxos = [], {}
    for vout_idx, amount in allocation.items():
        addr = get_output_address(tx, vout_idx)
        is_change = (vout_idx in remainder_outputs) or (addr in sender_addr_set if addr else False)
        receivers.append({
            'address': addr or 'unknown',
            'amount': amount,
            'amount_dog': round(amount / DOG_FACTOR, 5),
            'has_dog': True,
            'is_change': is_change,
        })
        new_utxos[f'{txid}:{vout_idx}'] = amount

    total_out     = round(sum(r['amount_dog'] for r in receivers), 5)
    change_amount = round(sum(r['amount_dog'] for r in receivers if r['is_change']), 5)
    net_transfer  = round(total_out - change_amount, 5)
    real_receivers = [r for r in receivers if not r['is_change']]

    tx_type = 'transfer'
    if not senders:                                    tx_type = 'receive_only'
    elif not receivers:                                tx_type = 'tracking_error'
    elif not real_receivers and net_transfer == 0:    tx_type = 'self_transfer'
    elif len(senders) > 1 and len(real_receivers) == 1: tx_type = 'consolidation'

    block_time = tx.get('time', tx.get('blocktime', 0))
    timestamp = (datetime.fromtimestamp(block_time, tz=timezone.utc)
                 .isoformat().replace('+00:00', 'Z')
                 if block_time else
                 datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'))

    tx_data = {
        'txid': txid,
        'block_height': tx.get('height', 0),
        'timestamp': timestamp,
        'type': tx_type,
        'senders': senders,
        'receivers': receivers,
        'sender_count': len(senders),
        'receiver_count': len(receivers),
        'total_dog_in': round(dog_input_total / DOG_FACTOR, 5),
        'total_dog_out': total_out,
        'total_dog_moved': total_out,
        'net_transfer': net_transfer,
        'change_amount': change_amount,
        'has_change': change_amount > 0,
        'fee_sats': get_tx_fee_sats(tx),
    }
    return tx_data, new_utxos, [op for op, _ in dog_inputs]


# ─── Scan de bloco ────────────────────────────────────────────────────────────

def scan_block(height, utxo_set):
    block_hash = get_block_hash(height)
    block = get_block(block_hash, verbosity=2)
    dog_outpoints = set(utxo_set.keys())
    results = []

    for tx in block['tx']:
        dog_inputs = [
            (f'{vin["txid"]}:{vin["vout"]}', utxo_set[f'{vin["txid"]}:{vin["vout"]}'])
            for vin in tx.get('vin', [])
            if 'coinbase' not in vin
            and f'{vin["txid"]}:{vin["vout"]}' in dog_outpoints
        ]
        if not dog_inputs:
            continue
        tx['height'] = block['height']
        tx['time']   = block.get('time', 0)
        try:
            results.append(process_dog_tx(tx, dog_inputs))
        except Exception as e:
            log.error(f'  Erro tx {tx["txid"][:16]}...: {e}')

    return results


# ─── Persistência ─────────────────────────────────────────────────────────────

def load_state():
    return json.loads(BACKFILL_STATE_FILE.read_text()) if BACKFILL_STATE_FILE.exists() else {}


def save_state(state):
    BACKFILL_STATE_FILE.write_text(json.dumps(state, indent=2))


def load_utxo():
    if BACKFILL_UTXO_FILE.exists():
        return json.loads(BACKFILL_UTXO_FILE.read_text())
    log.info(f'Novo UTXO set — seed genesis: {GENESIS_OUTPOINT}')
    return {GENESIS_OUTPOINT: GENESIS_AMOUNT}


def save_utxo(utxo_set):
    BACKFILL_UTXO_FILE.write_text(json.dumps(utxo_set))


def save_block_file(height, txs, block_ts):
    TX_LOG_DIR.mkdir(parents=True, exist_ok=True)
    p = TX_LOG_DIR / f'block_{height:07d}.json'
    p.write_text(json.dumps(
        {'block_height': height, 'timestamp': block_ts, 'transactions': txs},
        separators=(',', ':')
    ))


def block_file_exists(height):
    return (TX_LOG_DIR / f'block_{height:07d}.json').exists()


# ═══════════════════════════════════════════════════════════════════════════════
# FASE 1 — Bootstrap a partir dos dados de airdrop existentes
# ═══════════════════════════════════════════════════════════════════════════════

def phase1_bootstrap(utxo_set, state):
    """
    Constrói block files e UTXO set para os blocos de airdrop (840,654–858,368)
    usando airdrop_recipients_exact.json + forensic_airdrop_data.json.

    Estratégia:
    1. Marcar o genesis como gasto (era o input do primeiro airdrop tx)
    2. Para cada tx de airdrop: construir receivers a partir dos dados existentes
    3. Resolver senders via Bitcoin Core (o distribuidor é sempre GENESIS_ADDRESS)
    4. Salvar block files e atualizar UTXO set com os novos outputs
    """
    if state.get('phase1_done'):
        log.info('Fase 1 já concluída (checkpoint). Pulando.')
        return utxo_set

    log.info('═══════════════════════════════════════════════════════')
    log.info('FASE 1 — Bootstrap airdrop (840,654 → 858,368)')
    log.info('Carregando dados de airdrop existentes...')

    # Carregar airdrop_recipients_exact.json
    with open(AIRDROP_EXACT_FILE) as f:
        exact_data = json.load(f)

    recipients_list = exact_data.get('recipients', [])
    log.info(f'  Recipients: {len(recipients_list):,}')

    # Agrupar por bloco → txid → receivers
    # Estrutura: {block: {txid: {vout: {address, amount_raw}}}}
    blocks_data: dict[int, dict[str, dict]] = defaultdict(lambda: defaultdict(dict))

    for recipient in recipients_list:
        address = recipient.get('address', '')
        airdrop_amount = recipient.get('airdrop_amount', 0)  # total recebido (raw)
        airdrop_txs = recipient.get('airdrop_txs', [])
        n_txs = len(airdrop_txs) if airdrop_txs else 1
        amount_per_tx = airdrop_amount // n_txs if n_txs else airdrop_amount

        for tx_entry in airdrop_txs:
            txid  = tx_entry.get('tx', '')
            block = tx_entry.get('block', 0)
            vout  = tx_entry.get('vout', 1)
            if txid and block and address:
                blocks_data[block][txid][vout] = {
                    'address': address,
                    'amount_raw': amount_per_tx,
                }

    # Também carregar forensic_airdrop_data para enriquecer com timestamps
    block_timestamps: dict[int, int] = {}  # block → unix timestamp
    try:
        with open(FORENSIC_FILE) as f:
            forensic = json.load(f)
        for dist_tx in forensic.get('distribution_transactions', []):
            bh = dist_tx.get('block_height', 0)
            bt = dist_tx.get('block_time', 0)
            if bh and bt:
                block_timestamps[bh] = bt
        for r in forensic.get('recipients', []):
            for h in r.get('receive_history', []):
                if h.get('block') and h.get('time'):
                    block_timestamps[h['block']] = h['time']
    except Exception as e:
        log.warning(f'  forensic_airdrop_data.json parcialmente carregado: {e}')

    log.info(f'  Blocos de airdrop: {sorted(blocks_data.keys())}')

    # Remover genesis do UTXO set (foi gasto no primeiro bloco de airdrop)
    utxo_set.pop(GENESIS_OUTPOINT, None)
    log.info(f'  Genesis UTXO removido (gasto no bloco {AIRDROP_START_BLOCK})')

    total_outputs_created = 0
    total_txs_processed   = 0

    for block_height in sorted(blocks_data.keys()):
        if block_file_exists(block_height):
            # Replay: carregar o arquivo existente e re-popular UTXO set
            existing = json.loads((TX_LOG_DIR / f'block_{block_height:07d}.json').read_text())
            for tx in existing.get('transactions', []):
                for r in tx.get('receivers', []):
                    # Não temos o outpoint diretamente — reconstruir
                    pass
            # Para garantir consistência, re-processar mesmo assim (sobrescreve)

        block_txs_data = blocks_data[block_height]
        block_ts_unix  = block_timestamps.get(block_height, 0)
        block_ts_str   = (datetime.fromtimestamp(block_ts_unix, tz=timezone.utc)
                          .isoformat().replace('+00:00', 'Z')
                          if block_ts_unix else
                          datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'))

        block_txs = []

        for txid, vout_map in block_txs_data.items():
            # Construir receivers a partir dos dados de airdrop
            receivers = []
            new_utxos_for_tx = {}

            for vout_idx, rdata in sorted(vout_map.items()):
                address    = rdata['address']
                amount_raw = rdata['amount_raw']
                receivers.append({
                    'address':    address,
                    'amount':     amount_raw,
                    'amount_dog': round(amount_raw / DOG_FACTOR, 5),
                    'has_dog':    True,
                    'is_change':  False,
                })
                outpoint = f'{txid}:{vout_idx}'
                new_utxos_for_tx[outpoint] = amount_raw

            if not receivers:
                continue

            total_out = round(sum(r['amount_dog'] for r in receivers), 5)

            # O sender é sempre o distribuidor (bc1pry0ne0...)
            # Não temos o amount_raw exato de entrada, mas é a soma dos outputs
            total_raw_out = sum(r['amount'] for r in receivers)
            senders = [{
                'address':    GENESIS_ADDRESS,
                'amount':     total_raw_out,
                'amount_dog': round(total_raw_out / DOG_FACTOR, 5),
                'has_dog':    True,
            }]

            tx_data = {
                'txid':           txid,
                'block_height':   block_height,
                'timestamp':      block_ts_str,
                'type':           'transfer',
                'senders':        senders,
                'receivers':      receivers,
                'sender_count':   1,
                'receiver_count': len(receivers),
                'total_dog_in':   round(total_raw_out / DOG_FACTOR, 5),
                'total_dog_out':  total_out,
                'total_dog_moved': total_out,
                'net_transfer':   total_out,
                'change_amount':  0.0,
                'has_change':     False,
                'fee_sats':       None,  # não disponível nos dados de airdrop
            }

            block_txs.append(tx_data)
            utxo_set.update(new_utxos_for_tx)
            total_outputs_created += len(new_utxos_for_tx)
            total_txs_processed   += 1

        if block_txs:
            save_block_file(block_height, block_txs, block_ts_str)
            log.info(f'  Bloco {block_height:,}: {len(block_txs)} txs, '
                     f'{sum(len(t["receivers"]) for t in block_txs)} recipients')

    log.info(f'\nFase 1 concluída:')
    log.info(f'  Txs processadas:   {total_txs_processed:,}')
    log.info(f'  UTXOs criados:     {total_outputs_created:,}')
    log.info(f'  UTXO set total:    {len(utxo_set):,}')
    log.info(f'  DOG rastreado:     {sum(utxo_set.values())/DOG_FACTOR:,.0f}')

    state['phase1_done'] = True
    state['phase1_utxo_count'] = len(utxo_set)
    save_state(state)
    save_utxo(utxo_set)

    return utxo_set


# ═══════════════════════════════════════════════════════════════════════════════
# FASE 2 — Scan forward via Bitcoin Core (858,369 → 941,110)
# ═══════════════════════════════════════════════════════════════════════════════

def phase2_scan(utxo_set, state):
    if state.get('phase2_done'):
        log.info('Fase 2 já concluída (checkpoint). Pulando.')
        return utxo_set

    start = state.get('phase2_last_block', SCAN_START_BLOCK - 1) + 1
    total_blocks     = SCAN_END_BLOCK - SCAN_START_BLOCK + 1
    blocks_remaining = SCAN_END_BLOCK - start + 1

    log.info('═══════════════════════════════════════════════════════')
    log.info(f'FASE 2 — Scan forward via Bitcoin Core ({start:,} → {SCAN_END_BLOCK:,})')
    log.info(f'  {blocks_remaining:,} blocos restantes  |  UTXO set: {len(utxo_set):,}')
    log.info('═══════════════════════════════════════════════════════\n')

    total_dog_txs = 0
    t_start = time.time()

    for height in range(start, SCAN_END_BLOCK + 1):

        t_block = time.time()
        try:
            results = scan_block(height, utxo_set)
        except Exception as e:
            log.error(f'Bloco {height}: erro fatal: {e}')
            state['phase2_last_block'] = height - 1
            save_state(state)
            save_utxo(utxo_set)
            raise

        if results:
            all_txs = []
            block_ts = None
            for tx_data, new_utxos, spent in results:
                all_txs.append(tx_data)
                for op in spent:
                    utxo_set.pop(op, None)
                utxo_set.update(new_utxos)
                if block_ts is None:
                    block_ts = tx_data['timestamp']

            save_block_file(height, all_txs,
                            block_ts or datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'))
            total_dog_txs += len(all_txs)
            log.info(f'Bloco {height:,}: {len(all_txs)} DOG txs  '
                     f'UTXO: {len(utxo_set):,}  ({time.time()-t_block:.1f}s)')

        # Checkpoint periódico
        if height % SAVE_INTERVAL == 0 or height == SCAN_END_BLOCK:
            state['phase2_last_block'] = height
            state['phase2_dog_txs']    = total_dog_txs
            save_state(state)
            save_utxo(utxo_set)

        # Progresso
        if height % LOG_INTERVAL == 0:
            elapsed = time.time() - t_start
            done    = height - start + 1
            rate    = done / elapsed if elapsed > 0 else 0
            eta_h   = ((SCAN_END_BLOCK - height) / rate / 3600) if rate > 0 else 0
            pct     = (height - SCAN_START_BLOCK + 1) / total_blocks * 100
            log.info(f'  ── {pct:.1f}%  bloco {height:,}  '
                     f'DOG txs: {total_dog_txs}  rate: {rate:.1f} bl/s  ETA: {eta_h:.1f}h')

    log.info(f'\nFase 2 concluída:')
    log.info(f'  DOG txs encontradas: {total_dog_txs:,}')
    log.info(f'  UTXO set final:      {len(utxo_set):,}')

    state['phase2_done']        = True
    state['phase2_dog_txs']     = total_dog_txs
    state['phase2_last_block']  = SCAN_END_BLOCK
    save_state(state)
    save_utxo(utxo_set)

    return utxo_set


# ═══════════════════════════════════════════════════════════════════════════════
# FASE 3 — Verificação de integridade
# ═══════════════════════════════════════════════════════════════════════════════

def phase3_verify():
    log.info('\n═══════════════════════════════════════════════════════')
    log.info('FASE 3 — Verificação de integridade')

    if not BACKFILL_UTXO_FILE.exists():
        log.error('backfill_utxo_set.json não encontrado.')
        return False
    if not LIVE_UTXO_FILE.exists():
        log.error('dog_utxo_set.json não encontrado.')
        return False

    backfill = json.loads(BACKFILL_UTXO_FILE.read_text())
    live     = json.loads(LIVE_UTXO_FILE.read_text())

    backfill_total = sum(backfill.values()) / DOG_FACTOR
    live_total     = sum(live.values())     / DOG_FACTOR
    supply         = 100_000_000_000.0

    still_unspent = {k: v for k, v in backfill.items() if k in live}
    spent_since   = {k: v for k, v in backfill.items() if k not in live}
    orphan_live   = {k: v for k, v in live.items()     if k not in backfill}

    log.info(f'Backfill UTXO set (ao fim do bloco {SCAN_END_BLOCK:,}): {len(backfill):,}')
    log.info(f'Live UTXO set (estado atual):                            {len(live):,}')
    log.info(f'Backfill DOG: {backfill_total:>22,.5f}  ({backfill_total/supply*100:.4f}% do supply)')
    log.info(f'Live DOG:     {live_total:>22,.5f}  ({live_total/supply*100:.4f}% do supply)')
    log.info(f'\nUTXOs não gastos desde {SCAN_END_BLOCK:,}: {len(still_unspent):,}')
    log.info(f'UTXOs gastos entre {SCAN_END_BLOCK:,}–hoje: {len(spent_since):,}  ← esperado')
    log.info(f'UTXOs órfãos no live (sem origem):        {len(orphan_live):,}  ← deve ser 0')

    if orphan_live:
        log.warning(f'\n⚠️  {len(orphan_live)} UTXOs no live sem origem rastreável:')
        for k, v in list(orphan_live.items())[:10]:
            log.warning(f'   {k}  →  {v/DOG_FACTOR:,.5f} DOG')
        if len(orphan_live) > 10:
            log.warning(f'   ... e mais {len(orphan_live)-10}')
        return False

    log.info('\n✅ Integridade confirmada — todos os UTXOs live têm origem rastreável.')
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# FASE 4 — Indexação Redis
# ═══════════════════════════════════════════════════════════════════════════════

def phase4_index():
    log.info('\n═══════════════════════════════════════════════════════')
    log.info('FASE 4 — Indexação Redis (Explorer)')
    r = subprocess.run(
        ['npx', 'tsx', str(PROJECT_ROOT / 'scripts' / 'build-address-tx-index.ts')],
        cwd=str(PROJECT_ROOT), timeout=600
    )
    if r.returncode == 0:
        log.info('✅ Índice Redis atualizado.')
    else:
        log.error('❌ Falha na indexação Redis.')
    return r.returncode == 0


# ─── Entry point ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='DOG Historical Backfill')
    parser.add_argument('--reset',  action='store_true', help='Reinicia do zero')
    parser.add_argument('--phase1', action='store_true', help='Só fase 1 (airdrop bootstrap)')
    parser.add_argument('--phase2', action='store_true', help='Só fase 2 (scan forward)')
    parser.add_argument('--verify', action='store_true', help='Só verificação de integridade')
    parser.add_argument('--index',  action='store_true', help='Só indexação Redis')
    args = parser.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    TX_LOG_DIR.mkdir(parents=True, exist_ok=True)

    if args.verify:
        sys.exit(0 if phase3_verify() else 1)
    if args.index:
        sys.exit(0 if phase4_index() else 1)

    if args.reset:
        log.info('Reset: removendo checkpoint e UTXO set do backfill.')
        BACKFILL_STATE_FILE.unlink(missing_ok=True)
        BACKFILL_UTXO_FILE.unlink(missing_ok=True)

    state    = load_state()
    utxo_set = load_utxo()

    if args.phase1:
        phase1_bootstrap(utxo_set, state)
        return
    if args.phase2:
        phase2_scan(utxo_set, state)
        return

    # Fluxo completo
    utxo_set = phase1_bootstrap(utxo_set, state)
    utxo_set = phase2_scan(utxo_set, state)
    ok = phase3_verify()
    phase4_index()

    log.info('\n' + ('✅ Backfill completo!' if ok else '⚠️  Backfill completo com avisos.'))


if __name__ == '__main__':
    main()
