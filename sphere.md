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

Recomendação do estudo, com número: **rumo 320 (noroeste), r 3.800 m**.

O motivo é que já existe um distrito esportivo a leste-sudeste: o Geode em r 3.294 rumo
115,7, e o Estádio em r 3.296 rumo 105,0, a **615 m um do outro**. Um terceiro marco
gigante no mesmo azimute seria ruído de horizonte, não skyline. A 320 a folga medida é de
**6.936 m até o Geode e 6.769 até o Estádio**, ou seja onze vezes a folga que eles têm
entre si.

Altura não limita: a abóbada é calota rasa e a 3.800 m o teto está a 4.818 m.

⚠️ E a visibilidade obedece outra física: **sem atmosfera não há névoa**, e o limite por
curvatura da Lua para um objeto de 112 m é de 22,1 km, muito além dos 9 km da cidade. Quem
limita a visada é **oclusão** (prédios e os 118 m de diferença de cota entre quadrantes),
então o sítio certo é o mais alto e desobstruído, não o mais vazio.

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
