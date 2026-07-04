# DogCity 3.0 — Uma carteira, um endereço na cidade (`cityupdate3.md`)

> **Meta:** honrar a ideia-mãe do projeto — **cada carteira é um endereço físico na
> cidade** — e fazer a cidade **crescer com os dados**: hoje 86.315 carteiras, amanhã
> 200k. O saldo vira a **área** que a carteira ocupa; cada UTXO vira uma **construção**
> cuja **altura** é o valor daquele UTXO. Sucessor do `cityupdate2.md` (salto AAA).
>
> **Como este plano nasceu (2026-07-04):** 3 agentes rodaram em paralelo — (1) dados
> (os valores de UTXO existem?), (2) render (aguenta 86k/243k prédios?), (3) design
> (o mapeamento saldo→área é coerente?). Decisão do dono após os veredictos:
> **modelo híbrido**. Este documento é a síntese acionável.

---

## O diagnóstico — a cidade mente sobre quantas carteiras existem

Hoje a cidade mostra **~12k prédios** mas existem **86.315 carteiras**. A causa é uma
linha só — `app/api/city/data/route.ts:381`:

```ts
const count = Math.min(plots.length, hs.length)   // ← descarta o excedente
```

O gerador cria um número **finito** de plots geométricos entre as ruas
(`GRID_SPACING=12.5`, `R_LAND=1180`, `BLOCK_CYCLE=10` → ~12k slots após água/ruas/
densidade). Quando um distrito tem mais carteiras que plots, o excedente é
**silenciosamente descartado** — e são justamente os distritos de massa que estouram:
HODLer (32.091 carteiras) e Paper Hands (28.429). A cauda longa some. Isso **viola a
premissa central do projeto** e é o bug #1 a corrigir, independente da estética.

---

## Os 3 veredictos (base deste plano)

| Eixo | Veredito | Consequência para este plano |
|---|---|---|
| **Dados** | ✅ **JÁ EXISTEM** | `data/dog_utxos_by_address.json` (39 MB, 86.315 addr / 243.123 UTXOs), schema `{address: [{txid,vout,dog,age_days,ts,lth}]}`. Gerado de hora em hora por `scripts/update_holders_and_fees.py:171-209`. Zero varredura extra, nada de tocar no redb. |
| **Render** | ✅ A (86k) / ⚠️ B (243k) | Base já correta: `InstancedMesh` por tier (`city-3d.tsx:583-664`), ~18 draw calls fixos. O teto de 12k é do **gerador**, não do render. B exige BVH+LOD+agregação. |
| **Design** | **Híbrido** | Altura lê melhor que área no panorama; UTXO é detalhe de inspeção. Panorama = 1 prédio/carteira; clique = explode em UTXOs. |

---

## BLOCO A — Todas as carteiras presentes (o requisito inegociável)

**Objetivo:** remover o teto e garantir que as 86.315 carteiras (e as futuras) apareçam.

1. **Matar o cap** — `route.ts:381`: trocar `Math.min(plots.length, hs.length)` por um
   laço que **garante um plot para cada holder**. Se faltar plot, o Bloco B provê mais
   área (a cidade cresce) em vez de descartar.
2. **Ordenação preservada** — manter `holdersByDistrict[d].sort(dog desc)` (`route.ts:322`)
   para que os grandes fiquem perto da semente do distrito (skyline decrescente do
   centro pra fora, já existe via `sort by dist2` em `route.ts:374`).
3. **Métrica de aceite honesta** — `meta.total_buildings` **deve** bater com
   `meta.total_holders` no modo overview. Hoje diverge; passará a ser um invariante
   testado por curl no gate.

**Risco:** baixo. É desbloqueio de dados, não de render.

---

## BLOCO B — Distribuição & crescimento da cidade  ⭐ (o foco deste update)

> *"A cidade deve crescer bastante — temos que pensar em como distribuir isso na área."*

O erro a evitar é hardcodar `R_LAND=1180` e sufocar. A cidade tem que **dimensionar-se
a partir dos dados**. A regra-mestra:

### B1. Raio derivado do "orçamento de área" (a cidade auto-cresce)

Em vez de raio fixo, deriva-se o raio do número de carteiras e da área que cada uma
ocupa. Cada carteira consome 1 lote; a soma dos lotes + overhead de ruas/água define a
área total, e daí o raio:

```
N            = nº de holders (hoje 86.315)
usable_frac  ≈ 0.34            // fração de célula que vira lote (fora água/ruas/densidade)
cell_area    = GRID_SPACING²   // área por slot
area_total   = (N / usable_frac) · cell_area · (1 + street_overhead)
R_LAND       = sqrt(area_total / π)
```

