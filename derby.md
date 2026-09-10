# DOG DERBY

Plano da peça E02, aberto em 08/09/2026. O nome está travado pelo fundador e a
peça já foi renomeada no gerador e no programa congelado; o desenho e a
geometria continuam por fazer. Este documento é o levantamento, a geometria
medida e as decisões.

⚠️ **Não é hipódromo, e a palavra importa.** "Hipódromo" carrega cavalo em
português, e aqui a prova é de galgo. O arquivo se chamava `hipodromo.md` até
08/09/2026 e a peça se chamava "Hipódromo" desde que entrou no gerador. O id
`E02` **não muda**: ele é a chave que `app/city/plaza/pecas/index.ts` usa para
achar o desenho, e trocar o id faz o módulo parar de ser chamado em silêncio.

⚠️ **E "caninódromo" não é sinônimo disto.** `plano-diretor.md:382` inventaria
12 caninódromos de 2.500 m², e 2.500 m² não é pista de prova: uma pista de 500 m
com 8 m de largura tem 4.000 m² só de pavimento. Aqueles 12 são áreas de soltura
de bairro. O DOG Derby é outra coisa, e são palavras diferentes de propósito.

## O pedido

O fundador abriu a frente em 08/09/2026: "quero começar o planejamento do
hipódromo e do campo de golf, 2 elementos importantes visualmente pro projeto".
Na mesma conversa travou três coisas, e elas mandam no resto do documento:

1. **As duas pistas ovais da cidade ficam, diferenciadas.** O Coliseu da Batalha
   de Preço continua sendo a arena da batalha e o E02 vira pista de prova.
2. **Quem corre é galgo, e o evento é o DOG Derby.** A cidade se chama DogCity e
   o inventário do plano diretor já traz 12 caninódromos.
3. Nada congelado se mexe: o enquadramento de câmera da Batalha e a peça 3D do
   Coliseu ficam intocados.

## A peça é o palco do primeiro jogo interno da DogCity

Travado pelo fundador em 08/09/2026, e muda o projeto do prédio inteiro:

> "Isso vai ser algo que os users vão poder apostar. O game que eu acho mais
> fácil a gente desenvolver: cães de corrida que se bem ou mal cuidados, ganham
> ou perdem desempenho. A galera pode apostar no cachorro vencedor, o treinador
> dono do cachorro ganha prêmio, a casa ganha taxa. Da pra gente fazer na
> Solana. Esse vai ser o primeiro game interno da dogcity."

E o limite de escopo, no mesmo pedido: **o jogo não se constrói agora**, mas o
prédio tem de ser projetado sabendo que ele existe. "Precisamos de um canidromo
top de linha, prédio pensado, não uma coisa genérica."

O que isso obriga, e é por isso que está aqui e não num doc de produto:

| o jogo pede | o prédio entrega |
|---|---|
| apostar exige ver o cão antes | **paddock de exibição**, e ele vira peça principal, não anexo |
| cuidar do cão muda o desempenho | **canil e pista de treino** são programa de primeira linha, não serviço |
| o treinador é dono e ganha prêmio | **pit dos treinadores** com frente própria, separado do público |
| a casa ganha taxa | **salão de apostas** é o maior vão coberto do conjunto |
| odds ao vivo | **telão** vira infraestrutura, não enfeite |

⚠️ **Solana, apostas e economia do jogo NÃO entram neste documento.** Aqui só
entra o que vira metro quadrado. Nada do que está escrito abaixo pressupõe
aposta com valor, e nenhuma medida deste projeto depende de o jogo existir.

## Já existiam três pistas ovais, e ninguém tinha contado

| peça | onde | o que é hoje |
|---|---|---|
| **E02 DOG Derby** | r 3.115, rumo 140,625° | reserva de 60,26 ha e desenho de prancheta em `app/city/plaza/pecas/E02.ts` |
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

## A geometria, e o requisito novo que a mudou

⚠️ **A largada tem de caber dentro da reta, e isso derrubou a pista de 900 m.**
A primeira geometria deste documento tinha retas de 73 m, porque só olhava a
curva. Mas em 1/6 g o cão precisa de **165,4 m** para chegar ao pico, e numa reta
de 73 m ele entra na curva ainda acelerando: a prova deixa de ter largada e vira
uma volta inteira de aceleração. A reta manda tanto quanto a curva, e é a
largada que dá a medida dela.

**Retas de 190 m, curvas de raio 100 m inclinadas 35°.**

| | |
|---|---|
| desenvolvimento da pista | **1.008,32 m** (2 × 190 + 2π × 100) |
| curvas | duas de 180°, raio 100 m na linha de medição, inclinadas **35°** |
| retas | **190 m** cada, e é dentro delas que cabem os 165,4 m de largada |
| largura da pista | **12 m**, sem raias: galgo corre solto atrás da lebre |
| desnível da curva, borda a borda | **8,40 m** (12 × tan 35°) |
| envelope da pista | **402 × 212 m = 8,52 ha** |
| miolo livre dentro do oval | **6,45 ha** |
| velocidade máxima que a curva segura | 21,13 m/s, **8,9% de folga** sobre o pico |

Duas distâncias de prova saem da própria forma, e as duas terminam na mesma
linha de chegada porque **cada reta tem a sua largada**:

| prova | onde larga | tempo |
|---|---|---:|
| **1.100 m** | reta principal, 3 m depois do início dela | **65,3 s** |
| **600 m** | reta de fundo, 1 m depois do início dela | **39,5 s** |

Em ambas, 17,1 s e 165,4 m são largada. **Um quarto da prova longa e mais de um
terço da curta é o cão saindo do lugar**, e é ali que ela se decide. Para o jogo
isso é o que interessa: a largada é lenta o bastante para ser assistida.

