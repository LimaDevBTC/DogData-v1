# MintCity — a cidade construída por mint (`mintcity.md`)

> **Meta:** virar a DogCity de uma **dataviz de todos os holders** para uma **cidade viva
> construída pelos usuários**. Cada dono **conecta a carteira**, vai pra **praça central**,
> recebe um **modal com seus dados** (quantos DOG tem + direito de mintar), **paga o mint** e o
> **seu prédio começa a ser construído**. A prova de posse deixa de ser "assinar uma mensagem"
> e passa a ser **mintar o NFT (a escritura) do imóvel**. Sucessor natural do `connectwallet.md`
> (que entrega a conexão + auth) e do `crosschaincity.md`/`reorganizecity.md` (que entregam o
> registro de lotes + a praça).
>
> **Origem (2026-07-07):** conversa de design com o dono. Ideia-mãe: "prova de posse = mint;
> quando a cidade estiver pronta, removo os prédios pré-gerados e cada mint constrói o seu".
>
> ⚠️ **Plano — nada implementado ainda.** Canônico deste ciclo.

---

## Relação com o que já existe (a fundação já está no chão)

| Peça | Onde | Papel no MintCity |
|---|---|---|
| **Registro de lotes** | `crosschaincity.md` → `dogcity_lots` (PK=address) | O **"onde"**: cada holder já tem um **lote permanente reservado**. O mint não procura lugar. |
| **Praça central** | `reorganizecity.md` (Satoshi plaza + âncoras BitFlow/DogShopping/BuildSpace/Kray/torre-DOG) | O **destino do onboarding**: pra onde o user é levado ao conectar. |
| **Conexão + auth** | `connectwallet.md` Bloco A (connect + BIP-322) — **implementado** | Camada de **login** (provar controle do endereço) **antes** do mint. |
| **Pagamento em DOG** | `connectwallet.md` Bloco B (§Segurança do pagamento) | O mint **é** o pagamento de registro. Mesmo trilho, mesma doutrina de segurança. |
| **Motor de deltas** | `crosschaincity.md` Bloco C (`construct`/`implode`/`resize`/`rebuild`) | Mint → `construct` (prédio sobe). Saldo cai → `implode` (ruína). Volta → `rebuild`. |
| **Tipologia de prédios** | `cityupdate3.md` (casas/sobrados/torres + add-ons combinatórios) | A base técnica pros **tipos + customização** de prédio. |
| **NFT na L2** | Kray `/api/l2/nfts/collection/create` + `/mint` | **Uma** opção de deed (ver Bloco D — camada abstrata). |

**Princípio:** o MintCity **não inventa tecnologia nova** — orquestra o que já existe. O trabalho
é de **produto + integração**.

---

## Decisões do dono (travadas 2026-07-07)

| Tema | Decisão |
|---|---|
| **Prova de posse** | = **mintar o NFT do imóvel** (a escritura). O connect+assinatura (BIP-322) vira só o *login*. |
| **Fluxo** | conecta → **praça central** → modal (saldo DOG + direito de mintar + preço) → **paga o mint** → prédio **começa a construir**. |
| **Pivô da cidade** | Quando a cidade estiver pronta, **remove os prédios pré-gerados**; cada prédio só existe **quando o dono minta**. Cidade começa **vazia** (praça + âncoras) e **cresce por mint**. |
| **Lote de quem não minta** | **Reservado e vazio/fantasma** (não some — o registry já garante o lugar permanente). Gera FOMO. |
| **Mínimo pra mintar** | **holdar ≥ 20.000 DOG**. |
| **Custo do mint** | **10.000 DOG** (tx pro treasury) → sobra 10k. |
| **Manutenção (bond)** | **manter ≥ 10.000 DOG** pra o prédio ficar de pé. |
| **Cair abaixo de 10k** | prédio **implode em ruína** (lote preservado). **Deed NFT persiste** (não se queima). |
| **Voltar a ≥ 10k** | **reconstrói de graça** (o deed já existe; o mint só se paga uma vez). |
| **Cadência do check** | o **snapshot horário** do registry (mesma cadência do implode/resize). |
| **Natureza do NFT** | **atrelado ao endereço (soulbound-ish) por ora** — o bond de holding amarra o imóvel ao endereço. **Mercado imobiliário / revenda = camada futura opcional**. |
| **Tamanho do prédio** | **= holdings de DOG** (baleia = torre). Mantém a leitura da cidade. |
| **Tipo + cosméticos** | por **customização / loja de elementos** (2º fluxo de receita) — não muda o tamanho. |
| **Chain do deed** | **abstraída / trocável** (Kray L2 é opção viável; Ordinal L1 e outros também). **O pagamento (L1, verificável) é o que constrói** — o NFT é camada separada e adiável. |

