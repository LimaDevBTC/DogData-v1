#!/usr/bin/env python3
"""
Análise forense comportamental do airdrop DOG — atualização horária.

Para cada um dos 75k+ OGs do airdrop:
  - Cruza o saldo original com o saldo atual
  - Calcula retenção, acumulação, ranking, diamond score
  - Classifica em padrões comportamentais

Outputs gerados a cada execução:
  1. data/forensic_behavioral_analysis.json — análise completa (overwrite, estado atual)
  2. data/forensic_history.json             — série temporal acumulada (append, estatísticas leves)
  3. data/snapshots/forensic_YYYY-MM-DD.json — snapshot diário completo (1x por dia)

Uso:
    python3 scripts/update_forensic_analysis.py

Cron (integrado ao automated_update.py — não chamar diretamente no cron):
    Executado como etapa do automated_update.py a cada hora.
"""

import json
import sys
import os
from pathlib import Path
from datetime import datetime, timezone

# ─── Caminhos ────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / 'data'
SNAPSHOTS_DIR = DATA_DIR / 'snapshots'

AIRDROP_FILE       = DATA_DIR / 'airdrop_recipients.json'
HOLDERS_FILE       = DATA_DIR / 'dog_holders_by_address.json'
SCANNER_STATE_FILE = DATA_DIR / 'scanner_state.json'

OUTPUT_FULL        = DATA_DIR / 'forensic_behavioral_analysis.json'
OUTPUT_HISTORY     = DATA_DIR / 'forensic_history.json'

# ─── Constantes do protocolo ─────────────────────────────────────────────────
AIRDROP_BLOCK = 840_000  # bloco do airdrop DOG•GO•TO•THE•MOON (imutável)
BLOCKS_PER_DAY = 144

# Patterns que compõem "accumulated" (documentado explicitamente)
ACCUMULATOR_PATTERNS = {'satoshi_visionary', 'btc_maximalist', 'rune_master', 'ordinal_believer', 'dog_legend'}


def now_utc() -> str:
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.') + \
           f"{datetime.now(timezone.utc).microsecond // 1000:03d}Z"


def load_json(path: Path) -> dict | list | None:
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"[forensic] ❌ Arquivo não encontrado: {path}")
        return None
    except json.JSONDecodeError as e:
        print(f"[forensic] ❌ JSON inválido em {path}: {e}")
        return None


def get_current_block() -> int:
    """Lê o bloco atual do scanner_state.json. Fallback: estima pelo tempo."""
    state = load_json(SCANNER_STATE_FILE)
    if state and isinstance(state.get('last_block'), int):
        return state['last_block']
    # Fallback: estima ~ 947000 + blocos desde 2026-04-30
    return 947_216


def build_holders_map(holders_data: dict) -> dict:
    holders_map = {}
    for idx, holder in enumerate(holders_data.get('holders', [])):
        addr = holder.get('address')
        if addr:
            holders_map[addr] = {
                'current_balance': holder.get('total_dog', 0),
                'current_rank': idx + 1,
                'utxo_count': holder.get('utxo_count', 0),
            }
    return holders_map


def classify_behavior(profile: dict) -> dict:
    change_pct = profile['percentage_change']
    retention  = profile['retention_rate']
    rank_change = profile.get('rank_change') or 0

    if change_pct >= 1000:
        pattern, detail, score = 'satoshi_visionary', 'Satoshi Visionary (10x+)', 95
    elif change_pct >= 500:
        pattern, detail, score = 'btc_maximalist', 'BTC Maximalist (5x-10x)', 90
    elif change_pct >= 200:
        pattern, detail, score = 'rune_master', 'Rune Master (2x-5x)', 85
    elif change_pct >= 50:
        pattern, detail, score = 'ordinal_believer', 'Ordinal Believer (50%+)', 80
    elif change_pct > 0:
        pattern, detail, score = 'dog_legend', 'DOG Legend (Added Any)', 75
    elif change_pct == 0:
        pattern, detail, score = 'diamond_paws', 'Diamond Paws (Exact Hold)', 100
    elif retention >= 90:
        pattern, detail, score = 'hodl_hero', 'HODL Hero (90%+)', 65
    elif retention >= 75:
        pattern, detail, score = 'steady_holder', 'Steady Holder (75%+)', 55
    elif retention >= 50:
        pattern, detail, score = 'profit_taker', 'Profit Taker (50%+)', 45
    elif retention >= 25:
        pattern, detail, score = 'early_exit', 'Early Exit (25%+)', 30
    elif retention >= 10:
        pattern, detail, score = 'panic_seller', 'Panic Seller (10%+)', 15
    else:
        pattern, detail, score = 'paper_hands', 'Paper Hands (<10%)', 5

    if rank_change > 1000:
        score = min(100, score + 10)
    elif rank_change > 500:
        score = min(100, score + 5)
    elif rank_change < -1000:
        score = max(0, score - 10)

    profile['behavior_pattern']  = pattern
    profile['behavior_detail']   = detail
    profile['behavior_category'] = (
        'Accumulator' if pattern in ACCUMULATOR_PATTERNS
        else 'Holder'  if pattern == 'diamond_paws'
        else 'Sold or Moved'
    )
    profile['diamond_score']     = score
    profile['is_dumping']       = retention < 50 and change_pct <= 0
    return profile


