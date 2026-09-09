# O centro de esportes aquáticos

Plano aberto em 09/09/2026 a pedido do fundador. **Nada implementado.** Não há
reserva publicada, não há código, não há modelo. Este documento é o levantamento,
a física, os dois sítios medidos e as decisões já travadas.

## O pedido, e as duas travas

O fundador abriu a frente e travou duas coisas antes de qualquer desenho:

1. **Duas peças em dois sítios.** Um centro aquático edificado perto do campus
   esportivo, e uma frente de água aberta separada. Cada uma vai ao ar sozinha.
2. **Norma World Aquatics, com as peças lunares ao lado.** O tanque de 50 m
   obedece à norma terrestre para o recorde continuar comparável, e o que só
   existe a 1/6 g entra como equipamento adicional, não como reescrita da norma.

## O que já estava escrito e nunca foi construído

`plano-diretor.md` §5.1 reserva no complexo 2 (rumo 105°, r 2.600 a 2.960) um
**Centro Aquático de 50 m** (tanque 50 × 25, 10 raias, edifício 70 × 45 m) e a
**Torre de Saltos de 60,35 m**, mais duas piscinas de bairro de 25 m no complexo
5. Nenhuma das 71 reservas de `cidade.json` é aquática: as cinco de esporte são
Parque Olímpico, DOG Derby, $DOG ARENA e dois campos de treino. O complexo 2 do
plano diretor nunca virou reserva, então o endereço está livre para ser medido de
novo, e foi.

## 1/6 g: o que muda, e o que não muda

Medido para g = 1,625 m/s², água a 1.000 kg/m³, ar sob a abóbada a 1,225 kg/m³.

| | Terra | DogCity | razão |
|---|---:|---:|---:|
| fração submersa de um corpo que boia | igual | igual | **1,00** |
| profundidade para 1 atm de sobrepressão | 10,33 m | **62,4 m** | 6,04 |
| torre que entrega 14,0 m/s de entrada na água | 10,0 m | **60,35 m** | 6,04 |
| tempo de voo do saltador | 1,43 s | **8,62 s** | 6,04 |
| onda de gravidade de 50 m de comprimento | 8,84 m/s | **3,60 m/s** | 0,41 |
| altura de onda para a mesma energia de gerador | H | **2,46 H** | 2,46 |
| barreira de Froude do nadador de superfície (L 1,8 m) | 1,77 m/s | **0,72 m/s** | 0,41 |
| 2.000 m de remo, oito com timoneiro | 5:18 | **~13:00** | 2,46 |
| casco que recupera a velocidade terrestre de prova | 17,7 m | **106,5 m** | 6,04 |
| velocidade de decolagem de um foil de vela | ~6,5 m/s | **~2,65 m/s** | 0,41 |
| comprimento capilar da gota (respingo) | 2,7 mm | **6,7 mm** | 2,46 |

**O empuxo não muda nada, e isso é a primeira coisa a entender.** Peso e empuxo
caem os dois por seis, então a linha d'água de um corpo que boia é exatamente a
mesma. Ninguém boia melhor na Lua. O que muda é tudo que envolve onda, queda ou
pressão.

⚠️ **NADAR NA SUPERFÍCIE FICA MAIS LENTO NA LUA, e essa é a descoberta que decide
o partido da peça.** A resistência de onda de um nadador é governada pelo número
de Froude, `v / √(g·L)`, e a barreira cai com a raiz da gravidade: 2,46 vezes.
Nadar submerso não paga esse pedágio, porque o corpo submerso não faz onda. Logo,
**na DogCity a prova rápida é a submersa** e o nado de superfície é o lento.
Consequência de projeto, e é ela que dá identidade ao edifício: o tanque se
projeta para ser visto **por baixo**, com galeria submersa e parede de vidro na
lateral longa, porque é embaixo d'água que a prova acontece.

⚠️ **E ESSA PREMISSA É FRÁGIL, exatamente como o arrasto do golfe em `golfe.md`.**
O 0,42 de Froude limite é modelo de nadador de superfície, não medição, e não
existe medição de natação a 1/6 g em lugar nenhum. O número entra no plano como
razão de projeto (a prova submersa ganha da de superfície) e não como promessa de
tempo. Medir isso direito é trabalho em aberto.

**O que o poço fundo ganha de graça:** 60 m de água aqui valem 1 atm de
sobrepressão, contra 10,3 m na Terra. Um poço de 60 m é apneia profunda com a
conta de descompressão de uma piscina terrestre de 10 m. É o equipamento mais
lunar que a cidade pode ter, e não existe similar na Terra.