### Constantes (unidades **RAW** — DOG divisibilidade 5)

```
MINT_MIN_HOLD   = 20_000 DOG = 2_000_000_000 raw   (piso p/ mintar)
MINT_FEE        = 10_000 DOG = 1_000_000_000 raw   (pago no mint → treasury)
MAINTENANCE_MIN = 10_000 DOG = 1_000_000_000 raw   (piso p/ manter o prédio)
```

---

## O grande pivô — por que isso inverte o modelo

Hoje a cidade é **completa e passiva**: gerada de todos os ~86k holders, todo mundo já tem um
prédio. O MintCity a torna **esparsa e ativa**: só constrói quem **minta (paga)**. O prédio vira
**consequência de uma ação econômica**, não de um dado.

Isso **não joga fora** o registry — pelo contrário: o `dogcity_lots` continua sendo a **fonte da
verdade do "onde"** (lote permanente por endereço). O que muda é que o **estado visual** do lote
passa a ser dirigido pelo **mint** (`unminted` → `minted/active` → `ruin`), não pelo saldo cru.

**Transição em 2 fases (não big-bang):**
- **Fase 1 (coexistência):** mint entra **por cima** da cidade atual. Prédios mintados ganham
  destaque (letreiro, luz, deed); os pré-gerados viram "fantasmas/placeholders".
- **Fase 2 (flip):** quando a cidade estiver redonda, **remove os pré-gerados** → só o que foi
  mintado fica de pé. (Opcional: manter um toggle "Data City" ↔ "Minted City".)

---

## BLOCO A — Onboarding: connect → praça → modal

**Objetivo:** do clique em "Connect Wallet" ao modal de mint, sem atrito.

1. **Connect + auth** (já pronto no `connectwallet.md`): conecta uma das 4 wallets, prova posse
   por assinatura (BIP-322 / Schnorr) → sessão httpOnly.
2. **Teleporte pra praça:** ao verificar, a câmera vai pra **Satoshi plaza**. (No `/city`.)
3. **Modal do imóvel** (`GET /api/mint/eligibility?address=…`) mostra:
   - saldo de **DOG** do endereço; **lote** dele (`street/number` + coords do registry);
   - **elegibilidade**: `saldo ≥ 20k` → pode mintar; senão, quanto falta;
   - **preço** (10k) e **regra de manutenção** (manter 10k);
   - estado atual (`unminted` / `minted` / `ruin`);
   - CTA **"Mintar meu imóvel"**.
4. **Sem 20k?** modal explica a regra (holdar 20k, pagar 10k, manter 10k) + link pra comprar DOG.

---

## BLOCO B — Mint = pagar + construir (o coração)

**Objetivo:** pagar 10k DOG e ver o prédio **subir**.

1. **Pré-checagem server-side:** `saldo ≥ 20k` **no momento do mint** (não confiar no cliente).
2. **Pagamento (mesmo trilho do `connectwallet.md` Bloco B — §Segurança do pagamento):**
   - **backend monta** a tx de **10k DOG → treasury** (L1 Runes: PSBT `SIGHASH_ALL`; ou match
     on-chain / L2, conforme a wallet), o cliente **só assina**, o **backend revalida + confirma
     on-chain**. **Nunca** liberar no callback.
3. **Confirmação on-chain = gatilho da construção:** ao confirmar o pagamento, o backend marca
   `minted/active` no registry e **emite um evento `construct`** → o cliente **anima o prédio
   subindo** (escala Y 0→cheio, já existe no motor de deltas).
4. **Tamanho do prédio = holdings** (mantém a regra do `cityupdate3`): altura/footprint pelo saldo.
5. **Deed NFT (Bloco D):** disparado **após** o pagamento confirmado — camada separada, pode ser
   assíncrona (o prédio não espera o NFT pra começar a subir).

---

## BLOCO C — Manutenção: o bond dos 10k

**Objetivo:** o prédio fica de pé enquanto o dono segura 10k; senão, ruína.

1. **Check no snapshot horário** (reusa o diff do `crosschaincity` Bloco C):
   - `minted` e `saldo < 10k` → **`implode`** → estado `ruin` (lote preservado).
   - `ruin` e `saldo ≥ 10k` de novo → **`rebuild`** (mesmo lote, **grátis** — deed já existe).
   - `minted` e saldo muda (sem cair de 10k) → **`resize`** (altura/footprint acompanham).
