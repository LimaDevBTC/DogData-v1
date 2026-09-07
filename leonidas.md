# O Templo do Leônidas

Obra aberta em 06/09/2026. O Leônidas é o Satoshi Nakamoto do DOG: a figura fundadora,
representada por uma caveira. O templo dele tem de ser impecável, e hoje não é.

Este arquivo é o QUARTEL e o CHECKPOINT da obra. Cada frente escreve aqui o que fechou,
com número medido, antes de passar para a próxima. Se a máquina reiniciar ou faltar luz,
é daqui que o trabalho recomeça, não da memória de ninguém.

## O pedido, palavra por palavra

> "A caverna basicamente parece uma concha com um templo apertado dentro. Eu quero uma
> porra de uma caverna que caiba uma catedral dentro, onde o user consiga dar zoom pra ver
> o templo do Leônidas por completo. Até o próprio material da caverna não é feito do mesmo
> material das runestones. Seria muito mais legal uma caverna bem bem maior dentro da
> formação das Runestones, não como um puxadinho. E grande, grande mesmo."

> "Esse mini templo japonês não está à altura dele. Seria legal se tivéssemos algo como o
> castelo de Grayskull (He-Man). Leônidas é uma caveira, um templo japonês não tá
> combinando muito com ele."

> "Ela precisa ser uma obra de arte."

## O diagnóstico, medido em 06/09

| o que | medida |
|---|---|
| templo de hoje (`temple-hall.glb`, pagode japonês) | 30 x 24,6 x 21,2 m |
| câmara de hoje | 64 x 53 x 45 m |
| parede a partir do centro do templo | **32 m** |
| distância necessária para ver o templo inteiro (fov 45) | **48 m** |

⚠️ **É por isso que o zoom out atravessa a rocha.** Faltam 16 m. Não é bug de câmera: a
sala é menor que a distância de leitura da peça que ela guarda.

E a caverna é basalto cinza importado enquanto as runestones usam material de cristal com
textura e brilho por tier. São duas geologias coladas, e é isso que lê como puxadinho.

Referência de escala: Notre-Dame tem 128 m de comprimento e 35 de altura de nave; Colônia
tem 144 por 43. A câmara de hoje não chega à metade de uma catedral.

## As decisões tomadas

1. **A caverna vira um GEODO**: uma cavidade dentro da própria formação das runestones,
   com as paredes cobertas pelos mesmos cristais. Deixa de ser buraco escavado e passa a
   ser a mesma pedra do parque. Alvo inicial: **250 x 180 x 90 m**, ajustável para cima.
2. **O templo deixa de ser o pagode japonês.** A referência do fundador é o Castelo de
   Grayskull: fortaleza cuja fachada é um crânio, com entrada pela boca.
3. **Não vem do Sketchfab.** Varredura de 17 termos e 276 modelos com licença compatível:
   o melhor candidato é um Grayskull modelado à mão (CC-BY, 98.794 faces) com pedra
   verde de brinquedo, e os dois seguintes são fotogrametria do brinquedo da Mattel, com
   textura de foto única que não aguenta zoom. Nenhum é "impecável".
4. **A fortaleza é ESCULPIDA, e o argumento é conceitual:** a casa já tem
   `blender/build_leonidas_skull.py` (caveira por união de primitivas, remesh voxel e
   booleanos) e `build_leonidas_cave.py` (arquitetura de pedra procedural em dezenas de
   metros). Então o templo do Leônidas passa a ser **a caveira dele**, em escala de
   fortaleza, na mesma rocha de cristal da caverna. Entrada pela boca, como Grayskull, mas
   sem citar Grayskull: é a mitologia do DOG, não a de outro universo.
5. **A caverna se ajusta à fortaleza**, e não o contrário. Ordem: fortaleza primeiro,
   medida depois, caverna em volta por último.

## Fases e checkpoints

