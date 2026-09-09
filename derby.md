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

Seis rodadas de chapa em 08 e 09/09/2026, pelo portão `scripts/city/chapas.mjs`
com `--url-extra=&pecas3d=1`. As quatro que valem estão guardadas:
[aéreo](docs/derby/aereo.jpg), [curva com o peralte](docs/derby/curva-peralte.jpg),
[tribuna](docs/derby/tribuna.jpg), [fachada](docs/derby/fachada.jpg), mais o
[relatório do portão](docs/derby/chapas.json).

⚠️ **As vistas do Derby só mostram algo com `pecas3d=1`.** As parcelas do
programa saíram da cena em 31/08 e a peça 3D está atrás dessa flag: sem ela as
quatro chapas saem com o terreno pelado, e a conclusão errada é "a peça não foi
desenhada". Está anotado em `chapas.mjs`, ao lado dos enquadramentos.

⚠️ **Quatro das seis rodadas foram gastas em ENQUADRAMENTO, não em desenho**, e
isso é o registro que interessa para a próxima peça grande: uma câmera a 90 m ou
mais só mostra topo de laje, e uma câmera baixa a 300 m de uma peça de 400 m
mostra chão. A única que julga o volume é a de dentro do miolo, a 121 m e na
altura do próprio edifício. A primeira tentativa de câmera baixa saiu com o
quadro inteiro tomado pela **face inferior da marquise**, que na época tinha 84 m
de profundidade a 21 m de altura, e o diagnóstico na hora foi "terreno
bloqueando", que estava errado.

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

**Não consertado nesta frente**, e de propósito: mexer na máscara de vias sem
medir a divergência peça por peça troca um defeito visível por um invisível. O
que falta é medir, para as 71 peças, a distância entre o centro publicado e o
centro do módulo encaixado.

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
5. **O modelo 3D próprio, no padrão do DOG Athletics**: gerador paramétrico em
   `blender/build_derby.py`, GLB base e detalhe com orçamento de carga, loader
   com corte por distância e verificadores. É nesta fase que fachada, estrutura
   da marquise e assentos passam a existir, e é ela que entrega o "prédio
   pensado, não uma coisa genérica" que o pedido cobra. **A prancheta é massa por
   definição** (`kit.ts`: "volume sem fachada, que é como plano de massas mostra
   obra pública"), e nenhuma iteração dela chega lá.
6. ~~Renomear a peça~~ **FEITO em 08/09/2026.** O fundador escolheu **DOG
   DERBY**. Trocado em `scripts/gerar_cidade.py` (a tabela do programa e o
   comentário do critério de identidade), em `data/dogcity_programa_congelado.json`
   (que é quem o gerador de fato LÊ), no cabeçalho de `pecas/E02.ts`, na tabela
   de arborização de `especies.ts` e nas citações de `paisagismo.md` e
   `estadio.md`. Ficaram de fora, de propósito, as ocorrências em `coliseu.ts`,
   `programa.ts` e `gerar_cidade.py:202` e `:1476`: ali "hipódromo" é o nome da
   TIPOLOGIA arquitetônica (o circo romano) e se refere ao Coliseu da Batalha,
   não a esta peça.

## Limites

Velocidade, pico e μ do galgo são premissas de dado terrestre, não medição.
Os tempos de prova saem dessas premissas. A área da parcela, o terreno, a água,
as distâncias e os volumes de terra são medidos contra o heightmap real em
08/09/2026, com o mesmo exagero vertical e pódio de `altura()` em
`scripts/gerar_cidade.py`. Nada aqui foi conferido em navegador porque nada foi
construído. A reserva de 60,26 ha não muda de tamanho neste plano: encolher
depois do snapshot é seguro, crescer não.
