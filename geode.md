# THE GEODE · a arena coberta da DogCity

Geodo é a pedra bruta e escura por fora que se abre em cristal por dentro. É
literalmente este prédio: casca preta facetada de obsidiana, bacia de 28.240
lugares brilhando lá dentro. Nome decidido pelo fundador em 06/09/2026, com a
regra de que não podia ser "arena".

| | |
|---|---|
| lugares | **28.240** em 46 fileiras, última a 34,4 m e a 90 m do centro |
| planta | 198 x 178 m (tambor), 224 x 201 com a saia, 292 x 269 de chão coberto |
| cume | 60 m |
| piso de show | 48 x 28 m livres, grid de som e luz a 45 m |
| malha | **31.348 triângulos, 182 KB, ZERO texturas** |
| sítio | módulo `{i:11, nr:3, j:52, ns:2}` da teia, 309 m até a via grande |

Fonte em `blender/build_arena.py`, bacia em `scripts/bacia_arena.py`, sítio e
poda em `app/city/plaza/geode.ts`, chapas em `blender/render_arena.py`.

---

## 1. O caminho que NÃO deu certo, e por que ele está aqui

A peça passou por duas versões descartadas antes desta. As duas ensinaram coisas
que valem para qualquer peça futura, e por isso ficam registradas.

### 1.1 "A Pedra": a runestone cortada por planos

Um monólito de 7 faces geradas por interseção de semi-espaços. Foi recusada
porque o fundador pediu que a arena FOSSE a runestone oficial do projeto, não uma
pedra parecida com ela.

⚠️ **Ficou desta versão:** afunilar não é facetar; sem módulo não há escala; e
face nascida de loft de anéis só é plana quando todas as faces têm a mesma
inclinação, o que obriga um cone. Massa facetada com inclinações próprias é
interseção de PLANOS.

### 1.2 A runestone de verdade, deitada

`public/runestone3d.gltf` inteira, deitada e fincada a 18°, 234 x 142 x 92 m. A
imagem era ótima. O fundador cortou pelo motivo certo:

> "Esse formato assimétrico pode atrapalhar na hora de colocar a quadra e a
> arquibancada. O prédio tem que ser funcional, não pode apenas ter formato da
> runestone."

E está certo: um fuso tombado dá pé-direito sobrando de um lado e faltando do
outro, encosta na arquibancada num canto, desperdiça 60 m no outro, e não tem
onde pendurar grid de show.

⚠️ **Três coisas ficaram desta versão, e todas são armadilhas caras:**

1. **A malha do acervo não se edita.** A runa do $DOG na face daquela pedra é
   gravada em SULCOS de geometria real, não é textura. `remove_doubles`,
   subdivisão, `SOLIDIFY` e booleano `EXACT` a destroem, e todos falham EM
   SILÊNCIO: a casca caiu de 33 mil para 7 mil triângulos, a pedra encolheu 10 m
   e o glifo apareceu furado ou coberto de cacos pretos.
2. **Não cabe arena em pedra sem distorcer a pedra.** Medido em 960
   transformações: em pé, a runestone precisaria de 300 m de altura para o vão de
   131 m da bacia.
3. **A silhueta como máscara também não colou.** Pôr outra runestone
   transparente na porta foi ideia do fundador, foi tentada, e ele mesmo recusou
   na chapa: em escala de prédio a pedra encostada lê como seixo, não como portal.

⚠️ **A regra que sai daí: A BACIA DESENHA A PLANTA, A PLANTA DESENHA A PELE.**
Nada de forma emprestada. Da runestone sobrou só o MATERIAL.

---

## 2. A bacia

⚠️ **A forma da casca não decide nada; a linha de visada decide.** As 46 fileiras
saem de `scripts/bacia_arena.py`, calculadas pelo C-value de 90 mm, e modelo e
documento leem a MESMA fonte.

| nível | fileiras | passo | inclinação |
|---|---|---|---|
| inferior | 14 | 0,85 m | 30,2° |
| camarote | 2 | 0,95 m | 32,1° (36 caixas, 360 lugares) |
| superior | 30 | **1,04 m** | 33,5° |

