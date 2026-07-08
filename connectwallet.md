# ConnectWallet — Conexão de carteira, prova de propriedade e claim (`connectwallet.md`)

> **Meta:** deixar o holder **conectar a carteira**, **provar que é dono** de um endereço
> (e portanto do **lote/prédio** correspondente na DogCity), e **registrar** esse imóvel
> pagando em **DOG**. Dois níveis: **Registro Comum (10.000 DOG)** — personaliza o prédio
> (nome, handle do X, avatar, links) — e **Registro Comercial** — libera **aluguel de
> espaço publicitário** na fachada/telhado. É o **Bloco E do `crosschaincity.md`**
> ("endereço legível + claims") ganhando pernas: sem carteira conectada não há claim.
>
> **Origem (2026-07-07):** conversa de design com o dono. "Conectar carteira → verificar
> propriedade → registro comum ou comercial → alugar espaço publicitário."
>
> ⚠️ **Nada de código ainda.** Este é o plano canônico do ciclo de wallet-connect.

---

## Decisões do dono (travadas)

| Tema | Decisão |
|---|---|
| **Carteiras suportadas** | **Xverse**, **Leather**, **OKX Wallet** (via `sats-connect`) e **Kray Wallet** (provider próprio `window.krayWallet`). |
| **O que se prova** | Controle de um **endereço Bitcoin** via assinatura de mensagem (não custódia nossa, não pedimos seed/PK). |
| **Elo com a cidade** | Endereço provado → casa com `dogcity_lots.address` (registro do `crosschaincity.md`) → aquele **prédio** vira "reivindicável". |
| **Registro Comum** | **10.000 DOG**. Libera: nome do prédio, **handle do X**, avatar, links, bio curta. |
| **Registro Comercial** | Nível pago acima do comum. Libera **aluguel de espaço publicitário** (fachada/telhado/outdoor). |
| **Pagamento** | Em **DOG** (Runes) para uma **treasury** do projeto; confirmação **on-chain** (não confiar só no callback da wallet). |

### A confirmar (proponho default, dono decide)

| Item | Proposta |
|---|---|
| Preço do **Comercial** | **50.000 DOG** (bate com o "10k/50k" já registrado no projeto). |
| Modelo do aluguel de anúncio | **Assinatura mensal em DOG** por slot; o dono do imóvel comercial **recebe uma parte**, o projeto retém uma taxa. |
| "Mais umas coisinhas" do Comum | handle do X (verificável), **cor/skin** do prédio, link do site, mensagem no letreiro, ENS/BNS opcional. |
| Registro Comum é **compra** ou **assinatura?** | Proposta: **taxa única** (10k DOG = imóvel registrado para sempre); Comercial pode ser **anual**. |
| Endereço que paga | Deve ser **o mesmo endereço provado** (ou qualquer endereço da mesma carteira?). Proposta: aceitar qualquer, mas **vincular o claim ao endereço do lote**. |

---

## Diagnóstico — o que já existe e o que falta

**Já existe:** o registro `wallet→lote` (`dogcity_lots`, chave = `address`) do `crosschaincity.md`
é a espinha dorsal. O Bloco E já previa "reivindicar o **seu** endereço" ligado ao claim
10k/50k DOG. A stack é Next.js 15 + Supabase + Vercel KV/Upstash (ver `package.json`).

**Falta (este plano):** (1) camada de **conexão de carteira** multi-wallet, (2) **prova de
propriedade** por assinatura, (3) **cobrança em DOG** verificada on-chain, (4) **modelo de
dados** de claims/anúncios, (5) UI de registro comum/comercial.

**Princípio:** o app **nunca** toca em chave privada ou seed. Só recebe **endereço +
assinatura + PSBT assinado**. Toda verificação de valor é **on-chain**.

---

## Panorama das carteiras (documentação levantada)

O ecossistema de wallets Bitcoin é fragmentado; a boa notícia é que existe um **padrão
unificador**: **`sats-connect`** (lib JS, ~2M downloads, mantida pela Xverse) que fala com
várias wallets via WBIP/Wallet Standard. Estratégia: **`sats-connect` como caminho
primário** + **provider injetado direto** como fallback por wallet.

