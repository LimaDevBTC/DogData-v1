#!/usr/bin/env python3
"""
DOG Block Scanner - Extrai transações DOG bloco a bloco usando infraestrutura local.

Substitui dependência de Xverse/Unisat APIs.
Usa: Bitcoin Core (bitcoin-cli) + Ord indexer (ord balances/decode)

Arquitetura:
1. Bootstrap: ord balances → extrair DOG UTXOs → salvar localmente
2. Per-block: checar inputs do bloco contra UTXO set → processar DOG txs
3. Alocação: runestone edicts ou regra default (primeiro output não-OP_RETURN)

Uso:
    python3 dog_block_scanner.py                  # modo daemon (loop infinito)
    python3 dog_block_scanner.py --scan-block 941095  # escanear bloco específico
    python3 dog_block_scanner.py --bootstrap       # reconstruir UTXO set do zero
    python3 dog_block_scanner.py --once            # processar blocos pendentes e sair
"""

import subprocess
import json
import sys
import os
import time
import logging
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

# Tentar carregar .env
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
    env_local = Path(__file__).parent.parent / '.env.local'
    if env_local.exists():
        load_dotenv(env_local, override=True)
except ImportError:
    pass

# === Configurações ===
BITCOIN_CLI = 'bitcoin-cli'
ORD_BINARY = '/home/bitmax/Projects/bitcoin-fullstack/ord/target/release/ord'
ORD_DATA_DIR = '/home/bitmax/Projects/bitcoin-fullstack/ord/data'

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_DIR = PROJECT_ROOT / 'data'

UTXO_SET_FILE = DATA_DIR / 'dog_utxo_set.json'
SCANNER_STATE_FILE = DATA_DIR / 'scanner_state.json'
TX_LOG_DIR = DATA_DIR / 'dog_transactions'

UPSTASH_URL = os.environ.get('UPSTASH_KV_REST_API_URL', '')
UPSTASH_TOKEN = os.environ.get('UPSTASH_KV_REST_API_TOKEN', '')
REDIS_KEY = 'dog:transactions'

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '') or os.environ.get('SUPABASE_ANON_KEY', '')

DOG_RUNE_NAME = 'DOG•GO•TO•THE•MOON'
DOG_RUNE_ID = '840000:3'
DOG_DIVISIBILITY = 5
DOG_FACTOR = 10 ** DOG_DIVISIBILITY

POLL_INTERVAL = 30  # seconds
MAX_REDIS_TXS = 500  # max txs to keep in Redis

# === Logging ===
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
log = logging.getLogger('dog-scanner')


# === Bitcoin CLI helpers ===

def bitcoin_cli(*args, timeout=30):
    """Executa bitcoin-cli e retorna stdout."""
    result = subprocess.run(
        [BITCOIN_CLI, *args],
        capture_output=True, text=True, timeout=timeout
    )
    if result.returncode != 0:
        raise RuntimeError(f'bitcoin-cli {args[0]} failed: {result.stderr.strip()}')
    return result.stdout.strip()


def get_block_count():
    return int(bitcoin_cli('getblockcount'))


def get_block_hash(height):
    return bitcoin_cli('getblockhash', str(height))


def get_block(block_hash, verbosity=2):
    """Get block with full tx data (verbosity=2)."""
    raw = bitcoin_cli('getblock', block_hash, str(verbosity), timeout=120)
    return json.loads(raw)


def get_raw_tx(txid):
    """Get decoded transaction."""
    raw = bitcoin_cli('getrawtransaction', txid, 'true', timeout=30)
    return json.loads(raw)


def get_tx_fee_sats(tx_data):
    """Calcula fee em satoshis a partir dos inputs e outputs."""
    total_in = 0
    for vin in tx_data.get('vin', []):
        if 'coinbase' in vin:
            return 0
        try:
            prev_tx = get_raw_tx(vin['txid'])
            prev_vout = prev_tx['vout'][vin['vout']]
            total_in += int(prev_vout['value'] * 1e8)
        except Exception:
            return None

    total_out = sum(int(vout['value'] * 1e8) for vout in tx_data.get('vout', []))
    return total_in - total_out


