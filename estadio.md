# O ESTÁDIO DA DOGCITY

**Estado:** planejamento aberto em 05/09/2026. Nada construído, nada reservado.
**Nome de obra:** `$DOG ARENA` (provisório, o letreiro nasce trocável de propósito).
**Decisões do fundador já tomadas (05/09):** capacidade de um assento por carteira
do snapshot; assinatura de pele de lâminas com anel de vídeo de 360 graus; o
estádio NÃO tem lugar fixo e pode ser implantado onde o projeto mandar.

---

## 1. A tese

Um estádio de 20.000 lugares é o que estava escrito (`plano-diretor.md:362`) e é
porte de clube médio. Um nome de patrocinador em cima disso vale pouco, e a
cidade tem 85.830 carteiras.

A tese que substitui isso: **a capacidade não é escolhida, é medida.** Um assento
para cada carteira do snapshot. Ninguém precisa anunciar o número antes da hora,
e o número que sair da cadeia é o número de cadeiras que o desenho tem. Cada
holder recebe assento localizado (setor, fila, número) derivado do mesmo
ordenamento que já distribui o lote, então o assento é um segundo endereço na
cidade, de graça, para quem já é dono de terra.

⚠️ **E é isso que faz o naming rights valer.** Um patrocinador não compra a
fachada de um galpão: compra o lugar onde a comunidade inteira cabe sentada, com
o nome dele na pele do prédio e no assento de cada holder.

### O que isso NÃO é

Não é anunciar número antes do snapshot. A regra da casa continua valendo
(`[[feedback_sem_numero_antes_do_snapshot]]`): contagem é saída do bloco 966.670,
não entrada de projeto. O desenho é dimensionado para a ORDEM DE GRANDEZA de
85.830 (valor vivo em `public/city/cidade.json`), e a folga está calculada abaixo.

---

## 2. A bacia, calculada e não desenhada no olho

O que separa estádio projetado de arquibancada chutada é a linha de visada. Para
cada fileira, o espelho da seguinte sai da equação

```
N1 = ((D + T) * (N + C)) / D
```

onde `D` é a distância horizontal do olho ao ponto focal, `N` a altura do olho
sobre o ponto focal, `T` a profundidade da fileira e `C` a folga de visão sobre a
cabeça de quem está na frente. `C = 90 mm` é padrão de elite; 60 mm é o mínimo
tolerado. Ponto focal adotado: a linha lateral do campo, no nível do gramado.
Altura do olho sentado: 1,20 m. Largura de assento: 500 mm.

Campo FIFA 105 x 68 m, zona livre UEFA de 6 m nas laterais e 8,5 m atrás dos
gols, primeira fila a 8 m da zona livre.

| nível | tipo | fileiras | tread | assento | piso a | recuo | projeção | sobe | inclinação | assentos |
|---|---|---|---|---|---|---|---|---|---|---|
| inferior | geral | 22 | 0,80 m | 500 mm | 1,5 m | 0 | 17,6 m | 6,3 m | 19,8 graus | 20.678 |
| club | **VIP** | 10 | 0,90 m | 560 mm | 9,7 m | 23,6 m | 9,0 m | 3,6 m | 21,9 graus | 11.142 |
| camarotes | **camarote** | 2 | 0,95 m | 600 mm | 14,9 m | 37,6 m | 1,9 m | 0,8 m | 22,3 graus | 1.728 |
| superior | geral | 39 | 0,80 m | 500 mm | 17,7 m | 45,5 m | 31,2 m | 14,2 m | 24,5 graus | 69.292 |

| nível de acesso | lugares | fração |
|---|---|---|
| **geral (arquibancada)** | 74.675 | 87,2% |
| **VIP (club)** | 9.248 | 10,8% |
| **camarote** | 1.728 | 2,0% (144 caixas de 12) |
| **total** | **85.651** | |

- **Projeção da bacia:** 76,7 m por lado. **Última fila a 32,0 m** de altura, e a
  **149 m do centro do campo** (o teto FIFA é 190 m).
