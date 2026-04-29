#!/usr/bin/env python3
"""
DOG Historical Backfill — blocks 840,000 → 941,110

Reconstrói o histórico completo de transações DOG desde o genesis,
mantendo a cadeia de UTXOs ininterrupta.

Seed: UTXO genesis único (etch block 840,000, tx index 3)
  outpoint: e79134080a83fe3e0e06ed6990c5a9b63b362313341745707a2bff7d788a1375:1
  amount:   10,000,000,000,000,000 (= 100,000,000,000 DOG)

Output:
  - data/dog_transactions/block_XXXXXXX.json  (mesmo formato do scanner)
  - data/backfill_utxo_set.json               (UTXO set reconstruído)
  - data/backfill_state.json                  (checkpoint para resume)

Ao final, compara o UTXO set reconstruído com dog_utxo_set.json
(estado atual do scanner) para garantir integridade.

Uso:
    python3 scripts/backfill_dog_history.py              # resume do checkpoint
    python3 scripts/backfill_dog_history.py --reset      # reinicia do genesis
    python3 scripts/backfill_dog_history.py --verify     # só verifica integridade
    python3 scripts/backfill_dog_history.py --index      # só roda o índice de endereços
"""

import subprocess
import json
import sys
import os
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

# === Configurações ===

BITCOIN_CLI    = 'bitcoin-cli'
ORD_BINARY     = '/home/bitmax/Projects/bitcoin-fullstack/ord/target/release/ord'
ORD_DATA_DIR   = '/home/bitmax/Projects/bitcoin-fullstack/ord/data'

SCRIPT_DIR     = Path(__file__).parent
PROJECT_ROOT   = SCRIPT_DIR.parent
DATA_DIR       = PROJECT_ROOT / 'data'
TX_LOG_DIR     = DATA_DIR / 'dog_transactions'

BACKFILL_STATE_FILE = DATA_DIR / 'backfill_state.json'
BACKFILL_UTXO_FILE  = DATA_DIR / 'backfill_utxo_set.json'
LIVE_UTXO_FILE      = DATA_DIR / 'dog_utxo_set.json'

# Range do backfill
START_BLOCK = 840_000   # genesis DOG
END_BLOCK   = 941_110   # um antes do primeiro bloco já processado pelo scanner

# DOG genesis UTXO — único seed necessário
# Etch: block 840,000, tx index 3, pointer=1 → output[1] recebe todo o premine
GENESIS_OUTPOINT = 'e79134080a83fe3e0e06ed6990c5a9b63b362313341745707a2bff7d788a1375:1'
GENESIS_AMOUNT   = 10_000_000_000_000_000  # raw (divisibility=5)

DOG_RUNE_ID    = '840000:3'
DOG_DIVISIBILITY = 5
DOG_FACTOR     = 10 ** DOG_DIVISIBILITY

SAVE_INTERVAL  = 500   # salva checkpoint a cada N blocos
LOG_INTERVAL   = 100   # log de progresso a cada N blocos

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
log = logging.getLogger('dog-backfill')


# ─── Bitcoin CLI ──────────────────────────────────────────────────────────────

def bitcoin_cli(*args, timeout=60):
    result = subprocess.run(
        [BITCOIN_CLI, *args],
        capture_output=True, text=True, timeout=timeout
    )
    if result.returncode != 0:
        raise RuntimeError(f'bitcoin-cli {args[0]} failed: {result.stderr.strip()}')
    return result.stdout.strip()


def get_block_hash(height):
    return bitcoin_cli('getblockhash', str(height))


def get_block(block_hash, verbosity=2):
    raw = bitcoin_cli('getblock', block_hash, str(verbosity), timeout=180)
    return json.loads(raw)


def get_raw_tx(txid):
    """txindex está ativo — funciona para qualquer tx histórica."""
    raw = bitcoin_cli('getrawtransaction', txid, 'true', timeout=30)
    return json.loads(raw)