Sanidade com os dados de hoje: `N=86.315`, `GRID_SPACING=12.5`, `usable_frac≈0.34`
→ **R_LAND ≈ 3.0k–3.6k** (contra 1.180 atual). **A cidade ~triplica de raio / ~7× de
área.** Exatamente o crescimento pedido — e ele acontece sozinho quando N sobe para
200k (R_LAND → ~5.4k), sem reescrever nada.

### B2. Tudo escala com o raio (WORLD_SCALE)

Hoje há constantes **absolutas** amarradas ao mundo antigo que quebram se o raio muda:
`OCEAN_START_X=-950` (`route.ts:61`), `RIVER_W=48` (`route.ts:62`), `LAKES[]`
(`route.ts:105`), `SEEDS[]` (`route.ts:47`), `GRID_SPACING`. **Refatorar para relativos
a `R_LAND`** (ou introduzir `WORLD_SCALE = R_LAND / 1180` e multiplicar):

- Oceano, rio, lagos, sementes de distrito → coordenadas em frações de `R_LAND`.
- No renderer (`city-3d.tsx`): distância de câmera, `far` da câmera, densidade da
  neblina (height fog do cityupdate2 BLOCO 4), frustum da sombra da lua, e o
  `fadeOut`/LOD precisam escalar com `R_LAND` — senão a cidade nova nasce dentro do
  fog ou fora do frustum de sombra.

### B3. Anéis de distrito Fibonacci (como distribuir na área)

Casando com o **BLOCO 2 do cityupdate2** (anéis 1-2-3-5-8-13). A área cresce, mas a
**densidade e altura decaem do centro pra fora** — a hierarquia se mantém legível:

| Anel (do centro) | Distritos | Perfil de lote |
|---|---|---|
| Núcleo (0–0.15·R) | Satoshi, Leonidas | **Poucos lotes enormes** (baleias) — "campus corporativos" |
| Interior (0.15–0.4·R) | Casey, Runes, Sovereign | Lotes médios, torres |
| Cinturão (0.4–0.7·R) | Accumulator, Genesis | Malha média |
| Subúrbio (0.7–1.0·R) | **HODLer, Newcomer, Paper Hands** | **Malha fina de lotes mínimos** — o tapete de 60k+ micro-holders |

A cauda de 63.577 carteiras de 1-UTXO **é** o subúrbio residencial — realista e bonito
de cima (`?view=top`), não ruído. As baleias dominam o centro pela **área do lote**
(Bloco C), não por altura solitária.

### B4. Loteamento de área variável (packing)

A grade uniforme atual dá plots de tamanho igual — incompatível com "área = saldo".
Duas rotas, em ordem de custo:

- **Rota simples (Bloco A/overview):** manter a grade densa; a carteira ocupa **1
  célula**, mas a **largura do prédio** (footprint) varia com o saldo (Bloco C). Rápido,
  entrega "todas presentes" já. Limite: baleias não ganham lote proporcional real.
- **Rota completa (treemap):** dentro de cada quarteirão (células entre `roads`/`segs`,
  `route.ts:325-327`), subdividir a área por **squarified treemap** (Bruls et al.)
  proporcional a `A_i`. Retângulos com aspect-ratio ~1 (evita lote-espaguete),
  ruas internas nascendo entre os lotes grandes. **Metáfora urbana preservada e
  melhorada.** É a rota para o modelo pleno saldo→área. (Voronoi ponderado foi
  descartado pelo agente de design: bordas diagonais quebram a leitura "cidade" e é
  instável com 86k sementes e pesos de 15 ordens de grandeza — mantê-lo só para as
  **bordas fracas de distrito**, uso atual em `buildVoronoiPolygons`.)

---

## BLOCO C — Footprint = saldo (a área que a carteira ocupa)

Linear é inviável: o rank #1 (12,1B DOG = 12,1% do supply) tomaria 12% da cidade e a
cauda (<1 DOG) seria sub-pixel. **Escala por raiz quadrada** (convenção cartográfica: o
olho percebe *área*, não raio) + **piso mínimo** que garante a cauda visível:

```
A_min = 40         // lote/footprint mínimo → toda carteira aparece (requisito)
A_max = 8000       // teto do maior lote (fração controlada da cidade)
S     = 12.1e9     // supply na maior carteira (normalizador)
s     = saldo em DOG, clamp [1, S]

norm  = sqrt(s) / sqrt(S)
A     = A_min + (A_max - A_min) · norm      // área do lote → largura = sqrt(A)
```