- **Envelope construído: 303 x 261 m = 7,93 ha.**
- Com esplanada de 30,5 m: **364 x 322 m = 11,75 ha**, que **cabe no bloco de
  2 x 2 módulos da teia** (348 x 400 m no raio 2.756) com 36 m de sobra no arco e
  26 m na profundidade.
- Nenhuma inclinação passa de 24,5 graus, bem abaixo do teto de evacuação de 34.
- A altura do PRÉDIO é maior que a da última fila: o coroamento da pele e a
  cobertura sobem acima dela, e é isso que leva a silhueta aos 42 a 45 m.

⚠️ **A armadilha que esta conta já caiu uma vez.** Se cada anel novo recuar para
trás o quanto quiser, a fórmula devolve espelho pequeno (quem está longe precisa
subir pouco para ver por cima da cabeça de quem está na frente) e a bacia vira um
pires raso de 18 graus com a última fila longe demais do campo. Estádio de
verdade empilha o anel de cima **em balanço** sobre o de baixo: escolhe-se o
recuo, curto, e a **altura do piso é que sai da visada**. Depois se confere a
inclinação e a distância ao centro. A primeira versão desta seção tinha esse
defeito e foi refeita.

Conta em `scripts/bacia_estadio.py`, reproduzível, com os tetos conferidos no fim.

### ⚠️ A folga que resolve o problema do snapshot

Cada fileira do anel superior vale cerca de 1.880 assentos e custa **0,8 m de
projeção horizontal**. Se o snapshot devolver 84.000 ou 88.000 carteiras, o
ajuste é de uma ou duas fileiras: **a planta não muda, muda a altura.** A pegada
é insensível ao número final, e é exatamente por isso que dá para reservar a
terra antes de conhecer o número.

### Escoamento (Green Guide, SGSA)

82 pessoas por metro por minuto em piso plano. Esvaziar 85.830 pessoas em 8
minutos exige **130,8 m de largura total de portão**. A esplanada de 30,5 m
escoa 2.501 pessoas por minuto e é a mesma medida que o `plano-diretor.md:394` já
adotou para o programa esportivo. Portanto: 8 portões de 16,4 m, um por setor da
esplanada, e nenhum deles pode dar para rua sem calçada.

### Os três níveis de acesso, que são três estádios sobrepostos

Decisão do fundador (05/09): o estádio nasce com hierarquia de acesso do mundo
real. Isso não é etiqueta de assento, é **circulação separada**, e é o que separa
estádio de verdade de arquibancada com nome.

| | geral | VIP (club) | camarote |
|---|---|---|---|
| assento | 500 mm, tread 0,80 | 560 mm, tread 0,90 | 600 mm, tread 0,95 |
| entrada | esplanada e catraca, 8 portões | lobby próprio com elevador | acesso dedicado, elevador direto |
| circulação | concourse do anel, quiosque | concourse próprio com restaurante | corredor de serviço atrás das caixas |
| onde fica | anel inferior e anel superior | anel intermediário, na linha do meio de campo | faixa contínua acima do club |
| quantos | 74.675 | 9.248 | 144 caixas de 12 |

O camarote fica **entre** o club e o anel superior, e é ele que empurra o anel
superior para cima. Por isso a hierarquia entrou agora e não depois: ela muda a
seção da bacia, não a pintura dos assentos.

⚠️ **A distribuição é decisão posterior, mas tem uma armadilha conhecida.** Se o
critério de quem senta onde for saldo puro, os 144 camarotes vão para as 144
maiores carteiras, e boa parte delas é exchange: a hot da Kraken, a custódia da
Bitget, a hot da Gate. Camarote de honra para carteira de corretora é o pior
resultado possível. Qualquer critério de distribuição precisa passar pelo
programa de rótulos antes.

Critérios possíveis, a decidir depois do snapshot: antiguidade da carteira (a
mesma regra que já distribui o lote), saldo com exchanges excluídas, coorte do
airdrop, posse de DSC, ou combinação. O desenho não depende dessa escolha; só as
proporções acima dependem.

---

## 3. A assinatura: pele de lâminas e anel de vídeo

A linha é a do Bernabéu de 2024: **envelope contínuo de lâminas metálicas
verticais que envolve a bacia inteira**, estrutura escondida, e por dentro um
anel de LED de 360 graus no parapeito do primeiro anel.