def get_tx_fee_sats(tx_data):
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
    total_out = sum(int(v['value'] * 1e8) for v in tx_data.get('vout', []))
    return total_in - total_out


# ─── Ord ─────────────────────────────────────────────────────────────────────

def ord_decode(txid):
    try:
        result = subprocess.run(
            [ORD_BINARY, '--data-dir', ORD_DATA_DIR, 'decode', '--txid', txid],
            capture_output=True, text=True, timeout=20
        )
        if result.returncode == 0:
            return json.loads(result.stdout)
    except Exception:
        pass
    return None


# ─── Runestone helpers ────────────────────────────────────────────────────────

def has_runestone(tx):
    for vout in tx.get('vout', []):
        if 'OP_RETURN 13' in vout.get('scriptPubKey', {}).get('asm', ''):
            return True
    return False


def get_first_non_opreturn_output(tx):
    for i, vout in enumerate(tx.get('vout', [])):
        if vout.get('scriptPubKey', {}).get('type') != 'nulldata':
            return i
    return None


def parse_runestone_dog_edicts(decoded):
    if not decoded or not decoded.get('runestone'):
        return None
    rs = decoded['runestone']
    if isinstance(rs, dict) and 'Runestone' in rs:
        rs = rs['Runestone']
    edicts = rs.get('edicts', [])
    dog_edicts = [(e.get('output', 0), e.get('amount', 0))
                  for e in edicts if e.get('id', '') == DOG_RUNE_ID]
    if dog_edicts:
        return dog_edicts
    return None


def allocate_dog_outputs(tx, dog_input_total, decoded_runestone):
    """Retorna (allocation: {vout_idx: amount_raw}, remainder_outputs: set)."""
    edicts = parse_runestone_dog_edicts(decoded_runestone)
    remainder_outputs = set()

    if edicts:
        allocation = {}
        allocated = 0
        for output_idx, amount in edicts:
            if amount == 0:
                amount = dog_input_total - allocated
            actual = min(amount, dog_input_total - allocated)
            if actual > 0:
                allocation[output_idx] = allocation.get(output_idx, 0) + actual
                allocated += actual

        remainder = dog_input_total - allocated
        if remainder > 0:
            pointer = None
            rs = decoded_runestone.get('runestone') if decoded_runestone else None
            if isinstance(rs, dict) and 'Runestone' in rs:
                rs = rs['Runestone']
            if rs:
                pointer = rs.get('pointer')
            if pointer is not None:
                allocation[pointer] = allocation.get(pointer, 0) + remainder
                remainder_outputs.add(pointer)
            else:
                default_out = get_first_non_opreturn_output(tx)
                if default_out is not None:
                    allocation[default_out] = allocation.get(default_out, 0) + remainder
                    remainder_outputs.add(default_out)

        return allocation, remainder_outputs

    # Sem edicts: todo o DOG vai para o primeiro output não-OP_RETURN
    default_out = get_first_non_opreturn_output(tx)
    if default_out is not None:
        return {default_out: dog_input_total}, remainder_outputs
    return {}, remainder_outputs


def get_output_address(tx, vout_idx):
    if vout_idx < len(tx.get('vout', [])):
        return tx['vout'][vout_idx].get('scriptPubKey', {}).get('address')
    return None


# ─── Processamento de TX ─────────────────────────────────────────────────────

