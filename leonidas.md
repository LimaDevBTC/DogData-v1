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

- [x] **F1. A fortaleza-caveira** (`blender/build_leonidas_fortress.py` + GLB), 07/09
- [x] **F2. A caverna-geodo** (`blender/build_leonidas_geode.py` + GLB), 07/09
- [ ] **F3. Material e luz** (cristal das runestones, preto e laranja, a chegada)
- [x] **F4. Integração na cena** (`app/city/plaza/leonidas-cave.ts`), 07/09
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


## F2 FECHADA, 07/09: o geodo

`blender/build_leonidas_geode.py` -> `public/city/park/leonidas-geode.glb`
(904 KB, **143.790 triangulos**, 5 materiais, 9 objetos). Reproduz com
`blender -b -P build_leonidas_geode.py` (1m22 na maquina da casa). Confere com
`blender -b -P verify_leonidas_geode.py`, que le o GLB por fora e NAO confia em
nada que o escultor tenha dito.

⚠️ O arquivo NOVO nao substitui `leonidas-cave.glb`: os dois convivem ate a F4
trocar o `loadGlb` de `leonidas-cave.ts`. Trocar o caminho e a unica linha
obrigatoria, porque os tres nomes de material que o `.ts` ja conhece
(`CaveRock`, `CaveFloor`, `CaveDrip`) foram mantidos de proposito.

### As duas contas do briefing que estavam trocadas, e a que faltava

| o que o briefing dizia | o que o GLB da fortaleza diz |
|---|---|
| "124,5 = profundidade da fortaleza" | 124,50 e a **LARGURA** (y); a profundidade (x) e **121,20** |
| "180 = 121,2 + 29 de cada lado" | os dois eixos estavam trocados; ambos ainda cabem, mas a conta estava errada |
| "101,2 m de distancia de leitura" | so cobre a ALTURA (S = 62,86). A peca tem **124,50 m de largura**, e num quadro 3:2 com fov vertical de 45 graus caber a 75% pede **D = 133,6 m** |

A terceira e a que importa: com a fortaleza a 104 m do mirante, a chapa mediu
**63,3% da altura do quadro e 192,5% da largura**, ou seja o crânio cabia e a
muralha nao. A fortaleza foi recuada para **134,07 m** e agora ocupa 49,7% da
altura e 137,1% da largura, dentro dos 150% que uma tela 3:2 oferece.

### Contrato medido a raio na malha pronta

| o que | alvo | medido |
|---|---|---|
| comprimento livre no eixo da chegada | 250 | **287,6 m** (o verificador, com outra amostragem, acha 303,1) |
| largura livre (varia de proposito) | 180 | **204 m** na nave, **206 m** nas baias |
| pe direito sobre a nave | 90 | **92,4 m** (verificador: 93,4, teto na cota 95,7) |
| ar acima da coroa da fortaleza | 27 | **29,6 m** (verificador: 32,8) |
| distancia do mirante ao plano do rosto | >= 101,2 | **134,07 m** |
| face da rocha na boca (x) | ~ +7 a +10 | **+8,4 / +9,4 / +10,7**, medida a raio e nao presumida |
| linha de visao de fora | 0 | **0 de 600** raios alcancam o salao (verificador: 0 de 800) |
| normais apontando para o INTERIOR | 100% | **100,00%**, 8.858 de 8.858 raios no verificador, e 4.497 de 4.497 no escultor, das 5 ancoras |
| arestas de fronteira / area zero / nao-manifold | 0 | **0 / 0 / 0** no escultor; no arquivo reimportado, 5 triangulos abaixo de 1 cm2 (0,00%) |
| `doubleSided` / emissivo assado / TEXCOORD sem textura / imagem embutida | 0 | **0 / 0 / 0 / 0** |

### O que faz dele um GEODO e nao um buraco

1. **A cavidade e a UNIAO DE CINCO LOBOS** (nave, abside, duas baias, lobo da
   chegada), nao um elipsoide. O bloqueio 3 da F1 foi "a calota e um balao liso";
   um elipsoide de 288 m seria o mesmo defeito dez vezes maior. O lobo da chegada
   tem teto BAIXO (64 m contra os 92 da nave) de proposito: compressao e liberacao.
2. **Drusas crescendo PARA DENTRO**, ancoradas na normal da parede medida a raio.
   Tres formacoes grandes (abside, flanco da nave, teto da chegada), doze manchas
   medias e nove linhas de fratura: **3.392 lascas**.
