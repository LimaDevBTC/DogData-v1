# A água da DogCity: um nível, dois níveis, ou a boca consertada

Estudo aberto em 05/09/2026 por uma pergunta do fundador:

> "O canal central é bem mais alto que o nível da baía e dos canais radiais. Isso gera um
> problema de conexão e também nos obriga a construir eclusas. Não seria mais fácil apenas
> rebaixar a praça central e o canal circular central pra ficar tudo no mesmo nível?"

Três frentes independentes mediram (terraplenagem, dependências e partido urbano) e uma
síntese desempatou reproduzindo as medições que decidem. Nenhuma linha de código foi
escrita nesta rodada, de propósito.

## A resposta

**Não, rebaixar não é mais fácil: é a opção mais cara das quatro.** E a pergunta descreve
um defeito de desenho que se conserta por cerca de 1% do movimento de terra que esta casa
já aprovou uma vez.

## O estado real, medido

| o que | medida |
|---|---|
| degrau da pergunta | 33,5 m (Lago da Praça -6,5; baía, lagos e radiais -40) |
| água externa | baía, lagos e os três radiais JÁ coplanares em -40, degrau zero |
| crista das três bocas, em `superficieAt` | **-6,71 / -7,11 / -6,88 m** |
| folga de terra seca entre o lago e a vala do canal | **ZERO m** |
| rumos sem margem na bisseção do lago | 27 de 720 (3,8%), nas três bocas |
| sobreposição das duas lâminas | 98 a 100 m por rumo, com 33,5 m de ar entre elas |

⚠️ **O Lago da Praça está vazando agora.** A crista que deveria separá-lo dos três canais
está de 0,21 a 0,62 m ABAIXO da própria lâmina dele, medido na função que o lago usa
(`superficieAt`, por bisseção, como `lago.ts:227` manda). Não existe barragem. Não existe
soleira. Varrendo o eixo das bocas de 0,1 em 0,1 m entre r 1.300 e r 1.500, o terreno
nunca sobe acima de -6,5.

⚠️ **E o que se vê na tela é pior que o vazamento.** A bisseção da margem externa tem teto
em r 1.480; 27 rumos batem no teto e a lâmina do lago é emitida até r 1.510. Resultado: a
água a -6,5 fica desenhada POR CIMA da água a -40 ao longo de 100 m em cada boca, com
33,5 m de vazio entre as duas. **É isto que lê como "o canal central é bem mais alto".**

## O preço de cada caminho

| opção | volume | referência da casa |
|---|---|---|
| **ZERO**: aterrar as três bocas até uma soleira acima da lâmina | **0,06 a 0,2 Mm³** (estimativa) | ~1% dos 16,7 aceitos |
| **B**: rebaixar só a pegada molhada do lago até o leito -44 | 80,9 Mm³ | 4,8x o aceito |
| **A**: rebaixar o disco r 1.390 até -40, parede vertical | 209,2 Mm³ | 12,5x o aceito |
| A + talude de 30% / 15% / 8% | 230,1 / 263,0 / 351,9 Mm³ | o de 8% passa dos 276 recusados |
| A ampliada: r 1.800 / 2.500 / 3.500 / 4.500 | 372 / 801 / 1.694 / 2.990 Mm³ | até 179x o aceito |
| **C**: subir a água externa para -6,5 | 26.854 lotes submersos (31,3%) | descartada por número |

As referências são desta casa: **16,7 Mm³** foi o que se aceitou gastar para nivelar os
três radiais em 30/08, e **276 Mm³** foi o que se recusou a gastar nos canais de anel.

## A recomendação

**Não rebaixar. Consertar a boca, e assumir dois níveis de água ligados por queda, não por
navegação.**

Três motivos, um por linha:

1. **As duas cotas estão certas.** -40 é a linha de flutuação da cidade (subir afoga 31,3%
   dos lotes) e -6,5 foi decisão do próprio fundador em 02/09, quando ele subiu a lâmina de
   -17 para acabar com o barranco de pista de skate. Nivelar não conserta um erro: revoga
   uma das duas decisões.
2. **O preço está fora de escala.** A versão mais barata e honesta de rebaixar custa
   230,1 Mm³, quase a conta inteira que já matou os canais de anel uma vez.
3. **O que o fundador enxerga não é desnível, é lâmina pintada sobre lâmina.** Conserta-se
   por menos de 0,2 Mm³.

**O que se perde:** barco não sobe do canal até a Praça Central. Só isso. O Lago da Praça
não vende um metro de testada hoje: o lote mais próximo está em r 1.489 e a linha d'água em
r 1.405, ou seja 84 m de terra entre eles. O trecho que fica descontínuo é exatamente o
único que não custa dinheiro manter descontínuo. Em troca, as três bocas viram três quedas
de 33,5 m desenhadas, que é o que já acontece hoje, sem projeto.

## Os dois gatilhos para reabrir

1. **Se o produto decidir que o jogador leva um barco da Praça Central até a baía**, a
   opção zero morre no mesmo dia, e a resposta passa a ser rebaixar SÓ a pegada molhada do
   lago até o leito -44 (80,9 Mm³), com terraço em degraus para o muro de 33,5 m não virar
   fosso. Continua não sendo rebaixar a praça.
2. **Se a Fundação tiver que ser regerada por outro motivo** antes do mint, o custo
   marginal de mexer no centro cai e vale reprecificar o r 1.390 naquele momento, e só
   naquele momento.

Fora esses dois gatilhos, não reabrir.

## Duas notas de vocabulário e de honestidade

**"Eclusa" tem dois sentidos nesta cidade** e isso já produziu contradição entre dois
estudos. As três eclusas que a DogCity tem (`eclusas.ts`) são câmaras de pressão de
VEÍCULO em túnel sob a casca, com raio de 110 m. Elas não são eclusas de navegação e não
têm relação com este desnível.

**E eclusa de navegação não funcionaria aqui de qualquer forma:** a cidade não tem
afluente. Cada eclusagem joga água do lago para fora e ela só volta bombeada. Com cinco
câmaras de classe holandesa, 57 barcos derrubam o lago em 1 m, e ele tem 7,19 m de
profundidade média. Se vai existir bomba, o nível vira escolha livre e a pergunta volta ao
começo.

**O que é estimativa e não medição:** o aterro da soleira (0,06 a 0,2 Mm³) depende de onde
a soleira é assentada. Todo o resto desta página foi medido contra o `buildTerrain` real
sobre o heightmap da NASA, offline, sem navegador.