def process_dog_tx(tx, dog_inputs):
    """
    Processa uma tx DOG e retorna (tx_data, new_utxos, spent_outpoints).
    dog_inputs: list of (outpoint_str, amount_raw)
    """
    txid = tx['txid']
    dog_input_total = sum(amt for _, amt in dog_inputs)

    decoded = ord_decode(txid) if has_runestone(tx) else None
    allocation, remainder_outputs = allocate_dog_outputs(tx, dog_input_total, decoded)

    # Senders — resolver endereços dos inputs
    sender_amounts = defaultdict(int)
    for outpoint, amount in dog_inputs:
        prev_txid, prev_vout_idx = outpoint.rsplit(':', 1)
        try:
            prev_tx = get_raw_tx(prev_txid)
            addr = get_output_address(prev_tx, int(prev_vout_idx))
            if addr:
                sender_amounts[addr] += amount
        except Exception as e:
            log.warning(f'  Falha ao resolver sender {outpoint}: {e}')

    senders = [
        {'address': addr, 'amount': amt,
         'amount_dog': round(amt / DOG_FACTOR, DOG_DIVISIBILITY), 'has_dog': True}
        for addr, amt in sender_amounts.items()
    ]

    # Receivers — construir a partir da allocation
    sender_addr_set = set(sender_amounts.keys())
    receivers = []
    new_utxos = {}

    for vout_idx, amount in allocation.items():
        addr = get_output_address(tx, vout_idx)
        is_change = (vout_idx in remainder_outputs) or (addr in sender_addr_set if addr else False)
        receivers.append({
            'address': addr or 'unknown',
            'amount': amount,
            'amount_dog': round(amount / DOG_FACTOR, DOG_DIVISIBILITY),
            'has_dog': True,
            'is_change': is_change,
        })
        new_utxos[f'{txid}:{vout_idx}'] = amount

    total_out    = round(sum(r['amount_dog'] for r in receivers), DOG_DIVISIBILITY)
    change_amount = round(sum(r['amount_dog'] for r in receivers if r['is_change']), DOG_DIVISIBILITY)
    net_transfer = round(total_out - change_amount, DOG_DIVISIBILITY)

    real_receivers = [r for r in receivers if not r['is_change']]
    tx_type = 'transfer'
    if not senders:
        tx_type = 'receive_only'
    elif not receivers:
        tx_type = 'tracking_error'
    elif not real_receivers and net_transfer == 0:
        tx_type = 'self_transfer'
    elif len(senders) > 1 and len(real_receivers) == 1:
        tx_type = 'consolidation'

    fee_sats = get_tx_fee_sats(tx)

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
        'total_dog_in': round(dog_input_total / DOG_FACTOR, DOG_DIVISIBILITY),
        'total_dog_out': total_out,
        'total_dog_moved': total_out,
        'net_transfer': net_transfer,
        'change_amount': change_amount,
        'has_change': change_amount > 0,
        'fee_sats': fee_sats,
    }

    return tx_data, new_utxos, [op for op, _ in dog_inputs]


# ─── Scan de bloco ────────────────────────────────────────────────────────────

def scan_block(height, utxo_set):
    """
    Escaneia um bloco por txs DOG.
    Retorna list of (tx_data, new_utxos, spent_outpoints).
    """
    block_hash = get_block_hash(height)
    block = get_block(block_hash, verbosity=2)

    dog_outpoints = set(utxo_set.keys())
    results = []

    for tx in block['tx']:
        dog_inputs = []
        for vin in tx.get('vin', []):
            if 'coinbase' in vin:
                continue
            prev_out = f'{vin["txid"]}:{vin["vout"]}'
            if prev_out in dog_outpoints:
                dog_inputs.append((prev_out, utxo_set[prev_out]))

        if not dog_inputs:
            continue

        tx['height'] = block['height']
        tx['time']   = block.get('time', 0)

        try:
            result = process_dog_tx(tx, dog_inputs)
            if result:
                results.append(result)
        except Exception as e:
            log.error(f'  Erro ao processar tx {tx["txid"][:16]}...: {e}')

    return results


# ─── Persistência ─────────────────────────────────────────────────────────────

def load_state():
    if BACKFILL_STATE_FILE.exists():
        with open(BACKFILL_STATE_FILE) as f:
            return json.load(f)
    return {}


def save_state(state):
    with open(BACKFILL_STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2)