- [x] **F1. A fortaleza-caveira** (`blender/build_leonidas_fortress.py` + GLB) — 07/09
- [~] **F2. A caverna-geodo** EM OBRA, medidas fechadas na seção acima (`blender/build_leonidas_cave.py` v2 + GLB)
- [ ] **F3. Material e luz** (cristal das runestones, preto e laranja, a chegada)
- [ ] **F4. Integração na cena** (regras escritas na seção acima) (`app/city/plaza/leonidas-cave.ts`)
- [ ] **F5. Conferência** (chapas, orçamento por tier, zoom out provado)

Cada fase fecha com: arquivo em disco, número medido escrito aqui, e commit. Nenhuma
fase começa sem a anterior estar escrita neste arquivo.

## F4: como a fortaleza carrega, e por que KTX2 nao entra aqui

Requisito do fundador, 07/09: *"a cabeceira so vai ser vista por quem entrar na caverna,
entao podemos otimizar o carregamento, lembre se do KTX2 se for necessario e a otimizacao
pra nao derrubar o celular"*.

**Medido no GLB exportado:**

| | |
|---|---|
| dimensoes | 121,2 x 124,5 x 65,6 m |
| triangulos | **164.865** em 6 malhas (medido no arquivo; o escultor reportou 173.994 e 165.228 em lugares diferentes, e os dois estavam errados) |
| materiais | 5 (FortressRock, FortressCrystal, FortressCrown, FortressTooth, FortressFloor) |
| **imagens embutidas** | **ZERO** |
| arquivo | 1,72 MB |

⚠️ **KTX2 NAO SE APLICA A ESTA PECA, e o motivo e simples: ela nao tem textura.** Os cinco
materiais sao procedurais, sem uma unica imagem embutida. O espelho ETC1S existe para
trocar o FORMATO de imagem, e aqui nao ha imagem para trocar. Os 1,72 MB sao geometria
pura. Dizer que "passou por KTX2" seria mentira confortavel.

**O que otimiza de verdade nesta peca, entao, e o CARREGAMENTO SOB DEMANDA**, que e
exatamente o que o fundador apontou: ela so existe para quem entra na caverna.

Regras da F4:
1. A fortaleza NAO entra no boot. Ela carrega quando o visitante se aproxima da boca da
   caverna, e o gatilho e distancia, nao bandeira de URL.
2. Ela e DESCARTADA ao sair (dispose de geometria e material), porque quem saiu da caverna
   nao volta a ver 174 mil triangulos tao cedo.
3. Dentro da caverna o resto da cidade nao e visivel: a caverna e fechada. Entao a peca
   pode gastar o orcamento inteiro do quadro sem competir com o tecido urbano, desde que o
   que esta fora seja suspenso enquanto se esta dentro.
4. LOD invertido: esta peca e vista de PERTO, nunca de longe. O LOD tradicional (simplifica
   com a distancia) e inutil aqui; o que importa e a malha cheia funcionar a 20 m do rosto.
5. Teto por tier de maquina continua valendo para o que ACOMPANHA a fortaleza (jardim de
   caverna, cristais, brasas), nao para ela mesma.

## F1 REPROVADA na revisao adversarial, 07/09

A revisao mediu o GLB por conta propria e o veredito foi **nao e obra de arte**. Quatro
bloqueios, e o principal derruba a promessa da peca:

1. **O cranio NAO e oco.** O santuario furou os dois flancos e o fundo da caveira. Medido
   com raios do centro da sala, na altura do olho de quem entra: **6 das 12 direcoes nao
   encontram cranio nenhum**, quem fecha a sala e o macico atras. 24% do angulo solido sai
   do objeto do cranio inteiro. Quem entra nao esta dentro da cabeca, esta num buraco.
2. **O santuario e um elipsoide de boolean cru**, 38 m de casca lisa sem articulacao, com
   facetamento de 0,35 m do remesh, e ele aparece pela porta na chegada.
3. **A calota e um balao liso**, com as suturas saindo como duas linhas tracejadas: le
   costura de bola de praia num cranio que o visitante vai contornar.
4. **As orbitas leem como confete**: cada uma chega como oito lascas laranja desconexas,
   sem contorno de soquete, quando a doutrina pede olhos acesos.

