# Lista de ajustes da praça (fundador, 2026-08-19)

O quadro de tarefas desta frente. **Toda tarefa entra aqui antes de ser feita** e
sai daqui com o commit que a fechou; é este arquivo que impede a equipe de se
perder entre as tarefas. Regras da casa continuam valendo: nada genérico, cada
peça com razão de existir, licença CC0/CC-BY com crédito em `sf-assets.ts`,
orçamento de triângulos, e o padrão de trabalho (agentes baratos garimpam e
levantam, eu curo, monto e confiro por imagem).

**Contexto que muda o horizonte:** os outros projetos de cidade (cityupdate3.md,
crosschaincity.md, reorganizecity.md, masterplan.md) vão ser MOVIDOS para cá. A
cidade cresce em volta desta praça, que já está em produção. Nada aqui é
provisório.

| # | Tarefa | Estado | Notas |
|---|---|---|---|
| 1 | **A marca oficial** da BitFlow na face de trás | **feito (2ª rodada)** | a 1ª rodada escreveu só a palavra em canvas; o fundador corrigiu: tem que ser a LOGO. Agora é o lockup oficial (bicho de pixel + palavra) de `public/Bitflow.png`, com o branco vazado para alfa em `public/city/bitflow-logo.webp`, na mesma altura do letreiro da frente |
| 2 | **Padronizar o exterior** da BitFlow e da Kray | **levantamento feito, decisão do fundador** | os carros saíram na origem (estavam FUNDIDOS nas malhas dos lotes, fora do alcance do filtro por nome — item 13 só tinha pego os nós soltos). O resto do que destoa está listado abaixo, com proposta; são escolhas de gosto e eu não mexo sem o sim |
| 3 | **Retirar os pináculos brancos pontiagudos** em volta das placas dos fundadores | **feito** | eram o WATER_JET_RING da Needle (raio 81, 30 m); removido, e a animação junto |
| 4 | **Tour virtual inicial** ao entrar na cidade | **feito** | 10 paradas, 4,2 s de voo e 6,4 s de parada cada, com legenda embaixo e botão Skip; roda uma vez por sessão (nunca com `?view=`, `?plate=1` ou movimento reduzido) e qualquer gesto encerra. Botão "Tour" no HUD repete |
| 5 | **Revisar todas as placas**: algumas têm informação cortada | **feito (1ª rodada)** | auditoria automática mediu 15 textos: 4 de risco alto corrigidos (título do White Paper, "PAGE n OF 9", as duas linhas do Círculo dos Fundadores) |
| 6 | **"Live mempool" no topo da página** | **feito** | faixa grudada no alto da landing com órbita, DOG em voo, último pouso, mempool inteira e taxa do próximo bloco; clicar leva à praça. O hook do feed saiu de plaza-live para `use-mempool.ts` para a página inteira dizer o mesmo número |
| 7 | **Tirar o vídeo com scroll da home** | **feito** | o herói de 500vh e 180 quadros saiu, e com ele 22 MB de `public/landing/seq`. No lugar entrou uma chapa da cidade de verdade com as duas portas (entrar / financiar) |
| 8 | **CTA de doação dentro da cidade** | **feito** | cartão no HUD da praça com a barra do fundo lendo `/api/donate/leaderboard` (o mesmo número da landing) e link para `/dogcity#build` |
| 9 | **Capa na estátua do Leonidas** | **retirada pelo fundador** | o manto entrou e saiu no mesmo dia ("retire a capa do Leônidas"). A estátua volta a ser a caveira amarela, o traje preto e o ₿ no peito, sem manto. O modelo continua em `blender/build_leonidas_cape.py` → `public/city/leonidas-cape.glb` e volta com um argumento em `buildLeonidas` se ele mudar de ideia |
| 10 | **Mais ordinals no parque** + a coleção **Dog Social Club** completa perto da torre Kray | **feito (galeria)** | do PFP 88866326 cheguei ao pai 8a18494d…i0 (a logo do clube) e aos 306 filhos: muro curvo de 34×9 quadros no jardim ao lado da Kray, com o escudo e a placa. Falta, se o fundador quiser, espalhar ordinals soltos pelo parque |
| 11 | **Padronizar o nível das árvores** | **feito** | 3 das 6 do garimpo entraram (bordo japonês, mediterrânea, árvore antiga retorcida); **3 recusadas na folha de contato**: dois scans eram só tronco sem copa e a cerejeira de fotogrametria é meia árvore. E o gerador procedural saiu de vez no modo real: a copa-esfera sobre cilindro e a palmeira de nove fitas não existem mais. Os 44 pontos semeados dos setores viram MODELOS por quadrante, mais 38 tamareiras no fundo. Custo medido: 417 chamadas, 1,72 M triângulos |
| 12 | **Atualizar a landing** com fotos novas e criar o **post inicial** | **feito** | 11 chapas novas capturadas da cena viva (`scratchpad/capture_plates.py`, `?plate=1`), herói + galeria + parque apontando para elas; post inicial escrito em `posts/2026-08-19-satoshi-plaza-open.md`. Chapa antiga do templo (jardim do pódio) substituída pela boca da caverna |
| 13 | **Retirar todos os carros** | **feito** | levantamento achou SITE_TRAFFIC nas duas torres e SP_Taxi0..4 no spaceport; removidos na carga. Ficam as vias (PlazaRingRoad, estrada do parque) |
| 14 | **Templo do Leonidas**: preto e laranja, escondido numa caverna entre as monarcas, com caminho secreto | **feito** | saiu do pódio (onde estava torto e à vista) e entrou numa caverna assada no Blender (`build_leonidas_cave.py`): maciço de basalto de **117 m** com câmara de **64 x 53 x 45 m** (o fundador achou a 1ª pequena), boca em arco, três matacões escondendo a entrada, terraço de rocha e o sítio escavado no nível da soleira. O salão está repintado de preto e só as brasas o acendem (camada de luz própria: o sol da praça atravessa rocha). Caminho de lajes do pódio até a boca, rareando no fim, com mojões de brasa |

## Ordem de ataque

Primeiro o que é subtração e correção (3, 13, 11, 5), depois o que é peça nova
(1, 2, 9, 14, 10), depois o que é página e narrativa (6, 8, 4, 12, 7).

## Item 2: o que destoa nos dois lotes (levantamento de 2026-08-19)

