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
- [ ] **F4. Integração na cena** (`app/city/plaza/leonidas-cave.ts`)
- [ ] **F5. Conferência** (chapas, orçamento por tier, zoom out provado)

Cada fase fecha com: arquivo em disco, número medido escrito aqui, e commit. Nenhuma
fase começa sem a anterior estar escrita neste arquivo.

## Registro

### 06/09/2026
- Obra aberta. Diagnóstico medido, decisões 1 a 5 tomadas, busca de acervo encerrada sem
  candidato aprovado.