⚠️ **E a chapa de prova estava armada.** O render de chegada foi feito com duas luzes
pontuais de 9.000 W POR DENTRO das orbitas, nas linhas 1341-1342 do script: os olhos
acendem na chapa exista furo ou nao. A imagem nao prova o que dizia provar.

Outros defeitos altos, todos medidos:
- `doubleSided: true` nos cinco materiais, ou seja 165 mil triangulos em DoubleSide num
  contrato que diz nao derrubar o celular. E e isso que ESCONDE 1.574 arestas de fronteira,
  que sao buracos de verdade na malha.
- **46,5% dos triangulos da muralha tem area ZERO** (12.893 de 27.721). No arquivo inteiro,
  7,9% ocupam area indistinguivel de zero.
- `TEXCOORD_0` exportado nos seis meshes com ZERO textura no arquivo: 3,0 MB de VRAM sem
  uso nenhum. Falta `export_texcoords=False`.
- O exportador do Blender avisa **"Mesh FORT_Skull is not valid, and may be exported
  wrongly"** em toda rodada, e o aviso nao foi registrado em lugar nenhum.
- Emissivo assado no GLB (`FortressCrystal` e `FortressCrown`), contrariando a regra
  escrita na mesma pagina de que o laranja e luz e nao tinta.

**O que a revisao CONFIRMOU de bom:** as normais estao certas (13 mil raios de camera, 2
acertos em face de costas, 0,015%: o defeito mais caro da semana nao voltou), a geometria e
deterministica (script rodado de novo, hash das posicoes identico), e zero n-gons.

## A decisao anatomica, 07/09: a caveira e FACHADA, a nave e escavada atras

O fundador levantou o problema que a revisao nao tinha nomeado:

> "Sendo um cranio de verdade, as orbitas e a parte do cerebro estarao num segundo andar,
> visto que a maxila vai estar encostada no solo, ou entao ela teria que estar parcialmente
> soterrada. Em relacao a opcao 2, se for bem feita, a entrada tiver realmente um belo
> aspecto de caveira em cristal, o interior pode ser generico nessa fase, afinal e uma
> caveira dentro de uma caverna, podemos ir melhorando com o tempo."

Ele esta certo e o numero confirma: as orbitas estao a **32,96 m** acima do piso. Um cranio
anatomicamente honesto com a mandibula no chao poe a caixa craniana dez andares acima de
quem entra pela boca. So ha tres saidas: escadaria interna de 33 m (caro e nao foi pedido),
cranio parcialmente soterrado ate a linha dos olhos (perde a mandibula e a boca como porta),
ou **fachada**.

**DECISAO: opcao 2.** A caveira e a FACHADA, e a nave e escavada no macico ATRAS dela. E o
que o Castelo de Grayskull sempre foi: a cara e a frente, o castelo e o interior. Isso
tambem resolve o bloqueio 1 da revisao, porque o cranio deixa de precisar ser oco.

**O que isso muda nas prioridades:**
- a FACHADA passa a ser onde vai todo o esforco de acabamento. Ela e o que o visitante ve,
  e o fundador foi explicito: "se a entrada tiver realmente um belo aspecto de caveira em
  cristal". Calota esculpida, orbitas com soquete de verdade, superficie que aguenta zoom.
- o INTERIOR pode ser generico NESTA FASE, por decisao dele. Nave escavada, honesta, sem
  elipsoide de boolean cru aparecendo pela porta. Melhora com o tempo.
- a mandibula deixa de ser problema: ela funde na base do macico, e a boca continua sendo a
  porta na cota do piso.

## F1 RODADA 2, 07/09: os cinco bloqueios de fachada e os cinco defeitos tecnicos

`blender/build_leonidas_fortress.py` -> `public/city/park/leonidas-fortress.glb`
(2.480 KB, **171.708 triangulos**, 5 materiais, 6 objetos). Reproduz com
`blender -b -P build_leonidas_fortress.py`. Confere com
`blender -b -P verify_leonidas_fortress.py`, que le o GLB por fora e NAO confia em
nada que o escultor tenha dito.

### A decisao que reorganizou tudo

