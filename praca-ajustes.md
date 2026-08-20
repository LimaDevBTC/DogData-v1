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
