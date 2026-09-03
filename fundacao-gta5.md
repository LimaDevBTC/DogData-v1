# A fundação da DogCity no nível GTA5

> Programa de trabalho, 02/09/2026. Escopo: **o chão e nada além dele**. Prédio e
> vida ficam de fora por decisão do fundador, e entram depois, sobre esta base.
> O levantamento que originou este plano está em `gta5.md`.

## Feito nesta rodada (02/09), e o que as chapas mudaram no plano

O Bloco 0 foi executado em parte e **contradisse o próprio plano**, que é o
melhor resultado possível de um portão de medição.

1. **O portão ganhou altura de olho.** `scripts/city/chapas.mjs` tem uma tabela
   nova, `OLHOS`, com quatro enquadramentos a 1,7 m. O `y` deles não se escreve,
   se pergunta: `window.__plazaChao(x, z)` (novo, atrás de `?stats=1`) devolve a
   cota e o teste de pavimento num ponto qualquer, e o roteiro procura em anéis
   o asfalto mais próximo da semente. Prazo de carga de 300 para 480 s, porque
   duas execuções estouraram e a sonda mediu o portão abrindo em 169,9 s.
2. **A primeira chapa de 1,7 m achou o defeito de superfície, que não estava
   neste plano.** Eu tinha escrito que a base de material era boa porque a
   densidade de texel era boa. Errado: a 1,7 m o asfalto lia como papel-alumínio
   amassado e o regolito como veludo cotelê, com a direção do ladrilho visível
   até o horizonte.
3. **A causa é uma conta que faltava**, não gosto. O mapa de normal saía de um
   Sobel multiplicado por uma FORÇA ÚNICA (3,2) para as seis superfícies, e a
   inclinação física que isso gera depende de `metros`, que vai de 4 a 40. O
   regolito recebia 4,4 vezes mais relevo físico que o asfalto para o mesmo
   desenho, e os dois recebiam ordens de grandeza acima do real.
4. **Consertado atrás de `?relevo=1`**, com a força derivada de uma amplitude
   física declarada por superfície: `FORÇA = relevoM · S / (8 · metros)`. Atrás
   de bandeira porque o bot de auto-commit publica de hora em hora e uma conta
   que muda o chão da cidade inteira não estreia sem as duas chapas lado a lado.
5. **E ele provou o Bloco A antes de o Bloco A existir.** Com a conta certa, a
   rua ficou rua e a planície ficou uma chapa marrom morta: sem o normal falso,
   não sobra nada, porque não há relevo de verdade na geometria. O regolito
   subiu para 0,25 m (decimetria real de um ladrilho de 40 m) e voltou a ter
   vida, mas a lição fica escrita: **o que dá vida ao chão de longe é geometria
   e mancha, nunca força de normal.**

**Achado aberto, e ele é sério.** Duas das quatro sementes de quarteirão, uma da
banda Bairro (S06-Q17-B015) e uma da Borda (S04-Q19-B017), **não têm pavimento
desenhado a 200 m do centro do quarteirão**, com busca de passo de arco de 3 m,
que não pula uma via de 9 m. A regra da casa é que todo lote tem frente para
rua. Investigar antes de qualquer bloco: ou `vias.ts` não desenha o contorno
dessas bandas, ou a máscara `naVia` não os alcança.

---

## As duas decisões do fundador, e o que cada uma trava

**1. O lote NÃO aparece.** `tecido.ts` fica em `modo: 'obra'`. Nenhuma divisa,
nenhum plinto, nenhum marco por lote. O que se vê é infraestrutura sobre
terreno, e é isso que precisa ficar lindo. Consequência direta: `lotes.ts` (568
linhas, hoje exportado e importado por ninguém) **não entra como demarcação**.
Ele não é lixo: a técnica dele, o quad instanciado com desenho no fragmento, é
exatamente o motor do sistema de decalque do Bloco C, e é ali que ele renasce.

**2. Duas câmeras, orçamento separado.** A fundação é julgada de pé a 1,7 m e em
rasante de drone a 30 a 80 m. As duas leituras são contraditórias, e assumir a
contradição é o que estrutura este plano: dentro de um raio a cidade é **real**,
fora dele ela é **gráfica**. Esse raio passa a ser uma constante única da cena,
declarada, medida e obedecida por todo módulo novo. Hoje ela não existe: o que
existe é o `DistanceCuller`, que liga e desliga objeto e não troca de linguagem.

---

## 1. O que a auditoria do chão achou

**O terreno sob a cidade tem triângulo de 59 m.** `terrain.ts` desenha a própria
grade do SLDEM2015: 137x137 células de 59,2 m, refinada em 12 por lado apenas na
faixa dos lagos. Fora dali, a base sobre a qual rua, calçada e peça são
drapejadas é uma malha de 59 m. Abaulamento de pista, sarjeta, talude, berma,
valeta e micro-relevo não têm onde existir, e a 1,7 m o chão lê como uma chapa.
**Este é o defeito de primeira ordem da fundação.**

