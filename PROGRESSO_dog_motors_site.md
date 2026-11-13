# DOG MOTORS no site (vitrine de venda dos carros)

Branch `claude/dog-motors-site`, criada de `claude/carros-compra` em `6100a37858` (buscada por HTTPS; o backend é o PR #62).
Worktree `DogData-v1-motors`; `node_modules` é link para o da árvore principal (não entra em commit).
Regras desta frente: nada de deploy, nenhuma variável da Vercel tocada, PR sem merge (depende do #62), commits por passo,
nunca `git add .`. Copy 100% em inglês, sem travessão, sem rosto do $DOG, sem promessa de preço futuro.

## Plano

1. [x] Imagens: os renders da DOG MOTORS (r2_02 herói, r2_03 Gallery, r2_04 torre, r2_05 Ring, r2_01 aérea) e as 18 fotos de
   estúdio (`<slug>_frente34.png`, recortadas pelo carro) em AVIF + WebP com larguras responsivas, por script reproduzível.
2. [x] Dados: a ficha de jogo dos 18 (velocidade máxima, 0-100 medido no Rapier, tração, motor) e os créditos CC BY, com teste
   que tranca ids, nomes e classes contra `lib/game/cars/catalog.ts`.
3. [x] Página `/dogcity/motors`: herói, o lugar (Gallery, DOG TOWER, DOG RING, corrida da AN7), a grade dos 18 por classe,
   como comprar, créditos. Preços do `GET car-quote`; loja fechada (503) = "Coming soon" sem preço e sem botão.
4. [x] Compra: o modal da licença (`components/donate/donate-modal.tsx`) ganha o modo "car": sessão BIP-322, pedido
   (`POST car-quote`), valor EXATO do pedido, pagamento pela carteira ou endereço + QR, e o estado do pedido.
5. [x] Bloco curto na landing apontando para a página; `/motors` no domínio dogcity.space.
6. [x] Provas: tsc, testes, build; chapas Chromium desktop e WebKit em emulação de iPhone; revisão dura contra os critérios.

## Feito

- [F1] `scripts/motors/make-images.mjs` + `prep_cars.py` -> `public/dogcity-motors/` (143 arquivos, 2,5 MB no total; o maior
  carro em AVIF tem 15 KB, o herói 1600 px 34 KB). O fundo do estúdio das 18 fotos foi igualado (deslocamento por linha na foto
  inteira; uma máscara deixava uma borda oval na mancha de luz atrás do carro) e o recorte é 16:10 pelo centro do carro.
- [F2] `app/dogcity/motors/cars.ts`: nome e classe do catálogo da loja (o mesmo que cobra), números do jogo, créditos.
  `quote.ts`: a leitura do GET car-quote e do GET cars, falha fechada. `media.ts`: os srcset.
- [F3] A página: `page.tsx` (servidor: metadados, OG próprio, pré-carga do herói por proporção, a vitrine já no HTML pela
  própria rota com teto de 800 ms), `motors.tsx` (cromo próprio: marca SVG, DOG MOTORS, a carteira, Play; rodapé com os
  créditos), `hero.tsx`, `place.tsx`, `showroom.tsx`, `how.tsx`, `motors.css`.
- [F4] Modo "car" da janela de pagamento: `components/donate/car-checkout.tsx`, ligado em `DonateProvider`
  (`useDonate().open({ car })`), carregado sob demanda. O QR saiu para `components/donate/qr-code.tsx` (a conta igual);
  `bip21Uri` ganhou o rótulo opcional (DOG MOTORS); `lib/wallet/donate.ts` ganhou `sendDogExactAtoms`.
- [F5] `lib/game/cars/order-view.ts` (a resposta do POST conferida inteira), `pay-to.ts` (a segunda declaração dos endereços
  do carro), `order-status.ts` + `GET /api/dogcity/car-order` (o estado do pedido, só leitura, só a carteira da sessão).
- [F6] Landing: `app/dogcity/sections/motors-call.tsx` entre 04 The city e 05 The calendar (sem número de folha); "DOG Motors"
  na gaveta; `middleware.ts` serve `dogcity.space/motors`.
- [F7] Testes: `app/dogcity/motors/motors.test.ts` (9) e `lib/game/cars/front.test.ts` (15).

## Decisões

- [D1] Números do jogo, não de fábrica: velocidade máxima de `TIPOS_CARRO` e 0-100 MEDIDO no Rapier com o GLB de verdade
  (dogcity-mundo `claude/tipos-carro` e68ad5983, ficha de `PROGRESSO_tipos_carro.md`). O rodapé diz "in-game figures".
- [D2] A classe "popular" do catálogo aparece como "Compact" (o pedido do fundador). Nome e classe nunca são digitados aqui:
  vêm de `lib/game/cars/catalog.ts`.
- [D3] Grade única dos 18 na ordem das classes, com filtro por classe (não uma seção por classe): 18 em 3 colunas = 6 fileiras,
  em 2 = 9, sem fileira capenga; o filtro centra o que sobra (1 Luxury fica no meio, não encostado).
- [D4] O cartão tem quatro faixas fixas (foto, nome, dados, preço com ação) e a faixa do preço tem a mesma altura em todos
  os estados (aberta, fechada, sem preço, fora de venda, Owned): a grade fica em registro com a loja aberta ou fechada.
- [D5] Loja fechada = "Coming soon" e uma barra de estado sem ação no lugar do botão (não é botão). "Prices appear the day
  the showroom opens": nenhuma frase fala em preço subir.
- [D6] O preço em BTC do cartão é a prévia do GET (indicativa, "About ... BTC now"); o valor que se paga é o do pedido.
- [D7] Créditos CC BY por autor + link curto do modelo (`sketchfab.com/models/<id>`) + licença + "changed": é o que a CC BY
  4.0 exige (o título não é obrigatório na 4.0), e assim nenhum nome de marca real aparece na página de venda.
- [D8] O modo "car" reaproveita o provedor, o portal, as funções de envio, o QR e o BIP-21 da janela da licença, com casca
  própria no visual da landing v3 (abre no portal `[data-motors-portal]`, dentro da árvore da página, para herdar a fonte
  condensada e os tokens). A janela da carteira abre por cima e a de compra volta quando ela fecha.
- [D9] Dinheiro: dono = carteira da SESSÃO (a janela pede a assinatura BIP-322 se a sessão for de outra carteira); o pedido é
  do servidor e a tela recusa resposta fora da forma; o valor é o EXATO do pedido ($DOG em átomos inteiros, sem ponto
  flutuante; recusa divisibilidade diferente de 5); a trava corre pelo relógio do servidor e é conferida no clique.
- [D10] Segunda declaração dos endereços do carro (`lib/game/cars/pay-to.ts`), como `PONTAS_ESPERADAS` da licença: o
  `payTo` do pedido só vira endereço, QR e botão na tela quando bate com ela. Vem VAZIA (o fundador preenche quando cria os
  endereços): até lá a janela mostra "Do not pay from this screen".
- [D11] Pedido sem pagamento não volta do localStorage (uma extensão poderia trocar o endereço guardado). Só o par pedido +
  txid volta, e o estado dele vem do servidor (`GET /api/dogcity/car-order`).
- [D12] `GET /api/dogcity/car-order` é a única rota nova de servidor: só leitura, só a carteira da sessão vê o próprio pedido,
  e a transação é lida no mempool.space contra o pedido GRAVADO (destino, pagador, sats). Não grava nada; o carro continua
  sendo dado só pela varredura e pela função do banco (#62).

## Provas

- `npx tsc --noEmit` verde. Testes: `app/dogcity/motors/motors.test.ts` 9/9, `lib/game/cars/front.test.ts` 15/15, e os vizinhos
  intactos: `lib/game/cars/cars.test.ts` 31/31 (#62), `lib/dog/licence-presets.test.ts` 16/16 (lê o donate-modal), `link-licenca` 4/4.
- `next build` verde (variáveis falsas de Supabase/Redis só para importar): `/dogcity/motors` 20,4 kB, 244 kB de primeira carga;
  `/api/dogcity/car-order` 456 B.
- Chapas em `chapas/dog_motors_site/` (`scripts/motors/chapas.mjs`, servidor de PRODUÇÃO local, trava do navegador pega e
  solta, um navegador por vez): Chromium 1440x900 (d01-d11) e WebKit em emulação de iPhone 13 (m01-m10).
  - loja FECHADA de verdade (sem `CAR_FUND_*` a rota responde 503 `sales_closed`): 18 cartões "Coming soon", sem preço e sem botão;
  - loja ABERTA simulada só na chapa (preços marcadores do catálogo, carteira assinada, c05 na garagem): preço em $DOG,
    prévia em BTC, "Owned", janela de compra, pedido BTC e $DOG com o portão do destino FECHADO ("Do not pay from this
    screen", a segunda declaração vem vazia);
  - `*_SIMULADO*`: o estado pagável (endereço, valor exato, QR, BIP-21) com a segunda declaração preenchida SÓ na chapa
    com o endereço simulado (arquivo revertido, nada disso entra no código).
- Medidas (`chapas/dog_motors_site/medidas.json`): cartão no iPhone 13 = 563 px de 664 úteis no Safari (0,85 tela;
  0,67 da tela inteira de 844); desktop 615 de 900 (0,68). Rolagem lateral 0, nenhum travessão e nenhuma palavra em
  português no texto da página (Chromium e WebKit, loja aberta e fechada). Primeira tela no celular: o nome, a frase e os
  dois botões cabem. Carga local: LCP = a imagem do herói (`hero-m-720.avif` no celular), 138 KB de imagem no celular e
  147 KB no desktop na primeira carga, 249 KB de JS transferido.
- NÃO provado: compra com carteira de verdade (Xverse/UniSat assinando e transmitindo), `GET /api/dogcity/car-order` contra
  banco e mempool.space de verdade (a lógica pura está testada), iPhone físico (a WebKit é a do Playwright em emulação).
- A WebKit do Playwright nesta máquina pede libavif16, libjxl0.8, libbacktrace0, libgav1 e libyuv, que o Ubuntu 24.04 não
  tem instalados: extraídos sem root em `/tmp/motors/wklibs` e passados por um lançador próprio (`WEBKIT_EXE`). Na chapa da
  WebKit a palavra `upgrade-insecure-requests` sai da CSP do documento (em http://localhost a WebKit sobe tudo para https;
  em produção, https, não muda nada).
## O que o fundador faz

1. Tudo do #62 primeiro (preços reais, `PRECOS_PROVISORIOS = false`, a 039, os endereços e as variáveis, o cron).
2. No MESMO passo em que criar `CAR_FUND_BTC_ADDRESS` e `CAR_FUND_DOG_ADDRESS`, escrever as pontas de cada endereço em
   `lib/game/cars/pay-to.ts` (`CAR_PAY_TO_ENDS`: os 10 primeiros caracteres, os 7 últimos e o tamanho). Sem isso a página
   abre a loja mas a janela não mostra endereço para pagar.
3. Mesclar este PR depois do #62 (ele parte da branch do #62).

## Riscos

- Tudo depende do #62: até a loja abrir, os 18 cartões ficam em "Coming soon" (de propósito).
- Sem as pontas em `lib/game/cars/pay-to.ts`, a loja pode abrir no servidor e a janela NÃO mostra endereço para pagar
  (falha fechada; é um passo do fundador junto com as variáveis).
- O texto do lugar descreve o projeto aprovado (Gallery, DOG TOWER com entrega, DOG RING com test drive, corrida da AN7 com
  ranking por modelo e regras e prêmios nas docs antes do campeonato). Se alguma peça ainda não estiver no jogo quando a página
  for ao ar, o fundador decide o tempo verbal.
- Os números da ficha são da branch `claude/tipos-carro` do jogo (e68ad5983). Mudou a física, muda `app/dogcity/motors/cars.ts`
  (o teste só tranca as faixas da classe).
- Os carros são modelos CC BY de carros reais com emblemas removidos; o desenho continua reconhecível (o mesmo risco do jogo).
- O envio do valor exato em $DOG pela carteira segue a mesma premissa da licença (o `amount` da runa em unidades atômicas,
  conferido na UniSat; na Xverse, a carteira mostra o valor antes de assinar).
- A faixa "Unclaimed lots" da landing também aparece aqui (vem do layout de /dogcity, como em /docs).
