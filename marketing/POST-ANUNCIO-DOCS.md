# Announcement post, DOG DATA account

**13/09/2026.** Inglês, para o X. Conferir a URL final e o @ antes de postar.

---

## Thread

**1/**
On 12 September a single Bitcoin block decided the address of every self custody $DOG wallet in
DogCity.

Block 966,670. Nothing was claimed, nothing was signed, nothing was registered.

The full documentation is now public, and so is the tool to check your own wallet.

**2/**
What the snapshot counted:

85,818 wallets
239,432 UTXOs
99,975,593,202.33 $DOG

It does not add up to 100 billion because 24,406,797.66 $DOG have been burned. We publish that
number ourselves, at /api/dog-rune/stats.

**3/**
A snapshot is not a photograph of today. It is a photograph of one moment, and the chain kept
moving after it.

We froze a state the node had already confirmed, then undid every $DOG transaction after the
block, one at a time, until only what existed at 11:26:45 UTC was left.

**4/**
Two things had to be true, and if either was off by a single unit the work was wrong.

Supply conservation: a transfer never creates or destroys coins. The difference came to zero,
exactly.

Set identity: every coin spent after the block reappeared, every coin created after it
disappeared. Matched to the unit.

**5/**
Land follows the coins by the square root of the balance, not by the balance.

Doubling a wallet does not double its land, it multiplies it by 1.41.

The twenty largest wallets hold 33.02% of all $DOG and receive 1.14% of the city.

**6/**
The hardest problem was telling a person from a service.

We tested six ways. All six failed. We published the failures, with the number that killed each
one, because the reason is structural: custody consolidates, so an exchange wallet ends up
looking like conviction.

**7/**
What finally worked is the one thing a service cannot fake.

A service runs around the clock. A person sleeps.

Measuring the hour of the day of every deposit separates them, and we calibrated it against a
bridge address and against exchanges we already had labelled.

**8/**
The ruler we started with was unfair, and the person who proved it was not on the team.

@R_irion66036 pointed out publicly that a wallet that never received the airdrop had no path to
a good place in the city, no matter how much it accumulated.

That criticism was right.

**9/**
So the ruler was rebuilt. All 85,818 wallets are now ordered by measured on chain accumulation,
whether they received the airdrop or not.

The airdrop became the Genesis Badge: identity and legacy, never land, never a return. A mark,
not a lot.

**10/**
Paste a Bitcoin address and see what it owns at block 966,670. No connect, no signature, no
cost. The chain already answered.

Full documentation: [URL]/dogcity/docs
Check a wallet: [URL]/dogcity

---

## Versão de post único, para alcance

On 12 September, block 966,670 decided the address of every self custody $DOG wallet in
DogCity.

85,818 wallets. 239,432 UTXOs. 99,975,593,202.33 $DOG.

Supply conservation closed at exactly zero. Set identity matched to the unit.

The twenty largest wallets hold 33.02% of the supply and receive 1.14% of the city, because
land follows the square root of the balance.

We also tested six ways to tell a person from a service, and published the six that failed.

Paste an address and see what it owns. No connect, no signature, no cost.

[URL]/dogcity

---

## Notas para quem posta

⚠️ **Todo número aqui é fixo e seguro de repetir.** Estão congelados no bloco 966.670 e não se
movem, ao contrário das cifras do fundo de construção, que são ao vivo.

⚠️ **Conferir o @R_irion66036 antes de postar.** Creditar uma conta errada é pior que não
creditar. E o post 8 é o mais compartilhável da thread justamente porque credita alguém de fora.

⚠️ **NÃO prometer que o snapshot é reproduzível por terceiros.** O arquivo e o hash estão
publicados e qualquer um confere a própria carteira contra a cadeia, mas um script público que
reconstrói a lista inteira NÃO existe hoje.

⚠️ **NÃO chamar o lote de deed nem de escritura.** Ele é alocado. A escritura é um passo
posterior, e chamar de escritura agora cria expectativa com data.

⚠️ **NÃO citar posição de carteira nenhuma**, nem dizer que alguma carteira é ponte ou
corretora sem rótulo verificado pelo dono.