3. **O cristal e da familia das runestones pelos PARAMETROS dos TIERS de park.ts**:
   `CaveCrystal` = M_T4 (dark 0,20 0,20 0,22 / metal 0,30 / rough 0,13), que e o
   mesmo valor de base do `FortressCrystal`; `CaveVein` = M_T5 (dark 0,09).
   A massa e a MESMA rocha do `FortressRock` (0,045 / rough 0,62 / metal 0,05).
4. **Escala legivel**: 3 estalactites de 26 a 40 m, 16 de 11 a 22, 44 de 3,5 a 9,
   **2 colunas inteiras de piso a teto**, 14 estalagmites de meia-distancia,
   96 blocos desabados mais 16 de cascalho na orla da raia, e uma **escadaria de
   20 degraus de 0,31 m** no mirante, que e a unica peca com medida de corpo
   humano e a regua da sala.
5. **A chegada e enquadramento**: o corredor em S desemboca num MIRANTE 6,2 m
   acima do piso, de frente para o rosto. Dos 273 raios do quadro de chegada,
   **62 param na fortaleza, 2 tem peca da caverna na frente dela** (0,7%, e sao
   pontas de estalactite no canto do quadro).

### ⚠️ POR QUE NAO EXPORTEI UV PARA `crystalMaterialFor`

A ideia era exportar UV nas drusas para que o `.ts` chamasse `crystalMaterialFor`
com as texturas da runestone, que ja estao memoizadas (custo zero de VRAM).
**Nao da, e o motivo esta na imagem:** `crystal-basecolor.webp` NAO e uma textura
tileavel, e o ATLAS DE UV do `runestone3d.gltf`, com as facetas escuras da pedra
espalhadas num fundo CINZA CLARO de margem nao usada. E o shader de
`crystalMaterialFor` transforma luminancia alta em MARCA BRANCA
(`crystalMk = clamp((lum - 0.42)/0.30)`): projetar esse atlas em UV de caixa poria
a margem cinza (lum ~0,78, ou seja marca a 100%) por cima das drusas inteiras.
"Mesma familia" aqui e cumprido pelos PARAMETROS do tier, nao pelo mapa, e o GLB
sai com ZERO imagem e ZERO TEXCOORD, como o da fortaleza.

### ⚠️ A FRESTA NO TETO FOI RECUSADA, e o que entrou no lugar

O briefing pedia para considerar uma fresta como fonte fria. Recusada, e o motivo
esta escrito no proprio `leonidas-cave.ts`: *"O sol da praca e uma direcional SEM
OCLUSAO: ele atravessa a rocha e acende o piso da camara como se nao houvesse
teto"*. A `CAVE_LAYER` existe so por causa disso. Um furo de verdade no teto nao
acrescenta um facho, reintroduz o bug; e o ceu da praca e preto (Lua), entao a
"luz fria do ceu" seria um retangulo preto.

No lugar dela entrou um **VEIO DE CRISTAL de 214 m atravessando o teto no eixo da
nave** (`CaveVein`, tier M_T5, cor MARK). Entrega o que a fresta entregaria (fonte
alta, fria, contrastando com o ambar de baixo, marcando o eixo da chegada) sem
furo, sem vazamento de sol, e usando a fisica que o parque ja tem: runestone
acende com a marca.

### ⚠️ A DESCOBERTA QUE A F3 HERDA: TRES POINTLIGHT NAO ENCHEM 288 m

A chapa da abside da rodada 3 saiu PRETA com manchas brancas boiando, e a medicao
de pixel deu o veredito: a drusa estava em RGB 60-80 (0,25 em sRGB, **escura**) e o
fundo em 0-5 (**preto**). O defeito nunca foi o cristal brilhar demais; era a sala
nao existir atras dele. A unica luz do salao ficava na frente da fortaleza e a
propria fortaleza fazia sombra em 40 m de salao e na maior formacao de drusa da
caverna.

O plano de luz que a chapa de chegada usa, DECLARADO, e que a F3 herda:

| luz | posicao (quadro local) | intensidade three | funcao |
|---|---|---|---|
| `rosto` | (-176, 0, 16) | 700 | o derrame do templo. **Dentro do patio da muralha**, nao solta no salao: com ela em x = -150 a caverna inteira acendia por igual e virava um modelo de argila bege |
| `abside` | (-292, 0, 26) | 140 | o contraluz atras do cranio, que acende a maior drusa |
| `abobada` | (-256, 0, 76) | 70 | acende o teto e o veio; sem ela 92 m de pe direito e um numero que ninguem ve |
| `garganta` | (-18, 16,5, 6) | 60 | o cotovelo do corredor |
| `soleira` | (18, 0, 7) | 70 | o derrame da boca, o que se ve de longe |
| **ambiente** | (sem posicao) | AmbientLight ~0,006 ambar na `CAVE_LAYER` | o quique de uma sala fechada. **Nao e PointLight e nao entra no orcamento de <= 10 da praca** |

