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

## Um pódio só, e a terraplanagem que ele custa

A primeira versão dava a cada peça um pódio quadrado próprio, em três terraços
de cota diferente (−26,0 / −17,0 / −8,0, degrau constante de 9 m). Ela foi ao ar
e o fundador recusou na chapa: "ta muito feio separado assim, se preciso
terraplane e aterre".

Agora a parcela inteira é **uma laje só**, e as três peças pousam nela na mesma
cota. Medido sobre os 92,3 ha, o terreno natural ia de −34,0 a −0,9 m, ou seja
33,1 m de amplitude. A cota escolhida é a que **equilibra corte e aterro**:

| | |
|---|---|
| cota terraplanada | **−17,7 m** |
| topo da laje | −16,2 m (laje de 1,5 m) |
| corte | 16,8 m no máximo, em 64% da área, **2,74M m³** |
| aterro | 16,3 m no máximo, nos outros 36%, **2,74M m³** |
| muro do pódio | 4 a 29 m de geometria, ~19 m visíveis na ponta da avenida de 90° |

A alternativa de subir a cota para −14,0, que deixaria o muro mais baixo do lado
da cidade, foi medida e recusada: pede 4,80M m³ de aterro contra 1,39M de corte,
ou seja 3,4 milhões de m³ de terra vindos de fora do sítio.

A terraplanagem continua parando na divisa da parcela (`FRANJA = 34 m`), e é isso
que mantém as duas avenidas no chão natural. A laje é recuada essa mesma medida,
para a borda dela pousar em chão já plano; o que fica entre a laje e a divisa é a
rampa da franja, e ela some atrás do muro.

⚠️ **A máscara da franja e o recuo da laje têm de usar a MESMA geometria.** A
primeira tentativa media a franja na métrica (raio, ângulo) e recuava a laje
perpendicular às retas do polígono. O anel da cidade é uma face de dodecágono e
não um arco, então num bloco de 30° as duas métricas divergem por mais de 100 m
nas quinas: o verificador pegou a borda da laje pousada num trecho de rampa com
66,2% de declive. Hoje as duas usam as quatro retas do polígono.

## O piso

Campo no cinza de platô da cidade (`COR_PLATO`), faixa de calçada de 12 m na
borda (`COR_CALCADA`) e muro em meio-fio (`COR_MEIOFIO`), todos de `vias.ts`. A
laje inteira tem 156 triângulos e uma chamada de desenho.

Folga da pegada de cada peça até a borda da laje: 42 m no $DOG ARENA, 25 m no
atletismo e **13 m em THE GEODE**, que é o ponto mais apertado.

⚠️ **A normal de cada triângulo sai do winding, não de um vetor escrito à mão.**
A versão anterior declarava a normal num parâmetro e montava o triângulo na
ordem "natural", e as duas divergiam: a tampa era back-face, sumia, e o que
aparecia era o interior escuro da caixa. O fundador viu na chapa de produção
("um quadrado com cor diferente do resto do terreno, não é calçada, não é platô,
é outra coisa") e era o avesso. Calculando a normal a partir dos próprios
vértices os dois não podem mais divergir, e o verificador conta triângulos com
normal para baixo.

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
