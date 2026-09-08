# DOG DERBY, o hipódromo

Plano da peça E02, aberto em 08/09/2026. Nada implementado ainda: este documento
é o levantamento, a geometria medida e as decisões travadas. O código continua
como está.

## O pedido

O fundador abriu a frente em 08/09/2026: "quero começar o planejamento do
hipódromo e do campo de golf, 2 elementos importantes visualmente pro projeto".
Na mesma conversa travou três coisas, e elas mandam no resto do documento:

1. **As duas pistas ovais da cidade ficam, diferenciadas.** O Coliseu da Batalha
   de Preço continua sendo a arena da batalha e o E02 vira hipódromo de verdade.
2. **Quem corre é galgo, e o evento é o DOG Derby.** A cidade se chama DogCity e
   o inventário do plano diretor já traz 12 caninódromos.
3. Nada congelado se mexe: o enquadramento de câmera da Batalha e a peça 3D do
   Coliseu ficam intocados.

## Já existiam três hipódromos, e ninguém tinha contado

| peça | onde | o que é hoje |
|---|---|---|
| **E02 Hipódromo** | r 3.115, rumo 140,625° | reserva de 60,26 ha e desenho de prancheta em `app/city/plaza/pecas/E02.ts` |
| **Coliseu da Batalha** | r 2.998, rumo 225,0° | peça 3D construída em `app/city/plaza/coliseu.ts`, congelada |
| inventário do plano diretor | 8 complexos | 12 caninódromos de 2.500 m², nunca desenhados |

⚠️ **`coliseu.ts` abre declarando que não é coliseu.** A primeira linha do
cabeçalho é "NÃO É COLISEU, É HIPÓDROMO", e a justificativa é proporção medida:
o campo da batalha tem 458 × 240 m (1,91) contra 1,21 do Coliseu de Roma e 5,26
do Circo Máximo. Ou seja a cidade tem duas peças da mesma tipologia a **4.106 m**
uma da outra, no mesmo anel. A decisão de 08/09 é mantê-las, e o preço disso é
que as duas precisam ler diferente na chapa: o Coliseu é linha de tropa em cova,
o Derby é anel inclinado. Se as duas saírem ovais e claras, a repetição aparece.

## 1/6 g reescreve a pista, e este é o número que decide

Com g = 1,625 m/s² a tração cai na mesma proporção do peso, então **a força
lateral disponível numa curva cai por 6,035** (a mesma razão de `plano-diretor.md`
§5.3). A velocidade do galgo não cai: ela é de passada, não de tração.

Premissas declaradas, de dado terrestre de galgo de corrida, **não medidas aqui**:
velocidade média 17,0 m/s, pico 19,4 m/s (70 km/h), coeficiente de atrito de
garra em areia compactada μ = 0,7.

| | Terra | DogCity |
|---|---|---|
| Aceleração de tração (μg) | 6,867 m/s² | **1,138 m/s²** |
| Largada até 19,4 m/s | 2,8 s em 27 m | **17,1 s em 165 m** |
| Raio de curva a 19,4 m/s, pista plana | 54,8 m | **331 m** |

⚠️ **Uma pista plana de galgo não existe aqui.** Pista de galgo terrestre tem
curva de raio 40 a 50 m; o mesmo cão a 19,4 m/s na Lua pede 331 m e sai voando
pela tangente. A curva **tem de ser inclinada**, e é a inclinação que vira a
assinatura visual da peça:

| Inclinação | Aceleração lateral | Raio mínimo a 19,4 m/s | Perímetro se for círculo |
|---:|---:|---:|---:|
| 0° | 1,138 m/s² | 331 m | 2.080 m |
| 15° | 1,936 m/s² | 194 m | 1.219 m |
| 20° | 2,320 m/s² | 162 m | 1.018 m |
| **30°** | **3,484 m/s²** | **108 m** | **679 m** |
| 38° | 5,312 m/s² | 71 m | 446 m |
| 45° | 9,208 m/s² | 41 m | 257 m |

## A geometria proposta

**Inclinação de 30° e raio de 120 m na linha de medição**, que é 11% de folga
sobre o mínimo de 108 m.

| | |
|---|---|
| desenvolvimento da pista | **900 m**, uma volta por prova |
| curvas | duas de 180°, raio 120 m, inclinadas 30° |
| retas | 73 m cada, a de chegada e a de fundo |
| largura da pista | 8 m |
| desnível da curva, borda a borda | **4,62 m** (8 × tan 30°) |
| envelope da pista | **321 × 248 m = 7,96 ha** |
| envelope com arquibancada | 420 × 330 m = 13,86 ha |

