# A Pedra · a arena poliesportiva coberta da DogCity

Decidida pelo fundador em 06/09/2026, logo depois do `$DOG ARENA`: *"a arena
poliesportiva coberta. Será ela a próxima. Precisamos de algo realmente
interessante. Arquitetura futurística."*

Fechada modelada no mesmo dia. Este documento é o plano, o número medido e a
lista de armadilhas que a peça pagou.

---

## 1. A decisão de conceito

⚠️ **Ela não podia ser um estádio menor.** O `$DOG ARENA` já ocupou o vocabulário
da casa: pele de lâminas de metal, bacia aberta, letreiro de LED em fita. Repetir
isso numa arena de 12 mil lugares dá duas peças irmãs e nenhuma identidade, e o
que a cidade ganha de marketing com a segunda é quase zero.

O conceito escolhido é outro: **a arena É UM RUNESTONE COLOSSAL.** Um monólito de
obsidiana facetado, do tamanho de um edifício.

Isso não é metáfora solta. A marca do projeto já é essa pedra: o Parque Runestone
a 9,8 km da praça é feito dela (`blender/build_runestone_park_v2.py`), com a
mesma obsidiana escura. A arena é a mesma pedra em escala de edifício, e a cidade
ganha uma peça que nenhuma outra cidade poderia ter.

---

## 2. A bacia, que é onde o projeto começa

⚠️ **A forma da casca não decide nada; a linha de visada decide.** As 27 fileiras
saem de `scripts/bacia_arena.py`, calculadas pelo C-value de 90 mm (padrão de
elite), e modelo e documento leem a MESMA fonte. O que o Blender desenha é o que
está aqui.

| nível | fileiras | piso a | projeção | inclinação | assentos |
|---|---|---|---|---|---|
| inferior | 14 | 1,2 m | 11,9 m | 30,2° | 5.743 |
| camarote | 2 | 10,3 m | 1,9 m | 32,1° | 360 (36 caixas) |
| superior | 11 | 13,7 m | 8,8 m | 33,7° | 8.261 |

**Total 11.983 lugares.** Envelope 131 x 111 m, última fila a 19,6 m de altura e
a 64 m do centro.

⚠️ **A PISTA DE 60 x 40 TORNAVA OS 12 MIL LUGARES IMPOSSÍVEIS.** A primeira
tentativa dimensionou a quadra como rinque de hóquei; com aquele retângulo, a
bacia de 12 mil lugares estourava os 160 x 140 m reservados no programa. Pista de
arena poliesportiva é **48 x 28 m**, e com ela a bacia fecha com 29 m de folga em
cada eixo. Programa não se estica: a planta é que estava errada.

---

## 3. A pedra

### 3.1 ⚠️ Ela é CORTADA POR PLANOS, não loftada por anéis

Esta é a lição central da peça, e ela custou três chapas.

A primeira versão era um tronco de pirâmide de sete lados: três anéis, uma casca
lisa. Nas chapas não leu como rocha nem como prédio. **Leu como uma tenda de
circo cinza.** O erro não era de material, era de forma, e tem três nomes:

1. **Afunilar não é facetar.** Se toda face tem a mesma inclinação, a silhueta é
   um cone e andar em volta não muda nada.
2. **Sem módulo não há escala.** Uma casca lisa de 190 m de diagonal lê do mesmo
   tamanho que uma de 19 m.
3. **Sem evento de entrada não há edifício.** Cinco caixinhas encostadas na base
   liam como galpões.

E o item 1 não se conserta por cima do loft, porque **face nascida de interpolar
dois anéis só é plana quando as duas quinas são coplanares**, o que só acontece
se todas as faces tiverem a mesma inclinação. O loft de anéis OBRIGA o cone.

Por isso a pedra é a **interseção de 7 semi-espaços** mais a base e um plano de
topo inclinado. Cada face é um plano `n·x = d`; a quina entre duas faces sai de
um sistema 2x2 resolvido a cada cota. Face plana por construção, inclinação
própria em cada uma.

| | |
|---|---|
| faces | 7 (ímpar: nenhuma fica paralela à oposta) |
| inclinações | **-6°**, +2°, +10°, +16°, +10°, +13°, +13° |
| altura | 71,5 m na quina mais baixa, **87,6 m** na mais alta |
| planta | ~176 m no maior vão |
| estratos | 16 cursos de 4,2 m |

⚠️ **Uma inclinação é NEGATIVA, e é a da entrada.** A face da fenda avança 6°
sobre quem chega: sobe-se a escadaria caminhando para DEBAIXO da pedra. É o único
gesto que transforma monólito em pórtico, e custa uma linha.

⚠️ **Simetria mata a silhueta.** Com as duas faces vizinhas caindo no mesmo
ângulo o volume vira trapézio isósceles visto de frente. Um ombro sobe quase a
prumo (+2°) e o outro recua (+13°): é essa diferença que faz andar em volta valer
a pena.

### 3.2 A fenda

⚠️ **Lintel reto em cima da fenda lê como porta de garagem.** Cortada num
retângulo com teto plano, a entrada vira vão de galpão por maior que seja.
Rachadura de verdade é larga embaixo e fecha em ponta em cima.