def generate_insights(profile: dict) -> list[str]:
    insights = []
    if profile['percentage_change'] >= 100:
        insights.append(f"Accumulated {profile['percentage_change']:.0f}% since airdrop")
    rc = profile.get('rank_change')
    if rc and rc > 0:
        insights.append(f"Climbed {rc:,} positions")
    elif rc and rc < -100:
        insights.append(f"Dropped {abs(rc):,} positions")
    if profile['is_dumping']:
        sold = profile['airdrop_amount'] - profile['current_balance']
        insights.append(f"Sold {sold:,.0f} DOG ({100 - profile['retention_rate']:.1f}%)")
    ar = profile.get('accumulation_rate', 0)
    if ar > 10_000:
        insights.append(f"Fast accumulator: +{ar:,.0f} DOG/day")
    elif ar < -10_000:
        insights.append(f"Fast seller: {ar:,.0f} DOG/day")
    ds = profile['diamond_score']
    if ds >= 90:
        insights.append("Elite holder")
    elif ds >= 70:
        insights.append("Strong conviction")
    elif ds <= 20:
        insights.append("High sell pressure")
    return insights


def analyze_recipient(recipient: dict, holders_map: dict, days_since: float) -> dict:
    address       = recipient['address']
    airdrop_amount = recipient['airdrop_amount']
    airdrop_rank  = recipient.get('rank', 0)

    profile = {
        'address':             address,
        'airdrop_rank':        airdrop_rank,
        'airdrop_amount':      airdrop_amount,
        'receive_count':       recipient['receive_count'],
        'first_receive_block': recipient.get('first_receive_block') or None,
        'first_receive_time':  recipient.get('first_receive_time') or None,
        'current_balance':     0,
        'current_rank':        None,
        'absolute_change':     -airdrop_amount,
        'percentage_change':   -100.0,
        'retention_rate':      0.0,
        'rank_change':         None,
        'rank_status':         'out_of_ranking' if airdrop_rank else 'never_ranked',
        'behavior_pattern':    'paper_hands',
        'behavior_detail':     'Paper Hands (<10%)',
        'accumulation_rate':   0.0,
        'is_dumping':          True,
        'diamond_score':       5,
        'insights':            [],
    }

    if address in holders_map:
        h = holders_map[address]
        balance      = h['current_balance']
        current_rank = h['current_rank']

        profile['current_balance'] = balance
        profile['current_rank']    = current_rank
        profile['rank_status']     = 'in_ranking'
        profile['absolute_change'] = balance - airdrop_amount

        if airdrop_amount > 0:
            profile['percentage_change'] = (profile['absolute_change'] / airdrop_amount) * 100
            profile['retention_rate']    = (balance / airdrop_amount) * 100

        if airdrop_rank and current_rank:
            profile['rank_change'] = airdrop_rank - current_rank
        elif airdrop_rank:
            # Wallet ainda está no ranking mas airdrop_rank existia
            profile['rank_change'] = airdrop_rank - current_rank

        if days_since > 0 and profile['absolute_change'] != 0:
            profile['accumulation_rate'] = profile['absolute_change'] / days_since

        profile = classify_behavior(profile)
        profile['insights'] = generate_insights(profile)
    else:
        # Saiu do ranking: rank_change negativo relativo ao rank do airdrop
        if airdrop_rank:
            profile['rank_change'] = -airdrop_rank
            profile['rank_status'] = 'out_of_ranking'

    return profile


def run_analysis(recipients: list, holders_map: dict, current_block: int) -> tuple[list, dict]:
    blocks_since = max(0, current_block - AIRDROP_BLOCK)
    days_since   = blocks_since / BLOCKS_PER_DAY

    print(f"[forensic] Analisando {len(recipients):,} recipients × {len(holders_map):,} holders atuais")
    print(f"[forensic] Bloco atual: {current_block:,} | Blocos desde airdrop: {blocks_since:,} ({days_since:.0f} dias)")

    profiles = [analyze_recipient(r, holders_map, days_since) for r in recipients]
    profiles.sort(key=lambda x: x['diamond_score'], reverse=True)

    total = len(profiles)
    still_holding   = sum(1 for p in profiles if p['current_balance'] > 0)
    sold_everything = total - still_holding
    accumulated     = sum(1 for p in profiles if p['behavior_pattern'] in ACCUMULATOR_PATTERNS)
    dumping         = sum(1 for p in profiles if p['is_dumping'])

    by_pattern: dict[str, int] = {}
    for p in profiles:
        pat = p['behavior_pattern']
        by_pattern[pat] = by_pattern.get(pat, 0) + 1

    stats = {
        'total_analyzed':    total,
        'still_holding':     still_holding,
        'sold_everything':   sold_everything,
        'accumulated':       accumulated,
        'accumulator_patterns': sorted(ACCUMULATOR_PATTERNS),
        'dumping':           dumping,
        'retention_rate':    round(still_holding / total * 100, 4) if total else 0,
        'accumulator_rate':  round(accumulated / total * 100, 4) if total else 0,
        'dumper_rate':       round(dumping / total * 100, 4) if total else 0,
        'by_pattern':        by_pattern,
        'current_block':     current_block,
        'blocks_since_airdrop': blocks_since,
        'days_since_airdrop':   round(days_since, 1),
    }

    print(f"[forensic] Retenção: {stats['retention_rate']:.2f}% | "
          f"Holding: {still_holding:,} | Sold: {sold_everything:,} | "
          f"Accum: {accumulated:,} | Dumping: {dumping:,}")

    return profiles, stats