Por que esta e não a treliça exposta tipo Ninho:

1. **O letreiro precisa de casa.** Numa cesta de vigas entrelaçadas o nome do
   patrocinador só pode ser pregado, e nome pregado lê como banner de evento. Na
   pele de lâminas o nome É a pele: as lâminas mudam de cor, de ângulo e de
   iluminação, e o letreiro superior nasce integrado ao coroamento.
2. **Custo de triângulos.** A lâmina é uma peça só, instanciada algumas centenas
   de vezes ao longo do perímetro, com LOD trivial. A treliça entrelaçada é
   geometria irredutível e a cena já gasta 2,1 milhões de triângulos só na casca
   da abóbada em perfil high (`perf.ts:86-88`).
3. **A silhueta é lida de longe.** Volume limpo e monolítico a 46 m de altura,
   com o coroamento aceso, é o que se enxerga do bulevar a 2 km. Renda estrutural
   vira ruído nessa distância e some no LOD.

### ⚠️ O letreiro é um contrato, não uma textura

O nome do patrocinador precisa nascer como **slot**, nunca assado na malha:

- geometria própria, ancorada no coroamento, com caixa de medida fixa;
- o texto entra por atlas de letras ou por textura de canal único, trocável sem
  reexportar o GLB;
- a pele tem uma cor de marca parametrizada, para "Kraken Arena" ficar roxo e
  "BitFlow Arena" ficar laranja sem mexer no modelo;
- enquanto não houver patrocinador, o slot mostra `$DOG ARENA`.

Se isso não for feito no primeiro dia, a primeira venda de naming rights vira
remodelagem.

---

## 4. Implantação

O estádio não tem lugar fixo, então o sítio foi PROCURADO em vez de herdado.
Método: varredura do heightmap real do Mare Tranquillitatis
(`public/lunar/btc-core-heightmap.f32`, 429 x 429, célula 59,2 m) em janelas de
415 m, exigindo simultaneamente

1. desnível menor que 12 m dentro da janela inteira;
2. raio entre 2.100 e 3.600 m, faixa onde o bloco de 2 x 2 módulos da teia tem o
   tamanho certo (`teia.ts:32`: vão de 180 m entre anéis, passo angular de 2 em
   168 radiais);
3. folga de 80 m de qualquer peça do programa (121 obstáculos: as 70 vivas de
   `cidade.json` mais as 51 congeladas) e de 250 m de qualquer corpo d'água;
4. 900 m de distância do Coliseu congelado.

**478 janelas passaram.** As seis melhores, pontuadas por proximidade de bulevar,
planicidade e raio urbano:

| # | desnível | x | z | raio | rumo | ao bulevar | bloco 2x2 | vizinho mais próximo |
|---|---|---|---|---|---|---|---|---|
| **1** | **7,8 m** | **2428** | **1303** | **2.756 m** | **118,2 graus** | **1,8 graus** | 348 x 400 m | 119 m do Parque Central e Lago Maior |
| 2 | 7,0 m | 2724 | -1303 | 3.020 m | 64,4 graus | 4,4 graus | 348 x 440 m | 804 m da Central de Distribuição 4 |
| 3 | 10,3 m | -1481 | -2547 | 2.946 m | 329,8 graus | 0,2 graus | 348 x 429 m | 253 m do Memorial do DOG Perdido |
| 4 | 8,4 m | 1244 | -2547 | 2.834 m | 26,0 graus | 4,0 graus | 348 x 412 m | 994 m da Central de Distribuição 1 |
| 5 | 6,6 m | 2665 | -2014 | 3.340 m | 52,9 graus | 7,1 graus | 348 x 488 m | 1.423 m da Central de Distribuição 4 |
| 6 | 7,6 m | 474 | -2665 | 2.707 m | 10,1 graus | 10,1 graus | 348 x 393 m | 539 m da Central de Distribuição 1 |

