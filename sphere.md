# THE SPHERE

Aberta em 07/09/2026. Um telão de LED esférico, referência declarada: a Sphere de Las
Vegas (112 m de altura por 157 de largura, casca de LED com 1,2 milhão de pontos).

## O que ela é, decidido pelo fundador

**Só a casca.** Sem auditório, sem plateia, sem programa dentro. O Geode é o interior da
cidade (ginásio poliesportivo que também recebe espetáculo); a Sphere é o exterior (mídia,
outdoor, vitrine de parceiro). Uma é sala, a outra é casca, e por isso não competem.

**O conteúdo é dado on-chain ao vivo, e a propaganda entra no intervalo.** Palavra dele:
*"gostei muito de expor os dados on chain nela, e nos intervalos a gente coloca as
propagandas, fica bem mais atrativo do que só propaganda"*. Isso é mais barato (canvas com
número custa ordens de grandeza menos que vídeo) e vende melhor (o parceiro compra o
intervalo de uma peça que já se olha).

## Os três eventos a que ela reage

| evento | frequência | papel |
|---|---|---|
| **bloco minerado** | ~10 min, 144 por dia | o pulso; garante vida em dia parado |
| **compra ou envio para a carteira cadastrada** | rara | a prova social: quem comprou vê a cidade reagir |
| **mint de terreno** | depois do snapshot | o produto acontecendo |

⚠️ **Ela NÃO reage a transação qualquer da rede.** Isso já é o trabalho da camada de órbita
sobre a praça, e repetir na casca vira estroboscópio. A restrição é do fundador.

⚠️ **O mecanismo de detecção JÁ EXISTE.** Há uma `DONATION_WALLET` cadastrada, e
`app/api/donate/leaderboard/route.ts` já consulta `dog_transactions` por tudo que toca esse
endereço, com txid, altura do bloco, valor e remetente. Zero backend novo para o evento
mais importante. O feed de mempool (`/api/mempool/dog`) já roda na `/city` a cada 6 s, e o
preço e o contador do snapshot também já estão publicados.

## O sítio

⚠️ **A recomendação de 06/09 (rumo 320, r 3.800) está REPROVADA, medida em 07/09.** Ela
nunca foi varrida contra a malha viária, só contra Geode e Estádio, e é exatamente o
defeito que já custou os dois: o **Anel Exterior (AN3, r 3.750, seção de 26 m) passa por
dentro do bloco inteiro**, em qualquer rumo daquela banda da teia (`ANEIS[14]=3.564` a
`ANEIS[15]=3.803`, com o AN3 quase no meio dela). Medido: **-97 m de folga contra o AN3**,
ou seja o anel corta o prédio, não a calçada. O relevo ali também não ajuda: -8,7 a 5,8 m,
praticamente ao nível do datum. Trocado pelo sítio abaixo, achado varrendo a teia inteira
(1.900 a 6.900 m de raio) contra as TRÊS famílias de via que moram em `cidade-malha.json`
(bulevares, autopistas, anéis) mais canais radiais, eclusas e metrô, e contra as 70 peças
de `cidade.json` mais Geode e Estádio (que entram à mão, como sempre).

### O módulo escolhido

`{ i: 20, nr: 1, j: 108, ns: 1 }`, na mesma função `caixaDoModulo()` que o Geode e o
Estádio usam.

| | |
|---|---|
| centro | (-4.117,5 ; 3.038,9), raio **5.117,5 m**, rumo **233,57°** (sudoeste) |
| caixa do módulo, já com recuo de rua | **227,0 m no radial x 370,8 m no arco** (r0=5.004, r1=5.231) |
| ao Geode (r 3.294, rumo 115,7) | 7.266 m, **117,9°** de separação angular |
| ao Estádio (r 3.296, rumo 105,0) | 7.621 m, **128,6°** de separação |
| à praça central | 5.118 m |
| ao rumo do portão do Parque (43°) | **169,4°** de separação, quase o lado oposto da cidade |

A separação do distrito esportivo é MELHOR que a do sítio reprovado (7.266/7.621 m contra
os 6.936/6.769 do estudo original), e a separação do Parque também (169,4° contra 83° que
o sítio antigo tinha, ou seja o sítio antigo brigava de esquina com o próprio Parque).

### A conta de cabimento