Os dois lotes falam a língua de **quarteirão de cidade** (rua, meio-fio, carros,
pedestres, calçada retangular) dentro de um **jardim de palácio** radial. É isso
que não conversa. Peça por peça:

| Onde | O que destoa | Proposta |
|---|---|---|
| Kray e BitFlow | ~18 carros e ~30 pedestres fundidos nas malhas dos lotes | **feito**: carros fora, na origem (`build_kray_tower.py`, `build_bitflow_hq.py`). Pedestres ficam por enquanto: dão escala ao pé da torre |
| Kray | palmeira própria (escura, densa, 40+ no lote) ao lado da tamareira da praça: duas espécies encostadas | trocar as do lote pela mesma tamareira da praça, e rarear |
| Kray | chafariz de pluma branca, vocabulário só dele | manter a bacia, trocar o jato pela fonte da praça (temos `fountain-grand`, `fountain-basin`) |
| Kray | caixa de tela dourada a oeste do lote | identificar no script e decidir: ou vira pérgola do jardim, ou sai |
| Kray e BitFlow | o lote é um retângulo com meio-fio girado para a rua, sobre parterres radiais | chanfrar o canto e alinhar a testada ao anel, ou deixar o jardim invadir a esquina |
| BitFlow | tapete de piso cinza que corta o verde em diagonal | mesmo material do Anel, ou grama até o pódio |
| BitFlow | árvores redondas próprias na entrada | mesmas espécies reais da praça (bordo, mediterrânea) |

Nada disso é caro; é tudo escolha de gosto, e o custo de errar é ter que reassar
as duas torres de novo. Por isso vai para o fundador antes de ir para o Blender.

## Armadilhas medidas nesta frente (para não repetir)

- **Boolean do Blender com escala pendurada**: `shell - cave` colapsou de 5120
  faces para 6 (o maciço sumiu) porque os objetos tinham escala não uniforme no
  objeto, não na malha. Agora `bake()` aplica escala e rotação antes de qualquer
  boolean.
- **Culling mede distância em MUNDO**: registrar uma peça do parque com a posição
  LOCAL dela escondia a peça sempre (a caverna nunca aparecia).
- **Vistas que dependem do parque**: `TEMPLE_WORLD` só existe depois que o parque
  carrega; pedida na abertura, a câmera parava 86 m abaixo do chão. O portão de
  carregamento agora refaz a vista quando abre.
- **O sol não é ocluído**: uma direcional atravessa a rocha e acende o interior
  de qualquer caverna. Interior vai para uma CAMADA que o sol não enxerga.
- **Terreno entra na caverna**: o heightmap do parque sobe 19° e aparecia dentro
  da câmara como um piso cinza. O sítio inteiro é escavado por uma função que o
  parque todo lê (`groundLocal` com o corte da caverna).

## Levantamentos concluídos (2026-08-19)

- **Carros**: `SITE_TRAFFIC` (bitflow e kray) e `SP_Taxi0..4` (spaceport). Feito.
- **Placas**: 15 textos medidos; 4 de risco alto corrigidos, o resto dentro da
  margem. Repetir a auditoria quando entrar placa nova.
- **Árvores emblemáticas**: seis candidatos de fotogrametria/alta qualidade
  (oliveira antiga 100k faces, tamareira 40k, cerejeira 284k, árvore retorcida
  845k, bordo japonês 40k, árvore mediterrânea 78k). Entram no item 11 com
  orçamento de triângulos e substituindo as procedurais.
- **Dog Social Club**: **não encontrada** em API pública nenhuma (Magic Eden
  fora do ar no momento, ordinals.com sem a coleção, Hiro descontinuada, ord.io
  não resolve). Precisa do fundador: o **id de uma inscrição** da coleção, ou o
  link da coleção no marketplace que ele usa. Com um id eu puxo o resto pelo
  nosso próprio nó (o repositório tem o `ord`).

---
## Batalha dentro da cidade: auditoria de 27/08/2026
Levantada por quatro frentes lendo em paralelo (paridade de opcoes, mundo x local, escala 2,6x, encenacao) mais uma sintese, depois de o fundador dizer pela terceira vez que a batalha da cidade tem menos coisa que a do palco solo. **Ele estava certo, e a causa nao era falta de pecas.**
> A batalha da cidade não tem menos peças que a do palco solo: tem as mesmas peças, e boa parte delas está enterrada, encolhida ou apagada. O achado que sozinho explica a queixa do fundador é o datum: medi o heightmap real e o chão local da cratera está em y=+38, enquanto o grupo é posto em y=0, então tudo que o motor escreve com Y fixo (tiro, rastro, anel de choque, clarão, bola de fogo, fumaça, destroços, número de dano, traçantes, MLRS, morteiro em voo, luz da frente, neblina) nasce cerca de 96 metros de mundo abaixo do regolito opaco, enquanto os exércitos e os veículos, que usam altura(x,z), aparecem normalmente. Depois dele vem uma segunda família: THREE.Points e PointLight não leem a escala 2,6x do grupo (Sprite lê), então poeira, brasas, motas e o raio de luz de cada explosão encolhem só na cidade. A terceira é de contabilidade de luz: o culler apaga o grupo inteiro com as PointLights dentro e os obeliscos acendem duas de surpresa, o que recompila todo material iluminado de uma cena de 2,6M de triângulos exatamente durante o pouso cinematográfico. Os cinco primeiros itens do backlog são todos de risco baixo e esforço pequeno a médio, e nenhum deles pede bloom nem acende PointLight nova.

### Ja feito nesta rodada
- **Bocas de arma em espaco de mundo** (commit 148e744336): oito armas entregavam posicao de mundo para meshes filhos do grupo, que leem local. Medido: 5 a 24 pecas fora do campo em todas as amostras, ate 7.978 m. Depois: zero.
- **Opcoes que o motor criou para a praca** (commit 0b0b7ccb30): `motas`, `brilhoInterno` e `onImpactoGrande` nunca tinham sido ligadas.
- **O DATUM** (item 1 abaixo): o chao local da cratera estava em y=+38 com o grupo em y=0. Medido com a sonda: 23 a 30 pecas do teatro de fogo enterradas ~100 m abaixo do regolito em cada amostra, peca mais baixa em -1 m. Depois: zero enterradas, menor Y em 95 m contra chao de 99.

