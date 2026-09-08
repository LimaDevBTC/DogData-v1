# O campo de golfe

Plano da peça GF01, aberto em 08/09/2026. Nada implementado ainda: a reserva
existe desde 30/08 e **não tem desenho nenhum**. Este documento é o levantamento,
a física, o sítio novo medido e as decisões travadas.

## O pedido, e a decisão de escala

O fundador abriu a frente em 08/09/2026 junto com o hipódromo e travou a escala:
**18 buracos curtos**, o par 3 lunar. As outras duas saídas medidas foram
recusadas com número na mesa:

| saída | percurso | área | por que caiu |
|---|---:|---:|---|
| escala lunar cheia | 39,2 km | **21,9 km²** | metade do tecido urbano da cidade, e não lê como campo numa chapa aérea |
| **18 buracos curtos** | **8,6 km** | **1,6 km²** | escolhida |
| escala terrestre, 84 ha | 6,5 km | 0,84 km² | um único drive voa 1.509 m e atravessa quatro buracos |

⚠️ **A área escala com o QUADRADO, não com a distância.** Um campo terrestre de
60 ha em escala lunar pede 60 × 6,035² = 2.186 ha, porque comprimento e largura
crescem juntos. É o número que mata a escala cheia, e ele não é óbvio.

## 1/6 g: o saco de tacos encolhe

Mesma tacada, mesma velocidade de saída, alcance multiplicado por **6,035** (a
mesma razão de `plano-diretor.md` §5.3).

| Taco | Alcance na Terra | Alcance na DogCity |
|---|---:|---:|
| lob wedge | 60 m | **362 m** |
| sand wedge | 80 m | **483 m** |
| pitching wedge | 100 m | **604 m** |
| ferro 9 | 120 m | **724 m** |
| ferro 7 | 140 m | 845 m |
| ferro 5 | 160 m | 966 m |
| madeira 3 | 200 m | 1.207 m |
| driver | 230 m | 1.388 m |

**Do lob wedge ao ferro 9 cobre o campo inteiro. Driver e madeiras não têm uso e
ficam fora do saco.** Isso é a regra da casa e é o que dá identidade ao campo:
todo buraco é uma tacada de aproximação, e todo par é 3. Par total **54**.

O voo de uma tacada de sand wedge (483 m, saída a 45° e 28,0 m/s):

| | Terra | DogCity |
|---|---:|---:|
| tempo no ar | 4,0 s | **24,4 s** |
| ápice | 20,0 m | **120,7 m** |
| altura livre da casca em r 6.900 | | 2.810 m, folga de 23× |

Vinte e quatro segundos de bola no ar é o conteúdo visual da peça: a câmera
acompanha o voo inteiro, coisa que nenhuma transmissão de golfe terrestre pode
fazer.

⚠️ **O 6,035 é balístico sem arrasto, e para golfe essa premissa é frágil.** Sob a
abóbada há ar a 1,225 kg/m³, e um voo seis vezes mais longo acumula seis vezes
mais arrasto: o alcance real fica **entre 3× e 6×**, não em 6,035. O plano diretor
usa 6,035 para salto e voo, onde a aproximação é boa; aqui não é. A peça é
dimensionada pelo limite superior de propósito, porque **encolher green e fairway
depois é seguro e crescer não**. Calcular o alcance com arrasto é trabalho em
aberto e está listado nos limites.

## A geometria do campo

| | |
|---|---|
| buracos | 18, todos par 3 |
| distância por buraco | 362 a 724 m, média **480 m** |
| jogo | 8,64 km |
| travessia green a tee | 17 × 120 m = 2,0 km |
| **caminhada total** | **10,6 km** |
| corredor de jogo | 100 m de largura |
| green | 80 m de diâmetro, 0,50 ha cada, 9,0 ha nos 18 |

A caminhada de 10,6 km é o número que justifica a escolha: um campo terrestre de
18 buracos caminha cerca de 9 km, então **o campo lunar curto se joga a pé, na
mesma jornada de um campo normal**, sem buggy e sem veículo pressurizado.

A largura de 100 m sai da dispersão: um erro de saída de 5° em 480 m desvia
41,8 m, e ±50 m de corredor perdoa até 6,0°. Fairway terrestre tem 40 a 60 m.

⚠️ **O green é um campo e o putter vira taco de distância.** O atrito de rolamento
também cai por 6, então um putt de 20 m na Terra rola 120 m aqui. Um green de
80 m atravessado exige tacada, não toque. Duas saídas, **nenhuma escolhida**:
copo maior que os 108 mm da norma, ou green com contra-inclinação que freia a
bola. É regra de jogo, não geometria, e pode ser decidida depois da peça.

## O sítio muda de lugar, e o motivo é medido

O GF01 está hoje em r 6.682, rumo 315°, posto por rumo e φ em 30/08 sem passar
pelo alocador. **Ele nasceu no distrito industrial:**