A fenda vai do chão até 71 m, larga 52% da fachada na base e afinando até 3,5%
sob a coroa. A profundidade afina junto: **26 m de cânion na entrada, 2 m de
trinca lá em cima.** Uma fita âmbar por estrato desenha os pavimentos no fundo, e
é a única cor quente da peça.

⚠️ **Fenda tímida não é evento de entrada.** A primeira tentativa tinha 25% da
largura e 18 m de altura contra 57 m de pedra: lia como nicho de serviço.

### 3.3 A escala

⚠️ **Sem módulo, 87 m leem como 15.** Três coisas dão escala e nenhuma é
decorativa:

- **os 16 estratos**, cada um com deslocamento radial próprio, então entre dois
  cursos nasce uma saliência de sombra. Estratificação de pedra sedimentar e
  junta de painel de fachada ao mesmo tempo.
  ⚠️ **Saliência grande demais vira pilha de pratos**: com 1,4 m de amplitude
  cada estrato pegava céu no topo e a fachada virava uma escada de linhas
  brancas. Meio metro dá a sombra e não desenha o degrau.
- **as frestas verticais**, 3 a 5 por face, de ponta a ponta, com o fundo aceso.
- **a escadaria de 12 degraus**, 42 m de largura. Ela não é ornamento: é a única
  coisa na peça cujo tamanho o olho já conhece.

### 3.4 O pódio

⚠️ **Sem recuo na base a pedra parece brotar do chão como morro.** O pódio recua
2,6 m, a pedra fica em balanço sobre uma sombra contínua e passa a ler como POSTA
no terreno. A fita de luz mora dentro dessa sombra, escondida sob o balanço.

### 3.5 A coroa e o óculo

O topo é cortado por um plano inclinado de 5,5°, que derruba 16 m de um lado.

⚠️ **13 graus comiam a pedra.** O plano corta um vão de ~170 m: cada grau tira
3 m da quina mais baixa, e com 13 a quina baixa vinha a 13 m do chão, sem pedra
para estratificar.

⚠️ **A tampa é a vista que MAIS aparece, não a menos.** Da cidade a pedra é vista
de baixo, mas o tour da live passa por cima e a landing usa chapa aérea: nesse
enquadramento a tampa é a maior superfície da peça. Chapada, vira um tapume cinza
de 15 mil m². Ela é uma bacia rasa de **5 terraços** descendo até o óculo.

O óculo é 44% da coroa. É o que faz a pedra ter interior: de cima é o único ponto
por onde a arena aparece, e o contraste entre a massa irregular e um anel exato
é o que diz "isto é obra". Por ele se vê a bacia e os assentos laranja.

---

## 4. Os dois acabamentos

⚠️ **A pedra tem dois acabamentos, não um.** O GLB que roda no navegador leva
material calibrado e liso, porque o exportador glTF só entende Principled com
valor fixo (qualquer nó procedural vira cinza chapado). As chapas usam
`blender/mat_premium.py` → `aplicar_arena()`.

⚠️ **De dia a quina é PEDRA, ponto.** Com emissão 3,5 na aresta, o contorno
inteiro saía branco sob sol pleno e a silhueta virava um desenho de arame. O
chanfro já tem 22 cm de saliência: a sombra dele desenha a quina sozinha. Quem
acende é a noite, por `noite_arena()`, e com hierarquia: quina mais fria e mais
fraca, fresta mais forte, fenda em âmbar quente.

É a **lei da emissão invertida** do parque aplicada na escala certa: marca grande
é mineral iluminado pelo sol, marca pequena é que brilha.

---

## 5. O número

| | |
|---|---|
| triângulos | **17.998** |
| arquivo | `public/city/dog-stone-arena.glb`, **110 KB** |
| texturas | **zero** |
| lugares | 11.983 |
| folga do teto contra a fachada | +16,7 m no pior caso |

Para comparar na mesma cena: o `$DOG ARENA` tem 85.572 triângulos e 415 KB;
`kray-tower.glb` tem 690 KB.

⚠️ **A folga é MEDIDA, não estimada.** A face recua `tan(inclinação)` por metro
de altura: subir a pedra ou fechar a inclinação come essa distância por dentro, e
a bacia tem 131 m no eixo X contra 111 no Y. `folga()` mede face a face na cota
do teto e o build avisa se a bacia encostar na fachada. Sem isso o defeito só
aparece quando o telhado atravessa a fachada numa chapa.

---

## 6. O que falta

| Item | Estado |
|---|---|
| posicionar no mapa | **aberto.** Decisão do fundador: modelar primeiro, sitiar depois. Precisa de módulo da teia (`caixaDoModulo`), máscara de parcela contra a malha viária e cota de assentamento medida em GRADE sobre a peça inteira, que são as três armadilhas que o estádio pagou |
| corte de celular | não medido. A peça é leve (18 mil triângulos, zero textura), mas o raio de corte tem que ser maior que a distância de onde ela é vista, que foi o defeito do estádio |
| entrar no tour da live | aberto. Cada parada nova é exposição contínua na transmissão |
| nome comercial | a fachada não tem letreiro, de propósito. Se a arena for vendida para patrocinador, o nome entra na fenda ou na coroa, não na face |