### Ferramenta de medicao (usar sempre, e sempre em /city)
`window.__plazaGuerra()` sob `?stats=1` percorre a batalha viva e devolve pecas visiveis, quantas estao fora do campo, a maior distancia, a altura do chao da cratera, o menor Y e quantas estao enterradas. Existe porque **clarao de boca dura 100 ms e nao aparece em chapa**: foi testar no palco solo, onde os defeitos de anfitriao nao existem, que escondeu tudo isso por semanas.

### Backlog aberto, na ordem
| # | Item | Risco | Esforco |
|---|---|---|---|
| 2 | THREE.Points e PointLight não leem a escala 2,6x do grupo: poeira, brasas, motas e a luz de impacto encolhem só na cidade | baixo | medio |
| 3 | Os exércitos leem escuros e chapados na praça, e o rim laranja compara com uma normal em espaço de CÂMERA | baixo | pequeno |
| 4 | O HUD da cidade mostra 5 dos 18 campos que hud() já calcula, e o rótulo Kraken live é string fixa | baixo | pequeno |
| 5 | O palco solo tem vinheta e a praça não tem nenhuma, e essa metade do acabamento não precisa de bloom | baixo | pequeno |
| 6 | Poeira, faísca e cauda de cometa integram por QUADRO, não por tempo: encolhem exatamente onde o quadro é mais caro | baixo | pequeno |
| 7 | O feed liga a 2,6 km mas o campo já anima e aparece a 3,6 km, e o limiar é seco (sem banda morta) | baixo | pequeno |
| 8 | A contagem de PointLight do campo muda em cena três vezes, e cada mudança recompila TODO material iluminado de uma cena de 2,6M de triângulos | medio | medio |
| 9 | Dez objetos do campo entram no raycast recursivo da praça, e a neblina rouba o alvo do duplo toque | baixo | pequeno |
| 10 | O helicóptero nunca entra em corrida de ataque enquanto o book não chegou, e é a única arma sem fórmula de reserva | baixo | pequeno |
| 11 | O teto do bombardeiro tem piso absoluto de 40, medido no palco solo, e na cratera da cidade ele voa 40 por cento mais rasante | baixo | pequeno |
| 12 | MLRS e salva de baleia só existem com trade de 8x a média, e na cidade a janela de escuta é uma fração da do palco solo | baixo | pequeno |
| 13 | onWhale continua undefined na praça: o evento mais alto que o mercado produz não tem tela na cidade | baixo | pequeno |
| 14 | O evento de assalto, o maior sistema do motor, dispara uma vez por carregamento de página e nunca mais | medio | medio |
| 15 | A cratera não existe no terreno da cidade: a batalha está num pedaço plano e inclinado de Tranquillitatis | medio | grande |
| 16 | Nada da batalha projeta sombra, e a cidade é o único anfitrião com mapa de sombra ligado | medio | medio |
| 17 | Os dois módulos de geometria ainda documentam a receita que causou o bug de 27/08: converter por matrixWorld e parar em MUNDO | baixo | pequeno |

Detalhe de cada item, com arquivo, linha, conserto proposto e teste na cidade:

**2. THREE.Points e PointLight não leem a escala 2,6x do grupo: poeira, brasas, motas e a luz de impacto encolhem só na cidade**

- Na tela: Sprite lê a escala do grupo (o clarão, a caveirinha, o número de dano crescem 2,6x), Points e PointLight não. Resultado na praça: a poeira de impacto sai com cerca de um terço do tamanho, a fita de brasas da costura fica presa no teto de 5 px espalhada por uma frente 2,6x mais larga, as motas (300 a 500 pontos que a praça acabou de pagar) caem no piso de 1 px do driver e não aparecem, e o halo de luz de cada explosão cobre 26 m de mundo num campo de 458 m, com o soldado vizinho recebendo 2,6^1,8 = 5,4x menos luz. A batalha da cidade fica limpa: bonecos grandes, nenhuma sujeira e nenhuma consequência luminosa em volta.
- Conserto: Um campo escala?: number (padrão 1) em OpcoesBatalha; a praça passa ESCALA_GUERRA no createBattlefield da linha 794, o palco solo omite. No motor: matPoeira.size = 2.4 * esc (battlefield.ts:890); uniform uEscala nos dois ShaderMaterial de Points, com gl_PointSize = 26.0 * uEscala * 60.0 / -mv.z nas motas (battlefield.ts:331, que hoje está 60x menor que a irmã brasas escrita pela mesma mão) e clamp(16.0 * uEscala / -mv.z * 60.0, 1.0, 5.0 * uEscala) nas brasas (battlefield.ts:556-557); distance * esc e intensity * esc**decay nas três PointLight (battlefield.ts:259, 714, 821) e nos dois pontos que escrevem intensidade (2493 e 3739). Uniform de material e distance/decay/intensity NÃO entram em getProgramCacheKey do three (só a CONTAGEM de luzes entra), então zero recompilação e zero draw call novo. Declarar o uniform na construção do material, nunca por onBeforeCompile em cena.
- Verificar: /city?stats=1 na chegada padrão (câmera a 335 m de WAR_POS no desktop, 496 m em retrato). Antes: a mota de poeira sai com cerca de 3,6 px e a brasa com 2,9 px; as motas do ar não são visíveis contra o regolito claro. Depois: a poeira lê como véu e a crista de brasa marca a linha de frente de longe. Comparar lado a lado com /city/war (câmera a 110 m). Conferir que o contador de triângulos e o fps do ?stats=1 não mudam: nenhuma partícula nova é criada. Se as motas ficarem fortes demais com o fator certo, baixar o alfa (hoje 0.35 aditivo), não o tamanho.
- Arquivos: app/city/war/battlefield.ts, app/city/plaza/plaza-scene.tsx

**3. Os exércitos leem escuros e chapados na praça, e o rim laranja compara com uma normal em espaço de CÂMERA**