**DECIDIDO pelo fundador em 05/09: o sítio 1.** Fica a 1,8 grau do bulevar de 120 graus (ou seja,
tem avenida de chegada pronta), a 2,76 km da praça (o Bernabéu está a 5 km da
Puerta del Sol; o Camp Nou a 4 km do centro de Barcelona), o bloco de 2 x 2
módulos entrega 348 x 400 m para um envelope que precisa de 366 x 324, e o
terreno varia 7,8 m em 415 m, que a saia padrão da casa resolve sem pódio.

E tem o argumento que nenhum dos outros tem: **fica a 119 m do Parque Central e
do Lago Maior.** Fachada de lâminas acesa refletida na água é o cartão-postal
noturno da cidade, e a esplanada do estádio e o parque viram uma coisa só nos
dias de jogo.

⚠️ **Coordenação obrigatória:** a frente de água está sendo trabalhada por outra
frente agora. A borda leste do Lago Maior e a orla do parque são dela. Este plano
não desenha um metro de orla; ele pede apenas que a esplanada do estádio pare a
119 m e que as duas frentes conversem antes de qualquer traçado de margem.

Se a coordenação não for possível a tempo, **o sítio 2 é a alternativa limpa**:
804 m livres de qualquer coisa, desnível 7,0 m, e nenhuma interferência com água.

### O que cada sítio custa, medido no registro de lotes

Contado em `data/dogcity_lotes.csv` (85.830 lotes), dentro do envelope de
366 x 324 m:

| | sítio 1 (colado ao parque) | sítio 2 (limpo) |
|---|---|---|
| lotes dentro do envelope | 161 | 164 |
| terra desses lotes | 2,92 ha | **7,30 ha** |
| DOG desses lotes | 72,2 M | **152,7 M** |
| coortes atingidas | 4 e 5 (recentes) | **1 e 2 (as antigas)** |
| lote mais antigo atingido | ordem 48.297 | **ordem 11.885** |
| lotes a menos de 600 m | 1.613 | 1.350 |

⚠️ **O sítio "limpo" é o mais caro dos dois.** Ele estava limpo de PEÇAS do
programa, não de gente: cai em cima do bairro antigo, onde os lotes são maiores
porque a regra de idade põe as carteiras velhas perto da praça. Mesmo número de
lotes, o dobro de terra e o dobro de DOG.

⚠️ **E ninguém é removido em nenhum dos dois casos.** Como o mint ainda não
aconteceu, o gerador roda de novo e as carteiras se distribuem no terreno
restante (`masterplan.md:268`). Não existe lote demolido, existe lote que nunca
foi plantado ali. É exatamente por isso que a reserva precisa entrar antes do
snapshot, e é a única razão pela qual isto ainda é de graça.

Somando ao dia de jogo: no sítio 1 as 85.830 pessoas saem para uma esplanada que
continua dentro de um parque de 86,9 ha, que absorve a multidão. No sítio 2 elas
saem para ruas residenciais de holders antigos por todos os lados, que é o
problema clássico do estádio urbano mal implantado.

⚠️ **O estádio não encosta na água.** O envelope para a 126 m da borda do parque,
e a lâmina do Lago Maior está mais para dentro dele. Este plano não desenha um
metro de orla, e não conflita com a frente de água por geometria, só por vizinhança.

### Estacionamento, que é o motivo de o parque ajudar

Dimensionado com honestidade, e não com otimismo:

| premissa | vagas | de superfície | em silo de 5 pavimentos |
|---|---|---|---|
| 30% vem de carro, 3 por carro | 8.756 | 21,9 ha | 4,4 ha |
| 15% vem de carro, 3 por carro | 4.378 | 10,9 ha | 2,2 ha |

21,9 ha de asfalto é um quarto do Parque Central, e estádio cercado de
estacionamento vazio 350 dias por ano é o erro urbano clássico. A saída é a que
os estádios bons usam:

1. **Silo sob a esplanada**, 2,2 ha de pegada em 5 pavimentos, que some do
   desenho porque fica enterrado.
2. **Campo de eventos na borda do parque**, gramado reforçado que é parque no dia
   comum e estacionamento no dia de jogo. É isso que o vizinho parque entrega de
   graça e que o sítio 2 não tinha.
3. **Estação de metrô própria**, já prevista no programa da cidade, porque
   nenhuma das duas resolve 85 mil pessoas sozinha.


