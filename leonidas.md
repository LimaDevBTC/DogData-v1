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

- [ ] **F1. A fortaleza-caveira** (`blender/build_leonidas_fortress.py` + GLB)
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
| triangulos | 173.994 em 6 malhas |
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

## Registro

### 06/09/2026
- Obra aberta. Diagnóstico medido, decisões 1 a 5 tomadas, busca de acervo encerrada sem
  candidato aprovado.