Cinco PointLight cabem porque a regra 3 da F4 ja esta escrita: dentro da caverna o
resto da cidade nao e visivel, entao o que esta fora e suspenso.

⚠️ **O AmbientLight nao e opcional.** No EEVEE o emissivo do cristal ainda ilumina
o que esta em volta; no three, `emissive` de `MeshStandardMaterial` nao ilumina
nada. Sem o ambiente, no navegador a sala fica MAIS preta que na chapa.

### ⚠️ A ARMADILHA DE GOSTO, e as quatro rodadas que ela custou

"Cobrir tudo de cristal vira joia gigante" ja estava registrado. O que NAO estava
e que existe um defeito simetrico, e as chapas o encontraram nesta ordem:

1. **confete** (rodada 1): 46 a 80 lascas de ate 1,5 m espalhadas por manchas de
   ate 24 m de raio = uma lasca a cada 24 m2, ou seja respingos soltos;
2. **borrao** (rodada 2): densidade dez vezes maior e desvio angular apertado para
   0,12 = todas as lascas recebem a brasa no mesmo angulo e a mancha sai com UM
   valor so, o que a 130 m le papel rasgado de borda dura;
3. **o conserto** (rodada 3): densidade da 2 + leque da 1 (0,28), mancha ALONGADA
   em vez de disco (drusa nasce ao longo de uma fratura), e **32% das lascas de
   cada drusa sao ROCHA e nao cristal** (vao para `GEO_Talus`, material fosco):
   numa drusa de verdade parte dos cristais esta encapada pela matriz, e o
   salpicado e o que o olho le como pedra.

**A meta de "10 a 20% de cobertura" foi APAGADA e nao substituida por outra.** A
conta a matou: cobrir 15% de ~90.000 m2 de parede com cristal de verdade custaria
10.500 lascas e 210.000 triangulos, mais que a fortaleza inteira, e o resultado e a
joia gigante. A estrategia virou CONCENTRACAO, e o numero medido (**2,4% da esfera
de visao**) e reportado como medida, nao como meta cumprida.

### Orcamento no quadro

| | tris |
|---|---|
| GEO_Shell (a rocha) | 46.016 |
| GEO_Drusas (`CaveCrystal`) | 51.032 |
| GEO_Talus (blocos + matriz das drusas) | 18.980 |
| GEO_Vein (`CaveVein`) | 12.980 |
| GEO_Floor (laje, fita, mirante, escadaria, meio-fio) | 5.862 |
| GEO_Stalactites | 5.080 |
| 3 matacoes de fora | 3.840 |
| **GEODO TOTAL** | **143.790** |
| fortaleza (medida no GLB dela) | 171.708 |
| **SOMA NO QUADRO** | **315.498** |

**80.072 tris (56%) sao descartaveis por tier sem reassar nada**: `GEO_Drusas`,
`GEO_Vein`, `GEO_Stalactites` e `GEO_Talus` sao objetos separados com material
proprio. Num aparelho fraco a caverna cai para ~63.700 tris e continua sendo a
mesma caverna, so mais nua.

### Como retomar se a maquina cair

1. `blender/build_leonidas_geode.py` e a fonte unica, deterministico (SEED
   20260907). `blender -b -P build_leonidas_geode.py` regrava o GLB e as sete
   chapas do zero, em 1m22. Nada e feito a mao na cena.
2. `blender/verify_leonidas_geode.py` confere o arquivo pronto por fora: le o
   chunk JSON byte a byte e reimporta a malha num Blender limpo. Ele **descobre
   sozinho onde e o vazio** (um ponto e interior se acha teto acima e chao abaixo,
   pelas normais) e nao recebe uma coordenada sequer do escultor. Ele **solda a
   0,5 mm antes de medir topologia**, porque glTF guarda um vertice por canto.
3. Copias no scratchpad da sessao: `geode-final-script.py`,
   `leonidas-geode-final.glb`, `verify-final.txt` e os logs `geode-run*.log` das
   onze rodadas.
4. As chapas ficam em `/tmp/.../scratchpad/geode-*.png` e o script as regrava a
   cada rodada: `geode-chegada`, `geode-aproximacao`, `geode-corredor`,
   `geode-teto`, `geode-baia` (EEVEE, com a luz declarada acima) e
   `geode-clay-chegada`, `geode-clay-planta`, `geode-clay-corte` (Workbench, que
   nao afirmam nada sobre a luz da cena).