A caveira e FACHADA. O elipsoide de 38 m que a rodada 1 chamava de santuario saiu
inteiro e no lugar dele entrou uma NAVE escavada no maciço ATRAS do rosto: secao de
ogiva, 30 m de vao, 27,1 m do piso a chave, 53 m de comprimento, com seis nichos de
parede em ritmo e uma abside no fundo. Isso derruba o bloqueio 1 sem escadaria de 33 m
e sem soterrar a mandibula, e o interior fica generico por decisao do fundador.

### Os cinco bloqueios de fachada

| bloqueio | rodada 1 | rodada 2, medido |
|---|---|---|
| 3. abobada estreita | biparietal 30,2 contra bizigomatica 40,2, razao **0,75** | **42,18 contra 40,16, razao 1,05** (cranio humano fica em 1,05 a 1,10) |
| 2. orbita de confete | 8 lascas soltas, sem soquete | soquete de **8,0 m de profundidade** com anel orbital soerguido e apice em ROCHA SOLIDA (raio no eixo para em x = 12,13); dentro dele um cacho de 5 poliedros, recuado 7 m atras da borda |
| 1. calota de balao | 2 suturas tracejadas + 34 crateras | sutura CONTINUA (96 amostras de 0,84 m com placa de 1,6 m, 0,90 de largura por 1,05 de profundidade, serrilhada), mais lambdoide e linha temporal, mais **92 crateras em lei de potencia + 52 cadeias + 16 lascamentos**, mais uma oitava de erosao de 0,62 m presa a um grupo de vertices so acima da cota 40 |
| 4. maciço de tapume | 13 bandas horizontais em 120 m de fachada | leitura VERTICAL: 5 sulcos de 3,2 a 4,9 m de largura por 2,4 de profundidade em passo sorteado na frente e 5 em cada flanco, 2 cintas horizontais partidas em segmentos, 4 paineis rebaixados, e ameia com largura, altura, passo e giro sorteados com 1 em cada 6 faltando |
| 5. templinho na boca | portal com pilastra, lintel e escadaria com pinaculo | o portal DEIXOU DE EXISTIR: a fissura de 15 m vai sozinha de x = 30 a x = 4 e a garganta E a boca; as pilastras viraram presas conicas penduradas na abobada (uma delas quebrada); os muretes viraram meio-fio de 1,5 m |

### Os cinco defeitos tecnicos, medidos no GLB pelo verificador

| | rodada 1 | rodada 2 |
|---|---|---|
| `doubleSided` | **5 de 5 materiais** | **0 de 5** (`use_backface_culling = True`) |
| emissivo assado | 2 materiais | **0** (o laranja da chapa e zerado antes do export) |
| `TEXCOORD_0` sem textura | 6 meshes, 3,0 MB de VRAM | **0** (`export_texcoords=False`) |
| aviso `Mesh ... is not valid` | toda rodada | **nenhuma das 7 rodadas emitiu**, e o `mesh.validate()` roda em laco no fim |
| arestas de fronteira (buracos) | **1.574** | **8**, todas em FORT_Walls; cranio, podio, dente, cristal e coroa em **zero** |
| triangulos de area zero | **12.893 na muralha (46,5%)**, 7,9% no arquivo | **16 (0,01%)** |

### As quatro causas que so a medicao encontrou

1. **O que fechou os buracos do cranio nao foi limpar, foi nao produzir.** Tres
   tentativas medidas: desligar `use_hole_tolerant` PIOROU (1.589 -> 2.831);
   `bmesh.ops.holes_fill` mais `bpy.ops.mesh.fill_holes` levou 13.006 a 2.331 e parou,
   porque nenhum dos dois tem laco para percorrer quando um vertice de fronteira tem
   tres ou mais arestas abertas; e o limpador do 3D-Print Toolbox NAO EXISTE nesta
   instalacao. A saida foi um **remesh voxel de 0,32 m depois do talhe**: reconstrucao
   volumetrica nao remenda casca, constroi outra, e o que sai e fechado por definicao.
   Custa a aresta viva do boolean, o que em pedra erodida e ganho e nao perda.
