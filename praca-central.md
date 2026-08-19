# Praça Central da DogCity na Lua, com a mempool viva (`praca-central.md`)

**2026-08-18.** Plano de construção do que o fundador pediu nesta noite, em três
mensagens, resumidas: *animar a mempool com as transações de DOG* (referência: The
Bitcoin Post Office, cartas = transações, caminhão = bloco); *pode ser na praça
central da DogCity*, que já tem torre central, BitFlow e Kray Space em 3D; *falta o
prédio do OrdCards, tem que ser épico*; *o resto vira jardim por enquanto* (Aterro do
Flamengo, Jardim Botânico, Marina Bay lunar) feito no Blender; *abrir só a praça ao
público, gera FOMO*; *o `/city/luna` já usa o terreno real da Lua, mas tem todos os
prédios e distritos Solana e Stacks: tirar tudo e deixar só a praça*.

Depende de `masterplan.md` (§5, itens 19 "Correio central Mempool Post" e 21
"Aeroporto"), `crosschaincity.md` (tx-layer) e do pivô lunar (`/city/luna`).

---

## 0. O que foi medido antes de escrever

- **Hoje não usamos mempool em lugar nenhum.** O `dog_block_scanner.py` só lê bloco
  minerado (`getblockcount` → `getblock … 2`), e o site não tem `getrawmempool` nem
  websocket. Confirmado por varredura do repositório.
- **Volume de DOG na mempool é baixo.** Nos últimos 36 blocos: 150.640 txs, das
  quais **41 com edict de DOG (1,14 por bloco)**, 160M DOG movidos por edict. Isso
  é só a parte EXPLÍCITA; a transferência implícita (gastar UTXO de DOG sem edict) só
  aparece cruzando as entradas com o conjunto de UTXOs de DOG, que o scanner já
  mantém em disco: `data/dog_utxo_set.json`, 240.201 outpoints → quantia, salvo a
  cada bloco.
- **Decodificar runestone não precisa do `ord`.** Um decodificador de OP_RETURN OP_13
  + LEB128 + edicts com id delta foi escrito e validado contra a mempool e 6 blocos
  reais (bate com o `ord decode`). Isso importa porque o `ord.service` fica inativo
  de propósito (lock do redb) e o caminho quente de uma animação ao vivo não pode
  disputar esse lock.
- **Consequência de produto:** com ~1 tx de DOG a cada bloco, uma "agência de
  correio" ficaria vazia. A animação precisa de uma metáfora em que **cada transação
  é um evento** e o intervalo entre elas é preenchido pela cidade viva.

## 1. A metáfora proposta: chegadas na Lua

DOG•GO•TO•THE•MOON. A cidade está na Lua. Então uma transação de DOG na mempool
não é uma carta esperando: é **uma nave em órbita esperando janela de pouso**.

- **Mempool = órbita.** Cada tx de DOG pendente é uma nave circulando sobre a praça,
  visível como um ponto de luz numa órbita baixa. Taxa (sat/vB) manda na altitude e na
  ordem: quem paga mais voa mais baixo, mais perto de pousar.
- **Bloco = janela de pouso.** Quando um bloco entra com txs de DOG, essas naves
  descem em sequência no **spaceport da praça** (o item 21 do masterplan, já
  renderizado como `DOGCITY-spaceport`) e param no pátio; as que ficaram de fora
  seguem em órbita até a próxima janela.
- **Painel na Lunar Spire:** `IN ORBIT 3 · 41.2M DOG` · `NEXT LANDING any minute,
  ~10 min cadence · last block 962.980, 4 min ago` · `FUEL 1 · 2 · 4 sat/vB`
  (barato / normal / rápido). O mesmo painel que o Post Office põe na placa.
- **Follow your DOG:** cola um txid e a nave dele acende; a tela diz "em órbita há
  6 min, na fila para o próximo pouso" ou "pousou no bloco 962.981".
- **Clique numa nave:** txid, DOG movido, de → para (link interno
  `/tx/bitcoin/<txid>` e `/address/bitcoin/<addr>`), taxa, tempo em órbita.
- **Vida ociosa entre transações:** as naves já pousadas taxiam para os hangares e
  somem, o dirigível da Kray segue seu giro, os faróis do pad piscam, e a cidade
  respira. Sem transação por 20 minutos, a praça continua interessante.

