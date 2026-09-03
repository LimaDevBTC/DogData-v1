# Levantamento: a distância entre a DogCity e o nível GTA5

> Fechado em 02/09/2026, sobre o código de hoje (`look=2` já é o padrão desde
> hoje de manhã). Números de cena com fonte marcada: os de 29/08 vêm de
> `levantamento-maquete.md` e continuam válidos para o que não mudou; os de
> loteamento vêm de `public/city/cidade.json` lido nesta rodada.
>
> Este documento não propõe nada sozinho. Ele mede a distância e separa o que
> cabe no navegador do que não cabe, para a decisão de motor (hoje registrada
> como "Unreal adiado pro pós-mint") ser tomada com número na mão.

---

## 0. O que "nível GTA5" quer dizer, quebrado em coisas mensuráveis

GTA5 é de 2013 e rodava em PS3 com 256 MB de vídeo. Ou seja: o nível dele **não
é fidelidade de pixel**, e tratar a meta como "melhorar o render" é a leitura
errada que faz perder seis meses. O que aquele jogo entrega, e que a DogCity
ainda não entrega, são seis coisas independentes:

| # | Eixo | O teste de uma frase |
|---|---|---|
| 1 | **Densidade construída** | Todo quarteirão tem fachada, e a fachada tem porta, vitrine, sacada e letreiro. |
| 2 | **Escala humana** | O mundo é visto de 1,7 m do chão e o corpo esbarra nas coisas. |
| 3 | **Vida** | Alguém anda na calçada, algo passa na rua, e isso continua quando você para de olhar. |
| 4 | **Som** | O mundo soa, e o som tem posição. |
| 5 | **Coerência de arte** | Uma paleta, uma luz, um clima, do letreiro ao meio-fio. |
| 6 | **Continuidade** | Não há tela de carregamento: o mundo entra e sai de memória sozinho. |

A DogCity hoje entrega **o eixo 5, parcialmente**. Os outros cinco estão em
zero ou perto de zero. Isso é a resposta curta do levantamento.

---

## 1. O que a cidade é hoje, medido

**Loteamento** (`public/city/cidade.json`, lido em 02/09): sítio de raio 9.000 m,
85.824 carteiras plantadas, 1.862 quarteirões, 125 quartos, 389 enclaves,
29,821 km² de lotes sobre 47,512 km² de tecido disponível, lote mediano de
220 m², menor 24 m², maior 69.862 m². O registro binário é
`public/city/cidade-lotes.bin`, 1.115.712 bytes, 13 bytes por lote.

**O que está desenhado**: terreno, abóbada, lagos, canais, orla, ilhas, malha
viária (12 avenidas e 7 anéis, `vias.ts`, 1.791 linhas), 20.756 árvores
(`arborizacao.ts`), 38 peças de programa (`pecas.ts`), mobiliário urbano, o
precinto da praça, o parque Runestone, o Coliseu, as torres Kray e BitFlow, o
Chalé OrdCards, o spaceport, a camada de órbita da mempool e a batalha.

**O que NÃO está desenhado**: prédio nenhum. `tecido.ts` roda em `modo: 'obra'`
por padrão desde 30/08, por decisão do fundador, e nesse modo **nenhum lote é
desenhado**. A cidade que está no ar é infraestrutura pura sobre terreno vazio.
Os modos `lote` (plinto de 0,45 m) e `massa` (caixa por tipologia) existem e são
chapa de conferência, não produto.

**Pilha de render** (`plaza-scene.tsx`, `pos.ts`, `perf.ts`): three.js 0.162 puro
(regra da casa: nada de react-three-fiber), WebGL2, ACES Filmic, buffer de
profundidade logarítmico, `EffectComposer` com GTAO + UnrealBloom + OutputPass +
SMAA (ligado por padrão desde hoje, com `?look=1` como volta), sombra
`PCFSoftShadowMap` em mapa 2048, `DistanceCuller` por distância e `FrameGovernor`
que degrada sombra e DPR quando o quadro passa de 36 ms.

**Custo medido** (29/08, GTX 1650 real via ANGLE, 1440x900, com o tecido em modo
`lote` ligado, que hoje está desligado): vista de topo 373 chamadas de desenho,
1,58 M de triângulos, 228 programas de shader; rasante 430 a 435 chamadas,
2,44 a 2,58 M de triângulos, 316 a 318 programas. A DPR 1 as duas seguram
60 fps; a DPR 2 a rasante caiu para 26,8 fps.