def load_backfill_utxo():
    if BACKFILL_UTXO_FILE.exists():
        with open(BACKFILL_UTXO_FILE) as f:
            return json.load(f)
    # Seed: genesis UTXO
    log.info(f'Iniciando UTXO set com genesis: {GENESIS_OUTPOINT} → {GENESIS_AMOUNT/DOG_FACTOR:,.0f} DOG')
    return {GENESIS_OUTPOINT: GENESIS_AMOUNT}


def save_backfill_utxo(utxo_set):
    with open(BACKFILL_UTXO_FILE, 'w') as f:
        json.dump(utxo_set, f)


def save_block_file(height, txs, block_timestamp):
    TX_LOG_DIR.mkdir(parents=True, exist_ok=True)
    filepath = TX_LOG_DIR / f'block_{height:07d}.json'
    with open(filepath, 'w') as f:
        json.dump({
            'block_height': height,
            'timestamp': block_timestamp,
            'transactions': txs,
        }, f, separators=(',', ':'))  # compact para economizar espaço
    return filepath


def block_file_exists(height):
    return (TX_LOG_DIR / f'block_{height:07d}.json').exists()


# ─── Verificação de integridade ───────────────────────────────────────────────

def verify_integrity():
    """
    Compara o UTXO set reconstruído com o live set do scanner.
    UTXOs do backfill que existem no live set = corretos.
    UTXOs do backfill que NÃO existem no live set = foram gastos entre 941,111 e hoje = normal.
    UTXOs do live set sem outpoint no backfill = UTXOs criados antes do START_BLOCK = impossível (DOG só existe a partir de 840k).
    """
    log.info('\n═══════════════════════════════════════════')
    log.info('VERIFICAÇÃO DE INTEGRIDADE DO UTXO SET')
    log.info('═══════════════════════════════════════════')

    if not BACKFILL_UTXO_FILE.exists():
        log.error('backfill_utxo_set.json não encontrado. Rode o backfill primeiro.')
        return False

    if not LIVE_UTXO_FILE.exists():
        log.error('dog_utxo_set.json não encontrado.')
        return False

    with open(BACKFILL_UTXO_FILE) as f:
        backfill = json.load(f)
    with open(LIVE_UTXO_FILE) as f:
        live = json.load(f)

    backfill_total = sum(backfill.values()) / DOG_FACTOR
    live_total     = sum(live.values())     / DOG_FACTOR

    log.info(f'Backfill UTXOs (ao final do bloco {END_BLOCK}): {len(backfill):,}')
    log.info(f'Live UTXOs (estado atual):                      {len(live):,}')
    log.info(f'Backfill total DOG: {backfill_total:>20,.5f}')
    log.info(f'Live total DOG:     {live_total:>20,.5f}')

    # UTXOs do backfill que ainda estão no live set (ainda não gastos)
    still_unspent = {k: v for k, v in backfill.items() if k in live}
    # UTXOs do backfill que já foram gastos entre 941,111 e hoje (esperado)
    spent_since   = {k: v for k, v in backfill.items() if k not in live}
    # UTXOs do live que NÃO estão no backfill (só poderia acontecer se foram criados
    # antes do genesis — impossível para DOG, indica erro de rastreamento)
    orphan_live   = {k: v for k, v in live.items() if k not in backfill}

    log.info(f'\nUTXOs ainda não gastos desde {END_BLOCK}: {len(still_unspent):,}')
    log.info(f'UTXOs gastos entre {END_BLOCK} e hoje:    {len(spent_since):,}  ← esperado')
    log.info(f'UTXOs órfãos no live (erro):              {len(orphan_live):,}  ← deve ser 0')

    if orphan_live:
        log.warning(f'\n⚠️  {len(orphan_live)} UTXOs no live set sem origem rastreável:')
        for k, v in list(orphan_live.items())[:10]:
            log.warning(f'   {k} → {v/DOG_FACTOR:,.5f} DOG')
        if len(orphan_live) > 10:
            log.warning(f'   ... e mais {len(orphan_live)-10}')
    else:
        log.info('\n✅ Integridade confirmada: todos os UTXOs live têm origem rastreável.')

    # Cobertura de supply
    supply = 100_000_000_000.0
    backfill_coverage = backfill_total / supply * 100
    live_coverage     = live_total     / supply * 100
    log.info(f'\nCobertura do supply (100B DOG):')
    log.info(f'  Backfill: {backfill_coverage:.4f}%')
    log.info(f'  Live:     {live_coverage:.4f}%')

    return len(orphan_live) == 0


