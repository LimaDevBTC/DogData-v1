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

## As três travas de 09/09/2026, e o que elas mudaram

O fundador decidiu, na ordem em que a geometria pedia:

1. **A torre fica FORA da nave.** Ela carrega a silhueta do distrito e, dentro,
   exigiria 70 m de vão livre coberto contra os 40 m do $DOG ARENA. A nave ficou
   com 24 m de altura e um lanternim, e a torre virou peça exposta sob a abóbada.
2. **A peça é arena de competição**, com arquibancada. São duas bancadas
   longitudinais de 20 fileiras sobre o tanque de 50 m, mais uma bancada externa
   de 12 fileiras de cada lado do poço de saltos, virada para a torre.
3. **Os nomes são DOG AQUATICS e THE REACH**, o primeiro seguindo DOG Athletics e
   o segundo sendo o termo inglês do trecho reto de água onde se rema.

## A deriva: o achado que redesenhou o poço de saltos

⚠️ **O POÇO DE SALTOS LUNAR CRESCE PARA O LADO, NÃO PARA BAIXO.** Um saltador
deixa a plataforma com cerca de 1,5 m/s na horizontal e fica **8,62 s** no ar
vindo da plataforma de cima, então ele entra na água **12,93 m adiante** da borda.
Na Terra esse número é 2,1 m, e por isso a norma pede só 1,5 m de balanço da
plataforma sobre a água.

Consequência medida e travada no gerador: o poço tem **40 m no eixo do salto por
30 m de largura, com os mesmos 5,0 m de profundidade da norma**. A profundidade
não precisa crescer porque a água freia igual e o peso que empurra o saltador
para o fundo é 1/6. A verificação do gerador falha se o ponto de entrada
calculado sair do poço: hoje ele cai em x = 85,1 num poço que vai de 65 a 105.

## O modelo

Gerador: `../blender/build_aquatics.py`, paramétrico, no padrão de
`build_atletismo.py`. Fonte editável: `../blender/dog-aquatics.blend`.
Rodar com `blender -b -t 2 -P blender/build_aquatics.py [-- --render] [-- --cutaway]`.

**Acervo antes de modelar, como manda a regra da casa.** Busca na API do Sketchfab
em 09/09/2026 por "olympic swimming pool", "diving tower platform", "aquatic
center" e "swimming pool stadium": nada aproveitável com licença aceita. O que
volta é ponto de ônibus da London Aquatics Centre, enfeite de aquário e uma
piscina em voxel de 1940. Construção paramétrica, mesma conclusão do atletismo.

### A peça, medida

| | |
|---|---|
| sítio | 324 × 180 m, calçada de 12 m e saia enterrada de 5,5 m |
| nave coberta | 140 × 140 m; parede de 23,0 m, casca até **38,6 m** |
| casca | arco de 12 gomos com clarabóia longitudinal e clerestório perimetral |
| altura livre sobre a água | **38,2 m** |
| arquibancada | dois níveis por lado, 18 + 14 fileiras, **2 vomitórios por bancada** |
| lugares assentados | **9.888**, contados pelo gerador, não estimados |
| tanque de competição | 50 × 25, 10 raias de 2,50, 3,0 m, com canaleta de borda |
| tanque de aquecimento | 50 × 25 atravessado, dentro da nave |
| galeria submersa | 3,0 m de pé-direito, vidro contra o tanque, clarabóia no deck |
| poço de apneia | 30 m de diâmetro, **60 m**, com anéis de profundidade a cada 10 m |
| poço de saltos | 40 × 30, 5,0 m, bancada de 16 fileiras coberta por pergolado |
| torre | 60,35 m, plataformas em 6,04 / 18,11 / 30,18 / 45,26 / 60,35 |
| praça | 4 mastros de luz de 26 m, placar sobre a cabine de arbitragem |
| altura total | 65,77 m |

As cinco plataformas **são** as cinco terrestres (1, 3, 5, 7,5 e 10 m)
multiplicadas por 9,81/1,625, e o build falha se alguma divergir por mais de 5 cm.
A de cima entrega 14,00 m/s de entrada, os mesmos da plataforma de 10 m terrestre.

### Orçamento de carga