- Na tela: A praça roda com exposição 1.06 contra 1.42 do palco solo, hemisférica 0.34 contra 1.55, sem a DirectionalLight de brasa que dá o contraluz vermelho e sem bloom. O lado sombreado dos dois exércitos vai a quase preto. Pior, o rim que descola o soldado do regolito usa solDir fixo copiado do sol do palco solo e compara com vNormal, que está em espaço de câmera: na praça o grupo está girado 225 graus, o sol está em outro azimute e o OrbitControls mais o autoRotate mais o voo de 4,2 s giram a câmera inteira, então o rim escorrega pelo exército e no ângulo de chegada pode cair na face oposta. E matUrsos não tem rim nenhum.
- Conserto: Tudo na CONSTRUÇÃO do material, nunca em cena, para entrar no mesmo lote do compileAsync do boot (o campo já nasce antes dele, plaza-scene.tsx:745). (a) matCaes.emissiveIntensity = brilhoInterno ? 0.8 : 0.5 (battlefield.ts:352) e matUrsos.emissiveIntensity = brilhoInterno ? 1.1 : 0.75 (355); a praça já passa brilhoInterno: true. (b) No patch de matCaes trocar dot(normalize(vNormal), solDir) por dot(inverseTransformDirection(normalize(vNormal), viewMatrix), solDir), com inverseTransformDirection que já vem do chunk common; a constante 0.9 do termo vira 1.3 quando brilhoInterno estiver ligado, montada em JS. (c) solDir?: THREE.Vector3 em OpcoesBatalha, a praça passa SUN_DIR (plaza-scene.tsx:589), o valor atual (0.4, 0.25, 0.8) fica como padrão. (d) Dar a matUrsos o mesmo patch de rim, em tom frio. Nenhuma PointLight nova, nenhuma recompilação em cena. NÃO mexer na exposição da praça: ela vale para a cidade inteira.
- Verificar: /city, chegada padrão: orbitar 360 graus em volta da cratera com o mouse. Antes, o contorno laranja fica sempre do mesmo lado da tela (colado na câmera) e some quando a câmera passa pelo lado errado. Depois, ele fica preso ao sol da praça e não anda com a câmera. Comparar a legibilidade dos ursos com /city/war no mesmo ângulo. Não regride o solo: com escala e opções padrão os valores são os de hoje.
- Arquivos: app/city/war/battlefield.ts

**4. O HUD da cidade mostra 5 dos 18 campos que hud() já calcula, e o rótulo Kraken live é string fixa**

- Na tela: Na praça a batalha aparece sem a camada de dados que dá sentido ao que explode: sem a fita de trades reais, sem variação de 24 h, sem spread, sem parede de compra e venda em dólar, sem volume, vwap e contagem de trades, e sem a régua auditável 1 soldier = N DOG, staging X of Y book levels. Tudo isso já está calculado e sendo jogado fora duas vezes por segundo. Além disso o rótulo afirma Kraken live mesmo quando o status é connecting ou down; o palco solo troca por um ponto colorido e pelo texto do estado (war-scene.tsx:523).
- Conserto: Estender o bloco (hudTick & 31) === 1 (plaza-scene.tsx:1634) com mais refs imperativos, no mesmo estilo que já está lá e sem re-render do React: warDeltaRef (h.open24 contra h.preco), warSpreadRef, warParedeRef (h.bidsUsd/h.asksUsd), warReguaRef (h.dogPorSoldado, h.niveisEncenados, h.niveisBook) e um warFitaRef com h.fita.slice(0, 4) escrito linha a linha em textContent. O rótulo de plaza-scene.tsx:1814 passa a ler h.status. campo.hud() já é chamado nesse mesmo ponto: custo zero na cena 3D.
- Verificar: /city, chegada padrão: a cápsula do modo jogo entra em fade a partir de 2300 m. Comparar o que ela mostra com o painel de /city/war lado a lado. Depois do conserto os dois têm os mesmos números. Testar o rótulo cortando a rede no DevTools: ele tem de virar connecting e depois down em vez de continuar dizendo live. Conferir no Profiler do React que nenhum re-render aparece: a escrita é toda em textContent e style.
- Arquivos: app/city/plaza/plaza-scene.tsx

**5. O palco solo tem vinheta e a praça não tem nenhuma, e essa metade do acabamento não precisa de bloom**

- Na tela: No palco solo os cantos fecham com um radial-gradient de tela cheia (war-scene.tsx:501-504) mais a vinheta do gradePass, e o olho é empurrado para a frente da batalha. Na praça a batalha divide a tela com regolito claro até a borda e não ganha foco nenhum quando a câmera chega. É a metade da diferença de acabamento entre as duas telas que não depende de pós-processamento.
- Conserto: Um div irmão do warHudRef (plaza-scene.tsx:1808) com o mesmo radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.42) 100%), pointer-events-none, e a opacidade escrita imperativamente no MESMO ponto onde já se escreve warHudRef.current.style.opacity (linha 1633), usando o mesmo k de proximidade com teto mais baixo (cerca de 0,55 do valor do solo, porque a hora padrão da praça é dia claro). Uma camada de composição de DOM, zero na cena 3D.
- Verificar: /city, chegada padrão: a vinheta tem de entrar junto com a cápsula do HUD e sumir junto ao se afastar da cratera. Conferir que ela NÃO aparece nas outras vistas (?view=park, ?view=spaceport) e que não escurece o parque nem o precinct. Medir com ?stats=1 que o fps não muda: é uma div.
- Arquivos: app/city/plaza/plaza-scene.tsx

**6. Poeira, faísca e cauda de cometa integram por QUADRO, não por tempo: encolhem exatamente onde o quadro é mais caro**

- Na tela: A praça opera de propósito na faixa de 28 a 50 fps (o FrameGovernor de plaza/perf.ts:128-134 só age acima de 36 ms e só devolve qualidade abaixo de 20 ms). A 40 fps a poeira recebe 0,64 s de simulação por segundo de relógio, mas continua morrendo em 1,3 s de relógio: a pluma sobe entre um terço e metade da altura do palco solo e abre metade do raio. A faísca idem, com prazo de 0,45 s. E a cauda do cometa faz o inverso, porque o comprimento vem do deslocamento de UM quadro: o mesmo projétil arrasta uma cauda 1,2 a 2 vezes mais longa na cidade, e ela muda de tamanho toda vez que o governador troca de patamar. É o único item que fica GRANDE demais.
- Conserto: O dt correto já existe no mesmo escopo desde battlefield.ts:3645 e já é usado pelos destroços, pelas fumaças e por toda a explosions.ts. Só três laços ignoram. Renomear a variável interna dos dois laços de partícula (hoje chamam de dt o TEMPO DE VIDA, battlefield.ts:3759 e 3775) para vida, e trocar: poeiraVel[i*3+1] -= 2.28 * dt e poeiraPos[...] += poeiraVel[...] * dt (3765-3768); faiscaVel[i*3+1] -= 9.0 * dt e faiscaPos[...] = h + faiscaVel[...] * dt (3779-3785). Os fatores são os valores por quadro de hoje multiplicados por 60, então a 60 fps nada muda. Para a cauda (battlefield.ts:3724 e 4026), dividir dist pelo dt do quadro e renormalizar por 60, ou guardar a velocidade no struct do tiro no disparo, já que a duração é conhecida.
- Verificar: /city?stats=1 na chegada padrão. Forçar queda de fps abrindo a aba com throttling de CPU 4x no DevTools e olhar a pluma de uma bateria: hoje ela encolhe visivelmente com o throttling e a cauda dos tiros estica. Depois do conserto a pluma e a cauda têm o mesmo tamanho com e sem throttling. Comparar a mesma explosão em /city/war (perto de 60 fps) para conferir que o solo não mudou.
- Arquivos: app/city/war/battlefield.ts