# ─── Backfill principal ───────────────────────────────────────────────────────

def run_backfill(reset=False):
    TX_LOG_DIR.mkdir(parents=True, exist_ok=True)

    if reset:
        log.info('Reset solicitado: removendo checkpoint e UTXO set do backfill.')
        BACKFILL_STATE_FILE.unlink(missing_ok=True)
        BACKFILL_UTXO_FILE.unlink(missing_ok=True)

    state    = load_state()
    utxo_set = load_backfill_utxo()

    last_done = state.get('last_block', START_BLOCK - 1)
    start     = last_done + 1

    if start > END_BLOCK:
        log.info(f'Backfill já completo (último bloco: {last_done}). Use --verify para checar integridade.')
        return

    total_blocks   = END_BLOCK - START_BLOCK + 1
    blocks_done    = last_done - START_BLOCK + 1 if last_done >= START_BLOCK else 0
    blocks_remaining = END_BLOCK - start + 1

    log.info('═══════════════════════════════════════════════════════')
    log.info('DOG HISTORICAL BACKFILL')
    log.info(f'Range:    {START_BLOCK:,} → {END_BLOCK:,}  ({total_blocks:,} blocos)')
    log.info(f'Retomando do bloco {start:,}  ({blocks_done:,} já processados, {blocks_remaining:,} restantes)')
    log.info(f'UTXO set: {len(utxo_set):,} UTXOs  ({sum(utxo_set.values())/DOG_FACTOR:,.0f} DOG)')
    log.info('═══════════════════════════════════════════════════════\n')

    total_dog_txs = 0
    total_blocks_with_txs = 0
    t_start = time.time()
    t_last_log = t_start

    for height in range(start, END_BLOCK + 1):

        # Bloco já tem arquivo? Pular scan mas ainda atualizar UTXO set
        # (arquivo pode ter sido criado por um run anterior incompleto)
        if block_file_exists(height) and height > last_done:
            # Ler o arquivo e replay das tx para manter UTXO set coerente
            filepath = TX_LOG_DIR / f'block_{height:07d}.json'
            try:
                with open(filepath) as f:
                    bdata = json.load(f)
                for tx in bdata.get('transactions', []):
                    # Gastar inputs
                    for s in tx.get('senders', []):
                        # Não temos os outpoints aqui — impossível fazer replay seguro
                        # Nesse caso, re-scan do bloco para garantir UTXO coerente
                        pass
                # Se não conseguimos fazer replay limpo, re-scan mesmo assim
                # (o arquivo será sobrescrito com dados idênticos)
            except Exception:
                pass

        t_block = time.time()
        try:
            results = scan_block(height, utxo_set)
        except Exception as e:
            log.error(f'Bloco {height}: erro fatal: {e}')
            # Salvar estado antes de abortar
            save_state({**state, 'last_block': height - 1, 'error': str(e)})
            save_backfill_utxo(utxo_set)
            raise

        if results:
            all_txs = []
            block_time_str = None

            for tx_data, new_utxos, spent_outpoints in results:
                all_txs.append(tx_data)

                # Atualizar UTXO set
                for op in spent_outpoints:
                    utxo_set.pop(op, None)
                utxo_set.update(new_utxos)

                if block_time_str is None:
                    block_time_str = tx_data['timestamp']

            if block_time_str is None:
                block_time_str = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

            save_block_file(height, all_txs, block_time_str)
            total_dog_txs += len(all_txs)
            total_blocks_with_txs += 1

            elapsed_block = time.time() - t_block
            log.info(f'Bloco {height:,}: {len(all_txs)} tx DOG  UTXO set: {len(utxo_set):,}  ({elapsed_block:.1f}s)')

        # Checkpoint periódico
        if height % SAVE_INTERVAL == 0 or height == END_BLOCK:
            save_state({
                'last_block':          height,
                'total_dog_txs':       total_dog_txs,
                'total_blocks_with_txs': total_blocks_with_txs,
                'utxo_count':          len(utxo_set),
                'last_saved':          datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            })
            save_backfill_utxo(utxo_set)

        # Log de progresso periódico
        if height % LOG_INTERVAL == 0:
            elapsed   = time.time() - t_start
            done      = height - start + 1
            remaining = END_BLOCK - height
            rate      = done / elapsed if elapsed > 0 else 0
            eta_s     = remaining / rate if rate > 0 else 0
            eta_h     = eta_s / 3600
            pct       = (height - START_BLOCK + 1) / total_blocks * 100
            log.info(
                f'  ── {pct:.1f}%  bloco {height:,}/{END_BLOCK:,}  '
                f'txs DOG: {total_dog_txs}  '
                f'rate: {rate:.1f} bl/s  '
                f'ETA: {eta_h:.1f}h'
            )

    # Salvar estado final
    save_state({
        'last_block':            END_BLOCK,
        'total_dog_txs':         total_dog_txs,
        'total_blocks_with_txs': total_blocks_with_txs,
        'utxo_count':            len(utxo_set),
        'completed_at':          datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
    })
    save_backfill_utxo(utxo_set)

    elapsed_total = time.time() - t_start
    log.info('\n═══════════════════════════════════════════════════════')
    log.info('BACKFILL COMPLETO')
    log.info(f'  Blocos escaneados:   {blocks_remaining:,}')
    log.info(f'  Blocos com DOG txs:  {total_blocks_with_txs:,}')
    log.info(f'  Total txs DOG:       {total_dog_txs:,}')
    log.info(f'  UTXO set final:      {len(utxo_set):,} UTXOs')
    log.info(f'  Tempo total:         {elapsed_total/3600:.1f}h')
    log.info('═══════════════════════════════════════════════════════\n')