# === Ord helpers ===

def ord_decode(txid):
    """Decode a transaction's runestone using ord."""
    try:
        result = subprocess.run(
            [ORD_BINARY, 'decode', '--txid', txid],
            capture_output=True, text=True, timeout=15
        )
        if result.returncode == 0:
            return json.loads(result.stdout)
    except Exception:
        pass
    return None


def ord_balances():
    """Run ord balances and return DOG UTXOs. Slow (~minutes)."""
    log.info('Running ord balances (this may take a few minutes)...')
    result = subprocess.run(
        [ORD_BINARY, '--data-dir', ORD_DATA_DIR, 'balances'],
        capture_output=True, text=True, timeout=600
    )
    if result.returncode != 0:
        raise RuntimeError(f'ord balances failed: {result.stderr.strip()}')

    balances = json.loads(result.stdout)
    dog_utxos = balances.get('runes', {}).get(DOG_RUNE_NAME, {})
    log.info(f'ord balances: {len(dog_utxos)} DOG UTXOs found')
    return dog_utxos


# === UTXO Set Management ===

def load_utxo_set():
    """Load DOG UTXO set from disk."""
    if UTXO_SET_FILE.exists():
        with open(UTXO_SET_FILE) as f:
            data = json.load(f)
        log.info(f'Loaded {len(data)} DOG UTXOs from {UTXO_SET_FILE.name}')
        return data
    return {}


def save_utxo_set(utxo_set):
    """Save DOG UTXO set to disk."""
    UTXO_SET_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(UTXO_SET_FILE, 'w') as f:
        json.dump(utxo_set, f)
    log.info(f'Saved {len(utxo_set)} DOG UTXOs to {UTXO_SET_FILE.name}')


def bootstrap_utxo_set():
    """Build UTXO set from ord balances. Requires ord index, not server."""
    # Check if ord server is running and stop it temporarily
    ord_running = subprocess.run(
        ['pgrep', '-f', 'ord.*server'], capture_output=True
    ).returncode == 0

    if ord_running:
        log.info('Stopping ord server temporarily for bootstrap...')
        subprocess.run(['pkill', '-TERM', '-f', 'ord.*server'], capture_output=True)
        time.sleep(5)

    try:
        dog_utxos = ord_balances()
        # Simplify format: {outpoint: amount_raw}
        utxo_set = {}
        for outpoint, rune_data in dog_utxos.items():
            amount = rune_data.get('amount', 0)
            if amount > 0:
                utxo_set[outpoint] = amount
        save_utxo_set(utxo_set)
        return utxo_set
    finally:
        if ord_running:
            log.info('Restarting ord server...')
            subprocess.Popen(
                ['nohup', ORD_BINARY, '--data-dir', ORD_DATA_DIR, '--index-runes',
                 'server', '--http', '--http-port', '8080'],
                stdout=open('/tmp/ord-server.log', 'a'),
                stderr=subprocess.STDOUT
            )
            time.sleep(3)


# === Scanner State ===

def load_state():
    if SCANNER_STATE_FILE.exists():
        with open(SCANNER_STATE_FILE) as f:
            return json.load(f)
    return {}


def save_state(state):
    SCANNER_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(SCANNER_STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2)


# === Runestone Parsing ===

def has_runestone(tx):
    """Check if a transaction has a runestone (OP_RETURN 13)."""
    for vout in tx.get('vout', []):
        asm = vout.get('scriptPubKey', {}).get('asm', '')
        if 'OP_RETURN 13' in asm:
            return True
    return False


def get_first_non_opreturn_output(tx):
    """Get index of first non-OP_RETURN output (default rune allocation)."""
    for i, vout in enumerate(tx.get('vout', [])):
        script_type = vout.get('scriptPubKey', {}).get('type', '')
        if script_type != 'nulldata':
            return i
    return None