### ⚠️ O prazo é de bloco, não de calendário

`masterplan.md:268` é a regra de ouro: equipamento vira zona reservada no gerador
ANTES da atribuição de lotes, e nenhum lote se move. `fundacao.md:112` diz o que
acontece se não for feito: "sem essa reserva o estádio não cabe mais depois sem
demolir lote de holder".

Hoje **não existe reserva nenhuma** do estádio de futebol. Não é código, não é
dado gerado, é uma linha de texto em duas tabelas. O que existe em geometria é o
E01 Parque Olímpico, que tem um estádio de atletismo dentro, e o E02 Hipódromo.

Tip em 965.630, snapshot em 966.670: **1.040 blocos, cerca de 7 dias.**

**A assimetria que resolve isso:** depois do congelamento, aumentar a pegada
colide com lote atribuído, mas **reduzir é seguro**, porque só devolve terreno ao
estoque. Logo a decisão certa agora não é desenhar o estádio, é **reservar
generoso e desenhar depois**: um bloco de 2 x 2 módulos no sítio escolhido, com a
esplanada inteira, e a liberdade de encolher quando o desenho fino ficar pronto.

---

## 5. O acervo, e o que ele não tem

Varredura do Sketchfab com o filtro de licença da casa (CC0 e CC-BY entram;
CC-BY-SA, NC e ND não entram). **Estádio inteiro pronto em nível de obra-prima
não existe no acervo livre.** O que existe é fotogrametria pesada de estádio real
de marca (Azteca, Acrisure, Narendra Modi, Olympiastadion), que traz junto a
identidade de outro clube, 1 a 3 milhões de faces e buracos de malha de drone, ou
low poly de jogo mobile com 900 faces. Nenhum dos dois serve.

**Portanto a bacia é obra própria e paramétrica**, gerada pela mesma conta de
linha de visada da seção 2. O acervo entra no verticalzinho, que é justamente o
que faz a leitura de escala (a lição já medida em `loteamento.md:568`: o refletor
de 42 m é a silhueta que faz um campo virar estádio).

| uso | modelo | autor | faces | uid |
|---|---|---|---|---|
| assento em fileira | Low poly stadium/sports arena seats | anDDDres | 3.880 | `6bbe4c85d2a4489dbe5918831be5d886` |
| assento avulso | Aggie Stadium Chair | joshua.mckimmey | 80 | `b0607a5e412043e399745703be24a33a` |
| assento VIP e imprensa | Cinema Seat | connorwassall | 1.496 | `6c44adbc299c4f8ab45e9913d58cfcba` |
| treliça de cobertura | AH Roof Truss | sfs_ltd | 5.136 | `7871cb9fb1bb4c2fba77e0d584ba88cb` |
| membrana tensionada | Tensile fabric | Higbea | 3.000 | `tyEqMjqWWmJnysPm64pBQDrpcBC` |
| guarda-corpo | Handrail Circle | Dreadler | 936 | `12432631aad6455786016ae843db911f` |
| catraca | Subway Turnstile | gunnarcorrea | 1.872 | `eed7f05ffcff4251a3f1cbef98342093` |
| bilheteria | Ticket booth | gemmaballesteros | 11.408 | `8ff9678d9c534855bd9ce70ed3591931` |
| quiosque de concourse | Food kiosk props | EnotoButerbrodo | 37.316 | `d16b8a7ad3224b0ba11ad64f9423dc60` |
| trave com rede | Soccer Goal | TepidGames | 21.236 | `10d30382596a43f29e569fbe26e3966d` |
| banco de reservas | BENCH 3 LOW POLY | oobexr | 6.240 | `1ef3be3538c1495189e2f1f175c7c573` |
| torcedor genérico | Proportional Low Poly Man | StarTrekGuy | 472 | `0bfd0e2b49a348a4b64b20cc8196e3b3` |
| bloco de torcida animada | Low Detail Animated Crowd | shahriyarshahrab | 10.254 | `4fe76fdec12d456f9b0db06b45cc53d6` |
| torcedora sentada | Spectator Girl Free | Ilya.Anchouz.Dan | 1.194 | `6882f8b3a9f74180bbb3575c0949898e` |
| refletor | Low Poly Reflector | AstorMilanese | 2.224 | `920292e13f6445db8c66cd62cdf13755` |
| torre de holofote | Stadium Light | thundermind | 67.482 | `425625d154084a29a194dd2b0bb52fd5` |