**Custo medido hoje** (02/09, nota em `look.ts`): a entrada real da `/city`, que
é o pouso sobre a batalha, mediu **37 fps** com console limpo. As demais leituras
do dia foram 77, 60, 41, 37, 32 e 18 conforme o enquadramento.

O ponto que sai desses dois parágrafos, e ele manda em tudo o que vem depois:
**a cidade vazia já consome o orçamento de quadro da máquina de referência.**

---

## 2. As lacunas, em ordem de impacto

### L1. Não há arquitetura, e ela é 80% do problema

Tudo o mais neste documento é acabamento de uma cidade sem prédio. 85.824 lotes
esperando construção, e o produto decidiu que **quem constrói é o holder, por
mint de ordinal** (`mintcity.md`, `project_dogcity_crowdfunding`). Ou seja: a
lacuna número um está travada por uma decisão de produto, não por engenharia.

Existem duas saídas, e elas não são equivalentes:

- **Casca padrão.** Todo lote não mintado nasce com uma edificação genérica,
  gerada por regra (a `forma` por `utxo_count` já está nos 13 bytes do `.bin`), e
  o mint **substitui** a casca pelo prédio do dono. A cidade fica cheia hoje, o
  mint vira upgrade visível ("aquele cubo cinza virou a sua torre"), e o eixo 1
  do GTA5 sai do zero. Custo: um gerador de fachada com 4 famílias e um LOD.
- **Ficar vazia até o mint.** É o caminho atual. Honesto, e defensável enquanto
  a narrativa for "a cidade está em obras". Mas enquanto durar, nenhum outro
  investimento de imersão paga: andar por uma cidade sem prédio não fica bom,
  por melhor que o som e a luz sejam.

O modo `massa` de `tecido.ts` já é meio passo da primeira saída: ele tem a
altura por tipologia (7, 11, 17, 30 e 52 m) e a área relativa. Falta fachada.

**Colisão de orçamento, já registrada e nunca resolvida** (`plano-diretor.md`
seção 3.4 e passo 0 do capítulo 8): o plano prevê 159.890 árvores mais os
prédios de todos os lotes, contra um teto medido de **300.000 instâncias a
37 fps**, e aquele teto foi levantado com **caixa de lote**, não com árvore nem
com fachada. Com 85.824 lotes o total passa de 245 mil instâncias antes de
qualquer detalhe. Impostor de bilboard além de 900 m não é opção, é requisito, e
continua não implementado.

### L2. Não dá para andar na cidade

`plaza-scene.tsx` usa `OrbitControls`: a câmera orbita um alvo, com ângulo polar
limitado e o alvo preso perto do chão. Não existe personagem, não existe colisão,
não existe caminhar. A nota já está escrita em `caverna.ts:19`: *"não há
personagem, não há colisão, não há andar"*.

O que falta, na ordem em que se constrói:
1. **Controlador em primeira pessoa** com `PointerLockControls`, altura de olho
   1,7 m, e a câmera colada em `terrain.superficieAt`.
2. **Colisão**, que hoje não existe em forma nenhuma. Nem contra o terreno (a
   câmera não sabe que o chão sobe), nem contra prédio, muro, meio-fio ou água.
   O caminho barato é um campo de altura mais uma grade de ocupação 2D derivada
   do próprio `.bin` (lote é retângulo em xz), não malha de colisão.
3. **Passagem de escala**: a cidade foi desenhada e julgada de cima. A calçada,
   o meio-fio de 15 cm e a seção de via de 6 a 10 m já estão certos
   (`project_dogcity_escala_correta`), mas nada abaixo de 2 m de altura foi
   olhado de perto. É onde o nível GTA5 se ganha ou se perde.

### L3. A cidade não tem vida

Zero pedestres, zero veículos, zero animais, zero animação ambiente de rua. O que
se move na `/city` hoje: a órbita e o pouso da mempool (`orbit-layer.ts`), a
batalha na cratera (`battlefield.ts`), o dirigível e a água. Nada disso está na
rua, e nenhum deles tem escala humana.