def parse_runestone_dog_edicts(decoded):
    """Extract DOG edicts from ord decode output.

    Returns list of (output_index, amount) tuples, or None if no DOG edicts.
    """
    if not decoded or not decoded.get('runestone'):
        return None

    runestone = decoded['runestone']
    if isinstance(runestone, dict) and 'Runestone' in runestone:
        runestone = runestone['Runestone']

    edicts = runestone.get('edicts', [])
    pointer = runestone.get('pointer')

    dog_edicts = []
    for edict in edicts:
        # Edicts can be in format: {"id": "840000:3", "amount": 12345, "output": 0}
        edict_id = edict.get('id', '')
        if edict_id == DOG_RUNE_ID:
            dog_edicts.append((edict.get('output', 0), edict.get('amount', 0)))

    if dog_edicts:
        return dog_edicts

    # No DOG edicts found - return pointer info for unallocated runes
    return None


def allocate_dog_outputs(tx, dog_input_total, decoded_runestone):
    """Determine where DOG runes go in the outputs.

    Returns: dict {output_index: amount_raw}
    """
    edicts = parse_runestone_dog_edicts(decoded_runestone)

    if edicts:
        # Explicit allocation via edicts
        allocation = {}
        allocated = 0
        for output_idx, amount in edicts:
            if amount == 0:
                # amount=0 means "all remaining"
                amount = dog_input_total - allocated
            actual = min(amount, dog_input_total - allocated)
            if actual > 0:
                allocation[output_idx] = allocation.get(output_idx, 0) + actual
                allocated += actual
        # Unallocated remainder goes to pointer or first non-OP_RETURN output
        remainder = dog_input_total - allocated
        if remainder > 0:
            pointer = None
            if decoded_runestone and decoded_runestone.get('runestone'):
                rs = decoded_runestone['runestone']
                if isinstance(rs, dict) and 'Runestone' in rs:
                    rs = rs['Runestone']
                pointer = rs.get('pointer')
            if pointer is not None:
                allocation[pointer] = allocation.get(pointer, 0) + remainder
            else:
                default_out = get_first_non_opreturn_output(tx)
                if default_out is not None:
                    allocation[default_out] = allocation.get(default_out, 0) + remainder
        return allocation

    # No runestone or no DOG edicts: all DOG goes to first non-OP_RETURN output
    default_out = get_first_non_opreturn_output(tx)
    if default_out is not None:
        return {default_out: dog_input_total}

    # All outputs are OP_RETURN → DOG is burned
    return {}


# === Transaction Processing ===

def get_output_address(tx, vout_idx):
    """Get address from a transaction output."""
    if vout_idx < len(tx.get('vout', [])):
        return tx['vout'][vout_idx].get('scriptPubKey', {}).get('address')
    return None


