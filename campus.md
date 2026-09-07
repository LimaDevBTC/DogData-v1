# Campus esportivo

O chão que DOG Athletics, $DOG ARENA e THE GEODE dividem. Código em
`app/city/plaza/campus.ts`, conferência em `scripts/city/verificar-campus.ts`.

## O pedido

Em 07/09/2026 o fundador olhou a chapa das três arenas e apontou três coisas:
as bases não conversavam ("colocar base quadrada e com material padronizado nos
3"), o espaço estava mal usado ("a impressão que eu tenho é que se organizar
cabe tudo no bloco onde hoje só tem o estádio") e a calçada devia ser a mesma
nas três ("padronizamos a calçada que os 3 usam e otimizamos o espaço"). Depois
liberou a terraplanagem: "se for o caso, terraplane o terreno todo e deixe como
a gente precisa".

## Os três não cabiam numa célula, e a medição é essa

Com pódio quadrado e calçada de 12 m os lados são 442 (ARENA), 344 (atletismo)
e 316 (GEODE): 1.102 m de arco em fileira, 1.270 m contando vão e recuo. A maior
célula da cidade era justamente a do atletismo, 466 × 895 m, e a peça ocupava
18% dela. É por isso que na chapa parecia caber tudo.

O que existe é melhor que caber: a faixa de anel do ARENA (r 3.030 a 3.558) vai
da avenida de 90° à de 120° em exatamente sete módulos. O ARENA ocupava três e
a GEODE dois; sobravam dois, encostados na avenida de 90°, secos e sem colidir
com programa nenhum. O atletismo veio para lá.

| peça | módulo | rumo | pódio | distância do vizinho |
|---|---|---|---|---|
| DOG Athletics | `{i:11, nr:3, j:42, ns:2}` | 94,286° | 344 m | |
| $DOG ARENA | `{i:11, nr:3, j:46, ns:3}` | 105,000° | 442 m | 615,079 m |
| THE GEODE | `{i:11, nr:3, j:52, ns:2}` | 115,714° | 316 m | 615,079 m |

Mesmo anel, espaçamento idêntico até o milímetro, e o trio preenche a faixa
inteira entre as duas avenidas. Nem o ARENA nem a GEODE se mexeram: quem se
mudou foi a peça nova, que ainda desceu de r 4.042 para r 3.294 e por isso teve
o corte de distância de celular reduzido de 5.500 para 4.700 m.

Vão livre entre pódios: 222,1 m e 236,1 m.

## A parcela é uma só

`CAMPUS_MOD = {i:11, nr:3, j:42, ns:7}`, 528 m no radial por 1.575 m de arco
interno. Ela entra sozinha na máscara de vias e apaga as duas ruas radiais que
separavam as três peças. A regra da casa continua obedecida: a parcela é um
número inteiro de módulos da teia e os lados dela são ruas, só que agora são as
duas avenidas e os dois anéis.

## A terraplanagem é em três terraços, não num platô só

O declive do sítio é tangencial, não radial: no raio 3.294 o chão sobe de −34 m
na avenida de 90° para −10 no rumo 105° e segue até −5, enquanto no radial varia
menos de 3 m sob o ARENA. Um platô único a uma cota só (a equilibrada seria
−17,5, com 16,9 m de corte contra 17,1 de aterro) pediria 24 m de aterro na
ponta do 90°, e o talude desse aterro só teria os ~50 m que sobram até a avenida:
1:2, que é muro e não terreno.

São três terraços com degrau constante de 9,00 m: −26,0 (atletismo), −17,0
(ARENA) e −8,0 (GEODE). Nenhum passa de 9,5 m de corte nem de 7,4 m de aterro.
O degrau vence os vãos de 222 e 236 m a 11%, que é rampa de caminhar.

A terraplanagem para na divisa da parcela (`FRANJA = 34 m`), e isso salva as
avenidas: sem a máscara o talude transbordava e pegava a avenida de 120° com
18,88 m de caimento transversal nos 44 m de largura dela. Medido depois da
máscara, o caimento é 4,92 m na avenida de 90° (11,2%, contra 1,25 m natural) e
15,98 m na de 120° (36,3%, contra **12,52 m que já eram naturais** ali).

Dentro da parcela, 96,2% do chão fica abaixo de 15% de declive. O pior ponto é
63,7%, no raio 3.356 rumo 119,5°, que é o canto onde o terreno natural já tinha
28,5%.

## O pódio

Quadrado nos três, e o lado é a única coisa que muda: a pegada declarada da peça
(`*_PECA_X/Z`, que já inclui esplanada e talude do próprio modelo) circunscrita
num quadrado mais 12 m de calçada por lado. Topo na cor de calçada da cidade
(`COR_CALCADA`, `vias.ts`) e face em meio-fio. Uma geometria, um material, 72
triângulos no total.

A esplanada oval do ARENA e o disco da GEODE continuam dentro dos GLBs e pousam
em cima da laje; a faixa de 12 m que sobra em volta deles é a calçada comum. Se
um dia essas bases próprias forem aparadas, é em `blender/build_estadio.py` e
`blender/build_arena.py`.

### A saia desce até o terreno, e o motivo é o dodecágono

A primeira versão do pódio era uma caixa de 1,2 m e ela flutuava. O anel interno
da cidade é uma **face** do dodecágono, não um arco: entre a avenida de 90° e a
de 120° é uma reta só, então o raio útil no rumo do bloco é menor que a apótema
que `caixaDoModulo` devolve. Medido, a folga do canto do pódio até a divisa é de
**5,6 m** no atletismo, 36 m no ARENA e 21 m na GEODE, e logo depois da divisa o
chão volta ao natural e cai 7 m.

Por isso a saia é medida contra o terreno em volta em vez de ter altura fixa.
Alturas resultantes: 4,26 m no atletismo, 9,12 m no ARENA e 4,03 m na GEODE. É a
mesma solução que `build_estadio.py` já usava na `plataforma()` do ARENA.

## Um defeito que ficou, e que é anterior a este trabalho

O bulevar **BUL04** cruza o bloco do $DOG ARENA: a folga é de −28 m, ou seja o
eixo dele cai dentro da peça. Está medido em `estadio.ts` desde 06/09 e o
fundador mandou manter a peça onde está ("confirme o estádio na mesma posição de
antes"). O verificador relata em `avisos` em vez de reprovar.

## Um defeito consertado de passagem

`assentarEstadio` e `assentarGeode` sondavam o terreno com a matriz de rotação
**inversa** à que o Three usa para pousar o GLB, ou seja mediam um retângulo
girado 2φ fora do lugar. Ficou invisível enquanto o terreno sob as peças era
liso; apareceu no dia em que o campus criou um talude ao lado, e o $DOG ARENA
pousou 0,61 m acima do próprio pódio, flutuando. A conta certa é a que
`atletismo.ts` já usava e documentava.

## Conferência

```bash
npx tsx scripts/city/verificar-campus.ts       # o chão: parcela, terraços, pódios, pouso
npx tsx scripts/city/verificar-atletismo.ts    # a peça do atletismo sozinha
node scripts/city/chapas.mjs --vistas=campus,campustopo
```

O verificador falha se algum pódio sair da parcela, se houver água sob ele, se
o terraço não ficar plano, se a peça não pousar exatamente no topo do pódio
(0,40 m de folga), se a saia não alcançar o terreno ou se o trio deixar de ser
igualmente espaçado.

## Limites

Não valida lotes futuros do snapshot nem os GLB, não mede FPS nem GPU. Os
números de corte e aterro por terraço foram medidos contra o terreno natural em
07/09/2026 e não são recalculados pelo verificador, porque depois da
terraplanagem a cota natural não é mais recuperável sob o pódio.