**7. O feed liga a 2,6 km mas o campo já anima e aparece a 3,6 km, e o limiar é seco (sem banda morta)**

- Na tela: Entre 2,6 e 3,6 km a cratera está visível e animando com ZERO soldados e toda a artilharia calada: sem book, mid fica 0, caes.count e ursos.count nascem 0 e o bloco de combate inteiro não roda. Sobram helicópteros, jipes, tanques de guarda, antiaéreas e bandeiras patrulhando terra vazia, que é o que se vê no caminho para o parque (5,2 km a NE, cruzado pela visita guiada nos dois sentidos). E como o limiar é seco em 2600, parado perto da borda o damping do OrbitControls e a deriva mexem a câmera sozinhos: o WebSocket cai e sobe, o book de 500 níveis chega do zero, os exércitos se remontam, os obeliscos apagam e acendem e o HUD pisca com preço zerado. Ao voltar, a fila salva agendada com performance.now() vence toda de uma vez e a batalha dá um espasmo no primeiro quadro.
- Conserto: Igualar o raio do feed ao do culler e do update, e dar banda morta: ligar em dWar < 3600 e só desligar em dWar > 4000, mantendo campoVivo como memória (plaza-scene.tsx:1622-1626, duas comparações). Opcionalmente atrasar o desligamento uns 20 s para quem passa raspando. No motor, em setLive(false) (battlefield.ts:4302) esvaziar a fila salva e zerar mid, senão a segunda aproximação chega com a frente já assentada. Atualizar também o comentário de plaza-scene.tsx:1618, que ainda diz 1,4 km.
- Verificar: /city?view=park e depois voltar para a cratera com a visita guiada, olhando a cratera durante o percurso. Antes: numa faixa do caminho a cratera tem veículos rodando e nenhum soldado. Depois: os exércitos estão lá o tempo todo em que a cratera é desenhada. Segundo teste: parar a câmera a ~2600 m de WAR_POS e soltar o mouse; hoje o preço do HUD pisca e zera em ciclo, depois do conserto fica estável. Terceiro: afastar além de 4000, esperar 30 s e voltar; a batalha não pode dar salva em rajada no primeiro quadro.
- Arquivos: app/city/plaza/plaza-scene.tsx, app/city/war/battlefield.ts

**8. A contagem de PointLight do campo muda em cena três vezes, e cada mudança recompila TODO material iluminado de uma cena de 2,6M de triângulos**

- Na tela: O engasgo cai exatamente no pouso cinematográfico de 4,2 s que entrega o usuário na batalha, que é a entrada padrão de /city. Três gatilhos, todos verificados: (a) o culler registra campo.group inteiro (plaza-scene.tsx:838) e as PointLights são filhas dele, então cada travessia dos 3600 m tira ou devolve 2 a 4 luzes da conta (o three descarta a subárvore invisível antes do pushLight); no boot isso acontece de cara, porque culler.revealAll() roda antes do compileAsync (linha 1313-1315) e culler.update() logo depois; (b) os dois obeliscos carregam uma PointLight cada como FILHA de um mesh que nasce visible = false e vira true dentro de aplicaBook (battlefield.ts:718 e 2375), somando 2 luzes quando o primeiro book chega; (c) a praça nunca chama setLuzes nem luzesAcesas, apesar de o motor ter criado os dois para ela e de o comentário de battlefield.ts:829-832 avisar que quem administra orçamento global tem de ler dali. Efeito colateral: o campo fica preso em maxLuzes 2 contra 6 do solo, então numa barragem cada impacto novo rouba a luz de um que ainda está apagando.
- Conserto: Deixar a contagem FIXA desde antes do compileAsync e apagar sempre por intensidade, nunca por visibilidade. (a) No motor, criar um filho grupoVisual que recebe tudo que é malha, ponto e sprite, deixando group apenas com as PointLights, e expor grupoVisual na interface Battlefield; a praça troca a linha 838 por culler.add(campo.grupoVisual, 3600, ...). (b) Nascer as duas luzes de obelisco direto em group, sempre visible = true e intensity = 0, e em aplicaBook mexer só em intensity e position em vez de visible. (c) Passar luzesIniciais: 2 e subir maxLuzes para 6 no orcCampo (plaza-scene.tsx:761): as 4 extras nascem invisíveis e não contam; quando dWar cair abaixo de 700, chamar campo.setLuzes(6, true) e apagar 4 luzes da praça no MESMO quadro (a caverna do Leonidas e a galeria DSC já estão longe e podem ser apagadas por distância), desfazendo ao sair. Ler campo.luzesAcesas() logo depois de createBattlefield para fechar a conta do orçamento de 10 PointLights da praça.
- Verificar: /city?stats=1, aba Performance do DevTools gravando durante o pouso de 4,2 s. Antes: um pico de compilação de shader alguns segundos depois da chegada, quando o primeiro book aterrissa. Depois: nenhum. Segundo teste, o mais direto: no console, renderer.info.programs.length antes e depois de voar até o parque e voltar; hoje o número oscila em cada travessia dos 3600 m, depois do conserto fica constante. Terceiro: olhar uma barragem de baleia e conferir que várias explosões acendem ao mesmo tempo em vez de uma roubar a luz da outra.
- Arquivos: app/city/war/battlefield.ts, app/city/plaza/plaza-scene.tsx

**9. Dez objetos do campo entram no raycast recursivo da praça, e a neblina rouba o alvo do duplo toque**