A prova de 900 m dura **54,9 s**: 17,1 s de largada nos primeiros 165 m e 37,9 s
a 19,4 m/s nos 735 restantes. Um galgo terrestre faz 900 m em cerca de 53 s, ou
seja **a corrida lunar tem a mesma duração da terrestre e um quinto dela é a
largada**. Isso é o roteiro da câmera: a partida é lenta e longa, e é onde a
prova se decide.

⚠️ **A forma deixa de ser oval alongado.** 73 m de reta contra 248 m de largura
dá uma peça quase circular: uma tigela inclinada, não um Longchamp. É o oposto
do que `pecas/E02.ts` desenha hoje (oval de 900 × 400 m com curvas de raio 190).
As curvas de raio 190 do desenho atual jogam o cão para fora a 19,4 m/s, e é por
isso que o desenho de prancheta vai ser refeito, não ajustado.

## O sítio, medido

A parcela E02 fica em r 3.115, rumo 140,625°, com 1.156 × 521 m e 60,26 ha.
Terreno seco em 9.570 sondas, amplitude de 33,5 m.

Nivelar a parcela inteira custaria **1,50M m³ de corte e 1,50M de aterro**, o que
é metade do campus esportivo. Não é preciso: **só a pista precisa de plano.**

Varredura de 45 posições da pista dentro da parcela, passo de 50 m no arco e 60 m
no radial, sondando a cada 10 m:

| posição no quadro local | amplitude sob a pista | terra movida |
|---|---:|---:|
| centro da parcela | 10,0 m | 138 mil m³ |
| **arco −150 m, radial +120 m** | **5,8 m** | **77 mil m³** |
| arco −100 m, radial +120 m | 6,0 m | 88 mil m³ |
| arco −200 m, radial +120 m | 6,9 m | 83 mil m³ |

Ou seja a pista assentada no ponto mais plano custa **5,1% do que a parcela
inteira custaria**, e os 60 ha restantes ficam no chão natural, com a inclinação
virando desenho de paisagem em vez de aterro.

⚠️ **O acesso é o defeito aberto desta peça.** A parcela vai de r 2.855 a 3.375 e
o Anel Médio (AN2) passa em 2.750: são **105 m de folga**, ou seja ela não tem
testada em via principal, ao contrário do que `programa.ts` exige de toda parcela
que passa pelo alocador (o E02 é posto à mão na tabela do gerador, não alocado).
E a estação de metrô mais próxima está a **1.977 m**, que é longe para peça de
multidão. Duas saídas, nenhuma escolhida ainda: uma alameda de ligação de 105 m
até o AN2, ou reendereçar a parcela como o atletismo foi reendereçado em 07/09.

## O programa de apoio, e o que muda por ser galgo

Sai: paddock de cavalo, quatro cavalariças de 90 × 18 m, balança, picadeiro.
Entra:

- **Canil de corrida** no lugar das cavalariças, com pátio de soltura.
- **Trilho da lebre mecânica** por dentro da raia interna, motorizado, sem
  mudança de projeto por causa da gravidade.
- **Reta de largada de 165 m**, que é medida e não decoração: é a distância em
  que o cão atinge o pico. As caixas de partida ficam no início dela.
- **Arquibancada na reta de chegada**, do lado externo, encostada na curva
  inclinada, que serve de parede visual da tigela.
- **Esplanada de escoamento**, pela regra do Green Guide já usada no plano
  diretor: 82 pessoas por metro de largura por minuto.
- Praça de apostas: **em aberto**, e é decisão de produto, não de projeto. Nada
  neste documento supõe aposta com valor.

Capacidade de público: **não calculada**, pelo mesmo critério do DOG Athletics.

## Sequência proposta

1. Reescrever `pecas/E02.ts` com a geometria de 30° e raio 120 m (prancheta, que
   é o registro de planta que o fundador travou em 31/08).
2. Assentar a pista no ponto medido (arco −150, radial +120) e publicar o
   terraplano de 77 mil m³ como pódio local, no padrão de `campus.ts`.
3. Resolver o acesso: alameda de 105 m até o AN2 ou reendereçamento.
4. Só então decidir se a peça ganha modelo 3D próprio, como o atletismo ganhou,
   ou fica em massa.
5. Renomear a peça de "Hipódromo" para o nome de produto. Candidatos, no padrão
   de $DOG ARENA e DOG Athletics: **DOG DERBY** (recomendado), THE DERBY,
   DOG DERBY PARK. **Não escolhido.**

## Limites

Velocidade, pico e μ do galgo são premissas de dado terrestre, não medição.
Os tempos de prova saem dessas premissas. A área da parcela, o terreno, a água,
as distâncias e os volumes de terra são medidos contra o heightmap real em
08/09/2026, com o mesmo exagero vertical e pódio de `altura()` em
`scripts/gerar_cidade.py`. Nada aqui foi conferido em navegador porque nada foi
construído. A reserva de 60,26 ha não muda de tamanho neste plano: encolher
depois do snapshot é seguro, crescer não.