Alternativa literal, se preferir: o **Correio central "Mempool Post"** do masterplan
(#19), cartas = txs, caminhão = bloco. Custa o mesmo no dado e no código; muda só a
camada visual. A recomendação é a órbita, porque é o nome do token virando cena e
porque lê bem com uma nave a cada dez minutos.

## 2. O prédio do OrdCards: o Castelo de Cartas do Satoshi 🏰

**Decisão do fundador (2026-08-18):** não é arena ("uma arena roubaria a cena da
praça"). É um **castelo de cartas**, "muito rebuscado e bonito, utilizando as cartas
de todas as formas, criando uma estrutura linda e que lembra um conto de fadas,
feita com todas as cartas do Satoshi Nakamoto".

As cartas do Satoshi são as cartas do OrdCards derivadas do **endereço Gênesis**
`1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa` (o tributo que o mundo inscreveu para o
Satoshi; ver `wiki-ordcards/genesis-carteira-2026-08-08.md`), o baralho do
adversário da carreira. Elas já existem renderizadas: `/card-image/<n>` no OrdCards
em produção, frente e verso, e o glifo 63/88 da marca. Então o castelo é **feito
dessas imagens**: cada carta é uma placa 63/88 (proporção real da carta), e o
castelo é o que se faz com placas quando se tem milhares delas e um conto de fadas
na cabeça: torreões de cartas encostadas em "A" subindo em espiral, muralhas de
cartas em pé, pontes de cartas deitadas, coruchéus de quatro cartas em pirâmide,
bandeirolas com o glifo, uma ponte levadiça que é uma carta gigante baixando. As
cartas viradas com o verso para fora dão a textura repetida das muralhas; as viradas
com a frente dão as janelas coloridas. Luz de dentro atravessando as frestas entre
cartas, como um castelo de conto de fadas à noite.

Regra de qualidade que o fundador impôs: **no mesmo nível das versões top de linha
da landing** (Central Tower, BitFlow HQ e Kray Tower construídas no Blender pela
`blender/lib_dogcity.py`), não das versões procedurais da cidade antiga.

## 3. Jardim, não distrito

Tudo que não é praça vira paisagem lunar cuidada, no Blender (o parque Runestone já
mostrou o caminho): **aterro** de gramado plano com passeio à beira da "água" (um
lago escuro espelhado, o Founders Pool), **jardim botânico** em domos de vidro
(plantas na Lua precisam de domo, e domo à noite é lanterna), e a **marina lunar**:
um píer longo com três torres unidas por um deque no topo, a silhueta da Marina Bay
recortada contra a Terra no céu. Sem prédio de carteira, sem lote, sem Solana e
Stacks nesta abertura.

## 3.1 Decisões fechadas em 2026-08-18 (fundador)

| # | Decisão |
|---|---|
| D1 | **Órbita e pouso** é a metáfora da mempool ("com certeza") |
| D2 | O prédio do OrdCards era o **Castelo de Cartas do Satoshi**; a Arena não vai. **Revogado em 2026-08-18 (~02:00)**: o castelo foi construído (cartas do Gênesis num atlas, InstancedMesh, torres de "A", coruchéus, ponte levadiça), o fundador viu e desistiu: "vamos pensar em outra coisa pro OrdCards". O sítio ao sul do deck fica reservado |
| D3 | **`/city` passa a ser a praça**, e vai ao ar assim que estiver pronta |
| D4 | **Retirar tudo em volta**: prédios de carteira, distritos Solana e Stacks, lotes. Só a praça |
| D5 | **O Parque Runestone fica** ("gigantesco, pronto"): a abertura pública é a praça + o parque |
| D6 | Usar as **versões top de linha da landing** para Central Tower, BitFlow e Kray, e fazer o castelo no mesmo nível |

O que já existe para isso, medido em disco:

- `DogData-v1/public/city/{central-tower,bitflow-hq,kray-tower}.glb` (0,4 / 0,9 /
  0,7 MB, Draco), exportados em 2026-07-30 de `blender/build_*.py` sobre
  `lib_dogcity.py`: **são as versões da landing**, prontas para o three.js
  (`PIPELINE.md` prova o caminho Blender → GLB → navegador). O `/city/explore` antigo
  usa versões procedurais; a praça nova carrega estes GLBs.
- A cena da landing (`blender/dogcity-landing.blend`, coleção `DogCity_Plaza`) já
  tem o programa da praça: Supertree Grove com skywalk, anfiteatro, jardins lunares,
  três espelhos d'água, escadaria monumental, colunata de 24 pilones, e o
  `_Spaceport`. É o desenho a seguir; parte dele vira GLB, parte vira procedural.
- O Parque Runestone V2 existe como cena Blender (`runestone-park-v2.blend`, 506
  instâncias depois dos blooms, terreno analítico 7200×7200) e como pranchas e
  tour de 150 frames na landing. **Não existe GLB do parque**: a versão em tempo
  real é trabalho da fase 3 (terreno analítico reproduzido no three.js, pedras como
  `InstancedMesh` de poucos GLBs de cristal, registro de posições exportado do
  Blender).

## 4. Fases

| Fase | Entrega | Onde |
|---|---|---|
| **1. Dado** | `scripts/dog_mempool_watcher.py` (daemon nesta máquina: `getrawmempool` a cada 5 s, decodifica runestone, cruza entradas com o UTXO set, `getmempoolentry` para taxa/vsize, `gettxout` para o endereço de origem), tabelas `dog_mempool` + `mempool_snapshot` no Supabase DOGDATA, marca `confirmed`/`dropped` a cada bloco, retenção 24 h; rota `GET /api/mempool/dog` (pendentes, últimos pousos, snapshot); unit `dog-mempool.service` | repo + Supabase + systemd |
| **2. Praça** | Cena nova sobre o terreno de Mare Tranquillitatis do `/city/luna`: só a praça com os **GLBs da landing** (Central Tower, BitFlow HQ, Kray Tower + dirigível), spaceport com órbita e pousos ligados à rota, painel, follow-your-DOG, clique | `app/city/plaza/`, depois vira `/city` |
| **3. Castelo e parque** | Castelo de Cartas do Satoshi no Blender (`lib_dogcity`, mesmo nível dos três GLBs) → GLB; Parque Runestone em tempo real (terreno analítico + instâncias); aterro, domos e marina lunar | `blender/` + `lib/city/` |
| **4. Abrir** | `/city` passa a ser a praça; tirar do gitignore o que ela precisa, dependências no `package.json`, link no site, mobile e desempenho, tour de 30 s | produção |

A fase 1 não depende de decisão nenhuma e começou em 2026-08-18. As decisões D1 a
D6 destravaram as fases 2 e 3.

## 4.1 Estado em 2026-08-18, madrugada

**Fase 1 (dado) construída e rodando.** `scripts/dog_mempool_watcher.py` está de pé
nesta máquina (por enquanto solto, `nohup`; a unit `scripts/dog-mempool.service`
está escrita e espera o `sudo`), lendo a mempool a cada 5 s. Migração
`supabase/migrations/006_dog_mempool.sql` aplicada no DOGDATA pelo conector.
`GET /api/mempool/dog` responde (pendentes por taxa, pousos, quedas, snapshot,
idade do dado). Na primeira volta ele achou 4 naves em órbita, duas delas
transferências implícitas que só o cruzamento com o UTXO set enxerga, e no bloco
962.984 viu 2 pousarem.

**Fase 2 (praça) em primeira versão, WIP no gitignore (`app/city/plaza/`).**
`/city/plaza`: terreno real de Mare Tranquillitatis (platô plano até 560 m para o
deck), `public/city/plaza.glb` exportado da cena da landing SEM as torres nem a massa
dos lotes (`blender/export_plaza.py`), as três torres da landing como GLB
(`central-tower`, `bitflow-hq`, `kray-tower`, sem as lajes de sítio, no lugar da
composição da landing), `spaceport.glb` a 3 km ao sul, sol baixo com sombras, Terra
no céu, estrelas, órbita com naves (taxa = altitude, quantia = tamanho), pouso em
sequência no spaceport a cada bloco, queda quando a tx some, painel de missão, "Follow
your DOG", clique na nave, modo `?demo=1` com naves sintéticas para ver a
coreografia numa madrugada calma.

**Achado que muda a leitura de D6:** as versões "top de linha" da landing NÃO são
as da cena `dogcity-landing.blend` (lá as torres são massa bege de blockout); são
os três GLBs de `public/city/`, os mesmos que a seção de parceiros do `/dogcity`
mostra. Foi o que entrou.

**Fluxo ajustado e no ar (2026-08-18, ~02:00, commit `826de024ab`), a pedido do
fundador ("a landing continua recebendo no site e mandando para city; por enquanto
ajuste só o fluxo"):** a raiz segue mandando toda sessão nova para a landing
`/dogcity`; o CTA primário do fim da landing virou **"Enter the city" → `/city`**
(Build DogCity passou a secundário, Find Your Lot ficou); **`/city` deixou de
redirecionar e É a praça** (`app/city/page.tsx` → `app/city/plaza/`), com links de
volta para a landing e para o site no canto. Conferido em produção:
`www.dogdata.xyz/city` responde a praça, `/api/mempool/dog` responde com o dado do
watcher da casa (idade 7 s), `/dogcity` mostra "Enter the city".

**Próximos passos:** o Castelo de Cartas do Satoshi (fase 3, Blender), o Parque
Runestone em tempo real, jardins no lugar do anel comercial, câmera de pouso,
mobile, e a landing ajustada depois (conteúdo, não fluxo).

## 4.2 Revisão do fundador, 2026-08-18 (~02:40): o precinto

Depois de ver os quatro protótipos: **"Chalé com certeza"**, e um brief maior:

- **D2 (nova redação):** o prédio do OrdCards é o **Chalé**: duas cartas colossais
  em "A", e as cartas são a carta oficial do OrdCards da inscrição da logo
  (72d5cde4…i0, N° 127.106.002), frente com forças/DNA para a praça, verso com QR/DNA
  para o spaceport. Elevar a "6 estrelas, uma verdadeira maravilha arquitetônica
  criada sobre a ideia do chalé com aquela carta em específico": vidro, piso, luz
  perfeita, no nível dos outros três.
- **D7, o precinto:** a praça é um **círculo central**; em volta, **outro círculo com
  quatro prédios grandes, praticamente do mesmo tamanho, um em cada ponto
  cardeal**; tudo organizado, planejado, com paisagismo e acabamento AAA+, ligado
  por jardins, bulevares, fontes, tamareiras (lunares). "Hoje parece um monte de
  coisas soltas." A Kray está de costas para a praça: corrigir. O quarto ponto
  cardeal, cuja âncora ainda não existe, vira **jardim** por enquanto.
- **D8, o jardim:** primeiro "lembra Avatar? aquela flora estonteante"; construído
  bioluminescente e **recusado no mesmo dia** ("não curti, muito colorido"). Nova
  redação: **"um imenso jardim com o que tem de mais belo na Terra mesmo, sem
  inventar muita moda, como os jardins dos cassinos e palácios"**, contínuo entre
  os jardins que a Kray e a BitFlow já têm. Feito: gramados e parterres com sebes
  em arcos concêntricos, alamedas de palmeiras nos bulevares e no anel, árvores
  de copa, topiaria, bancos, uplights quentes, quatro espelhos d'água com fontes
  brancas nas diagonais, e uma **grande fonte de palácio** no ponto norte.
- **D9:** o letreiro da Needle (o anel "MOON • DOG…") **gira**.
- **D10:** o **Parque Runestone entra em tempo real, na posição correta**. Não há
  posição registrada em documento nenhum (o parque foi desenhado no próprio
  quadro, 7,2 km de lado). Feito (`blender/export_park.py` → `public/city/park/`,
  `app/city/plaza/park.ts`): terreno, 1.009 cristais instanciados em dez
  variantes, os 111.374 pontos do censo, templo/estrada/pavilhão; **centro a 9,2 km
  ao sul, no fim do eixo monumental, atrás do spaceport**, girado para a chegada
  olhar a praça; a cordilheira fecha o horizonte no enquadramento de abertura e
  `?view=park` leva até lá. **Corrigido no mesmo dia:** a posição já existia, na
  cena da landing (nordeste, rumo 43°); o parque foi movido para lá, a 5,2 km
  (`park-site.ts`), com o núcleo sobre um datum plano, o disco fundindo no
  regolito real na borda e uma cova no regolito por baixo para o vale nunca vazar.

**Geometria decidida para o precinto (implementação):** deck (r 300) no centro com a
Needle; cinturão de jardim de 320 a 440; **bulevar anelar** em r ≈ 450 ligando as
quatro portas; **quatro bulevares radiais** nos eixos cardeais, do deck às âncoras;
âncoras em **r = 620**: **BitFlow a oeste (de frente para leste), Kray a leste (de
frente para oeste, corrigida), Chalé ao sul (frente para o norte, no fim da
escadaria monumental), Norte = jardim com uma Árvore-Mãe** bioluminescente no
lugar da quarta âncora; jardim lunar preenchendo os quatro setores até r ≈ 900,
depois regolito. Fora: a massa do anel comercial e o monotrilho da cena da
landing (o "solto").

## 4.3 Polimento AAA+, 2026-08-18 (tarde): foguete, jardim, parque, chalé

Brief do fundador depois de ver de cima: "veja como de cima o raio do parque está
estranho, parece faltando pedaços"; "agora é evoluir tudo pro nível dos prédios
AAA+, até o próprio foguete, hoje é uma pílula, precisa ser estilo igual ao SpaceX
do Elon Musk mas escrito '$DOG'"; "dar sequência às melhorias do parque Runestone".

- **Foguete (`orbit-layer.ts`):** perfil Starship por revolução (9 m de diâmetro
  para 50 de altura), flaps trapezoidais, três motores, pintura em canvas: aço,
  chapas, escudo térmico preto em meia circunferência centrado na barriga (u = 0;
  em voo olha o chão, no pouso olha o sul), **"$DOG" em laranja ao longo do eixo
  nos dois lados** (o aspecto ao longo do eixo corrigido por 0,224, senão vira
  faixa), "DOGCITY" na base, anel laranja na saia. Voa de nariz, vira para a
  vertical no último trecho e **pousa e fica em pé**; a emissão segue a pintura,
  então o "$DOG" lê na sombra. `?view=pad` e `?view=padclose` mostram o pátio.
- **Jardim (`precinct.ts`, `terrain.ts`):** borda em **r = 900** com passeio
  perimetral, muralha baixa de pedra com capa, linha de meio-fio de luz e 96
  postes; o platô do terreno vai plano até 960 (mistura até 1300); **quatro
  alamedas diagonais** do anel à muralha passando pelos espelhos d'água e um
  **passeio-anel em r 745** interrompido nos sítios das âncoras: de cima o jardim
  agora é o desenho de um parterre de palácio.
- **Parque Runestone (`park.ts`):** as pedras eram gesso branco; a landing (os 150
  quadros da tour) mostra **obsidiana negra com a marca branca acesa e arestas que
  faíscam**. Recuperada a receita do .blend (materiais M_T8..M_T2): as duas
  texturas do runestone3d.gltf (`crystal-basecolor.webp` + `crystal-normal.webp`),
  a luminância separa pedra, aresta e glifo, a marca emite mais forte quanto menor
  a pedra (0,35 no Monarca, 2,2 nas de palma). Exportadas as **trilhas** que o
  primeiro export pulou (`blender/export_park_trails.py` → `trails.glb`, 0,6 MB:
  decks W1-W5, narizes de âmbar, fáscias, pilares, marcos, lanternas, visitantes;
  o corrimão de 248 mil vértices fica de fora). O censo de 111 mil pontos ganhou um
  shader que os apaga abaixo de um pixel projetado (de longe era chuvisco).
  **A caixa de sombra do sol agora segue o alvo da câmera** (encaixada em texel,
  cresce com a distância) e o parque a 9 km tem sombras reais.
- **Chalé (`chalet.ts`):** lajes escuras com fita de luz quente na borda e
  guarda-corpo de vidro, caibros de aço por dentro das duas águas, escadaria
  monumental em três terraços de pedra até o pórtico, do lado da praça.

## 4.4 A landing conta a novidade, 2026-08-18 (fim da tarde)

Pedido do fundador: "ajustar a landing page: falar sobre a mempool visível que
temos agora, prévia da DogCity no ar, polimento final".

- **Nova folha logo abaixo do hero, `app/dogcity/sections/plaza-live.tsx`**
  ("SATOSHI PLAZA · OPEN NOW"): as chapas da praça viva (fotografadas do próprio
  /city com `?plate=1`, sem HUD: praça, pátio com as Starships, parque, Chalé,
  em `public/landing/plaza/`), o **mission board ao vivo** lendo
  `/api/mempool/dog` a cada 20 s (em órbita, último pouso, taxas, mempool
  inteira; LIVE vira SYNCING se o feed parar 2 min), o botão "Enter Satoshi
  Plaza" e "Fly to the park" (`/city?view=park`), e a nota de prévia (o que está
  aberto, o que abre por fase).
- Hero: a linha mono ganha "Satoshi Plaza is open · enter →"; o crachá de fase
  do hero agora só aparece quando a copy do hero some (os dois se sobrepunham
  na primeira pintura, com o banner de parceiro em cima).
- CTA final: "Satoshi Plaza is open, with the DOG mempool in orbit above it".
  Needle: "STAND ON THE DECK, LIVE ↗". Parque: "OR STAND AT THE GATE, LIVE ↗".
- `/city` ganhou imagem de OG (`public/city/og-plaza.jpg`) e `?tx=<txid>` para
  chegar já seguindo uma nave.

## 4.5 Desempenho, 2026-08-18 (noite): "tá muito pesado, a imagem trava"

O que os jogos pesados fazem e o que entrou (`app/city/plaza/perf.ts` + peças):

| Técnica (jogos) | Aqui |
|---|---|
| Níveis de qualidade por aparelho | `detectTier()`: celular = DPR ≤ 1,5, sombra 1024 sem PCF suave, sem MSAA, sem os 111 mil pontos do censo, metade das partículas, sombra a cada 2 quadros; desktop = tudo |
| Resolução dinâmica (consoles) | `DynamicResolution`: mede o quadro; > 26 ms baixa o DPR (mín. 0,7), < 14 ms sobe até o teto |
| Orçamento de luzes | PointLights de ~30 para 11 (cada uma custa em TODOS os fragmentos); o resto virou emissão/uplights pintados |
| LOD (níveis de detalhe) | torres: GLB inteiro até 1,3 km (celular) / 2,3 km (desktop), depois `*-lod1.glb` decimado a 18 % (`blender/make_tower_lods.py`); parque: cristais ordenados por tamanho e `count` por distância (485 mil tris → ~100 mil vistos da praça), terreno grosso 60×60 além de 4,5 km |
| Culling por distância | `DistanceCuller`: sebes, postes, bancos, placas, painéis de texto e uplights somem longe; trilhas/templo/censo do parque só a < 3 km (desktop) / 2,6 km |
| Sombras só de quem é grande | sebes, folhas de palmeira, bancos, postes, placas não projetam |
| Batching / instâncias | pavimento+meios-fios+gramados fundidos (3 malhas), GLBs fundidos por material (`mergeStaticByMaterial`, 50 → ~8 malhas por torre), 48 placas dos fundadores num atlas (1 malha) + molduras instanciadas, sebes com caixas de 6 m (metade), lâmpadas mais leves |
| Compilação de shaders fora do quadro | `renderer.compileAsync` na carga (com o aviso na tela) e depois de monumentos/parque; ~60 programas não travam mais o primeiro toque |
| Trabalho pesado em lotes | lâminas do Satoshi e censo do parque construídos com respiros (`setTimeout 0`) |
| Instrumentação | `?stats=1`: linha no HUD (tier · dpr · calls · tris · fps) e `window.__plazaDump()/__plazaMeshes(grupo)` |

Medido no headless (swiftshader, vista de casa): chamadas de desenho 694 → 404
(desktop), 389 → 250 (celular); triângulos por quadro incl. sombra ~0,95 M → ~0,8 M
(desktop) com as torres inteiras. O fps de verdade só no aparelho: abrir
`/city?stats=1` no celular e ler a linha laranja.

Próximos, se ainda pesar: LOD1 também para o Chalé/Satoshi, impostores
(billboards) para as árvores longe, um único mapa de sombra em cascata menor no
celular, e a alternativa sem `logarithmicDepthBuffer` no celular (custa early-Z).

## 5. Em aberto

| # | Pergunta | Quem |
|---|---|---|
| P4 | Painel na Lunar Spire ou placa própria no spaceport? | design, decide na cena |
| P5 | Quais cartas do Gênesis entram no castelo: o pool inteiro do adversário da carreira ou uma seleção curada? | fundador, sem pressa |
| ~~P6~~ | Posição do parque: o fundador lembrou que já existia. É a da cena da landing (`dogcity-landing.blend`: Runestone em (2300, 2460), nordeste, rumo 43°). Movido em 2026-08-18 para o rumo 43° a 5,2 km (a distância mínima para o Portão e a estrada ficarem fora do platô); `park-site.ts`. | feito |
