# BBF BUILD — Torre BitFlow "The Stack" 🌆

> Plano de implementação do prédio-âncora da BitFlow na Satoshi Plaza.
> **v3 (2026-07-10)** — refeito a partir da FOTO DE REFERÊNCIA enviada pelo dono:
> uma torre de vidro escuro moderna, com volumes modulares empilhados em balanço,
> interiores com glow âmbar quente, painéis pixel-dither perfurados, faixas LED
> laranja e o letreiro BITFLOW no topo e na entrada.
> Nível: landmark, par da Kray Tower — needle central (500) continua reinando o céu.
> IMPLEMENTADO em `app/city/explore/bitflow-tower.ts`.

---

## 1. A referência (imagem do dono)

Render fotorrealista de um HQ "BITFLOW": torre de **vidro escuro / charcoal** com:
- **Volumes modulares empilhados em balanço** (jenga) — caixas que avançam pra
  esquerda/direita/frente em alturas diferentes, criando silhueta dinâmica.
- **Interiores com glow âmbar quente** atravessando os andares de vidro (muitos
  pisos, forte ritmo horizontal de lajes).
- **Painéis pixel-dither perfurados** — caixas escuras salpicadas de pontinhos de
  luz laranja (o motivo dither da marca, "spray do mar" em pixels).
- **Faixas LED laranja** — tira vertical subindo o núcleo + contorno da caixa-coroa.
- **Letreiro BITFLOW iluminado** no topo (mark laranja + wordmark creme) e de novo
  na **entrada térrea** glowing (portal laranja).
- **Jardim de cobertura** (verde) num terraço recuado.
- Céu de crepúsculo, contexto de cidade.

**Paleta dominante:** black-flow `#0B0E0B` (massa) · salamander `#F78116` (glow/LED)
· branco-quente (vidro) · com um SUSSURRO de sea `#00D1AC` nos pixels do dither.

Arte oficial: `/public/Bitflow.png` (mark laranja + wordmark creme) — **usada** para
extrair os letterforms reais do wordmark (ver §5).

---

## 2. Conceito — "The Stack"

Uma torre de vidro escuro de **volumes modulares em balanço ao redor de um núcleo de
vidro luminoso**. De longe: massa charcoal escalonada com miolo âmbar quente pulsando
e o letreiro BITFLOW laranja coroando. De perto: andares de vidro com lajes marcadas,
painéis dither perfurados como acento, LEDs laranja no núcleo e na coroa, entrada
térrea glowing e um jardinzinho de cobertura. Kray = monolito negro esguio com V-ribs;
BitFlow = **stack quente e vidrado** — vizinhos de mesmo porte, personalidades distintas.

Altura de coroa ~332 (base y=0 local; grupo assentado no slab da praça em y=4).
Lote 175×82; `+Z` local = fachada da praça (âncora norte, `face = π`).

---

## 3. Massing — os volumes (espaço local, base y=0)

Stack "jenga" ao redor de um núcleo de vidro (o miolo brilhante vertical):

| Volume | tipo | cx | cz | w×h×d | yBase→topo |
|---|---|---|---|---|---|
| Podium | glass | 0 | 0 | 172×48×80 | 0→48 |
| **Núcleo** (spine) | glass bright | 8 | 0 | 64×250×62 | 44→294 |
| Left-low | dither | −58 | +6 | 68×76×68 | 48→124 |
| Right-low | glass | 56 | −2 | 72×92×74 | 48→140 |
| Left-mid | glass | −54 | +3 | 74×78×72 | 126→204 |
| Right-mid | dither | 58 | +5 | 66×62×66 | 150→212 |
| Left-high | dither | −48 | +2 | 66×60×64 | 206→266 |
| Right-high | glass | 52 | +1 | 70×66×68 | 214→280 |
| **Coroa** (sign band) | glass | 10 | 0 | 150×42×78 | 290→332 |

Cada volume é `BoxGeometry` com **array de 6 materiais** (aspecto de janela correto nas
faces largas e estreitas). `castShadow/receiveShadow` em todos. Núcleo tem `bright=1.0`
(mais janelas acesas → o miolo âmbar da referência).

---

## 4. Materiais de fachada (baked once, emissiveMap)

**glassTex(cols, rows, bright)** — vidro escuro, **lajes horizontais fortes** (ritmo de
andares), janelas majoritariamente âmbar (`#ffb35e`/`#ff9e3d`) com algumas frias
(`#e8f0ff`) e poucas apagadas; mullions verticais finos. `bright` eleva a taxa de acesas
(núcleo = hero). `MeshStandardMaterial` color escuro + emissive branco + emissiveMap;
roughness 0.18 / metalness 0.6 (brilho de vidro).