def process_dog_tx(tx, dog_inputs, utxo_set):
    """Process a DOG transaction and return formatted data + UTXO updates.

    Args:
        tx: Full transaction data (from getblock verbosity 2)
        dog_inputs: List of (outpoint, amount_raw) for DOG inputs
        utxo_set: Current UTXO set (for updating)

    Returns:
        (tx_data, new_utxos, spent_outpoints) or None if processing fails
    """
    txid = tx['txid']
    dog_input_total = sum(amt for _, amt in dog_inputs)

    # Check for runestone and decode if present
    decoded = None
    if has_runestone(tx):
        decoded = ord_decode(txid)

    # Allocate DOG to outputs
    allocation = allocate_dog_outputs(tx, dog_input_total, decoded)

    # Resolve input addresses (senders)
    sender_addresses = {}
    for outpoint, amount in dog_inputs:
        parts = outpoint.split(':')
        prev_txid, prev_vout = parts[0], int(parts[1])
        try:
            prev_tx = get_raw_tx(prev_txid)
            addr = get_output_address(prev_tx, prev_vout)
            if addr:
                if addr not in sender_addresses:
                    sender_addresses[addr] = 0
                sender_addresses[addr] += amount
        except Exception as e:
            log.warning(f'Failed to resolve sender for {outpoint}: {e}')

    # Build senders list
    senders = []
    for addr, amount in sender_addresses.items():
        senders.append({
            'address': addr,
            'amount': amount,
            'amount_dog': round(amount / DOG_FACTOR, DOG_DIVISIBILITY),
            'has_dog': True
        })

    # Build receivers list from allocation
    receivers = []
    new_utxos = {}
    sender_addr_set = set(sender_addresses.keys())

    for vout_idx, amount in allocation.items():
        addr = get_output_address(tx, vout_idx)
        is_change = addr in sender_addr_set if addr else False

        receivers.append({
            'address': addr or 'unknown',
            'amount': amount,
            'amount_dog': round(amount / DOG_FACTOR, DOG_DIVISIBILITY),
            'has_dog': True,
            'is_change': is_change
        })

        # Track new UTXO
        new_outpoint = f'{txid}:{vout_idx}'
        new_utxos[new_outpoint] = amount

    total_in = round(dog_input_total / DOG_FACTOR, DOG_DIVISIBILITY)
    total_out = round(sum(r['amount_dog'] for r in receivers), DOG_DIVISIBILITY)
    change_amount = round(sum(r['amount_dog'] for r in receivers if r['is_change']), DOG_DIVISIBILITY)
    net_transfer = round(total_out - change_amount, DOG_DIVISIBILITY)

    # Classify transaction type
    tx_type = 'transfer'
    if len(senders) == 0:
        tx_type = 'receive_only'
    elif len(receivers) == 0:
        tx_type = 'burn'
    elif len(senders) > 1 and len(receivers) == 1:
        tx_type = 'consolidation'

    # Calculate fee
    fee_sats = get_tx_fee_sats(tx)

    # Get block timestamp
    block_time = tx.get('time', tx.get('blocktime', 0))
    timestamp = datetime.fromtimestamp(block_time, tz=timezone.utc).isoformat().replace('+00:00', 'Z') if block_time else datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

    tx_data = {
        'txid': txid,
        'block_height': tx.get('height', 0),
        'timestamp': timestamp,
        'type': tx_type,
        'senders': senders,
        'receivers': receivers,
        'sender_count': len(senders),
        'receiver_count': len(receivers),
        'total_dog_in': total_in,
        'total_dog_out': total_out,
        'total_dog_moved': total_out,
        'net_transfer': net_transfer,
        'change_amount': change_amount,
        'has_change': change_amount > 0,
        'fee_sats': fee_sats,
    }

    spent_outpoints = [op for op, _ in dog_inputs]
    return tx_data, new_utxos, spent_outpoints


# === Block Scanning ===

def scan_block(height, utxo_set):
    """Scan a block for DOG transactions.

    Returns: list of (tx_data, new_utxos, spent_outpoints)
    """
    block_hash = get_block_hash(height)
    block = get_block(block_hash, verbosity=2)

    dog_outpoints = set(utxo_set.keys())
    results = []

    for tx in block['tx']:
        # Check if any input spends a DOG UTXO
        dog_inputs = []
        for vin in tx.get('vin', []):
            if 'coinbase' in vin:
                continue
            prev_out = f'{vin["txid"]}:{vin["vout"]}'
            if prev_out in dog_outpoints:
                dog_inputs.append((prev_out, utxo_set[prev_out]))

        if not dog_inputs:
            continue

        # This is a DOG transaction!
        try:
            # Add block height to tx data (getblock verbosity 2 includes it in the block, not per-tx)
            tx['height'] = block['height']
            tx['time'] = block.get('time', 0)

            result = process_dog_tx(tx, dog_inputs, utxo_set)
            if result:
                results.append(result)
        except Exception as e:
            log.error(f'Error processing DOG tx {tx["txid"]}: {e}')

    return results


# === Metrics ===

def fetch_btc_tx_count_24h():
    """Fetch total Bitcoin transaction count for the last ~24h via mempool.space API."""
    import requests as req
    try:
        # Get recent blocks (mempool.space returns ~15 blocks per call, paginate via start_height)
        cutoff_ts = int((datetime.now(timezone.utc) - timedelta(hours=24)).timestamp())
        total_txs = 0
        start_height = None

        for _ in range(20):  # max ~300 blocks, ~24h ≈ 144 blocks
            url = 'https://mempool.space/api/v1/blocks'
            if start_height is not None:
                url += f'/{start_height}'
            resp = req.get(url, timeout=10)
            resp.raise_for_status()
            blocks = resp.json()

            if not blocks:
                break

            reached_cutoff = False
            for block in blocks:
                if block['timestamp'] < cutoff_ts:
                    reached_cutoff = True
                    break
                total_txs += block['tx_count']

            if reached_cutoff:
                break

            start_height = blocks[-1]['height'] - 1

        return total_txs
    except Exception as e:
        log.warning(f'Failed to fetch BTC tx count from mempool.space: {e}')
        return None