- Na tela: O duplo toque na praça faz ray.intersectObjects(scene.children, true) e filtra por isMesh sem isSprite (plaza-scene.tsx:1404). A neblina é um PlaneGeometry(26, 130) flutuando 1,4 m acima do chão, ou seja 68 por 338 m em escala 2,6, e NÃO tem semRaycast: um duplo toque sobre a batalha acerta a chapa de neblina antes do terreno e o focusAt mira a névoa em vez do chão ou do soldado. Junto disso, cada duplo toque varre 900 pontos de poeira, 130 de brasa, 240 segmentos de faísca e dezenas de sprites, mesmo com a batalha a 3 km e escondida pelo culler (o intersect do three não testa object.visible).
- Conserto: O helper semRaycast já existe em battlefield.ts:198 justamente para isso e está aplicado em 40 lugares, mas escapou de group.add(costuraMesh) (255), group.add(neblina) (294), os dois obeliscos e coroas (718), brasas (573), poeiraPts (894), faiscasSeg (922) e vários pools de Sprite (588, 841, 866, 998, 1033, 2385). Em vez de caçar um a um, passar group.traverse(semRaycast) uma vez no fim de createBattlefield, logo antes do return, e repetir depois dos group.add tardios (as etiquetas de 2385 e o reguaGrupo reconstruído em constroiRegua). Um traverse na montagem cobre pools inteiros e não volta a se perder quando alguém acrescentar arma nova.
- Verificar: /city, chegada padrão: dar duplo toque em cima da linha de frente. Antes a câmera para numa chapa flutuando sobre a batalha; depois ela pousa no chão da cratera. Segundo teste: no console, medir performance.now() em volta do bloco de duplo toque com a câmera longe da guerra (a batalha escondida pelo culler ainda paga o teste hoje); a queda tem de ser visível no número.
- Arquivos: app/city/war/battlefield.ts

**10. O helicóptero nunca entra em corrida de ataque enquanto o book não chegou, e é a única arma sem fórmula de reserva**

- Na tela: Em battlefield.ts:2915 o heli só sai de patrulha se alvoNoExercito() achar um soldado real, e essa função devolve false com amostra vazia (linha 473), que é o estado enquanto não houve aplicaBook. Sem alvo ele reagenda 2 s e continua voando de lado sem soltar foguete nem rajada. É exatamente o defeito de 25/08 que o comentário do próprio sistema cita nas palavras do fundador. O jipe, na mesma situação, TEM reserva (linha 3060) e atira do mesmo jeito.
- Conserto: Dar ao heli a mesma reserva do jipe: no ramo else da linha 2915, em vez de h.proxAtaque = agora + 2000, mirar frenteX + sentido * (FRENTE + 6 + hash * 10) no z da patrulha e seguir para mergulho. Uma linha.
- Verificar: /city com a rede cortada no DevTools (o feed da Kraken não conecta, então nunca há book): os helicópteros têm de mergulhar e atirar mesmo assim. Depois religar e conferir que, com book, eles voltam a mirar soldado de verdade. O mesmo teste na janela de 1 a 3 s de conexão logo após cruzar o raio do feed.
- Arquivos: app/city/war/battlefield.ts

**11. O teto do bombardeiro tem piso absoluto de 40, medido no palco solo, e na cratera da cidade ele voa 40 por cento mais rasante**

- Na tela: battlefield.ts:1630 faz Math.max(40, altura(b.x, z) + 26). No palco solo altura fica perto de -3, o piso de 40 manda e o avião voa 43 unidades acima do chão. Na cidade, hoje, altura vale ~38, o +26 dá 64, o piso nunca entra e o esquadrão passa a 26 unidades do chão, quase colado nos obeliscos vistos em 2,6x. Depois do conserto do datum o efeito inverte e continua errado: com o relevo local ainda subindo até +10, a altura sobre o chão passa a variar de 30 a 44 conforme o avião cruza a rampa.
- Conserto: Tornar o teto relativo ao chão, que é o que o código queria dizer: b.mesh.position.set(b.x, altura(b.x, z) + 43, z). Uma linha, sem efeito nenhum no palco solo, porque 43 é exatamente a altura efetiva que ele já tem lá.
- Verificar: Aplicar DEPOIS do item 1 e testar junto. /city, chegada padrão, esperar uma ofensiva coordenada (a cada 14 a 20 s) e acompanhar o bombardeiro cruzando o campo de ponta a ponta: a altura sobre o regolito tem de ficar constante, sem mergulhar quando ele entra no lado alto da rampa. Comparar com o mesmo voo em /city/war.
- Arquivos: app/city/war/battlefield.ts

**12. MLRS e salva de baleia só existem com trade de 8x a média, e na cidade a janela de escuta é uma fração da do palco solo**

- Na tela: dispararMLRS tem um único chamador (battlefield.ts:2457), dentro do if (forca >= 8) de dispara(). A salva de 6 foguetes em ripple de 90 ms com cluster quente no impacto é a assinatura visual mais distinta do arsenal e depende de um evento raro no DOG. O palco solo fica com o feed ligado a sessão inteira; a cidade só escuta enquanto a câmera está perto, então a mesma raridade fica multiplicada pelo tempo de permanência e na prática o MLRS quase nunca é visto na cidade.
- Conserto: Chamar dispararMLRS na fase de barragem da ofensiva coordenada, uma salva por ofensiva, junto do dispararBombardeiro que já acontece na virada de barragem para avanço (battlefield.ts:3944). A função já existe, já tem pool próprio (POOL_FOGUETE 16, 8 no low) e já mira aglomerado real, então não custa memória nova.
- Verificar: /city?stats=1, chegada padrão, ficar 2 minutos parado: hoje é comum não ver um único MLRS; depois tem de aparecer uma salva a cada ofensiva (14 a 20 s). Medir o fps antes e depois no mesmo intervalo: são 6 foguetes e 6 clusters extras por ofensiva, e o número tem de ficar dentro do ruído. Conferir que o palco solo /city/war ganha o mesmo comportamento sem regressão de fps.
- Arquivos: app/city/war/battlefield.ts

**13. onWhale continua undefined na praça: o evento mais alto que o mercado produz não tem tela na cidade**