⚠️ **As provas não são voltas exatas, e não podem ser.** Uma prova de volta
exata termina onde começou, e a largada tem de ficar no início de uma reta (para
caber os 165,4 m) enquanto a chegada tem de ficar em frente ao centro da
tribuna. Os dois pontos são diferentes, então a distância é a que sobra: 1.103 m
e 599 m nas posições cruas, arredondados para 1.100 e 600 recuando a caixa 3 m e
1 m. É assim que canódromo terrestre funciona também: pista de 400 m com provas
de 480.

⚠️ **O banking de 35° é a peça, não um detalhe técnico.** Sete metros de desnível
em dez de largura é uma parede de concreto que se vê de longe e que nenhum
canódromo terrestre tem, porque na Terra a mesma curva se resolve plana com raio
de 55 m. Aqui a alternativa medida é curva de **331 m de raio**, que não caberia
na parcela e faria a peça virar um anel rodoviário.

⚠️ **E ela não pode ficar parecida com o Coliseu da Batalha.** As duas têm
proporção 1,91 e ficam no mesmo anel, a 4.106 m. O que separa as duas na chapa
aérea é o miolo: o Coliseu é uma bacia CHEIA, com a arquibancada fazendo a cova,
e o Derby é um anel VAZADO, com 6,45 ha de miolo aberto e um edifício horizontal
de um lado só. Se o desenho do Derby fechar o miolo, a repetição aparece.

## A implantação, medida

A parcela E02 fica em r 3.115, rumo 140,625°, com 1.156 × 521 m e 60,26 ha.
Terreno seco em 9.570 sondas, amplitude de 33,5 m.

Nivelar a parcela inteira custaria **1,50M m³ de corte e 1,50M de aterro**, o que
é metade do campus esportivo. Não é preciso, e a diferença é grande: **a pista
de corrida tem de ser rigorosamente nivelada, o resto da parcela não.** Uma
prova com desnível ao longo do traçado não é prova.

O conjunto inteiro (pista, tribuna, paddock e canis) cabe num retângulo de
**400 × 300 m**, ou seja 12,0 ha, que é **20% da parcela**. Varredura de 279
posições desse retângulo dentro dos 60,26 ha, passo de 25 m nos dois eixos,
sondando a cada 10 m:

| posição no quadro local | amplitude | cota de equilíbrio | corte | aterro |
|---|---:|---:|---:|---:|
| **lx −175 m, lz −75 m** | **7,91 m** | **9,04 m** | **86 mil m³** | **86 mil m³** |
| lx −175 m, lz −100 m | 7,94 m | 9,07 m | 84 mil m³ | 84 mil m³ |
| lx −150 m, lz −100 m | 8,03 m | 9,36 m | 78 mil m³ | 78 mil m³ |
| a pior das 279, lx +375 m | 22,83 m | 15,54 m | 212 mil m³ | 212 mil m³ |

Em mundo, o centro do conjunto cai em **(2.158,9; 2.355,0)** e o centro do oval
em (2.187,4; 2.389,7).

⚠️ **O sinal de `lz` quase entrou errado, e nada teria acusado.** `buildPecas`
leva o quadro local para o mundo por `x = px + lx·cos(rot) − lz·sin(rot)` e
`z = pz + lx·sin(rot) + lz·cos(rot)`. A primeira varredura desta peça usou o
sinal de `lz` trocado nos dois termos, que é um **espelhamento em z**, não uma
rotação. O ponto espelhado continuava dentro da parcela e continuava seco, então
nenhuma verificação reprovaria: só a topografia sob a peça mudava, de 7,91 m de
amplitude para **10,03** e de 86 mil m³ de corte para **113 mil**. É o mesmo erro
que `assentarEstadio` cometeu em 06/09, medindo um retângulo girado 2φ fora do
lugar, e que só apareceu quando o campus criou um talude ao lado.

**Cota do terraplano: 9,00 m.** Movimentar 172 mil m³ no total é **5,7% do que a
parcela inteira custaria**, e é da mesma ordem dos 77 mil m³ que a pista sozinha
pediria: o prédio inteiro entra quase de graça, porque entra no mesmo platô.

Nenhum ponto molhado em nenhuma das 279 posições. Os 48 ha restantes da parcela
ficam no chão natural, e a inclinação deles vira desenho de paisagem em vez de
aterro.

⚠️ **O acesso é o defeito aberto desta peça, e o jogo o agrava.** A parcela vai
de r 2.855 a 3.375 e o Anel Médio (AN2) passa em 2.750: são **105 m de folga**,
ou seja ela não tem testada em via principal, ao contrário do que `programa.ts`
exige de toda parcela que passa pelo alocador (o E02 é posto à mão na tabela do
gerador, não alocado). E a estação de metrô mais próxima está a **1.977 m**. Para
uma peça de programa isso era um defeito; para uma casa de apostas com público em
noite de prova é o defeito principal. Duas saídas, **nenhuma escolhida**: uma
alameda de ligação de 105 m até o AN2, ou reendereçar a parcela como o atletismo
foi reendereçado em 07/09.

## O edifício

⚠️ **"Prédio pensado, não uma coisa genérica" é requisito escrito, e o que o
torna verificável é ter um partido.** Sem isso a peça vira o que o E02 já foi:
uma arquibancada corrida com um paddock retangular ao lado.

**O partido: o anel, a lâmina e a torre.** Três elementos, três geometrias que
não se repetem, e cada um com um trabalho:

1. **O ANEL** é a pista, e é a peça de terra. Concreto claro, plano nas retas,
   subindo 7,00 m nas duas curvas. Ele é a única superfície inclinada do
   conjunto, e é o que se lê primeiro de cima.