### O que NAO foi feito, e esta declarado

- **O tunel do corredor ainda le liso.** Levou um deslocamento de +-0,75 m na
  rodada final, mas com o `shade_smooth_by_angle` de 34 graus e a luz da garganta
  batendo de perto ele continua parecendo tubulacao. Conserto: aumentar a
  tesselacao do perfil e do passo do caminho antes de deslocar.
- **2 dos 273 raios do quadro de chegada tem estalactite na frente da fortaleza**
  (0,7%, e sao pontas no canto). Nao foi corrigido porque mexer no sorteio delas
  arrisca regressao no resto do teto.
- **A chapa da abside foi retirada** depois de tres tentativas: a abside tem 40 m
  de fundo atras de uma peca de 121 m, e qualquer camera posta la fica a menos de
  15 m de uma parede ou dentro de uma estalactite de 40 m. Aquela parede se ve da
  nave, de longe, e e assim que ela foi projetada.
- **A calibragem final de material e luz e da F3.** Os numeros acima sao um ponto
  de partida medido, nao um acabamento.

## Registro

### 06/09/2026
- Obra aberta. Diagnóstico medido, decisões 1 a 5 tomadas, busca de acervo encerrada sem
  candidato aprovado.

### 07/09/2026: F1 fechada

`blender/build_leonidas_fortress.py` → `public/city/park/leonidas-fortress.glb`
(1.719 KB, 165.228 triângulos, 5 materiais, 6 objetos). Reproduz com
`blender -b -P build_leonidas_fortress.py`.

**A peça.** Um crânio esculpido de 60,3 m, OCO, nascendo de um maciço de 46 m. As
órbitas e o nariz são janelas de verdade do santuário interno; a boca é a porta.

| o que | medido na malha pronta |
|---|---|
| crânio (largura entre arcos zigomáticos x altura) | 40,2 x 60,3 m, razão **1,50** |
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

## F4 FECHADA, 07/09: as duas pecas ligadas na cena

`app/city/plaza/leonidas-cave.ts` deixou de carregar `leonidas-cave.glb` (a camara
de basalto de 64 m) e `SF.templeHall` (o pagode japones). Nenhum arquivo do repo
aponta mais para eles. No lugar entraram `leonidas-geode.glb` e
`leonidas-fortress.glb`, e o portao de proximidade que o fundador pediu.

Portao: `npx tsc --noEmit` limpo. Nenhum navegador foi aberto; tudo abaixo foi
medido offline, decodificando o Draco dos GLB e o mapa de altura do parque com
`node`.

### 1. O assentamento, e ele foi CONFERIDO e nao presumido

| o que | medido |
|---|---|
| fortaleza em x | **−213**, o mesmo `FORT_AT` em volta do qual o geodo foi escavado |
| plano do rosto | −213 + 22,93 = **−190,07** |
| soleira do corredor (mirante) | **−56** (`LEDGE_X[0] + 4`) |
| distancia de leitura entregue | **134,07 m**, contra os **133,6** que o quadro 3:2 exige (o `.ts` avisa no console se algum reasse encolher isso) |
| giro / escala aplicados na peca | **nenhum**: os dois GLB saem no mesmo quadro (metros finais, +X para fora da boca) |
| piso sob a pegada da fortaleza | de **−1,28 a −0,28 m** nos vertices, **−1,12** pela grade de 6 m das 408 celulas da pegada |
| y da fortaleza | desce **1,12 m**: a laje de base dela (0,8 m) vai de −1,12 a −0,32 e encosta em tudo, sobrando como soco de meio metro onde o piso e mais alto |