# ─── Indexação de endereços ───────────────────────────────────────────────────

def run_address_index():
    """Chama build-address-tx-index.ts para indexar tudo no Redis."""
    log.info('Rodando build-address-tx-index.ts...')
    result = subprocess.run(
        ['npx', 'tsx', str(PROJECT_ROOT / 'scripts' / 'build-address-tx-index.ts')],
        cwd=str(PROJECT_ROOT),
        timeout=600,
    )
    if result.returncode == 0:
        log.info('✅ Índice de endereços atualizado.')
    else:
        log.error('❌ Falha no índice de endereços.')
    return result.returncode == 0


# ─── Entry point ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='DOG Historical Backfill')
    parser.add_argument('--reset',  action='store_true', help='Reinicia do genesis (apaga checkpoint)')
    parser.add_argument('--verify', action='store_true', help='Apenas verifica integridade do UTXO set')
    parser.add_argument('--index',  action='store_true', help='Apenas roda o índice de endereços no Redis')
    args = parser.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    TX_LOG_DIR.mkdir(parents=True, exist_ok=True)

    if args.verify:
        ok = verify_integrity()
        sys.exit(0 if ok else 1)

    if args.index:
        ok = run_address_index()
        sys.exit(0 if ok else 1)

    # Backfill completo
    run_backfill(reset=args.reset)

    # Verificação automática ao final
    log.info('\nExecutando verificação de integridade...')
    verify_integrity()

    # Indexar no Redis
    log.info('\nIndexando histórico no Redis...')
    run_address_index()


if __name__ == '__main__':
    main()