A peça reservada é o módulo inteiro, 227,0 m no radial por 370,8 m no arco, com a base
tendo praça nos dois eixos:

| diâmetro | sobra no radial (cada lado) | sobra no arco (cada lado) |
|---|---|---|
| 110 m | 58,5 m | 130,4 m |
| 135 m | 46,0 m | 117,9 m |
| **160 m** (a largura da Sphere de Vegas é 157) | **33,5 m** | **105,4 m** |

Mesmo os 160 m cabem folgado: 33,5 m de sobra no eixo mais apertado é da mesma ordem que os
34 a 58 m que o Geode e o Estádio já constroem de calçada em produção, e no arco sobra o
triplo disso. Qualquer diâmetro entre 110 e 160 m cabe com praça de sobra nos dois eixos.

### A validação contra tudo, com número

| contra o quê | folga medida | quem é o mais próximo |
|---|---|---|
| bulevar | 637 m | BUL07 (rumo 241,875) |
| autopista | 3.363 m | AU3 |
| anel viário | 406 m | AN5 (r 5.620) |
| canal radial | fora de alcance (CR01/02/03 ficam a nordeste, rumo 25 a 85) | |
| eclusa | 1.621 m | ECExtracao (rumo 214) |
| metrô radial | 2.953 m | linha do rumo 270 |
| metrô circular | 1.544 m | anel r 3.488 |
| água (lagos) | 4.310 m | o lago mais próximo |
| as 70 peças de `cidade.json` + Geode + Estádio | 2.296 m | E01 (Parque Olímpico) |
| casca da abóbada (DOME_R 9.050, flecha 5.500) | teto a **4.175,7 m**, sobre um tabuleiro a ~107-111 m: **mais de 4 km de folga vertical** | nunca é o limite |
| relevo dentro da peça (grade 5x5 sobre 160x160 m) | **100,7 a 111,0 m, desnível de 10,3 m** | terraplenagem mínima |

Contra os -97 m do sítio reprovado e o relevo quase ao nível do mar dele, este sítio está
**cerca de 108 m mais alto** e não colide com nenhuma das seis famílias de via nem com
nenhuma peça construída.

### A visibilidade

Medida por linha de visada reta sobre o relevo real (`public/lunar/btc-core-heightmap.f32`,
sem prédio no meio, olho de pedestre a 1,7 m, os mesmos 1,7 m do resto da cidade):

- **da praça central** (5.118 m): visível, coroa e equador claros acima do relevo em toda
  a extensão do trajeto.
- **do portal interno da eclusa do Distrito de Extração** (rumo 214, só 1.754 m do sítio):
  visível, e é o ponto de chegada mais próximo e mais alinhado com ele.
- **do portal interno da eclusa do Spaceport** (rumo 183, 4.131 m): visível.
- **do portal interno da eclusa do Parque** (rumo 43, 9.527 m): ⚠️ oclusa nos primeiros
  ~700 m de caminho, porque o PRÓPRIO PORTAL fica num rebaixo do relevo (a mesma cova que
  o Parque escava para chegar); passado esse trecho a visada abre com dezenas de metros de
  folga pelo resto do trajeto. Não é defeito do sítio, é a geometria do portal.