def compute_24h_metrics(transactions):
    """Compute last-24h metrics from a list of transactions."""
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    recent = [tx for tx in transactions if (tx.get('timestamp') or '') >= cutoff]

    # Fetch total BTC txs for dominance calculation
    btc_tx_count = fetch_btc_tx_count_24h()

    if not recent:
        return {'last24h': {
            'txCount': 0, 'totalDogMoved': 0, 'blockCount': 0,
            'avgTxPerBlock': 0, 'avgDogPerTx': 0, 'feesSats': 0, 'feesBtc': 0,
            'activeWalletCount': 0, 'volumeWalletCount': 0,
            'topActiveWallet': None, 'topVolumeWallet': None,
            'topOutWallet': None, 'topInWallet': None,
            'btcTxCount24h': btc_tx_count,
            'dogDominance24h': 0,
        }}

    tx_count = len(recent)
    total_dog = sum(tx.get('total_dog_moved', 0) for tx in recent)
    blocks = set(tx.get('block_height', 0) for tx in recent)
    block_count = len(blocks)
    fees_sats = sum(tx.get('fee_sats', 0) for tx in recent)

    # Wallet activity tracking
    wallet_tx_count = Counter()
    wallet_sent = defaultdict(float)
    wallet_received = defaultdict(float)

    for tx in recent:
        for s in tx.get('senders', []):
            addr = s.get('address', '')
            if addr:
                wallet_tx_count[addr] += 1
                wallet_sent[addr] += s.get('amount_dog', 0)
        for r in tx.get('receivers', []):
            addr = r.get('address', '')
            if addr and not r.get('is_change', False):
                wallet_tx_count[addr] += 1
                wallet_received[addr] += r.get('amount_dog', 0)

    # Top active wallet (most txs)
    top_active = None
    if wallet_tx_count:
        addr, count = wallet_tx_count.most_common(1)[0]
        top_active = {'address': addr, 'txCount': count}

    # Top volume wallet (most DOG moved in either direction)
    wallet_volume = {}
    for addr in set(list(wallet_sent.keys()) + list(wallet_received.keys())):
        sent = wallet_sent.get(addr, 0)
        recv = wallet_received.get(addr, 0)
        if sent >= recv:
            wallet_volume[addr] = {'dogMoved': sent, 'direction': 'OUT'}
        else:
            wallet_volume[addr] = {'dogMoved': recv, 'direction': 'IN'}

    top_volume = None
    if wallet_volume:
        addr = max(wallet_volume, key=lambda a: wallet_volume[a]['dogMoved'])
        top_volume = {'address': addr, **wallet_volume[addr]}

    # Top out/in wallets
    top_out = None
    if wallet_sent:
        addr = max(wallet_sent, key=wallet_sent.get)
        top_out = {'address': addr, 'dogMoved': wallet_sent[addr]}

    top_in = None
    if wallet_received:
        addr = max(wallet_received, key=wallet_received.get)
        top_in = {'address': addr, 'dogMoved': wallet_received[addr]}

    dominance = round((tx_count / btc_tx_count) * 100, 4) if btc_tx_count else None

    return {'last24h': {
        'txCount': tx_count,
        'totalDogMoved': round(total_dog, 2),
        'blockCount': block_count,
        'avgTxPerBlock': round(tx_count / block_count, 2) if block_count else 0,
        'avgDogPerTx': round(total_dog / tx_count, 2) if tx_count else 0,
        'feesSats': fees_sats,
        'feesBtc': round(fees_sats / 1e8, 8),
        'activeWalletCount': len(wallet_tx_count),
        'volumeWalletCount': len(wallet_volume),
        'btcTxCount24h': btc_tx_count,
        'dogDominance24h': dominance,
        'topActiveWallet': top_active,
        'topVolumeWallet': top_volume,
        'topOutWallet': top_out,
        'topInWallet': top_in,
    }}