2. **Quem fabricava os triangulos de area zero era o DRACO, nao o Blender.** A malha
   saia com zero e o arquivo chegava com 46,5% na muralha: o Draco quantiza posicao em
   14 bits, e em 124 m isso e 7,6 mm de passo. Duas correcoes: quantizacao em 16 bits
   (1,9 mm) e, na origem, o Bevel de 0,26 m sobre mais de cem caixas que se
   interpenetram, que encolhia para largura nula em cada emenda (agora 0,12 m com
   limite de 46 graus).
3. **Sliver nao se apaga, se COLAPSA.** Apagar por area abre um buraco de tres
   arestas, o preenchimento tapa com outro sliver e o contador oscila (a muralha foi de
   5.120 para 6.685 assim). `dissolve_degenerate` a 4 mm solda a aresta curta e a face
   some sem deixar buraco: 5.020 -> 17 numa passada.
4. **`hasattr(bpy.ops.mesh, "x")` NAO prova que o operador existe.** `bpy.ops` resolve
   nome preguicosamente e so falha na chamada, e o add-on ausente passou pelo teste.

### A chapa de prova, e por que ela agora prova alguma coisa

A rodada 1 renderizou a chegada com duas luzes pontuais de **9.000 W POR DENTRO das
orbitas**. A rodada 2 separa as duas coisas e declara qual e qual:

- as chapas **clay** (frente, tres quartos, calota, rosto) sao Workbench com luz de
  estudio, e nao afirmam nada sobre a cena: servem para julgar silhueta e relevo;
- a chapa **de chegada** e EEVEE com as **tres PointLight que `leonidas-cave.ts` ja
  declara** (linhas 643, 646 e 647: salao, garganta e derrame na soleira), cor EMBER
  `0xff8a2b`, mais o mesmo emissivo que o `.ts` aplica ao cristal (1,35 e 0,40).
  **NAO HA NENHUMA LUZ DENTRO DE ORBITA OU DE CRANIO.** O olho acende nela porque o
  material acende, que e como vai acender no navegador. O script imprime a lista de
  luzes a cada rodada.

### Contrato medido na malha pronta

| o que | medido |
|---|---|
| abobada (biparietal) x face (bizigomatica) | **42,18 x 40,16 m**, razao 1,05 |
| altura total (piso da nave a ponta da coroa) | **62,86 m** (cranio 60,22; coroa +2,6) |
| frente / profundidade | 124,5 / 121,2 m |
| porta livre por varredura de raios | **10,6 x 11,2 m** (contrato 9,0 x 11,0) |
| soquete da orbita | 8,0 m de profundidade, apice em rocha solida |
| nave | 30 x 27,1 x 53 m; **596 de 600 raios do centro param em pedra** (0,7% escapa, e e a boca) |
| normais | **100,0%** em face frontal nos tres testes (2.000 de fora, 115 de dentro, 1.200 na muralha) |
| triangulos / materiais / imagens embutidas | 171.708 / 5 / **0** |
| **distancia de leitura (fov 45, 75% do quadro)** | **101,2 m**, e continua sendo o contrato da F2 (a rodada 1 pedia 105,5) |

### Como retomar se a maquina cair

Tudo o que importa esta em disco e versionado no proprio script, que e deterministico:

1. `blender/build_leonidas_fortress.py` e a fonte unica da peca. Rodar
   `blender -b -P build_leonidas_fortress.py` (cerca de 25 min) regrava o GLB e as
   seis chapas do zero. Nada e feito a mao na cena.
2. `blender/verify_leonidas_fortress.py` confere o GLB pronto por fora, sem confiar no
   escultor: le o chunk JSON byte a byte (doubleSided, emissiveFactor, TEXCOORD,
   imagens) e reimporta a malha num Blender limpo para medir fronteira, area zero e
   dimensao. **Ele solda a 0,5 mm antes de medir topologia**, porque glTF guarda um
   vertice por canto e sem soldar a mesma malha que sai com fronteira zero chega com
   480.730 arestas de fronteira, que e formato de arquivo e nao buraco.
3. Copia de seguranca da rodada 1 (script e GLB) e da rodada 2 esta no scratchpad da
   sessao, como `fortress-r1-backup.py`, `leonidas-fortress-r1.glb`,
   `fortress-r2-final.py` e `leonidas-fortress-r2.glb`.