- **no tecido da cidade** (grade de 400 m, 733 pontos amostrados entre r 1.450 e 6.900,
  fora d'água): **81,0% enxergam o topo de uma esfera de 135 m**. O sítio reprovado media
  82,5% no mesmo teste, ou seja a visibilidade BRUTA é parecida entre os dois; a diferença
  real não é quantos pontos veem, é que este sítio está 108 m mais alto (lê melhor contra o
  céu, pega mais luz) e, sobretudo, que o outro não é construível.

⚠️ Confirmando a física que o estudo original já citava: a curvatura não limita (folga de
dezenas de km contra os 9 km do sítio) e a abóbada também não (4,2 km de teto livre). Quem
decide é oclusão por relevo, e o platô encontrado aqui é o mais alto que a varredura achou
livre de via na faixa de raio 1.900-6.900 m.

### As constantes prontas

```ts
// THE SPHERE: modulo da teia, mesma regra do Geode e do Estadio (peca ocupa
// numero inteiro de modulos, os lados do modulo SAO rua). Substitui o rumo
// 320 / r 3.800 de 06/09, que colidia com o Anel Exterior: medido em 07/09,
// -97 m de folga contra o AN3 (r 3.750) em qualquer rumo daquela banda da
// teia. Achado varrendo TODA a malha viaria de cidade-malha.json (bulevar,
// autopista, anel, canal, eclusa, metro) mais as 70 pecas de cidade.json e
// o Geode/Estadio a mao: e o mesmo erro de metodo que ja custou os dois.
export const SPHERE_MOD: Modulo = { i: 20, nr: 1, j: 108, ns: 1 }

// caixa do modulo, direto de caixaDoModulo(SPHERE_MOD): 227,0 m no radial por
// 370,8 m no arco, centro em raio 5.117,5 m, rumo 233,57 graus (sudoeste).
// Folga medida contra a malha inteira: 637 m ate o bulevar mais perto
// (BUL07), 406 m ate o anel mais perto (AN5), 3.363 m ate autopista, 4.310 m
// ate agua, 1.621 m ate a eclusa mais perto. Contra as 70 pecas de
// cidade.json mais Geode e Estadio: 2.296 m.
export const SPHERE_ENVELOPE_RADIAL = 227.0
export const SPHERE_ENVELOPE_ARCO = 370.8

// faixa de diametro estudada (Sphere de Las Vegas mede 157 m): mesmo o maior
// dos tres, 160 m, cabe com 33,5 m de praca de sobra no radial e 105,4 m no
// arco, de cada lado.
export const SPHERE_DIAM_MIN = 110
export const SPHERE_DIAM_REF = 160

// ⚠️ ESTE NUMERO ESTAVA ERRADO E FOI CORRIGIDO PARA 118,3 EM 07/09. Ver
// "A correcao do tabuleiro", abaixo: 111,0 vem de uma grade sobre 160x160 m,
// que e a pegada da ESFERA, mas o tabuleiro cobre o LOTE INTEIRO (227,0 x
// 370,8) e ali o relevo vai a 117,85 m. O valor de producao esta em
// app/city/plaza/sphere.ts.
export const SPHERE_PLATAFORMA_Y = 111.0   // ← SUBSTITUIDO POR 118,3
```

## A base tem praça, e ela é chão de verdade

Decisão do fundador, 07/09: *"a base tem praça, não precisa elaborar muito por enquanto,
mas já deixe o espaço, como temos na arena e no geodo, ambos possuem um tabuleiro, que
depois será normalizado no lote inteiro que o elemento ocupa"*.

Então a Sphere segue a regra que o Estádio já pagou e o Geode herdou: **peça de infra ocupa
um número inteiro de módulos da teia, porque os lados do módulo SÃO ruas**. Coordenada
escolhida a olho põe avenida dentro do prédio.

⚠️ E ela precisa ser **caminhável**, porque o fundador declarou o destino da cidade:
*"depois essa cidade vai passar pro modo de visualização game em terceira pessoa estilo
GTA"*. Isso muda o projeto da base: ela não é pedestal visto de longe, é chão que alguém
vai pisar, a 1,7 m de altura do olho. Escala humana, acesso, calçada, e detalhe que aguenta
ser visto de perto.

## ⚠️ DIAMETRO FECHADO: 135 m

Escolhido pelo fundador em 07/09, entre as tres opcoes medidas (110, 135, 160).

Com 135 m no modulo escolhido sobram, por lado: **46,0 m de praca no lado radial** e
**117,9 m no lado do arco**. E o meio-termo entre imponencia e espaco de chao: os 160 m da
Sphere de Las Vegas cabiam, mas deixariam so 33,5 m de praca radial, e a base tem de ser
caminhavel porque a cidade vai para terceira pessoa.

Referencia de escala: a de Las Vegas tem 157 m de largura por 112 de altura (ela e um
elipsoide achatado, nao uma esfera perfeita). A nossa, sendo esfera de 135, fica **mais
alta que a original** e um pouco mais estreita.

## Como se faz o LED (rota escolhida)

**Shader procedural de ponto** na casca inteira: a esfera continua sendo uma malha barata e
o padrão de pixels nasce no fragment shader, lendo uma textura de baixa resolução. Lê certo
nas duas pontas: a 3 km os pontos somem por sub-pixel e ela vira um ponto de luz, como
fisicamente deve ser; a 100 m o padrão aparece e lê como painel.

**Faixa equatorial para texto**, reusando a fonte pixelizada 5x7 que o Estádio já construiu.
Os polos ficam só para cor: escorço de perspectiva torna qualquer letra ilegível ali.

⚠️ A rota preguiçosa (textura esticada, sem padrão de ponto) é a que produz **esfera pintada
em vez de tela**, e é o caminho de menor esforço sob prazo. Não é aceitável.

## Regras de gosto, herdadas da casa

- `#E8660D` para o dado, nunca o lava `#F56E0F` nem neon: instrumento, não anúncio.
- **verde é só status**, nunca valor. Nada de vermelho e verde para preço: é estética de
  corretora, e o projeto inteiro evita esse registro.
- roxo é banido.
- **nada tiqueteia**: sem contador regressivo em segundos, sem interpolação fingindo
  precisão que a rede não tem. A doutrina inteira de `snapshot.tsx` vale aqui.
- **o estado ocioso é sóbrio** e o intervalo comercial é que sobe de saturação. É esse
  contraste que separa marco de cidade de bola de discoteca.

## O custo

Fillrate é o vilão, não triângulo: a 300 m a esfera ocupa cerca de 28 graus do campo de
visão e cada fragmento roda o shader. Escalonamento por tier: no perfil fraco, fora da
distância de leitura, a casca cai para material emissivo liso, preservando cor e brilho.

⚠️ Ela **não** carrega sob demanda como a caverna do Leônidas. Sumir do boot mataria a razão
de ela existir, que é ser vista de muitos pontos. O que escalona é o DETALHE, não a peça.

## A grade de conteudo, fechada pelo fundador em 07/09

> "A esfera mostra preco, volume mais alguns dados, reage a tx feitas pra nossa carteira,
> avisa bloco BTC minerado com X tx de dog com volume de x dog, passa propaganda, por
> enquanto da Kray Space, aviso do snapshot bloco 966.670 com countdown."

### O que roda em ciclo (o estado)

| bloco | conteudo | fonte, ja publicada |
|---|---|---|
| PRECO | preco do DOG | `/api/price/kraken` (mais 9 fontes), cache 30 s |
| VOLUME | volume 24h, maxima e minima | `/api/war/ticker`, cache 60 s |
| PULSO | mempool DOG: pendentes, pousos, taxa | `/api/mempool/dog`, o MESMO feed que a /city ja consome a cada 6 s |
| SNAPSHOT | contagem ate o bloco 966.670 | derivado do `tip_height` que vem no mesmo payload |

### O que interrompe o ciclo (o evento)

| evento | o que anuncia |
|---|---|
| **compra ou envio para a carteira** | a transacao, com valor e remetente. `DONATION_WALLET` mais a consulta que `app/api/donate/leaderboard/route.ts` ja faz |
| **bloco BTC minerado** | o bloco, com **quantas transacoes DOG entraram nele e o volume em DOG**. Agregacao por `block_height` sobre `dog_transactions`, que ja guarda os dois campos |
| **mint de terreno** | depois do snapshot; o mecanismo nasce pronto |

### O intervalo comercial

Por enquanto um parceiro so: **Kray Space**. A Kray ja e parceira do projeto e ja tem torre
na cidade, entao a peca dela na Sphere conversa com uma presenca que ja existe no tecido.

⚠️ A proporcao de tempo de tela entre dado e propaganda e garantida no CODIGO, nao em
politica comercial. Anuncio paga e dado nao, e essa pressao esvazia a diferenciacao sozinha
se ficar a criterio de quem vende.

## ⚠️ O countdown do snapshot e EM BLOCOS, nunca em segundos

O fundador pediu "aviso do snapshot bloco 966.670 com countdown", e a forma certa ja e
doutrina desta casa, escrita e paga: a contagem se faz **em blocos, pelo `tip_height`**, e
nao em tempo. Motivo: o intervalo entre blocos e uma media, nao uma promessa, e um relogio
regressivo em segundos finge uma precisao que a rede nao tem. Quando a rede atrasa, o
relogio mente; quando adianta, ele salta.

Entao a peca mostra **quantos blocos faltam** e, se quiser dar noção de tempo, uma
estimativa declarada como estimativa. Nada tiqueteia.

# EXECUTADO em 07/09/2026: a peça e o shader de LED

Tudo abaixo está em `app/city/plaza/sphere.ts` (arquivo novo) e ligado por 27 linhas em
`plaza-scene.tsx`. `npx tsc --noEmit` limpo. Nenhum número aqui é estimado: todos saíram de
medição offline com `npx tsx`, contra o mesmo `public/lunar/btc-core-heightmap.f32` e a
mesma `caixaDoModulo()` que o Geode e o Estádio usam.

## ⚠️ A correção do tabuleiro: 111,0 estava errado, é 118,3

O `SPHERE_PLATAFORMA_Y = 111,0` do estudo de sítio foi medido numa grade sobre **160 x 160
m**, que é a pegada da esfera. Só que o tabuleiro não cobre a esfera: ele cobre o **lote
inteiro**, porque a praça reservada é o resto do módulo e o fundador pediu o chão
"normalizado no lote inteiro que o elemento ocupa". Medido em grade de 2 m sobre
`polyDoModulo(SPHERE_MOD)`:

| onde | mínimo | máximo | desnível |
|---|---|---|---|
| pegada de 160 x 160 (o que o estudo mediu) | 100,79 m | 111,15 m | 10,4 m |
| **o módulo inteiro, 227,0 x 370,8** | **97,69 m** | **117,85 m** | **20,2 m** |

A cota máxima cai numa **quina** do módulo (o vértice 2 do polígono mede 117,39 m). Um
tabuleiro em 111,0 deixaria essa quina **furando o piso em 6,85 m**, que é exatamente a
falha de calçada que o fundador apontou na chapa do Estádio, só que descoberta antes de ir
à chapa. Valor de produção: **118,3 m** (117,85 + 0,4 de margem, arredondado).

⚠️ **E o preço está medido, não escondido:** o talude na quina baixa chega a **20,6 m**.
Hoje ele é saia reta. Escalonar em terraços é dívida declarada.

## A peça assentada

| | |
|---|---|
| diâmetro | 135 m (esfera) |
| assentamento | enterrada em 0,88 R: polo sul 8,10 m abaixo do tabuleiro |
| encontro com o piso | círculo de **32,06 m** de raio, onde o plinto assenta |
| **altura acima do tabuleiro** | **126,9 m** (a de Las Vegas tem 112) |
| calota escondida | 6,0% da área, tirada da malha pelo `thetaLength` |
| praça reservada | 46,0 m no radial e 117,9 m no arco, por lado, caminhável |

## O shader de LED

**Passo de 20,71 cm**, e o número não é gosto: fechar a grade em potência de dois dá
`2πR / 2048 = 20,71 cm` no equador e `πR / 1024 = 20,71 cm` do polo ao polo, ou seja célula
**quadrada por construção**. Painel resultante: **1,34 milhão de LEDs** sobre 57.256 m² de
casca (a de Las Vegas tem 1,2 milhão a ~20 cm). Com FOV de 42° e 1080 px:

| distância | LED na tela | leitura |
|---|---|---|
| 20 m | 15,26 px | painel resolvido |
| **100 m** | **3,05 px** | **o padrão de disco aparece e lê como PAINEL** |
| 152 m | 2,01 px | transição |
| 305 m | 1,00 px | o padrão morre aqui |
| 1.000 m | 0,31 px | ponto de luz |
| **3.000 m** | **0,10 px** | **sub-pixel: ponto de luz, fisicamente correto** |

As quatro decisões que fazem o padrão nascer no fragmento sem a rota preguiçosa:

1. **O tamanho do ponto na tela é analítico, não `fwidth`.** A longitude sai de
   `atan(p.z, p.x)` e tem costura em ±π, onde `fwidth` explode e desenharia uma linha de
   erro no meridiano para sempre. `uPasso · face / (vD · uPxAng)` não precisa de derivada.
2. **A máscara desvanece para a PRÓPRIA MÉDIA.** De perto o sinal vale `1/0,503 = 1,99`
   dentro do disco e 0 no vão; de longe vale 1,0 liso. Verificado numericamente: média
   1,000 nas duas pontas, desvio máximo de 3,5% na transição. Por isso a esfera não muda de
   brilho ao se afastar, ela só perde a granulação.
3. **As colunas caem por oitava de latitude, ARREDONDADA.** Com `floor()` puro a célula ia
   a 0,500 de quadrada logo abaixo de lat 60° (medido), ou seja meia célula de largura, que é o
   aliasing que a oitava veio evitar. Com arredondamento fica entre 0,707 e 1,414.
4. **Duas amostras da mesma textura**, uma encaixada no centro da célula (LOD ~0, dá a
   leitura de painel) e uma contínua (mipmap faz a média de longe), com limiares próprios.

## A faixa de texto: a conta que a moveu para baixo do equador

Todo observador da cidade está **abaixo** do centro da esfera (centro em y = 177,70 m,
olho a 1,7 m). Medida a compressão exata da altura da letra, `√(1 − (t̂·v̂)²)`, e ela é a
mesma **em qualquer azimute** porque a esfera é de revolução e a faixa é de latitude
constante, e é essa simetria que dispensa varrer azimute.

| lat \ d | 33 m | 60 m | 113 m | 200 m | 400 m | 1000 m | 1800 m |
|---|---|---|---|---|---|---|---|
| +15° | 0,00 | 0,00 | 0,30 | 0,65 | 0,86 | 0,94 | 0,95 |
| **0° (equador)** | 0,00 | 0,00 | **0,62** | 0,87 | 0,97 | 1,00 | 1,00 |
| **−20°** | 0,00 | 0,25 | **0,97** | 1,00 | 0,98 | 0,96 | 0,95 |
| −30° | 0,00 | 0,55 | 0,99 | 0,97 | 0,92 | 0,89 | 0,88 |
| −40° | 0,00 | 0,94 | 0,89 | 0,89 | 0,82 | 0,79 | 0,78 |

Faixa de leitura: **113,5 m** (borda do lote) a **1.800 m** (além disso a letra de 11,60 m
cai abaixo de ~9 px). Sobre ela, a latitude ótima é **−20,0°, pior compressão 0,950**, e as
janelas por limiar são:

| limiar | latitudes | altura de faixa |
|---|---|---|
| 0,90 | −27,25 a −15,50 | 13,8 m |
| **0,85** | **−33,00 a −12,00** | **24,7 m ← escolhida** |
| 0,80 | −37,75 a −8,75 | 34,2 m |
| 0,70 | −46,25 a −3,75 | 50,1 m |

⚠️ **Uma faixa realmente equatorial (−8° a +8°) tem pior compressão 0,451**, ou seja letra
na metade da altura vista do próprio lote. É esta medição que move a faixa para baixo. Em
produção ela vai das **linhas 580 a 700** da grade de 1.024, isto é **latitude −11,95° a
−33,05°, 24,85 m**.

⚠️ **De 33 m não se lê nada, em latitude nenhuma:** quem está no pé olha para cima em 60° e
vê tudo de perfil. Geometria, não defeito, e vale igual para a de Las Vegas.

### O texto, reusando a matriz 5x7 do Estádio

A tabela é a mesma da Torre Central e do letreiro do Estádio (a versão em TypeScript vive
em `app/dogcity/sections/construction-fund.tsx:209`), mais `$ : / + #`, que preço e altura
de bloco exigem. Avanço de 8 pixels de glifo (5 + 3 de vão):

| linha | pixel de glifo | letra | casas na volta | alcance |
|---|---|---|---|---|
| grande | 8 LED = 1,657 m | 8,28 x 11,60 m | **32, fecham exatas** | 1.627 m |
| pequena | 4 LED = 0,828 m | 4,14 x 5,80 m | **64, fecham exatas** | 814 m |

⚠️ **O orçamento de caracteres é apertado, e a próxima frente precisa dele.** Medida a
compressão da largura, o arco legível de um azimute só é **96° a 200 m** (27% da volta),
106° a 400 m e 114° a 1.000 m. Em casas: **8,5 de 32 grandes e 17,1 de 64 pequenas**. Como
`repetirNaVolta()` distribui `floor(nChars/(len+1))` cópias, a regra que garante uma cópia
inteira de qualquer ponto da cidade é **≤ 7 caracteres na linha grande e ≤ 15 na pequena**.
É por isso que a grande carrega o VALOR e a pequena o RÓTULO: valor é curto e precisa ser
visto de todo lado.

## Os três defeitos que a renderização offline pegou

A peça foi renderizada fora do navegador (traçador de raio próprio rodando o mesmo
fragment shader, dirigindo o código real com um canvas 2D falso). Três defeitos que
nenhuma revisão de código teria achado:

1. **O texto saía ESPELHADO**, e não um pouco: "0.00042" lia "24000.0". Visto de FORA da
   esfera, um observador em −x tem a direita da tela em +z, e ali `atan(p.z, p.x)`
   DECRESCE. A longitude entra negada.
2. **A casca lia como buraco preto.** `#15161A` em linear é 0,007, abaixo da refletância de
   5 a 8% de um painel de LED real, e o termo de luz era uma constante cravada no shader
   (`0.16 + 0.55·sol`), ou seja a peça ficava fora do ciclo de dia da cidade. Virou
   `#2A2C33` mais `uAmb`/`uSolCor` alimentados de fora por `iluminar()`, mais realce de
   borda (contra o céu preto da Lua, esfera escura sem borda perde a silhueta).
3. **A 3 km ela lia como ponto ESCURO, não de luz.** Quando o texto some no `textCull`, a
   faixa desvanecia para o CHÃO dela (`#241A14`, marrom quase preto), e a faixa é a única
   parte acesa e só 12% da altura projetada. Agora ela desvanece para a **média medida da
   própria faixa**, que é o mesmo princípio do padrão de ponto. Medido: a faixa fica **4,01x
   mais luminosa** que a média da esfera, e o que sobra de longe é um anel aceso.

E dois defeitos que a tabela de custo pegou:

4. **O degrau de fillrate disparava no perfil forte**, porque `min(distLiso, distPadrao)`
   com `distLiso = Infinity` ainda dá um número finito. Ganho: deixar de pagar o shader em
   1,5% da tela. Preço: estalo visível numa peça que se vê de 5 km. Só troca no perfil
   fraco agora, que é o que o dossiê pede.
5. **O material liso apagava o anel.** Ele não tem textura, então a assinatura da peça
   sumia no degrau. Agora ele desenha a faixa **proceduralmente** (um `asin` e dois
   `smoothstep`, zero textura), e arte de corpo pintada (o anúncio) **desliga o degrau**,
   porque anúncio é justamente o conteúdo que não pode sumir no meio do intervalo.

## Custo por tier, medido

| perfil | tri casca | tri base | chamadas | textura | dpr | 1 LED = 1 px em | liso a partir de | texto some em |
|---|---|---|---|---|---|---|---|---|
| desktop HIGH | 25.440 | 704 | 3 | 2048x1024 (10,7 MB) | 1 | 305 m | nunca | 1.700 m |
| desktop BALANCED | 16.256 | 704 | 3 | 2048x1024 (10,7 MB) | 2 | 610 m | nunca | 1.300 m |
| desktop LOW | 16.256 | 704 | 3 | 1024x512 (2,7 MB) | 1,25 | 381 m | 381 m | 600 m |
| celular BALANCED | 9.120 | 704 | 3 | 1024x512 (2,7 MB) | 1,5 | 358 m | 358 m | 1.000 m |
| celular LOW | 9.120 | 704 | 3 | 1024x512 (2,7 MB) | 1,25 | 298 m | 298 m | 600 m |

⚠️ **E o fillrate é o vilão, confirmado com número.** Fração da tela que roda o shader:

| perfil | tela | 100 m | 300 m | 1.000 m | 3.000 m |
|---|---|---|---|---|---|
| desktop HIGH | 1920x1080@1 | **100%** | 16,6% | 1,5% | 0,2% |
| desktop BALANCED | 1920x1080@2 | **100%** | 16,6% | 1,5% | 0,2% |
| desktop LOW | 1920x1080@1,25 | **100%** | 16,6% | 1,5% liso | 0,2% liso |
| celular BALANCED | 390x844@1,5 | **100%** | **64,1%** | 5,8% liso | 0,6% liso |
| celular LOW | 390x844@1,25 | **100%** | **64,1% liso** | 5,8% liso | 0,6% liso |

Graus de campo: 68,0° a 100 m, 25,4° a 300 m, 7,7° a 1 km, 2,6° a 3 km.

⚠️ **A 100 m ela ocupa a tela inteira em todo perfil**, e isso não tem escapatória: é a
distância em que o padrão de ponto tem de aparecer, que é a razão de ela existir. O que
segura o custo é o fragmento ser barato POR NATUREZA: sem laço de luz, sem amostra de
sombra, duas buscas de textura, um `atan`, um `asin`, dois `log2`. É menos por fragmento do
que um `MeshStandardMaterial` da própria cidade, que carrega 12 pontuais e 2 spots.

⚠️ **Triângulo não é o vilão, e a conta prova:** com 128 gomos no equador a flecha da corda
mede **2,0 cm** numa esfera de 67,5 m de raio. Invisível de qualquer distância. Por isso a
malha é generosa e barata e quem escalona é o fragmento.

## O perfil, lido campo a campo

Esta casa já teve duas vezes o defeito de um módulo receber o `PerfProfile` e nunca ler
nada dele, então está escrito e é conferível.

**Lidos:** `tier` e `quality` (segmentos, se o liso está armado, suavização do disco);
`cortaTextura` (escolhe o lado BASE da textura, e é o campo certo por definição, porque
`perf.ts` diz que `texLado` "não enxerga família" e que quem troca por arquivo menor
"precisa decidir por CONTEÚDO"); `texLado` (teto duro por cima, com os dois lados escalados
pelo mesmo fator, porque a textura é 2:1); `textCull` (distância em que a letra desvanece);
`lodDistance` (teto do degrau de fillrate); `maxPixelRatio` (piso do tamanho do pixel
quando o chamador não mede: tela mais densa lê o ponto de mais longe, e isso é físico);
`smallCull` (o plinto some); `antialias` (sem MSAA a borda do disco precisa de mais
suavização); `shadowMapSize` e `softShadows` (decidem a sombra).

**Não lidos, e por quê:** `censusPoints`, `jetParticles`, `crystalLod`, `parkDetailCull` e
`domeCell` são de outras peças; `shadowUpdateEvery` e `minPixelRatio` são do
`FrameGovernor`, que é global.

## A interface de conteúdo, pronta e não ligada

`pintar(c: SphereConteudo)` recebe `{ grande, pequena, ganho, cor, corRotulo, pintarCorpo }`
e redesenha a textura. **Não chamar por quadro**: é um canvas de até 2.048 x 1.024 e um
envio de até 8 MB. Ele existe para ser chamado quando o DADO muda, que é a cada dezenas de
segundos no melhor caso (`/api/price/kraken` tem cache de 30 s). Nada tiqueteia.

Conteúdo desta rodada, só para provar o shader: `{ grande: '0.00042', pequena: '$DOG USD
SPOT', ganho: 0.42 }`. **Ganho 0,42 é o estado ocioso**, e é sóbrio de propósito: é o
contraste entre ele e o do intervalo comercial que separa marco de cidade de bola de
discoteca.

## Ligação em `plaza-scene.tsx` (mudança mínima, 27 linhas)

1. o `import`;
2. `let sphere: Sphere | null = null`;
3. o bloco que constrói, adiciona à cena e registra no `DistanceCuller` com corte de
   14.000 m (ela **não** some: 81% do tecido enxerga o topo dela);
4. `sphereParcela()` na lista de parcelas, junto do Estádio e do Geode, senão a teia
   desenha rua por dentro do tabuleiro;
5. `sphere?.update(camera.position, spherePxAng(...))` no laço, porque o shader decide se
   desenha o ponto pelo tamanho dele **em pixel de tela** e precisa saber o tamanho do pixel;
6. `sphere?.dispose()` na limpeza.

`teia.ts` e `vias.ts` **não** foram tocados.

## Aberto

- [x] varrer `cidade-malha.json` (bulevares, anéis, canais) antes de fechar o sítio. Feito
      em 07/09, e é o que reprovou o rumo 320 / r 3.800.
- [ ] **o conteúdo vivo**: a grade (PREÇO, VOLUME, PULSO, SNAPSHOT), os três eventos e o
      intervalo comercial. A interface está pronta; nada está ligado.
- [ ] a proporção 70/30 entre dado e propaganda deve ser garantida no CÓDIGO, não em
      política comercial: anúncio paga e dado não, e essa pressão esvazia a diferenciação
      sozinha com o tempo.
- [ ] **o talude de 20,6 m na quina baixa do lote** vira terraço. Hoje é saia reta.
- [ ] **o programa da praça da base**. Esta rodada garantiu o espaço (46,0 x 117,9 m por
      lado) e o chão caminhável, e nada além disso. A cidade vai para terceira pessoa e
      alguém vai pisar aqui a 1,7 m de altura de olho.
- [ ] `iluminar()` precisa ser chamado com a hora do ar da cena. Enquanto ninguém chamar, a
      esfera usa um dia lunar padrão e não acompanha o entardecer da cidade.