# === Redis/Upstash ===

def push_to_redis(new_txs):
    """Merge new transactions into the Redis cache."""
    if not UPSTASH_URL or not UPSTASH_TOKEN:
        log.warning('Upstash not configured, skipping Redis push')
        return False

    import requests

    headers = {'Authorization': f'Bearer {UPSTASH_TOKEN}'}

    try:
        # Get existing data
        resp = requests.get(f'{UPSTASH_URL}/get/{REDIS_KEY}', headers=headers, timeout=15)
        resp.raise_for_status()
        existing_raw = resp.json().get('result')

        if existing_raw:
            existing = json.loads(existing_raw)
            existing_txs = existing.get('transactions', [])
        else:
            existing_txs = []

        # Merge: add new txs, deduplicate by txid
        existing_txids = {tx['txid'] for tx in existing_txs}
        added = 0
        for tx in new_txs:
            if tx['txid'] not in existing_txids:
                existing_txs.append(tx)
                existing_txids.add(tx['txid'])
                added += 1

        # Sort by block height desc
        existing_txs.sort(key=lambda t: t['block_height'], reverse=True)

        # Trim to max
        trimmed = existing_txs[:MAX_REDIS_TXS]
        last_block = trimmed[0]['block_height'] if trimmed else 0

        payload = {
            'timestamp': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            'total_transactions': len(trimmed),
            'last_block': last_block,
            'last_update': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            'transactions': trimmed,
            'metrics': compute_24h_metrics(trimmed),
        }

        # Save to Redis
        resp = requests.post(
            f'{UPSTASH_URL}',
            headers={**headers, 'Content-Type': 'application/json'},
            json=['SET', REDIS_KEY, json.dumps(payload)],
            timeout=15
        )
        resp.raise_for_status()

        log.info(f'Redis: added {added} txs, total {len(trimmed)}, last_block {last_block}')
        return True

    except Exception as e:
        log.error(f'Redis push failed: {e}')
        return False


