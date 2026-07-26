# profiles.md — Identidade DOG DATA: perfil de carteira, verificação X e perks de doador

> Origem: conversa com o dono em 2026-07-25. Evolução direta do `connectwallet.md`
> (Incremento 3) — o connect + prova BIP-322 já estão prontos; este doc especifica
> tudo que vem depois do `verified === true`, com a restrição de que **precisa estar
> no ar antes do mint/lançamento da cidade**.

---

## §0 — Objetivo e decisões do dono (2026-07-25)

1. **Verificação de carteira disponível ANTES do mint.** O fluxo de prova de posse
   é pré-requisito do mint (`mintcity.md` Bloco A) e precisa rodar em produção antes.
2. **Perfil automático no connect.** O user conecta a carteira no DogData e a gente
   **já lê e abre um perfil pra ele** — pré-populado com tudo que o DogData já sabe
   daquele endereço (rank, saldo, cohort, idade UTXO, lote na cidade, total doado).
3. **Handle do X + pfp.** No perfil, o user adiciona o handle do X. A pfp vem junto.
4. **Identidade em TODO lugar.** Onde quer que o endereço apareça no site — rich
   list, transações, holders-by-age, painel da cidade e **inclusive nas doações** —
   aparece a identificação do user com a pfp dele.
5. **Perks para quem doou 10k+ DOG dentro do próprio DogData** (não só na cidade).
6. **Reconciliação com `connectwallet.md` Bloco B:** a identidade básica
   (handle + pfp + nome) passa a ser **GRÁTIS** para qualquer carteira verificada.
   Os 10.000 DOG do Registro Comum deixam de "comprar o handle" e passam a comprar:
   customização do prédio na cidade (masterplan §4.1, inalterado) **+ os perks
   DogData deste doc (Bloco D)**. Isso fortalece o funil: identidade grátis → user
   engajado → doa 10k pra desbloquear o resto.

---

## §1 — O que já existe (não reimplementar)

| Peça | Onde | Estado |
|---|---|---|
| Connect multi-wallet (Xverse/Leather/OKX/Kray) | `lib/wallet/*`, `contexts/WalletContext.tsx`, `components/wallet/*` | PRONTO (local, gitignored) |
| Prova de posse BIP-322/ECDSA/Schnorr + nonce + sessão | `app/api/wallet/{nonce,verify,session}`, Upstash `wsess:{sid}`, cookie `dg_wallet` | PRONTO (local, gitignored) |
| Embrião de identidade | `contexts/VerifiedAddressesContext.tsx` + `components/address-badge.tsx` + `public/data/verified_addresses.json` | O caminho `community`/`twitter` do badge está implementado e NUNCA usado; JSON estático só com 8 `official` |
| OAuth2 do X | `X_CLIENT_ID`/`X_CLIENT_SECRET` no `.env.local`, `twitter-api-v2` instalado | Credenciais existem, nunca usadas (só o whale-poster usa a lib) |
| Doações on-chain | `app/api/donate/leaderboard/route.ts` (scan de `dog_transactions`, tiers 10k/50k/500k hardcoded) | PRONTO — é a fonte do tier de doador |
| Lotes da cidade | `dogcity_lots` (migração 006/007), `lib/city/registry.ts` | PRONTO — `address` é PK, join natural do perfil |
| API keys com tiers | `migrations/001_api_keys.sql` (free/pro/enterprise) | PRONTO — reusar no perk de API |

Superfícies que hoje mostram endereço cru (alvo do Bloco C):
- `/donate` — as 4 listas (live feed, founders, top builders, progresso pessoal)
- `/address/bitcoin/[address]` — a página de perfil de carteira (não usa AddressBadge)
- `/metrics/holders-by-age`
- Painel da cidade (`city-3d.tsx` → `WalletPanel`)
- `/explorer`
- (já usam AddressBadge: holders, transactions, airdrop, whales-movement)

---

## §2 — Arquitetura da identidade

**Uma fonte só.** Hoje a identidade vem de um JSON estático em `public/`. Passa a ser:

```
identidade(address) = officials (JSON curado, exchanges/tesourarias — continua)
                    ∪ wallet_profiles (Supabase — community, escrito pelo próprio user)
```

