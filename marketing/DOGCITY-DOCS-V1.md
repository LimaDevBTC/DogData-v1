# DogCity Documentation, V1

**Status:** public documentation, first version.
**Scope:** what DogCity is, how the snapshot was built and verified, how land is sized, how
the project tells a person from a service, and what the Financial District is. This document
does not say where any wallet lives in the city. That comes later and will be published the
same way everything else here was: with the method, the numbers, and a fingerprint.

---

## 1. What DogCity is, in one page

DogCity is a virtual city built on real lunar terrain. Bitcoin's territory sits on
Mare Tranquillitatis, one of the Moon's dark basaltic plains, mapped from real NASA data
rather than a procedural landscape invented for the game.

Every wallet that holds $DOG receives a lot on that terrain. Not a lot you buy, not a lot
you pick: a lot decided by that wallet's own history on the Bitcoin blockchain. The city is
not a real-estate product. It is a permanent record of on-chain activity, rendered as a
place you can walk through.

Three ideas carry the whole design:

- **Location is not for sale.** A wallet's position comes from its on-chain history at one
  fixed block. Nothing that can be paid for, licence, donation, or partnership, moves it.
- **The city is a photograph, not a ledger.** A lot's position, size, and district are
  frozen at the snapshot block, forever. Spending an old coin afterward does not move the
  building.
- **Only the building breathes.** Height and condition follow the wallet's live balance,
  computed by the indexer. The lot underneath never changes.

$DOG is the only asset involved. DogCity does not launch a new token, and holding a lot is
not equity, an investment, or a yield.

---

## 2. The snapshot

### What happened

On 12 September 2026 a single Bitcoin block decided the land allocation of every self
custody $DOG wallet in the city. Nothing was claimed, nothing was signed, nothing was
registered. The chain was read once, at one height, and the result was frozen.

```
block        966,670
time         12 September 2026, 11:26:45 UTC
block hash   00000000000000000001151e3718cd3766940941fa7815f7eaeb1b8588acd927
rune         DOG-GO-TO-THE-MOON   (id 840000:3, 5 decimals)
```

### What was counted

```
85,818            wallets holding $DOG
239,432           UTXOs
99,975,593,202.33  $DOG
```

The rune's total supply is 100,000,000,000. The count is 24,406,797.66 short of that
figure, and the difference is burned $DOG: destroyed on chain, owned by nobody. The
snapshot counts what exists, so it counts circulating supply exactly. The project's own API
publishes the burn figure at `/api/dog-rune/stats`.

### How it was built

A snapshot is not a photograph of today. It is a photograph of one moment, and the chain
kept moving after it.

1. The full set of DOG coins was frozen from a state the node had already confirmed, at a
   height above the snapshot block.
2. Every DOG transaction that happened after block 966,670 was then undone, one at a time:
   coins created after the block were removed, coins spent after the block were put back
   where they were.
3. The result is the set of coins that existed at 11:26:45 UTC, and nothing else.

Balance, coin age, UTXO count, and Runestone ownership were all derived from that same
frozen set, so every number in the snapshot describes the same instant. Runestone ownership
was pinned to the block too, not copied from today: 31 stones changed hands in the hours
after the snapshot, and using a fresh list would have credited 8 wallets that did not hold
one at the block and missed 13 that did.

### How it was verified

The method can be checked, which is the point. Two things had to be true, and if either
was off by a single unit the work was wrong.

**Supply conservation.** A transfer moves coins, it never creates or destroys them.
Rolling the chain back must leave the total untouched. The difference came to zero,
exactly.

**Set identity.** Every coin spent after the block had to reappear, and every coin
created after it had to disappear. The two sides matched to the unit, and no wallet came
out holding a negative balance.

These checks are not decoration. While the list was being closed they caught real
mistakes, including two source files that looked identical and were four blocks apart from
each other. A negative balance is impossible, so when one appeared it proved the inputs
were wrong, not the arithmetic. The list was only declared finished when both checks came
to zero.

### The result, sealed

The snapshot is a file. Its fingerprint is published so it cannot be quietly changed: if a
single number inside it moves, the hash stops matching.

```
dog_snapshot_966670.json         42.3 MB
sha256  dc3a8df4a5af3cc2c5ff7ea888c8f1811e21c8a78c70e121cd5ab19f80154e75

dog_snapshot_966670_utxos.json   38.8 MB
sha256  ccac1c2f5fd64b31359a8f37c52236cc3543f9a950904296e9aeabe44ca96bdf
```