- Na tela: O terceiro argumento de createBattlefield (plaza-scene.tsx:794) é undefined, e é ele o onWhale. No motor, battlefield.ts:2461 dispara onWhale acima de LIMIAR_BALEIA = 16. No palco solo o callback pinta um gradiente radial de tela cheia com animação própria e sacode a câmera com amplitude 0.55, o dobro do tremor de impacto. Na cidade um trade de 16x a média já dispara salva de artilharia e MLRS na cena, mas passa sem nenhuma pontuação de tela: o único tremor é o de onImpactoGrande, limitado a 0.5 e a um por 300 ms, então a baleia lê igual a um morteiro qualquer.
- Conserto: Passar o terceiro argumento reaproveitando tremorT0 e tremorForca, que já existem na praça (plaza-scene.tsx:715-717), com forca/40 em vez de forca/30 e ignorando a janela de 300 ms; mais uma div de gradiente radial no overlay da guerra, irmã da vinheta do item 5, com a mesma animação do palco solo. Custo zero na cena 3D.
- Verificar: /city com o feed ao vivo, esperando um trade grande é sorte, então injetar: no console, forçar um trade sintético pelo caminho do feed (ou baixar LIMIAR_BALEIA temporariamente para 2 num build local) e confirmar o flash de tela e o tremor forte na chegada padrão. Reverter o limiar antes de commitar. Conferir que o flash não aparece quando a câmera está longe da cratera.
- Arquivos: app/city/plaza/plaza-scene.tsx

**14. O evento de assalto, o maior sistema do motor, dispara uma vez por carregamento de página e nunca mais**

- Na tela: LIMIAR_ASSALTO = 1.1 (battlefield.ts:3488) contra um DESLOC_FRENTE de 34: 1,1 unidade equivale a 1,6 por cento do range de 24 h inteiro. Quando o book chega, frenteX vale 0 e frenteAlvo salta, o assalto dispara e a frente assenta; depois o DOG precisa andar 1,6 por cento do range diário para outro assalto, o que numa hora quieta não acontece. A onda de 16 soldados individuais correndo, os 3 que tombam com caveira e a barragem de cobertura a cada 260 ms ficam guardados. Na cidade é pior de um jeito indireto: mid não é zerado em setLive(false), então na segunda aproximação a frente já está assentada e nem o disparo de chegada acontece.
- Conserto: Trocar o limiar absoluto por um de VELOCIDADE: guardar frenteAlvo() de 20 s atrás e disparar quando a frente andou mais de X unidades nesse intervalo. Alternativa mais legível na tela: disparar sempre que frenteX cruzar um degrau da régua construída em constroiRegua, que já existe e já marca degraus redondos no chão, porque cruzar uma linha é exatamente a leitura de conquista que o fundador pediu. Manter um assalto por vez e um piso de tempo entre eventos. Combina com o zerar mid do item 7.
- Verificar: /city, chegada padrão, com o preço andando de verdade: hoje o assalto aparece uma vez no primeiro book e some. Depois do conserto tem de reaparecer sempre que a frente cruzar uma marca da régua. Segundo teste, o que realmente importa na cidade: afastar além do raio do feed, esperar 30 s e voltar; hoje o assalto de chegada não acontece na segunda visita, depois do conserto acontece.
- Arquivos: app/city/war/battlefield.ts

**15. A cratera não existe no terreno da cidade: a batalha está num pedaço plano e inclinado de Tranquillitatis**

- Na tela: O HUD chama o lugar de War Crater e o palco solo entrega uma bacia de 3,2 m com rebordo de 2,6 m a 128 m de raio (war-scene.tsx:145-153), que é a moldura que faz a batalha ler como cratera de cima. Em terrain.ts não há NADA centrado em WAR_POS: a única cova é a do parque (parkDatum, PARK_PIT, PARK_CORE, PARK_HALF). De longe é uma mancha no chão em vez de uma cratera. Pior, medi o relevo real sob a pegada: em x o chão sobe de 36,58 (x=-55) a 45,11 (x=+88) em unidades locais, uma rampa de quase 9 unidades, contra os 4,6 de amplitude do palco solo. Por causa disso os móveis rígidos da costura derivam: costura, neblina, brasas e cortina são transladados por um único dyF amostrado em z=0 (battlefield.ts:3678-3684), o que dá erro de até 4,8 unidades locais (12,4 m de mundo) nas pontas, e a ferida quente da frente aparece cortada ao meio.
- Conserto: Duas medidas. No anfitrião, dentro de heightAt de terrain.ts, um WAR_PIT com bacia e rebordo centrados em WAR_POS, no mesmo padrão da cova do parque (rampa smoothstep de PARK_CORE para PARK_HALF), mais o amortecimento que terrain.ts já faz para a praça (linhas 90-98, platô dentro de 960 m com rampa até 1300) aplicado num raio de 260 m em volta de WAR_POS, o que derruba a rampa de 9 unidades para perto das 4,6 do solo. Assim alturaLocal lê a cratera de graça, o farol e o emblema (que já chamam terrain.heightAt) acompanham e a malha visível do regolito ganha o rebordo. NÃO somar a bacia só dentro de alturaLocal: o chão visível não seguiria e as tropas afundariam. No motor, reamostrar a costura em vez de transladá-la (80 segmentos, num for a cada 250 ms, não por quadro), dar 6 segmentos em z à neblina com o mesmo tratamento, e trocar luzFrente.position.x = frenteX por um set com altura(frenteX, 0) + 4.
- Verificar: Aplicar DEPOIS do item 1. /city?view=far e a visita guiada: a cratera tem de ler como cratera do horizonte, com rebordo, e não como mancha. Na chegada padrão, andar com o preço até a frente ir para o lado alto do campo e conferir que a costura, a neblina e a cortina acompanham o chão sem afundar nem flutuar (hoje o erro medido chega a 12,4 m de mundo nas pontas). Terceiro teste, o que quebra se errar: conferir que as tropas continuam assentadas no regolito depois de cavar (elas leem alturaLocal, que lê heightAt) e que o farol e o emblema não ficam pendurados no ar. Medir com ?stats=1 que o custo por quadro não mudou: heightAt não roda por quadro para o terreno já construído.
- Arquivos: app/city/plaza/terrain.ts, app/city/war/battlefield.ts

**16. Nada da batalha projeta sombra, e a cidade é o único anfitrião com mapa de sombra ligado**

