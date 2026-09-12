# DogCity Founders Pack

**Status:** closed and locked, 12 September 2026.
**Source of truth:** `masterplan.md` §11 in the DogData-v1 repo. If this document and §11
ever disagree, §11 wins.
**Scope:** this is the complete spec. Everything below is decided unless it sits under
"Open".

---

## 1. What a Founder is

A Founder is anyone who contributes to the construction fund before it reaches
**10,000,000 $DOG**.

- There is **no cap on the number of Founders**. It is a goal, not a sale.
- What closes is the **time**, never the seat.
- Contributions are counted **per wallet and they add up**. A wallet can reach a rung
  across several transactions.
- The Founder number is assigned by **order of arrival**, meaning the wallet's first
  contribution. Contributing more later does not move the number.

## 2. The three axes

Everything a Founder gets falls under one of three, and the copy should keep them:

**Seen.** The building is standing on opening day and carries a marker only Founders have.
**Remembered.** The name on the Founders' Monument, the number on the facade.
**First.** Mints before the doors open, and is inside every test and update before anyone.

## 3. The ladder

Every rung includes everything below it.

### Citizen, any amount

- Name on the Founders' Monument, in order of arrival
- Founder number, permanent and never issued again
- Access to the Founders Club, on its island in the bay
- One entry in the Founders' draw

There is **no building licence below 10,000 $DOG**. The recognition is permanent either
way, and the order number is the one thing that cannot be obtained later.

### Personal, 10,000 $DOG

Adds:

- Building licence, paid once, permanent
- **Mints before the Grand Opening**, so the building is standing on day one
- **Early access to the game**, to every test and every update
- The Founder's light on the building, visible from above at night
- Base item pack: yard and house number plaque

### Commercial, 50,000 $DOG

Adds:

- Extended item pack: leisure ground, garden, lighting
- **A lunar rover** parked on the lot

### Patron, 500,000 $DOG

Adds:

- **Names a street**, and the name stays on the city map
- **A custom building**, designed outside the district catalogue

### Institutional partner, price on request

**NOT PUBLIC. Do not put this rung, or a price, in any public document.** It exists, it is
the top rung, and it adds a mark on a civic building. It is handled case by case.

### The Founders Club island

An island in the city's bay, carrying the Founders Club: a mooring, a hall, and the view of
the city from across the water. **Every Founder has access, at any rung.**

It is a **club, not a condominium**. Nobody owns land on that island, no lot is assigned
there, and no Founder's lot moves because of it. The island is new ground, made by the
project inside its own water, so it costs no wallet a single square metre.

There is no Founders' district and there will not be one. Where a wallet lives comes from
block 966,670. What the island gives is a place to meet, not an address.

### Why the custom building stops at Patron

Every district has its own architecture, with its own house types and variables, and that
is what keeps the city coherent. The custom building is the single exception to that rule,
so it stops at the top.

**This is also why the Founder's distinction lives in the items and not in the building.**
With per district typology, personality has to live around the house: yard, vehicle, light,
plaque. Same reason a well built neighbourhood standardises facades and frees the garden.

## 4. The Founders' draw

One draw, among **every Founder at any rung**, on an announced date that will not move.

Prizes:

| | |
|---|---|
| **A Runestone** | One of the 112,384, held by the project, given away once |
| **A custom building** | The Patron privilege, granted to a winner at any rung |
| **A street name** | Named by the winner, printed on the city map |
| **The 1 of 1** | The first lunar rover ever minted, the only one of its kind |

**No lot is ever drawn.** Where a wallet lives is decided by its Bitcoin history at block
966,670 and by nothing that is paid. See §8 for why this matters more than it looks.

## 5. Items

Two kinds, and the difference is the whole design:

```
Founder items and achievement items    SOULBOUND      they prove something you did
Catalogue items, bought                TRANSFERABLE   they are taste, so they can trade
```

Nobody buys the proof of having been first. Everybody buys decoration. This gives the city
a real item market without turning merit into merchandise.