| | sítio atual (rumo 315°) | **sítio proposto (rumo 171°)** |
|---|---:|---:|
| Fábrica de Célula Solar | **1.377 m** | 12.515 m |
| Fundição e Laminação | 2.306 m | mais longe ainda |
| Beneficiamento de Ilmenita | | 3.628 m |
| estação de metrô | 4.721 m | **2.303 m** |
| Lago do Poente, borda a borda | | 783 m |

Sítio proposto: **centro em r 6.900, rumo 171°, pegada de 2.000 m de arco por
800 m de radial, 160 ha**. O bloco vai de 162,7° a 179,3° e de r 6.500 a 7.300.
O sítio publicado ficou 158 m mais para dentro; a seção seguinte tem os números
como construído e a troca que isso custou.

Por que este e não outro, medido em varredura de 21 rumos × 3 raios com pegada de
2.000 × 800 sondada a cada 25 m:

- **Seco.** 0,0% de ponto abaixo da lâmina de −40 m em 3.577 sondas.
- **Relevo na faixa jogável.** Amplitude de 54,3 m, declive mediano de **2,72°**
  e p90 de 8,06°, máximo de 12,89°. Fairway aceita até 10% (5,7°) com folga e
  campo de montanha vai a 15% (8,5°); green pede 2 a 4%. Ou seja **o fairway
  acompanha o chão natural e só os 18 greens e os tees são escavados.**
- **Não custa lote.** O lote mais externo na faixa de rumo 165° a 175° para em
  4.419 m: são **2.081 m de folga** até a borda interna do campo. Medido nos
  85.830 lotes de `cidade-lotes.bin`.
- **Não custa terraplanagem de sítio.** Diferente do campus, que pagou 2,74M m³
  para ficar plano, o golfe **quer** a ondulação. O relevo é o produto.
- **Tem acesso sem cruzar via.** O bloco fica entre a Avenida de Escoamento
  (AN6, r 6.300, 200 m de folga) e a Pista de Serviço (AN7, r 7.600, 300 m), sem
  cruzar nenhuma das duas, e o **Bulevar 180° raspa a ponta a 84 m da borda**: é
  ali que o clubhouse nasce.
- **Está dentro da abóbada**, logo tem ar, como as fazendas e os lagos de pesca.

⚠️ **O contraste de relevo dentro do bloco é feição, não defeito.** A borda
interna (r 6.500) tem declive médio de 4,6°, e a externa (r 7.100 a 7.300)
encosta no platô do pódio da abóbada, que é rigorosamente plano: **0,00° em todos
os 360 rumos, cota 13,00 m, 200 m de largura, 44,30 km de perímetro, 886 ha**.
Um campo com nove buracos de duna e nove de planície é projeto, não acidente.
Registrado porque ninguém tinha notado que esse anel existe e está vazio: três
peças de programa em 360° de volta.

## Como saiu, medido na publicação de 08/09/2026

A reserva foi movida em `scripts/gerar_cidade.py` e publicada. **O assentador não
obedece ao raio pedido, e nisto ele acertou mais que o plano:** `assenta_no_cinturao`
encosta a peça num anel viário por um lado e num bulevar pelo outro, e a vaga que
ele escolheu é AN6 + (34/2 + 400 + 25), ou seja **r 6.742**, e o Bulevar 180°
menos o meio-arco de 8,855°, ou seja **rumo 171,144°**.

| | plano | **publicado** |
|---|---:|---:|
| centro | r 6.900, rumo 171,0° | **r 6.742,4, rumo 171,144°** |
| faixa radial | 6.500 a 7.300 | **6.342 a 7.142** |
| pegada | 2.000 × 800 m, 160 ha | **2.000 × 800 m, 160,00 ha**, arco de 17,00° |
| Avenida de Escoamento (AN6) | 200 m de folga | **42 m: testada** |
| Bulevar 180° | 84 m da borda | **42 m: testada** |
| estação de metrô | 2.303 m | **2.149 m** (E060, na radial do Bulevar 180°) |
| lote mais próximo | 2.081 m | **1.320 m**, e **zero lotes** dentro da pegada |
| indústria mais próxima | 3.628 m | **3.535 m** (IN01) |
| Lago do Poente, borda a borda | 783 m | **539 m** |
| água sob a peça | 0,0% | **0,00% em 16.281 sondas** |

⚠️ **O terreno publicado é mais bravo do que o plano previu, e o número é este.**
Descer 158 m em raio afasta a peça do platô do pódio, onde o chão é chapado, e a
ondulação cresce:

| | plano (r 6.900) | **publicado (r 6.742)** |
|---|---:|---:|
| amplitude | 54,3 m | **73,9 m** (cota 13,0 a 86,9) |
| declive médio | 3,56° | **4,39°** |
| declive p50 | 2,72° | **5,11°** (8,9%) |
| declive p90 | 8,06° | **8,46°** (14,9%) |
| declive máximo | 12,89° | **12,80°** (22,7%) |

