# SalesCity — Crowdfunding × DogCity: licenças, fundadores e a Grande Inauguração (`salescity.md`)

> **Meta:** fundir o crowdfunding (/donate, meta 10M DOG) com a construção da DogCity
> em uma única campanha. A doação vira o **City Construction Fund**: quando os 10M
> fecharem, **a cidade inteira abre de uma vez** (Grande Inauguração). Doação livre e
> licenças (10k pessoal / 50k comercial) rodam no **mesmo trilho**: um acumulador
> on-chain por carteira. As primeiras 1.000 licenças são **Founder Edition**.
>
> **Origem (2026-07-08):** estratégia definida com o dono (artifact "DogCity Founders
> — Estratégia de Crowdfunding", v2). Pesquisa de mercado: ConstitutionDAO, Nouns,
> Million Dollar Homepage, campanhas buy-a-brick, práticas de conversão em doação.
>
> **Relação com `reorganizecity.md`:** este plano NÃO altera o layout da cidade. Ele
> monetiza e narra a construção que aquele doc especifica. O monumento dos fundadores
> entra no fluxo do Bloco 1 (Praça Satoshi); as licenças substituem o modelo
> hold-to-claim do Bloco 5 por **pagamento único**. Onde divergirem, **vale este doc**
> para claims/licenças e o `reorganizecity.md` para layout/obra.

---

## Decisões do dono (travadas)

| Tema | Decisão |
|---|---|
| **Meta** | 10M DOG = **a cidade inteira abre de uma vez** (Grande Inauguração). **Sem** liberação por fatias/stretch goals de features. |
| **Licença Pessoal** | **10.000 DOG, pagos uma vez** → personaliza o modal de visualização da carteira + features pessoais + personalização do prédio na inauguração. |
| **Licença Comercial** | **50.000 DOG, pagos uma vez** → tudo da Pessoal + **espaço publicitário na fachada** do prédio + edição do prédio + outros benefícios. |
| **Doação livre** | Tem que existir: qualquer valor, sem teto. Encaixe: **acumulador por carteira** (ver Bloco 1). |
| **Modelo de pagamento** | Licenças são **PAGAS** (transferência para a tesouraria), não hold-to-claim. Substitui o "hold 10k/50k + sign message" do coming-soon. |
| **Fundador** | 1.000 DOG foi rejeitado como piso (muito barato). Fundador = **as primeiras 1.000 carteiras a atingir a Licença Pessoal** (Founder Edition). |
| **Narrativa central** | "A cidade não pode ser comprada (posição = idade on-chain). Mas pode ser construída." Integridade como argumento de venda. |

---

## A matemática que fecha sozinha

```
1.000 fundadores × 10.000 DOG  =  10.000.000 DOG  =  a meta inteira
```

Quando as 1.000 Founder Editions acabarem, a cidade abre. **Escassez e meta são o
mesmo número** — é a headline da campanha.

Economia (preço atual ≈ US$0,0006/DOG): 10M DOG ≈ **US$6.000**. Caminhos: 1.000
pessoais OU 200 comerciais OU 20 patronos. Mix realista: ~600 pessoais + ~60
comerciais + 2–3 patronos + doação livre. Exige converter ~1% da base (~90k holders)
a US$6 — agressivo mas atingível com escassez + evento de chegada.

---

## BLOCO 1 — O trilho único (acumulador por carteira)

O conflito "doação livre × tiers" desaparece com **um acumulador por carteira**:

1. **Toda doação em DOG conta duas vezes:** para a meta de 10M e para o total
   acumulado da carteira doadora.
2. **Licenças desbloqueiam sozinhas** ao cruzar o acumulado: ≥10k → Pessoal;
   ≥50k → Comercial. Sem checkout, sem SKU, sem segundo endereço — **o endereço de
   doação é o produto**.
3. O leaderboard on-chain (`app/api/donate/leaderboard/route.ts`) **já agrega doações
   por carteira** — a infra do acumulador existe; falta derivar o estado.
4. Quem está no meio do caminho vê a **barra pessoal**: "6.500 / 10.000 DOG até sua
   Licença Pessoal". Ninguém doa "no vazio".

### A escada

| Nível | Acumulado | ≈ USD | Recebe |
|---|---|---|---|
| **Cidadão** | qualquer valor | — | Nome no Registro dos Fundadores (ex-Hall of Sats), soma na meta, barra pessoal de progresso. |
| **Licença Pessoal** | 10.000 DOG | ~$6 | Pagamento único, permanente, da carteira: personaliza o modal/perfil da carteira + personalização do prédio + features pessoais (ativa na inauguração). |
| **Licença Comercial** | 50.000 DOG | ~$30 | Tudo da Pessoal + banner publicitário na fachada + edição do prédio (modelo/cor) + registro de endereço comercial. |
| **Patrono** *(sugestão — confirmar)* | ≥ 500.000 DOG | ~$300 | Tudo da Comercial + placa individual na **Calçada dos Patronos** ao redor do monumento. Degrau das baleias; Hall of Sats segue premiando volume sem teto. |

### Regras

- Acumulado **por carteira** (anti-gaming; o leaderboard já agrega por endereço).
- Licença e status de fundador **pertencem à carteira** — intransferíveis (soulbound).
- **Uma licença por carteira**; a Comercial engloba a Pessoal.
- **Só DOG conta** para licença/fundador. BTC e STX = apoio geral (não são indexados
  no leaderboard DOG e não devem ser — "a cidade é do DOG").

---

## BLOCO 2 — Founder Edition (as primeiras 1.000 licenças)

Escassez por **ordem de chegada**, não por preço. As primeiras 1.000 carteiras a
atingir a Licença Pessoal (ou acima) recebem, além da licença:

1. **Monumento dos Fundadores** na Praça Satoshi — as 1.000 carteiras gravadas.
   A praça é terreno do projeto (`reorganizecity.md` Bloco 1): reconhecimento no ponto
   mais nobre da cidade **sem vender localização**.
2. **Beacon dourado** no topo do próprio prédio, visível no skyline.
3. **Badge "Founder"** no perfil da carteira (o perfil que abre ao clicar no prédio).
4. **Ativação antecipada** na inauguração (janela exclusiva, ex.: 1 semana antes).
5. **Fase 2:** inscription no Bitcoin com as 1.000 carteiras — a "certidão de
   fundação" da cidade, imutável (usa o ord node próprio; atenção ao lock do redb).

Contador público de vagas: `1000 − fundadores` — o motor de urgência da campanha.

---

## BLOCO 3 — Página unificada em /donate (o MVP da campanha)

**Não criar terceira página.** Reconstruir `/donate` (portão do site = máximo
tráfego) com a linguagem visual do coming-soon (`city-coming-soon.tsx`: vídeo,
BlurText, liquid-glass). `/city` continua existindo e ganha seção do Construction
Fund apontando para o mesmo funil.

### Blueprint (ordem das seções)

1. **Hero** — city-hero.mp4 de fundo. "The city can't be bought. It can be built."
   Contador de vagas de fundador + barra compacta. CTA único: **Claim your Founder
   License**.
2. **Sua carteira já está lá** — "89,317 wallets. Yours is one of them." Distritos
   por história on-chain (reaproveitar seção do coming-soon). Gancho: endereço é
   mérito, não dinheiro.
3. **A barra da inauguração** — 10M DOG como contagem regressiva para a Grande
   Inauguração ("The city opens at 10M"). **Feed ao vivo** das últimas doações
   ("bc1p…x2f sent 5,000 DOG · 12 min ago").
4. **A escada** — tabela Cidadão → Pessoal 10k → Comercial 50k (→ Patrono), destaque
   Founder Edition, preview 3D do monumento. Carteira conectada/verificada → barra
   pessoal "N / 10.000 até sua licença".
5. **Doe — métodos** — os 3 cards atuais (DOG featured, BTC, STX). Microcopy nova:
   "Any amount counts — toward the city and toward your license."
6. **Registro dos Fundadores** (ex-Hall of Sats) — duas abas: **Founders** (ordem de
   chegada 1–1.000) e **Top Builders** (por volume; 🥇🥈🥉 mantidos).
7. **Don't trust. Verify. + Enter DOG DATA** — tesouraria linkada no explorer, fluxo
   de entrada no app preservado (sessionStorage gate).

Máx. 2 CTAs por dobra: primário sempre → seção de doação; secundário alterna entre
"Explore the city" (`/city/explore` — deixar a pessoa **ver o próprio prédio** antes
de pedir; considerar input "cole seu endereço → voar até seu prédio") e "Enter DOG
DATA".

### Copy pronta (EN, tom do site)

- **Hero:** *"The city can't be bought. It can be built."* — Every $DOG wallet
  already has an address — earned by history, not money. Now we're building the city
  around it. Fund the construction. Found the city.
- **CTA:** *"Claim your Founder License"* — 1,000 exist. When they're gone, the city
  opens. `{n}` remaining.
- **Trilho único:** *"Every DOG counts twice."* — Toward the city — and toward your
  own license. Donate any amount; at 10,000 DOG your Personal License unlocks
  automatically. At 50,000, Commercial.
- **Meta:** *"10M DOG opens the city. All of it, at once."*
- **Integridade:** *"Your address can't be bought. That's the point."* — Founders
  don't get a better location — they get their names on the city itself.
- **Reframe:** *"You're not donating. You're founding a city."*
- **Post de marco:** *"500 Founder Licenses remain."* — Half the monument is carved.
  The city opens at 10M DOG.

---

## BLOCO 4 — Ponte técnica (quase tudo existe)

| Peça | Status | Trabalho |
|---|---|---|
| Doadores por carteira | ✅ pronto | `app/api/donate/leaderboard/route.ts` agrega senders por endereço, com acumulado. |
| Lote por carteira | ✅ pronto | Registro persistente `dogcity_lots` (crosschaincity). |
| Estado da licença | 🆕 novo | Derivado do leaderboard: acumulado ≥10k → Pessoal; ≥50k → Comercial. Tabela de **entitlements** (Supabase) guarda personalizações da carteira. |
| Flag founder | 🆕 novo | Join doadores × lotes; `founder_seq` = ordem em que a carteira cruzou 10k acumulados (1–1.000). |
| Beacon no prédio | 🆕 novo | Renderer (`app/city/explore/city-3d.tsx`): glow/farol quando `founder_seq ≤ 1000`. Pequeno. |
| Monumento | 🕐 Bloco 1 da praça | +1 asset hand-authored na Praça Satoshi; revelado na Grande Inauguração. |
| Contador + feed ao vivo | 🆕 novo | Mesmo endpoint do leaderboard: últimas N doações + `1000 − fundadores`. |
| Página unificada | 🆕 novo | Remontagem de seções existentes das duas páginas. |
| Badge no perfil | 🕐 Bloco 5 do reorganize | Selo Founder/License no perfil da carteira (painel do clique). |

---

## BLOCO 5 — Guard-rails (regulatório e reputação)

1. **🚨 CORRIGIR ANTES DA CAMPANHA:** o coming-soon promete *"Your block earns from
   every transaction in your district — passively"* e *"Earn from Activity / Passive
   Rewards"* (`city-coming-soon.tsx`, FEATURES). Promessa de renda passiva atrelada a
   holding = linguagem de security (teste de Howey). Reescrever para **espaço/
   visibilidade**: *"Commercial addresses unlock ad space on your building's facade"*
   — espaço, não yield.
2. **Licença é produto, não investimento.** Pessoal/Comercial vendem features
   (personalização, espaço de anúncio) — pagamento único por utilidade. Nunca
   vincular a expectativa de valorização ou receita.
3. **Não vender localização — nem parecer.** Monumento em terreno do projeto; beacon
   no prédio que a carteira já tem. **Nada muda posição** (posição = idade on-chain).
4. **Meta como data, com plano B.** Promessa pública: "10M abre a cidade".
   **Interno (não publicar):** data-limite de fallback caso o funding estagne; se
   precisar, "matching week" ou bônus de 25/abr fecha a diferença.
5. **Transparência total:** tesouraria pública e linkada, cada doação verificável
   on-chain — manter como argumento central ("don't trust, verify").

---

## BLOCO 6 — Go-to-market (cadência no X)

1. **Teaser (D-7):** flythrough da cidade atual + "The city is being built. Founders
   wanted." Sem link — só a data.
2. **Launch (D-0):** thread com a tese ("your address can't be bought"), página nova,
   contador de 1.000 vagas, primeiras doações ao vivo. Acionar Xored Pike /
   aibtc.news.
3. **Semanal:** build-in-public — screenshots/clipes 3D da obra + estado da barra +
   fundadores da semana. Desacoplado do funding: a obra é do projeto, o fundo define
   a data.
4. **Marcos de escassez:** cortes de vagas (750 · 500 · 250 · 100 restantes) são
   eventos de post.
5. **Evento máximo — Grande Inauguração (10M):** cidade aberta, monumento revelado,
   licenças ativadas (fundadores 1 semana antes), flythrough cinematográfico,
   cobertura completa.
6. **Data-âncora:** 25 de abril (aniversário do halving / genesis do DOG) — bônus
   simbólico (badge "Halving Day Founder") se a campanha estiver viva.

---

## Ordem de execução

```
FASE 1 — MVP (campanha no ar)                                       ~1–2 semanas
  Página unificada em /donate (blueprint Bloco 3) + barra da inauguração
  + escada de licenças + contador de fundadores + feed ao vivo + copy nova
  + fix "passive rewards" no coming-soon (Bloco 5.1)
  → 100% frontend + endpoints existentes; NÃO depende da cidade 3D.
  → Pré-venda: "licenças de fundador abrem agora; tudo ativa na inauguração".

FASE 2 — Licenças + fundadores                                      ~1 semana
  Estado de licença derivado do leaderboard + tabela entitlements
  + founder_seq no registro de lotes + beacon no prédio + badge no perfil

FASE 3 — Monumento                                                  no fluxo do Bloco 1 (reorganize)
  Monumento dos Fundadores na Praça Satoshi, revelado na Grande Inauguração
  (+ Calçada dos Patronos, se o tier for confirmado)

FASE 4 — Certidão on-chain                                          pós-1000 fundadores
  Inscription com o registro das 1.000 carteiras (ord node próprio; lock redb)
```

---

## Métricas de aceite

- [ ] `/donate` reconstruída com o blueprint do Bloco 3; CTA primário único; visual do coming-soon (vídeo, BlurText, liquid-glass).
- [ ] Barra de 10M como contagem regressiva da inauguração; feed ao vivo das últimas doações; contador `1000 − fundadores`.
- [ ] Doação de qualquer valor acumula por carteira; ≥10k desbloqueia Pessoal e ≥50k Comercial **automaticamente** (sem checkout).
- [ ] Barra pessoal "N / 10.000 até sua licença" para carteira conectada/verificada.
- [ ] Registro dos Fundadores com abas Founders (ordem de chegada) e Top Builders (volume).
- [ ] `founder_seq` no registro de lotes; beacon no prédio de fundador; badge no perfil.
- [ ] Coming-soon sem linguagem de renda passiva ("earns passively" → ad space).
- [ ] Licença/fundador = só DOG; BTC/STX seguem como apoio geral.
- [ ] Nenhum perk altera posição na cidade; monumento/calçada só em terreno do projeto.

---

## Perguntas em aberto (confirmar antes de codar)

1. **Patrono (≥500k DOG):** entra no lançamento ou fica pra depois? Valor do corte
   (500k? 250k? 1M?).
2. **"Outros benefícios"** das licenças (o dono mencionou "e mais outros
   benefícios"): fechar a lista exata de features de cada tier antes da copy final.
3. **Barra pessoal:** exige verificação de carteira (connectwallet.md) ou basta colar
   o endereço (read-only)?
4. **Janela de ativação antecipada** dos fundadores: 1 semana? 72h?
5. **Migração do modelo antigo:** o coming-soon anuncia hold-to-claim ("no transfers,
   no lock-ups") — a troca para licença paga precisa de comunicação explícita no
   launch (ninguém "perdeu" nada: o claim nunca abriu).