Verificação com dados reais:
- Rank #1 (12,1B): norm=1 → A≈8000 (âncora do centro).
- Mediana (108k): norm≈0,003 → A≈64 (lote pequeno, visível).
- Micro (1 DOG): norm≈9e-6 → **A=A_min=40 (aparece garantido).**

Fator ~335× entre a maior e a mediana — dominante sem engolir a cidade. **Toggle
alternativo (modo-quantil):** `A = A_min + (A_max-A_min)·(1 - rank_percentil)²` — imune
a outliers, gradação suave, mas perde a leitura "área = quanto DOG". √ é o default.

**No overview a altura continua = saldo** (`heightTier`, `HEIGHT_TABLE` em
`city-3d.tsx:48`) — o skyline segue contando "quem é baleia". O footprint (largura) é
que passa a codificar saldo com a fórmula √ acima, substituindo `footprintW` fixo
(`city-3d.tsx:52`).

---

## BLOCO D — Explode-on-click: UTXO-como-prédio (a ideia original do dono)

O detalhe rico entra sob demanda, sem poluir o panorama.

### D1. Endpoint enxuto
Novo `app/api/city/utxos/route.ts` lendo `data/dog_utxos_by_address.json`, projetando
por carteira **só o essencial** (`[valor_dog]` por UTXO, ou a altura já pré-computada),
descartando `txid/ts/age_days/lth`. Os 39 MB caem para **~2–4 MB gzipado**. Lazy-load
por carteira **ao clicar** — nunca o arquivo inteiro no browser.

### D2. Interação
Ao clicar numa carteira (ou cruzar um limiar de zoom sobre o lote), o prédio único
**"explode"**: o lote (área ∝ saldo, Bloco C) é subdividido por **squarified treemap**
(Bloco B4) e vira **N construções — 1 por UTXO**, altura ∝ valor do UTXO.

### D3. Altura do UTXO (mesma família √)
```
altura_utxo = H_min + (H_max - H_min) · sqrt(v_utxo) / sqrt(v_utxo_max_da_carteira)
```
Não usar o `heightTier` inteiro de 0–9 aqui — senão UTXOs de 1 e de 100k DOG ficam na
mesma altura. `H_min` garante o menor UTXO visível.

### D4. Regra da baleia (rank #2 = 20.954 UTXOs)
Só **116 carteiras** têm >100 UTXOs; só **4** têm >1000. Regra "**N maiores + 1
agregado**":
```
N_CAP = 24                          // ~p99 de utxo_count → 99,86% das carteiras intactas
se utxo_count <= N_CAP:  1 prédio por UTXO
senão:                   N_CAP maiores individuais
                       + 1 bloco "complexo/arcologia" agregando a cauda:
                           altura  = valor MEDIANO da cauda (não a soma — evita torre falsa)
                           largura ∝ (utxo_count - N_CAP)   → "conjunto denso"
                           material/flag distinto (agregado)
```
Corta o rank #2 de 20.954 → 25 elementos **sem alterar visualmente 99,86% da cidade**,
e sem mentir sobre a estrutura (a cauda de poeira vira 1 elemento cuja largura diz
"muitos", altura diz "cada um é minúsculo").

---

## BLOCO E — Render em escala (o que muda no `city-3d.tsx`)

A base (`InstancedMesh` por tier, `StaticDrawUsage`, geometria compartilhada) **já é a
arquitetura certa** — ~18 draw calls para qualquer contagem. O que falta para 86k/243k:

1. **Culling por instância (BVH)** — `@three.ez/instanced-mesh` (frustum BVH per-instance
   + LOD automático), já previsto no cityupdate2 BLOCO 5 (linhas 189-190). **Obrigatório
   para 243k, desejável para 86k** (~70% da cidade fica fora do frustum).
2. **LOD por distância** — box completo perto → box sem `emissiveMap` no médio →
   imposter/ponto ao longe. Sem isso o subúrbio de 60k casas custa fill-rate à toa.
3. **Shadow seletivo** — só tiers ≥6 projetam sombra (hoje todos: `city-3d.tsx:635`).
   O shadow pass duplica a cena; 243k × 2 é onde o frame estoura. Recomputar bounding
   sphere (QW4 do cityupdate2) em vez de `frustumCulled=false`.
4. **Raycast hierárquico** — o `raycaster.intersectObject` linear (`city-3d.tsx:1339-1349`)
   é O(instâncias); com 243k **trava o clique**. Testar bounding box de carteira/distrito
   primeiro, refinar depois. Pré-requisito do explode-on-click (Bloco D).
5. **LOD hierárquico da baleia** — à distância, a carteira-baleia é **1 imposter**; ao
   aproximar, expande nos N prédios reais (`THREE.LOD` por lote).

