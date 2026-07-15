# dogdata

Python SDK for the DOG DATA API -- real-time DOG rune data on Bitcoin L1.

## Installation

```bash
pip install dogdata
```

## Quick Start

```python
from dogdata import DogData

dog = DogData(api_key="dog_live_xxx")

# Get top holders
holders = dog.holders.list(page=1, limit=50)

# Look up a specific holder
holder = dog.holders.get("bc1p...")

# Get current price
price = dog.price.current()

# Get prices from all exchanges
prices = dog.price.all()

# Get forensic summary
summary = dog.forensic.summary()

# Get on-chain metrics
metrics = dog.metrics.all()
```

## Authentication

Public endpoints allow 100 requests/hour without an API key. For higher limits, pass your API key:

```python
dog = DogData(
    api_key="dog_live_xxx",           # optional
    base_url="https://www.dogdata.xyz",  # default
    timeout=30.0,                     # default 30s
)
```

## Resources

| Resource | Methods |
|----------|---------|
| `dog.holders` | `list()`, `get(address)`, `count()`, `top(limit)` |
| `dog.transactions` | `list()`, `get(txid)`, `recent(limit)`, `by_address(address)` |
| `dog.price` | `current()`, `all()`, `from_exchange(name)`, `kraken()`, `gateio()`, etc. |
| `dog.metrics` | `utxo()`, `holder_concentration()`, `realized_cap()`, `all()` |
| `dog.forensic` | `profiles()`, `profile(address)`, `summary()`, `diamond_hands()`, `paper_hands()` |
| `dog.markets` | `list()`, `by_exchange(name)` |

## Error Handling

```python
from dogdata import DogData, DogDataError

try:
    holder = dog.holders.get("invalid")
except DogDataError as e:
    print(e, e.status, e.code)
```

## Context Manager

```python
with DogData(api_key="dog_live_xxx") as dog:
    holders = dog.holders.list()
```

## Requirements

- Python 3.9+
- httpx
