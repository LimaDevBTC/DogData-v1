# A MAQUETE DA DOGCITY: especificação de construção

> **Nota de 01/09/2026.** Os números de loteamento deste levantamento (raio de
> sítio 4.500, 52.991 lotes, `cidade.json` de 29/08) foram superados: o sítio foi
> para raio 7.000 em 31/08 e a cidade tem 85.843 carteiras plantadas. Para número
> corrente, leia `public/city/cidade.json` ou a tarja no topo de
> `orcamento-de-terra.md`. As medições de GLB e de técnica de render continuam
> válidas.

Contrato verificável do loteamento sem prédios. Escrito em 29/08/2026 pelo diretor de
arte da rodada, a partir da direção vencedora e dos enxertos que os três jurados
pediram. Seis construtores trabalham em paralelo lendo só este arquivo; três jurados
reprovam chapa contra ele.

Regra de leitura: **cada item é um número, um hex ou um caminho:linha. Onde eu escrevo
NAO MEDIDO, é porque não medi, e o construtor mede antes de fixar.**

---

## 0. AS DEZ DECISÕES QUE MANDAM (onde o júri discordou, eu decidi)

**D1. A base é a direção `plano-diretor-gravado`, não a `maquete-fisica`.**
Dois dos três jurados votaram nela (urbanista 8,5 e cena 8,0 contra 6,5 e 8,0 para as
outras; o sheik votou `maquete-fisica` com 8,5). O voto de minerva é um fato do repo, não
uma opinião: `app/city/plaza/vias.ts:52-54` fixou `Y_PISTA 0,18`, `Y_CALCADA 0,33` e
`Y_CANTEIRO 0,40`, e `app/city/plaza/pracas.ts:55-58` amarrou `Y_BASE 0,33` à calçada com
o motivo escrito no arquivo ("quem anda pela rua entra na praça sem degrau"). Inverter a
cota, pondo o lote em +0,02 e a placa em +0,60, transforma cada uma das **128 praças
existentes** num poço de 0,27 m e obriga a reescrever a pilha de quatro camadas de
`pracas.ts`. Isso não estava no escopo nem no custo daquela direção. **As três cotas de
`vias.ts` não mudam nesta rodada.** O que a `maquete-fisica` ganhou (paleta única, um
verde só, zero numeração no chão, peça virando alvéola, fundo preto) entra por enxerto,
que é onde ela é boa.
O perfil de luz continua se chamando `maquete` porque a LINGUAGEM é de maquete. A COTA é
de cidade.

**D2. `planarAt` NÃO SE ESCREVE. Ele já existe e se chama `superficieAt`.**
Os três dossiês abrem o capítulo de riscos com "planarAt não existe e é pré-requisito".
Os três estão errados contra o repo de hoje. A função está em
`app/city/plaza/terrain.ts:183`, declarada em `terrain.ts:71`, devolvida em
`terrain.ts:276`, e ela faz exatamente o que os dossiês pedem: acha a célula de 59,225 m,
escolhe o triângulo pelo lado de `u+v<=1` e interpola o PLANO. Mais: ela JÁ é o que os
três módulos de chão recebem, em `plaza-scene.tsx:985` (tecido), `:1001` (vias) e `:1015`
(praças). **Nenhum construtor escreve função de terreno nova.** Quem precisa de chão
chama o `heightAt` que recebe por parâmetro, que já é o `superficieAt` da cena.
Conferido por replicação em python contra `public/lunar/btc-core-heightmap.f32`: bate no
centavo com os valores que os dossiês mediram no navegador (r 4.000 no BUL04 dá -29,54 nos
dois; Lago Maior dá +28,69 nos dois).

**D3. O bug do passo de 64,6 m também já foi consertado.** `vias.ts:176` fixa
`const PASSO = 18` com a medição escrita ao lado, e `pracas.ts:163` faz o mesmo. Os 5,44%
de pista submersa são história de uma versão anterior dos bulevares que morreu junto com
ela. Ninguém precisa consertar isso de novo. **Quem escrever geometria de chão nova usa
passo <= 18 m, e isso é a regra, não a exceção.**

**D4. Não existe cor de acento nas quatro chapas de apresentação.**
O eixo do bulevar é branco de calçada `#D8D2C4` sobre pista `#57534B`, **5,08:1**. O
laranja da casa `#E8660D` sobre a mesma pista mede **2,31:1** e o `#F7931A` que a direção
vencedora queria mede **3,33:1**. Branco ganha dos dois e não gasta a regra do
`#E8660D` que já está gravada na casa. O acento sobrevive em dois lugares só, e ambos são
de identidade e não de leitura remota: os **34 lotes DSC** e a camada `?cota=1`.

**D5. Nenhuma numeração no chão. Nem de lote, nem de quarteirão, nem de quarto, nem de
setor, nas chapas de apresentação.** O levantamento não achou UM maqueteiro (Foster, SOM,
Pipers, RJ Models, Amalgam, Craft Group) que grave número de lote em maquete de
masterplan. E a semente não está congelada: `public/city/cidade.json` publica hoje
**52.984 carteiras** e mediana **312 m2**, enquanto o briefing desta rodada fala em 52.991
e 287 m2. Publicar número no chão é publicar endereço de 53 mil pessoas em cima de um
dado que se mexe. Rótulo de quarteirão, quarto e setor mais linha de cota existem, todos
atrás de `?cota=1`, todos DESLIGADOS por padrão. Identidade de carteira vem do clique e do
cartão do HUD, como já vem.

**D6. O marco de esquina de LOTE morre. Nasce um marco de QUARTEIRÃO.**
Os 52.984 marcos de `tecido.ts:159-197` custam 635.808 triângulos e um material inteiro
para produzir 0,59 px de largura na vista aérea, ou seja grão. Saem. Entram 4.728 marcos
(1.182 quarteirões x 4 esquinas), onze vezes menos, registrados no `DistanceCuller` com
alcance de 1.200 m: eles existem só na chapa onde se leem.

**D7. Árvore é primitiva do three, não GLB.** Cada GLB de árvore em `public/city/sf/` traz
de 1 a 5 materiais (`palm-date` tem 4, `tree-palm` tem 5) e `props.ts:45-110` cria um
InstancedMesh POR PARTE, então uma espécie são 2 a 5 draw calls e 2 a 5 programas por
nível de LOD. Usar GLB exigiria uma passada de Blender fora do repo para fundir geometria
e atlasar textura, e esse é trabalho que atrasa entrega sem melhorar chapa a 1.900 m. Os
34 GLBs continuam servindo a praça central no raio 910, sem nenhuma mudança.