| Wallet | Caminho primário | Provider direto (fallback) | Prova de posse | Runes/DOG |
|---|---|---|---|---|
| **Xverse** | `sats-connect` nativo | `window.XverseProviders.BitcoinProvider` | `signMessage` → **BIP-322** (taproot) / ECDSA (payment) | ✅ nativo |
| **Leather** | `sats-connect` (WBIP) | `window.LeatherProvider.request(...)` | `signMessage` | ✅ (Ordinals/BRC-20/Runes) |
| **OKX Wallet** | `sats-connect` (providerId) | `window.okxwallet.bitcoin` | `signMessage(msg,'ecdsa')` | ✅ (BRC20/Atomicals/Runes) |
| **Kray Wallet** | ❌ não usa sats-connect | `window.krayWallet` (provider próprio) | `signMessage` → **Schnorr BIP-340** (só taproot) | **Fase 1 (L1):** connect+prova + pagamento por **match on-chain** (ideal: pedir `sendRunes` c/ popup). **Fase 2:** transfer na **L2**. Nível aberto, sem custo |

### API essencial por wallet (verificada nos docs)

**`sats-connect` (unificado)** — docs.xverse.app/sats-connect
```ts
import { getProviders, request } from "sats-connect";

// 1) descobre wallets instaladas (retorna [{ id, name }])
const providers = getProviders();

// 2) conecta (opcional: { providerId } para mirar uma wallet específica)
const conn = await request("wallet_connect", {
  addresses: ["ordinals", "payment"],
  message: "DogData • conectar para ler seus endereços",
  network: "Mainnet",
}, /* { providerId } */);

// 3) endereços
const addrs = await request("getAddresses", null);

// 4) assina mensagem (prova de posse; BIP-322 no endereço taproot/ordinals)
const sig = await request("signMessage", { address, message });
```

**Leather (direto)** — leather.gitbook.io/developers · tipos em `@leather.io/rpc`
```ts
await window.LeatherProvider?.request("getAddresses");
await window.LeatherProvider?.request("signMessage", { message, /* paymentType */ });
await window.LeatherProvider?.request("sendTransfer", { recipients: [/* ... */] });
```

**OKX (direto)** — web3.okx.com/build/dev-docs (Bitcoin provider)
```ts
// requer extensão ≥ 2.77.1
const { address, publicKey } = await window.okxwallet.bitcoin.connect();
const signature = await window.okxwallet.bitcoin.signMessage(message, "ecdsa");
// também: signPsbt / operações de Runes
```

**Kray Wallet (direto)** — kray.space/developers · **provider próprio, NÃO sats-connect**
```ts
// detecção
if (typeof window.krayWallet !== "undefined") { /* instalada */ }

// conecta (popup) → { success, address, publicKey }  · connect() = silencioso se destravada
const { success, address, publicKey } = await window.krayWallet.requestAccounts();

// endereços: SÓ taproot (p2tr, bc1p...)
const accounts = await window.krayWallet.getAccounts();      // ['bc1p...']
const pubkey   = await window.krayWallet.getPublicKey();     // x-only hex (64 chars)

// prova de posse: assinatura Schnorr BIP-340 sobre SHA-256(msg) — NÃO é BIP-322 nem ECDSA
const { signature } = await window.krayWallet.signMessageWithConfirmation(message); // sempre popup

// saldo de DOG p/ conferência: getRunes() → { runes: [{ spacedRune, amount }] }
// getInscriptions() · getBalance() (sats) · getActiveNetwork() ('mainnet' | 'kray-l2')
```

> ⚠️ **Kray difere das outras em 3 pontos que impactam o backend:**
> (1) assina **Schnorr BIP-340 cru** (64 bytes) sobre `SHA-256(msg)` — **não** BIP-322 nem
> ECDSA → precisa de **caminho de verificação próprio** (ver Bloco A.6);
> (2) só expõe **endereço taproot** (ok — é onde os DOG de L1 e a conta L2 vivem);
> (3) **o pagamento é na L2 da KRAY, não em Runes na L1** → é um **trilho de settlement
> separado** dos outros 3 (ver Bloco B, "dois trilhos").
>
> ✅ **Pagamento confirmado pelo dev da Kray (Tom, 2026-07-07) — nível ABERTO, sem PSBT/partner
> (ele desaconselha PSBT: "é onde mora o risco"), sem custo.** Fluxo L2:
> ```ts
> const KRAY = "https://kray.space";
> const DIV = { KRAY:0, DOG:5, RADIOLA:2, DSC:0 };            // DOG tem divisibilidade 5
> const toRaw = (h, t) => Math.round(h * 10 ** (DIV[t] ?? 0)); // 10.000 DOG → 1_000_000_000
>
> // nonce da conta L2
> const nonce = (await fetch(`${KRAY}/l2/account/${buyer}`).then(r=>r.json())).nonce ?? 0;
> const pubkey = (await w.getPublicKey()).publicKey ?? await w.getPublicKey();
>
> // mensagem EXATA que o backend da Kray verifica:
> const message = `${buyer}:${treasuryL2}:${amountRaw}:${nonce}:transfer:DOG`;
> const { signature } = await w.signMessageWithConfirmation(message);
>
> await fetch(`${KRAY}/l2/transaction/send`, { method:"POST",
>   headers:{ "Content-Type":"application/json" },
>   body: JSON.stringify({ from_account:buyer, to_account:treasuryL2, amount:amountRaw,
>     token_symbol:"DOG", tx_type:"transfer", nonce, signature, pubkey }) });
> // → { tx_hash }
> ```
> **Bônus (L2):** `POST /api/l2/nfts/collection/create` + `POST /api/l2/nfts/mint` permitem
> **mintar o "deed" do imóvel como NFT na L2** (oportunidade — ver Bloco C/Extra).

