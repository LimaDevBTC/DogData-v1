# ReorganizeCity — Praça central, cidade por IDADE e imóvel vivo (`reorganizecity.md`)

> **Meta:** reorganizar a DogCity em torno de uma **praça comercial central** e trocar
> o princípio de ordenação: sai o **saldo**, entra a **idade/convicção** (idade dos
> UTXOs). O centro é do **projeto** (comércio + landmark); ao redor, as carteiras
> **mais antigas primeiro**. Segurar DOG = imóvel nobre perto do centro = direito a
> **vender publicidade**. Vender = perder o lugar. A forma do imóvel passa a contar
> uma história rica (saldo = altura, nº de UTXOs = concentração vs condomínio).
>
> **Origem (2026-07-07):** conversa de design com o dono.
>
> **Relação com `crosschaincity.md`:** aquele plano está sendo implementado **em
> paralelo** e **não é a fonte de layout** deste ciclo. ReorganizeCity **reaproveita a
> FUNDAÇÃO persistente** que o crosschaincity já traz (registro `dogcity_lots`, lote
> permanente, ruína/retorno, motor de deltas, 3 zonas de chain), mas **redefine a
> ORDENAÇÃO** (idade, não saldo) e **adiciona** praça comercial, forma por UTXO,
> perfil/anúncios e o polish de litoral. Onde os dois divergirem, **vale este doc**.

---

## Decisões do dono (travadas)

| Tema | Decisão |
|---|---|
| **Centro** | **Praça Satoshi Nakamoto** em (0,0): 100% comercial, **exclusiva do projeto**. Spawn do user + **entrada cinematográfica** (câmera mergulha na praça). |
| **Ordenação** | Centralidade = **idade do 1º UTXO ≥ 10.000 DOG** da carteira (convicção), não saldo. Mais antigo = mais perto da praça. **Já implementado.** |
| **Coorte elite** | Os **85 "Satoshi Visionary"** (airdrop + acumularam 100x+) formam o **anel 0** colado na praça. |
| **Bairros** | = **coortes de idade/comportamento** (encaixam nas 12 coortes de airdrop já mapeadas), não mais tiers de saldo. |
| **Altura** | **= saldo** (mantém o skyline significativo). |
| **UTXO count** | define **forma**: poucos UTXOs = torre concentrada; muitos = **condomínio de casas baixas de luxo** (espalhado). |
| **Venda parcial** | **mantém o lote** + baixa o **score de prestígio** (idade/ad-value); não teleporta a casa. |
| **Venda total** | zera → **ruína** (lote preservado); re-entrada joga na **periferia** (idade zerada). |
| **SOL / STX** | **bairros separados** — **sem** lógica de idade (ordenados por critério próprio). |
| **Landmarks/decoração** | **uso exclusivo do projeto** (praça, torre, letreiro, dirigível, pontes, montanhas…). Carteira só controla o **próprio** imóvel. |
| **Novo plano** | Este doc `reorganizecity.md`. `crosschaincity.md` NÃO é usado como spec de layout. |

---

## BLOCO 1 — Praça Satoshi Nakamoto (centro comercial, exclusivo do projeto)

O coração da cidade, hand-authored, **nunca** um lote de carteira.

1. **Spawn + entrada cinematográfica:** o user entra **na praça**; a câmera faz um
   mergulho/reveal cinematográfico até o centro (substitui o overview atual).
2. **Torre central estilo Seattle (Space Needle)** no meio da praça, carregando o
   **letreiro do DOG**. Hoje o letreiro está no prédio de **uma carteira qualquer**
   (que pode se mover — sem controle); passa a ser **landmark do projeto**, fixo.
3. **4 lados, 4 âncoras** (uma por lateral), **maiores**, no centro da lateral,
   ocupando **~50%** do lado; ladeadas por **prédios menores** (2 por flanco / espaço
   para mais lojas no futuro):
   - **BitFlow** (swap / DEX)
   - **DogShopping** (loja)
   - **BuildSpace** (a comunidade do projeto)
   - **Kray Wallet**
4. **Praça em si:** verde, fonte, bancos — o "hub de convivência" comercial. É onde a
   cidade "acontece" (foot-traffic → valor de anúncio dos imóveis ao redor).

---

## BLOCO 2 — Ordenação por IDADE (o novo princípio) — ✅ JÁ IMPLEMENTADO

**Centralidade = a idade do PRIMEIRO UTXO ≥ 10.000 DOG da carteira** (o UTXO
substancial mais antigo — ignora poeira). Quanto mais antigo esse UTXO, mais perto da
praça. Como todos envelhecem em paralelo, o **ranking é estável** → casa com a
**permanência de lote** do registro. A **única** forma de perder posição é **gastar
UTXO antigo**.

