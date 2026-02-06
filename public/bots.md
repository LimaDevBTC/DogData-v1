# DogData API & Data — Bot Access Guide

Documentation to facilitate bot and integration access to DOG (Dog•Go•To•The•Moon) data on DogData.

**Base URL:** `https://dogdata.xyz` (or your production domain)

---

## 📡 API Endpoints

All endpoints return JSON. Use header `Accept: application/json`.

### DOG Rune — Stats & Holders

| Endpoint | Description | Parameters |
|----------|-------------|------------|
| `GET /api/dog-rune/stats` | Rune metadata, supply, top 10 holders | — |
| `GET /api/dog-rune/holders` | Paginated holders list | `page`, `limit` (max 25) |
| `GET /api/dog-rune/holders?address={addr}` | Lookup holder by address | `address` |
| `GET /api/dog-rune/holders?snapshot=refresh` | Snapshot of top 500 holders | `snapshot=refresh` |
| `GET /api/dog-rune/events-count` | Events count | — |
| `GET /api/dog-rune/search-tx` | Search transactions | `q`, `limit` |
| `GET /api/dog-rune/transactions-kv` | Transactions (KV cache) | — |
| `GET /api/dog-rune/transactions-unisat` | Transactions via Unisat | — |

### On-Chain Metrics

| Endpoint | Description |
|----------|-------------|
| `GET /api/metrics/utxo` | UTXO metrics (total, distribution) |
| `GET /api/metrics/utxo-age` | UTXO age stats |
| `GET /api/metrics/utxo-count-history` | UTXO count history |
| `GET /api/metrics/holder-concentration` | Holder concentration |
| `GET /api/metrics/realized-cap` | Realized Cap |
| `GET /api/metrics/supply-profit-loss` | Supply in profit/loss |

### Price & Markets

| Endpoint | Description |
|----------|-------------|
| `GET /api/markets` | Tickers, volume, market cap (CoinGecko + Bitflow) |
| `GET /api/price/kraken` | Kraken price |
| `GET /api/price/bitget` | Bitget price |
| `GET /api/price/mexc` | MEXC price |
| `GET /api/price/gateio` | Gate.io price |
| `GET /api/price/pionex` | Pionex price |
| `GET /api/price/bitflow` | Bitflow DEX price |
| `GET /api/price/dogswap` | DogSwap price |
| `GET /api/price/magiceden` | Magic Eden price |

### Bitcoin Network

| Endpoint | Description |
|----------|-------------|
| `GET /api/bitcoin` | Difficulty, hashrate, mempool, fees, blocks |

### Airdrop & Forensics

| Endpoint | Description |
|----------|-------------|
| `GET /api/airdrop/summary` | Airdrop summary |
| `GET /api/airdrop/recipients` | Recipients list |
| `GET /api/forensic/summary` | Forensic summary |
| `GET /api/forensic/profiles` | Forensic profiles |

### Events

| Endpoint | Description |
|----------|-------------|
| `GET /api/events` | Recent events |

---

## 📁 Static Data (JSON)

Files under `/data/` — access directly via GET:

| File | Description |
|------|-------------|
| `/data/dog_holders.json` | Bitcoin holders, UTXO stats, on-chain metrics |
| `/data/dog_holders_by_address.json` | Holders sorted by address |
| `/data/dog_price_history.json` | Price history |
| `/data/dog_transactions.json` | DOG transactions |
| `/data/airdrop_analytics.json` | Airdrop analytics |
| `/data/forensic_airdrop_data.json` | Forensic airdrop data |
| `/data/forensic_behavioral_analysis.json` | Behavioral analysis |
| `/data/verified_addresses.json` | Verified addresses (exchanges, etc.) |

**Example:**
```
GET https://dogdata.xyz/data/dog_holders.json
GET https://dogdata.xyz/data/dog_holders_by_address.json
```

---

## 🤖 Usage Examples for Bots

### cURL — Rune stats
```bash
curl -s "https://dogdata.xyz/api/dog-rune/stats" | jq
```

### cURL — Holder by address
```bash
curl -s "https://dogdata.xyz/api/dog-rune/holders?address=bc1q..." | jq
```

### cURL — Paginated holders
```bash
curl -s "https://dogdata.xyz/api/dog-rune/holders?page=1&limit=25" | jq
```

### cURL — Markets
```bash
curl -s "https://dogdata.xyz/api/markets" | jq
```

### cURL — Static data
```bash
curl -s "https://dogdata.xyz/data/dog_holders.json" | jq '.total_holders'
```

### Python
```python
import requests

r = requests.get("https://dogdata.xyz/api/dog-rune/stats")
stats = r.json()
print(stats.get("totalHolders"), stats.get("metadata", {}).get("supply"))
```

### JavaScript/Node
```javascript
const res = await fetch('https://dogdata.xyz/api/markets');
const data = await res.json();
console.log(data.marketData?.price, data.marketData?.marketCap);
```

---

## ⏱ Update Frequency

| Data | Update |
|------|--------|
| Transactions | ~3 min (cron) |
| Holders snapshot | ~15 min (cron) |
| Holders/fees/UTXO | ~1 hour (local cron) |
| Markets | ~60 s (cache) |
| Stats | 5 min cache |

---

## 📋 DOG Rune

- **Rune ID:** `840000:3`
- **Name:** Dog•Go•To•The•Moon
- **Divisibility:** 5 (1 DOG = 100,000 units)

---

## 🔗 Useful Links

- **Site:** https://dogdata.xyz
- **Twitter:** @dogdatabtc
- **This file:** https://dogdata.xyz/bots.md

---

*Last updated: 2026-02-06*