---

## Mudança no modelo de dados (`buildings[]`)

Hoje `buildings[]` = `[x, z, heightTier, districtId, holderRank, rot]` (`city-3d.tsx:26`,
gerado em `route.ts:383-390`). Evolução:

- **Overview:** acrescentar `footprint` (Bloco C) → `[x, z, heightTier, districtId, rank, rot, footprint]`.
- **Explode:** payload separado do `/api/city/utxos` — por carteira `{rank, lot:{x,z,w,h}, utxos:[altura...], aggregate?:{...}}`. Não vai no payload do overview (lazy).

---

## Budget de frame (GTX 1650 @ 1080p — atualiza o do cityupdate2)

| Etapa | ms — overview 86k | ms — explode (1 carteira aberta) |
|---|---|---|
| Prédios instanciados + BVH culling | 6–8 (86k, ~70% culled) | +1–2 (N UTXOs de 1 lote) |
| Sombra da lua (seletiva, tiers ≥6) | 1.5 | 1.5 |
| Bloom sel. + SMAA + LUT + SSAO | 3.5 | 3.5 |
| Raycast hierárquico (por clique, não por frame) | ~0 | <1 no clique |
| **Total** | **~12ms** ✓ 60fps | **~13ms** ✓ 60fps |

243k prédios **sempre visíveis** (modelo UTXO puro, descartado como default) ficaria em
20–35fps ao olhar o skyline inteiro — daí o híbrido. DPR adaptativo (cityupdate2)
continua o seguro de 60fps.

---

## Ordem de execução

```
BLOCO A (matar o cap: todas as 86.315 aparecem)            ← corrige a premissa do projeto
  → BLOCO B (raio derivado + WORLD_SCALE + anéis Fibonacci) ← a cidade cresce e distribui
  → BLOCO E1-E3 (BVH culling + LOD + shadow seletivo)       ← 86k a 60fps
  → BLOCO C (footprint = saldo, escala √)                   ← área conta a riqueza
  → BLOCO D (endpoint /utxos + explode-on-click + baleia)   ← a ideia UTXO, sob demanda
  → BLOCO E4-E5 (raycast hierárquico + LOD da baleia)       ← clique não trava
  → (rota treemap do B4, quando o loteamento pleno valer o custo)
```

Racional: A entrega já o que mais incomoda (carteiras faltando); B é o coração deste
update (crescer sem sufocar); C+D realizam a ideia original do dono como camada de
inspeção, não de panorama. Tudo compatível com o salto AAA do cityupdate2 — na verdade
o BLOCO 2 (Fibonacci) e o BLOCO 5 (BVH/LOD) do cityupdate2 são **pré-requisitos
compartilhados**, não trabalho duplicado.

## Métricas de aceite

- [ ] `meta.total_buildings === meta.total_holders` no overview (invariante testado por curl)
- [ ] Nenhum distrito trunca carteiras (HODLer 32k e Paper Hands 28k **completos**)
- [ ] Raio da cidade derivado dos dados; subir N no dataset cresce a cidade sem editar código
- [ ] Todas as constantes de mundo (oceano/rio/lagos/sementes) relativas a `R_LAND`
- [ ] Baleia (área) domina o centro; cauda 1-UTXO forma subúrbio legível de cima
- [ ] Clique numa carteira explode nos UTXOs, altura ∝ valor (rank #2 → 24 + agregado)
- [ ] 60fps na GTX 1650 no overview 86k; ≥55fps com 1 carteira explodida
- [ ] Clique responde <16ms mesmo com a cidade cheia (raycast hierárquico)

---

## Notas de ambiente (herdadas do cityupdate2, sagradas)

- **Não rodar screenshots headless por software** na cena cheia — OOM mata o processo.
  Playwright MCP com GPU real (GTX 1650) + viewport pequena + `?noreflect=1`.
- Gates: `tsc`, validação da API por curl/node, QA visual via Playwright/GPU.
- Cuidado com `next dev` zumbis comendo RAM.
- **Arquivos-alvo:** `app/api/city/data/route.ts` (cap, raio derivado, world scale,
  loteamento), novo `app/api/city/utxos/route.ts` (per-UTXO), `app/city/explore/city-3d.tsx`
  (footprint, BVH/LOD, shadow seletivo, raycast, explode). Fonte de dados pronta:
  `data/dog_utxos_by_address.json` e `data/dog_holders.json`.
- A modularização proposta na auditoria do cityupdate2 (`core/ + systems/ + data/`)
  deve acontecer **antes** de o Bloco E tocar o monólito de 1.554 linhas.