**D8. A arborização planta nas covas que `pracas.ts` já publica, e em mais lugar nenhum
dentro da praça.** `pracas.ts:33` declara o contrato numa linha ("a praça marca a cova,
não a árvore") e `pracas.ts:39` devolve `covas: Cova[]`. Nenhuma das três direções sabia
que esse módulo existe: as três propunham grade ou perímetro próprio, que plantaria em
cima de sebe, de espelho d'água e de mureta. Contagem esperada, calculada sobre
`public/city/cidade-malha.json` com o mesmo hash de `pracas.ts:97`: **128 praças** (38
parterre, 42 seca, 34 verde, 14 água) e **2.136 covas antes da máscara `emPeca`**. O log
do módulo é a verdade.

**D9. As 7 superquadras que cobrem 141 lotes não se consertam no gerador: se resolvem no
shader, e ninguém desaparece.** `scripts/gerar_cidade.py:586-609` grava 7 lotes gigantes
por cima de 141 lotes normais do próprio quarteirão. Consertar `coloca()` muda o endereço
de todo mundo depois do primeiro gigante. Regra: no carregamento de `lotes.ts`, um lote
cujo retângulo esteja inteiramente contido no de outro lote do mesmo quarteirão sobe
**+0,04 m** sobre ele. Nenhum lote some, nenhuma listra pisca. O módulo loga a contagem e
ela tem de dizer **141**.

**D10. A água escurece e vira espelho, sem Reflector.** De `#1E3A52` (L 0,039) para
`#16283C` (L 0,020), `roughness 0,08`, `metalness 0,35`. O que ela reflete está medido em
`lunar-env.ts:106-119`: o environment carrega céu a radiância 0,012 e um **disco da Terra
de 4,5 graus de raio a radiância 6,0**, deliberadamente maior que os 2 graus reais para
sobreviver ao PMREM. Ou seja há um realce especular grande e estável para colher, e ele é
a Terra, não o sol. O sol entra pelo realce pontual da DirectionalLight e dá um ponto, não
um rastro: quem prometer rastro solar está errado. Reflector está proibido: é um passe de
cena inteiro por lago.

---

## 1. PALETA

Regra de cor em uma frase: **a cidade inteira é osso (matiz 36 a 42, saturação <= 0,18);
existe UM verde; existem DUAS exceções cromáticas declaradas; e o acento não pisa no
chão da apresentação.**

L é a luminância relativa (0 a 1, fórmula sRGB da WCAG). S é a saturação HSV. As duas
colunas foram calculadas, não estimadas.

### 1.1 A família OSSO (matiz 36 a 42, S <= 0,18)

| nome | hex | L | S | onde usa |
|---|---|---|---|---|
| REGOLITO | `#3F3D3A` | 0,047 | 0,079 | terreno, já existe, **não se toca** |
| SULCO | `#5F5A4E` | 0,103 | 0,179 | a linha de dentro da divisa de lote (shader) |
| ESCURO / PISTA | `#57534B` | 0,087 | 0,138 | pista de contorno, travessa e bulevar; asfalto das 15 peças de distribuição; piso de cova de árvore |
| TRONCO | `#6E685C` | 0,140 | 0,164 | tronco da árvore (cor por vértice) |
| MEDIO / MEIO-FIO | `#8F8879` | 0,248 | 0,154 | face vertical de 0,15 m do meio-fio; marco de quarteirão; galpão, contêiner e volume cívico das peças |
| LOTE C | `#9E988C` | 0,316 | 0,114 | miolo de lote, tom escuro |
| LOTE B | `#A39D91` | 0,339 | 0,110 | miolo de lote, tom médio (a mediana da cidade) |
| LOTE A | `#A8A296` | 0,364 | 0,107 | miolo de lote, tom claro |
| CLARO / CALÇADA | `#CBC4B6` | 0,556 | 0,103 | calçada, adro, arquibancada, concreto, praia, piso de praça, mureta |
| MARCA / LÁBIO | `#D8D2C4` | 0,647 | 0,093 | o lábio de fora da divisa de lote; eixo tracejado do bulevar; faixa de pedestre |

### 1.2 O VERDE, e é UM SÓ

| nome | hex | L | S | onde usa |
|---|---|---|---|---|
| VERDE | `#7E8A6B` | 0,237 | 0,225 | copa de árvore, canteiro do bulevar, gramado de praça, campo de futebol, sebe de parterre, grama de jardim, ilha do Lago Maior, chão das 119 reservas |

Saem, e é o corte que mata o carimbo verde da chapa de hoje: `#4A5C3E` (canteiro,
`vias.ts:62`), `#3E5F42` (grama, `pracas.ts:61` e `pecas.ts:33`), `#2F4A34` (sebe,
`pracas.ts:62` e `pecas.ts:33`), `#3F6B44` (campo, `pecas.ts:34`). Quatro verdes viram um.
Sebe e gramado deixam de se distinguir por COR e passam a se distinguir por SOMBRA, que é
o que uma maquete faz e o que a luz nova entrega.

### 1.3 AS DUAS EXCEÇÕES CROMÁTICAS, declaradas

| nome | hex | L | S | onde usa | por que fica |
|---|---|---|---|---|---|
| ÁGUA | `#16283C` | 0,020 | 0,633 | lâmina dos 2 lagos, das 14 praças de água e das 3 piscinas do Complexo Aquático | água é escura mesmo, e é o valor mais escuro da cidade; contraste calçada/água 8,63:1 |
| TERRACOTA | `#8C4B3A` | 0,109 | 0,586 | a pista de atletismo do Estádio Olímpico (E01), e nada mais | pista de atletismo é terracota no mundo real; 1 peça, 1 elipse |

### 1.4 O ACENTO, e o teto dele

| nome | hex | L | S | onde usa | teto |
|---|---|---|---|---|---|
| ACENTO | `#E8660D` | 0,267 | 0,944 | (a) contorno dos 34 lotes DSC, em largura DOBRADA; (b) haste, tick e glifo da camada `?cota=1` | **0,00% dos pixels nas quatro chapas de apresentação sem `?cota`; <= 0,05% com o DSC em quadro** |

É o `#E8660D` da regra da casa, não o `#F7931A` que a direção vencedora pedia. O argumento
dela (3,33:1 contra 2,31:1 sobre o asfalto) estava certo na aritmética e errado na
conclusão: o problema não era escolher um laranja mais claro, era pôr laranja no chão. O
eixo virou branco de calçada e mede 5,08:1, mais que os dois.

### 1.5 As razões de contraste que o júri vai medir

| par | razão | serve para |
|---|---|---|
| calçada `#CBC4B6` / pista `#57534B` | 4,41:1 | a teia viária existe |
| calçada `#CBC4B6` / lote B `#A39D91` | **1,55:1** | a teia se destaca do campo. **É o par mais fraco da paleta e é o que decide a chapa aérea.** |
| lábio `#D8D2C4` / sulco `#5F5A4E` | 4,56:1 | a divisa lê como ranhura gravada |
| lábio / miolo B | 1,79:1 | o lábio existe sem estourar |
| sulco / miolo B | 2,55:1 | a linha existe |
| lote B / regolito | 4,02:1 | a cidade se destaca da Lua |
| marca `#D8D2C4` / pista | 5,08:1 | eixo e faixa de pedestre |
| verde / pista | 2,09:1 | canteiro não vira segunda pista (hoje `#4A5C3E` está a 8 milésimos de L da pista e o bulevar lê como TRÊS faixas escuras) |
| calçada / água | 8,63:1 | a água é acrílico escuro, não poça azul de mapa |
| meio-fio / calçada | 2,03:1 | a guia tem face |

**Autorização antecipada do sheik, registrada:** se na primeira chapa a teia branca não se
destacar do campo, escureça o LOTE (banda para `#999387` / `#948E82`, que sobe o par para
1,76:1 e 1,88:1). **Nunca clareie a calçada acima de L 0,60.** O motivo está medido e
escrito em `tecido.ts:46-52`: a primeira paleta ficava em L 0,70 a 0,87 e a chapa deu
50,4% da cidade acima de L 0,72 com só 13,4% de meio-tom, uma imagem de dois valores.

---

## 2. CHÃO E LOTE, módulo novo `app/city/plaza/lotes.ts`

**Construtor 1.** O módulo nasce novo e assume o desenho do lote. `tecido.ts` perde o
plinto e o marco no `modo === 'lote'` e continua dono do `modo === 'massa'` (diagnóstico) e
da chamada de `buildPecas`.

### 2.1 Técnica

- Um `THREE.InstancedBufferGeometry` de `PlaneGeometry(1,1)` deitado (rotateX -PI/2), **2
  triângulos por lote**, 52.984 instâncias, **105.968 triângulos, 1 draw call, 1 material**.
- Atributos por instância: `iOff` (vec2 x,z), `iRot` (float, `-setor * 7,5` graus em
  radianos), `iDim` (vec2 frente, prof), `iAlt` (vec4 com as 4 alturas de quina),
  `iFlags` (float: bit0 DSC, bit1 lote contido em superquadra).
- **As 4 alturas de quina são obrigatórias.** Medido: o declive do lote tem mediana 1,72
  grau, p95 3,80 e máximo 6,11; com quad plano na altura do centro o chão passa por cima do
  lote em 0,340 m na mediana e 3,296 m no máximo, e na chapa isso aparece como lote
  recortado em triângulo. Com as quinas o resíduo cai para 0,005 m na mediana. Custo: 848
  KB de atributo e 198 a 229 ms de montagem, contra 15 a 23 ms sem elas.
- **Altura sobre o terreno: +0,02 m**, contado a partir de `heightAt` (que a cena entrega
  já como `superficieAt`, ver D2). Constante única, medida: segura cobertura plena de 300 m
  a 9.000 m.
- ⚠️ **`polygonOffset` é INERTE nesta cena e não adianta tentar.** `plaza-scene.tsx:535`
  liga `logarithmicDepthBuffer: true`, o fragmento escreve `gl_FragDepthEXT` e apaga o
  deslocamento do rasterizador. Medido: fator 0, -16 e -64 dão os MESMOS 9.556 px. Só
  ALTURA resolve.
- ⚠️ **`ShaderMaterial`, nunca `RawShaderMaterial`, e com seis includes.**
  `<logdepthbuf_pars_vertex>`, `<logdepthbuf_vertex>`, `<logdepthbuf_pars_fragment>`,
  `<logdepthbuf_fragment>`, `<tonemapping_fragment>`, `<colorspace_fragment>`. Sem
  `colorspace_fragment` a cor sai linear num alvo sRGB e a luminância média mede 41 em vez
  de 237. Sem os quatro de logdepth o quad briga com o terreno. Custou duas rodadas ao
  levantamento; não custe uma terceira.

### 2.2 O desenho da divisa

No fragmento, `dist = min(meiaLargura - |local|)` em metros; `mpp = fwidth(dist)`;
**`larg = max(0,30, 1,2 * mpp)`**.

- **Largura nominal 0,30 m** (a divisa real) com **piso de 1,2 px**.
- Dentro de `larg`, os **40% de fora são LÁBIO `#D8D2C4`** e os **60% de dentro são SULCO
  `#5F5A4E`**. O par claro-escuro é o que faz o olho ler ranhura gravada em vez de linha
  pintada.
- Miolo: 3 tons, índice `(i + forma) % 3`, modulado pelo `hash01(i)` que já existe em
  `tecido.ts:67-73`: `#A8A296`, `#A39D91`, `#9E988C`.
- **Troca de contorno por tom:** rampa de alfa entre **4.900 m e 6.500 m** de distância da
  câmera. Antes de 4.900 o contorno tem alfa 1,0 e o miolo 0,62; depois de 6.500 o
  contorno tem alfa 0,0 e o miolo 1,0. O motivo é aritmético: a frente do lote mediano
  (12,5 m) mede 3,00 px a 4.884 m, e abaixo de 3 px uma borda de 1,2 px de cada lado come o
  lote inteiro.
- **DSC (34 lotes, `flags` bit0):** o contorno sai em ACENTO `#E8660D` com largura
  DOBRADA (`max(0,60, 2,4 px)`). Some o ciano `#7FD4E0` de `tecido.ts`.
- **Superquadra (D9):** lote contido no retângulo de outro lote do mesmo quarteirão desenha
  em **+0,06 m** em vez de +0,02. Log obrigatório: `141 lotes elevados sobre 7 superquadras`.

### 2.3 A conta do pixel (é ela que aprova ou reprova a largura)

`f = (900/2) / tan(21 graus) = 1.172,3 px` (fov 42 em `plaza-scene.tsx:594`, altura 900).
Largura aparente = `W * f / D`.

| o que | 300 m | 1.000 m | 3.000 m | 6.213 m | 12.000 m |
|---|---|---|---|---|---|
| linha de lote 0,30 m, SEM piso | 1,17 px | 0,35 px | 0,12 px | 0,06 px | 0,03 px |
| linha de lote COM piso de 1,2 px | **1,20** | **1,20** | **1,20** | 1,20 (alfa 0) | 1,20 (alfa 0) |
| frente do lote mediano 12,5 m | 48,85 | 14,65 | 4,88 | 2,36 | 1,22 |
| meio-fio 0,15 m | 0,59 | 0,18 | 0,06 | 0,03 | 0,01 |
| pista de contorno 3,5 m | 13,68 | 4,10 | 1,37 | 0,66 | 0,34 |
| bulevar 34 m | 132,86 | 39,86 | 13,29 | 6,42 | 3,32 |

**Piso de 2,0 px está proibido:** medido, não melhora contraste sobre 1,2 px e piora a
cintilação (7,41 contra 7,97). 1,2 px é o ponto.

### 2.4 O marco de esquina

- Marco de LOTE: **removido** (`tecido.ts:159-197`). Menos 635.808 triângulos, menos 1
  material.
- Marco de QUARTEIRÃO: `BoxGeometry(0,60, 1,20, 0,60)` com pivô no pé, **4.728 instâncias**
  (1.182 x 4 esquinas), cor MEDIO `#8F8879`, `roughness 0,95`, `castShadow: true`,
  1 `InstancedMesh`, 1 material, **56.736 triângulos**.
- Posição: a esquina do quarteirão, recuada 1,0 m para dentro nas duas direções locais,
  girada com o `giro` do quarteirão de `cidade-malha.json`.
- **Registro obrigatório no `DistanceCuller`** (`perf.ts:142-161`) **por quarteirão, com o
  centro do quarteirão** e `maxDist = 1.200`. ⚠️ `props.ts:98` registra com centro na
  ORIGEM e por isso mede a distância a partir da praça central; não copie esse erro.

### 2.5 Numeração

**Nenhuma.** Ver D5. O `?cota=1` (seção 6.4) carrega rótulo de quarteirão, quarto e setor,
e nunca de lote.

---

## 3. VIAS, módulo existente `app/city/plaza/vias.ts`

**Construtor 2.** A geometria está certa e **não se redesenha**: `vias.ts` mede hoje 1.182
quarteirões, 12 bulevares, 1.160,9 km de via e cerca de 202.314 triângulos em 4 malhas. As
duas máscaras (`emPeca` em `vias.ts:145-155` e `noBulevar` em `:161-173`) e o `PASSO = 18`
ficam como estão. O que muda é COR, FUSÃO e três peças novas.

### 3.1 Cotas: NÃO MUDAM

`Y_PISTA = 0,18`, `Y_CALCADA = 0,33`, `Y_CANTEIRO = 0,40`. Meio-fio = face vertical de
**0,15 m** entre pista e calçada, que é o meio-fio residencial universal dos EUA (6 in), o
único número de guia com fonte primária. Ver D1.

### 3.2 Cores

| alvo | hoje | novo | motivo |
|---|---|---|---|
| pista | `#57534B` | `#57534B` (fica) | é o valor mais escuro fora da água |
| calçada | `#CBC4B6` | `#CBC4B6` (fica) | é a teia |
| meio-fio | `#8F8879` | `#8F8879` (fica) | a guia é pedra, não sombra |
| canteiro | `#4A5C3E` (L 0,095) | **`#7E8A6B` (L 0,237)** | hoje está a 8 milésimos de L da pista e de cima o bulevar lê como três faixas escuras |

### 3.3 Fusão: 4 malhas viram 1

`pista`, `calcada`, `meiofio`, `canteiro`, `marca` passam a ser **cor por vértice** num
único `MeshStandardMaterial` (`vertexColors: true`, `roughness 0,95`, `metalness 0`).
**De 4 materiais e 4 draw calls para 1 e 1.** A partir daí acrescentar cor à rua deixa de
custar material.

### 3.4 Seções: NÃO MUDAM

- **Contorno 12 m**, cada quarteirão desenha só a sua metade de 6 m: calçada 0,0 a 2,5;
  pista 2,5 a 6,0. Leitura completa dos 12 m: calçada 2,5 / pista 7,0 / calçada 2,5.
- **Travessa 9 m**, seção inteira: calçada 1,5 / pista 6,0 / calçada 1,5.
- **Bulevar 34 m**: calçada 5,0 / pista 10,0 / canteiro 4,0 / pista 10,0 / calçada 5,0.
- **Anel da praça de quarto**: é a mesma via de contorno; a praça ocupa 168 m e a via de
  contorno já a circunda, com o limiar único `LIMIAR_PRACA = 0.5` exportado de
  `pracas.ts:79`. **Não invente seção nova para o anel da praça.**

### 3.5 TRAVESSIA ELEVADA (enxerto do oásis, aprovado por dois jurados)

Substitui faixa pintada nas bocas de rua do quarteirão. Uma barra de 0,50 m pintada mede
0,09 px na zenital e 0,21 px na aérea: em quatro das cinco chapas ela não existe.

- Onde: as **4 bocas** de cada quarteirão com lote (2 travessas x 2 pontas). 1.063
  quarteirões, **4.252 travessias**.
- Forma: platô de **6,0 m no sentido da via por 7,0 m de largura**, na cota `Y_CALCADA
  0,33`, cor CALÇADA `#CBC4B6`, com **rampa de 1,0 m** dos dois lados descendo até
  `Y_PISTA 0,18`.
- Custo: 12 triângulos por travessia (2 do platô, 4 das rampas, 4 das faces laterais, 2 de
  fecho), **51.024 triângulos**, tudo na malha única.
- Lê como mancha clara na esquina: 6 x 7 m mede 3,7 x 4,3 px na aérea de 1.899 m.

### 3.6 EIXO DE VIA: só nos 12 bulevares, e branco

- Onde: **só sobre o eixo do canteiro dos 12 bulevares**, de r 1.300 a r 4.400. **Nunca no
  contorno nem na travessa.** Pintar eixo em via local de 7,0 m dá a ela a linguagem de
  arterial e apaga a hierarquia bulevar > contorno > travessa que a malha construiu.
- Cor: **MARCA `#D8D2C4`** sobre a pista, 5,08:1. Ver D4.
- Largura **0,60 m** (quatro vezes a linha normal do MUTCD, porque isto é convenção de
  maquete e não tinta de trânsito). Altura `Y_PISTA + 0,02 m`.
- Tracejado 3 m de marca por 9 m de vão (MUTCD broken lane line, 10 ft por 30 ft).
- Contagem: 12 x 3.100 / 12 = 3.100 marcas, 2 triângulos cada, **6.200 triângulos**.
- ⚠️ **É geometria, não shader: não tem piso em pixel.** A 300 m mede 2,34 px, a 1.000 m
  mede 0,70 px. Ele existe para a vista de pedestre. **Registre cada bulevar no
  `DistanceCuller` com `maxDist = 900` e o centro no meio do raio**, senão ele cintila de
  longe sem entregar nada.

### 3.7 FAIXA DE PEDESTRE: só onde o bulevar cruza um contorno de quarto

- Onde: os cruzamentos de bulevar com via de contorno de quarto, **cerca de 144
  travessias** (12 bulevares x 12 quartos ao longo do raio). Marcação viária vira
  privilégio do bulevar.
- Forma: **6 barras de 0,60 m separadas por 1,80 m** (MUTCD: barra continental de 12 in
  mínimo e 24 in preferido, separação mínima de 6 ft), atravessando os 10,0 m de pista.
- Cor MARCA `#D8D2C4`, altura `Y_PISTA + 0,02 m`. **1.728 triângulos.**

### 3.8 O que NÃO entra

Sem eixo em contorno ou travessa. Sem faixa pintada em quarteirão. Sem numeração. Sem
mudança de cota. Sem canteiro novo.

---

## 4. VERDE, módulo novo `app/city/plaza/arborizacao.ts`

**Construtor 3.** Assinatura igual à dos outros:
`buildArborizacao({ heightAt, covas, profile, culler })` devolve
`{ group, arvores, triangulos, dispose }`. Recebe as `covas` de `buildPracas` (D8), então
sobe DEPOIS das praças, na mesma cadeia de promessa de `plaza-scene.tsx:1013-1024`.

### 4.1 Os dois modelos, UM material

| forma | geometria | triângulos | altura | copa | onde |
|---|---|---|---|---|---|
| **ESFERA** | `IcosahedronGeometry(2,6, 0)` achatada 0,82 em y, sobre `CylinderGeometry(0,18, 0,26, 3,4, 5)` sem tampa | 20 + 10 = **30** | **7,0 m** com jitter determinístico de +-0,9 m | 5,2 m de diâmetro | covas de praça, calçadas do bulevar, via de contorno |
| **CONE** | `ConeGeometry(2,4, 11,0, 6)` com pivô no pé | **12** | **11,0 m** com jitter +-1,2 m | 4,8 m de diâmetro | canteiro central dos 12 bulevares, e só ali |

- Uma `BufferGeometry` por forma, com **cor por vértice**: tronco `#6E685C`, copa
  `#7E8A6B`. **UM `MeshStandardMaterial`** (`vertexColors: true`, `roughness 0,95`,
  `metalness 0`) compartilhado pelas duas formas e pelos dois níveis de LOD: o three compila
  um programa só e cobra uma chamada por `InstancedMesh`.
- ⚠️ A copa NÃO desenha por valor: verde `#7E8A6B` contra calçada `#CBC4B6` dá 2,11:1 e
  contra lote `#A39D91` dá 1,43:1. **Ela desenha pela SOMBRA.** Com o sol a 32 graus (seção
  6) uma árvore de 7,0 m projeta **11,2 m**, que mede **2,11 px a 6.213 m** e **1,09 px a
  12.000 m**. É assim que fileira de árvore aparece numa aérea de verdade: uma tracejada
  escura ao lado da calçada. É por isso que a elevação do sol é 32 e não 16 nem 44.

### 4.2 Onde planta, com espaçamento de fonte primária

| lugar | forma | espaçamento | recuo | contagem |
|---|---|---|---|---|
| covas de `pracas.covas` | ESFERA | o que a praça mandou | centro da cova | **2.136** menos a máscara `emPeca` |
| canteiro dos 12 bulevares, fileira única sobre o eixo | **CONE** | **7,6 m** (Portland, 25 ft, faixas C, CC, D, DC, F, FU) | r 1.300 a 4.400 | **4.894** |
| calçadas dos 12 bulevares, duas fileiras | ESFERA | **7,6 m** | eixo a `t = 3,93 m` e `t = 30,07 m` da borda da seção, ou seja 1,07 m da face do meio-fio (Seattle, 3 ft 6 in) | **9.789** |
| via de contorno, **um lado por quarteirão** (o lado local +z) | ESFERA | **9,1 m** (Portland, 30 ft, faixas E, G, GU) | 1,07 m da face do meio-fio; **10,7 m de recuo da esquina** (NYC, 35 ft) | 1.063 x 17 = **18.071** |

**Total nominal 34.890 árvores**, menos as máscaras `emPeca` e `noBulevar`, que o módulo
tem de aplicar (as mesmas funções de `vias.ts`: rua não atravessa lago e árvore também
não). **Teto duro: 36.000 instâncias.** O módulo loga o plantado.

⚠️ **Um lado por quarteirão, não os dois, e isso é decisão, não economia.** Os dois lados
dariam 36.142 só no contorno e 52.961 no total. Plantio unilateral em rua estreita de 7,0 m
é padrão urbano real. E a referência é explícita: RJ Models entrega masterplan com
"entourage muito limitado".

**NÃO PLANTA:** nas travessas, no raio do Parque Runestone, e em nenhum lugar além de
r 4.400.

### 4.3 LOD, sem trocar material

- **Cheia** (30 ou 12 triângulos) até **400 m** da câmera.
- **Cruz** (3 quads cruzados, **6 triângulos**, que lê de qualquer ângulo; um disco plano
  some na rasante) além de 400 m.
- Dois `InstancedMesh` por forma, quatro no total, **4 draw calls, 1 material, 1 programa**.
- Densidade medida sobre 21,39 km2 de anel: 1,63 árvore por hectare. Um disco de 400 m tem
  50,3 ha, ou seja cerca de **82 árvores cheias** (2.460 triângulos) e **34.808 cruzes**
  (208.848 triângulos). **Pior caso 211.308 triângulos. Teto: 260.000.**
- ⚠️ **O rebalanceamento entre os dois baldes por quadro NÃO ESTÁ MEDIDO** e é a medição
  número um antes de bater o martelo. A referência que existe é de balde estático: 120.000
  cruzes de 8 triângulos custam 2,3 ms. Se o rebalanceamento passar de 1,0 ms por quadro,
  troque por baldes fixos por quarteirão, refeitos só quando a câmera anda mais de 120 m.
- Registro no `DistanceCuller` **por quarteirão e por bulevar, com o centro de cada um**,
  `maxDist` = `profile.smallCull` (3.400 no high) para a cruz e 900 para a cheia.

### 4.4 Gramado, parque e reserva

- **Um verde só na cidade inteira**, `#7E8A6B`. Ver 1.2.
- **As 119 reservas.** `cidade-malha.json` traz 1.182 quarteirões e **1.063 com lote**: 119
  quarteirões estão vazios e hoje são buraco preto na chapa. Eles recebem chão VERDE na
  cota `Y_CALCADA 0,33`, com o mesmo passo de 18 m, desenhados por `pracas.ts` como uma
  **quinta tipologia chamada `reserva`**, e entram na legenda da prancha 2D com o nome
  **"reserva pública, não alocada até o mint"**. Terra sem dono é reserva nomeada, não
  buraco. Custo: 119 x 81 quads = **19.278 triângulos**.
- **Parque Runestone: não se toca.** Ele tem paleta própria de obsidiana, 345.651 a 416.839
  triângulos medidos e 7 luzes, e fica a 5,2 km a nordeste. ⚠️ E cuidado com ele: a cova do
  parque (`terrain.ts:167-181`, `PARK_CORE 3.100`) rebaixa o terreno a **-144,86 m** em todo
  o raio de 3.100 m em volta de `PARK_CENTER (3546, -3802)`, o que engole boa parte dos
  setores 1 e 2. É por isso que `cidade.json` publica capacidade de 44,1 e 15,8 ha nesses
  dois setores contra 250 a 291 nos outros. **Nenhuma câmera desta spec entra nesse raio**,
  e nenhuma vista nova deve entrar.

---

## 5. PEÇAS, `app/city/plaza/pecas.ts` e `app/city/plaza/pracas.ts`

**Construtor 4.** As 38 peças (15 distribuição, 12 cívico, 5 esporte, 4 jardim, 2 água)
mantêm a TIPOLOGIA que `pecas.ts:115-216` já desenha. **Não mexa em forma. Mexa em
MATERIAL, COTA e MOLDURA.**

### 5.1 As 12 cores viram 4 famílias mais 2 exceções

`pecas.ts:32-36` tem hoje: `agua, praia, grama, sebe, pista, campo, arquibancada, concreto,
asfalto, conteiner, galpao, adro`. Mapeamento novo:

| família | hex | absorve |
|---|---|---|
| CLARO | `#CBC4B6` | `arquibancada`, `concreto`, `adro`, `praia` |
| MEDIO | `#8F8879` | `galpao`, `conteiner` |
| ESCURO | `#57534B` | `asfalto` |
| VERDE | `#7E8A6B` | `grama`, `campo`, `sebe` |
| ÁGUA (exceção) | `#16283C` | `agua` |
| TERRACOTA (exceção) | `#8C4B3A` | `pista` (só E01) |

**De 12 malhas fundidas por cor para 6.** A praia deixa de existir como cor própria: em
maquete a praia é o mesmo material da calçada. O contêiner sai de `#7C6A55` (L 0,152) e o
galpão de `#A9A092` (L 0,357) para o mesmo `#8F8879` (L 0,248): os 15 pátios logísticos
param de brilhar mais que o loteamento, que é a queixa medida do jurado de cena.

### 5.2 A peça vira ALVÉOLA, nas cotas de hoje

Hoje toda chapa de peça flutua em `heightAt + 0,4 m` e por isso lê como adesivo.

- O piso da peça assenta em `heightAt + Y_PISTA (0,18 m)`, ou seja **no nível da pista**.
- Em volta, uma **moldura de calçada de 4,0 m** na cota `Y_CALCADA (0,33 m)`, cor CLARO,
  com **face vertical de 0,15 m** (o mesmo meio-fio da rua) fazendo sombra na borda inteira.
- Para as **2 peças de água** a moldura segue os **64 pontos de `margem()`**
  (`pecas.ts:90-103`), não quatro lados: 128 quads por lago.
- Custo: 36 peças x 4 lados x (2 do topo + 2 da face) = 576 triângulos, mais 2 x 256 = 512
  dos lagos. **1.088 triângulos.**

### 5.3 A água

`roughness 0,08`, `metalness 0,35`, cor `#16283C`. Fundo do lago 1,4 m abaixo, mesma cor,
para a lâmina ter profundidade. Ver D10 para o que ela reflete e para a proibição do
Reflector.

### 5.4 Os volumes continuam sem fachada

Ginásio 16 m, galpão central 11 m, galpão de pátio 14 m, contêiner 2,6 / 5,2 / 7,8 m,
cívico 10 a 28 m. **Nenhuma altura muda.** Isto é obra pública do plano, não prédio de
carteira, e um plano de massas de escritório mostra obra pública assim. O que muda é a cor
e o fato de que agora eles lançam sombra de verdade, porque o `normalBias` cai de 1,2 para
0,15 (seção 6.2).

### 5.5 `pracas.ts`: só cor e uma tipologia nova

Contagem conferida: **128 praças** (38 parterre, 42 seca, 34 verde, 14 água) e **2.136
covas** antes da máscara.

| constante | hoje | novo |
|---|---|---|
| `COR_PISO` `pracas.ts:60` | `#C6BFB1` | `#CBC4B6` |
| `COR_GRAMA` `:61` | `#3E5F42` | `#7E8A6B` |
| `COR_SEBE` `:62` | `#2F4A34` | `#7E8A6B` |
| `COR_AGUA` `:63` | `#1E3A52` | `#16283C` |
| `COR_PEDRA` `:64` | `#B4AC9E` | `#CBC4B6` |
| `COR_COVA` `:65` | `#6B5F4E` | `#57534B` |

Sebe e mureta continuam sendo volume instanciado; agora se distinguem do chão por SOMBRA e
não por cor. Contagem de materiais do módulo: **6 hoje, 6 depois. Zero material novo.**

Mais a **quinta tipologia `reserva`** (seção 4.4): piso VERDE de 168 m em `Y_BASE 0,33`
nos 119 quarteirões sem lote, sem cova e sem volume.

### 5.6 O que NÃO fazer

Não acrescente peça nova. Não mexa em `scripts/gerar_cidade.py`. Não toque no Coliseu
(congelado por decisão do fundador). Não invente elipse: elipse não é projeto, e as
tipologias que existem já foram aprovadas.

---

## 6. LUZ E CÂMERA, `app/city/plaza/plaza-scene.tsx`

**Construtor 5.**

### 6.1 O perfil `maquete`

Entra em `HOURS` (`plaza-scene.tsx:700-718`), ao lado de `day`, `morning` e `earthlight`.
O tipo `Hour` ganha um campo `hemiGround`, e `day`/`morning`/`earthlight` recebem
`hemiGround: 0x1a1712` para não mudarem de aparência.

```ts
      // A hora da maquete: a chapa de apresentação do loteamento sem prédios.
      // ⚠️ 32 GRAUS É O NÚMERO QUE DECIDE A CHAPA INTEIRA, e ele sai de duas contas.
      // (1) O assunto é o CHÃO, e o chão recebe pelo SENO da elevação: 0,276 a 16
      // graus (a morning), 0,530 a 32, 0,695 a 44. A 16 graus a chapa medida hoje
      // deu média 61,6 e 0,1% de pixel acima de 184, ou seja sem alta luz nenhuma.
      // (2) A árvore de 7 m projeta 11,2 m a 32 graus, que mede 2,11 px a 6.213 m:
      // a fileira vira tracejada escura no drone, e é o ÚNICO jeito de o
      // alinhamento existir naquela distância. A 44 graus ela projeta 7,25 m e
      // some; a 16 graus projeta 24,41 m e as sombras se emendam numa mancha.
      // ⚠️ hemiGround 0x2e2a22 (L 0,043) no lugar de 0x1a1712 (L 0,015): é o rebote
      // do chão, e é ele que hoje joga 48,1% da imagem abaixo de L8 40 (medido por
      // mim em /tmp/.../dir-tecido.png, 1440x900, view=tecido, hour=morning).
      // Custa zero triângulo e zero material.
      maquete: {
        el: 32, sun: 4.8, sunColor: 0xfff4e2,
        hemi: 1.20, hemiGround: 0x2e2a22, earth: 0.30, exposure: 1.02,
      },
```

- **Azimute do sol: 306 graus. NÃO MUDA.** `plaza-scene.tsx:690`. É o enquadramento já
  aprovado; trocar azimute reembaralha todas as vistas da cena.
- **Razão sol sobre preenchimento: 4,8 / 1,20 = 4,0:1.** A fotografia de estúdio chama 3:1
  de padrão e 8:1 de dramático. A cena tinha 39:1 antes de 29/08, o que é erro nomeado nos
  guias, e foi corrigida para perto de 4:1 na `morning`. A convenção é DUAS fontes, uma
  direta fazendo de sol e uma indireta de preenchimento, **nunca duas diretas**.
- `HemisphereLight` em `plaza-scene.tsx:770` passa a ler `H.hemiGround` em vez do
  `0x1a1712` fixo.
- **Fundo `#000000`**, que já é o que a cena tem. Na hora `maquete`, `Stars` recebe
  `visible = false`: maquete em sala escura não tem céu, tem preto, e estrela em chapa de
  apresentação é ruído. A Terra fica (`earth: 0.30`), porque ela é a segunda fonte indireta
  e é o que a água reflete (D10).
- ⚠️ **`exposure: 1.02` é conta, não medida.** Sai da diferença de diafragma entre
  `sen(32) x 4,8` e `sen(16) x 4,2` da `morning`. **Uma chapa fecha.** Alvo mensurável na
  seção 9, critério 1. Se estourar, desça para 0,96 antes de mexer em qualquer cor.

### 6.2 Sombra: dois consertos e um degrau novo

```ts
    sun.shadow.bias = -0.0004        // era -0.0006
    sun.shadow.normalBias = 0.15     // ⚠️ era 1.2, e 1.2 APAGAVA 97% DA SOMBRA
```

⚠️ **`plaza-scene.tsx:736` tem `normalBias = 1.2`, que é maior que a sombra inteira que
o loteamento produz.** Medido na vista de quarteirão a 265 m, contando pixels que mudam ao
ligar a sombra: `normalBias 0` dá 0,34%, `0,05` dá 0,30%, `0,2` dá 0,18%, `0,5` dá 0,06% e
`1,2` dá **0,01%**. Trinta e quatro vezes menos sombra. Com 1,2 nem o meio-fio de 0,15 m nem
a árvore nova projetam coisa alguma, e a sombra é a única coisa que faz o alinhamento
existir na vista aérea. **Este é o conserto mais barato e mais caro de esquecer da rodada.**

**Quarto degrau na caixa de sombra**, em `followShadow()` (`plaza-scene.tsx:748-750`):

```ts
      const half = dist < 1500 ? 1000 : dist < 3500 ? 1800 : dist < 8000 ? 3200 : 4600
```

Motivo: a vista `maqueteplano` fica a 12.000 m e o sítio tem 9.000 m de diâmetro; com
meio-lado 3.200 a sombra cobre 6.400 m e o anel externo perde a sombra da árvore, o que
aparece na chapa como a arborização parando num círculo. Com 4.600 e mapa 2048 o texel é
4,49 m e o custo medido é 2,55 ms.

**Mapa de sombra: 2048** (o `profile.shadowMapSize` do perfil high, `perf.ts:73`). Quatro
vezes a resolução custa 1,75 ms e devolve borrão.

**Cascatas (CSM): NÃO por padrão.** `node_modules/three/examples/jsm/csm/CSM.js` existe e
o custo de render está medido (0,86 ms por cascata no loteamento). O problema não é o
milissegundo: a cena tem 228 programas compilados na vista de topo e **cada luz direcional
com sombra a mais recompila todos eles no boot**, e esse tempo NÃO ESTÁ MEDIDO. Fica atrás
de `?csm=1`, para experimento, e nunca no caminho de navegação.

### 6.3 Antialias e pós-processamento

**MSAA 4x de hardware, que já está ligado** (`gl.getParameter(gl.SAMPLES)` devolve 4 na GTX
1650 com `antialias: true`). **FXAA está PROIBIDO:** medido, ganho máximo de 12% de
cintilação numa vista e PERDA de 6% na outra, por 1,9 a 2,5 ms, mais caro que o loteamento
inteiro. **Nenhum pós-processamento.** Uma prancha não tem bloom. O que reduz cintilação
aqui é o alfa do próprio shader da linha (seção 2.2).

### 6.4 A camada `?cota=1`, desligada por padrão

Módulo opcional, fora do caminho de navegação, fora das chapas de apresentação. É o que faz
alguém dizer "isto é folha de escritório", e é por isso que ele existe; é também
diagnóstico virando apresentação, e é por isso que ele fica atrás de flag.

- **Atlas de glifos** gerado no boot com canvas 2d, sem arquivo e sem fetch: 1024 x 256,
  células de 64, 16 x 4 = 64 glifos (0 a 9, A a Z, hífen, ponto, espaço), canal R8, 256 KB.
- **226 cotas de quarto** (haste de 540 m com dois ticks, número "540" com 24 m de altura),
  **12 cotas de quarteirão típico** ("168 TIP."), **38 cotas de peça** no eixo maior.
- **Rótulos:** "B001" com 6 m (1.182), "Q03" com 18 m (226), "SETOR 01" com 110 m deitado no
  bulevar (12). **Nenhum rótulo de lote.**
- Cor ACENTO `#E8660D` para haste e tick; MARCA `#D8D2C4` para glifo sobre pista.
- 2 `ShaderMaterial` novos, 1 textura nova, cerca de 828 quads mais 2.100 caracteres. Tudo
  isso é **zero** nas quatro chapas de apresentação.

### 6.5 AS CINCO VISTAS, coláveis em `viewFor()` (`plaza-scene.tsx:160-380`)

Todas com `?tecido=1&plate=1&hour=maquete&quality=high`. As alturas de terreno abaixo foram
calculadas replicando `rawAt`/`siteAt`/`heightAt`/`superficieAt` de `terrain.ts` em python
sobre `public/lunar/btc-core-heightmap.f32`; a replicação foi conferida contra medições de
navegador de outra frente e bate no centavo. **Mesmo assim confira com `?stats=1` e
`window.__plazaView()` depois que o terreno carregar: altura absoluta abaixo do chão é
descartada pelo laço.**

```ts
    // ── as cinco chapas da maquete (?hour=maquete&plate=1) ───────────────────
    // 1. A PRANCHA. Zenital sobre o sítio inteiro. O z=1 existe só para o
    // up-vector não degenerar. Com fov 42 em 1440x900, 12.000 m cobrem 9.213 m
    // na vertical e 14.740 na horizontal: o sítio de 9.000 entra com folga.
    // PROVA: que existe um PLANO. O lote mede 1,22 px de frente e roda em modo
    // TOM (o contorno já sumiu na rampa de 4.900 a 6.500 m); o que desenha é a
    // teia viária, os 12 raios de bulevar, as 128 praças e as 119 reservas.
    // Se sobrar buraco preto dentro de r 4.400, a chapa reprova.
    case 'maqueteplano':
      return { pos: new THREE.Vector3(0, 12000, 1), target: new THREE.Vector3(0, 0, 0) }

    // 2. A AÉREA DE VENDA. Quarto S05-Q03 (praça inteira livre, 8 quarteirões
    // com lote, terreno +1,03 m), a 1.899 m, elevação 38 graus (a banda de 30 a
    // 45 que é consenso de aérea). Câmera a sudoeste com o sol vindo de noroeste
    // (az 306): 81 graus entre os dois, luz raspando de três quartos, que é como
    // se fotografa maquete. A praça central aparece ao fundo.
    // PROVA: a linha de lote lendo a 1.400 a 2.000 m, a teia branca contínua, o
    // par calçada/lote de 1,55:1 e a tracejada de sombra da arborização.
    case 'maqueteaerea':
      return { pos: new THREE.Vector3(444, 1171, 2237), target: new THREE.Vector3(1502, 1, 1179) }

    // 3. O QUARTEIRÃO. S05-Q03-B002 (1.346, 1.089), 115 lotes, giro 30 graus,
    // terreno +1,03 m. Distância 339 m, elevação 23,6 graus.
    // PROVA: o par lábio/sulco (4,56:1), o piso de 1,2 px entrando em ação (a
    // linha de 0,30 m mediria 1,04 px aqui), a seção calçada/guia/pista, a
    // travessia elevada na boca de rua, o marco de quarteirão e a SOMBRA. É a
    // vista onde se mede o conserto do normalBias.
    case 'maquetequarteirao':
      return { pos: new THREE.Vector3(1126, 139, 1309), target: new THREE.Vector3(1346, 3, 1089) }

    // 4. O PEDESTRE. De pé no BUL04 (rumo 90 graus, corre no +x, z=0) a 1,70 m
    // do chão, olhando para fora. 1,70 m é a altura de olho que os guias de
    // visualização fixam (160 a 170 cm).
    // ⚠️ A COTA É MEDIDA, NÃO CHUTADA. O perfil do terreno no eixo tem uma crista
    // em x=2.300 (-14,16 m) mais alta que o ponto em x=1.900 (-16,39 m): uma
    // câmera em 1.900 olhando para 3.400 tem a linha de visão CORTADA pelo chão
    // em 2.300. Por isso a câmera fica em x=1.500 (terreno -10,93, olho -9,23) e
    // o alvo em x=4.400 com y=-12,0, uma inclinação de 0,055 grau: a linha passa
    // 4,2 m acima da crista.
    // PROVA: alinhamento. As três fileiras do bulevar (canteiro mais duas
    // calçadas) convergem para o ponto de fuga e qualquer árvore fora do prumo
    // aparece. Prova também a seção de 34 m e o eixo tracejado branco.
    case 'maquetepedestre':
      return { pos: new THREE.Vector3(1500, -9.2, 0), target: new THREE.Vector3(4400, -12, 0) }

    // 5. O PROGRAMA. Lago Maior (A01, 21,36 ha), Jardim Botânico (A03) e Estádio
    // Olímpico (E01) num quadro só. Distância 1.600 m, elevação 34 graus, câmera
    // a SUDESTE do lago: com o sol em azimute 306 (noroeste) isso é CONTRALUZ, e
    // é de propósito, porque é o que traz o realce especular da água para a
    // lente.
    // PROVA: que a peça deixou de ser adesivo. A moldura de 4,0 m com face de
    // 0,15 m, a água escura de acrílico contra a calçada (8,63:1), a
    // arquibancada em anel escalonado lida como CLARO e não como cor própria, e
    // o verde único do campo, do jardim e da ilha.
    case 'maqueteparque':
      return { pos: new THREE.Vector3(-1312, 926, 1118), target: new THREE.Vector3(-2250, 25, 180) }
```

Comando de chapa, com browser próprio, uma de cada vez (três em paralelo estouram a GPU
compartilhada com os outros agentes):

```
npx playwright screenshot \
  --viewport-size=1440,900 --wait-for-timeout=28000 \
  "http://localhost:3000/city?tecido=1&plate=1&hour=maquete&quality=high&view=maqueteaerea" \
  <saida>.png
```

⚠️ **Em desenvolvimento sobra na chapa o botão redondo "N" do Next.js Dev Tools**
(`nextjs-portal`, 32 x 32 px em x 22 y 846). `?plate=1` não o esconde porque não é React da
cena. Ele não existe em produção. **Recortar antes de mostrar para alguém.**

⚠️ **Nunca rode `next build`:** ele derruba o dev server que está de pé em localhost:3000.
Nunca reinicie o dev server: ele tem HMR, salvar o arquivo basta.

---

## 7. PRANCHA 2D, `app/city/plan/cidade/cidade-client.tsx`

**Construtor 6.** Hoje a prancha é um mapa de pontos coloridos sobre `#0A0A0A`
(`cidade-client.tsx:100`), com quatro lentes (`idade`, `setor`, `familia`, `forma`) e as
paletas de diagnóstico `CORES_COORTE` e `CORES_FORMA` (`:47-48`). **Isso é chapa de
diagnóstico e continua existindo como lente.** O que falta é a folha.

### 7.1 Uma lente nova, `figura-fundo`, e ela vira o padrão

- Fundo da folha: `#0A0A0A` (fica).
- **Pegada real, não ponto.** Cada lote desenha o RETÂNGULO de `frente_m` por `prof_m` de
  `cidade-lotes.bin`, girado por `-setor * 7,5` graus, preenchido em `#A39D91`, sem
  contorno. Abaixo de 2 px de frente, preenche sem antialias (o `imageSmoothingEnabled` do
  canvas fica `false` nessa lente) para o campo não virar cinza chapado.
- **O vazio é branco de calçada.** As vias de contorno, travessas e bulevares desenham em
  `#CBC4B6` com a largura real em escala; as 128 praças e as 119 reservas em `#7E8A6B`; as
  38 peças na cor da família (5.1); a água em `#16283C`.
- Nada de `CORES_PROG` (`:43`) nesta lente: aquelas cinco cores saturadas são de
  diagnóstico.

### 7.2 O que a folha tem de ter, com medida

| elemento | especificação |
|---|---|
| **Título** | "DOGCITY / LOTEAMENTO" em caixa alta, 18 px, `#CBC4B6`, canto superior esquerdo, margem 32 px |
| **Subtítulo** | "MARE TRANQUILLITATIS . 52.984 LOTES . 21,39 km2" em 11 px, `#8F8879` |
| **Número de folha** | "FOLHA 01 / PLANO DE PARCELAMENTO . REV. A . 29.08.2026" em 10 px, `#8F8879`, canto inferior direito |
| **Norte** | seta de 40 px no canto superior direito, haste `#CBC4B6` de 1,5 px, letra N de 12 px. O norte da cena é `-z` |
| **Escala gráfica** | barra de 5 segmentos alternando `#CBC4B6` e `#57534B`, altura 6 px, comprimento correspondente a 1.000 m na escala corrente, com "0" e "1 km" em 10 px; recalcula com o `zoom` |
| **Legenda** | canto inferior esquerdo, 7 verbetes, quadrado de 10 px mais texto de 10 px: LOTE, VIA, PRAÇA, RESERVA PÚBLICA (não alocada até o mint), PROGRAMA, ÁGUA, DSC |
| **Moldura** | retângulo de 1 px em `#3F3D3A` a 24 px da borda do canvas |

### 7.3 O que NÃO entra

Sem número de lote. Sem cota (a cota é da cena, atrás de `?cota=1`). Sem `#E8660D` fora do
verbete DSC da legenda.

---

## 8. ORÇAMENTO

### 8.1 Materiais novos, por módulo (o limite real desta cena é MATERIAL e PROGRAMA)

| módulo | materiais hoje | teto novo | saldo |
|---|---|---|---|
| `lotes.ts` (novo) | 0 | **2** (1 ShaderMaterial do lote, 1 MeshStandard do marco de quarteirão) | +2 |
| `tecido.ts` | 2 (plinto, marco de lote) | **0** no modo lote | -2 |
| `vias.ts` | 4 | **1** (vertexColors) | -3 |
| `arborizacao.ts` (novo) | 0 | **1** (vertexColors, 2 formas x 2 LOD) | +1 |
| `pecas.ts` | 12 | **6** | -6 |
| `pracas.ts` | 6 | **6** | 0 |
| `?cota=1` (fora do padrão) | 0 | 2 | +2, e **0 nas chapas de apresentação** |
| **saldo no caminho padrão** | | | **-8** |

**Programas de shader:** 228 na vista de topo hoje. Cada `ShaderMaterial` novo gera o
programa base mais a variante de depth. Teto: **235**. ⚠️ Não acrescente luz direcional com
sombra: cada uma recompila todos eles no boot. É por isso que CSM está atrás de flag.

**Texturas:** 35 hoje, 35 depois no caminho padrão (o atlas de glifos é da camada `?cota=1`).

### 8.2 Instâncias e triângulos, por módulo

| módulo | instâncias | triângulos | draw calls |
|---|---|---|---|
| `lotes.ts` quad SDF | 52.984 | 105.968 | 1 |
| `lotes.ts` marco de quarteirão | 4.728 | 56.736 | 1 |
| `vias.ts` (existente + 3 peças novas) | - | ~261.300 | 1 |
| `arborizacao.ts` | <= 36.000 | <= 260.000 | 4 |
| `pecas.ts` (existente + moldura) | - | ~10.400 | 6 |
| `pracas.ts` (existente + 119 reservas) | ~1.500 volumes | ~19.300 a mais | 6 |
| **SAI** | | **-1.271.616** (plinto 635.808 + marco de lote 635.808) | -2 |

**Líquido: cerca de -790.000 triângulos.** A vista de topo cai de 1.575.495 medidos hoje
para cerca de **785.000**. Draw calls: de 373 para cerca de **377**, o que numa GTX 1650 é
folga e não gargalo.

**Memória nova:** 848 KB do `iAlt`, cerca de 3,5 MB de matrizes de árvore, menos os 5,1 MB
das matrizes dos dois `InstancedMesh` removidos. **Líquido negativo.**

**Montagem na CPU, uma vez, no boot:** quad com quinas 198 a 229 ms (medido), árvores cerca
de 110 ms, vias com vertexColors na mesma ordem de hoje. O tecido já entra em promessa
solta depois do terreno (`plaza-scene.tsx:975-1024`) e não participa do portão de boot,
então isso não segura a praça.

### 8.3 FPS alvo

| caso | hoje | alvo |
|---|---|---|
| perfil high, DPR 1, `maqueteplano` e `maqueteaerea` | 60 (teto do vsync) | **>= 40, e o esperado é continuar em 60** |
| perfil high, DPR 1, `maquetequarteirao` e `maquetepedestre` | 60 (teto do vsync) | **>= 40** |
| perfil high, **DPR 2**, `maquetequarteirao` | 26,8 medidos na rasante equivalente | **>= 32** (ESTIMATIVA, NAO MEDIDO; é a medição que fecha a rodada) |

⚠️ `perf.ts:72` dá `minPixelRatio: 1.5` ao perfil high, ou seja num monitor 2x a cena roda
a DPR 2 e o `FrameGovernor` só degrada até 1,5. **DPR 2 é o caso que aperta, e é onde a
remoção de 1,27 milhão de triângulos de caixa que LANÇAM SOMBRA paga.**

### 8.4 O que está descartado por aritmética, para ninguém tentar de novo

- **Decal no terreno:** `DecalGeometry` custa 30,03 ms POR decal (varre os 61.952 triângulos
  da grade do sítio). Para 52.984 lotes: 26,5 minutos de CPU.
- **Atlas de textura para a linha:** uma linha de 0,25 m com 2 texels sobre um sítio de
  8.800 m pede 35.200 x 35.200 texels, 1,24 giga texel.
- **Oclusão de ambiente assada no `instanceColor`:** custa 58,1 ms de CPU e ZERO de render,
  e muda **1,13 nível em 255** (0,44%). Não é onde esta imagem se resolve. **A sombra é:**
  ligá-la muda de 20 a 38% dos pixels e custa 2,3 a 2,4 ms.
- **`Reflector` na água:** um passe de cena inteiro por lago.

---

## 9. CRITÉRIOS DE APROVAÇÃO

Todos medíveis OLHANDO a chapa, com PIL, sobre PNG de 1440x900 com `?plate=1` e o botão "N"
do Next recortado. **A linha "hoje" foi medida por mim em 29/08/2026 sobre
`/city?tecido=1&plate=1&hour=morning&quality=high&view=tecido`, arquivo
`dir-tecido.png`.** Um critério com o número fora da banda reprova a chapa.

| # | critério | chapa | como medir | aprova em | hoje |
|---|---|---|---|---|---|
| 1 | **A imagem tem três valores, não dois** | `maqueteaerea` | histograma de luminância L8 da imagem inteira | pixels **< 40: <= 35%**; **meio-tom 60 a 140: >= 45%**; **> 184: entre 0,5% e 6,0%** | 48,1% / 35,9% / 0,1% |
| 2 | **Sem estouro** | `maqueteaerea` | fração de pixels em 255 | **<= 0,3%** | NAO MEDIDO |
| 3 | **O campo de lotes não é cascalho** | `maqueteaerea` | contraste local (média de \|I(x)-I(x+1)\|) num recorte de 500x500 px sobre tecido puro, sem via nem peça | **entre 8,0 e 14,0**. Acima de 16 é grão, abaixo de 6 o lote sumiu | 18,81 |
| 4 | **A linha de lote existe a 1.000 m** | `maqueteaerea` | desvio padrão de L8 dentro de um quarteirão de 168 m em primeiro plano | **entre 10 e 22** | NAO MEDIDO |
| 5 | **A linha de lote existe de perto e tem o piso** | `maquetequarteirao` | perfil transversal de L8 cruzando 10 divisas; medir a largura a meia altura | **entre 1,2 e 2,8 px**, e cada perfil tem que mostrar o par claro-escuro (lábio antes do sulco) | NAO MEDIDO |
| 6 | **A teia viária é contínua** | `maqueteplano` | ao longo de cada um dos 12 raios de bulevar, procurar vão sem pixel de L8 > 110 | **nenhum vão maior que 40 px** nos 12 | NAO MEDIDO |
| 7 | **Não há buraco preto dentro do sítio** | `maqueteplano` | fração de pixels com L8 < 25 dentro do anel r 1.300 a 4.400 | **<= 2,0%** | NAO MEDIDO |
| 8 | **A sombra voltou** | `maquetequarteirao` | duas chapas, uma com `&sombra=0`, contar pixels que mudam mais de 4 níveis | **>= 8,0%** (com o `normalBias 1,2` de hoje mede 0,01%) | 0,01% |
| 9 | **A arborização lê pela sombra** | `maqueteaerea` | perfil de L8 ao longo de 500 px do canteiro de um bulevar | **>= 30 mínimos locais**, período entre 8 e 16 px | inexistente |
| 10 | **Um verde só** | as 4 chapas de apresentação | histograma de matiz HSV dos pixels com S > 0,18 | **no máximo 2 famílias de matiz** (verde em 83 +-8 e terracota em 12 +-8) | 4 verdes |
| 11 | **Nada saturado fora das exceções** | as 4 chapas | fração de pixels com S(HSV) > 0,35 fora dos 2 lagos, das 14 praças de água, das 3 piscinas e da pista de E01 | **0,0%**; e **>= 99,0% da cidade com S <= 0,25** | NAO MEDIDO |
| 12 | **Zero acento na apresentação** | as 4 chapas, sem `?cota` | pixels com matiz 15 a 35 e S > 0,5 | **0 pixels**, salvo os 34 lotes DSC quando estiverem em quadro, e aí **<= 0,05%** | NAO MEDIDO |
| 13 | **A peça deixou de ser adesivo** | `maqueteparque` | procurar a face vertical de 0,15 m da moldura na borda das 3 peças em quadro | **as 3 peças têm borda com sombra própria visível em pelo menos 60% do perímetro em quadro** | 0 de 3 |
| 14 | **A água é acrílico, não poça** | `maqueteparque` | L8 médio da lâmina do Lago Maior contra L8 médio da moldura | **razão >= 6,0:1** | NAO MEDIDO |
| 15 | **Nada pisca** | `maquetequarteirao` | dois quadros consecutivos com a câmera parada | **<= 0,2% dos pixels mudam** (é o teste das 7 superquadras e das faces coplanares) | NAO MEDIDO |
| 16 | **Alinhamento perfeito** | `maquetepedestre` | as três fileiras de árvore do bulevar | **cada fileira converge para um ponto único; nenhum tronco a mais de 2 px do eixo da fileira** | inexistente |
| 17 | **O custo fecha** | `maqueteaerea` com `?stats=1` | `window.__plazaStats` | triângulos **<= 900.000**; draw calls **<= 380**; programas **<= 235**; fps **>= 40** a DPR 1 | 1.575.495 / 373 / 228 / 60 |
| 18 | **O log não mente** | console do boot | as quatro linhas | `[lotes]` diz 52.984 e **141 lotes elevados sobre 7 superquadras**; `[vias]` diz 1.182 quarteirões e 12 bulevares; `[praças]` diz **128 praças** e **119 reservas**; `[arborização]` diz **<= 36.000** | `[tecido]` publica metade da verdade (`tecido.ts:246` esquece os marcos) |

---

## 10. ORDEM DE TRABALHO E ARMADILHAS COMUNS

**Ordem:** `lotes.ts` e `vias.ts` são independentes e podem começar juntos. `pracas.ts`
(reservas e cores) tem de terminar antes de `arborizacao.ts`, que consome as covas.
`plaza-scene.tsx` (luz, sombra, vistas) pode começar imediatamente e é o único caminho para
qualquer chapa. `pecas.ts` e a prancha 2D são independentes de tudo.

**Armadilhas que já custaram rodada e valem para todo mundo:**

1. **Nada de `planarAt` novo.** Use o `heightAt` que a cena passa, que já é
   `terrain.superficieAt` (D2).
2. **Nada de `polygonOffset`.** `logarithmicDepthBuffer` o torna inerte (2.1).
3. **`ShaderMaterial` com os seis includes**, nunca `RawShaderMaterial` (2.1).
4. **Os quatro cantos de todo quad no sentido anti-horário visto de cima**, senão a normal
   aponta para baixo e o backface culling apaga a face inteira. Custou uma rodada inteira em
   `pracas.ts`; a nota está em `pracas.ts:101-107`.
5. **Passo <= 18 m em qualquer chão novo.** O erro de corda cai com o quadrado do vão, e com
   42 m o terreno fura o piso (medido em `vias.ts:172-186` e `pracas.ts:158-165`).
6. **Registre no `DistanceCuller` com o CENTRO do objeto**, não com a origem
   (`props.ts:98` erra isso e mede a distância a partir da praça central).
7. **O bot de auto-commit varre trabalho em andamento** e já empurrou estado parcial de
   `gerar_cidade.py` e do `.bin` para `origin/main` com 27 segundos de intervalo. Commite
   cedo e commite pequeno.
8. **A semente se mexe:** `cidade.json` publica 52.984 hoje e uma regeração com as entradas
   atuais dá outro número. Junte com `cidade-malha.json` **por id**, nunca por índice cego.
9. **Dois números errados no repo, para ninguém se perder conferindo:** o cabeçalho de
   `terrain.ts:4` diz grade de 137x137 e ela é **177x177** (`btc-core-heightmap.json`, cols
   177, cellSizeM 59,2252938); e o contador de `tecido.ts:246` esquece os marcos, então o
   console loga cerca de 647 mil triângulos onde o grupo mede 1.283.283. Com esta rodada o
   segundo desaparece sozinho, mas quem comparar log antigo com log novo vai achar que
   sumiu metade da cidade.
