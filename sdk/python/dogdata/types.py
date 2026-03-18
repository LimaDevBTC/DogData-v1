from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class Holder:
    address: str
    balance: float
    rank: int
    utxo_count: int
    percentage: float
    last_updated: str


@dataclass
class HolderDetail(Holder):
    utxos: list[dict[str, Any]] = field(default_factory=list)
    first_seen: str = ""
    category: Optional[str] = None


@dataclass
class Transaction:
    txid: str
    block_height: int
    timestamp: str
    from_address: str
    to_address: str
    amount: float
    fee: float
    type: str


@dataclass
class PriceData:
    exchange: str
    price_usd: float
    price_btc: float
    volume_24h: float
    change_24h: float
    timestamp: str


@dataclass
class ForensicProfile:
    address: str
    diamond_score: float
    category: str
    airdrop_amount: float
    current_balance: float
    sold_percentage: float
    first_sell_date: Optional[str]
    transaction_count: int
    tags: list[str] = field(default_factory=list)


@dataclass
class ForensicSummary:
    total_profiles: int
    categories: dict[str, int] = field(default_factory=dict)
    average_diamond_score: float = 0.0
    diamond_hands_count: int = 0
    paper_hands_count: int = 0
    timestamp: str = ""


@dataclass
class BitcoinStatus:
    block_height: int
    hashrate: str
    difficulty: float
    mempool_size: int
    fee_rate: dict[str, float] = field(default_factory=dict)
    timestamp: str = ""


@dataclass
class MarketData:
    exchange: str
    pair: str
    price_usd: float
    volume_24h: float
    bid: float
    ask: float
    spread: float
    timestamp: str


@dataclass
class PaginatedResponse:
    data: list[dict[str, Any]]
    total: int
    page: int
    limit: int
    total_pages: int
