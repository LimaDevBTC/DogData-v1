#!/usr/bin/env python3
"""
Daemon de classificação real-time.

Loop:
  1. consulta getblockcount
  2. se chegou bloco novo, processa de last_height+1 até tip
  3. persiste last_height em data/tx_class_scanner_state.json
  4. dorme POLL_INTERVAL e repete

Forward-only: na primeira execução, começa do tip atual.
Catch-up: se ficar offline, processa todos os blocos perdidos sequencialmente.

Uso:
    python3 tx_class_scanner.py                       # daemon
    python3 tx_class_scanner.py --once                # processa pendentes e sai
    python3 tx_class_scanner.py --start-from <h>      # força ponto de partida
    python3 tx_class_scanner.py --poll-interval 30
"""

import argparse
import json
import logging
import signal
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from tx_classifier import bitcoin_cli
from tx_class_writer import write_height

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_DIR = PROJECT_ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)
STATE_FILE = DATA_DIR / "tx_class_scanner_state.json"

DEFAULT_POLL_INTERVAL = 30  # seconds

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [%(levelname)s] %(message)s",
                    datefmt="%Y-%m-%d %H:%M:%S")
log = logging.getLogger("tx-class-scanner")

_shutdown = False


def _on_signal(signum, frame):
    global _shutdown
    log.info(f"received signal {signum}, will exit after current block")
    _shutdown = True


signal.signal(signal.SIGTERM, _on_signal)
signal.signal(signal.SIGINT, _on_signal)


def get_tip() -> int:
    return int(bitcoin_cli("getblockcount"))


def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception as e:
            log.warning(f"state file corrupted ({e}), ignoring")
    return {}


def save_state(state: dict):
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2))
    tmp.replace(STATE_FILE)


def process_range(start: int, end: int) -> int:
    """Processa [start..end] inclusive. Retorna o último bloco processado com sucesso."""
    last_ok = start - 1
    for h in range(start, end + 1):
        if _shutdown:
            log.info(f"shutdown requested before processing {h}")
            return last_ok
        try:
            ok = write_height(h)
            if ok:
                last_ok = h
                # persiste a cada bloco — caro? não, é I/O local de ~100 bytes
                save_state({"last_height": h})
            else:
                log.error(f"write_height({h}) returned False, stopping range")
                return last_ok
        except Exception as e:
            log.exception(f"block {h} failed: {e}")
            return last_ok
    return last_ok


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--once", action="store_true", help="processa pendentes e sai")
    p.add_argument("--start-from", type=int, help="força ponto de partida (sobrescreve state)")
    p.add_argument("--poll-interval", type=int, default=DEFAULT_POLL_INTERVAL)
    args = p.parse_args()

    state = load_state()

    if args.start_from is not None:
        last_height = args.start_from - 1
        log.info(f"starting from --start-from={args.start_from} (state.last_height was {state.get('last_height')})")
    elif "last_height" in state:
        last_height = state["last_height"]
        log.info(f"resuming from state.last_height={last_height}")
    else:
        # primeira execução: forward-only, começa do tip atual
        tip = get_tip()
        last_height = tip
        save_state({"last_height": tip, "bootstrap": True})
        log.info(f"first run, starting forward-only from tip={tip} (won't process backwards)")

    while True:
        try:
            tip = get_tip()
        except Exception as e:
            log.error(f"getblockcount failed: {e}")
            if args.once:
                return 1
            time.sleep(args.poll_interval)
            continue

        if tip > last_height:
            log.info(f"new blocks: {last_height+1}..{tip} ({tip - last_height} block(s))")
            last_ok = process_range(last_height + 1, tip)
            if last_ok > last_height:
                last_height = last_ok
        elif tip < last_height:
            # Reorg deep o suficiente pra cortar abaixo do que processamos.
            # Improvável; loga e segue (reprocessamento seria a próxima iteração).
            log.warning(f"tip({tip}) < last_height({last_height}) — possível reorg profundo")

        if args.once or _shutdown:
            return 0

        time.sleep(args.poll_interval)


if __name__ == "__main__":
    sys.exit(main() or 0)