**A base de material é boa, a especificidade é zero.** `materiais.ts` gera seis
superfícies com albedo, normal e rugosidade, com quebra de ladrilho por ruído em
coordenada de mundo e um programa só para todas. Asfalto a 9 m por ladrilho de
512² dá 1,75 cm por texel, que é densidade de rua de verdade. O que falta não é
resolução: é remendo, junta de concretagem, mancha, tampa de poço, sarjeta suja,
desgaste na trilha de roda. Um ladrilho perfeito repetido por 4 km continua
lendo como material de amostra, não como rua que alguém usou.

**Não existe sistema de decalque.** Nenhum. É a peça que falta para tudo o que o
parágrafo acima pede.

**A sombra tem texel de 3,1 m.** Uma câmera ortográfica só, meia-largura até
3.200 m sobre mapa de 2.048. Com a câmera de rua entrando no critério de aceite,
isto sai de "melhoria de imagem" para **bloqueio**: a 1,7 m um meio-fio de 15 cm
sem sombra de contato não existe.

**A via já é séria, e o corte não.** `vias.ts` tem contorno de 12 m, travessa de
9 m, bulevar de 34 m com canteiro, travessia elevada, eixo tracejado, faixa de
pedestre, rotatória e anel, tudo em um material com cor por vértice. Mas a seção
é uma fita drapejada: sem abaulamento, sem sarjeta em V, sem face de meio-fio
com chanfro, sem rebaixamento na esquina, sem boca de lobo. De cima está certo.
De pé, falta o corte.

**O mobiliário já tem a disciplina certa.** 7.200 postes em duas InstancedMesh,
com troca dos 640 mais próximos pelo GLB modelado e saldo zero de programas
novos. É o padrão a copiar em todo módulo do anel de detalhe.

---

## 2. O conceito: o anel de detalhe

Uma constante nova, `R_DET`, e uma regra:

> Dentro de `R_DET` a cidade é construída para a câmera de 1,7 m. Fora,
> para a rasante. Nenhum módulo decide isso sozinho.

Valor de partida **300 m**, a fixar por medição no Bloco 0. Tudo que é caro se
registra nele: terreno fino, decalque, pedregulho, sombra da cascata 0, LOD do
poste. A transição não pode estalar, e o que garante isso é que cada sistema tem
a sua própria distância de esvaecimento dentro do anel, não um corte seco na
borda.

O anel se move com a câmera por passo (o padrão de `mobiliario-urbano.atualizar`:
só refaz quando a câmera anda mais que um passo declarado), nunca por quadro.

---

## 3. Os blocos

### BLOCO 0. Os portões de medição, antes de uma linha de código

Nada aqui é opcional, e três destes portões estão abertos desde o plano diretor.

1. **A chapa base de hoje.** `scripts/city/chapas.mjs` em quatro enquadramentos
   de 1,7 m (avenida, travessa, esquina de bulevar, borda de quarteirão) mais
   `rasante` e `aerea`. É contra estas seis imagens que todo bloco se compara.
   Hoje o portão não tem enquadramento de altura de olho: **acrescentar quatro**,
   e eles viram contrato como os outros.
2. **Custo em triângulo e em ms por quadro** de: um metro quadrado de terreno
   fino, um decalque, um pedregulho, uma árvore real. Continua não medido desde
   `plano-diretor.md` capítulo 8.
3. **VRAM.** Nunca medida, e a 1650 de 4 GB é o bloqueio conhecido.
4. **O orçamento livre.** A entrada padrão mede 37 fps com a cidade vazia. O
   Bloco F precisa vir antes ou junto de A, senão nada cabe.

### BLOCO A. O terreno fino (o item que destrava todos os outros)

Um clipmap geométrico centrado na câmera, quatro níveis aninhados, cada um uma
grade de 128x128 quads com o miolo vazado pelo nível de dentro:

| nível | célula | alcance | quads |
|---|---|---|---|
| 0 | 0,5 m | 64 m | 16.384 (cheio) |
| 1 | 2,0 m | 256 m | 12.288 (anel) |
| 2 | 8,0 m | 1.024 m | 12.288 (anel) |
| 3 | 32,0 m | 4.096 m | 12.288 (anel) |

Total **106.496 triângulos**, contra os 84.480 que o terreno inteiro custa hoje.
Ou seja: 1,26 vez o custo atual compra chão de 0,5 m debaixo da câmera até 64 m,
e cobertura contínua até 4 km. Além de 4 km fica a malha grossa e a saia que já
existem, sem mudança.