The first file holds one row per wallet: balance, coin age, UTXO count, tier, Runestone
count. The second holds every counted UTXO, by wallet.

### Who the snapshot found

| Group | Wallets |
|---|---|
| Received the airdrop and still hold | 26,943 |
| Never received the airdrop, bought on the market | 58,875 |
| Hold a Runestone | 29,011 |
| Hold a Runestone and received the airdrop | 24,942 |
| Never sold a single coin of their airdrop | 19,279 |
| Never sold, and still hold their Runestone | 18,633 |

Those last 18,633 received DOG when it was given away, held every coin of it, and kept the
Runestone that brought it to them. On chain, that is the longest patience the data can
show.

Holder tier counts at the snapshot. These tiers are the ranks of the Genesis Badge, earned
by airdrop history; the badge is a mark, not a lot, and it does not decide where a wallet
lives (see section 3):

```
Satoshi Visionary       88      BTC Maximalist        100
Rune Master            261      Ordinal Believer      713
DOG Supporter        1,349      Diamond Paws       19,279
```

---

## 3. How land follows the coins

Lot area grows with the square root of a wallet's $DOG balance, between a floor and a cap:

```
area = clamp( 0.986443 x sqrt(DOG), 1 m2, 40,000 m2 )
total allocated: 46.66 km2
```

Square root is the whole point. Doubling a balance does not double the land, it multiplies
it by 1.41. A city where land grew in a straight line with money would be owned by six
wallets.

| A wallet holding | Receives a lot of |
|---|---|
| 1,000 $DOG | 31 m2 |
| 20,000 $DOG | 140 m2 |
| 101,779 $DOG (the median holder) | 315 m2 |
| 889,806 $DOG (one full airdrop allocation) | 931 m2 |
| 10,000,000 $DOG | 3,119 m2 |
| 1,644,000,000 $DOG and above | 40,000 m2 (the cap) |

Six wallets reach the cap.

The number that answers the whale question before it is asked:

```
Top 20 wallets, share of supply     33.02%
Top 20 wallets, share of land        1.14%
```

The largest wallet on the chain holds 56 times more $DOG than the twentieth largest, and
receives 2.7 times the land. That is the square root curve at work: it rewards size
without letting size erase everyone smaller.

---

## 4. How we tell a person from a service

This is the part of the project most worth explaining slowly, because it is where the city
almost got it wrong, and the record of getting it wrong is what makes the final answer
trustworthy.

### Where this ruler came from

The project's first version of this system only classified wallets that had received the
original $DOG airdrop. A wallet that never received the airdrop, no matter how much it
accumulated by buying on the open market, carried no tier and had no path to a strong
position in the city, however hard it tried.

A member of the community, the user @R_irion66036 on X, pointed this out publicly, in this
post: https://x.com/r_irion66036/status/2098835847101477099

That criticism was correct, and it changed the project. The ruler was rebuilt to order all
85,818 wallets in the snapshot by measured on-chain accumulation, independent of whether a
wallet ever received the airdrop. Location is set by history and cannot be bought: that is
the whole point of the city, a record of who was here, not a shelf of addresses for sale.
But arriving today shuts nobody out. Every $DOG wallet already holds a lot from its own
on-chain history, and anyone can still become a Founder by order of arrival, build on the
land they already own, and take an entry in the Founders' draw (section 6 covers all
three).

The airdrop itself did not disappear from the picture. It became the Genesis Badge: every
wallet that received the original airdrop carries this mark permanently, on the record as
part of the first community. The Genesis Badge is identity and legacy, never land and never
a return. It does not decide where a wallet lives and it pays out nothing; the tiers below
are its ranks.

### Why the problem exists

The rebuilt ruler needed to be a single measure that could order every wallet: how much a
wallet accumulated, and for how long it held. Call it DOG-time: for every coin a wallet
holds, multiply its amount by its age in days, and add it all up. One number, the same
question for everyone, no need to know whether a wallet received the airdrop, bought on the
market, or both.

The first time that ruler was run in full, half of its own top ranks were not people. Some
wallets held tens of thousands of deposits, one per transaction, every single day for the
project's entire history. Others had received deposits from nearly a thousand different
addresses. A ruler built to reward patient accumulation was, at the very top, rewarding
infrastructure: exchange wallets, bridges, and addresses the project itself uses to
distribute funds.

### Why it is hard