⚠️ **A pista é 48 x 28 m, não 60 x 40.** A de 60 x 40 é de hóquei; com ela os
12.000 lugares originais não cabiam nos 160 x 140 m que o programa reservava.

⚠️ **12.000 ERAM POUCOS PARA A CASCA, e isso só apareceu com a pele pronta.** O
envelope que o cume desenhou comporta 24.181 lugares; construir 12.000 dentro
dele é pagar fachada de arena grande para receber plateia média. O fundador
decidiu por 28.240, que é o ponto mais alto da varredura com a inclinação ainda
abaixo dos 34° de evacuação.

⚠️ **E NÃO BASTA ACRESCENTAR FILEIRA.** A linha de visada faz a inclinação SUBIR a
cada fila que recua: aos 26 degraus do anel superior com passo de 0,80 ela já
passava de 34°. Quem paga a conta é o TREAD. Fileira a mais sem passo a mais é
arquibancada fora de norma.

A varredura completa, toda dentro do teto de 34°:

| lugares | envelope | última fila | inclinação |
|---|---|---|---|
| 14.076 | 136 x 116 | 21,3 m | 33,9° |
| 18.559 | 149 x 129 | 25,5 m | 34,0° |
| 20.137 | 155 x 135 | 27,6 m | 33,9° |
| 24.181 | 165 x 145 | 30,7 m | 33,6° |
| **28.240** | **176 x 156** | **34,4 m** | **33,5°** |

---

## 3. A pele

### 3.1 A faceta nasce da paridade, não de ruído

Vértice par entra, ímpar sai, e a fase vira a cada anel. Com isso todo
quadrilátero tem os quatro cantos em raios diferentes, ou seja NÃO É PLANO, e ao
triangular vira duas facetas com normais bem distintas. É o que faz o volume
cintilar quando o sol anda, e sai de graça em triângulo.

⚠️ **Ruído daria o mesmo brilho e quebraria a simetria**, que é justamente o que o
fundador pediu. E a diagonal de cada quad é ESCOLHIDA, não deixada para o
Blender: ele escolhe a que suaviza melhor, as duas facetas saem quase coplanares
e o cintilo some.

⚠️ **N tem que ser múltiplo de 4**, senão o padrão não fecha na volta.

⚠️ **A parametrização é por COMPRIMENTO DE ARCO, não por ângulo.** Por ângulo os
vértices empilham nos cantos e ficam ralos no lado reto, e a faceta sai com
tamanhos diferentes em volta da peça.

### 3.2 Tambor mais pico, não cúpula

⚠️ Distribuindo a redução de raio uniformemente sai uma calota, e o veredito do
fundador na primeira tentativa foi **"donut sem o buraco"**. Mas cone puro também
não serve, porque a arquibancada precisa de 131 m de vão na cota de 34 m e um
cone já fechou ali. A forma que atende as duas coisas é **tambor até 62% da
altura, depois cone**.

⚠️ **E a peça é ACHATADA.** 88 m sobre 151 de planta dava 1:1,7 e o miolo do teto
subia demais, que num prédio de show é volume que ninguém usa e fachada que
ninguém vê. Com 60 sobre 198 a razão vai a 1:3,3.

⚠️ **`folga()` mede isso a cada build.** A cada mil lugares a última fila sobe; se
o cone começar antes dela, a arquibancada atravessa a fachada, e o defeito só
aparece numa chapa, às vezes nem lá. Hoje: **+10,6 m no pior caso**.

### 3.3 O aterramento

⚠️ Os dois primeiros anéis têm raio MAIOR que 1 e cota NEGATIVA. Em vez de a pele
encostar no chão numa linha e ganhar um pódio separado (que nas chapas leu como
**aba de chapéu**), o próprio cristal alarga e entra no solo. A peça lê como
afloramento, e é esse alargamento que absorve o desnível no terreno.

### 3.4 O material

Os NÚMEROS do `Crystal.002` da runestone oficial: metal 0,867, rugosidade quase
zero, especular alto. Não é uma "obsidiana de gosto".