⚠️ **A caixa e medida DEPOIS de assentada**, e agora em quadro LOCAL por matriz
inversa do grupo, nao por `Box3.setFromObject`. O codigo de ontem so acertava
porque media enquanto o grupo ainda estava na origem ("medido AQUI, antes do
grupo sair da origem"); com carregamento sob demanda a peca chega com o grupo ja
em `CAVE_LOCAL` e girado 10 graus, e medir em mundo devolveria a caixa 335 m fora
do lugar.

### 2. O carregamento sob demanda: quanto o boot economiza

| | bytes |
|---|---|
| boot da caverna ANTES (cave + temple-hall + 2 cogumelos + braseiro) | **1.071.056** |
| boot da caverna DEPOIS (so o braseiro) | **146.380** |
| **economia de boot** | **924.676 B = 903 KiB, 86,3%** |
| adiado para o gatilho (geodo 926.156 + fortaleza 2.540.024 + cogumelos 99.504) | **3.565.684 B = 3,40 MiB** |

E o que sai do boot nao e so byte de rede: o pagode trazia **14 imagens
embutidas** (doze 512x512, duas 512x128, uma 256x256), ou seja **~15,7 MiB de
VRAM estimada com mipmap**, numa cena que o iPhone 13 emulado ja derrubava por
memoria. Agora sao zero, e nenhum dos dois GLB novos tem uma unica imagem.

Triangulos no boot: **25.436 a menos** (cave 17.048 + pagode 8.388), mais o
jardim inteiro, que tambem deixou de nascer no boot.

**As duas distancias, e o porque de serem duas:**

| peca | entra | sai | por que |
|---|---|---|---|
| geodo | **`parkDetailCull` x 1,3 x 1,25 = 6.825 m** no perfil padrao | 7.917 m | ele e o MACICO: a casca dele e a rocha que se ve de fora, entao tem de existir sempre que o sitio for desenhado. O culling mostra o sitio a 5.460 m, e o gatilho fica 1.365 m antes dele, de proposito |
| fortaleza | **420 m** | 620 m | ela e invisivel de fora, e isso e medido: **0 de 600 raios** de fora alcancam o salao. O gatilho dela e tempo de rede, nao visibilidade: 2,54 MB tem de chegar nos 506 m de caminhada que separam o gatilho do mirante (420 + 86 m de corredor) |

Nenhum dos dois entra no boot porque a camera nasce na praca, a **11.800 m** do
centro do parque. O jardim do patio passou a nascer COM A FORTALEZA e nao com o
geodo: sem a pegada dela medida, `buildCaveGarden` cai no ramo "sem salao" e abre
a clareira do meio pelo raio do piso (38 m), o que poria canteiro dentro de uma
muralha de 121 x 124 m.

**O que o portao custa, declarado:** as oito PointLight da caverna (cinco do
salao, tres do jardim) nascem e morrem com o interior, e contagem de luz e chave
de cache de programa no three. A troca foi pesada nas duas pontas: sem o portao
sao 6 pontuais no laco de fragmento da praca inteira para sempre (3 da camara +
3 do jardim, que e o que existe hoje); com ele sao ZERO fora da caverna, ao preco
de DUAS familias de programa, numero fechado porque a histerese impede o
liga-desliga na fronteira. Divida registrada: o inventario de luz do culling so
sabe somar, entao cada ida e volta completa deixa 8 entradas mortas na lista dele.

### 3. A luz: o plano da F3 implementado

Cinco PointLight ambar (EMBER `0xff8a2b`, decay 1,7, a convencao da praca) mais
**um AmbientLight**, todos so enquanto o geodo existe. As posicoes vem do quadro
do escultor convertidas para o three (three.z = −blender.y):

| luz | posicao (three) | intensidade | alcance |
|---|---|---|---|
| rosto | (−176, 16, 0) | 700 | 320 |
| abside | (−292, 26, 0) | 140 | 180 |
| abobada | (−256, 76, 0) | 70 | 260 |
| garganta | (−18, 6, −16,5) | 60 | 120 |
| soleira | (18, 7, 0) | 70 | 95 |
| **ambiente** | sem posicao, so na `CAVE_LAYER` | **0,019** | sem alcance |

⚠️ **O AmbientLight vale 0,019 e nao 0,006**, e a conta esta no arquivo: o valor
declarado pelo escultor e 0,006 de RADIANCIA no fundo de mundo do EEVEE, e o
`AmbientLight` do three recebe IRRADIANCIA, que e π vezes isso. Ele fica **so na
CAVE_LAYER**: na camada 0 seria um veu ambar sobre a Lua inteira, porque luz
ambiente nao tem posicao para limitar alcance.

**Teste de raio nas 11 posicoes** (paridade contra os 46.016 triangulos da casca):
as cinco luzes e as seis lanternas do corredor estao **todas no vazio**, nenhuma
dentro da rocha.

Emissivo, com a forca com que cada material nasce e respirando em torno dela (um
valor unico apagaria um e estouraria o outro):
`CaveCrystal` **0,0157** e `CaveVein` **0,077** na cor MARK de park.ts;
`FortressCrystal` **1,35** e `FortressCrown` **0,40** em ORANGE. Os quatro estao
zerados no GLB de proposito.

⚠️ **`CaveRock` e a unica peca do interior que fica na camada 0**, e e decisao
com custo declarado: a casca do geodo e UMA malha so que carrega as duas faces, a
parede da cavidade e o macico externo (o bbox dela bate com o elipsoide de
354 x 256 x 175 m). Manda-la para a `CAVE_LAYER` apagaria a montanha vista do
parque. O preco e o sol tocar as faces da cavidade que olham para cima, e a defesa
continua sendo o albedo 0,024, a mesma da camara velha.

### 4. Tier de maquina, com os numeros do dossie CORRIGIDOS

⚠️ **A conta da F2 estava errada por 8.000 triangulos.** Somando os mesmos quatro
objetos que ela lista: 51.032 + 18.980 + 12.980 + 5.080 = **88.072**, e nao
80.072. Logo o resto e **55.718** e nao "~63.700". Os valores por objeto do
dossie batem com o GLB; a subtracao e que nao fechava.

| perfil | geodo | + fortaleza |
|---|---|---|
| desktop / HIGH | 143.790 | **315.498** |
| `quality === 'low'` ou `tier === 'mobile'` (e nao HIGH) | **55.718** | **227.426** |

O corte le `profile.quality` E `profile.tier`, campo a campo, e um perfil ausente
nao vira "corte ligado" nem "corte desligado" por acidente: sem perfil, nada e
cortado. Ele tira `GEO_Drusas`, `GEO_Talus`, `GEO_Vein` e `GEO_Stalactites`, que
sao objetos separados com material proprio, e sai INTEIRO por material
(`GEO_Talus` e `GEO_Stalactites` dividem o `CaveDrip`, e descartar so um serviria
material morto ao outro). A fortaleza nunca entra no corte, que e regra escrita
da F4.

**Sombra:** so `CaveRock` lanca. O passe de sombra da praca testa a camada da
CAMERA, que tem a `CAVE_LAYER` ligada, entao tudo com `castShadow` e redesenhado
nele. Deixar o `dressSf` valer para o interior mandaria **93.934 triangulos** do
geodo mais os **171.708 da fortaleza** para o mapa de sombra a cada quadro, para
produzir sombra nenhuma (a direcional nao entra na caverna e as cinco pontuais
daqui nao lancam sombra).

### 5. As pecas que assentavam na geometria VELHA, uma a uma

| peca | o que quebrava na caverna nova | conserto |
|---|---|---|
| **jardim: cota** | `plan.top` era `box.max.y` da malha do piso, que no geodo devolve **6,87 m** (o parapeito do mirante) para um salao cujo piso esta em −0,82: o jardim inteiro nasceria **7,7 m no ar** | grade de 6 m com o maior y por celula, e cada peca pergunta a altura no ponto dela |
| **jardim: anel** | com o pagode de 30 m a diferenca era centimetrica; com uma fortaleza de 121 x 124 m num salao de 288 x 204, **78 das 213 pecas (37%) caiam DENTRO da muralha**, porque o `fit` prendia no disco do piso DEPOIS de empurrar para fora do templo, e o segundo passo desfazia o primeiro | o raio e preso de uma vez so, dentro da faixa que existe naquele angulo (intersecao raio/circulo); onde nao sobra faixa, nao nasce planta. Medido depois: **5 canteiros, 111 pecas, 0 dentro da fortaleza, 0 fora do disco** |
| **lanternas do corredor** | eixo de 5 pontos com cota fixa 6,2 m, feito para um corredor plano de 65 m. O do geodo tem 86 m, desvia 16,5 e SOBE de 0 a 6,2: as primeiras boiavam 6 m acima do chao e as ultimas ficavam dentro da rampa. E o alargamento nao e linear (so comeca depois de 55% do caminho): interpolar em reta poria a lanterna do meio **1,2 m dentro da pedra** | seguem `CORREDOR` + `CORREDOR_Z` da assadeira, com a lei de alargamento dela, comecando em u = 0,30 (a face da rocha, medida em x = +8,4 a +10,7). Conferidas a raio: **6 de 6 no vazio** |
| **fio de brasa da soleira** | a fita do corredor virou RAMPA: a superficie em x = 11 vai de **1,03 a 1,50 m** contra os 0 m da camara velha, e um fio a y = 0,1 ficava **enterrado** | assentado em 1,295 e mais alto que fino (0,6 m): aparece de 10 a 57 cm ao longo dos 7,6 m e nao flutua em ponto nenhum |
| **monolitos, braseiros, terraco, caminho secreto, matacoes** | nao dependiam da malha da camara | intactos, e conferidos a raio: no vazio |

### 6. ⚠️ O QUE SO A MEDICAO PEGOU: o parque entrava dentro do salao

Esta e a descoberta cara da F4, e ela esta em `park.ts` e nao no arquivo da
caverna. O corte de terreno da caverna foi feito para uma camara de 141 m de
fundura e 81 m de largura. O geodo tem **336 m de fundura e 216 m de largura de
piso**, e o flanco do macico sobe: medido no mapa de altura, na cota da soleira,
o terreno esta **+25 m aos 60 m de fundura, +43 aos 100 e +90 aos 200**.

**Medido celula a celula nas 1.307 celulas de piso do salao: em 1.262 delas
(96,6%) o chao do parque ficava ACIMA do piso da caverna.** O visitante veria
uma encosta cinza atravessando a nave.

Tres numeros mudaram em `park.ts`, e os tres estao comentados la:

1. **fundura do corte: 140 → 230 m.** Nao 336 de proposito: `d` e a distancia ao
   SEGMENTO, entao alem do fim o corte vira calota de raio 178, e com 230 o
   escavado alcanca −350, que e a borda da casca (−342,6). Por o fim no fundo da
   cavidade abriria 120 m de prateleira lisa ATRAS da rocha.
2. **raio de influencia: 120 → 178 m** (corte cheio ate 120, natural a partir de
   178). O aro do escavado cai onde a casca encontra a cota da soleira.
3. **o alvo do corte AFUNDA 2,6 m depois da soleira.** O corte sempre nivelou o
   terreno na cota da soleira, e a camara velha tinha o piso exatamente nela
   (topo em y = 0 local): as duas superficies ficavam coplanares e brigavam em z.
   O piso do geodo e MAIS BAIXO: a superficie de topo vai de **−1,40 a −0,28 m**.
   Sem afundar, o terreno taparia o salao inteiro com uma laje cinza a 0,8 m do
   chao. Na frente da boca nada muda: terraco, trilhas e caminho secreto continuam
   lendo a mesma cota de sempre.

Resultado medido: **0 de 1.307 celulas** com terreno furando o piso. A cova fica
com **12,84 ha** e corte maximo de **136,8 m**, e quem a preenche e a propria
casca do geodo, que tem a mesma pegada.

E o **escudo das pedras marcadas deixou de ser um circulo**: um raio de 150 m a
partir da boca protegia a frente e deixava as duas baias e a abside descobertas.
Agora e distancia ao eixo < 140 m (os 130 da casca mais folga), e o numero de
pedras removidas do parque vai de **30 para 45** em 1.009.

### 7. O que NAO foi feito, e esta declarado

- **Nenhuma chapa.** A F4 e ligacao, e as regras da casa proibem abrir navegador
  aqui. Toda afirmacao acima e conta offline sobre a malha e sobre o mapa de
  altura. **A F5 tem de tirar chapa** pelo portao `scripts/city/chapas.mjs`, e as
  tres que importam sao: a chegada no mirante (o cranio inteiro no quadro), o
  interior sem encosta cinza, e o macico visto de fora do parque, que e a unica
  que a medicao nao alcanca.
- **A calibragem de intensidade continua sendo da F3.** As cinco luzes entraram
  com os numeros da chapa do escultor e o mapeamento dele (1 de intensidade no
  three ≈ 812 W no EEVEE), mas o EEVEE cai com o quadrado da distancia e a praca
  usa decay 1,7: aos 134 m do rosto isso e 5,7x mais luz no navegador do que na
  chapa. Os alcances foram escolhidos por funcao, nao medidos.
- **`revealAll()` nao alcanca mais o interior.** O culling liga tudo no boot para
  o `compileAsync` compilar shader do que esta escondido; o que nao existe nao
  compila. A primeira entrada na caverna compila os materiais do geodo e da
  fortaleza. E o preco do carregamento sob demanda e nao foi medido.
- **O jardim perdeu quase metade das pecas** (213 → 111) porque as que caiam
  dentro da muralha deixaram de nascer, e nao houve rodada de reposicao para
  recuperar densidade nas baias. Fica para quem for olhar a chapa.

## Rodada de 10/09/2026: o olho, o nariz, a solda e as pedras de dentro

⚠️ **O PEDIDO DO FUNDADOR, PALAVRA POR PALAVRA:** *"a caveira em si merece subir de
nível. Hoje os olhos são como se fossem formados por losangos"*, *"a caveira deve ter
os olhos VERMELHOS e não devem ser arcaicos"*, *"as fossas nasais parecem ter
polígonos não simétricos e genéricos ali"*, *"o acabamento desse castelo deve ser
nível Taj Mahal"* e *"queria que o geodo fosse mais escondido por runestone"*.

Três equipes independentes de parque temático foram consultadas (rockwork, show
lighting e show design) e **as três acharam a mesma raiz sem falar entre si**: a
caverna não tem UMA sombra projetada, então toda a escultura do soquete existe na
malha e é invisível na tela.

### O que foi feito, com número

| item | antes | depois |
|---|---|---|
| **olho** | um material a 1,35 para órbita, nariz e fraturas | **cinco zonas**, rampa de 63:1: forro 0,107, bulbo 0,42, núcleo **1,20** |
| **cor do olho** | `#F6C34E` na tela (amarelo-ouro) | vermelho de verdade |
| **faceta do bulbo** | ico subdiv 1: aresta 3,2 m, **31 px** a 134 m | subdiv 3: aresta 0,8 m |
| **nariz** | assimétrico por bug de tipo, **3 m de desnível** | espinha nasal no eixo + duas conchas simétricas |
| **arco zigomático** | 0,95 m DENTRO da silhueta | bizigomática **42,73** contra biparietal 41,36 |
| **transferência da fortaleza** | **2.501 KB** | **727 KB** |
| **runestones dentro do salão** | 0 | **3**, descendo do teto medido |

### ⚠️ O TETO DO VERMELHO É 1,20 EM LINEAR, E É FÍSICA

`0xf7931a` a 1,35, passado pelo ACES e pela exposição 1,12 da cena, satura o canal
vermelho em 4,5 vezes o ponto de branco, e o ACES desatura tudo que estoura: sai
`#F6C34E`. Acima de **1,2 qualquer vermelho vira salmão**; acima de 2,5, branco. E a
regra que faz o olho ser a coisa mais brilhante da caverna não é a intensidade dele:
é **nada mais na sala passar de 0,05**, o que estava violado pela coroa (0,40) e
pelas fraturas (1,35, o mesmo valor da órbita).

### ⚠️ O BUG QUE VALIA 1.774 KB: UM OPERADOR QUE NUNCA RODOU

`shade_smooth` e `shade_smooth_by_angle` operam sobre a **seleção**, não sobre o
objeto ativo, e o script só tornava o crânio ativo. Os dois não faziam nada e a malha
ia FLAT para o export: **480.862 vértices para 160.680 triângulos, razão 2,95**, ou
seja cada triângulo carregando os próprios três. Numa malha soldada essa razão fica
perto de 0,5.

O sintoma que denunciou foi um NÃO resultado: trocar o ângulo de 58 para 74 graus não
mudou **um único byte** do arquivo. Parâmetro que não muda nada é parâmetro que não
está sendo lido. E o comentário do gerador discutia a escolha entre 34 e 58 graus com
números medidos, ou seja **uma decisão documentada sobre um parâmetro morto**.

Com a seleção corrigida, o ângulo passou a valer:

| ângulo | arquivo | razão v/tri | leitura |
|---|---:|---:|---|
| operador quebrado | 2.501 KB | 2,95 | casca facetada |
| 74° | 637 KB | 0,64 | plástico derretido, sem sutura nem talhe |
| **40°** | **713 KB** | — | **solda a rocha, preserva o entalhe** |

### ⚠️ O PASSE DE PLANOS DO ROSTO FOI TENTADO E REVERTIDO

O diagnóstico do rockwork continua de pé e é a maior dívida da peça: **não existe um
único plano na caveira**, as 21 primitivas são todas elipsoides, e cabeça monumental
lê por plano e por terminador, não por volume. A execução é que falhou: nove
cortadores `plate` de 7 m entraram na lista `cav`, ou seja antes do remesh de
fechamento, e **abriram a malha** (buraco na calota, malar solto, mandíbula rasgada).
Duas causas, as duas de método: caixa reta contra superfície curva atravessa a peça
nas pontas, e plano que atravessa não é cavidade, então o remesh não lhe dá tampa.

O caminho medido para a próxima tentativa está escrito no gerador: superfície de raio
22 a 30 m no lugar de caixa, profundidade máxima de 2,0 m, e **uma chapa de clay por
plano** antes de somar o seguinte. E o plano zigomático só volta medido contra o
arco: na tentativa ele derrubou a bizigomática de 42,73 para 31,66.

### Aberto

- [ ] os planos do rosto, pelo caminho acima
- [ ] as 28 runestones FORA, para esconder a cúpula: elas dependem da regra
      `park.ts:569` (`d < 140`), que apaga **45 pedras, entre elas 8 das 10 maiores
      do parque**, incluindo a de 715 m. A regra existe porque um cristal furou o
      teto, então ela não se afrouxa às cegas: o teste tem de virar volumétrico
- [ ] o patamar de entrada, com o programa de sete peças que o show design desenhou
- [ ] o tour, que hoje passa ao lado da obra: uma das paradas olha para a boca com a
      fortaleza inteira atrás da câmera