def push_to_supabase(new_txs):
    """Insert transactions into Supabase dog_transactions table."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        log.warning('Supabase not configured, skipping')
        return False

    import requests as req

    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'resolution=ignore-duplicates',
    }

    try:
        rows = []
        for tx in new_txs:
            rows.append({
                'txid': tx['txid'],
                'block_height': tx['block_height'],
                'timestamp': tx['timestamp'],
                'type': tx.get('type', 'transfer'),
                'total_dog_moved': tx.get('total_dog_moved', 0),
                'net_transfer': tx.get('net_transfer', 0),
                'change_amount': tx.get('change_amount', 0),
                'has_change': tx.get('has_change', False),
                'fee_sats': tx.get('fee_sats'),
                'sender_count': tx.get('sender_count', 0),
                'receiver_count': tx.get('receiver_count', 0),
                'senders': json.dumps(tx.get('senders', [])),
                'receivers': json.dumps(tx.get('receivers', [])),
            })

        resp = req.post(
            f'{SUPABASE_URL}/rest/v1/dog_transactions',
            headers=headers,
            json=rows,
            timeout=15
        )

        if resp.status_code in (200, 201):
            log.info(f'Supabase: inserted {len(rows)} txs')
            return True
        else:
            log.error(f'Supabase insert failed: {resp.status_code} {resp.text[:200]}')
            return False

    except Exception as e:
        log.error(f'Supabase push failed: {e}')
        return False


def save_block_txs(height, txs):
    """Save block transactions to local JSON file."""
    TX_LOG_DIR.mkdir(parents=True, exist_ok=True)
    filepath = TX_LOG_DIR / f'block_{height:07d}.json'
    with open(filepath, 'w') as f:
        json.dump({
            'block_height': height,
            'timestamp': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            'transactions': txs
        }, f, indent=2)
    log.info(f'Saved {len(txs)} txs to {filepath.name}')


# === Main Loop ===

def process_pending_blocks(utxo_set, state, single_block=None):
    """Process all pending blocks (or a single block)."""
    if single_block is not None:
        blocks_to_process = [single_block]
    else:
        current_height = get_block_count()
        last_processed = state.get('last_block', current_height)

        if current_height <= last_processed:
            return 0

        blocks_to_process = list(range(last_processed + 1, current_height + 1))
        if len(blocks_to_process) > 100:
            log.warning(f'{len(blocks_to_process)} blocks pending, processing first 100')
            blocks_to_process = blocks_to_process[:100]

    total_dog_txs = 0

    for height in blocks_to_process:
        t = time.time()
        results = scan_block(height, utxo_set)

        if results:
            all_txs = []
            for tx_data, new_utxos, spent_outpoints in results:
                all_txs.append(tx_data)
                # Update UTXO set
                for op in spent_outpoints:
                    utxo_set.pop(op, None)
                utxo_set.update(new_utxos)

            save_block_txs(height, all_txs)
            push_to_redis(all_txs)
            push_to_supabase(all_txs)
            total_dog_txs += len(all_txs)

            elapsed = time.time() - t
            log.info(f'Block {height}: {len(all_txs)} DOG txs ({elapsed:.1f}s)')
        else:
            elapsed = time.time() - t
            log.debug(f'Block {height}: no DOG txs ({elapsed:.1f}s)')

        # Update state
        if single_block is None:
            state['last_block'] = height
            state['last_run'] = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
            save_state(state)

    # Save UTXO set periodically
    if total_dog_txs > 0:
        save_utxo_set(utxo_set)

    return total_dog_txs


def daemon_loop(utxo_set, state, poll_interval=30):
    """Main daemon loop - poll for new blocks every poll_interval seconds."""
    log.info(f'Starting daemon loop (poll every {poll_interval}s)')
    log.info(f'UTXO set: {len(utxo_set)} DOG UTXOs')
    log.info(f'Last processed block: {state.get("last_block", "none")}')

    while True:
        try:
            n = process_pending_blocks(utxo_set, state)
            if n > 0:
                log.info(f'Processed {n} DOG transactions')
        except KeyboardInterrupt:
            log.info('Shutting down...')
            save_utxo_set(utxo_set)
            save_state(state)
            break
        except Exception as e:
            log.error(f'Error in main loop: {e}')

        time.sleep(poll_interval)


def main():
    parser = argparse.ArgumentParser(description='DOG Block Scanner')
    parser.add_argument('--bootstrap', action='store_true',
                        help='Rebuild UTXO set from ord balances')
    parser.add_argument('--scan-block', type=int,
                        help='Scan a specific block')
    parser.add_argument('--once', action='store_true',
                        help='Process pending blocks and exit')
    parser.add_argument('--poll-interval', type=int, default=POLL_INTERVAL,
                        help=f'Poll interval in seconds (default: {POLL_INTERVAL})')
    args = parser.parse_args()

    poll_interval = args.poll_interval

    # Ensure data dirs exist
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    TX_LOG_DIR.mkdir(parents=True, exist_ok=True)

    # Load or bootstrap UTXO set
    if args.bootstrap or not UTXO_SET_FILE.exists():
        log.info('Bootstrapping UTXO set from ord balances...')
        utxo_set = bootstrap_utxo_set()
    else:
        utxo_set = load_utxo_set()

    if not utxo_set:
        log.error('No DOG UTXOs found. Run with --bootstrap first.')
        sys.exit(1)

    state = load_state()

    # Initialize state if needed
    if 'last_block' not in state:
        current = get_block_count()
        state['last_block'] = current
        state['started_at'] = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
        save_state(state)
        log.info(f'Initialized state at block {current}')

    if args.scan_block:
        log.info(f'Scanning block {args.scan_block}...')
        results = scan_block(args.scan_block, utxo_set)
        if results:
            for tx_data, new_utxos, spent in results:
                print(json.dumps(tx_data, indent=2))
        else:
            print(f'No DOG transactions in block {args.scan_block}')
        return

    if args.once:
        n = process_pending_blocks(utxo_set, state)
        log.info(f'Done. Processed {n} DOG transactions.')
        return

    # Daemon mode
    daemon_loop(utxo_set, state, poll_interval)


if __name__ == '__main__':
    main()