⚠️ **E vem SEM TEXTURA, de propósito.** O material original traz base color e
normal de 2048 com o glifo pintado e gravado neles. Existe um trecho limpo do
mapa (u 0,016..0,203 / v 0,078..0,266, medido), mas trecho de textura NÃO SE
REPETE em glTF, que só sabe envolver o 0..1 inteiro. Como o fundador pediu
obsidiana sem a marca, a pele leva os números e nenhuma imagem.

---

## 4. O letreiro

`THE GEODE`, matriz 5x7, letra de 6,4 m, **8 repetições que fecham exatas na
volta**.

⚠️ **O NÚMERO DE REPETIÇÕES SE CALCULA, NÃO SE ESCOLHE.** O texto tem que fechar
um número inteiro na volta, senão a última emenda cai no meio de uma palavra e o
letreiro fica torto para sempre num ponto. O passo do pixel sai do perímetro
dividido pelas colunas necessárias.

⚠️ **E ELE MORA NUM COLAR LISO, e isso não é enfeite.** A faceta avança 2,45 m
sobre a pele; uma fita colada na superfície sai 0,55 m e portanto fica ATRÁS das
facetas salientes: de lado, metade das letras some por trás do próprio prédio.
Foi o que o fundador viu na primeira noturna. Aumentar a saliência da fita faria
a letra flutuar no ar. O certo é arquitetônico: uma faixa da pele deixa de ser
facetada, vira cilindro reto e avança 3,05 m sobre toda a lapidação.

Cor: laranja de marca `#E8660D`, não branco e não a lava `#F56E0F`.

---

## 5. O projeto de luz

⚠️ **A lei da emissão invertida, herdada do Parque Runestone: a FACE fica escura e
quem carrega a luz é a LINHA.** Numa peça de obsidiana isso não é estilo, é
física: a pele é espelho preto, ela não tem o que devolver à noite. Iluminar a
face de frente só produz um borrão cinza.

A hierarquia, do mais forte para o mais fraco:

1. **o letreiro** no colar, que é o que se lê;
2. **as quatro marquises**, que dizem onde se entra;
3. **as duas juntas do tambor**, fio fino azulado que desenha a lapidação;
4. **doze feixes ESTREITOS** rasantes, que morrem a 12 m de altura.

⚠️ **Lavagem contínua não é projeto de luz, é holofote.** Pedido do fundador:
pontual, proposital, "não precisa ser visto do espaço". O que NÃO está aceso é
tão projeto quanto o que está.

⚠️ **O feixe tem que morrer abaixo do colar.** O colar avança 3 m e é liso:
qualquer luz que o alcance faz dele a superfície mais clara da peça, e um anel
branco de 200 m compete com o letreiro que mora nele.

⚠️ **A faixa envidraçada foi REMOVIDA.** Ela existia para "mostrar que tem gente
dentro", mas num prédio de obsidiana o vidro é a única superfície que devolve luz
difusa, então sempre seria a coisa mais clara da noturna: com emissão 3 virou um
cinturão branco de 2 mil m² que apagava o nome. O interior aparece pelas quatro
entradas. Para religar, aponte `K_VIDRO` para um anel do tambor, longe do colar.

⚠️ **O remate do cume é PRETO.** Vidro no topo transforma o cume num disco
luminoso e a peça vira disco voador. Decisão do fundador. A luz do cume é um fio
no aro, e só.

---

## 6. O sítio e o celular

### 6.1 O módulo

⚠️ **A TEIA NÃO É A ÚNICA MALHA VIÁRIA DA CIDADE, E FOI ISSO QUE ERROU O SÍTIO
NA PRIMEIRA VEZ.**

A primeira escolha foi `{i:8, nr:3, j:46, ns:3}`, varrida contra a teia e contra
as peças do programa, e o fundador viu na chapa: a peça em cima de uma via.
Medido depois contra `cidade-malha.json`, que é onde moram as OUTRAS três
famílias de via:

- o **Anel Médio** (`AN2`, r 2.750, 26 m de largura) passava a **4 m** do centro
  da peça, ou seja por cima dela: **-144 m de folga**;
- o **bulevar BUL04** (44 m, rumo 106,875) passava a 90 m, e a peça precisa de
  146.