| fase | arquivo | transferência | triângulos | primitivas | texturas |
|---|---|---:|---:|---:|---:|
| base | `dog-aquatics-base.glb` | 27.900 bytes | 3.602 | 13 | 0 |
| detalhe | `dog-aquatics-detail.glb` | 46.472 bytes | 13.248 | 7 | 0 |
| total | | **74.372 bytes** | **16.850** | 20 | 0 |

Contra DOG Athletics (25.706 triângulos em 129.172 bytes), esta peça é maior em
planta e continua **58% do peso de transferência**, porque não usa textura nenhuma
e a casca inteira sai de 12 gomos.

### O que o build verifica sozinho, e falha se mudar

1. as cinco alturas de plataforma contra a razão de gravidade, 5 cm de tolerância;
2. a velocidade de entrada da plataforma de cima contra os 14,00 m/s terrestres;
3. o ponto de entrada com a deriva de 12,93 m caindo dentro do poço;
4. os 60 m do poço de apneia contra a profundidade de 1 atm (62,4 m);
5. o nível superior da bancada acima do inferior, e a parede acima dos assentos;
6. altura livre sobre a água de pelo menos 25 m;
7. a bancada inteira dentro da nave;
8. o pergolado sem avançar sobre a água do poço;
9. **nenhum mastro dentro da nave, dentro de bacia ou fora do piso**;
10. contagem de lugares entre 8.000 e 12.000;
11. envelope do sítio, orçamento de triângulos, bytes, primitivas e Draco.

### Cinco defeitos que só a chapa pegou

Registrados porque custam caro quando voltam, e todos já consertados:

1. **o piso do pódio era uma face inteira** e enterrou toda a água da peça; hoje
   ele se decompõe em bandas de Y que desviam das bacias;
2. **a tampa do `ring_loft` do pódio** tapava as bacias por baixo do piso;
3. **as nervuras da casca eram caixas alinhadas aos eixos** e saíram como espinhos
   cravados no telhado, porque o `box` do lib só gira em Z; agora elas seguem o
   arco, e existe um `beam()` para barra entre dois pontos quaisquer;
4. **o placar estava dentro do poço de saltos**, uma parede preta plantada na água;
5. **dois dos quatro mastros de luz caíam dentro da nave coberta**, porque eram
   postos como deslocamento a partir do poço em vez de ponto fixo.

Mais um que era de arquitetura e não de código: a marquise da bancada dos saltos
era uma laje plana de 26 m em balanço e lia como uma mesa gigante escondendo a
bancada inteira. Virou pergolado inclinado.

Evidências: [oblíqua](docs/aquatics/oblique.jpg), [planta](docs/aquatics/plan.jpg),
[fachada](docs/aquatics/facade.jpg), [torre](docs/aquatics/tower.jpg),
[interior sem cobertura](docs/aquatics/interior.jpg),
[orçamento](docs/aquatics/modelo.json).

**A peça está na cidade desde 09/09/2026, à noite.** O fundador viu a laje vazia
em produção e apontou: "o parque aquático aparece em produção apenas como a placa
branca, não tem nada em cima". Estava certo, e era o que faltava fechar:

| | |
|---|---|
| GLB publicados | `public/city/dog-aquatics-base.glb` (27.900 B) e `-detail.glb` (46.472 B) |
| loader | `aquatics-loader.ts`, o contrato de rede do atletismo |
| detalhe | só desktop, fora de economia de dados, a menos de 1.100 m e após 600 ms parado |
| sombra | a casca projeta mas não recebe (acne em superfície clara e curva) |
| pouso | por `comPodioAquatics`: a peça acha o topo do pódio e assenta rente |
| chapa | 267 chamadas e 4,85M triângulos na oblíqua, **sem erro de console** |

O que ainda NÃO existe: cais e casa de barcos para THE REACH, a reserva publicada
no gerador, e a peça não foi vista em telefone físico.


## A rodada do parque, 09/09/2026 à noite

⚠️ **O DIAGNÓSTICO VEIO DO FUNDADOR E ERA DE ARQUITETURA, NÃO DE PROGRAMA:** *"tudo
foi melhorado no mapa, menos o parque aquático, ele está 2 níveis abaixo das outras
estruturas da cidade"*. Ele estava certo, e a competição não tinha nada a ver com
isso: o tanque estava na norma, a torre lunar verificada, o poço de apneia medido e
a galeria submersa desenhada. O que faltava era **o edifício público em volta da
competição**. Medido antes da rodada:

