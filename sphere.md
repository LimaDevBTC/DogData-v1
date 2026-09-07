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

// tabuleiro assenta na cota MAXIMA medida na peca (regra da casa, ver
// assentarGeode/assentarEstadio: canto alto fura o piso se for pela media),
// nao na media: 111,0 m (grade 5x5 sobre 160x160 m; desnivel de so 10,3 m
// dentro da peca, terraplenagem minima).
export const SPHERE_PLATAFORMA_Y = 111.0
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

## Aberto

- [ ] varrer `cidade-malha.json` (bulevares, anéis, canais) antes de fechar o sítio. O
      Estádio errou exatamente aqui na primeira tentativa: testou colisão contra as peças e
      esqueceu a malha viária.
- [ ] a proporção 70/30 entre dado e propaganda deve ser garantida no CÓDIGO, não em
      política comercial: anúncio paga e dado não, e essa pressão esvazia a diferenciação
      sozinha com o tempo.