The obvious fix, exclude anything that looks like a business, runs into a structural wall:
**custody consolidates**. An exchange's wallet does not receive from the public. It
receives from the exchange's own internal transfers, which have already gathered everything
together. That gives it few counterparties, old coin age, and little turnover per address,
exactly the signature the ruler was designed to reward. In the one sense that matters most
to a ruler built on patience, a service's wallet looks better than a person's. Nothing about
the shape of the coins on chain says "this is a business." The information that a wallet
belongs to a company lives in a label, not in its transaction history.

### The metrics we tested and rejected

Every one of these was measured against the real wallet population, not judged by eye. Each
line is the number that killed it.

1. **Counting deposits or UTXOs.** One wallet had 195 separate deposits and zero signed
   transactions in its entire history: it bought, repeatedly, and never once proved it
   controlled the coins by spending them. Counting deposits measures buying, not
   conviction.
2. **Buying whole airdrop allocations** (a wallet's deposits arriving in exact multiples of
   889,806 $DOG, the size of one airdrop allocation). 68 wallets bought ten or more whole
   allocations and mostly never sold. Worse: five of those wallets received the deposits as
   the airdrop payout of their own Runestones (holding 38, 16, 13, 14, and 24 stones). A
   filter meant to catch accumulation would have punished exactly the holders the project
   promises to reward.
3. **A repeated, identical deposit value.** This only finds the market's own standard lot
   size: 88,980.60 $DOG, one tenth of an airdrop allocation, shows up in hundreds of
   perfectly ordinary wallets.
4. **Signatures per day of the wallet's active window.** A cutoff of one signature per day
   catches 20,871 wallets, a quarter of the entire city.
5. **Turnover** (signatures divided by remaining UTXOs). This catches holders who are
   consolidating, not cashing out: one wallet held 68 exact airdrop allocations inside a
   single UTXO and had signed 106 times just to merge them into it. The denominator
   collapses to one and the ratio explodes, flagging patience as suspicious.
6. **Distinct payers, counted only from the surviving UTXO** (the coins still held at the
   snapshot). This measure is nearly identical, mathematically, to counting UTXOs (a
   correlation of 0.9995 across 413 of the top 500 wallets). It rewards a wallet that
   sweeps its coins into one output, because sweeping erases the wallet's own deposit
   history, and it punishes a wallet that simply keeps everything it was ever sent.
7. **Distinct payers, counted from a wallet's complete history.** A known exchange address
   showed 763 distinct payers across 1,334 transactions, which briefly looked like a real
   line to draw. It was not: a confirmed retail wallet showed 633 distinct payers too,
   because it had bought 129 whole airdrop allocations from 633 different people and never
   sold a single coin. It measured right alongside the exchange. A cutoff proposed from a
   small sample would have wrongly flagged several confirmed people and retail wallets
   along with it.

### What works, and why

The instrument that survived is not one rule but three, plus a hard exit condition, and
each targets a different shape of custody.

**Circadian rhythm.** A service operates continuously; a person sleeps. Measuring the
concentration of a wallet's deposit times around the clock (a statistical test on the hour
of day, in UTC, each deposit arrived) separates the two: a person's deposits cluster around
the hours they are awake, a service's do not cluster at all.

```
rule: 100 or more deposits, AND a concentration score below 0.15
```

The threshold has to scale with how many deposits a wallet has, because a small sample
looks randomly clustered by chance alone. Tested against the full population of comparable
wallets, the rule caught 3 out of 71 candidates, and all 3 had signed 300 or more
transactions each: a service hiding inside what looked like a control group. Zero honest
wallets were wrongly caught.

**The 889,806 package.** A marketplace trades in whole airdrop allocations or exact
fractions of one; an exchange moves any amount at all, set by whatever a customer chooses
to send. Every verified exchange address shows close to zero deposits landing on a package
boundary. Across the whole city, 27.5% of wallets are wallets where every single deposit
landed on a package boundary, and 67.4% are wallets where none did. The number sits
squarely at one of two ends: it is either a retail signature or it is not.

**Overlap between who pays and who gets paid.** A custodian or a bridge address tends to
return funds to close to the same address that deposited them, because that is what
custody and bridging mean. An exchange almost never does: a customer deposits to one
address and withdraws to another. Measured across the clearest three reference points
available: a confirmed person showed 0% overlap, a confirmed exchange showed 2%, and an
independently confirmed cross-chain bridge address showed 63%, consistent with a bridge's
normal behavior of partial redemption (some coins migrate across and stay, some come back).
This is the one test that proves custody by mechanism rather than by threshold.