2. **Deed NFT nunca é queimado** — some o *prédio*, não a *escritura*. Reaparece ao voltar o saldo.
3. **Guardas herdados:** SOL/STX (top-N) não imploda por ausência (partial-snapshot guard do
   `crosschaincity`). MintCity Fase 1 é **BTC/L1** (holdings de DOG que contam são os de L1).

---

## BLOCO D — O deed NFT (camada abstrata e trocável)

**Objetivo:** emitir a escritura **sem apostar a casa numa chain específica agora**.

1. **Interface `mintDeed(address, lot, meta)`** com backend **plugável**:
   - **Kray L2** (`/api/l2/nfts/collection/create` + `/mint`) — barato, programável, dono topou como opção;
   - **Ordinal L1** — máxima legitimidade/liquidez, mais caro/UX;
   - **Registro nosso (DB) → inscrição depois** — deed "provisório" que vira on-chain quando escolhermos.
2. **O pagamento é que constrói, não o NFT** → dá pra **lançar "paga → constrói" primeiro** e
   **plugar o deed depois**. A escolha da chain **não bloqueia** o resto.
3. **Metadados do deed:** endereço, lote (`street/number` + coords), tipo de prédio, customizações,
   timestamp do mint. (Snapshot de holdings é **referência**, não trava — holdings mudam.)
4. **Coleção única** ("DogCity Deeds") criada 1× (`create_collection`).

---

## BLOCO E — Tipos de prédio + customização + loja (2º fluxo de receita)

**Objetivo:** o prédio como **produto** — vários tipos, customizável, com loja.

1. **Base técnica pronta:** o sistema combinatório de tipologia do `cityupdate3` (casas/sobrados/
   torres + add-ons: telhado, chaminé, piscina, anexo, coroa, penthouse) **já é** a fundação.
2. **Tipo base = tier de holdings** (tamanho). Dentro do tier, o dono **escolhe a tipologia**.
3. **Loja de elementos:** itens **pré-determinados por nós**, comprados em DOG (varanda, letreiro
   custom, skin, jardim, cores, etc.). Podem ser **unlocks de conta** ou **micro-itens** próprios.
4. **Personalização gravada** no registry (`customizations jsonb`) e refletida no deed + no render.
5. **Fila de moderação** pros elementos que aceitam conteúdo do user (letreiro/imagem) — herda a
   doutrina de moderação do `connectwallet.md` Bloco C.

---

## Modelo de dados (estende o registry)

```sql
-- estende dogcity_lots (ou tabela irmã dogcity_mints, PK = address):
mint_status     text      -- 'unminted' | 'active' | 'ruin'
mint_txid       text      -- pagamento dos 10k (fonte da verdade)
mint_paid_at    timestamptz
deed_chain      text      -- 'kray-l2' | 'ordinal-l1' | 'pending' (Bloco D)
deed_id         text      -- id/inscrição do NFT (nullable até mintar)
building_type   text      -- tipologia escolhida (Bloco E)
customizations  jsonb     -- elementos/skins comprados
last_maint_ok   timestamptz  -- último check de manutenção que passou

-- loja / itens (Bloco E)
mint_store_items ( id text PK, name text, price_dog bigint, kind text, meta jsonb )
mint_purchases   ( id uuid PK, address text, item_id text, pay_txid text, status text, created_at timestamptz )
```

---

## Endpoints da API

| Rota | Faz |
|---|---|
| `GET /api/mint/eligibility?address=` | saldo DOG, lote, `canMint` (≥20k), estado, preço, regra de manutenção |
| `POST /api/mint/psbt` | monta a tx de 10k DOG → treasury (backend-only, §Segurança) |
| `POST /api/mint/callback` | recebe txid → confirma on-chain → `active` + emite `construct` |
| `POST /api/mint/deed` | (Bloco D) minta o deed na chain escolhida — assíncrono, plugável |
| `GET /api/city/property/:address` | dados do imóvel p/ o modal e o painel na cidade |
| `POST /api/mint/store/buy` | compra de elemento da loja (mesmo trilho de pagamento) |
| *(cron/worker)* | check de manutenção no snapshot horário → `implode`/`rebuild`/`resize` |

---

## Ordem de execução