| | esta peça | DOG Athletics |
|---|---:|---:|
| triângulos | 16.850 | 25.706 |
| transferência | 74.372 B | 129.172 B |
| árvores | **0** | plantio no anel |
| madeira, areia ou relva na peça | **0 m²** | pista e relva |

Uma peça de 324 × 180 m inteira em concreto, bege e vidro, com as bacias cravadas
no piso sem borda, sem orla e sem nada em volta. De cima ela lia como
estacionamento com retângulos azuis.

### O que entrou, e o porquê de cada um

| item | o defeito que ele corrige |
|---|---|
| **piscina de ondas** | o programa a previa desde o início (tabela "fora da norma") e ninguém a construiu. O lido NORTE virou a bacia: casa de máquinas numa ponta, praia de areia de 12 m na outra, seis cristas. Nenhuma medida de competição se moveu e o sítio não cresceu |
| **átrio de entrada** | a nave não tinha porta. Havia uma marquise de 44 m sobre três pilares em cada lado longo, sem hall, sem degrau e sem nome. Agora: vidro de 18 m, marquise de laje, cinco degraus na largura toda e `DOG AQUATICS` na empena, na matriz 5x7 da casa |
| **lanternim** | a clarabóia da crista era só material de vidro em dois gomos, e de fora lia como listra azul pintada no telhado. Virou caixa elevada 3,2 m com vidro VERTICAL dos dois lados |
| **nervuras de 1,15 m** | eram 0,55 m sobre um vão de 140 m, ou seja sombra nenhuma: a casca saía lisa e a nave lia como galpão |
| **orla de madeira e coping** | as bacias eram recortes crus no concreto, sem borda e sem onde andar descalço |
| **deck e guincho do poço de apneia** | o equipamento mais raro da peça (1 atm no fundo) aparecia como mancha escura no chão. Ganhou anel de madeira, quatro passarelas radiais e a plataforma de partida com guincho |
| **seis faixas de canteiro** | da fachada leste até a orla do poço eram 45 m de concreto liso, e das bancadas de saltos à divisa outros 40. Faixa paralela também resolve caminho: entre dois canteiros sobra passeio |
| **elevador de vidro e treliça na torre** | ela lia como bloco de escritório listrado. A caixa de vidro correndo a altura inteira diz que aquilo se sobe |
| **42 peças de mobiliário e 36 árvores** | zero vegetação numa cidade que planta em toda calçada. Instanciadas e fundidas por `D.instance` + `merge_object`, nunca reconstruídas por posição |

### O custo, medido

| | antes | depois | teto do build |
|---|---:|---:|---:|
| triângulos, base | 3.602 | 6.216 | 18.000 |
| triângulos, total | 16.850 | **24.556** | 70.000 |
| transferência | 74.372 B | **139.596 B** | 500.000 B |
| texturas | 0 | 0 | 0 |

A peça passou a pesar como o DOG Athletics (139.596 contra 129.172 bytes), que é
onde ela deveria estar desde o começo: mesma família, mesmo porte de sítio.

⚠️ **O QUE O `assert` DO ENVELOPE PEGOU, e vale registrar porque é a armadilha
desta peça:** a primeira versão do átrio avançava 9 m de vidro, 14 de marquise e
mais 5 de escadaria, e o build falhou com a peça **5,29 m fora do lote**. O sítio
acaba em y = −90 e o pavimento em −78. Hoje o vidro para em −76, a marquise em −80
e o último degrau em −84,4. O verificador de envelope é o que impede uma peça de
invadir a rua, e ele fez o trabalho dele.

⚠️ **AINDA NÃO FOI VISTA NA CENA.** Os GLB estão publicados e o gerador passa em
todos os verificadores, mas a chapa da `/city` não saiu: a live estava no ar e as
duas cidades não cabem na mesma GTX 1650 (medido: 74% de GPU e 2.364 de 4.096 MiB
com a aba da transmissão aberta, três corridas do portão estouradas em 480 s). As
evidências desta rodada são os renders do próprio gerador, em Cycles CPU.



## A cobertura, refeita em 10/09/2026: a abóbada de vela em malha lamela

⚠️ **O FUNDADOR REPROVOU O TELHADO EM UMA FRASE:** *"o teto genérico do galpão das
piscinas parece uma fábrica"*. Foram chamados três projetos independentes, com
cadeiras diferentes (casca estrutural, luz e matéria, forma como sinal urbano), e
**os três acharam a mesma causa sem falar entre si**, que não era acabamento:

> A casca era uma EXTRUSÃO. Um arco de 12 gomos arrastado ao longo de X, com dois
> tímpanos cegos nas cabeceiras e um monitor longitudinal no topo. Monitor contínuo
> sobre planta quadrada é o arquétipo literal do galpão, e nenhuma nervura conserta
> isso, porque o defeito é a lei de formação da superfície.

E os três apontaram o mesmo agravante, que é o mais constrangedor: **casca opaca,
lanternim e clerestório existem para resolver chuva, vento e neve, e esta cidade é
pressurizada sob uma abóbada.** A cobertura imitava um invólucro de intempérie num
lugar sem intempérie. A rodada de 09/09 (nervura de 0,55 para 1,15 m, lanternim
virando volume) tratou o sintoma e deixou a causa de pé.

### Os três partidos, e por que este

| partido | o que era | custo | por que não |
|---|---|---:|---|
| duas naves cruzadas | envelope `max(arco(u), arco(v))`, quinas caindo na parede, lunette nas quatro fachadas | +1.000 tri | o mais seguro e o menos radical: continua casca fechada, e a 3 km a mudança são 9 px de bisel |
| sete lajes e seis rasgos | relógio solar: pente de cinco lâminas de sol varrendo os 50 m durante 81 h por mês lunar | 27.176 tri | o mais bonito no papel, com o melhor achado (a lâmina atravessa a clarabóia da galeria submersa 5x por mês), mas tem risco **binário**: se a casca da cidade difunde em vez de transmitir, não existe lâmina nenhuma, e isso vive no material do domo |
| **malha lamela vazada** | **a cobertura deixa de vedar e vira só estrutura** | **28.924 tri** | **escolhido pelo fundador** |

### O que foi construído

| | |
|---|---|
| superfície | abóbada de vela, calota de **R 243,8 m** cortada pelos quatro planos da parede |
| nasce em | **23,00 m nos quatro cantos**, exato |
| meio de cada lado | 33,74 m |
| coroa | **44,00 m** (era 38,60) |
| vazado | **94%**: o que enche os losangos é a abóbada da cidade |
| apoio | quatro pilares de canto de 4,0 × 4,0 m |
| nervura primária | 0,30 × 1,30, paralela às diagonais, malha de 16 m |
| nervura secundária | 0,16 × 0,55, intercalada a 8 m |
| arco de borda | 0,55 × 2,20, que recolhe o empuxo e leva aos cantos |
| lunetas | quatro, 140 m × 10,74 m no meio, **4.010 m² de vão livre, sem uma placa de vidro** |
| brise | lâminas a cada 1,20 m, corta tudo abaixo de 31° |
| altura livre sobre a água | **38,8 m no pior canto**, contra o mínimo de 25,0 |

⚠️ **A ESBELTEZ É O ARGUMENTO, E ELA SÓ EXISTE A 1/6 g.** O arco diagonal vence
**198 m de vão com 1,30 m de altura, ou seja 1/152**; um arco terrestre do mesmo
vão pede de 2,5 a 3,3 m. O empuxo de **3,81 MN por lado** é segurado por 20
cordoalhas de 15,2 mm escondidas na cabeça da parede, e é por isso que a cinta
protendida virou apenas uma cornija escura de 60 cm. Na Terra a mesma casca pesa
1.407 Pa em vez de 230, o anel pediria **201 cordoalhas** (vira viga de borda, que
vira pilar, que vira contraforte) e o fator contra flambagem global cai de **15,0
para 1,46**: na Terra este desenho não fica caro, ele **flamba**.

⚠️ **E A ACÚSTICA FOI O GANHO QUE NINGUÉM TINHA PEDIDO.** A nave tem 69 m³ por
lugar (uma sala de concerto trabalha com 8 a 12) e nenhum forro resolveria isso. Com
teto sólido o RT60 calculado é de **14,9 s**; vazada, **3,30 s**. O número é razão
de projeto e não promessa: Eyring pressupõe campo difuso em sala fechada, e aqui um
quarto da superfície é buraco de verdade. Medir isso direito é trabalho em aberto,
como o Froude do nadador.

### O que morreu, e por que não volta