- Novo endpoint **`POST /api/identity`** (batch): recebe `{ addresses: [...] }`,
  devolve `{ [address]: { name, handle, avatar_url, tier, badges } }`. Cache
  `s-maxage=300`. É a única porta de leitura de identidade do site.
- `VerifiedAddressesContext` evolui: mantém o JSON de officials no boot e busca
  identidades community **sob demanda em batch** (agrupa os endereços visíveis,
  1 request, LRU em memória). `AddressBadge` ganha a variante com **avatar**.
- Rotas server-side de alto tráfego (ex.: leaderboard do /donate) fazem o **join
  direto com `wallet_profiles` no servidor** e devolvem a identidade embutida —
  zero waterfall no client na página mais importante.

**Sessão continua no Upstash** (cookie `dg_wallet`) — é auth. **Perfil vive no
Supabase** — é dado. A ponte é o endereço verificado da sessão.

---

## §3 — Blocos de execução

### BLOCO 0 — Destravar o deploy do stack wallet (pré-requisito de TUDO)

O connect/prova hoje é local-only (gitignore + `skip-worktree`). Para "estar
disponível antes do mint" tem que ir pra produção:

- [ ] Tirar do `.gitignore`: `lib/wallet/`, `contexts/WalletContext.tsx`,
      `components/wallet/`, `app/api/wallet/` (a cidade continua ignorada).
- [ ] Garantir que **nada do stack wallet importa os dirs ignorados da cidade**
      e que `next build` passa limpo (regra do deploy Vercel: build vem do clone
      GitHub, não do disco local).
- [ ] Conferir env no Vercel: `UPSTASH_*`, `SUPABASE_SERVICE_ROLE_KEY`,
      `X_CLIENT_ID`, `X_CLIENT_SECRET`.
- [ ] Validar o esquema de hash do Kray contra uma assinatura real
      (pendência conhecida, `connectwallet.md:538`).
- [ ] Atenção ao bot de auto-commit: fazer o un-ignore num commit deliberado,
      não deixar o bot varrer pela metade.

### BLOCO A — Perfil básico (grátis, qualquer carteira verificada)

- [ ] Migração `008_wallet_profiles.sql` (§4).
- [ ] `GET /api/profile` — perfil da sessão atual (ou 404 → client cria on-the-fly).
- [ ] `PUT /api/profile` — grava `display_name`, `bio`, `links` (zod, rate limit,
      sanitização). **Só a sessão dona do endereço escreve.**
- [ ] **Auto-open pós-verificação:** ao completar a prova, o `WalletContext`
      redireciona/abre o "Meu Perfil" — que é a página `/address/bitcoin/[address]`
      do próprio endereço **+ um card editável de identidade** no topo (nome, X,
      pfp, bio). Pré-populada com o que o site já sabe: é o "a gente já lê e abre
      um perfil pra ele" do dono.
- [ ] Estado vazio vendedor: "Adicione seu X pra aparecer com seu nome e foto em
      todo o DOG DATA — inclusive no mural de doadores."

### BLOCO B — Verificação do handle X + pfp

**Método: OAuth2 PKCE do X** (decisão — o `connectwallet.md:496` já alertava que
sem verificação real o campo vira forjável, e as credenciais já existem):

- [ ] `GET /api/profile/x/connect` — monta a URL de autorização (scopes
      `users.read tweet.read`, PKCE, `state` amarrado à sessão `dg_wallet`).
- [ ] `GET /api/profile/x/callback` — troca o code, chama `users/me`
      (`twitter-api-v2`), grava `x_handle`, `x_id`, `x_verified_at` e
      `profile_image_url` **na carteira da sessão**. Não guardamos tokens do X
      além do necessário (revogamos/descartamos após ler o perfil).
- [ ] **Pfp com cache próprio:** baixar a imagem (variante original, tirando o
      sufixo `_normal`) e salvar no Supabase Storage `avatars/{address}.jpg`;
      `avatar_url` aponta pro nosso storage. URL do X apodrece; a nossa não.
- [ ] Refresh: re-baixar a pfp a cada novo login verificado (barato e suficiente).
- [ ] Fallback sem OAuth (se o app do X der problema no lançamento): tweet ou bio
      contendo o nonce da sessão → cron/route confere via `X_BEARER_TOKEN`.
      Implementar só se necessário.