Uma nota importante de coerência: **o plano diretor proíbe carro particular**
(`plano-diretor.md` seção 4). A cidade é bonde, bicicleta e pé. Então "vida nível
GTA5" aqui não é trânsito, é **fluxo de pedestre nas calçadas, bonde nos eixos e
bicicleta nas ciclovias**. Isso é uma vantagem, não uma limitação: pedestre e
bonde seguem trilho, e trilho é barato de simular.

O motor da batalha já é o precedente técnico certo: pools alocados uma vez,
orçamento por tier, `setLive(false)` quando o usuário se afasta. Um sistema de
multidão deveria copiar essa forma.

### L4. Silêncio total

Nenhuma linha de áudio existe na `/city`. Nem `AudioListener`, nem
`PositionalAudio`, nem um arquivo de som no `public/`. Isso é metade da imersão
de um GTA e é, de longe, **a melhoria com melhor relação entre esforço e
resultado deste documento**: um leito de vento com variação por hora do dia, água
posicional na orla e nos canais, passos, e o som da batalha ao se aproximar da
cratera. Custa dias, não meses, e não gasta quadro.

### L5. Luz e sombra ainda são de maquete, não de jogo

O que já está bom: ACES, quatro horas do dia com direção de arte própria,
`earthshine` como fonte noturna, GTAO e bloom sutis, névoa contida, rebote do
regolito, anisotropia.

O que falta, em ordem:
- **Sombra em cascata (CSM), que não existe.** Hoje é uma câmera ortográfica só,
  com meia-largura que cresce até 3.200 m sobre mapa de 2.048: isso dá um texel
  de sombra de **3,1 m**. Maior que um lote inteiro. Ao nível da rua a sombra
  simplesmente não resolve nada, e é o motivo principal do "cheiro de maquete".
  Três cascatas resolvem, e é a mudança de maior impacto visual do documento.
- **Sombra de contato e oclusão local.** O GTAO de tela ajuda, mas objeto que
  não projeta sombra (a maioria do mobiliário tem `castShadow: false` por custo)
  flutua.
- **Nenhuma iluminação assada.** Não há lightmap, não há probe de irradiância,
  não há reflexo. Interior, marquise e sombra de rua são todos a mesma luz
  hemisférica. GTA5 assa tudo o que é estático.
- **Textura procedural de 512²** (`materiais.ts`: `const S = 512`, geradas em
  `CanvasTexture` no boot) e GLBs convertidos com teto de 512 WEBP. É o
  suficiente a 50 m e insuficiente a 2 m. Nível de rua pede atlas de trim e
  decalque (mancha, tabuleta, grafite, junta de calçada), e nenhum dos dois
  existe.

### L6. Não há streaming, só corte por distância

`DistanceCuller` é uma lista linear de `{objeto, centro, distância}` percorrida a
cada quadro, e **o centro padrão é a origem da cena**: quem esquece de passar o
próprio centro é cortado pela distância até o meio da praça, não até a câmera.
Além disso o tecido inteiro tem `frustumCulled = false` e não está registrado no
culler, então ele é desenhado em toda vista, inclusive olhando para o lado
oposto.

Falta o que qualquer mundo aberto tem: partição espacial (grade ou quadtree),
carregamento e descarregamento por célula, e LOD por objeto e não por grupo. Hoje
existem 5 usos de `THREE.LOD` na cidade inteira, todos nas torres.

### L7. Não há folga de quadro

Este é o item que transforma todos os anteriores de "trabalho" em "trade-off".
A entrada padrão mede 37 fps na GTX 1650 de referência, com a cidade **vazia**.
Somar prédio, multidão, som, CSM e streaming sobre isso, sem antes recuperar
orçamento, dá cidade a 15 fps.

Recuperação disponível, medida ou barata de medir:
- 228 a 318 **programas de shader** compilados por vista. Um renderizador de
  mundo aberto trabalha com dezenas, não centenas. A causa está mapeada: cada
  material de cada GLB vira um `InstancedMesh` próprio (`props.ts`), e o teto de
  material do plano diretor (16 materiais) nunca foi imposto ao código.
- Tecido sem frustum e sem culler (L6).
- Impostor além de 900 m, previsto no plano e não feito.
- Atlas de textura: 35 a 82 texturas por vista hoje.

### L8. O motor é de fevereiro de 2024, e é WebGL2