A casca CANOPY opaca de 12 gomos, o lanternim de 11,0 m com vidro vertical, os dois
gomos de vidro da crista e a faixa de clerestório de 1,6 m que existia só para
fechar uma fresta. Nenhum deles tinha função sob a abóbada. Quem trouxer qualquer um
de volta está reintroduzindo a resposta de intempérie que fez o fundador reprovar a
peça.

### Aberto

- [ ] **o mapa de sombra pode cintilar.** Mapa de 2.048 sobre um sítio de 324 m dá
      **0,158 m por texel**: a nervura primária de 0,30 m ocupa 1,9 texel e a
      secundária 1,0, abaixo do que qualquer PCF resolve. A base é um objeto só,
      então `castShadow` é tudo ou nada. Medir com `?stats=1` na `/city` e decidir
      entre aceitar o cintilar da trama ou perder a sombra de 140 m que assenta o
      prédio. **Não medido: a live estava no ar e a GPU não comporta as duas cidades.**
- [ ] a peça vazada mostra o interior de cima, o que é ganho, mas nunca foi visto
      na cena.



## Árvore genérica sai, e a peça é otimizada, 10/09/2026

⚠️ **A REGRA QUE FICA: ESTA PEÇA NÃO CARREGA ÁRVORE NO GLB.** O gerador plantava 36
árvores com `D.palm` e `D.street_tree` do `lib_dogcity`, e o fundador cortou:
*"temos muitas árvores no projeto, essas genéricas não devem ser usadas"*. A cidade
tem acervo (`palm-tall`, a tamareira de 16,1 m com o corte diamante, escolhida
vendo as três candidatas em EEVEE) e tem quem plante (`props-table.ts`, com
instância, LOD e corte por distância). As 20 palmeiras da orla entram por
`palmeirasDoAquatics()`, em coordenadas de mundo, e custam uma matriz cada num
InstancedMesh que a cena já tem carregado.

### O que a otimização achou, e ela só foi possível porque passou a medir

O build imprimia o total e nunca o custo POR BLOCO, e sem isso cortar detalhe é
palpite. Com a medição por função, o alvo apareceu na primeira linha:

| bloco | antes | depois | o que mudou |
|---|---:|---:|---|
| `detail/seating` | 9.888 tri, **74.888 B** | 3.296 tri | a caixa de assento tinha 12 triângulos e **metade nunca foi vista**: numa fileira contínua encostada no degrau, fundo, laterais e costas são cegos. Sobra topo e frente, 4 triângulos |
| `detail/structure` | 3.760 tri | 3.088 tri | o brise virou duas faces em vez de caixa, e ganhou as DUAS cores que o projeto pedia: GRAPHITE embaixo (é ela que mata o véu na lâmina) e CANOPY em cima |
| `detail/furniture` | 1.792 tri | 1.312 tri | os dois pés de 9 cm da espreguiçadeira saíram: vivem sob um assento a 30 cm do chão e não são vistos de pé nenhum |
| árvores | 4.280 tri, 46.488 B | **0** | saíram para o acervo |

### O resultado

| | antes do parque | com parque e abóbada | **agora** | teto |
|---|---:|---:|---:|---:|
| triângulos | 16.850 | 28.924 | **16.900** | 70.000 |
| transferência | 74.372 B | 168.596 B | **101.736 B** | 500.000 B |
| chamadas de desenho | 20 | 27 | **25** | 16 na base |
| texturas | 0 | 0 | **0** | 0 |

**A peça ganhou abóbada nova, parque, piscina de ondas, átrio e mobiliário pelo
mesmo número de triângulos que tinha antes de tudo isso.**

### E a carga ficou preguiçosa de verdade

⚠️ **A BASE BAIXAVA SEMPRE, E AGORA SÓ BAIXA DENTRO DO ALCANCE.** O pedido saía no
primeiro quadro com a cidade aberta, sem olhar distância: quem entra na praça
central e nunca cruza a avenida de 90° pagava 55 KB por uma peça que o `cull` nem
desenha. A margem de 20% no raio (44% em distância ao quadrado) existe para a carga
terminar antes de a peça entrar no alcance, senão o conserto viraria pop-in, que é
pior que o desperdício.


## A parcela do Sítio A, fechada em 09/09/2026