### O que NAO foi corrigido, e esta declarado

- **8 arestas de fronteira e 16 triangulos abaixo de 1 cm2 sobram em FORT_Walls**
  (0,03% e 0,01%). Vem do Bevel sobre caixas que se interpenetram. O conserto
  estrutural e biselar cada caixa ANTES do join, e ele nao foi tentado.
- **O terco medio do rosto ainda le como lobos lisos.** Nao era um dos cinco
  bloqueios, e mexer nele sem chapa por iteracao arrisca regressao. E o primeiro item
  da proxima rodada.
- **212 arestas nao-manifold na muralha** (faces internas de boolean). Nao esta no
  portao e nao produz buraco visivel, mas e triangulo gasto dentro da pedra.

## F2: a caverna-geodo, com as medidas fechadas

A fortaleza esta esculpida e medida, entao a caverna deixa de ser um numero de desejo e
passa a ser conta:

| entrada | valor |
|---|---|
| fortaleza | 121,2 (largura) x 124,5 (profundidade) x 62,86 (altura) m |
| distancia de leitura do rosto (fov 45, peca a 75% do quadro) | **101,2 m** |
| comprimento minimo do salao | 124,5 + 101,2 = **225,7 m** |
| a camara de hoje | 64 m, ou seja oferece 32 m de recuo contra os 101,2 exigidos |

**Alvo: 250 x 180 x 90 m**, e cada eixo tem motivo medido:

- **250 m de comprimento**: os 225,7 do minimo mais 24 m de folga atras da fortaleza e na
  soleira. Menos que isso e o visitante nao consegue recuar o bastante para o rosto caber
  no quadro, que e a queixa original ("se o cara tenta dar zoom out ele sai da caverna").
- **180 m de largura**: a fortaleza tem 121,2, sobram 29 m de cada lado para contornar. E
  o minimo para a peca ser circundavel; se ficar apertado na chapa, abre para 200.
- **90 m de pe direito**: 62,86 da fortaleza mais 27 m de ar acima da calota. Cranio
  encostado no teto le como brinquedo em caixa.

**E ela e um GEODO, nao um buraco.** Paredes de cristal da mesma familia das runestones
(`crystalMaterialFor` em park.ts), crescendo para dentro da cavidade. A caverna deixa de
ser basalto colado na formacao e passa a ser a mesma pedra: e isso que mata a leitura de
puxadinho.

**A chegada e enquadramento, nao acaso.** O corredor em S existente (65 m, que corta a
linha de visao de proposito) tem de desembocar a cerca de 101 m da fachada e DE FRENTE
para o rosto. A primeira coisa que o visitante ve ao sair do corredor e o cranio inteiro,
na distancia exata em que ele cabe no quadro.

## Registro

### 06/09/2026
- Obra aberta. Diagnóstico medido, decisões 1 a 5 tomadas, busca de acervo encerrada sem
  candidato aprovado.

### 07/09/2026 — F1 fechada

`blender/build_leonidas_fortress.py` → `public/city/park/leonidas-fortress.glb`
(1.719 KB, 165.228 triângulos, 5 materiais, 6 objetos). Reproduz com
`blender -b -P build_leonidas_fortress.py`.

**A peça.** Um crânio esculpido de 60,3 m, OCO, nascendo de um maciço de 46 m. As
órbitas e o nariz são janelas de verdade do santuário interno; a boca é a porta.

| o que | medido na malha pronta |
|---|---|
| crânio (largura entre arcos zigomáticos x altura) | 40,2 x 60,3 m — razão **1,50** |
| altura total (piso do salão à ponta do cristal da coroa) | **65,5 m** |
| frente total / profundidade total | **124,5 m** / 121,2 m (x de −72,2 a +49,0) |
| porta: vão livre medido por varredura de raios | **8,8 x 10,0 m** |
| soleira acima do piso do salão | **5,92 m** (escadaria de 15 degraus, 20 m de corrida, 16,5°) |
| órbita acima do piso / ângulo do visitante | 32,96 m / **16,6°** |
| parapeito do maciço / calota acima dele | 46,0 m / 14,3 m |
| muralha externa / torre de canto | 18 m e 19 m = 30% e 31,7% do crânio |
| **distância de leitura (fov 45, peça a 75% do quadro)** | **105,5 m** |