**O que a torre ganha de graça:** os 60,35 m entregam os mesmos 14,0 m/s de
entrada da plataforma de 10 m terrestre, com **8,62 s de voo** em vez de 1,43 s.
Seis vezes mais tempo no ar é seis vezes mais acrobacia, e a profundidade do poço
de saltos continua sendo os 5,0 m da norma: a água freia igual e o peso que empurra
o saltador para o fundo é 1/6, então a parada é mais curta que na Terra, não mais
longa.

**Água não é restrição nesta cidade, e seria desonesto fingir que é.** O programa
inteiro pede cerca de 50.000 m³. A lâmina de −40 que a cidade já aceitou guarda
algo próximo de 600 milhões de m³. A conta de voláteis já foi paga quando os lagos
foram aprovados.

## Sítio A: a peça coberta, no espelho do campus

O campus fechou como trio numa parcela de 7 módulos entre as avenidas de 90° e
120° (`campus.md`), e ela está cheia. O sítio medido para a peça aquática é a
**faixa espelhada, entre as avenidas de 60° e 90°, no mesmo anel**, o que dá
simetria de espelho em torno da avenida de 90° em vez de um quarto membro
desalinhado.

Medido em 09/09/2026 contra `buildTerrain` sobre o heightmap da NASA, offline:

| parcela | rumo | arco × radial | área | terreno | amplitude | cota de equilíbrio | terra |
|---|---|---|---:|---|---:|---:|---:|
| **5 módulos** `{i:11,nr:3,j:28,ns:5}` | 60,10 a 81,32° | 1.220 × 528 m | **64,4 ha** | −42,2 a −29,1 | **13,1 m** | **−34,0 m** | **0,53 Mm³** |
| 6 módulos | 60,10 a 85,61° | 1.466 × 528 m | 77,4 ha | −44,0 a −29,1 | 14,9 m | −34,9 m | 0,88 Mm³ |
| 7 módulos, a faixa inteira | 60,10 a 89,90° | 1.713 × 528 m | 90,4 ha | −44,0 a −29,1 | 14,9 m | −35,2 m | 1,03 Mm³ |
| campus, para comparar | 90,10 a 119,90° | 1.713 × 528 m | 92,3 ha | −34,0 a −0,9 | 33,1 m | −17,7 m | 2,74 Mm³ |

**A parcela de 5 módulos é a recomendada, e o motivo é a terra.** Ela custa
**0,53 Mm³ de corte igual a 0,53 Mm³ de aterro**, ou seja **19% do que o campus
custou**, porque o terreno ali tem 13,1 m de amplitude contra os 33,1 m do outro
lado da avenida. Nenhuma reserva publicada colide com ela, e 0,4% dela fica abaixo
da lâmina, contra 6,1% da faixa de 7 módulos.

Os 6 e os 7 módulos custam mais porque engolem a vala do canal radial de 85°, que
é justamente o que **não** se quer dentro da parcela.

**A peça aquática é a única do complexo esportivo que tem frente de água.** A laje
fica a −34,0 e a lâmina a −40: **6,0 m de degrau**, altura de cais. A laje do
campus está 23,8 m acima da mesma água. Folga entre a borda da parcela e a margem
do canal: **149 m em r 3.100, 162 m em r 3.300 e 179 m em r 3.560**, espaço de
sobra para o cais, a rampa dos barcos e o passeio.

## Sítio B: a água aberta, e ela não é a baía

⚠️ **O CANAL RADIAL DE 85° JÁ É UMA RAIA DE REMO, e ninguém tinha reparado.**
Medido nos cinco raios:

| | |
|---|---|
| lâmina | **100 m de largura constante**, de r 1.450 a r 7.200 |
| profundidade | **4,0 m**, leito plano em −44,0 |
| comprimento reto | **5.750 m**, sem uma curva |
| desemboca | na baía numa ponta, no anel da Praça Central na outra |
| norma World Rowing | 2.000 m, 8 raias de 13,5 m = 108 m, calado mínimo 3,5 m |

Ou seja: a raia de prova de **2.000 m cabe com 3,7 km de sobra**, o calado passa
com 0,5 m de folga e a largura entrega **6 raias de 13,5 m mais 9,5 m de margem
de cada lado**. As 8 raias da norma pedem 8 m a mais de lâmina no trecho de prova,
o que custa da ordem de **0,08 Mm³** (estimativa, não medição: depende do talude
que se aceitar na margem alargada).

E a chegada da raia cai **ao lado da parcela do Sítio A**. A peça coberta vira a
casa de barcos e a torre de chegada da prova de remo, sem nenhum deslocamento: um
sítio, duas modalidades, e o remador desce o canal até a baía pela mesma lâmina.