`AQUATICS_MOD = { i: 11, nr: 3, j: 34, ns: 2 }`, em `app/city/plaza/aquatics.ts`.
Dois módulos da banda Bairro, rumo **72,96 a 81,32°**, r 3.024 a 3.564,
**25,47 ha**. O chão está no ar; a peça ainda não.

### Por que dois módulos e não cinco

O primeiro levantamento recomendava cinco módulos (a faixa inteira entre as
avenidas de 60° e 90°). **A medição contra as vias publicadas derrubou isso:**

| parcela | rumo | área | via mais próxima |
|---|---|---:|---|
| **j=34, ns=2** | 72,96 a 81,32° | **25,47 ha** | anel AN3 a **+43,2 m** |
| j=32, ns=3 | 68,68 a 81,32° | 38,4 ha | anel AN3 a +43,2 m |
| j=30, ns=4 | 64,39 a 81,32° | 51,4 ha | autopista AU2 a **−19,0 m** |
| j=28, ns=5 | 60,10 a 81,32° | 64,4 ha | bulevar BUL02 a **−28,0 m** |

Negativo é invasão: nas parcelas de quatro e cinco módulos o eixo da via cai
dentro da parcela, que é exatamente o defeito que o BUL04 tem no $DOG ARENA e
que `campus.md` registra como "um defeito que ficou". Escolher a parcela grande
seria repetir de propósito um problema que a casa já paga em outro lugar.

E os dois módulos ainda são o terreno mais plano da faixa: **7,10 m de
amplitude**, contra 13,1 m dos recortes maiores e 33,1 m do campus.

### A cota, e o que ela custa

| | |
|---|---|
| terreno natural na parcela | −37,21 a −30,11 m |
| cota de equilíbrio medida | **−34,31**, publicada como −34,3 |
| corte | **0,175 Mm³**, 45,3% da área, máximo de 4,20 m |
| aterro | **0,171 Mm³**, máximo de 2,90 m |
| campus, para comparar | 2,74 Mm³ de cada lado |

**São 6% do que o campus custou**, e a diferença não é mérito de projeto: é o
terreno. Deste lado da avenida de 90° a amplitude é 7,10 m; do outro, 33,1 m.

### A laje e o sítio da peça

Mesma gramática do campus: franja de 34 m entre a divisa e a laje, calçada de
12 m na borda, laje de 1,5 m, muro de meio-fio descendo até o chão mais baixo em
volta. Topo do pódio em **−32,8 m**, e é aí que a peça pousa.

| | |
|---|---|
| lados da laje | 380,4 / 462,8 / 447,8 / 460,3 m |
| peça 324 × 180, centrada | rumo **77,143°**, folga de quina **38,0 m** |
| muro do pódio | 4,00 a 10,16 m |
| pior declive junto à borda da laje | **3,3%** |
| laje desenhada | 72 triângulos, uma chamada de desenho, sem sombra projetada |

Os 3,3% são o número que mais importa aqui: o campus registrou uma borda de laje
pousada em rampa de **66,2%** quando a franja foi medida na métrica errada, e é
esse defeito que o pódio novo não pode repetir.

**O comprimento da peça vai na tangente do anel**, como `estadio.ts` manda, e
isso põe a Torre de Saltos, que fica na ponta de maior rumo, virada para o canal
radial de 85°, a 147 m dali, que é onde THE REACH desemboca.

### `podio.ts`: a laje virou peça de biblioteca

As primitivas do pódio (recuo de polígono, franja contra as retas, tampa e
calçada pelo winding, muro que procura o chão mais baixo, porta rápida por raio
ao quadrado) saíram para `app/city/plaza/podio.ts`. Repetir isso na mão para cada
peça nova seria repetir também os três defeitos que o campus pagou para achar: a
franja medida em (raio, ângulo), a normal declarada em vez de tirada do winding,
e a laje projetando sombra.

⚠️ **`campus.ts` NÃO foi migrado**, de propósito: ele está no ar com três peças
pousadas em cima e a migração é risco sem ganho imediato. Dívida registrada.

### Onde ela entra na cidade

1. `terrain.ts`, dentro do `heightAt`: a terraplanagem entra depois do campus e
   antes do micro-relevo, com porta rápida própria. As duas parcelas não se
   tocam, então a ordem entre elas não importa;
2. `plaza-scene.tsx`, na máscara: `aquaticsParcela()` entra em `parcelas`, o que
   apaga as ruas internas do bloco e veda plantio;