- [ ] Multi-carteira: o MESMO handle pode aparecer em N endereços (uma pessoa,
      várias wallets) — permitido de propósito; cada endereço prova posse da
      própria chave + OAuth do próprio X.
- [ ] Moderação mínima: `display_name` opcional (default `@handle`), blocklist
      de termos, e flag `hidden` administrativa pra derrubar abuso sem apagar.

### BLOCO C — Identidade em todo lugar (o "efeito uau")

- [ ] `POST /api/identity` (batch) + evolução do `VerifiedAddressesContext`.
- [ ] `AddressBadge` v2: avatar redondo + nome/@handle + anel de tier (ver Bloco D);
      remover o `console.log` de debug; matar `address-badge-optimized.tsx` (morto).
- [ ] Rollout nas superfícies sem badge, nesta ordem de impacto:
      1. **`/donate`** — join server-side no leaderboard; doador verificado aparece
         com pfp + @handle nas 4 listas. É a vitrine: doou → aparece com rosto.
      2. **`/address/bitcoin/[address]`** — header vira o cartão de identidade
         (pfp grande, nome, X, badges de tier/founder).
      3. **Painel da cidade (`WalletPanel`)** — prédio clicado mostra dono com pfp
         ("HODL Ave 4471 — @fulano", como o `connectwallet.md:290` previa).
      4. **`/metrics/holders-by-age`** e **`/explorer`**.
- [ ] De quebra: padronizar truncamento de endereço num componente só
      (`AddressChip` do design-system já existe — promover), hoje são 8 truncadores
      locais diferentes (`5…4`, `6…4`, `8…6`, `10…8`, `16…10`).

### BLOCO D — Perks 10k+ dentro do DogData

**Tier é automático, não é compra separada:** derivado da soma de doações do
endereço verificado (mesma lógica do leaderboard — `dog_transactions` →
`DONATION_WALLET`). Escala existente: 10k (Personal) / 50k (Commercial) /
500k (Patron) + `founder_seq` (qualquer valor antes dos 10M).

Perks no lançamento (baratos porque a infra já existe):

- [ ] **Anel/badge de tier no avatar** em todo o site (bronze 10k / prata 50k /
      ouro 500k) + plaquinha Founder com `#seq`. Status visível = o perk que mais
      vende os outros.
- [ ] **Perfil estendido**: doador 10k+ ganha campos extras no perfil público —
      banner, bio longa, até 3 links (site, Magic Eden, etc.). Grátis fica só
      nome + handle + pfp.
- [ ] **API key PRO automática**: `api_keys` já tem tiers — doador 10k+ verificado
      gera key `pro` no próprio perfil (`/api/keys/generate` gated pela sessão).
- [ ] **Export CSV** nos dashboards (holders-by-age, rich list, transações da
      própria carteira) — botão visível pra todos, destravado no 10k+.
- [ ] **Early access**: novas métricas/charts da expansão (ChartInspect parity)
      estreiam 1–2 semanas antes pra 10k+ (flag `min_tier` no catálogo de charts).
- Depois do lançamento (não bloquear): alertas personalizados de whale por
  watchlist (infra do whale-alerts), digest semanal da carteira.

**Amarração com a cidade (inalterado):** os mesmos 10k/50k/500k continuam
destravando a customização do prédio (masterplan §4.1) — o perfil DogData e a
licença da cidade são o MESMO registro, lido pelos dois produtos.

---

## §4 — Modelo de dados

```sql
-- 008_wallet_profiles.sql
create table wallet_profiles (
  address        text primary key,          -- join natural com dogcity_lots.address
  chain          text not null default 'bitcoin',
  display_name   text,                      -- default: @x_handle
  x_handle       text,                      -- sem @
  x_id           text,                      -- id numérico do X (estável, handle muda)
  x_verified_at  timestamptz,               -- null = handle não verificado (não exibir)
  avatar_url     text,                      -- Supabase Storage, não URL do X
  banner_url     text,                      -- perk 10k+
  bio            text,                      -- curto p/ todos; longo = perk 10k+
  links          jsonb not null default '[]',
  donated_total  numeric not null default 0,   -- cache da soma (fonte: dog_transactions)
  donor_tier     text,                      -- null|'personal'|'commercial'|'patron'
  founder_seq    integer,                   -- null se não-founder
  hidden         boolean not null default false,  -- kill-switch de moderação
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on wallet_profiles (x_handle);
-- RLS: leitura pública (menos hidden), escrita só service-role (rotas validam sessão)
```