Nenhuma das duas aparece em `teia.ts`. Bulevares, autopistas e anéis viários são
publicados pelo gerador em `cidade-malha.json` e desenhados por outro caminho,
então a máscara de parcela não os detém. **Caber num módulo da teia é necessário
e não suficiente.**

O sítio corrigido é `{i:11, nr:3, j:52, ns:2}`. A varredura refeita
(`scripts/_sitio2.ts`) cobre as três famílias mais os corpos d'água e os canais;
dos 1.753 blocos aprovados, este ganha por folga:

- **309 m** até a via grande mais próxima (`AN3`, o Anel Exterior), contra -144
  do sítio anterior;
- caixa de **528 m no radial por 481 m de arco** para uma peça de 292 x 269:
  130 m livres no radial e 94 no arco até a rua do próprio módulo;
- **mesmo anel do estádio** (r 3.294), 615 m dele: os dois seguem formando um
  distrito esportivo, agora sem nenhum dos dois em cima de via;
- água a **1.097 m** e o canal mais próximo (`CR03`) a **1.652 m** de afastamento
  lateral.

⚠️ **A MESMA MEDIÇÃO REPROVOU O ESTÁDIO, E O FUNDADOR DECIDIU NÃO MEXER.** Com a
peça real dele (418 x 376, não 292 x 269), `{i:11, nr:3, j:46, ns:3}` dá **-123 m**
contra o BUL04: o eixo do bulevar de 44 m cai dentro do bloco. A peça chegou a
ser movida para `{i:11, nr:3, j:44, ns:3}` e o fundador mandou voltar em 06/09,
"confirme o estádio na mesma posição de antes". O número fica registrado em
`app/city/plaza/estadio.ts` para quem um dia decidir mexer.

⚠️ **A posição é um MÓDULO, não uma coordenada.** Regra já paga pelo estádio:
coordenada escolhida a olho põe avenida dentro do prédio. O que esta rodada
acrescenta é que o módulo tem de ser conferido contra TODAS as malhas, não só a
que o define.

⚠️ **E a parcela entra na máscara das vias.** Sem isso a teia desenha rua por
dentro da arena.

### 6.2 A poda de celular

⚠️ **A maior economia da peça não é textura, é NÃO CARREGAR O INTERIOR.**

A arena é coberta: de fora, a arquibancada só aparece pelas quatro entradas, que
somam 4% do perímetro e ficam a 1,7 km de quem olha.

| objeto | triângulos | no celular |
|---|---|---|
| `GEODE_CASCA` | 3.372 | carrega |
| `GEODE_INTERIOR` | 27.976 | **removido** |

São **89% da peça** para um detalhe que o telefone nunca vai resolver. A
silhueta, o letreiro e a lapidação continuam idênticos.

⚠️ **E KTX2 NÃO SE APLICA AQUI.** O espelho de `scripts/city/ktx2.mjs` existe para
GLB com IMAGEM embutida, que é o que estourava a memória de textura do telefone.
`dog-geode.glb` tem 182 KB, zero imagens e zero texturas, só cor de material. Se
um dia a pele ganhar textura, ela entra por lá.

### 6.3 O corte por distância

⚠️ **A distância se mede de onde a peça é VISTA.** A conta:

    THE GEODE está a 3.294 m do centro
    o visitante fica na praça, raio até 1.024 m
    logo ele a vê de 2.270 a 4.318 m

O corte tem de ser maior que o PIOR caso, não que a média: foi cortando pela
média que o estádio sumiu do celular em 06/09. **4.700 no celular, 7.000 no
desktop.** Este número acompanha o sítio: mudou o módulo, refaça a conta.

---

## 7. O que falta

| Item | Estado |
|---|---|
| conferência na cidade | chapa `geode` e `geodeperto` no portão `scripts/city/chapas.mjs` |
| entrar no tour da live | aberto. Cada parada nova é exposição contínua na transmissão |
| as quatro entradas de perto | leem fracas a distância média; falta escala de porta |
| a reserva no programa congelado | `data/dogcity_programa_congelado.json` não conhece esta peça |
| nome comercial | a fachada tem o nome próprio no colar. Patrocínio, se houver, entra ao lado dele e não no lugar |