> **Status:** já implementado (esforço paralelo). Este bloco documenta a regra; os
> **BLOCOS 1 e 3–7 abaixo é que seguem pendentes**.

1. **Anéis do centro pra fora por idade:** anel 0 = os 85 Satoshi Visionary; anéis
   seguintes = coortes progressivamente mais novas.
2. **Bairros = coortes de idade/comportamento** (não tiers de saldo). Mapear nas 12
   coortes de airdrop já existentes (DOG Legend/Supporter…).
3. **Altura = saldo** → inversão bonita: centro com prédios **ancestrais** (diamond
   hands, altura variada), periferia com **torres novas e reluzentes** (baleia que
   comprou ontem, jovem → fica na borda).
4. **Ordenação é INICIAL** (na fundação/migração). Depois:
   - **Segurar** → mantém o lote pra sempre.
   - **Vender parcial** → cai o **score de prestígio** (afeta ad-value/brilho), lote fica.
   - **Zerar** → **ruína**; se voltar, **re-entra na periferia** (idade nova).
5. **SOL/STX:** bairros separados, **sem** idade comparável (o `age_days`/airdrop é do
   lado BTC/runes) → ordenados por critério próprio (a definir: saldo ou last_active).

---

## BLOCO 3 — Forma do imóvel: saldo × nº de UTXOs × faixas de ocupação

A forma passa a contar a história da carteira, não só o tamanho.

### 3.1 Faixas de ocupação (por saldo em DOG)
- **`< 1 DOG` (dust):** **descartada** — sem lote, sem nada.
- **`1 – 10.000 DOG`:** **sem prédio** → o lote vira **área verde / parquinho /
  convivência** (banquinho, playground, verde). É o tecido de beleza e os parques dos
  bairros (BLOCO 4).
- **`≥ 10.000 DOG`:** **construções** escalando por saldo (a tipologia do v3):
  casa → sobrado → prédio → torre.

### 3.2 nº de UTXOs = concentração vs espalhamento
Duas carteiras de **100M DOG**: uma com **1 UTXO**, outra com **450 UTXOs**.
- **Poucos UTXOs** (concentrado) → **1 torre monolítica**.
- **Muitos UTXOs** (fragmentado) → **condomínio de casas baixas de luxo** (espalhado).
- Casa direto com o **explode-on-click** do v3 (cada UTXO já vira um sub-prédio).

### 3.3 "Fazendas" periféricas × "arranha-céus" central
- Centralidade = **idade** (BLOCO 2). A forma rural↔urbana **acompanha**: periferia
  (coortes jovens, menos densas) puxa **fazendas/casas**; centro (coortes antigas)
  puxa **torres**. É a combinação de **idade (posição) + saldo (altura) + UTXOs (forma)**.

---

## BLOCO 4 — Bairros bonitos: praças e parques em todos

**Todo bairro** ganha suas próprias **praças e parques** (não só a central), pra
cidade ficar bonita no geral. As áreas abertas das carteiras `1–1.000 DOG` (BLOCO 3.1)
entram naturalmente como esse tecido de convivência espalhado pela malha.

---

## BLOCO 5 — Perfil da carteira + claims (o produto e a monetização)

1. **Clique no prédio → perfil COMPLETO da carteira** (reusar o profile do dogdata:
   saldo, rank, coorte, LTH/STH, idade de UTXO, histórico…). É o mesmo perfil, dentro
   da cidade.
2. **Incremento por claim** (amarra ao sistema 10k/50k DOG já planejado):
   - **Registro comum (10k DOG):** **personalizar o perfil**.
   - **Registro comercial (50k DOG):** o do comum + **banner de publicidade** na
     fachada + **editar o prédio** (trocar modelo de casa, cor, etc.).
3. **Inventário de anúncio:** fachadas viram espaço publicitário; **valor por
   proximidade da praça** (central = premium). É o loop: **segurar → ficar central →
   vender anúncio**.

---

## BLOCO 6 — Elementos do projeto (exclusivos) + dirigível Kray

1. **Tudo que é essencial/decorativo é do projeto**, nunca atribuível a uma carteira:
   praça, **torre Space-Needle + letreiro**, pontes, montanhas, dirigível, etc.
2. **Dirigível (blimp) da Kray Wallet** circulando a cidade (mídia aérea), somando aos
   aviões/helicóptero/banner que já existem no céu.

---

## BLOCO 7 — Orla, praia e barcos (polish do litoral)