> **Nota BIP-322:** ao assinar com endereço **taproot (p2tr)** — onde os DOG normalmente
> ficam — a assinatura segue **BIP-322**. É experimental; verificar server-side com o
> pacote **`bip322-js`**. Endereço de **payment (p2sh/p2wpkh)** usa **ECDSA**, verificável
> com **`bitcoinjs-message`**. Precisamos suportar **os dois** conforme o endereço do lote.

---

## Arquitetura — camada de conexão desacoplada

```
components/wallet/WalletConnectModal.tsx   ← UI de escolha (4 wallets, detecta instaladas)
        │
lib/wallet/connectors/                     ← 1 adapter por wallet, mesma interface
  ├─ types.ts        (interface WalletConnector: connect/getAddresses/signMessage/signPsbt)
  ├─ satsconnect.ts  (Xverse + Leather + OKX via sats-connect getProviders/request)
  ├─ okx.ts          (fallback window.okxwallet.bitcoin)
  ├─ leather.ts      (fallback window.LeatherProvider)
  └─ kray.ts         (window.krayWallet — connect/verify + transfer L2 via endpoints kray.space)
        │
contexts/WalletContext.tsx                 ← estado global: conectado? addresses, provider
        │
app/api/wallet/*                           ← nonce, verify, claim, pay-callback, ads
```

**Regra de ouro:** a UI e o resto do app só conhecem a **interface** `WalletConnector`.
Trocar/adicionar wallet = adicionar um adapter, sem tocar em UI. Isso é o que torna a
inclusão da **Kray** (quando confirmarmos a API) uma mudança de 1 arquivo.

---

## BLOCO A — Conectar + provar propriedade (o coração)

**Objetivo:** carteira conectada e **um endereço provado**, ligado ao lote da DogCity.

Fluxo (challenge-response, à prova de replay):

1. **Detecção:** `getProviders()` + checagem dos `window.*` → o modal mostra só as wallets
   **instaladas** (as 4, com estado "instalar" para as ausentes).
2. **Connect:** `wallet_connect` → recebemos `payment` **e** `ordinals` (taproot) addresses.
3. **Match com a cidade:** consultar `dogcity_lots` pelos endereços do usuário → listar os
   **prédios que ele pode reivindicar** (pode ter lote em BTC e/ou SOL/STX — ver §Multichain).
4. **Nonce:** `POST /api/wallet/nonce` → server gera `nonce` (uuid) + `expiresAt` (~5 min),
   guarda em Upstash/KV chaveado por `address`. Mensagem canônica:
   ```
   DogData • Prova de propriedade
   Endereço: <address>
   Lote: <street> <number>  (ou "n/a")
   Nonce: <nonce>
   Emitido: <ISO8601>
   ```
5. **Assinatura:** `signMessage({ address, message })` na wallet.
6. **Verificação server-side:** `POST /api/wallet/verify` → **3 caminhos por origem/assinatura:**
   - **Xverse/Leather/OKX** taproot/p2tr → **`bip322-js`**; payment/p2sh/p2wpkh → **`bitcoinjs-message`** (ECDSA).
   - **Kray** → verificar **Schnorr BIP-340 cru** contra a x-only pubkey (`getPublicKey`) sobre
     `SHA-256(message)` (ex.: `@noble/curves/secp256k1` `schnorr.verify`). Confirmar que a
     x-only pubkey deriva o `bc1p...` retornado. **Não** passar pelo `bip322-js`.
   - confere `nonce` (existe, não expirou, não usado) → **queima o nonce**.
   - sucesso → cria **sessão** (cookie httpOnly assinado) com `verifiedAddresses[]` + `provider`.