**O micro-relevo.** Um fbm em coordenada de mundo por cima da amostra do DEM,
comprimento de onda mínimo de 8 m e amplitude máxima de **12 cm**, esvaecendo a
zero ao longo do nível 2. O comprimento de onda mínimo é 4 vezes a célula do
nível mais grosso que carrega o relevo, senão ele estala na troca de nível.

Três armadilhas, e as três são de contrato, não de estética:

- **O relevo tem que entrar em `heightAt`, não só na malha.** Rua, peça, poste,
  árvore e câmera pousam em `heightAt` / `superficieAt`. Relevo que existe só na
  malha desenhada faz tudo flutuar ou afundar.
- **O relevo é ZERO sob superfície pavimentada.** `vias.ts` já expõe a consulta
  de "cai sobre pista, sarjeta ou calçada"; ela vira máscara do relevo. Asfalto
  ondulado é defeito, não detalhe.
- **Mexer na altura move o mundo.** O cabeçalho de `terrain.ts` já avisa. Com
  amplitude de 12 cm e máscara sobre o pavimento, nada enquadrado à mão deveria
  se mover de forma visível, mas isso **se confere**, com a varredura dos 17
  enquadramentos do portão, e não se assume.

### BLOCO B. A seção da via em corte de verdade

Tudo dentro de `vias.ts`, sem material novo (a cor já vai por vértice):

1. **Abaulamento de 2%** na pista, do eixo para a sarjeta. É o que faz a rua ter
   água e ter sentido, e aparece na reflexão do sol rasante.
2. **Sarjeta em V** de 30 cm, entre a pista e a face do meio-fio.
3. **Face de meio-fio de 15 cm com chanfro**, desenhada como face vertical e não
   como degrau de fita. Sem ela não há sombra de contato para a cascata pegar.
4. **Rebaixamento nas esquinas e nas travessias**, com a rampa de 1:12.
5. **Raio de concordância na esquina.** Canto vivo é a assinatura de loteamento
   gerado por computador, e é o que mais denuncia a cena de cima e de perto.
6. **Junta de dilatação na calçada**, a cada 1,5 m, como decalque (Bloco C), não
   como geometria.

### BLOCO C. O sistema de decalque de chão

O que hoje não existe, e o que mais especificidade compra por triângulo.

**Técnica, já medida nesta casa:** não é decalque projetivo. `lotes.ts` mediu as
três alternativas e o veredito está escrito lá: decalque projetivo custa 30,03 ms
por peça, atlas de textura pede 1,24 gigatexel, e o quad instanciado com desenho
no fragmento custa 0,47 a 0,66 ms. **É o quad instanciado.** O módulo morto vira
o motor deste bloco.

- Um atlas único de 2048², 4x4 células de 512², **um material, uma chamada**.
- Quad a +2 cm do chão, seguindo `heightAt`, orientado pelo gradiente local.
- Colocação determinística por hash da célula de mundo: estável entre sessões,
  nada para armazenar, nada para carregar.
- Orçamento: **20.000 decalques** dentro do anel de detalhe, 2 triângulos cada,
  40.000 triângulos e 1 chamada. Refeito por passo de câmera, como o poste.

**O catálogo, e ele é lunar, não terrestre.** Aqui a direção de arte tem que
resistir ao reflexo de copiar rua de cidade: na Lua não há chuva, não há erosão
de vento e não há mato na junta. Some da lista: poça, musgo, mancha de água,
folha seca. Entra o que aquele chão de fato faria:

- remendo de pavimento com borda irregular e junta de execução
- junta de concretagem da calçada e trinca de retração
- tampa de poço, grelha de boca de lobo, caixa de inspeção
- poeira de regolito acumulada no pé do meio-fio e na sarjeta, sempre do lado
  contrário ao fluxo de circulação
- rastro de pneu de rover e trilha de pisada nos atalhos que a teia não previu
- ejecta clara em volta das crateras pequenas, que é como a Lua marca o chão
- pintura de faixa desgastada, gasta na trilha de roda e inteira no acostamento

### BLOCO D. A borda e a cobertura de solo

O que denuncia a cena a 1,7 m é a **linha limpa demais** entre asfalto, calçada e
regolito. Dois sistemas, os dois só dentro do anel:

1. **Faixa de transição**, por cor de vértice na borda da fita de via mais o
   decalque de poeira do Bloco C. Sem geometria nova.
2. **Pedregulho instanciado**, 8 a 20 triângulos, colocação por hash, densidade
   caindo com a distância do meio-fio. É a versão lunar da forração, e é o que
   dá pé ao chão. Nas praças e jardins, onde há abóbada e verde, entram cartões
   cruzados de grama pelo mesmo mecanismo.

### BLOCO E. Sombra em cascata e contato

Três cascatas sobre o mapa que já existe:

| cascata | alcance | texel a 2048 |
|---|---|---|
| 0 | 0 a 60 m | 2,9 cm |
| 1 | 60 a 400 m | 16,6 cm |
| 2 | 400 a 2.000 m | 78,1 cm |

De **3,1 m para 2,9 cm** debaixo da câmera. É a maior mudança de imagem
disponível na cena inteira, e com a câmera de rua no critério ela deixa de ser
opcional.

Custo: três renderizações de sombra no lugar de uma. Mitigação, e a máquina para
isso já está pronta em `perf.ts`: só a cascata 0 atualiza por quadro; 1 e 2 usam
o mesmo `shadowEvery` que o `FrameGovernor` já governa.

Junto: **`castShadow` volta no mobiliário perto**. Hoje a maioria está com sombra
própria desligada por custo, e por isso banco, poste e guia flutuam. Dentro do
anel eles projetam; fora, não.

### BLOCO F. O orçamento, recuperado antes de gastar

Sem isto, A + C + E dão cidade a 15 fps.

1. **O teto de material nunca foi imposto.** `plano-diretor.md` fecha o plano em
   cerca de 16 materiais; a cena compila 228 na vista de topo e 318 na rasante.
   A causa está mapeada: cada material de cada GLB vira um `InstancedMesh`
   próprio em `props.ts`. O conserto é atlas por família mais cor por instância,
   e ele paga o Bloco A inteiro.
2. **O tecido sem frustum e sem culler.** `frustumCulled = false` e não
   registrado: desenhado em toda vista, inclusive de costas. No modo `obra` isto
   pesa menos, mas a peça de programa continua entrando.
3. **Impostor além de 900 m**, previsto no plano diretor e nunca feito. Com o
   anel de detalhe declarado, ele passa a ter endereço.
4. **Atlas de textura**: 35 a 82 texturas por vista hoje.

### BLOCO G. Limpeza, para o plano não brigar com o repositório

- `lotes.ts` deixa de ser módulo de demarcação e vira o motor de decalque do
  Bloco C, com o cabeçalho reescrito. Se o Bloco C não for feito, ele **sai**:
  módulo exportado que ninguém importa é dívida disfarçada de opção.
- `maquete-spec.md` seção 2 (chão e lote) fica obsoleta na parte de lote, e a
  tarja tem que dizer isso, senão a próxima rodada reimplanta a divisa.
- `@react-three/fiber`, `drei` e `postprocessing` saem do `package.json`: não
  podem ser usados neste repositório e são peso morto.

---

## 4. A ordem

| # | Bloco | Por que aqui |
|---|---|---|
| 1 | **0** Portões | Quatro enquadramentos de 1,7 m e quatro custos. Sem eles todo número abaixo é chute. |
| 2 | **F** Orçamento | Abre o espaço que A, C e E vão ocupar. Teto de material primeiro. |
| 3 | **E** Cascata | Um item, a maior mudança de imagem, independente de todos os outros. |
| 4 | **A** Terreno fino | O destravamento. Depois dele B, C e D têm onde acontecer. |
| 5 | **B** Corte de via | Depende de A: abaulamento e sarjeta sobre malha de 59 m não se leem. |
| 6 | **C** Decalque | Depende de B: a junta e a sarjeta suja precisam da seção existir. |
| 7 | **D** Borda e solo | Fecha o contato entre os três materiais. |
| 8 | **G** Limpeza | Junto com C, quando `lotes.ts` mudar de emprego. |

## 5. Critérios de aceite

- **Seis chapas**, as mesmas do Bloco 0, lado a lado com a base de hoje.
- **A 1,7 m**: o meio-fio tem face, sombra e pé; a sarjeta tem sujeira do lado
  certo; a calçada tem junta; a esquina tem raio; o chão tem relevo que a luz
  rasante revela; nenhuma linha entre dois materiais é reta e limpa.
- **A 50 m**: a teia continua legível, o ritmo de quadra continua, e nenhuma
  leitura gráfica se perdeu para o micro-detalhe.
- **Quadro**: a entrada padrão não pode ficar abaixo do que mede hoje. Medido em
  aba de verdade, uma só aberta, nunca no portão sem cabeça.
- **Programas de shader**: número menor que o de hoje, não maior, apesar de todo
  o conteúdo novo. É a prova de que o Bloco F foi feito de verdade.
- **Varredura dos 17 enquadramentos** com zero erro de console, e nenhuma câmera
  enquadrada à mão deslocada pelo Bloco A.

## 6. O que este plano não faz, de propósito

Prédio, fachada, pedestre, veículo, som, colisão e modo de andar. Todos estão em
`gta5.md` e todos vêm depois. A única coisa que este plano deve a eles é **não
inviabilizá-los**: por isso o orçamento do Bloco F vem antes do conteúdo, e por
isso o anel de detalhe nasce como constante da cena e não como número solto
dentro de um módulo.