**A marketplace-fee check**, used only to confirm a person, never to exclude a service.
Confirmed retail wallets pay a marketplace fee on 86 to 100% of their purchases. It cannot
exclude a service on its own, because some professional trading activity also runs through
the same marketplace.

### How we calibrated against outside truth

The strongest evidence available anywhere in the project is a wallet whose owner asked to
be verified and paid to prove it: those addresses live in the project's verified-address
list, separate from the labels the project deduces on its own from chain data. Three such
verified exchange hot wallets, Gate.io, MEXC, and Bitget, sat at the very top of the raw
accumulation ruler. Reaching the conclusion "this is a service" for all three, using only
blind measurement (circadian rhythm, distinct destinations, volume) before ever looking at
which address belonged to which company, is what validated the instrument. That gives
confidence in what the same instrument says where no label exists yet.

The DOG-to-Stacks bridge, an address the founder confirmed directly, measured at 63%
overlap between depositors and recipients, exactly the bridge signature described above:
some transfers show a full round trip, most show partial redemption consistent with
migrating funds across chains and holding them there.

### What the ruler does not reach, honestly

The ruler only has enough signal to classify where the money actually concentrates. It
cannot classify the whole city, and it does not try to.

```
circadian rhythm signal (100+ deposits)     120 wallets    0.14%   concentrate 28% of supply
overlap signal (20+ deposits)              1,170           1.36%
any shape signal at all (10+ deposits)     3,353           3.91%   concentrate 52% of supply
too few deposits to read (under 10)       82,465          96.09%
   of those, never sent DOG at all        58,695                  excluded by rule, see below
   genuinely no signal either way         23,770          27.70%
```

In the top 500 wallets specifically, 57% have 10 or more deposits, 38% have 20 or more, and
10% have 100 or more: the signal is concentrated exactly where it matters, at the top of
the city.

### The rule that protects everyone else

A wallet only ever carries the institutional tag if it has sent $DOG at least once, in
addition to matching one of the signals above. This is not a technicality: the right of
appeal described in section 5 only works for a wallet that notices it was tagged and pushes
back. A wallet that received the airdrop and never touched it again cannot appeal, so it
must never be exposed to a tag in the first place. That single rule protects 58,695 wallets,
68% of the entire city, that have never signed a transaction of any kind.

Applied once, on the top 500 wallets, the current rule flagged 21 wallets holding
13,660,491,106 $DOG (13.66% of the supply). Eight of the 21 sit in the top 10, fifteen in
the top 60. Thirteen of the 21 were caught by only one of the four signals and carry no
independent label: those are the fragile calls, and the ones most likely to be appealed.

---

## 5. The Financial District

### What it is and why it exists

A wallet's position in the residential city is earned by patient personal accumulation. An
exchange, a bridge, or a trading desk never competed on that axis in the first place, and
placing one at the back of the line for holding the coins its own customers sent it is not
neutrality, it is punishing the entities that brought the project attention and liquidity.
The Financial District exists to give institutions their own address, sized by what they
hold, without asking the residential ruler to bend around them.

### A privilege, not a punishment

Moving a wallet with institutional behavior into the Financial District is not a penalty.
It is the arrangement that leaves both sides better off, and both sides need to be argued,
because the point is that nobody loses.

For the institution, it is a privilege. It receives an address in the city's commercial
center, where visibility is worth something, instead of disappearing into the middle of a
residential line that measures a quality it never competed for in the first place. An
exchange that brought $DOG a listing and press attention earns a storefront, not a
punishment.

For everyone else, it is also a gain. Residential lots go to the wallets that actually live
in those neighborhoods, and no person loses ground to an address that is holding coins on
behalf of other people.

The residential ruler measures personal accumulation, and an institution never competed on
that axis to begin with. Taking it out of that line is not removing it from the city, it is
placing it where what it does is exactly what counts. The right of appeal for this tag,
documented later in this section, still stands either way: a wallet flagged by mistake,
whose owner states the wallet is personal, trades it for a lot of the same standing drawn
from the project's reserve.

### Where it is

The Financial District sits inside Satoshi Plaza, the city's central precinct (everything
within 1,420 meters of the center, 6.33 km2 total), rather than in a ring further out. The
plaza was already larger than its current civic program needed, and placing the district
there gives it the most prominent address in the city without taking a single lot away from
the residential fabric.