Todos CC-BY, todos com crédito obrigatório em `app/city/plaza/sf-assets.ts` **no
mesmo commit do download**, nunca depois.

**Lacunas que teremos de modelar:** membrana translúcida de verdade (o acervo só
tem tecido opaco), a casca paramétrica do anel superior, catraca de estádio (só
existe de metrô), câmera de transmissão leve, faixa de LED de perímetro de campo
e a rampa monumental de acesso ao anel superior.

Primeiros três a baixar: assento em fileira, treliça de cobertura e bloco de
torcida, nessa ordem.

---

## 6. ⚠️ O orçamento de triângulos, e a regra do assento

Medido: **assento nunca pode ser malha por assento.**

| hipótese | custo |
|---|---|
| 85.830 assentos x 12 triângulos (cubo) | 1,0 M tri, já pesado |
| 85.830 assentos x 40 triângulos | 3,4 M tri, inviável |
| 85.830 assentos x 3.880 faces (o modelo do acervo) | 333 M tri, absurdo |

A cena inteira gasta 2,1 M de triângulos na casca da abóbada em perfil high e
carrega 214.322 instâncias a 37 fps, com folga medida de 28,6%
(`plano-diretor.md:236`). Portanto a regra:

1. **A bacia é geometria de degrau**, algumas dezenas de milhares de triângulos
   no total, com a cor dos assentos e o mosaico da torcida entrando por
   **textura** (cor mais normal), nunca por objeto.
2. O assento do acervo aparece **só no anel visitável de perto**, por
   `InstancedMesh` limitado ao setor dentro do `smallCull`.
3. A torcida é impostor de bilhete, animada por atlas, e o bloco animado do
   acervo entra apenas nos setores próximos da câmera.
4. A pele de lâminas é uma peça instanciada ao longo do perímetro, com LOD1
   trocando lâmina por faixa lisa além do `lodDistance`.
5. Teto proposto para a peça inteira em perfil high: **250 mil triângulos**, que
   é 12% do que a casca já custa. Se o desenho não couber nisso, ele encolhe.

---

## 7. O que a Lua muda, e o que ela não muda

- **Não muda o campo.** 105 x 68 m é herança da Terra e é o que faz o estádio ser
  reconhecível na primeira olhada. Um campo "corrigido para 1/6 g" seria seis
  vezes maior em área, não caberia em módulo nenhum e ninguém entenderia a
  imagem.
- **Muda a estrutura.** Com 1,62 m/s2 o mesmo vão pede muito menos massa, e é
  isso que autoriza um coroamento fino e um balanço de cobertura que na Terra
  exigiria treliça grossa. A esbeltez é o detalhe lunar, e ela aparece na
  silhueta sem precisar de legenda.
- **Não entra na cena:** radiação, gás, incêndio ou qualquer vocabulário de
  perigo. Decisão do fundador, vale aqui igual (`[[feedback_dogcity_virtual_estetica]]`).
- **Cobertura:** sob a abóbada não há chuva nem vento, então a cobertura existe
  por desenho, sombra e acústica, não por proteção. Ela cobre 100% dos assentos e
  abre sobre o campo, que é o padrão de elite da UEFA e também o que deixa o
  gramado visível de cima, que é como a cena mais é vista.

---

## 8. Fases

| fase | entrega | depende de |
|---|---|---|
| **0. Reserva** | bloco de 2 x 2 módulos no sítio escolhido entra no gerador como zona reservada, generosa, antes do snapshot | decisão de sítio, e só isso |
| 1. Acervo | baixar os 3 primeiros modelos, converter, creditar em `sf-assets.ts` | fase 0 não bloqueia |
| 2. Bacia paramétrica | gerador da bacia por linha de visada, em Three.js puro, com os 3 anéis e o teto de 250 mil triângulos | fase 1 |
| 3. Pele e letreiro | lâminas instanciadas, slot de nome, cor de marca parametrizada, anel de vídeo | fase 2 |
| 4. Esplanada e acessos | 8 portões de 16,4 m, catracas, bilheterias, ligação ao bulevar de 120 graus | fase 2, e conversa com a frente de água |
| 5. Vida | torcida por impostor, refletores, placar, faixa de LED, dia de jogo | fase 3 |
| 6. Assento do holder | consulta que devolve setor, fila e número de cada carteira, ligada ao registro do lote | snapshot |