2. **A LÂMINA** é o edifício, sobre a reta principal. Um volume **horizontal** de
   190 m, exatamente o comprimento da reta, contra a inclinação do anel. É o
   contraste entre as duas que dá a leitura.
3. **A TORRE** do juiz, na linha de chegada, é o único elemento vertical do
   conjunto. Ela marca onde a prova acaba, que é a única coisa que um apostador
   precisa enxergar de qualquer lugar.

A lâmina, em três níveis:

| nível | cota | programa | por que aqui |
|---|---:|---|---|
| N0 | 0,00 | **salão de apostas**, bilheteria, acesso | é o maior vão coberto: a taxa da casa nasce nele |
| N1 | +7,00 | circulação e camarotes | o público sentado fica acima do paddock e enxerga por cima dele |
| N2 | +14,00 | lounge e restaurante panorâmico, fachada contínua | vista da curva 4 e da chegada, que é onde a prova vira |
| cobertura | +21,00 | laje em balanço de 22 m sobre a arquibancada | sombra e a linha horizontal que define a peça |

A arquibancada não é nível do prédio: são **16 degraus de 1,50 × 0,62 m** no
chão, entre a borda da pista e o pé da lâmina, subindo 9,9 m em 24 m de
profundidade.

Medidas: **190 × 40 m de planta, 22,2 m de altura** (três níveis de 7 m mais a
laje de cobertura), com os pavimentos recuando 2 m a cada nível.

O resto do conjunto, atrás e ao lado dela:

- **Paddock de exibição**, disco de **60 m de diâmetro rebaixado 1,20 m**, na
  ponta oeste da lâmina, junto à curva 4. É onde os 6 cães desfilam antes da
  prova, e é a peça que o jogo mais usa: apostar é olhar o cão aqui. Rebaixado
  para que a arquibancada e o salão vejam por cima da mureta.
- **Canis, veterinário e sala de pesagem**: barra de serviço de **120 × 25 m**
  atrás da lâmina, com pátio de soltura de 80 × 40 m. Ligada ao paddock por
  corredor coberto, sem cruzar o público.
- **Pit dos treinadores**, frente própria na face de serviço da lâmina: é a porta
  do dono do cão, e ela não é a porta do apostador.
- **Caixas de largada**, seis, móveis: uma posição em cada reta, porque as duas
  provas largam em retas diferentes e chegam na mesma linha.
- **Trilho da lebre** no bordo interno, raio 95 m.
- **Telão** de 40 × 14 m na reta de fundo, virado para a tribuna: é ele que
  mostra odds e a volta em curso.
- **O miolo é campo de treino**, não jardim ornamental: 6,45 ha com uma **reta de
  aferição de 165,4 m**, que é exatamente a distância de largada. É onde o
  desempenho de um cão se mede, e é o par físico da tela de treino do jogo.

⚠️ **O lago ornamental do desenho antigo sai.** Ele era citação de hipódromo
clássico de cavalo (Longchamp), e o miolo tem trabalho a fazer.

## O que muda por ser galgo, e não cavalo

Sai: paddock de cavalo, quatro cavalariças de 90 × 18 m, balança, picadeiro.
Entra: canil de corrida com pátio de soltura, trilho de lebre mecânica
motorizado, e a reta de largada de 165,4 m como medida de projeto.

Capacidade de público: **não calculada**, pelo mesmo critério do DOG Athletics.
Escoamento pelo Green Guide, que o plano diretor já usa: 82 pessoas por metro de
largura por minuto. **Não dimensionado**, porque depende da capacidade.

## O que a primeira chapa derrubou

Desenhado em `pecas/E02.ts` e fotografado em 08/09/2026 pelo portão
`scripts/city/chapas.mjs`, com `--url-extra=&pecas3d=1`. Três defeitos, todos de
escala, e nenhum deles aparecia nos números:

1. **A pista de 10 m era uma fita.** 1.008 m de perímetro contra 10 m de largura
   é a razão 1:100; a pista de atletismo é 1:41 e um canódromo terrestre é 1:84.
   Na chapa aérea o que se lia era um campo verde com uma borda vermelha, não uma
   pista. **Foi para 12 m**, o que também levou o peralte de 7,00 para 8,40 m.
2. **O prédio de 13 m lia como muro.** 190 × 13 é a proporção 1:14,6, e na chapa
   a tribuna ocupava **2,6° de um quadro de 45°**. Foi para três níveis de 7 m,
   ou seja 1:9, mantendo a horizontal como partido.
3. **O miolo de 6,45 ha era um vazio.** Uma reta escura no meio de um campo lê
   como campo de futebol sem marcação. Ganhou a **pista de treino** (oval interno
   de 6 m, sem peralte, porque treino não é prova) e a reta de aferição alargada.

4. **A marquise sumiu o prédio, três vezes seguidas.** Primeiro ela tinha 84 m
   de profundidade e começava 8 m dentro da pista, avançando sobre a raia.
   Encurtada para 34 m, continuou sumindo como elemento por um motivo que só a
   chapa mostra: estava na **mesma cota de 21 m do topo da lâmina**, e vista de
   cima as duas viravam uma chapa branca única de 69 m, com o prédio sem volume
   nenhum na silhueta. Desceu para **15 m**, que é onde uma marquise fica:
   pendurada na fachada, abaixo do topo.
5. **A torre do juiz lia como caixa d'água.** Raio 5,5 para 24 m de altura é a
   proporção 1:4,4, e atarracada no meio da arquibancada ela não marcava nada.
   Foi para 4,2 m de raio e **30 m**, ou seja 1:7.
6. **As fileiras de árvore viraram uma faixa serrilhada.** Com passo de 14 m as
   covas escuras de 3,2 m se fundem numa listra contínua, porque a peça desenha
   a marca no chão e a árvore em si nasce no módulo de arborização. Passo 22.