3. `plaza-scene.tsx`, na cena: `criarAquatics()` desenha a laje.

`?aquatics=0` desliga as duas metades, `=chao` deixa só a terraplanagem e `=laje`
só a laje.

### O verificador

`npx tsx scripts/city/verificar-aquatics.ts`, dez testes, todos passando:

```
1. laje plana em -34.3 m: 5291 sondas, pior desvio 0.0000 m, nenhuma molhada
2. franja para na divisa: 6 m fora dela o chão está em -33.67 m
3. pior declive medido junto à borda da laje: 3.3%
4. peça 324 × 180 dentro da laje, rumo 77.143°, folga de quina 38.0 m
5. nenhuma via invade a parcela; a mais próxima é anel:AN3 a 43.2 m
6. nenhuma das 41 reservas publicadas colide com a parcela
7. muro do pódio: 4.00 a 10.16 m
8. peça pousa em y=-32.400 (topo -32.8 + folga 0.4), giro -77.143°
9. laje desenhada: 72 triângulos, 0 com normal para baixo, castShadow false
10. chão em volta da parcela: 440 sondas, média -35.35 m contra a cota -34.3 m
```

### A parcela vista na cena

Portão de chapas, duas vistas novas (`aquatics` e `aquaticstopo` em
`scripts/city/chapas.mjs`), Chrome com aceleração, qualidade alta:

| vista | chamadas | triângulos | evidência |
|---|---:|---:|---|
| oblíqua, do lado da praça | 341 | 6,15M | [cidade-obliqua.jpg](docs/aquatics/cidade-obliqua.jpg) |
| de cima, sobre a parcela | 77 | 4,64M | [cidade-topo.jpg](docs/aquatics/cidade-topo.jpg) |

O que as duas confirmam: a laje está no lugar com a calçada de borda legível, as
ruas internas do bloco sumiram (a máscara de parcela funcionou) e as de fora
continuam inteiras, e a oblíqua mostra a relação que justifica o sítio, com o
canal radial de 85° correndo entre a parcela e o campus esportivo.

⚠️ **Sete erros de console, nenhum desta frente.** São tempos de espera vencidos
no carregamento de GLB do Winter Park (`inverno.ts`: `tree-pine`, quatro
`sq-*` e `rocks-stylized-pack`, todos "sem resposta em 45.000 ms"), que é
congestionamento de thread principal em servidor de desenvolvimento e já aparece
em conferências anteriores desta cidade. Nenhum deles cita a parcela nova.

⚠️ **O custo de terra não é conferível depois que a terraplanagem entra em vigor,
e duas versões deste teste erraram até isso ficar claro.** `heightAt` já passa
por `aquaticsAlturaAt` e devolve a cota dentro da laje, então a conta media a
rampa da franja e acusava 48% de desequilíbrio; `baseAt` erra para o outro lado,
porque é o heightmap com a saia e sem o pódio da abóbada, e diz que o natural
ali vai de −70,68 a −21,09 quando o chão que a cidade tem vai de −37,21 a
−30,11. `campus.md` já registrava a mesma lição nos limites dele. O teste 10 é o
que sobrevive: a cota tem de ficar perto do chão em volta da divisa.

## O que falta decidir antes do primeiro traço

1. **Alargar ou não o trecho de prova do canal** de 100 para 108 m, o que troca
   0,08 Mm³ de terra por conformidade com as 8 raias da norma.
2. **Se a marina da baía entra nesta frente** ou vira uma terceira peça depois.
3. **Publicar a reserva no gerador** (`gerar_cidade.py`), para que o loteamento
   futuro do snapshot já nasça conhecendo a parcela.

## Limites deste documento

Nada aqui foi verificado em navegador, nenhuma linha de código foi escrita e
nenhuma reserva foi publicada. Todas as medições de terreno são de 09/09/2026,
offline, contra `buildTerrain` sobre `btc-core-heightmap.f32` com os canais e o
leito de `cidade-malha.json`, sondando a cada 10 m dentro da parcela e a cada
0,02° no corte do canal. Corte e aterro saem da cota que equilibra os dois, com
área de 100 m² por sonda, o mesmo método de `campus.md`. Não valida lotes do
snapshot (que ainda não existem), não mede carga de GLB, FPS nem GPU, e não
confere colisão com as 69 reservas reencaixadas, só com as 71 publicadas.