**Segurança:** nonce de uso único + expiração; nunca aceitar assinatura sem nonce do
servidor; **binding** claim↔endereço (nunca confiar em `address` vindo só do cliente);
rate-limit por IP/endereço.

---

## BLOCO B — Registro Comum (10.000 DOG)

**Objetivo:** com o endereço provado (Bloco A), pagar **10k DOG** e personalizar o imóvel.

> **ESCOPO POR FASE (decisão do dono, 2026-07-07): FASE 1 = L1 em TODAS as wallets.**
> A L2 da Kray e o **DOG multi-ledger** (ex.: **DOG SIP-10 da Stacks** via Xverse) ficam pra
> **Fase 2**. North star: uma carteira paga em qualquer ledger de DOG que ela tiver.
>
> **FASE 1 — pagamento em DOG Runes na L1 (todas as wallets):** valores em **RAW** (DOG
> divisibilidade 5: `10.000 DOG = 1_000_000_000`, `50.000 = 5_000_000_000`). Duas UX conforme a wallet:
> - **Xverse / Leather / OKX → PSBT:** backend monta o edict, wallet assina, backend transmite,
>   confirma no **mempool/indexer BTC** (passos 2–5 abaixo). *Caminho principal.*
> - **Kray → "envio manual + match on-chain":** o nível aberto da Kray **não expõe `signPsbt`**
>   (pagar Runes L1 via PSBT = partner, que o Tom desaconselha). Então: conecta + prova posse em
>   L1, o backend mostra **"envie 10k DOG do endereço `<provado>` → `<treasury>`"**, o usuário
>   envia **pela UI da própria Kray**, e o backend **casa a TX L1** (remetente = endereço provado,
>   destino = treasury, valor ≥ alvo). Sem PSBT/partner (passo 2K abaixo). *Confirmar com o Tom
>   que a Kray envia Runes de L1 pela UI dela — §Aberto.*
> - **`match on-chain` serve como fallback universal** (qualquer wallet que não assine PSBT).
>
> **FASE 2 (depois):** L2 da Kray (`/l2/transaction/send`, mensagem assinada — já speccado) +
> DOG SIP-10 Stacks (Xverse `stx_*`). Mesma lógica de registro, só muda o ledger/settlement.

1. **Pré-requisito:** endereço verificado **e** dono de um lote (`dogcity_lots`).

**Caminho A — PSBT (Xverse/Leather/OKX), L1:**

2. **PSBT montada SÓ no backend (regra de ouro — ver §Segurança da PSBT):** `POST
   /api/wallet/register/psbt` monta a PSBT do edict de `10.000 DOG` (endereço do usuário →
   **treasury**) **no servidor**, guarda os **outputs esperados** (treasury, valor, edict) numa
   sessão server-side, e devolve **só a PSBT pronta**. O cliente **nunca** constrói nem edita a
   PSBT — só a repassa pra wallet.
3. **Wallet assina (não transmite):** a wallet só **assina** a PSBT (`signPsbt` sats-connect/OKX,
   `sendTransfer` Leather) e devolve **a PSBT assinada** pro backend.
4. **Backend revalida ANTES de transmitir:** `POST /api/wallet/register/callback` recebe a PSBT
   assinada → o servidor **compara output por output** com o que gravou no passo 2 (treasury,
   valor, edict de DOG, sem outputs/inputs extras) → **rejeita se qualquer parâmetro mudou** →
   **finaliza e transmite o próprio backend** (não o cliente). Marca `txid` como **pending**.
5. **Confirmação on-chain (fonte da verdade):** um verificador (worker/cron) confere via
   mempool/indexer que a TX **pagou ≥10k DOG à treasury L1** e confirma → `status='registered'`.
   **Nunca** liberar o registro só no callback da wallet.

**Caminho B — Kray na L1. Preferência: popup nativo; fallback: envio manual + match.**

- **B-ideal (PEDIR AO TOM — popup igual às outras):** um método L1 de **alto nível** no provider
  público, ex. **`krayWallet.sendRunes({ rune:"DOG", to, amount })`** (ou `transfer` L1), onde **a
  própria wallet monta a tx**, mostra o **popup**, o usuário aprova, e a wallet **assina+transmite**.
  É o padrão do `sendTransfer` (Leather/OKX). **Mais seguro que expor PSBT crua** e resolve a
  objeção do Tom ("PSBT aberta no navegador") — **nada editável fica no cliente**, a construção é
  dentro da extensão. Backend só confere on-chain depois. **É o ask certo** (não pedir `signPsbt`).