7. **Os recuos escalonados destruíram a fachada, e este foi o último a cair.**
   Os três níveis recuavam 2 m cada um, o que em planta parecia mais rico. Na
   chapa de fachada, vista de 34 m, cada recuo virou uma faixa horizontal de topo
   de laje e o edifício leu como **pilha de lajes sem parede nenhuma**. As três
   faces frontais foram alinhadas num plano só: 190 × 21 m de fachada vertical,
   com o recuo indo todo para trás e a marquise saindo desse plano. É o que toda
   tribuna de estádio faz, e é o que a faz ler como tribuna de qualquer altura
   de câmera.

⚠️ **E um defeito de render que não era de projeto: a esplanada.** A versão
desenhada punha o platô de 400 × 300 em `Y.L1` e o miolo verde em `Y.L2` por
cima. Os 12 cm de folga entre camadas do kit **não bastam numa peça de 400 m
vista de 400 m**: o miolo saiu estilhaçado de manchas claras irregulares, que é
a mesma armadilha que rasgou a Praça das Medalhas em 28/08. O conserto não foi
aumentar a folga, foi **remover a sobreposição**: o miolo do oval agora É a
parcela, mesma cor e mesma camada, sem geometria própria, e o concreto só aparece
onde tem trabalho (borda da pista, arquibancada, paddock, pátio dos canis). Duas
superfícies coplanares empilhadas deixaram de existir.

### Evidências

Seis rodadas de chapa em 08/09/2026, pelo portão `scripts/city/chapas.mjs` com
`--url-extra=&pecas3d=1`. As chapas da prancheta **não estão guardadas**: elas
foram substituídas pelas do modelo 3D, listadas na seção "O modelo" abaixo, e
guardar as duas gerações só criaria dúvida sobre qual é a peça de hoje.

⚠️ **`pecas3d=1` era necessário e deixou de ser.** Enquanto a peça era
prancheta, as chapas só mostravam algo com essa flag, porque as parcelas do
programa saíram da cena em 31/08. Com o modelo 3D o carregamento é próprio, como
o do DOG Athletics: as vistas do Derby funcionam sem flag nenhuma.

⚠️ **Quatro das seis rodadas foram gastas em ENQUADRAMENTO, não em desenho**, e
isso é o registro que interessa para a próxima peça grande: uma câmera a 90 m ou
mais só mostra topo de laje, e uma câmera baixa a 300 m de uma peça de 400 m
mostra chão. A única que julga o volume é a de dentro do miolo, a 121 m e na
altura do próprio edifício. A primeira tentativa de câmera baixa saiu com o
quadro inteiro tomado pela **face inferior da marquise**, que na época tinha 84 m
de profundidade a 21 m de altura, e o diagnóstico na hora foi "terreno
bloqueando", que estava errado.

## O reendereçamento de 09/09, e as otimizações de celular

O fundador apontou dois defeitos na peça construída: **"ele está em cima de uma
rua, mesmo com terreno sobrando em volta"** e **"precisamos fazer as otimizações
padrão como os outros elementos têm, caso contrário a cidade quebra no celular"**.

### A peça mudou de grade, não só de lugar

A implantação usava a parcela do GERADOR mais um deslocamento dentro dela. Ela
passava em todo o verificador e ainda assim estava errada, pelo motivo que
`programa.ts` documenta desde 31/08 e que eu ignorei: **a peça vinha posicionada
pela grade do gerador e a rua é desenhada pela TEIA da cena** (26 anéis × 168
radiais). Duas grades, então a peça cai rente às ruas em vez de emoldurada por
elas.

O endereço passou a ser `DERBY_MOD = {i:11, nr:3, j:62, ns:2}`, um bloco inteiro
da teia, escolhido por varredura:

| | |
|---|---|
| candidatos válidos | **70** de 1.647 combinações testadas |
| critérios | envelope inteiro dentro do módulo com 8 m de folga, seco, sem colisão com programa/Sphere/**campus**, testada de via principal, nenhuma via entrando no envelope |
| escolhido | **120 m** do sítio anterior, bloco de 481 × 528 m |
| ocupação | **60% do bloco** |
| via mais próxima | AN3 a **227 m** do envelope |
| vizinho | E03 $DOG ARENA a **243 m** |

⚠️ **Duas medidas diferentes, e confundi-las foi o primeiro erro da varredura.**
Uma peça precisa de **testada** (via principal encostando na parcela) e de
**folga** (nenhuma via entrando no envelope construído). A primeira rodada só
media testada e aprovou 76 módulos, entre eles vários onde o AN3 passava 21 m
DENTRO da parcela: como os lados do módulo são o EIXO da rua e o envelope estava
a 14 m da borda, o asfalto invadia a peça por 7 m. Exatamente o defeito que o
fundador apontou, reproduzido por uma varredura que se dizia válida.

⚠️ **E o campus não está em `cidade.json`.** As três arenas dividem `CAMPUS_MOD`,
uma parcela criada na cena e nunca publicada pelo gerador. Varrer só o programa
publicado aprovava 6 módulos em cima delas.

⚠️ **Mudar o endereço não apaga as ruas de dentro do bloco.** Quem faz isso é
`derbyParcela()` registrada em `buildVias.parcelas`, do mesmo jeito que
`campusParcela()`. As duas coisas são necessárias, e só uma delas é o
endereço.

O sítio novo custou **11,04 m de amplitude** de terreno contra 8,63 do anterior,
e a saia do modelo foi de 9,5 para **12 m** para alcançar. Havia módulos com
4,24 m de amplitude, mas com a peça ocupando 26% do bloco: é o defeito que
reprovou o primeiro sítio do atletismo em 07/09, quando as arenas liam como
ilhas soltas. **60% de ocupação é o que faz a peça ler como emoldurada.**

### As otimizações, medidas no navegador de verdade

O que faltava era o instrumento: **nenhuma conta offline responde "quebra no
celular?"**. `scripts/city/conferir-derby.mjs` abre a cidade num Chrome com GPU,
nos dois perfis, e mede o ciclo real.

| | celular | desktop |
|---|---:|---:|
| transferências | **1** (só a base) | 2 |
| bytes | **36.376** | 78.548 |
| triângulos visíveis de perto | **5.306** | 17.738 |
| malhas visíveis | **9** | 13 |
| texturas | **0** | 0 |
| contexto WebGL perdido | 0 | 0 |
| fps na medição | 60 | 60 |
| estado do detalhe | **`disabled`** | `ready` |

O celular **nunca pede o arquivo de detalhe**, e o estado `disabled` prova que
não é sorte de distância: é o contrato do loader (desktop, qualidade acima de
baixa, sem economia de dados). A base só é pedida **depois de a cidade abrir**
(67,2 s na medição, contra 65,3 s de abertura), então ela não entra no boot.

E o par offline, `scripts/city/verificar-derby-carga.ts`, cobre o que o navegador
não consegue provocar de propósito: rede que falha (uma tentativa, sem
tempestade), resposta que chega depois de a câmera ir embora, dispose duplo e
passagem voando sem baixar detalhe.

### O que ainda faltava de paridade, e agora existe

| item | antes | agora |
|---|---|---|
| endereço em módulo da teia | não | `DERBY_MOD` |
| parcela na máscara de vias | não | `derbyParcela()` |
| entrada no menu Places | não | "DOG Derby" |
| enquadramento por `viewFor` | coordenada crua no `chapas.mjs` | `?view=derby`, `derbyalto2`, `derbyperto` |
| portão de navegador | não | `conferir-derby.mjs` |
| teste do ciclo de carga | não | `verificar-derby-carga.ts` |

⚠️ **As vistas do `chapas.mjs` viraram `'view'`.** Enquanto o endereço era
coordenada crua, os cinco enquadramentos tiveram de ser recalculados à mão a cada
vez que a peça se mexeu, e numa dessas a chapa saiu fotografando o chão.
Marcadas como `'view'`, elas pedem o mesmo `viewFor` que o tour usa e acompanham
a peça sozinhas.

## A rodada de arquitetura de 10/09, e os três defeitos que ela consertou

O fundador reprovou a peça construída: **"me parece, claramente, que o canódromo
tá um nível abaixo do the geode e da $DOG ARENA. Não vi a lebre no suporte, a
curva sem proteção nenhuma, os cães podem simplesmente sair da pista,
arquitetura fraca."** As três críticas eram verificáveis no código, e as três
estavam certas.

### 1. A curva não tinha proteção, e no celular não havia proteção em lugar nenhum

`detail_rails` desenhava guarda-corpo **só nas retas**, **só no bordo interno**, e
morava no **detalhe**, que o celular nunca baixa. Ou seja: no telefone a pista
inteira corria sem cerca, e no desktop as duas curvas corriam sem cerca.

A causa da parte "só nas retas" vale registrar, porque é estrutural: a costura
reta-curva-reta-curva estava escrita à mão em quatro laços diferentes, e dois
foram esquecidos. Agora existe `oval_path(raio)`, que devolve a volta inteira
com o peralte já aplicado, e **todo elemento que dá a volta usa ela**: as duas
cercas, o trilho da lebre e os prumos.

⚠️ **Cerca é segurança, e segurança não é ornamento de desktop.** A regra que
fica: o que explica como a peça funciona vai na BASE; o que enfeita vai no
detalhe. As duas cercas custam 4 triângulos por trecho, porque são duas faces
opostas e não uma caixa: caixa custaria 12 e, com 128 trechos, seriam 1.536
triângulos só nelas. Uma face só também não serve, porque com backface culling
ela some do lado de fora e a chapa aérea mostraria a curva sem proteção de novo.

### 2. A lebre não existia

Havia o nome dela num comentário e mais nada. Sem lebre a pista não explica o que
faz o cão correr, e ela é o único elemento móvel de um canódromo. Agora tem
calha na volta inteira, carro, **braço de 4,6 m** e a isca, mais a casa onde ela
para. É o braço que a torna legível: a isca tem 40 cm e não se vê de longe; o L
que projeta a isca sobre a pista, sim.

### 3. A arquitetura era um galpão, e o partido nasceu da própria pista

A parede externa do peralte eram **8,4 m de concreto liso dando a volta**, sem
uma sombra e sem dizer o que sustenta o quê. O partido novo sai da geometria que
já existia:

- **O tabuleiro avança em voadiço e o fechamento recua 2,2 m**, em material
  escuro. De fora se lê uma fita clara suspensa sobre uma sombra contínua.
- **Costelas claras a cada 4 segmentos de arco**, uma a cada 24 m de
  desenvolvimento, aparecendo dentro dessa sombra. A cada 2 segmentos elas
  fechavam numa parede listrada e custavam o dobro sem ganho.
- ⚠️ A costela nasceu em GRAPHITE e **sumia dentro do DARK do fechamento**:
  existia na malha e não na chapa. Estrutura que não lê não é partido, é
  triângulo pago à toa. Foi para CONCRETE.
- **A tribuna recebeu a mesma gramática**: o térreo recua 6 m e é escuro, o
  último nível avança 2 m, e entre os dois nasce a horizontal profunda que uma
  tribuna tem. Os pilares retos do chão ao topo viraram **costelas em V**, na
  mesma cadência de 10 m das costelas da curva.
- **O pórtico da chegada**, 26 m sobre a pista, é o vertical que faltava. O ARENA
  tem a massa de obsidiana, a GEODE tem a casca, o atletismo tem a coroa orbital;
  o Derby tinha uma barra de 190 m deitada e nada que subisse. O pórtico é
  vertical, é funcional (juiz, cronômetro, placar) e amarra a tribuna à curva.

⚠️ **E um defeito meu que a planta do gerador revelou**: o detalhe desenhava
**cinco linhas de raia** na reta, como pista de atletismo, enquanto o cabeçalho
da peça diz "sem raias: galgo corre solto atrás da lebre". Elas dominavam a reta
principal e faziam a peça ler como o DOG Athletics, que é justamente de quem ela
precisa se distinguir. Removidas. O que marca a pista de galgo é a linha de
chegada, uma só, e ela agora nasce com o pórtico.

### A luz, que era o defeito de fundo

⚠️ **A peça era uma arena noturna com os holofotes apagados.** O cabeçalho de
`floodlights` já dizia a verdade sem tirar a conclusão: "sob a abóbada não há dia
e noite, a luz é sempre artificial". As quatro torres de 36 m tinham cabeça em
material fosco, o $DOG ARENA tem `AR_LUZ`, a GEODE acende a bacia inteira, e o
Derby não emitia um fóton.

Agora existe uma **escada de emissão em três forças**, e ela é o projeto de luz:

| elemento | material | força | por quê |
|---|---|---:|---|
| o nome | `LETRA` | **9,0** | é o mais forte e tem de continuar sendo |
| marca, traçado, interior | `AMBER` | **1,6** | era 0,5, ou seja apagado |
| refletores | `LUZ` | **7,0** | fonte, não marca |

⚠️ **O traçado aceso NÃO pode ter a força do nome.** Uma fita de 8 cm no topo da
cerca externa desenha os 1.008,32 m da volta com uma linha só, e de longe a peça
vira um anel de luz que nenhuma outra tem. Mas ela circunda a peça, e o cabeçalho
do ARENA já registrou o que acontece nesse caso: "na força do letreiro vira faixa
de néon e o nome, que é o que precisa ser lido, some no meio das listras". Por
isso 1,6 e não 9,0.

### A identidade material, e a trava que tinha caído sem ninguém notar

O código dizia que a família de material era a do DOG Athletics **porque as duas
peças dividiam o campus esportivo**. O Derby mudou para `DERBY_MOD` em 09/09, para
sair de cima da rua, e essa razão morreu junto sem que a linha fosse revista.

Toda clara, a peça era o que o fundador descreveu: um galpão bege ao lado de uma
obsidiana facetada e de um cristal. **A massa passou a escura e as bordas ficaram
claras.** A marquise flutua sobre a sombra, o nome salta, e a pista de areia vira
o elemento mais claro da composição, que é o certo: a pista é a peça.

### O que isso custou, e por que continua dentro do padrão

| | antes | **depois** |
|---|---:|---:|
| base, triângulos | 5.486 | **8.362** |
| base, bytes | 37.816 | **60.236** |
| base, chamadas de desenho | 10 | **11** |
| total com detalhe | 17.918 | **20.698** |
| total, bytes | 79.988 | **101.868** |
| texturas | 0 | **0** |

Para comparar, o DOG Athletics tem **13.370 triângulos** na base e 129 KB no
total: o Derby continua mais leve que ele. Os tetos do portão de navegador
subiram junto, com a razão escrita ao lado deles, porque teto que não acompanha
o modelo medido deixa de acusar regressão.

**O que entrou na base e por quê**: as duas cercas, as costelas, a lebre, o
pórtico e a luz. Todos são o que explica a peça, e o celular precisa deles. **O
que ficou no detalhe**: os prumos das cercas, os 608 assentos, os mullions e as
juntas.

### A conta que faltava: memória residente

⚠️ **BYTE TRANSFERIDO NÃO É O QUE DERRUBA TELEFONE.** Draco comprime a
transferência e some no destino: o que fica na RAM é o atributo cru, e nesta peça
ele é **6,5x maior que o .glb** (425 KB de atributo para 65 KB de arquivo). Medir
só o arquivo é medir a metade barata, e essa era a única conta que o verificador
fazia. Agora `read_glb` soma os accessors e o gerador reprova se o teto estourar.

| | Derby | DOG Athletics |
|---|---:|---:|
| atributo na base | 425.280 B | 515.388 B |
| índices na base | 53.676 B | |
| **residente no celular** (JS + GPU) | **0,91 MiB** | 0,98 MiB |
| **residente no desktop** (as duas fases) | **2,18 MiB** | 2,27 MiB |

A referência é o DOG Athletics de propósito: ele está em produção e foi aprovado
pelo fundador no telefone. O Derby **cabe abaixo dele nas duas contas**, e não
poderia ser diferente, porque ele não é a peça mais importante da cidade e não
pode custar mais que ela. Os tetos ficaram em 560 KB residentes na base e 1,3 MB
no total.

⚠️ **E o risco que matou o celular antes não existe aqui**: o que estourava a
memória de textura do telefone era imagem 512x512 embutida em GLB
([[project_dogcity_memoria_celular]]). O Derby tem **zero imagens e zero
texturas**, só cor de material, então o espelho KTX2 de `scripts/city/ktx2.mjs`
não se aplica a ele.

## Um defeito de fundo que a chapa revelou e que NÃO é desta peça

**Há ruas da teia cruzando a parcela do E02.** Visível nas três chapas de
08/09/2026: faixas de calçada e leito atravessam o gramado da parcela e uma delas
entra no miolo do oval.

A causa provável, e ela é estrutural: `encaixaPrograma` em
`app/city/plaza/programa.ts` **reencaixa** cada peça num número inteiro de
módulos da teia e é esse encaixe que serve de máscara para a rua se desenhar. O
desenho da peça, porém, sai de `p.x` e `p.z` publicados em `cidade.json`. Quando
os dois divergem, a máscara fica num lugar e a peça noutro, e a rua atravessa o
que ela deveria contornar. É a mesma classe de problema que `campus.md` resolveu
dando ao conjunto das três arenas **uma parcela dedicada** na máscara
(`CAMPUS_MOD`), que apaga as ruas internas por construção.

**Resolvido para o Derby em 09/09** pelo reendereçamento acima: a peça saiu da
grade do gerador e foi para um módulo da teia, com a parcela registrada na
máscara. **Continua aberto para as outras 70 peças**, e o que falta é medir, para
cada uma, a distância entre o centro publicado e o centro do módulo encaixado.

## Sequência proposta

1. ~~Reescrever `pecas/E02.ts`~~ **FEITO em 08/09/2026.** A prancheta desenha a
   pista de 1.008,32 m com peralte de 35°, a pista de treino, a reta de aferição,
   a lâmina de três níveis, a marquise, a torre do juiz, o paddock, os canis, as
   duas caixas de largada, o telão e as quatro torres de luz. Assentada no ponto
   medido (`lx −175, lz −75`). Conferida em três chapas e corrigida em três
   iterações, registradas acima. `npx tsc --noEmit` limpo.
2. **O terraplano ainda não existe em geometria.** A prancheta segue o terreno,
   como todas as peças; o platô de 400 × 300 na cota 9,00 com 172 mil m³ é
   trabalho da fase 3D, com pódio próprio no padrão de `campus.ts`.
3. Resolver o acesso: alameda de 105 m até o AN2 ou reendereçamento da parcela.
4. Medir a divergência entre centro publicado e centro do módulo encaixado, nas
   71 peças, e decidir se o Derby ganha parcela dedicada na máscara de vias como
   o campus ganhou.
5. ~~O modelo 3D próprio~~ **FEITO em 09/09/2026.** Ver "O modelo" abaixo.
6. ~~Renomear a peça~~ **FEITO em 08/09/2026.** O fundador escolheu **DOG
   DERBY**. Trocado em `scripts/gerar_cidade.py` (a tabela do programa e o
   comentário do critério de identidade), em `data/dogcity_programa_congelado.json`
   (que é quem o gerador de fato LÊ), no cabeçalho de `pecas/E02.ts`, na tabela
   de arborização de `especies.ts` e nas citações de `paisagismo.md` e
   `estadio.md`. Ficaram de fora, de propósito, as ocorrências em `coliseu.ts`,
   `programa.ts` e `gerar_cidade.py:202` e `:1476`: ali "hipódromo" é o nome da
   TIPOLOGIA arquitetônica (o circo romano) e se refere ao Coliseu da Batalha,
   não a esta peça.

## O modelo, construído em 09/09/2026

Gerador paramétrico em `blender/build_derby.py`, no padrão do DOG Athletics:
1 metro Blender = 1 metro de cidade, origem no centro da pegada, pista em Z = 0,
convenção `(x,y,z)` Blender para `(x,z,-y)` Three, exportação Draco, validação
numérica antes de publicar e substituição atômica por arquivo.

| | arquivo | transferência | triângulos | chamadas | texturas |
|---|---|---:|---:|---:|---:|
| base, peça completa | `dog-derby-base.glb` | 36.380 bytes | 5.306 | 9 | 0 |
| detalhe, desktop perto | `dog-derby-detail.glb` | 42.172 bytes | 12.432 | 5 | 0 |
| **total** | | **78.552 bytes** | **17.738** | 14 | **0** |

Para comparar: o DOG Athletics soma 129.172 bytes e 25.706 triângulos. O
canódromo é maior em terra (15,20 ha contra 6,7) e mais leve em carga.

O que a base traz, e nada disso é decoração: platô com saia, pista peraltada com
a parede externa fechada, borda de concreto, canteiros nas quatro quinas, miolo
com pista de treino e reta de aferição, mureta e trilho da lebre, 16 fileiras de
arquibancada, a lâmina de três níveis, a marquise, a cabine do juiz, a torre de
controle, o paddock com cobertura em anel, a passarela do cão, os canis com
pátio, o pórtico de entrada com oito bilheterias e o letreiro, as seis caixas de
largada em duas posições, o telão e quatro torres de luz. O detalhe acrescenta
608 assentos, mullions, nervuras da marquise, juntas da parede do peralte, raias
e guarda-corpos.

### O que o gerador verifica antes de publicar

`peralte 35,00° verificado; sobe 8,4025 m; v_max 21,13 m/s contra pico 19,4`,
`volta 1008,32 m; largada 165,4 m em reta de 190 m`, e os espelhos da
arquibancada voltados para a pista (109 faces). Mais os tetos de triângulo, byte
e chamada, zero textura e a presença do Draco.

### Cinco defeitos que só o render e a chapa mostraram

1. **A pista saiu PRETA na cidade.** As faces das curvas nasciam com a normal
   para baixo, porque a ordem natural ali é tangente-depois-radial e
   `e_theta × e_r = -z`. No Cycles isso não aparece (ele renderiza os dois
   lados); no Three, com backface culling, a pista inteira desaparece.
2. ⚠️ **E o primeiro conserto foi pior que o defeito.** Escrevi um passe que,
   depois de construir, virava toda face com `normal.z < -0,5`. Ele "consertou"
   348 faces e **152 delas eram as faces inferiores de caixas e cilindros**, que
   devem apontar para baixo: o passe furava os sólidos para acertar os pisos.
   Sólido fechado e superfície aberta não têm a mesma regra, e só quem escreve a
   face sabe qual das duas ela é. O conserto certo é uma função `piso()` na
   criação, que é exatamente o que `pecas/kit.ts` faz no `quad()`, e as 16
   superfícies de chão passam por ela.
3. **A torre do juiz cortava a arquibancada em duas** e atravessava a marquise.
   A chegada é no meio da reta por medida, então quem tinha de sair do meio era a
   cabine: ela virou um voladiço na fachada a 11 m, e o vertical do partido virou
   uma torre de controle solta na quina leste, com 34 m.
4. **608 assentos em âmbar** viraram uma massa laranja que puxava o olho para
   longe da pista. Grafite no geral e âmbar só no setor central, o da chegada:
   assim a cor diz onde a prova acaba.
5. **O platô era 6 ha de concreto vazio** em volta do oval, e lia como
   estacionamento numa cidade que não tem carro particular. Canteiros nas quatro
   quinas devolveram a área ao sistema verde.

### Dois erros de implantação que o verificador pegou, não o olho

⚠️ **A saia de 5,5 m do atletismo não serve aqui.** A peça pousa no ponto MAIS
ALTO da pegada (é o que impede qualquer parte de enterrar), então a saia tem de
alcançar o mais BAIXO. Na pegada real a amplitude é **8,63 m**: copiar o número
do atletismo deixaria a saia flutuando 3 m acima do regolito na ponta baixa. São
9,5 m.

⚠️ **A parcela não é um retângulo, e a primeira posição saía dela.** A varredura
usava `|lz| + Z/2 <= b − 6`, ou seja tratava os 1.156 × 521 m como uma caixa. O
polígono publicado tem 26 pontos e é um trapézio de lados curvos: a borda interna
vai de r 2.810 a 2.911 e a externa de r 3.293 a 3.494, então a profundidade
radial real varia de 480 a 580 m conforme o rumo e o `b` publicado é a média. Com
`(-175, -75)` uma quina do envelope caía **2 m fora** da borda externa, e nada na
cena acusaria. Refeita com o polígono como critério (perímetro amostrado a cada
20 m, folga mínima de 6 m), sobraram 1.467 posições válidas de 1.647, e a
escolhida é **`(-180, -55)`**: 8,63 m de amplitude contra 8,55 m da mais plana,
em troca de **18,2 m de folga de borda contra 8,3 m**.

### O que passou na conferência

```bash
blender -b -t 2 -P blender/build_derby.py            # o modelo e os orçamentos
npx tsc --noEmit --incremental false -p tsconfig.json
npx tsx scripts/city/verificar-derby.ts              # sítio, terreno, carga
node scripts/city/chapas.mjs --vistas=derbyalto,derbytribuna,derbycurva
```

Medido em 09/09/2026: sítio em (2.150,0; 2.336,3), envelope de 15,20 ha inteiro
dentro da parcela, **AN2 a 241 m**, vizinho mais próximo **E03 $DOG ARENA a
136 m**, terreno de 3,93 a 12,56 m em 4.260 sondas de 6 m, **zero água**, corte
de distância 4.500 m no celular e 7.000 no desktop.

Evidências: [aéreo na cidade](docs/derby/modelo-aereo.jpg),
[tribuna](docs/derby/modelo-tribuna.jpg),
[curva com o peralte](docs/derby/modelo-curva.jpg),
[fachada](docs/derby/modelo-fachada.jpg), o
[render do gerador](docs/derby/blender-overview.png), o
[orçamento do modelo](docs/derby/modelo.json) e o
[relatório do portão](docs/derby/chapas.json).

⚠️ **As cinco vistas do `chapas.mjs` foram realinhadas** depois de a peça se
mudar 30 m: enquadramento que aponta para o sítio antigo fotografa chão, e foi o
que a primeira chapa da curva fez. As coordenadas saem do sítio mais o quadro do
modelo, com o deslocamento de 41,25 m entre o centro do oval e o centro da
pegada. Nenhuma é medida à mão.

⚠️ **A prancheta saiu do registro.** `pecas/E02.ts` foi tirada de
`pecas/index.ts`: peça com modelo 3D não entra no registro da prancheta, senão as
duas geometrias nascem uma dentro da outra em `?pecas3d=1`. É por isso que o
$DOG ARENA e o DOG Athletics também não estão naquela lista. O arquivo continua
no repositório como o estudo de planta que gerou este projeto.

### O que continua aberto

- ~~Não existe portão de navegador~~ **FEITO em 09/09**: `conferir-derby.mjs`
  mede o ciclo real nos dois perfis, e `verificar-derby-carga.ts` cobre a lógica
  do loader sem navegador. Os números estão na seção acima.
- **O entorno da parcela ficou pelado.** O platô ocupa 15,20 ha dos 60,26 da
  parcela e o resto é terreno natural sem tratamento: a prancheta plantava
  árvores ali (ela fornecia `covas` para o módulo de arborização) e o modelo não
  fornece nenhuma.
- O acesso segue sendo o defeito de fundo: **227 m até o AN3** e a estação de
  metrô longe.
- A reserva E02 do gerador ficou a **265 m** do sítio da peça, porque a peça foi
  para a teia e a reserva mora na grade do gerador. O DOG Athletics tem a mesma
  divergência desde que nasceu; o verificador imprime a distância a cada rodada
  para ela não ser esquecida. Quem fecha isso é uma rodada do gerador movendo a
  reserva.

## Limites

Velocidade, pico e μ do galgo são premissas de dado terrestre, não medição.
Os tempos de prova saem dessas premissas. A área da parcela, o terreno, a água,
as distâncias e os volumes de terra são medidos contra o heightmap real em
08/09/2026, com o mesmo exagero vertical e pódio de `altura()` em
`scripts/gerar_cidade.py`. Nada aqui foi conferido em navegador porque nada foi
construído. A reserva de 60,26 ha não muda de tamanho neste plano: encolher
depois do snapshot é seguro, crescer não.