def save_full_analysis(profiles: list, stats: dict) -> None:
    OUTPUT_FULL.parent.mkdir(parents=True, exist_ok=True)

    top_accumulators = [p for p in profiles if p['behavior_pattern'] in ACCUMULATOR_PATTERNS][:100]
    top_diamond_paws = [p for p in profiles if p['behavior_pattern'] == 'diamond_paws'][:100]
    biggest_sellers  = sorted(
        [p for p in profiles if p['is_dumping']],
        key=lambda x: x['retention_rate']
    )[:100]

    output = {
        'timestamp':     now_utc(),
        'analysis_type': 'forensic_behavioral',
        'statistics':    stats,
        'top_performers': {
            'diamond_paws':  top_diamond_paws,
            'accumulators':  top_accumulators,
            'sellers':       biggest_sellers,
        },
        'all_profiles': profiles,
    }

    with open(OUTPUT_FULL, 'w') as f:
        json.dump(output, f, separators=(',', ':'))

    size_mb = OUTPUT_FULL.stat().st_size / 1_048_576
    print(f"[forensic] Análise completa salva → {OUTPUT_FULL.name} ({size_mb:.1f}MB)")


def append_to_history(stats: dict) -> None:
    """Acumula estatísticas leves em forensic_history.json (série temporal)."""
    history: list = []
    if OUTPUT_HISTORY.exists():
        try:
            with open(OUTPUT_HISTORY, 'r') as f:
                history = json.load(f)
        except Exception:
            history = []

    entry = {
        'timestamp':          now_utc(),
        'block_height':       stats['current_block'],
        'days_since_airdrop': stats['days_since_airdrop'],
        'still_holding':      stats['still_holding'],
        'sold_everything':    stats['sold_everything'],
        'accumulated':        stats['accumulated'],
        'dumping':            stats['dumping'],
        'retention_rate':     stats['retention_rate'],
        'accumulator_rate':   stats['accumulator_rate'],
        'dumper_rate':        stats['dumper_rate'],
        'by_pattern':         stats['by_pattern'],
    }
    history.append(entry)

    with open(OUTPUT_HISTORY, 'w') as f:
        json.dump(history, f, indent=2)

    print(f"[forensic] Histórico atualizado → {OUTPUT_HISTORY.name} ({len(history)} snapshots)")


def save_daily_snapshot(profiles: list, stats: dict) -> None:
    """Salva snapshot completo 1x por dia em data/snapshots/forensic_YYYY-MM-DD.json."""
    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    snapshot_path = SNAPSHOTS_DIR / f'forensic_{today}.json'

    if snapshot_path.exists():
        return  # já salvo hoje

    output = {
        'timestamp': now_utc(),
        'statistics': stats,
        'all_profiles': profiles,
    }

    with open(snapshot_path, 'w') as f:
        json.dump(output, f, separators=(',', ':'))

    size_mb = snapshot_path.stat().st_size / 1_048_576
    print(f"[forensic] Snapshot diário salvo → {snapshot_path.name} ({size_mb:.1f}MB)")


def main() -> int:
    print("[forensic] ═══════════════════════════════════════════════════════")
    print("[forensic] ANÁLISE FORENSE COMPORTAMENTAL — DOG Airdrop OGs")
    print("[forensic] ═══════════════════════════════════════════════════════")

    airdrop_data = load_json(AIRDROP_FILE)
    if not airdrop_data:
        print(f"[forensic] ❌ Execute o extrator de airdrop primeiro.")
        return 1

    holders_data = load_json(HOLDERS_FILE)
    if not holders_data:
        print(f"[forensic] ❌ Execute update_holders_and_fees.py primeiro.")
        return 1

    recipients   = airdrop_data.get('recipients', [])
    holders_map  = build_holders_map(holders_data)
    current_block = get_current_block()

    profiles, stats = run_analysis(recipients, holders_map, current_block)

    save_full_analysis(profiles, stats)
    append_to_history(stats)
    save_daily_snapshot(profiles, stats)

    print("[forensic] ✅ Concluído.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