⚠️ **A fase 0 é a única com prazo de bloco.** Todas as outras podem acontecer
depois do mint sem risco nenhum, porque encolher é seguro e crescer não é.

---

## 9. Decidido e aberto

**Decidido (05/09):**

2. **A reserva entra com o bloco inteiro de 2 x 2 módulos.** No sítio escolhido
   isso dá 348 x 400 m contra um envelope com esplanada de 366 x 324 m, ou seja
   34 m de sobra no arco e 24 m na profundidade. Encolher depois é seguro.
3. **O assento do holder é público desde o dia 1.** Não adiciona exposição
   nenhuma: o registro de lotes já publica endereço e posição, e o assento é
   derivado da mesma ordem de chegada. Em compensação libera o que só existe se
   for público: quem senta do seu lado, setor por coorte, mapa da torcida por
   família de carteira. Assento privado seria um número sem uso.

1. **Sítio 1, colado ao Parque Central e ao Lago Maior.** Custa menos terra de
   holder, atinge coortes recentes em vez do bairro antigo, e ganha o parque como
   praça de escoamento e campo de estacionamento de dia de jogo.
4. **Três níveis de acesso**: geral, VIP e camarote, com circulação separada.

**Aberto:**

1. **O critério de distribuição dos níveis**, depois do snapshot, passando pelo
   programa de rótulos para que camarote não caia em carteira de exchange.
2. **Coordenar com a frente de água** a vizinhança de 126 m com o parque.

---

## 10. Fase 0, executada em 05/09/2026

**A reserva está declarada.** Peça `E03`, nome de obra `$DOG ARENA`, tipo
`esporte`, gravada em dois lugares:

1. `scripts/gerar_cidade.py:1270`, na lista `PROGRAMA_MALHA`, como
   `('E03', '$DOG ARENA', 'esporte', 38, -6, 14, 3, 2)` (setor, ix, iz, w, h em
   células de 180 m), que é a fonte legível da decisão;
2. `data/dogcity_programa_congelado.json`, que é o arquivo que o gerador de fato
   lê antes de plantar lote (`gerar_cidade.py:1426`) e portanto é o que reserva
   terra de verdade.

| | |
|---|---|
| centro | (2398,4 ; 1481,2) |
| raio e rumo | 2.819 m, 121,7 graus |
| tamanho | 540 x 360 m = **19,44 ha** |
| rotação | 285 graus, 16,7 graus de desalinho da tangente local |
| terreno | desnível de **8,8 m** em 540 m |
| vizinho | **20 m** do Parque Central e Lago Maior |
| colisão | **nenhuma**, testada contra as 121 peças com retângulos girados |
| folga sobre o envelope | 176 m e 38 m além dos 364 x 322 com esplanada |
| lotes a replantar | **344** (8,20 ha, coortes 4 e 5) |

O estádio entra girado 90 graus dentro da reserva: o envelope de 364 m vai no
lado de 540 e o de 322 no lado de 360.

⚠️ **Nenhum holder perde lote.** Os 344 lotes que hoje caem ali são replantados no
terreno restante quando o gerador rodar, porque nada foi mintado. É a regra de
ouro funcionando (`masterplan.md:268`), e é por isso que fazer agora custa zero.

### ⚠️ O que FALTA, e é o único passo com prazo de bloco

A reserva está declarada mas **ainda não materializada**: os 344 lotes só saem
dali quando `python3 scripts/gerar_cidade.py` rodar inteiro. E aí está o
conflito: o gerador reescreve `public/city/cidade-malha.json`, que grava
**lagos, canais e a baía** (`gerar_cidade.py:3468` e `:3477-3489`), e há outra
frente trabalhando em corpos d'água agora. Rodar sem combinar sobrescreveria o
trabalho dela.

