# The DogCity Snapshot, block 966,670

**Published 12 September 2026.** Companion to the Founders Pack document.
**Scope:** what the snapshot counted, how it was built, how it was verified, and how land
follows the coins. It does **not** cover where any wallet lives in the city. That comes
later and will be published the same way.

---

## 1. What happened

On 12 September 2026 a single Bitcoin block decided the address of every self custody $DOG
wallet in DogCity. Nothing was claimed, nothing was signed, nothing was registered. The
chain was read once, at one height, and the result was frozen.

```
block        966,670
time         12 September 2026, 11:26:45 UTC
block hash   00000000000000000001151e3718cd3766940941fa7815f7eaeb1b8588acd927
rune         DOG•GO•TO•THE•MOON   (id 840000:3, 5 decimals)
```

## 2. What was counted

```
85,818           wallets holding $DOG
239,432          UTXOs
99,975,593,202.33 $DOG
```

**On the missing 24 million.** The supply of DOG is 100,000,000,000 and the count is
**24,406,797.66 short of it**. That difference is burned $DOG, destroyed on chain and owned
by nobody. The snapshot counts what exists, so it counts circulating supply exactly. The
project's own API publishes the burn figure at `/api/dog-rune/stats`.

Say this in the copy. If it is not said, it becomes the first reply under the announcement.

## 3. How it was built

A snapshot is not a photograph of today. It is a photograph of one moment, and the chain
kept moving after it.

1. The full set of DOG coins was frozen from a state the node had already confirmed, at a
   height above the snapshot block.
2. Every DOG transaction that happened **after** block 966,670 was then undone, one at a
   time: coins created after the block were removed, coins spent after the block were put
   back where they were.
3. The result is the set of coins that existed at 11:26:45 UTC, and nothing else.

Balance, coin age, UTXO count and Runestone ownership were all derived from that same set,
so every number in the snapshot describes the same instant. Runestone ownership was pinned
to the block as well, not copied from today: 31 stones changed hands in the hours after the
snapshot, and using a fresh list would have credited 8 wallets that did not hold one at the
block and missed 13 that did.

## 4. How it was verified

The method can be checked, which is the point. Two things have to be true, and if either is
off by a single unit the work is wrong.

**Supply conservation.** A transfer moves coins, it never creates or destroys them. Rolling
the chain back must leave the total untouched. **The difference came to zero, exactly.**

**Set identity.** Every coin spent after the block had to reappear, and every coin created
after it had to disappear. **The two sides matched to the unit**, and no wallet came out
holding a negative balance.

These checks are not decoration. While the list was being closed they caught real mistakes,
including two source files that looked identical and were four blocks apart from each other.
A negative balance is impossible, so when one appeared it proved the inputs were wrong, not
the arithmetic. The list was only declared finished when both checks came to zero.

## 5. The result, sealed

The snapshot is a file. Its fingerprint is published so that it cannot be quietly changed:
if a single number inside it moves, the hash stops matching.

```
dog_snapshot_966670.json         42.3 MB
sha256  dc3a8df4a5af3cc2c5ff7ea888c8f1811e21c8a78c70e121cd5ab19f80154e75

dog_snapshot_966670_utxos.json   38.8 MB
sha256  ccac1c2f5fd64b31359a8f37c52236cc3543f9a950904296e9aeabe44ca96bdf
```

The first file holds one row per wallet: balance, coin age, UTXO count, tier, Runestone
count. The second holds every counted UTXO, by wallet.

## 6. How land follows the coins

Lot area grows with the **square root** of the balance, between a floor and a cap:

```
area = clamp( 0.986443 × √DOG ,  1 m² ,  40,000 m² )
total allocated: 46.66 km²
```

Square root is the whole point. Doubling a balance does not double the land, it multiplies
it by 1.41. A city where land grew in a straight line with money would be owned by six
wallets.

| A wallet holding | Receives a lot of |
|---|---|
| 1,000 $DOG | 31 m² |
| 20,000 $DOG | 140 m² |
| 101,779 $DOG (the median holder) | 315 m² |
| 889,806 $DOG (one airdrop) | 931 m² |
| 10,000,000 $DOG | 3,119 m² |
| 1,644,000,000 $DOG and above | 40,000 m² (the cap) |

**The number that answers the whale question before it is asked:**

```
Top 20 wallets, share of supply     33.02%
Top 20 wallets, share of land        1.14%
```

Six wallets reach the cap. The largest wallet on the chain holds **56 times** more $DOG
than the twentieth largest, and receives **2.7 times** the land.

## 7. Who the snapshot found

| Group | Wallets |
|---|---|
| Received the airdrop and still hold | 26,943 |
| Never received the airdrop, bought on the market | 58,875 |
| Hold a Runestone | 29,011 |
| Hold a Runestone and received the airdrop | 24,942 |
| Never sold a single coin of their airdrop | 19,279 |
| Never sold, and still hold their Runestone | 18,633 |

Those last 18,633 received DOG when it was given away, held every coin of it, and kept the
Runestone that brought it to them. On chain, that is the longest patience the data can show.

Holder classification at the snapshot, for reference:

```
Satoshi Visionary       88      BTC Maximalist        100
Rune Master            261      Ordinal Believer      713
DOG Supporter        1,349      Diamond Paws       19,279
```

## 8. What this is not, yet

- **No lot has an address.** The snapshot decides how much land, not where.
- **No deed has been minted.** There is nothing to claim, nothing to sign, nothing to pay.
- **Nothing you do now changes it.** Moving coins after block 966,670 does not change what
  that block recorded, in either direction.

Where each wallet lives, and when the deeds are written, come later, and will be published
the same way this was: with the method, the numbers and a fingerprint.

---

## 9. Notes for whoever writes the copy

**Every number here is fixed and safe to repeat.** They are frozen at block 966,670 and do
not move, unlike the construction fund figures in the Founders Pack document, which are
live and must be refreshed before publishing.

**Sources, if anything needs checking:**

| Figure | Source |
|---|---|
| Wallets, UTXOs, $DOG, groups, tiers | `data/snapshots/dog_snapshot_966670.json` |
| Burn | `https://www.dogdata.xyz/api/dog-rune/stats` |
| Block hash and time | any Bitcoin node, `getblockhash 966670` |

**Do not claim the snapshot is reproducible by third parties yet.** The file and its hash
are published, and anyone can verify their own wallet against the chain. A public script
that rebuilds the whole list from scratch does not exist today. Promising one before it
exists is the most expensive sentence in the announcement.

**Do not describe the lot as owned, titled or deeded.** It is allocated. The deed is a later
step, and calling it a deed now creates an expectation with a date attached to it.

**Lead with the verification, not the total.** The totals are what everyone publishes. The
two checks at zero and the file fingerprint are what nobody publishes, and they are the
reason to believe the totals.

**The strongest single line available:** the twenty largest wallets hold a third of every
DOG in existence and receive 1.14% of the city. Say it before anyone accuses.
