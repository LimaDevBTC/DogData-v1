# DOG MOTORS no site (vitrine de venda dos carros)

Branch `claude/dog-motors-site`, criada de `claude/carros-compra` em `6100a37858` (buscada por HTTPS; o backend é o PR #62).
Worktree `DogData-v1-motors`; `node_modules` é link para o da árvore principal (não entra em commit).
Regras desta frente: nada de deploy, nenhuma variável da Vercel tocada, PR sem merge (depende do #62), commits por passo,
nunca `git add .`. Copy 100% em inglês, sem travessão, sem rosto do $DOG, sem promessa de preço futuro.

## Plano

1. [ ] Imagens: os renders da DOG MOTORS (r2_02 herói, r2_03 Gallery, r2_04 torre, r2_05 Ring, r2_01 aérea) e as 18 fotos de
   estúdio (`<slug>_frente34.png`, recortadas pelo carro) em AVIF + WebP com larguras responsivas, por script reproduzível.
2. [ ] Dados: a ficha de jogo dos 18 (velocidade máxima, 0-100 medido no Rapier, tração, motor) e os créditos CC BY, com teste
   que tranca ids, nomes e classes contra `lib/game/cars/catalog.ts`.
3. [ ] Página `/dogcity/motors`: herói, o lugar (Gallery, DOG TOWER, DOG RING, corrida da AN7), a grade dos 18 por classe,
   como comprar, créditos. Preços do `GET car-quote`; loja fechada (503) = "Coming soon" sem preço e sem botão.
4. [ ] Compra: o modal da licença (`components/donate/donate-modal.tsx`) ganha o modo "car": sessão BIP-322, pedido
   (`POST car-quote`), valor EXATO do pedido, pagamento pela carteira ou endereço + QR, e o estado do pedido.
5. [ ] Bloco curto na landing apontando para a página; `/motors` no domínio dogcity.space.
6. [ ] Provas: tsc, testes, build; chapas Chromium desktop e WebKit em emulação de iPhone; revisão dura contra os critérios.

## Feito

## Decisões

## Provas

## O que o fundador faz

## Riscos
