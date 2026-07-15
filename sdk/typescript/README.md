# @dogdata/sdk

TypeScript SDK for the DOG DATA API -- real-time DOG rune data on Bitcoin L1.

## Installation

```bash
npm install @dogdata/sdk
```

## Quick Start

```typescript
import { DogData } from '@dogdata/sdk';

const dog = new DogData({ apiKey: 'dog_live_xxx' });

// Get top holders
const holders = await dog.holders.list({ page: 1, limit: 50 });

// Look up a specific holder
const holder = await dog.holders.get('bc1p...');

// Get current price from Kraken
const price = await dog.price.current();

// Get prices from all exchanges
const prices = await dog.price.all();

// Get forensic summary
const forensic = await dog.forensic.summary();

// Get Bitcoin network status
const btc = await dog.bitcoin.status();

// Get on-chain metrics
const metrics = await dog.metrics.all();
```

## Authentication

Public endpoints allow 100 requests/hour without an API key. For higher limits, pass your API key:

```typescript
const dog = new DogData({
  apiKey: 'dog_live_xxx',      // optional
  baseUrl: 'https://www.dogdata.xyz', // default
  timeout: 30000,              // default 30s
});
```

## Resources

| Resource | Methods |
|----------|---------|
| `dog.holders` | `list()`, `get(address)`, `count()`, `top(limit)` |
| `dog.transactions` | `list()`, `get(txid)`, `recent(limit)`, `byAddress(address)` |
| `dog.price` | `current()`, `all()`, `fromExchange(name)`, `kraken()`, `gateio()`, etc. |
| `dog.metrics` | `utxo()`, `holderConcentration()`, `realizedCap()`, `all()` |
| `dog.forensic` | `profiles()`, `profile(address)`, `summary()`, `diamondHands()`, `paperHands()` |
| `dog.airdrop` | `summary()`, `recipients()`, `recipient(address)` |
| `dog.bitcoin` | `status()`, `blockHeight()`, `fees()` |
| `dog.markets` | `list()`, `byExchange(name)` |

## Error Handling

```typescript
import { DogData, DogDataError } from '@dogdata/sdk';

try {
  const holder = await dog.holders.get('invalid');
} catch (error) {
  if (error instanceof DogDataError) {
    console.error(error.message, error.status, error.code);
  }
}
```

## Requirements

- Node.js 18+ (uses native `fetch`)
- TypeScript 5.0+ (optional, for type checking)