O p50 de 5,11° continua dentro da faixa de fairway, que aceita até 10%, e o p90
de 8,46° fica no limite dos 15% de campo de montanha. O máximo de 12,80° é
declive de talude: **ali vai rough, não fairway**, e é o desenho da peça que tem
de respeitar isso. A troca aceita é explícita: **2,4° a mais de declive mediano em
troca de duas testadas de via**, uma avenida de carga e um bulevar, que o sítio
livre de r 6.900 não tinha.

A vizinhança deixou de ser industrial e virou o que golfe pede: **Estação do
Poente a 184 m** (infra, 10,4 ha), Lago do Poente a 539 m, Hortas do Cinturão a
1.065 m, Portão da Abóbada a 1.099 m, e as bocas das Autopistas 1 e 3 a cerca de
650 m, sendo que a AU3A está praticamente no mesmo rumo do campo (171,6°).

**O que a mudança custou ao resto da cidade: nada.** Duas rodadas completas do
gerador, uma antes e uma depois da edição, contra o mesmo dado de carteiras:

- **1 peça alterada de 71.** Só a GF01.
- **`cidade-lotes.bin` byte a byte idêntico**: nenhum dos 85.801 lotes se mexeu.
- Carteiras, plantadas, área de lote (25,765 km²), mediana (190 m²), lote menor,
  lote maior, tecido disponível, quarteirões, quartos e enclaves: **todos iguais**.
- Único número que mudou: `programaHa`, de 1.619,7 para **1.695,4**, que são os
  75,7 ha de crescimento da peça.

⚠️ **A rodada de hoje não bate com o `cidade.json` que estava publicado, e a causa
não é esta mudança.** O publicado era de 03/09 com 85.830 carteiras, mediana de
187 m² e 25,488 km² de lote; o dado de `data/dog_utxos_by_address.json` foi
atualizado pelo bot às 18:33 de hoje e a cidade agora tem **85.801 carteiras**,
mediana de **190 m²** e **25,765 km²**. Foi para separar as duas coisas que a
baseline foi rodada antes da edição.

## Referência do projeto

Golfe é o único esporte já praticado na Lua: Alan Shepard bateu duas bolas com um
6-ferro adaptado na Apollo 14, em 6 de fevereiro de 1971, em Fra Mauro. É fato
público e é o lastro da peça. O nome dela não está escolhido; candidatos, no
padrão de $DOG ARENA, DOG Athletics e DOG DERBY: **DOG LINKS** (recomendado),
**PAR 54**, TRANQUILLITY LINKS.

## Sequência proposta

1. ~~Mover a reserva no gerador~~ **FEITO em 08/09/2026.** `_PROD` em
   `scripts/gerar_cidade.py` passou de `rumo_de_raio(300.0), 5700.0, 620.0, 340.0`
   para `rumo_de_raio(171.0), 7650.0, 1000.0, 400.0`. O φ de 7.650 é o número que
   põe r0 exatamente na vaga da AN6, para o custo de raio ser zero; ele **não é o
   endereço**, é o ponto de partida do assentador.
2. ~~Conferir que `assenta_no_cinturao` não empurra a peça~~ **FEITO.** Ele
   empurra, e para o lugar certo: r 6.742 com testada dupla.
3. Escrever `app/city/plaza/pecas/GF.ts`, que hoje não existe: prancheta com 18
   corredores, greens, tees, bunkers de regolito e clubhouse na ponta do
   Bulevar 180°. O desenho tem de pôr rough onde o declive passa de 10% e
   escavar os 18 greens, que pedem 2 a 4%.
4. Escrever `scripts/city/verificar-golfe.ts` com as checagens que rodaram à mão
   nesta frente: zero lote na pegada, zero água, declive por percentil, testada
   de via, folga de vizinho e raio externo contra a casca.
5. Só então decidir modelo 3D próprio ou massa.

## Limites

O alcance de 6,035 é balístico sem arrasto e está declarado como frágil acima.
Alcance por taco é dado terrestre de amador médio, premissa e não medição. O
relevo, a água, os declives, as distâncias e a folga de lote são medidos contra o
heightmap real em 08/09/2026, com o mesmo exagero vertical e pódio de `altura()`
em `scripts/gerar_cidade.py`. Nada foi conferido em navegador porque nada foi
construído. A reserva cresceu de 84,32 para 160,00 ha, e essa era **a única
parte deste par que CRESCIA**: por isso ela foi feita primeiro, e agora está
dentro do snapshot. Encolher depois continua seguro.

⚠️ O `verificar-golfe.ts` do passo 4 ainda não existe, então tudo o que está na
seção "Como saiu" foi medido por script de uma vez, no scratchpad, e não é
reproduzível por comando. Enquanto ele não existir, quem mexer em `meia_a`,
`meia_b` ou nos anéis viários move a peça sem que nada acuse.