```
Satoshi Plaza                                6.33 km2
  Financial District (institutional wallets)  1.89 km2   (30%)
  project reserve, 15% of the plaza            0.95 km2   (15%)
  civic core and existing landmark buildings   3.49 km2   (55%)
```

### How land is sized inside the district

The district uses the same square-root curve as the rest of the city, with its ceiling
raised from 40,000 m2 to 150,000 m2. The residential cap would tie every large institution
at the same maximum size, which erases exactly the size difference a financial district is
supposed to show. Under the raised cap, the largest wallet identified so far reaches roughly
112,000 m2, well under the new ceiling, and the curve still holds: a wallet with 4.3 times
the balance of another receives only 2.1 times the land. Twenty-two already-identified
institutional wallets today account for 28.85% of the supply and would occupy under 0.6 km2
even at the higher cap; a broader projection across every exchange currently listing $DOG
and their bridges puts the total closer to 1.9 km2, comfortably inside the 13.5 km2 available
in the surrounding ring should the district ever need to grow into it.

$DOG is listed on 20 exchanges today (source: CoinGecko, 13 September 2026), 14 custodial
and 6 on-chain. The project has confirmed the deposit address of 5 of the 14 custodial
exchanges so far.

### How you enter

Entry is by verified identity, never by measurement. A wallet does not qualify for the
Financial District by looking like a business on chain: the exchange or institution comes
to the project, proves who it is, and the project and the institution enter a partnership.
This is the mirror image of how a residential lot is earned: in the neighborhoods, a wallet
proves what it did; in the Financial District, it proves who it is. An exchange that has not
yet reached out does not get placed there by the project's own deduction.

### The right of appeal

Not every institutional wallet will have come forward for a partnership by the time the
city goes live, and the measurement in section 4 exists precisely to catch the ones that
have not, without silently mislabeling anyone. Any wallet automatically tagged as
institutional keeps a right of appeal: its owner can state that the wallet is personal and
trade it for a lot of the same standing drawn from the project's own reserve, no different
in size or quality from the one it gave up.

That right only works because the project holds a standing reserve everywhere it might be
needed. The project keeps 15% of the lots in every neighborhood in the city, scattered
throughout each one rather than gathered into a single block, specifically so that a lot of
comparable standing is always available near wherever an appeal happens to land. Across the
whole city that reserve totals 15,141 lots, alongside 85,797 wallet lots, using 51.05 km2 of
the 66.767 km2 of urban fabric available, with 15.71 km2 to spare.

---

## 6. The Founders Program

Founders are a separate track from the residential city: a way to fund and unlock the
city's construction, layered on top of a wallet's own lot from section 3, never a
substitute for it. A wallet's Genesis Badge, tier, and lot never change because of anything
in this section.

### What a Founder is

A Founder is any wallet that contributes to the city's construction fund before the fund
reaches 10,000,000 $DOG. There is no cap on the number of Founders: what closes the door is
time, not a seat count. Contributions are counted per wallet and add up across several
transactions, and a wallet's Founder number is assigned by order of arrival, meaning its
first contribution, never by how much it eventually gives. Contributing more later never
moves the number.

### Three axes

Everything a Founder receives sits under one of three ideas: **Seen**, the building stands
on opening day and carries a marker only Founders have; **Remembered**, the name on the
Founders' Monument and the number on the facade; and **First**, mints before the doors open
and sits inside every test and update before anyone else.

### The ladder

Every rung includes everything in the rung below it.

**Citizen, any amount.** A name on the Founders' Monument in order of arrival, a permanent
Founder number never issued again, access to the Founders Club on its island in the city's
bay, and one entry in the Founders' draw. There is no building licence below 10,000 $DOG:
the recognition is permanent either way, and the order number is the one thing that cannot
be obtained later.

**Personal, 10,000 $DOG.** Adds a one time, permanent building licence; minting before the
Grand Opening, so the building stands on day one; early access to the game, to every test
and every update; the Founder's light on the building, visible from above at night; and a
base item pack (yard and house number plaque).

**Commercial, 50,000 $DOG.** Adds an extended item pack (leisure ground, garden, lighting)
and a lunar rover parked on the lot.

**Patron, 500,000 $DOG.** Adds naming a street, with the name staying on the city map, and a
custom building designed outside the district catalogue. This is the one exception to the
rule that every district keeps its own architecture, which is why the privilege stops here:
personality lives in the items around a house, not in the house itself.

### The Founders' draw