- Na tela: grep castShadow em app/city/war/ não retorna NADA no motor inteiro (battlefield, vehicles, emplacements, tanks, arsenal, explosions, critters). A praça liga renderer.shadowMap.enabled (plaza-scene.tsx:404), o sol tem castShadow (576) e a caixa segue o alvo da câmera. Com o sol a 44 graus, tudo na praça assenta no chão pela sombra e a cratera não: obeliscos de 23 m, tanques, baterias e as duas hostes flutuam sobre regolito claro, ao lado de estátuas e torres que assentam. Lê como decalque colado na Lua. No palco solo o defeito não existe porque não há mapa de sombra nenhum e a ausência é coerente.
- Conserto: NÃO usar o mapa de sombra para as tropas: com 2048 px e caixa de 1000 a 3200 m, um soldado de 3,6 m ocupa 1 a 3 texels (sombra suja) e ligar castShadow nos dois InstancedMesh de 4200 instâncias dobra a geometria do passe. Nova opção sombras?: boolean em OpcoesBatalha que o palco solo deixa desligada; quando ligada, castShadow = true SÓ nas peças grandes e paradas (obeliscos 707, tanques 1285 e 3104, baterias 1419, antiaéreas 3175, ninhos, jipes) e receiveShadow = false em tudo. O contato do resto se resolve pelo padrão inverso da poça de luz que a praça já tem (light-pool.ts, makeGroundPool): uma malha única de quads escuros deitados sob soldado e veículo, um draw call, sem passe de sombra. Cavar a cratera (item 15) ajuda sozinho, porque o rebordo passa a lançar sombra de verdade sobre o campo.
- Verificar: /city?stats=1, chegada padrão, comparando o fps e os triângulos do passe de sombra antes e depois; se o custo subir, cortar peças da lista, nunca ligar os InstancedMesh. Visual: os obeliscos e os tanques têm de assentar no chão com a mesma dureza de sombra das estátuas da praça. Testar nos três perfis (?quality=low, balanced, high) e conferir que o low não regride: o low é o celular. Conferir que /city/war continua sem sombra nenhuma (opção desligada por padrão).
- Arquivos: app/city/war/battlefield.ts, app/city/plaza/plaza-scene.tsx

**17. Os dois módulos de geometria ainda documentam a receita que causou o bug de 27/08: converter por matrixWorld e parar em MUNDO**

- Na tela: Nenhum efeito visual hoje, mas é a fonte do defeito que já custou três conversas com o fundador. arsenal.ts:28-30 ainda diz que quem chama transforma o ponto pela matrixWorld do pivô para achar a origem real do disparo em mundo, e para aí. emplacements.ts:105-108 repete a mesma instrução. vehicles.ts:293-297 descreve BOCA_ARMA_JIPE sem falar em conversão nenhuma. Nenhum dos três menciona paraLocal. A regra correta só existe no bloco de battlefield.ts:174-188. A próxima arma nova vai seguir a instrução escrita no módulo, parar em mundo e nascer de novo a milhares de metros do campo: invisível no palco solo e quebrada na cidade.
- Conserto: Emendar os três comentários para dizer a regra completa: transformar pela matrixWorld do pivô E devolver ao espaço do grupo com paraLocal/direcaoParaLocal antes de virar posição de mesh ou origem de projétil, porque o mesh de destino é filho do grupo e lê LOCAL. Citar battlefield.ts:174 como fonte única. Só comentário, zero código.
- Verificar: Não é um teste de tela, é um teste de regressão futura: depois de emendar, ligar claraoDeBoca na antiaérea e no ninho de metralhadora (as duas armas que ainda não têm) seguindo APENAS o que o comentário manda, e conferir em /city?stats=1 com window.__plazaGuerra() que foraDoCampo continua 0 e maiorDistancia não passa dos limites do campo. Esse hook existe exatamente porque clarão de boca dura 100 ms e não dá para flagrar em chapa.
- Arquivos: app/city/war/arsenal.ts, app/city/war/emplacements.ts, app/city/war/vehicles.ts

### Descartado pela sintese, com motivo
- Aproximar o enquadramento de chegada (viewFor 'warentry', plaza-scene.tsx:229-264). A medida está certa: 335 m no desktop e 496 m em retrato contra 110 m do palco solo, com fov 42 contra 50, dão a batalha ocupando cerca de metade do quadro. Mas o comentário do próprio arquivo (linhas 240-262) registra que esses dois enquadramentos foram POSICIONADOS À MÃO pelo fundador no navegador e lidos por window.__plazaView(), com o motivo escrito de por que a câmera rasante foi desfeita em 27/08. Mexer nisso é decisão de gosto do dono, não conserto de defeito. Depois dos itens 2 e 3 (escala nos pontos e nas luzes) vale remedir e perguntar, não mudar por conta própria.
- Baixar a exposição e a hemisférica da praça para os valores do palco solo (1.42 e 1.55 contra 1.06 e 0.34). Confirmado que a diferença existe e que ela é metade do 'parece menos', mas essas duas constantes valem para a cidade INTEIRA (H.exposure em plaza-scene.tsx:568 e a HemisphereLight de 617): mudá-las por causa da batalha estraga o precinct, os monumentos, o jardim e o parque. O que dá para fazer sem sair da cratera está no item 3, dentro do motor e por emissivo.
- Ligar 'motas', 'brilhoInterno' e 'onImpactoGrande' no createBattlefield da praça. Já está aplicado no código atual (plaza-scene.tsx:793-806): motasCampo é 0/300/500 por perfil, brilhoInterno é true e onImpactoGrande sacode a câmera. Sobrou dessas opções só o que virou item 8 (luzesIniciais, setLuzes, luzesAcesas) e item 13 (onWhale, que continua undefined).
- Compensar a falta de bloom com um sprite aditivo preso a cada projétil em voo (pool de 2x POOL_TIROS). É a única proposta das quatro frentes que ADICIONA custo de desenho sem defeito medido por trás: overdraw de sprite transparente é justamente o que pesa nos perfis low e balanced, que já rodam entre 28 e 50 fps por decisão do governador. O halo que dá para ganhar de graça já está nos itens 2 (tamanho de ponto e raio de luz corretos) e 3 (emissivo dos exércitos). Se depois desses dois ainda faltar brilho, aí sim vale medir esse com ?stats=1 antes e depois.
- Os números de tamanho de ponto citados por uma das frentes (poeira com cerca de 16 px no solo) estão trocados: 16.0 é a constante das BRASAS (battlefield.ts:556), a poeira usa PointsMaterial com size 2.4 (890). O defeito é o mesmo e continua válido, só o número da evidência estava errado; a conta correta está no item 2.

**Fechado 27/08 depois da auditoria:** item 1 (datum, commit 3bca90d706) e item 2 (escala em Points e PointLight, commit 52d2ff2ec8, que de quebra achou as motas com gl_PointSize 60x menor que a irma, invisiveis desde sempre nos dois anfitrioes). Aberto a partir do item 3.