- **B-fallback (funciona HOJE, sem depender do Tom):**
  - 2K. backend fixa `{treasury, amountRaw}` e mostra **"envie 10k DOG do endereço `<provado>` →
    `<treasury>`"** (QR/copiar); o usuário envia **pela UI da própria Kray** (Runes L1 — confirmado
    2026-07-07). Nada de PSBT no cliente; cliente não escolhe destino/valor.
  - 3K. **backend casa a TX L1** (remetente = endereço provado, destino = treasury, valor ≥ alvo) →
    `status='registered'`. Vincula pelo endereço provado (Bloco A). **Nunca** confiar no cliente.
  - Trocar por B-ideal é só um swap de UI quando/se o Tom liberar o `sendRunes`.

> **Fase 2 (fora do escopo agora) — Kray L2:** trocar o Caminho B por um **transfer L2**: nonce em
> `GET /l2/account/{buyer}` → assina `{buyer}:{treasuryL2}:{amountRaw}:{nonce}:transfer:DOG` →
> `POST /l2/transaction/send` → `tx_hash`, confirmado na L2 (endpoint de leitura a pedir ao Tom).
> Já está speccado; só não entra na Fase 1 (L1-only).

6. **Personalização liberada:** nome do prédio, **handle do X**, avatar, link, bio, cor/skin.
   - **X handle:** verificar posse (OAuth do X **ou** tweet/bio com o nonce). Já existe
     `twitter-api-v2` no `package.json` — reusar.
7. **Efeito na cidade:** o prédio ganha **letreiro/placa** com o nome; painel de TX passa a
   mostrar "**HODL Ave 4471 (@fulano)**" em vez do endereço cru.

### §Segurança do pagamento (lição do dev da Kray — Tom foi hackeado por isso, 2026-07-07)