One draw, among every Founder at any rung, on an announced date. Prizes: a Runestone, held
by the project and given away once; a custom building, the Patron privilege granted to a
winner at any rung; a street name, chosen by the winner and printed on the city map; and the
1 of 1, the first lunar rover ever minted, the only one of its kind. No lot is ever drawn:
where a wallet lives is decided by its Bitcoin history at block 966,670, never by anything
paid.

### Soulbound versus transferable

Founder and achievement items are soulbound: they prove something a wallet did, and that
proof cannot be bought. Catalogue items, bought from the store, are transferable: they are
taste, so they can trade. The split gives the city a real item market without turning merit
into merchandise.

### What a Founder is not

Not equity, not an investment, not a yield. DogCity launches no new token: no staking, no
APY, no emissions, no parallel economy. Everything runs on $DOG, which already exists on
Bitcoin and is already distributed. Being a Founder never moves a wallet's own lot, and it
never moves anyone else's either.

---

## 7. What this is not, yet

- **No lot has a published address.** The snapshot decides how much land a wallet receives,
  not where in the city that land sits. Where each wallet lives comes later, and will be
  published with the same method, numbers, and fingerprint used here.
- **No deed has been minted.** There is nothing to claim, nothing to sign, nothing to pay
  today.
- **Nothing you do now changes the snapshot.** Moving coins after block 966,670 does not
  change what that block recorded, in either direction.
- **The Financial District is a set of decided rules, not a built district.** Its
  boundaries, its cap, and its entry process are locked; the lots themselves have not been
  generated or assigned.
- **The city is not reproducible by outsiders yet.** The snapshot file and its fingerprint
  are published, and anyone can check their own wallet's balance and coin age against the
  chain by hand. A public script that rebuilds the entire list from scratch does not exist
  yet.

---

## 8. Notes for whoever writes the copy

**Safe to repeat, because they are frozen at block 966,670 and do not move:** the block
height, hash, and time; the wallet, UTXO, and $DOG totals; the burn figure; the tier counts;
the airdrop and Runestone cross-tabs; the land curve and its examples; the top-20
supply-versus-land comparison; the file hashes.

**Not safe to repeat without checking first:** the construction fund total and the current
Founder count are live and move daily. This document deliberately does not print either
number. Pull both fresh from `https://www.dogdata.xyz/api/donate/leaderboard` immediately
before publication, the same way the companion Founders Pack document flags its own live
numbers.

**Do not mention the institutional Founder rung, in any words, or any price for it.** It
exists internally, above Patron, and it is explicitly not public. It does not appear in
section 6 of this document and it should not appear anywhere this document is quoted from.

**Lead with the verification, not the totals.** The totals are what everyone will publish
back at the project. The two checks landing at exactly zero, and the published file
fingerprint, are what nobody else can claim, and they are the actual reason to believe the
totals.

**The strongest single line available:** the twenty largest wallets hold a third of every
$DOG in existence and receive 1.14% of the city's land. Say it before anyone accuses the
project of favoring whales.

**Do not name or imply which wallet sits at which position.** No wallet position, ranking
slot, or address may appear in public copy tied to a specific identity, including
institutional ones the project has deduced on its own from chain data. The only entities
safe to name publicly are ones that asked to be verified and were confirmed by their own
owner: Gate.io, MEXC, and Bitget today. Everything else stays as an aggregate number
("22 institutional wallets," "21 flagged in the top 500") or an unnamed reference point
("a confirmed exchange," "an independently confirmed bridge address").

**Always call the airdrop mark the Genesis Badge, capitalized, once it is introduced.** Do
not fall back to generic wording like "the airdrop badge" after that point: the name is
approved copy, and it carries its own definition (identity and legacy, never land, never a
return) that a generic term does not.

**Do not describe a lot as owned, titled, or deeded.** It is allocated. The deed is a later
step, and calling it a deed now creates an expectation with a date attached to it.

**Do not promise third-party reproducibility before it exists.** The file and its hash are
published; a public rebuild script is not. Promising one before it exists is the single most
expensive sentence available in this document.

**Do not say a wallet chooses its lot, and do not offer land as a reward for anything paid,
donated, or contributed.** Location is not for sale, in any program, for any reason. The
moment a contribution can produce a better address, even by chance, "on-chain history" stops
being the true answer to how a lot was earned.

**The institutional tag and the Financial District are decided, but not yet public
elsewhere.** Confirm with the founder that both are cleared for release before this document
goes live: they were finalized in the same working session that produced most of section 4
and section 5.