**ditherTex(cols, rows)** — painel quase-preto com scatter esparso (~26%) de pixels
laranja glowing de brilho variado + ~12% em sea-green (o sussurro da marca). Material
mais fosco (roughness 0.6). É o painel perfurado da referência.

flipY: canvas y=0 = TOPO do prédio. Memoização por `${type}${cols}x${rows}` → reuso.

---

## 5. Letreiro & LEDs (a logo, correta)

- **Mark pixel-wave laranja** — bitmap `MARK` (traçado da arte oficial) desenhado em
  quadrados glowing (`markTex`), plano `MeshBasicMaterial toneMapped:false`.
- **Wordmark BITFLOW** — **letterforms REAIS extraídos de `/public/Bitflow.png`**
  (`loadWordmark`): threshold do wordmark creme, recolor pra creme claro `#ECF0F8` com
  rampa de alpha, crop pulando o mark. NUNCA fonte genérica (regra do dono).
- **Sign da coroa:** placa escura + mark laranja + wordmark creme na banda da coroa (+Z).
- **Sign da entrada:** versão menor sobre o portal térreo.
- **LEDs laranja** (`MeshBasicMaterial SALA toneMapped:false`): tira vertical subindo o
  núcleo (spine) + contorno retangular da coroa + moldura do portal de entrada.

---

## 6. Térreo & cobertura

- **Entrada glowing:** moldura de portal em LED laranja (U invertido) + plano de lobby
  âmbar quente + letreiro pequeno acima. É a entrada iluminada da referência.
- **Jardim de cobertura:** planter escuro + 7 arbustos (Icosahedron verde emissivo) num
  terraço recuado sobre a caixa left-high (~y268).

---

## 7. Luzes & animação

- **3 point lights:** glow âmbar do núcleo (`0xffb060`), calor da entrada (`0xffa64d`),
  halo laranja da coroa (`SALA`).
- **animate(t)** (zero alocações): flicker sutil do interior quente (emissiveIntensity
  dos materiais glass), pulso dos LEDs laranja (varia `ledMat.color`), pulso das luzes
  núcleo/coroa. Letreiro estático.

**Orçamento:** ~11 volumes (BoxGeometry, alguns multi-material) + LEDs/planos/sign +
jardim; 3 point lights; texturas 512² memoizadas (glass/dither por tamanho) + wordmark
extraído + mark. Sombras em todos os volumes.

---

## 8. Regras de marca (não violar)

1. **Nunca fonte genérica** no wordmark — sempre os letterforms reais da arte oficial.
2. **Paleta estrita:** black-flow massa, salamander glow/LED, branco-quente vidro,
   sussurro de sea no dither. Nada de magenta/roxo/cyberpunk.
3. **Volumes modulares grandes e limpos** — o dither é acento perfurado, não a fachada
   inteira; o vidro é o herói (glow quente), não um grid multicolorido.
4. **Pixel/8-bit** só nos pontos certos (mark, dither) — as caixas são hard-edge, sem curvas.

---

## 9. Histórico de iterações

- **v1 "The Set Wave"** — onda de pixels em escada; rejeitado ("cubo mágico").
- **v2 "Modular Flow"** — 2 blocos sólidos laranja+verde; bom, mas o dono trouxe a foto
  de referência pedindo algo "muito mais bonito".
- **v3 "The Stack"** (atual) — torre de vidro escuro com volumes em balanço, glow âmbar,
  dither, LEDs e letreiro, fiel à foto. Validado no browser (sem erros tsc/console).

---

## 10. Checklist de aceite

- [x] `bitflow-tower.ts` refeito no estilo da referência; integrado no branch da praça.
- [x] Volumes modulares empilhados em balanço ao redor do núcleo de vidro.
- [x] Andares de vidro com glow âmbar quente + lajes horizontais.
- [x] Painéis pixel-dither perfurados (laranja + sussurro sea).
- [x] Faixas LED laranja (spine + coroa + portal).
- [x] Letreiro BITFLOW (mark laranja + wordmark REAL da arte) no topo e na entrada.
- [x] Entrada térrea glowing + jardim de cobertura.
- [x] Paleta estrita; tipografia idêntica à marca; sem erros tsc/console.

---

*v3 2026-07-10 · referência: foto do dono · arte oficial `/public/Bitflow.png` · "The Stack".*