> **Nunca deixe a PSBT ser construída ou editável no navegador.** Se a PSBT fica "aberta" no
> client, um atacante ou extensão maliciosa **troca os parâmetros** — endereço da treasury,
> valor, pubkey, o edict de DOG — e o pagamento vai para a carteira dele. Regras inegociáveis
> (valem p/ **todas** as wallets, não só a Kray):
>
> 1. **Construção só no backend.** O cliente nunca monta nem altera a PSBT; recebe pronta e só
>    repassa pra wallet assinar.
> 2. **Guardar os outputs esperados no servidor** (treasury, valor, edict) no momento em que monta.
> 3. **Revalidar a PSBT assinada no backend** output-por-output contra o esperado; **rejeitar**
>    qualquer divergência (output trocado, valor alterado, output extra, mudança de rede).
> 4. **O backend finaliza e transmite** — não o cliente (senão dá pra trocar a tx assinada).
> 5. **Confirmação on-chain** do edict exato → treasury exata é a **rede de segurança final**
>    (mesmo com tudo acima, é a verdade última; um pagamento adulterado não bate e não registra).
> 6. Idem para o **aluguel de anúncio** (Bloco C) e o **upgrade Comercial** — mesmo fluxo de PSBT.
>
> **Trilho L2 (Kray) — mesma doutrina, sem PSBT:** o Tom **desaconselha PSBT** ("é onde mora o
> risco") e manda usar só o nível aberto. As regras equivalentes: a **chave privada nunca sai da
> extensão** (nosso site nunca pede senha, só assinatura via popup); o **`treasuryL2` e o
> `amountRaw` são fixados pelo nosso backend**, nunca escolhidos pelo cliente; o backend
> **verifica a assinatura E confere o pagamento na L2** antes de liberar; **nunca confiar no
> cliente**; **valores sempre em RAW**.

### §Modelo de ameaça — as 3 wallets de PSBT (Xverse/Leather/OKX) são vulneráveis a troca de parâmetro?

**Não como o setup que queimou o Tom** — nelas a assinatura é **isolada dentro da extensão**: a
chave nunca sai, e a extensão mostra destino/valor num **popup próprio confiável** que o script da
*página* não reescreve. Mas segurança de verdade depende de construir certo:

| Vetor | Como o atacante age | Defesa (obrigatória no plano) |
|---|---|---|
| **Troca de output antes de assinar** | malware/extensão troca o destino na PSBT antes de chegar na wallet | **montar no backend** + usuário confere destino no popup |
| **SIGHASH permissivo** | `NONE/SINGLE/ANYONECANPAY` deixa alterar outputs **depois** de assinado | **forçar `SIGHASH_ALL`** → assinatura **tranca** todos os outputs |
| **Confiar no "paguei" do cliente** | client-side reporta pagamento falso | só **confirmação on-chain** libera o registro |
| **Cliente transmite tx trocada** | cliente troca a tx assinada antes de transmitir | **backend revalida a assinada + transmite ele mesmo** |

**Garantia do nosso lado:** com essas 4, nem um navegador comprometido faz o backend registrar sem
um pagamento real, `SIGHASH_ALL`, na treasury certa.

**Risco residual inerente (vale p/ QUALQUER wallet self-custody, incl. Kray):** se o navegador do
usuário estiver comprometido e ele **aprovar cego** um popup adulterado, ele pode redirecionar **o
próprio pagamento** (a tx é válida, o malware transmite direto). Isso **não** dá pra resolver só no
backend — a defesa é o **popup confiável da extensão** + a gente **exibir a treasury em destaque**
pro usuário comparar. Não é um furo das 3 wallets; é a natureza de assinar self-custody.

**Nota de implementação — 2 estilos p/ as 3:** (a) **`signPsbt`** (nós montamos, `SIGHASH_ALL`,
revalidamos, transmitimos) — controle máximo; (b) **`sendTransfer`/`runes_transfer`** (passamos
`{destino,valor}`, a wallet monta+transmite) — mais simples e sem risco de SIGHASH errado, mas aí a
verdade é **só a confirmação on-chain** (não há PSBT nossa pra revalidar antes). Ambos ok porque o
on-chain é a fonte final; escolher por wallet conforme o método mais estável de cada uma.

---

## BLOCO C — Registro Comercial + aluguel de publicidade

**Objetivo:** imóvel comercial pode **alugar espaço de anúncio** na cidade.

1. **Upgrade Comercial:** paga o nível comercial (**50k DOG?** a confirmar) → `dogcity_lots`
   ganha `tier_registry='commercial'`.
2. **Slots de anúncio:** cada imóvel comercial expõe **N slots** (ex.: fachada, telhado,
   outdoor da rua). Slot = `{ lot, face, size, price/mês, status }`.
3. **Mercado de anúncios (2 lados):**
   - **Anunciante** conecta wallet, escolhe um slot, envia **criativo** (imagem/URL) e
     **paga o aluguel em DOG** (mesma verificação on-chain do Bloco B).
   - **Split:** parte vai ao **dono do imóvel comercial**, parte é **taxa do projeto**.
4. **Moderação:** criativos passam por **fila de aprovação** (evitar conteúdo ilícito/scam);
   estados `pending → approved/rejected`. Expira ao fim do período pago.
5. **Render na cidade:** textura do anúncio aplicada ao mesh do prédio (fachada/telhado) por
   janela de tempo; clicável → abre link do anunciante (mesma mecânica de clique dos
   veículos/prédios do `crosschaincity.md`, Bloco D).

---

## BLOCO D — Multichain (BTC + Solana + Stacks)

A DogCity é multichain (`crosschaincity.md`), mas as **4 wallets deste plano são Bitcoin**.
Decisão de escopo (dono, 2026-07-07):

- **Fase 1 (este ciclo) — L1 em TODAS as 4 wallets:** claim/registro **só para lotes BTC**, pago
  em **DOG Runes na L1** (ver Bloco B — PSBT nas 3, envio-manual+match na Kray). É o foco agora.
- **Fase 2 — multi-ledger de DOG (a visão do dono):** o mesmo DOG em outros ledgers, escolhido
  pela wallet: **DOG SIP-10 da Stacks** via Xverse/Leather (`stx_*`) e **DOG na L2 da KRAY**
  (transfer L2 já speccado). Uma carteira paga no ledger de DOG que ela tiver.
- **Solana:** exigiria wallet Solana (Phantom/Solflare) — **fora do escopo**; o lote SOL aparece
  na cidade mas o botão "reivindicar" fica **"em breve"**.

---

## Modelo de dados (Supabase)

```sql
-- sessão de verificação (nonce de uso único)
wallet_challenges ( address text, nonce text, message text,
                    expires_at timestamptz, used bool, created_at timestamptz )

-- registro do imóvel (1 por lote reivindicado)
lot_registrations ( address text PK,            -- casa com dogcity_lots.address
                    chain text,
                    tier text,                  -- 'common' | 'commercial'
                    display_name text, x_handle text, avatar_url text,
                    links jsonb, skin text,
                    pay_txid text, pay_status text,   -- pending|registered|failed
                    registered_at timestamptz, updated_at timestamptz )

-- slots e aluguéis de anúncio (Bloco C)
ad_slots   ( id uuid PK, lot_address text, face text, size text,
             price_dog bigint, status text )
ad_rentals ( id uuid PK, slot_id uuid, advertiser_address text,
             creative_url text, click_url text,
             period_start timestamptz, period_end timestamptz,
             pay_txid text, pay_status text, moderation text )  -- pending|approved|rejected
```

---

## Endpoints da API

| Rota | Método | Faz |
|---|---|---|
| `/api/wallet/nonce` | POST | gera nonce+mensagem para um endereço |
| `/api/wallet/verify` | POST | verifica assinatura (BIP-322/ECDSA), cria sessão |
| `/api/wallet/session` | GET | endereços verificados da sessão atual |
| `/api/wallet/claimable` | GET | lotes reivindicáveis pelos endereços do usuário |
| `/api/wallet/register/psbt` | POST | monta PSBT de pagamento (10k/50k DOG → treasury) |
| `/api/wallet/register/callback` | POST | recebe txid, marca pending |
| `/api/wallet/register/confirm` | worker/cron | confere on-chain, marca registered |
| `/api/wallet/register/customize` | POST | grava nome/X handle/avatar/links (pós-pago) |
| `/api/ads/slots` · `/api/ads/rent` · `/api/ads/moderate` | * | mercado de anúncios (Bloco C) |

---

## Dependências novas

- **`sats-connect`** — conexão multi-wallet (primária).
- **`bip322-js`** — verificar assinaturas taproot (BIP-322) server-side.
- **`bitcoinjs-message`** + **`bitcoinjs-lib`** — verificar ECDSA e montar PSBT de Runes.
- **`@noble/curves`** — verificar a assinatura **Schnorr BIP-340** crua da Kray.
- (opcional) **`@leather.io/rpc`** — tipos do LeatherProvider.
- **Kray L2:** **sem npm novo** — só `fetch` aos endpoints públicos `kray.space` (`/l2/account`,
  `/l2/transaction/send`, `/api/l2/nfts/*`). Unidades **RAW** (DOG divisibilidade 5).
- **Reuso:** `twitter-api-v2` (verificar X handle), Supabase, Upstash/KV (nonce), `zod`.
- **Indexer de Runes** para confirmar pagamento **L1** (ord/API já em uso — `ord/`, `mcp-server`, `api`);
  **confirmação L2** = leitura da própria L2 da KRAY (endpoint a confirmar com o Tom).

---

## Ordem de execução

```
BLOCO A (connect + prova de propriedade)         ← fundação; sem isso nada acontece
  → BLOCO B (registro comum 10k DOG + custom)     ← primeiro produto pago
  → BLOCO C (comercial + aluguel de anúncio)      ← monetização de 2 lados
  → BLOCO D (fase 2: Stacks; Solana "em breve")   ← expansão multichain
```

Racional: A prova posse (barato, sem dinheiro). B fecha o **primeiro loop de receita** e já
entrega valor (prédio personalizado com o @ do X). C é o mercado maior mas depende de B. D
espera porque exige wallets de outras redes.

---

## Métricas de aceite

- [ ] Modal mostra **só as wallets instaladas** (Xverse/Leather/OKX + Kray quando pronta) e liga em cada uma.
- [ ] Usuário assina o nonce e o servidor **verifica** (taproot **BIP-322** e payment **ECDSA**).
- [ ] Nonce é **uso único** e expira; assinatura sem nonce do servidor é **rejeitada**.
- [ ] Lotes reivindicáveis do usuário aparecem a partir de `dogcity_lots`.
- [ ] Pagamento de **10k DOG** só libera registro **após confirmação on-chain** (não no callback).
- [ ] Registro Comum grava nome/**X handle verificado**/avatar/links; prédio mostra o letreiro na cidade.
- [ ] Comercial libera slots; anunciante paga em DOG, criativo passa por **moderação** e renderiza por janela.
- [ ] App **nunca** recebe seed/chave privada; toda verificação de valor é on-chain.

---

## Arquivos-alvo

- **Novo** `lib/wallet/connectors/{types,satsconnect,okx,leather,kray}.ts` — adapters.
- **Novo** `contexts/WalletContext.tsx` — estado global de conexão.
- **Novo** `components/wallet/WalletConnectModal.tsx` — UI de escolha/detecção.
- **Novo** `lib/wallet/verify.ts` — BIP-322 + ECDSA server-side.
- **Novo** `lib/wallet/runes-payment.ts` — montar PSBT de edict de DOG → treasury + confirmar on-chain.
- **Novo** `app/api/wallet/*` e `app/api/ads/*` — endpoints acima.
- **Novo** migração Supabase — `wallet_challenges`, `lot_registrations`, `ad_slots`, `ad_rentals`.
- **Mudar** `lib/city/registry.ts` (do `crosschaincity.md`) — expor "reivindicável" + tier de registro.
- **Mudar** `app/city/explore/city-3d.tsx` — letreiro do prédio registrado + textura de anúncio.

---

## Riscos e notas

- **BIP-322 é experimental** — não auditado. Usar `bip322-js`, cobrir com testes de vetores
  conhecidos por tipo de endereço (p2tr, p2wpkh, p2sh). Tratar Ledger (p2wpkh usa BIP-322).
- **PSBT nunca aberta no navegador** (ver **§Segurança da PSBT**) — construir só no backend,
  revalidar a assinada output-por-output, backend transmite. Lição direta do dev da Kray (Tom
  perdeu fundos com PSBT editável no client). Vale p/ registro, comercial e anúncio.
- **Confiar no on-chain, nunca na wallet** — o callback de pagamento é só um "aviso"; a
  verdade é a TX confirmada pagando ≥ valor à treasury. Evita spoof de "paguei".
- **Runes edict cross-wallet** — a montagem do PSBT de transferência de DOG precisa ser
  testada nas 3 wallets (Xverse/Leather/OKX); melhor **servidor monta, wallet só assina**.
- **X handle** — verificar de verdade (OAuth ou nonce em tweet/bio), senão vira campo forjável.
- **Moderação de anúncios** — obrigatória (risco legal/scam). Fila humana + expiração.
- **Endereço ≠ dono para sempre** — se o usuário move os DOG para outra carteira, ele deixa
  de controlar o lote. Definir se o registro **caduca** quando o saldo zera (o lote vira
  ruína no `crosschaincity.md`) — proposta: registro **congela** e mostra "à venda/expirado".
- **Herdadas (sagradas):** QA visual em GPU real via Playwright MCP; cuidado com `next dev`
  zumbi; gates `tsc` + validação por curl/node.

---

## ABERTO — precisa de definição do dono

1. **Kray na Fase 1 (L1) — RESOLVIDO, com 1 upgrade opcional de UX.** Conexão + prova + pagamento
   por **envio manual + match on-chain** já fecham a Fase 1 sem depender de ninguém.
   **Pedido ao Tom (nice-to-have, não bloqueia):** expor um método L1 público de alto nível
   **`sendRunes`/`transfer`** (wallet monta + **popup** + usuário aprova + wallet transmite), pra
   Kray ficar **idêntica às outras** na UX. Frisar que é o `sendTransfer` da Leather/OKX e que é
   **mais seguro que PSBT crua** (nada editável no navegador — endereça a preocupação dele). Se
   liberar, troca-se só a UI do Caminho B; se não, o fallback segue valendo.
2. **Kray na Fase 2 (L2, depois) — já speccado, 1 pendência:** pagamento vira transfer L2
   (`/l2/transaction/send`); falta só o **endpoint de leitura** pra o backend confirmar o
   `tx_hash` na `treasuryL2` + decidir **bridge L1→L2** vs exigir saldo L2. Opcional: **deed como
   NFT na L2** (`/api/l2/nfts/*`).
3. **Preços:** Comercial = 50k DOG? Aluguel de anúncio = mensal? Qual **split** dono/projeto?
4. **Registro Comum:** taxa única ou assinatura? Caduca ao zerar o saldo?
5. **Endereço pagador:** no envio-manual+match, o pagamento **precisa sair do endereço provado**
   (é o que amarra o claim). Confirmar que essa restrição é aceitável (proposta: sim).
6. **Treasury:** endereço(s) L1 de recebimento de DOG (comum vs comercial vs anúncios).

---

## Fontes (documentação levantada)

- Sats Connect (unificado): https://docs.xverse.app/sats-connect
- Verificar assinaturas (BIP-322/ECDSA): https://docs.xverse.app/sats-connect/guides/verify-bitcoin-message-signatures
- Leather Developers: https://leather.gitbook.io/developers
- OKX Bitcoin Provider: https://web3.okx.com/build/dev-docs/sdks/chains/bitcoin/provider
- **Kray Wallet Developers:** https://www.kray.space/developers
- Magic Eden (referência de provider Runes): https://docs-wallet.magiceden.io/bitcoin/provider-api-methods