`three@0.162.0`. A versão corrente do three está muito à frente, e a diferença
que importa aqui não é cosmética: as versões novas trazem `WebGPURenderer` e TSL,
ou seja **compute shader**, que é o que faz multidão, animação de folhagem e
culling na GPU custarem pouco. Nada disso é alcançável na 0.162.

Além disso o `package.json` ainda carrega `@react-three/fiber`,
`@react-three/drei` e `@react-three/postprocessing`, que **não podem ser usados
neste repo** (quebram em tempo de execução contra o React instalado, ver
`feedback_r3f_broken_this_repo`). São peso morto no arquivo.

---

## 3. O teto honesto do navegador

Vale dizer sem rodeio, porque a decisão de motor já está registrada como adiada e
este levantamento não a relitiga, só a instrui:

**O que o navegador com three.js alcança, e é muito:** uma cidade de sobrevoo
cinematográfica, com CSM, iluminação assada, impostores, som ambiente e vida
vista de 100 m para cima. O padrão de comparação realista aqui é *Cities:
Skylines* ou uma maquete de arquitetura premiada, não GTA5. Isso é alcançável com
os itens L4, L5, L6 e L7 deste documento, dentro do motor de hoje.

**O que ele não alcança:** GTA5 ao nível da rua. Densidade de fachada com
interior, multidão com IA, som mixado por oclusão, streaming contínuo de um
mundo de 254 km², tudo a 60 fps. Isso é orçamento de engine nativa, e a
conclusão bate com o que já está registrado: Unreal, pós-mint, com a GPU sendo o
bloqueio real (1650 de 4 GB).

A leitura de produto que sai daí é que existem **duas cidades**, e tentar fazer
uma só é o risco:
- A `/city` do navegador é o **mapa e a praça**: onde o holder chega, vê o lote
  dele, conversa, doa, acompanha a mempool e a batalha. Ela deve chegar ao teto
  do navegador, e está a quatro itens disso.
- A experiência de rua é o **jogo**, e ele nasce em outro motor, depois do mint,
  com o conteúdo que o mint produziu.

---

## 4. A ordem que eu recomendaria

Sem prometer prazo, e com o critério de "o que destrava mais coisa por menos
trabalho":

1. **Som** (L4). Nenhuma dependência, nenhum custo de quadro, salto grande de
   imersão. Começa hoje, se o fundador quiser.
2. **Recuperar quadro** (L7): frustum e culler no tecido, teto de material,
   atlas. Sem isso nada mais entra.
3. **Sombra em cascata** (L5). Um item só, e é o que mais muda a imagem.
4. **Decidir a casca padrão** (L1). É decisão de produto, e é a que separa uma
   cidade vazia de uma cidade. Recomendo casca padrão com o mint substituindo,
   pelo motivo do item.
5. **Impostor e partição espacial** (L6), que só valem a pena depois de existir
   prédio para cortar.
6. **Modo pedestre** (L2), que só faz sentido depois de 3, 4 e 5: andar por uma
   cidade vazia e com sombra de 3 m de texel mostra o problema, não a cidade.
7. **Vida** (L3): bonde no eixo, pedestre na calçada, bicicleta. Depois de 6,
   porque a escala de rua é que define o tamanho e o passo do bípede.
8. **Motor** (L8): decisão separada, e ela é do fundador, não deste documento.

---

## 5. O que este levantamento NÃO mediu

Registro honesto do que ficou de fora, para ninguém tratar suposição como
medida:

- **Custo de triângulo e de ms por quadro de uma árvore real e de uma fachada.**
  Continua não medido desde o plano diretor. É o portão 0 de qualquer trabalho de
  L1.
- **Quadro em aba de verdade nesta rodada.** As chapas de conferência
  (`scripts/city/chapas.mjs`) foram disparadas durante a redação e não voltaram a
  tempo. Os números de fps usados aqui são os de `look.ts` (02/09) e os de
  `levantamento-maquete.md` (29/08).
- **Memória de vídeo.** Nenhuma medida de VRAM, e ela é o bloqueio conhecido da
  1650 de 4 GB.
- **Mobile.** Todo este documento fala de desktop. O perfil `balanced` e o
  `low` existem em `perf.ts`, mas o que "nível GTA5" significa num telefone não
  foi discutido aqui.
