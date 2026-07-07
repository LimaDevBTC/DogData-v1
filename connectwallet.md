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
| **Kray Wallet** | ❌ não usa sats-connect | `window.krayWallet` (provider próprio) | `signMessage` → **Schnorr BIP-340** (só taproot) | ✅ `getRunes()`; pagamento → §Aberto |

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
> (2) só expõe **endereço taproot** (ok — é onde os DOG ficam);
> (3) os docs **não mostram `signPsbt`/transfer de Runes** → como pagar 10k DOG com a Kray
> é **item em aberto** (§Aberto). Tem `sendPayment` de Lightning, mas o pagamento é em DOG.

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
  └─ kray.ts         (window.krayWallet — connect/verify prontos; pagamento §Aberto)
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

1. **Pré-requisito:** endereço verificado **e** dono de um lote (`dogcity_lots`).
2. **Ordem de pagamento (DOG = Runes):** o servidor **monta o PSBT** da transferência de
   `10.000 DOG` do endereço do usuário → **treasury**, e a wallet **assina+transmite**:
   - via `sats-connect` (`signPsbt` / método de runes) ou `sendTransfer` (Leather) /
     `signPsbt` (OKX). **Padrão robusto e cross-wallet: servidor monta o edict de Runes no
     PSBT, wallet só assina** (a montagem de edict de Runes varia menos que os atalhos de
     UI de cada wallet).
3. **Confirmação on-chain (fonte da verdade):** **não** liberar o registro no callback da
   wallet. `POST /api/wallet/pay-callback` grava `txid` como **pending**; um verificador
   (worker/cron) confere via mempool/indexer que a TX **paga ≥10k DOG à treasury** e
   confirma → `status='registered'`.
4. **Personalização liberada:** nome do prédio, **handle do X**, avatar, link, bio, cor/skin.
   - **X handle:** verificar posse (OAuth do X **ou** tweet/bio com o nonce). Já existe
     `twitter-api-v2` no `package.json` — reusar.
5. **Efeito na cidade:** o prédio ganha **letreiro/placa** com o nome; painel de TX passa a
   mostrar "**HODL Ave 4471 (@fulano)**" em vez do endereço cru.

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
Decisão de escopo:

- **Fase 1 (este ciclo):** claim/registro **só para lotes BTC** (onde as 4 wallets provam
  posse nativamente). Xverse/Leather já expõem endereços **Stacks** — Stacks pode entrar
  com `stx_signMessage` **numa fase 2**.
- **Solana:** exigiria wallet Solana (Phantom/Solflare) — **fora do escopo agora**; o lote
  SOL aparece na cidade mas o botão "reivindicar" fica **"em breve"**.

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
- **Reuso:** `twitter-api-v2` (verificar X handle), Supabase, Upstash/KV (nonce), `zod`.
- **Indexer de Runes** para confirmar pagamento (ord/API já em uso no projeto — `ord/`, `mcp-server`, `api`).

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

1. **Kray Wallet — pagamento de DOG:** conexão + prova de posse **resolvidas**
   (`window.krayWallet`, `requestAccounts`/`getAccounts`/`getPublicKey`/`signMessage` Schnorr —
   docs em kray.space/developers). **O que falta:** os docs **não expõem `signPsbt` nem um
   método de transferência de Runes** — sem isso, não dá pra cobrar os 10k/50k DOG pela Kray.
   Preciso confirmar com a Kray se existe (a) `signPsbt`, (b) um `sendRunes`/`transfer`, ou
   (c) se por ora a Kray fica **"conecta e prova, mas paga por outra wallet"**. Até resolver,
   o adapter `kray.ts` entrega **connect + verify**, e o passo de pagamento fica desabilitado
   só para ela.
2. **Preços:** Comercial = 50k DOG? Aluguel de anúncio = mensal? Qual **split** dono/projeto?
3. **Registro Comum:** taxa única ou assinatura? Caduca ao zerar o saldo?
4. **Endereço pagador:** obriga ser o **mesmo** endereço do lote, ou qualquer da carteira?
5. **Treasury:** endereço(s) de recebimento de DOG (comum vs comercial vs anúncios).

---

## Fontes (documentação levantada)

- Sats Connect (unificado): https://docs.xverse.app/sats-connect
- Verificar assinaturas (BIP-322/ECDSA): https://docs.xverse.app/sats-connect/guides/verify-bitcoin-message-signatures
- Leather Developers: https://leather.gitbook.io/developers
- OKX Bitcoin Provider: https://web3.okx.com/build/dev-docs/sdks/chains/bitcoin/provider
- **Kray Wallet Developers:** https://www.kray.space/developers
- Magic Eden (referência de provider Runes): https://docs-wallet.magiceden.io/bitcoin/provider-api-methods