**A baía continua no plano, com outro papel: vela e águas abertas.** Ela tem
34,3 km² pelo `cidade-malha.json`, profundidade média medida de 25,3 m e máxima de
121,2 m, e a raia de 2.113 × 108 m cabe nela em **1.477 posições diferentes**, a
mais próxima do centro em r 4.667, rumo 45°. Vela lunar é multicasco de foil por
obrigação, não por escolha: o momento de endireitamento cai por seis junto com o
peso do lastro, então quilha não segura vela nenhuma, e o foil decola a 2,65 m/s.

⚠️ **DIVERGÊNCIA REGISTRADA, a reconferir antes de qualquer implantação.** O
gerador publica 34,3 km² para a baía; a minha rotulagem por grade de 20 m sobre
`superficieAt` acha 23,8 km² no corpo que contém o ponto publicado, e um segundo
corpo de 69,5 km² fora dele. As duas contas não medem a mesma coisa (a minha
inclui os canais e o anel central, que são contínuos com a baía desde 05/09) e
nenhuma das duas é a que vale sozinha. Antes de assentar a marina isso se remede.

## O programa, na norma e fora dela

Na norma World Aquatics, para o recorde continuar comparável:

| equipamento | medida | nota |
|---|---|---|
| tanque de competição | 50 × 25 m, 10 raias de 2,5 m, 3,0 m de profundidade | World Aquatics |
| poço de saltos | 25 × 25 m, 5,0 m de profundidade | serve à torre lunar sem mudança |
| tanque de aquecimento | 50 × 25 m ou 25 m com 8 raias | World Aquatics |

Fora da norma, porque só existe aqui:

| equipamento | medida | o que ele entrega |
|---|---|---|
| **Torre de Saltos** | 60,35 m de altura, base 40 × 40 | 14,0 m/s de entrada, 8,62 s de voo |
| **Poço de Apneia** | 30 m de diâmetro, **60 m de profundidade** | 1 atm no fundo; 42.400 m³ de escavação |
| **galeria submersa** | parede de vidro na lateral longa do tanque | a prova rápida é a submersa: ela se vê por baixo |
| piscina de ondas | a dimensionar | mesma energia, onda 2,46 vezes mais alta e 2,46 vezes mais lenta |

⚠️ **A torre de 60,35 m e o poço de 60 m são o mesmo número, um para cima e outro
para baixo.** 120,35 m de eixo vertical numa peça só, simétrico em torno da
lâmina. Isso não é coincidência de projeto, é a mesma gravidade aparecendo duas
vezes, e é o desenho que a peça deveria perseguir.

**Decisão em aberto, e ela é de desenho:** a torre fica dentro da nave (pé-direito
de 70 m, contra os 40 m do $DOG ARENA) ou solta ao lado dela, sob a abóbada, como
marco vertical do distrito. A cidade é pressurizada sob a casca, então "ao ar
livre" é legítimo, custa muito menos edifício e entrega silhueta.

**Polo aquático fica fora desta rodada.** O arremesso vai a seis vezes o alcance e
o jogador sai quase inteiro da água na pernada, o que quebra a piscina de 30 × 20
da norma sem que exista norma substituta. É regra de jogo, não geometria, e pode
ser decidida depois da peça, como o copo do golfe.

## O que falta decidir antes do primeiro traço

1. **Os nomes.** O campus usa DOG Athletics, $DOG ARENA e THE GEODE. Para a peça:
   `DOG AQUATICS`. Para a raia no canal: `THE REACH`, que é como se chama o trecho
   reto de água de prova em inglês. Os dois são sugestão, não decisão.
2. **Torre dentro ou fora da nave** (acima).
3. **Alargar ou não o trecho de prova do canal** de 100 para 108 m, o que troca
   0,08 Mm³ de terra por conformidade com as 8 raias da norma.
4. **Se a marina da baía entra nesta frente** ou vira uma terceira peça depois.

## Limites deste documento

Nada aqui foi verificado em navegador, nenhuma linha de código foi escrita e
nenhuma reserva foi publicada. Todas as medições de terreno são de 09/09/2026,
offline, contra `buildTerrain` sobre `btc-core-heightmap.f32` com os canais e o
leito de `cidade-malha.json`, sondando a cada 10 m dentro da parcela e a cada
0,02° no corte do canal. Corte e aterro saem da cota que equilibra os dois, com
área de 100 m² por sonda, o mesmo método de `campus.md`. Não valida lotes do
snapshot (que ainda não existem), não mede carga de GLB, FPS nem GPU, e não
confere colisão com as 69 reservas reencaixadas, só com as 71 publicadas.