Portanto a rodada do gerador precisa ser **combinada com a frente de água e
acontecer antes do bloco 966.670**. A reserva já está escrita e versionada, então
quem rodar por último leva o estádio junto, seja quem for.

### ⚠️ Armadilha achada aqui: `DUMP_PROGRAMA=1` move as peças de borda

O caminho óbvio para gravar a peça nova seria acrescentar a linha na lista do
`.py` e rodar `DUMP_PROGRAMA=1`, que regrava o congelado a partir das listas.
**Não faça isso.** Medido: além de acrescentar o E03, ele mexeu em **48 campos de
peças já existentes**, porque as 16 peças de borda passam por
`assenta_no_cinturao()` a cada regravação e o contorno mudou desde que elas foram
congeladas. A B02 saltou de rumo 118 para 92 graus, a B15 andou quase 2 km.

O jeito certo, e o que foi feito: gerar a peça nova com o dump, restaurar o
congelado do backup, e **inserir só a peça nova no JSON**. Conferido depois:
51 peças viraram 52, com **zero campos alterados** nas 51 antigas.

---

## 11. O modelo, 05/09/2026

`blender/build_estadio.py`, rodando com `blender -b -P blender/build_estadio.py`.
Sai em `public/city/dog-arena.glb` (192 KB, Draco) e em `blender/dog-arena.blend`.

**71.692 triângulos**, contra o teto de projeto de 250.000 e contra os 2,1 milhões
que a casca da abóbada já gasta sozinha em perfil high.

⚠️ **A geometria não é desenhada no script.** As 73 fileiras vêm de
`scripts/bacia_estadio.py`, que as calcula pela linha de visada. Modelo e
documento consomem a mesma fonte, então não existe estádio bonito contradizendo a
planta.

O que está no modelo: bacia de 4 níveis com assento em relevo e mosaico por
setor, escadas de arquibancada, parapeitos, faixa de camarotes envidraçada,
cobertura de 77 m de balanço com anel de tração, vigas radiais, nervuras e uma
faixa de ETFE translúcido junto à abertura, pele de brise sobre parede contínua,
8 portões de 16,4 m com marquise, painel e letreiro trocável, campo com marcação
FIFA e listras de corte, esplanada de 30,5 m e postes de 11 m.

### As cinco armadilhas medidas na modelagem

1. **Sem relevo de assento a arquibancada lê como rampa.** Com o degrau liso a
   bacia inteira virou uma rampa creme e o estádio perdeu escala. Cada fileira
   precisa de piso mais banco contínuo, e é o listrado do banco que diz que ali
   senta gente.
2. **Vomitório modelado como sólido vira cubo boiando.** As caixas escuras
   ficaram flutuando sobre os degraus. O que dá ritmo a uma aérea de estádio é a
   escada, não o buraco.
3. **Escada de largura "um segmento do anel" sai com 60 m.** O contorno tinha um
   único segmento em cada lado reto, então a escada era o lado inteiro na reta e
   4 m no canto. Largura em metros, e lados retos subdivididos.
4. **Lâmina solta não é pele, é cerca de palito.** Com 1,35 m de vão via-se a
   estrutura interna de fora e o prédio ficava oco. A pele é parede contínua com
   o brise na frente, que é como o Bernabéu resolve.
5. **Viga horizontal atravessa cobertura inclinada.** Caixa na altura média
   aparece por cima da membrana como espinho. Barra que segue a inclinação.

Duas de calibragem, que valem para qualquer peça desta casa: **letra de 11 m não
cabe em faixa de 4,2 m** (o nome saiu ilegível no coroamento e foi para a pele,
onde o patrocinador quer mesmo), e **três cremes a menos de 8% de luminância um
do outro não são mosaico** (a bacia leu como uma cor só até os tons ganharem
degrau de valor).

### O que falta para o nível final

Torcida (o modelo de bloco animado do acervo falhou na conversão), iluminação
noturna com a pele acesa, entorno com o parque e a esplanada tratados, assentos
do acervo instanciados no anel de perto, e o mosaico escrevendo a marca em vez de
apenas alternar tons.