`donated_total`/`donor_tier`/`founder_seq` são **cache recalculado** (na escrita do
perfil + cron horário), fonte da verdade continua sendo o scan on-chain. A tabela
`lot_registrations` do `connectwallet.md` fica reservada pro que é específico de
prédio (skin, pay_txid do registro, ads) — identidade mora aqui.

---

## §5 — Endpoints (novos)

| Rota | Método | Auth | Função |
|---|---|---|---|
| `/api/profile` | GET/PUT | sessão `dg_wallet` | ler/gravar o próprio perfil |
| `/api/profile/x/connect` | GET | sessão | inicia OAuth2 PKCE do X |
| `/api/profile/x/callback` | GET | sessão + state | grava handle verificado + pfp |
| `/api/identity` | POST | pública, cache 300s | batch address→identidade |
| `/api/donate/leaderboard` | GET | (existente) | + join `wallet_profiles` |

---

## §6 — Ordem de execução

1. **BLOCO 0** — un-ignore + build + env Vercel (nada anda sem isso).
2. **BLOCO A** — migração + GET/PUT profile + auto-open do perfil.
3. **BLOCO B** — OAuth X + pfp no Storage.
4. **BLOCO C.1** — /donate com identidade (a vitrine; anunciar isso).
5. **BLOCO C.2–C.4** — address page, cidade, demais superfícies.
6. **BLOCO D** — tiers + perks (badge primeiro, depois API key/CSV/early access).

Critério de aceite do lançamento: conectar → provar → OAuth X → aparecer com pfp
no /donate em produção, em menos de 2 minutos de fluxo de usuário.

---

## §7 — Riscos e pontos em aberto

1. **App OAuth do X** — VERIFICADO em 2026-07-25, resultado parcial:
   - ✅ `GET /2/users/me` funciona via OAuth 1.0a (@dogdatabtc, pfp incluída,
     rate limit 75/15min) — o app TEM acesso ao endpoint exato que o fluxo usa.
   - ✅ `X_CLIENT_ID` tem o formato real de client OAuth2 do X (sufixo `:1:ci`).
   - ❌ `X_BEARER_TOKEN` está morto (401) — regenerar no portal se quisermos o
     fallback de tweet/bio-nonce; não bloqueia o caminho OAuth2.
   - ❓ Callbacks registrados e status do client OAuth2 NÃO são verificáveis de
     fora: o X só valida client_id/redirect_uri DEPOIS do login (testado no
     browser: client_id falso e real mostram o mesmo gate de login).
   - **AÇÃO DO DONO (5 min, precisa do login X):** developer.x.com → app DogData
     → User authentication settings → conferir/ativar OAuth 2.0 (Web App,
     confidential) e cadastrar os callbacks
     `https://dogdata.xyz/api/profile/x/callback` e
     `http://localhost:3000/api/profile/x/callback`; se ativar OAuth2 gerar novo
     Client ID/Secret, atualizar `.env.local` + env do Vercel. Aproveitar e
     conferir o TIER do app no dashboard: se for Free, o teto mensal de reads
     pode limitar quantas verificações/mês fazemos (mitigação: cachear pfp no
     nosso Storage — já previsto — e/ou subir pra Basic).
2. **Kray Schnorr** ainda não validado com assinatura real (herdado do connectwallet).
3. **Doações multi-sender/'anonymous'**: seguem sem identidade até o doador
   verificar a carteira — comportamento correto, sem workaround.
4. **Impersonation via display_name** (user verificado com nome enganoso):
   blocklist + `hidden` cobrem o lançamento; revisitar se escalar.
5. **Aberto:** perfil mostra saldo/rank automaticamente — permitir opt-out
   (privacidade) ou é o preço de se verificar? Recomendação: exibir sempre
   (o dado já é público on-chain e a página de address já existe pra qualquer um).
6. **Aberto:** perks 10k+ valem por doação acumulada PERMANENTE (consistente com
   "Licença ≠ saldo vivo" do masterplan §4.1) — recomendado — ou exigem manter
   saldo? Assumido: permanente.