⚠️ **Os 105,5 m são o contrato da F2.** A câmara de hoje oferece 32 m. O geodo de
250 x 180 x 90 m dá conta com folga, mas o número tem de ser conferido a raio na
malha nova, não presumido.

**Contrato do quadro local** (para a F4, em `leonidas-cave.ts`): metros finais, sem
multiplicador; z para cima; ORIGEM no centro da soleira da porta, no nível do piso
dela; **+X aponta para FORA da boca** (mesma convenção de `build_leonidas_cave.py`).
Objetos e materiais: `FORT_Skull`/`FORT_Walls` → `FortressRock` (massa fosca quase
preta), `FORT_Podium` → `FortressFloor` (laje do santuário, fita do túnel e soleira
com a Diamond Paw), `FORT_Teeth` → `FortressTooth`, `FORT_Crystal` → `FortressCrystal`
(órbitas, nariz e fraturas), `FORT_Crown` → `FortressCrown` (o cacho da calota).
**A luz é do .ts**: a brasa vai DENTRO do santuário e sai pelos olhos porque há
buraco (medido: o raio do centro do santuário até cada órbita sai sem tocar rocha).
`FortressCrown` tem de ficar mais fraco que as órbitas, senão a coroa rouba o
primeiro sinal.

**Conferência de normais, antes de exportar** (lagoa.ts e alpino.ts perderam 100%
dos triângulos nesta mesma semana, em silêncio, contra material FrontSide):

- 2.000 raios de FORA para dentro no crânio: **100,0% em face frontal**
- 466 raios de DENTRO do santuário para fora: **100,0%**
- 1.200 raios de fora na muralha: **100,0%**
- n-gons com mais de 4 lados: **0** em todos os 6 objetos
- arestas não-manifold: 3.189 no crânio (0,9% das arestas, resíduo de EXACT sobre
  malha deslocada; nenhuma delas é visível pelos testes de face acima), 3 na
  muralha, 0 nos outros quatro

**Quatro defeitos que só a medição pegou, e que o próximo agente não deve repetir:**

1. `use_self` no Boolean. Os cortadores desta peça se cruzam entre si. Sem essa
   flag o EXACT levou a massa de 49.388 para **685** faces e o talhe de 685 para
   **21**, sem um erro no console. Irmã gêmea da escala não aplicada do cave.py.
2. Faces coplanares entre cascas do MESMO cortador. O piso do santuário e o piso do
   portal estavam os dois na cota 5,92: a porta abria só de 9,72 m para cima, ou
   seja faltavam 3,8 m dos 11 de altura livre, em silêncio. Um piso só, aparado uma
   vez, como o par bacia+laje do cave.py já fazia.
3. Raio de medição saindo de DENTRO do oco. As suturas, as crateras e a coroa
   inteira foram entalhadas na parede interna do santuário na primeira rodada,
   invisíveis de qualquer câmera. `surface()` agora atira de fora para dentro.
4. `ray_cast` responde em quadro LOCAL. Só o crânio tinha a localização assada, e
   toda sonda contra muralha, dente ou cristal media num quadro deslocado.

**A decisão de projeto que a chapa de clay forçou.** De frente o crânio redondo
lia; de três quartos lia OVO. Rushmore, Abu Simbel, Kailasa e o próprio Grayskull
são todos ROSTO EMERGINDO DE UMA MASSA, não escultura solta num pátio. O crânio
continua inteiro e esculpido, mas nasce de um maciço com a frente em x = +13: o
rosto projeta 8 m e a calota sobe 14,3 m acima do parapeito. De frente vê-se a
caveira, de lado e de trás vê-se fortaleza.

**Chapas de conferência** (clay de frente, clay de três quartos, e a chegada em
EEVEE com a brasa) ficam em `/tmp/.../scratchpad/fortress-*.png` e o script as
regrava a cada rodada.