Item families, all living on the lot rather than on the house: **ground** (yard, pool,
deck, court, fence, paving), **vehicle** (the lunar rover is the hero item), **light** (the
Founder marker, lamps), **plaque** (the Founder number on the facade).

## 6. What a Founder is not

Not equity. Not an investment. Not a yield. DogCity launches no new token. No staking, no
APY, no emissions, no parallel economy. Everything runs on **$DOG**, which already exists
on Bitcoin L1 and is already distributed.

Being a Founder does not move your lot, and it does not move anyone else's.

---

## 7. Live numbers, and the warning that goes with them

**As of 12 September 2026.** The fund is live and moves. Pull fresh numbers from
`https://www.dogdata.xyz/api/donate/leaderboard` before publishing anything.

```
fund          4,901,656 of 10,000,000 $DOG     49.0%
Founders      51
```

**The current thread is out of date.** It says 4.38M and 48 names. Correct to the live
figure at publication time.

### Snapshot facts, all verified, safe to publish

```
block              966,670
block time         12 September 2026, 11:26:45 UTC
block hash         00000000000000000001151e3718cd3766940941fa7815f7eaeb1b8588acd927

wallets with a lot      85,818
UTXOs counted          239,432
$DOG counted     99,975,593,202.33
```

If anyone asks why it is not 100,000,000,000: the difference of **24,406,797.66 $DOG has
been burned**, and the project's own API publishes it at `/api/dog-rune/stats`. Put this in
the copy before someone else puts it in a reply.

Tier counts at the snapshot:

```
Satoshi Visionary       88
BTC Maximalist         100
Rune Master            261
Ordinal Believer       713
DOG Supporter        1,349
Diamond Paws        19,279
```

Other verified crosses:

```
wallets that received the airdrop and still hold      26,943
wallets that never received the airdrop (bought)      58,875
wallets holding a Runestone                           29,011
   of those, also airdrop                             24,942
   of those, also Diamond Paws                        18,633
```

**The strongest single number for marketing:** the 20 largest wallets hold **33.02% of the
supply and receive 1.1% of the land**. Lot area grows with the square root of the balance,
so the city cannot be bought by whales. Say this before anyone accuses.

Lot area, computed from the snapshot under the published curve
(`area = clamp(0.986443 x sqrt(DOG), 1 m2, 40,000 m2)`):

```
median lot                 314.7 m2
typical airdrop wallet     930.5 m2
largest lots               40,000 m2 (cap, reached by 6 wallets)
total allocated            46.66 km2
```

---

## 8. Notes for whoever writes the copy

**Do not say Founders choose their lot.** The current thread says "Choose your lot inside
your tier's district" as a confirmed benefit. It is not decided, and it contradicts the
placement rules, which order every wallet by measured criteria. Founders choose **when** and
**what** to build, never **where**.

**Do not offer land as a Founder benefit, in any form.** It was proposed and dropped, for
two reasons worth knowing so it does not come back:

1. The noble waterfront is the one place where land is genuinely scarce and fixed, and it
   is already 4 lots short of the wallets the snapshot sends there.
2. "Location is not for sale" is the sentence the whole project stands on. The moment a
   contribution can produce a better address, even by chance, the answer to "how do you get
   on the waterfront" stops being "on-chain history" for everyone.

**Do not describe anything as a return, a share, or a yield.** The line in the current
thread is right and should stay: a city that cannot print land cannot print promises.

**The draw needs a date to do its job.** Its value is not the prize, it is the clock. Fund
data shows 38 contributors out of 6,252 sessions in the last 30 days, and a median of
2.6 hours from first visit to contribution, meaning whoever does not convert the same day
does not come back. Without a date the pack has nothing that makes a person act today.

---

## 9. Open

- **The draw date.** The only thing blocking the pack from being published in full.
- **The institutional rung**, if it is ever to be mentioned publicly at all, and in what
  words, given it has no published price.
