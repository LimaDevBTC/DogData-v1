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
- [ ] **F2. A caverna-geodo** (`blender/build_leonidas_cave.py` v2 + GLB)
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