O **mar está ótimo**; a **orla não**. Hoje é uma **linha reta escura**.
- **Praia com cara de areia** (faixa arenosa, wet→dry sand) no lugar da linha dura.
- **Costa irregular** — contorno orgânico da orla, reentrâncias, relevo/contornos.
- **Iluminação na via beira-mar** (postes/calçadão à beira d'água).
- **Barcos** na água (ancorados + alguns em movimento).

---

## Ordem de execução

```
BLOCO 1 (Praça central + torre-landmark + entrada cinematográfica)   ← o novo "centro" e a entrada
  → BLOCO 2 (ordenação por idade + coortes + prestígio/ruína)         ← o novo princípio da cidade
  → BLOCO 3 (forma por saldo × UTXOs + faixas: dust/aberto/constr.)   ← imóvel conta a história
  → BLOCO 4 (praças e parques em todo bairro)                         ← a cidade fica bonita
  → BLOCO 5 (perfil completo no clique + tiers de claim/anúncio)      ← produto + monetização
  → BLOCO 6 (elementos exclusivos do projeto + dirigível Kray)        ← governança + mídia aérea
  → BLOCO 7 (orla/praia/barcos)                                       ← polish do litoral
```

Racional: 1 define o coração/entrada; 2 é a mudança estrutural (idade) que tudo o mais
assume; 3 dá forma; 4 embeleza; 5 monetiza; 6/7 são acabamento e identidade.

---

## Métricas de aceite

- [ ] Praça central exclusiva do projeto no (0,0), 4 âncoras (BitFlow/DogShopping/BuildSpace/Kray) + torre-letreiro; user **spawna nela** com entrada cinematográfica.
- [ ] Posição/bairro por **idade**; 85 Satoshi Visionary no anel 0; **altura = saldo**.
- [ ] `<1 DOG` sem lote; `1–1.000` = área aberta (banquinho/parquinho); `≥10k` = construções.
- [ ] Mesma carteira, mesmo saldo, **1 UTXO = torre / 450 UTXOs = condomínio baixo**.
- [ ] Vender parcial mantém o lote (cai prestígio); zerar vira ruína; voltar = periferia.
- [ ] Clique → **perfil completo**; 10k personaliza; 50k + banner + edição do prédio.
- [ ] Letreiro do DOG saiu do prédio de carteira → **torre do projeto**; nenhum landmark é de wallet.
- [ ] Todo bairro tem praça/parque; dirigível Kray voando; orla com areia/relevo/luz/barcos.

---

## Arquivos-alvo (provisório — confirmar com a base já implementada do crosschaincity)

- **Registro** `lib/city/registry.ts` — ganhar `age_score`, `prestige`, e alocação **por idade-rank** (não saldo).
- **Zonas/gerador** `lib/city/zones.ts` + `lib/city/generator.ts` — praça reservada no centro; coortes de idade como distritos; faixas dust/aberto/construção; forma por nº de UTXOs.
- **Rota** `app/api/city/data/route.ts` — emitir praça, âncoras, áreas abertas, zona, prestígio, state.
- **Perfil** reusar o profile de carteira do dogdata no clique (painel na cidade).
- **Renderer** `app/city/explore/city-3d.tsx` — praça+torre+entrada cinematográfica, áreas abertas (bancos/parquinho), condomínios baixos, dirigível Kray, orla/praia/barcos, fachadas-anúncio.
- **Fonte de idade:** `dog_utxos_by_address.json` (`age_days`, `lth` por UTXO) + coortes de airdrop.

---

## Decidido nesta rodada (2026-07-07)
- **Faixas:** `<1` descarta · **`1–10.000` = área verde/parquinho** · `≥10.000` = construções.
- **Métrica de centralidade:** **idade do 1º UTXO ≥ 10.000 DOG** da carteira. **Já implementado.**
- **crosschaincity:** já implementado; **não é preocupação** deste plano.

## Perguntas em aberto (pra confirmar antes de codar os blocos pendentes)

1. **Layout exato da lateral da praça:** confirmar "1 âncora (50% central) + 2 menores por flanco" = quantos prédios por lado.
2. **SOL/STX:** ordenar por **saldo** ou **last_active** (sem idade de UTXO comparável)?
3. **Prestígio:** fórmula (idade + acumulação + LTH?) e o que ele afeta visualmente (brilho? tier de anúncio? ambos?).
4. **Edge da métrica:** carteira com total ≥10k mas **sem nenhum UTXO ≥10k** (muitos UTXOs pequenos) — qual idade a centraliza? Fallback provável: UTXO mais antigo da carteira.
```