```
BLOCO A (onboarding: connect→praça→modal de elegibilidade)     ← usa o que já existe
  → BLOCO B (mint = paga 10k + construct on-chain)             ← o primeiro loop de receita
  → BLOCO C (manutenção: bond de 10k → implode/rebuild)        ← a cidade "respira" por holding
  → BLOCO D (deed NFT plugável — Kray/Ordinal/DB)              ← escritura, sem travar na chain
  → BLOCO E (tipos + customização + loja)                      ← prédio como produto (2º receita)
  → FASE 2 (flip: remover pré-gerados → cidade só-mintada)     ← quando estiver redonda
```

Racional: A/B fecham **paga→constrói** (o essencial) sem depender da chain do NFT. C torna o bond
real. D e E são camadas de valor/monetização por cima. A Fase 2 (flip) é o último passo.

---

## Métricas de aceite

- [ ] Conectar leva à **praça** + modal com **saldo, lote, elegibilidade (≥20k), preço**.
- [ ] Mint só habilita com **saldo ≥ 20k** (checado no servidor).
- [ ] Pagar 10k DOG **confirmado on-chain** → prédio **sobe** (`construct`); nada some no callback.
- [ ] Saldo **< 10k** no snapshot → prédio **implode em ruína**; **≥ 10k** de novo → **rebuild grátis**.
- [ ] **Deed NFT** emitido pós-pagamento (camada assíncrona); prédio não espera o NFT.
- [ ] Deed **persiste** mesmo com o prédio em ruína.
- [ ] Tamanho do prédio = holdings; **tipo/cosméticos** escolhíveis; loja cobra em DOG.
- [ ] Nenhuma seed/chave privada tocada; toda cobrança verificada on-chain.

---

## Arquivos-alvo

- **Novo** `lib/mint/eligibility.ts` — regra dos 20k/10k, leitura de saldo + lote do registry.
- **Novo** `lib/mint/deed.ts` — interface `mintDeed()` + adapters (`kray-l2`, `ordinal-l1`, `db-pending`).
- **Novo** `app/api/mint/*` — eligibility, psbt, callback, deed, store.
- **Novo** `components/city/mint-modal.tsx` — o modal da praça.
- **Mudar** `lib/city/registry.ts` — campos de mint + estado dirigido por mint (não por saldo cru).
- **Mudar** `app/api/city/deltas/route.ts` — check de manutenção (implode/rebuild por bond de 10k).
- **Mudar** `app/city/explore/city-3d.tsx` — teleporte à praça, `construct` no mint, ruína no bond.
- **Reuso:** `lib/wallet/*` (connect/prova), `connectwallet.md` Bloco B (pagamento), tipologia do `cityupdate3`.

---

## Riscos e notas

- **Transição Fase 1→2:** remover os pré-gerados é irreversível de percepção — fazer **atrás de um
  flag/toggle** e só flipar quando a densidade de mints justificar (senão cidade fica deserta).
- **Bond vs UX:** cair de 10k e ver o prédio virar ruína pode frustrar — comunicar **claramente** a
  regra no modal e avisar antes (ex.: alerta quando o saldo se aproxima de 10k).
- **Soulbound ↔ mercado:** hoje é atrelado ao endereço. Se um dia quiser **revenda**, resolver
  "quem segura os 10k depois da venda" — **não** desenhar pra isso agora (evitar over-engineering).
- **Chain do deed = §Aberto:** manter `mintDeed()` abstrato; a decisão Kray-L2 vs Ordinal-L1 é
  reversível e **não bloqueia** A/B/C.
- **Pagamento:** herda **toda** a §Segurança do pagamento do `connectwallet.md` (backend monta,
  `SIGHASH_ALL`, revalida, confirma on-chain; nunca confiar no cliente; RAW units).
- **Herdadas (sagradas):** QA visual em GPU real via Playwright MCP; cuidado com `next dev` zumbi;
  gates `tsc` + validação por curl/node.

---

## ABERTO — decisões futuras (não bloqueiam o começo)

1. **Chain final do deed** (Kray L2 vs Ordinal L1 vs híbrido) — decidir com calma; o dono já topou
   Kray como opção, mas quer avaliar liquidez/adoção antes de cravar.
2. **Mercado imobiliário / revenda** (transferível + royalties) — camada futura, se e quando.
3. **Loja de elementos:** catálogo inicial, preços, e se os itens são unlocks ou micro-NFTs.
4. **Personalização:** profundidade (só cosmético? posicionar elementos? conteúdo do user?).
5. **Preço/limiares:** 20k/10k/10k travados; revisitar se o preço do DOG mudar muito.
