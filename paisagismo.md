# Paisagismo da DogCity

Projeto de arborização viária e dos dois jardins temáticos, escrito antes do código, como pede
um projeto de paisagismo de verdade: primeiro a hierarquia da via, depois a espécie, depois o
código. Autoria: frente Paisagismo, 03/09/2026. Tudo aqui é gate por `?verde=1`; sem a bandeira
a cidade continua exatamente como estava.

Método: nenhuma medição de tela nesta rodada (regra da casa). Todo número de cidade citado aqui
saiu de arquivo lido direto: `public/city/cidade.json`, `public/city/cidade-malha.json`,
`scripts/gerar_cidade.py`, `plano-diretor.md` e os `.ts` de `app/city/plaza/`. Onde a fonte é
uma referência de paisagismo real (Barcelona, Paris, Portland, Seattle, NYC, Singapura,
Curitiba), a referência está nomeada. Onde eu escolhi um número sem fonte externa (um
espaçamento, uma proporção de mistura), digo que é escolha, não medição.

---

## 0. O que existe hoje, e o que este documento muda

A cidade tem duas camadas de arborização, e as duas continuam:

1. **A arborização procedural de massa** (`arborizacao.ts` + `especies.ts`): 4 silhuetas de
   árvore de baixo custo (esfera/Alameda, cone/Conífera, copada/Guarda-chuva, colunar/Colunar),
   um material só, plantadas ao longo das 12 avenidas, dos 7 anéis e (opcional, `?arvcont=1`) da
   malha local. Medido antes desta mudança (`gta5.md`, `arborizacao.ts`): **20.756 mudas**, 8
   "espécies" contadas num levantamento anterior que na verdade eram a mistura de 3 silhuetas
   procedurais mais os modelos reais dos jardins da Praça Central (a contagem de "8" não é a
   dela hoje: o levantamento é de antes da colunar entrar, e a base viva agora é 4 silhuetas
   procedurais mais os modelos reais de `props-table.ts`).
2. **Os jardins curados da Praça Central** (`props-table.ts` + `garden-plan.ts`, r < 900 m):
   quatro jardins temáticos já existentes (White Paper a NE, Espelho de Satoshi a NW, Jardim
   Ordinal a SW, Pata de Diamante a SE), cada um com árvore real (GLB), não procedural.

O que faltava, e é o assunto deste documento: **a mistura de espécie nas avenidas e nos anéis
era uniforme** (toda avenida igual, todo anel igual, 100% conífera até 02/09), a **malha local
não tinha nenhuma árvore** (nem contorno de quarteirão, nem travessa), os **6 distritos e as 4
bandas do plano diretor não tinham leitura própria nenhuma**, e **não existia jardim japonês
nem tropical**. As seções abaixo cobrem os quatro pontos, nessa ordem.

### 0.1 O defeito de primeira ordem: o sage chapado

Achado depois da primeira versão deste documento, e tratado como prioridade sobre o resto: as
quatro silhuetas procedurais (esfera, cone, copada, colunar) tinham pigmento de base da MESMA
família de verde acinzentado, com esfera e copada literalmente dividindo o mesmo hexadecimal
(`COR_COPA`, `#7E8A6B`). O tinte por instância (`tintarMuda`) já existia e já variava a cidade
muda a muda, mas ele só INCLINA a cor do objeto inteiro (tronco, torrão e copa juntos) como se
fosse a luz do lugar; ele não redefine a família de matiz da copa. Contas feitas em 03/09: nos
dois extremos de qualquer tinte de qualquer espécie, a cor final sempre converge para o mesmo
par de polos (verde-azulado frio e oliva-amarelado quente), porque o tinte multiplica sobre uma
base que já era quase a mesma nas quatro. Isso é o "sage chapado" que a chapa de 1,7 m denuncia,
e é diferente de "falta de variação por muda": é falta de família de cor por ESPÉCIE.

Corrigido em `especies.ts`, atrás de `?verde=1`: guarda-chuva ganhou pigmento próprio (oliva
prateada, `#A69A5E`, não mais o `COR_COPA` da esfera), conífera desceu para um azul-esverdeado
mais frio e mais saturado (`#3E5A52`), colunar foi para o quase-preto de cipreste (`#3C4632`).
A esfera manteve seu verde-folha comum, porque ela é o fundo neutro contra o qual as outras três
aparecem (decisão já registrada no código antes desta mudança). Os quatro pigmentos antigos
continuam byte a byte iguais sem a bandeira.

---

## 1. A paleta por hierarquia viária

### 1.1 O que a cidade realmente tem (medido, não a tabela abstrata do capítulo 3)

O plano diretor (`plano-diretor.md` §3.4) descreve uma cidade em disco com Praças de Quarto e
54.432 lotes. A cidade que o gerador (`scripts/gerar_cidade.py`) realmente constrói, e que
`cidade.json`/`cidade-malha.json` publicam, é outra topologia: **6 distritos desiguais** em
**4 bandas concêntricas** (Núcleo, Meio, Bairro, Borda) mais uma Cinta industrial, com **1.862
quarteirões**. É essa cidade, a publicada, que este documento arboriza. A reconciliação de
número com o capítulo 3.4 está na seção 5.

A hierarquia viária medida, com nome, raio e largura publicados:

| Via | Quantidade | Largura | Onde nasce/corre | Papel |
|---|---|---|---|---|
| Bulevar cardinal | 4 (rumo 0°/90°/180°/270°) | **44,0 m** | r 1.420 a 6.900 m | eixo das pontes, atravessa a cidade inteira |
| Bulevar intermediário | 8 (rumo 30/60/120/150/210/240/300/330°) | **34,0 m** | r 1.420 a 6.900 m | liga distrito a distrito |
| Anel Interior (AN1) | 1 | 26,0 m, r 1.750 | Núcleo | o mais perto da praça |
| Anel Médio (AN2) | 1 | 26,0 m, r 2.750 | Meio | transição |
| Anel Exterior (AN3) | 1 | 26,0 m, r 3.750 | Bairro | a copa abre, prepara a Cinta |
| Avenida do Cinturão (AN4) | 1 | 30,0 m, r 4.450 | Borda | hardier, para de ser ornamental |
| Avenida da Doca (AN5) | 1 | 34,0 m, r 5.620 | Cinta | via portuária/industrial |
| Avenida de Escoamento (AN6) | 1 | 34,0 m, r 6.300 | Cinta | via de logística |
| Pista de Serviço (AN7) | 1 | 30,0 m, r 7.600 | borda do sítio | via de manutenção, ninguém passeia |
| Via de contorno | 1.862 quarteirões | 12,0 m | testada de todo lote | a "alameda local" do plano diretor §3 |
| Travessa | 3.031 segmentos (k=2/3/4) | 9,0 m | corta o quarteirão ao meio | a "veia verde" do plano diretor §3.2 |

Fontes: `teia.ts` (`AVENIDAS`, `avenidasGeom`), `cidade.json` (`aneis[]`, com nome), `cidade-
malha.json` (`constantes.viaContorno`, `constantes.travessa`, `constantes.travessasPorK`,
`constantes.bandas`), `scripts/gerar_cidade.py` (as mesmas constantes, na fonte).

### 1.2 O bulevar cardinal: a leitura mais disciplinada da cidade

Referência: Barcelona planta plátano (*Platanus x hispanica*) em alinhamento único ao longo de
quase todo o Eixample, e é essa repetição, não a variedade, que dá ao bulevar sua identidade
legível de ponta a ponta. Paris faz o mesmo com o marronier nos grandes boulevards. A regra
para via de maior hierarquia é: **uma espécie dominante, reconhecível do início ao fim**.

Os 4 bulevares cardinais (44 m, o eixo que atravessa o sítio inteiro e encontra as pontes) são
essa via aqui. Tratamento:

- **Calçada** (as duas fileiras a 1,07 m da guia, já existentes): **Alameda (esfera) quase
  pura**, 72% do peso, com guarda-chuva e colunar como exceção rara. É a fileira contínua que
  atravessa a cidade e dá ao cardinal sua identidade de "isto é o eixo principal".
- **Canteiro central** (4 a 5,2 m, esticado pela seção de 44 m): **Guarda-chuva (copada)
  dominante**, 48%, com colunar como acento vertical (32%) a cada trecho e conífera rara (20%).
  O canteiro cardinal é o único ponto da cidade largo o bastante para a copa de 10,1 m da
  guarda-chuva sem disputar pista; a colunar entra como o "risco" que pontua a massa, do mesmo
  jeito que um poste de luz pontua uma alameda de verdade.
- Espaçamento: **7,6 m** (25 ft, Portland, faixas de arborização viária C/CC/D/DC/F/FU),
  já adotado no código antes desta mudança e mantido.

### 1.3 O bulevar intermediário: a mesma estrutura, um porte abaixo

Os 8 bulevares de 34 m (as costuras entre distrito e distrito) recebem a mesma lógica de
calçada/canteiro, mas com canteiro mais estreito (4 m sem o alongamento da seção cardinal), o
que não cabe copada folgada. A colunar assume o canteiro (44%), a calçada ganha mais textura
(esfera 48%, copada 28%, colunar 16%, conífera 8%): é onde a variação de caráter local pode
aparecer sem quebrar a legibilidade do sistema primário, porque esta via não é o "cartão de
visita" da cidade inteira, é a costura entre dois bairros.

### 1.4 Os sete anéis: cada nome é um lugar, não a mesma via sete vezes

Até 02/09 os 7 anéis eram 100% conífera, uma via só repetida. Isso é o maior "genérico" que a
cidade tinha: os anéis somam 26.634 pontos de plantio (medido, `arborizacao.ts`, contra 25.992
das avenidas), ou seja mais da metade de toda a arborização era uma única espécie.

Cada anel tem NOME publicado (`cidade.json`), e o nome já diz a banda em que ele está:

- **Anel Interior** (Núcleo): esfera dominante (56%), quase tão disciplinado quanto o
  cardinal, porque está colado à praça e à malha mais fina.
- **Anel Médio** (Meio): a transição, esfera e copada quase empatadas.
- **Anel Exterior** (Bairro): copada e conífera dividem a liderança, a copa começa a abrir.
- **Avenida do Cinturão** (Borda): conífera dominante (56%), guarda-chuva vira acento raro.
- **Avenida da Doca** e **Avenida de Escoamento** (Cinta, industrial/portuária): conífera e
  colunar só, nada ornamental. Referência: via de serviço industrial não recebe tratamento de
  boulevard em nenhuma cidade real, o gasto de manutenção não se justifica.
- **Pista de Serviço** (a borda do sítio): conífera pura. É a única leitura honesta para uma
  via de manutenção que ninguém passeia; não há razão paisagística para gastar mistura aqui.

### 1.5 A esquina e o cruzamento: onde a árvore não pode cegar visibilidade

Regra já presente no código antes desta mudança e mantida sem alteração: **10,7 m de recuo de
esquina** (35 ft, NYC Parks) na via de contorno, e a fileira de bulevar/anel nunca entra na
caixa de 40 m das rotatórias (`noBulevar`/`noAnel`, `emViaAlheia`). Nenhuma árvore desta
hierarquia nova muda essa regra; a hierarquia decide QUAL espécie, nunca ONDE a máscara de via
já proíbe.

### 1.6 A travessa: a veia verde que hoje não existe

O plano diretor (§3.2) chama a travessa de "veia verde contínua", 217,7 km de corredor
capilar. O código de hoje planta bulevar e anel, mas **nunca planta travessa**: ela nem entra
na máscara `naVia`. Esta é a lacuna mais visível que fica de fora se eu só arrumar o que já
existe.

Tratamento (novo, atrás de `?verde=1`, seção 2 do código): **duas árvores por travessa, uma em
cada boca** (onde ela encontra a testada do quarteirão), não uma fileira dupla dentro dos 9 m.
Motivo: 9 m de largura não comporta alameda dupla sem a árvore disputar pista com pedestre; a
árvore na boca marca "isto é uma passagem", que é a leitura que o plano diretor pede
("passantes, não becos"), sem impor a densidade de um bulevar a um corredor de serviço. Espécie:
a mesma hierarquia de banda/distrito da seção 2 (dado, não espécie fixa).

**Ressalva medida**: `travessasPorK` (publicado) só define travessa para quarteirões de k = 2,
3 e 4 (Núcleo, Meio, Bairro). A banda Borda (k = 5, 519 dos 1.862 quarteirões, 27,9%) **não tem
travessa nesta malha**. Não inventei uma para ela: os quarteirões de Borda ficam sem travessa
plantada até o gerador desenhar uma.

---

## 2. Identidade por bairro: 6 distritos, 4 bandas, sem virar colcha de retalhos

A pergunta do fundador foi como dar identidade a cada bairro sem fragmentar a cidade. A
resposta tem dois eixos independentes, e cada um resolve metade do problema:

### 2.1 O eixo radial (4 bandas): formalidade decrescente do centro para a borda

Núcleo (r 1.450-2.180, quarteirão 109 m) é a malha mais fina, mais perto da praça: leitura
disciplinada, quase toda folhosa (esfera 62%). Borda (r 4.300-5.500, quarteirão 286 m) encosta
na Cinta industrial e no Parque Runestone: a mistura pende para conífera (42%), preparando o
olho para o que vem depois. Meio e Bairro interpolam. Isso é gradiente contínuo em função do
raio, não uma troca abrupta de "bairro A" para "bairro B": é assim que uma cidade real
envelhece do centro cívico para a periferia industrial, e é por isso que não lê como colcha de
retalhos.

Esta regra vale só para a **malha local** (contorno e travessa). O bulevar cardinal e os 7
anéis mantêm a MESMA leitura em toda a cidade (seção 1), porque são a estrutura primária: se o
bulevar cardinal mudasse de espécie a cada banda, ninguém reconheceria "isto é o eixo
principal" ao atravessar a cidade inteira.

### 2.2 O eixo angular (6 distritos): um acento, não uma paleta nova

Os 6 distritos publicados (`constantes.distritosDef`) têm abertura angular desigual (61,875° a
78,75°) e giro próprio, exatamente como o plano diretor §6.3 previa para os 12 setores
originais antes de virarem 6. Cruzei o programa cívico de `cidade.json` (70 peças) contra os
6 distritos por ângulo, medido em 03/09:

| Distrito | Rumo | Programa dominante | Acento |
|---|---|---|---|
| 0 | 0° a 61,875° | só logística (Central de Distribuição 2 e 3), sem monumento | **conífera**, robusto e utilitário |
| 1 | 61,875° a 106,875° | DOG University, Hospital, Hipódromo, Parque Central e Lago Maior | **guarda-chuva**, parque e sombra |
| 2 | 106,875° a 185,625° | HQ, Museu da Runa, Casa da Moeda, Teatro, Colosso do Portão, Parque Olímpico, Alameda dos Fundadores (o maior distrito) | **colunar**, cívico e vertical |
| 3 | 185,625° a 241,875° | City Hall, Distrito Financeiro, Lago do Poente | **esfera**, formal e disciplinado |
| 4 | 241,875° a 309,375° | Memorial do DOG Perdido, Mercado Municipal, **Jardim Botânico** | **esfera**, quieto e refletido |
| 5 | 309,375° a 360° | Observatório do Cinturão, **Jardim das Coortes** | **conífera**, fronteira |

O "acento" multiplica o peso da espécie escolhida por 1,6 **só na malha local** (contorno e
travessa) daquele distrito, sem tocar bulevar nem anel. É a diferença entre "identidade de
bairro" e "colcha de retalhos": a estrutura primária lê como UM sistema em toda a cidade, e é a
malha fina, que já muda de banda a cada quarteirão, quem carrega o sotaque do distrito. Dois
distritos repetem espécie de acento (0 e 5, ambos conífera; 3 e 4, ambos esfera): isso não é
falta de variedade, é o eco correto entre dois bairros de caráter parecido (ambos utilitários/
fronteiriços; ambos formais/quietos), o mesmo jeito que cidades reais repetem espécie
dominante em vários bairros de perfil parecido sem deixar de ter identidade local.

### 2.3 O que fica igual em toda parte

O material é um só (`MeshStandardMaterial` com cor por vértice), a geometria das 4 espécies não
muda por bairro nem por banda, e a variação por indivíduo (seção 3) usa a MESMA regra em
qualquer lugar da cidade. O que muda é só o PESO da mistura, dado de tabela, nunca um material,
uma malha ou um `if` novo por bairro.

---

## 3. Variação dentro da espécie: o que já existe, e o que falta estender

Isto já estava construído em 02/09 pela frente que passou por aqui antes (`especies.ts`), e é
bom, então este documento não refaz, só reconhece e estende:

- **Porte**: cada espécie tem uma faixa (`porte`, ex.: esfera 0,60 a 1,35), aplicada por muda
  via ruído de mundo + hash individual, então uma alameda tem muda nova ao lado de exemplar
  velho, nunca clones do mesmo tamanho.
- **Arquétipo de escala não uniforme**: 4 combinações de escala XZ/Y por espécie (redonda,
  aberta, colunar, alta), que dão silhueta variada sem malha nova nem material novo.
- **Tombo do fuste**: cada espécie tem sua amplitude de inclinação (a de calçada mais torta,
  a estaqueada quase no prumo).
- **Tinte**: faixa fria/quente PRÓPRIA de cada espécie, por posição de mundo (parentesco de
  vizinhos) mais hash individual (nenhuma muda idêntica à vizinha), sempre multiplicativo e
  nunca acima de 1,0 (a lição registrada no cabeçalho de `especies.ts` sobre saturação estourar
  o canal).

O que este documento adiciona ao sistema de variação: a hierarquia das seções 1 e 2 usa a
MESMA função de escolha por peso (`especieDeTabela`, extraída de `especieDe` sem mudar um
número do caminho antigo) e a mesma semente por fileira/quarteirão, não por muda. Uma travessa
inteira tem parentesco; a travessa seguinte troca. Nada de "fileira de clones", que era
justamente o defeito que a chapa de 1,7 m mostrava antes de 02/09 (tronco de cilindro liso,
copa facetada uniforme, mesmo tamanho, mesma cadência): isso já foi resolvido pela geometria
lobada e pelo sistema de arquétipo/tinte/tombo; o que faltava, e este documento fecha, era a
MISTURA por lugar, não a variação por indivíduo.

---

## 4. Os jardins temáticos: japonês, tropical e italiano

Atualizado em 03/09 com o terceiro jardim, pedido do fundador ("aqueles pinheiros em forma de
guarda-chuva que tem em Roma, pinheiros da Toscana compridos e altos, muitas flores, limão
siciliano etc"): um Jardim Italiano renascentista, tratado no cânone real (Villa d'Este, Villa
Lante, Boboli), nas seções 4.6 a 4.8. As seções 4.1 a 4.5 são as duas primeiras rodadas,
intocadas.

### 4.1 Onde, e por que ali (Japonês e Tropical)

`cidade.json` já reserva dois lotes de jardim que ninguém tinha plantado: **Jardim Botânico**
(id `?`, setor 9, **distrito 4**, x = −1.969, z = −705, rotação 289,69°, 30,06 ha) e **Jardim
das Coortes** (setor 11, **distrito 5**, x = −699, z = −1.954, rotação 340,31°, 28,28 ha). Não
inventei terreno novo: são os dois lotes de "jardim" que o gerador já demarcou e que hoje estão
vazios.

- **Jardim Japonês → Jardim Botânico** (distrito 4: Memorial do DOG Perdido, Mercado
  Municipal). O distrito já tem caráter quieto e refletido (acento esfera, seção 2.2); um
  jardim japonês, contemplativo por definição, é a intensificação natural desse caráter, não
  uma importação estrangeira. O nome "Jardim Botânico" também é o mais genérico dos dois, o
  que sobra espaço para um segundo tema ali no futuro sem contradizer o nome.
- **Jardim Tropical → Jardim das Coortes** (distrito 5: Observatório do Cinturão, a fronteira
  da cidade voltada para a Cinta industrial). O nome "Coortes" ecoa os 12 escalões
  comportamentais do airdrop do DOG (`project_behavioral_patterns`): um jardim exuberante,
  denso, de espécies variadas, é uma boa metáfora para a diversidade de coortes de holders, e
  o contraste com a quietude do distrito 4 (tropical vs. japonês, exuberância vs. contenção) dá
  aos dois jardins identidades opostas em vez de duas variações do mesmo tema.

### 4.2 Por que só o núcleo do lote, não os 30 ha inteiros

Um jardim japonês de 30 ha não é um jardim japonês, é um parque com decoração oriental.
Referências reais: o Jardim Japonês de Portland tem 5,2 ha; Kenrokuen, um dos três grandes
jardins históricos do Japão, tem 11,4 ha; o Jardim Japonês de São Paulo (Ibirapuera) tem cerca
de 4,8 ha. Aqui o núcleo curado fica em **raio 90 m (2,54 ha)** em cada lote, centrado no
mesmo ponto do lote publicado e girado no MESMO ângulo que o gerador já deu ao lote (`rot`),
para a composição interna não flutuar em diagonal sobre o terreno que a cidade já desenhou.

O resto do lote (27,5 ha em cada um) **não recebe peça curada nenhuma**: ele é bosque comum do
distrito, plantado pela MESMA hierarquia de banda/distrito da seção 2. Isso é o que evita o
jardim virar "parque temático" isolado: a moldura ao redor do núcleo japonês já nasce
esfera-dominante (o acento do distrito 4) e a moldura ao redor do núcleo tropical já nasce
conífera-dominante (o acento do distrito 5), então cada jardim tem uma transição suave para o
resto da cidade em vez de uma borda abrupta.

### 4.3 Jardim Japonês, o repertório

Elementos curados (`props-table.ts`, atrás de `?verde=1`), todos de arquivo já licenciado em
`sf-assets.ts`. Atualizado em 03/09 quando sete espécies novas chegaram (a frente de assets
respondeu ao pedido da primeira versão deste documento):

- **`tree-sakura-hero`** (Sakura Tree 01, Jogoss, CC BY 4.0): 2 exemplares-hero flanqueando a
  chegada. É peça de 45.000 triângulos (medido no glTF), por isso "hero": specimen raro, não
  plantio de massa. Este arquivo não é usado em NENHUM outro lugar da praça hoje.
- **`lamp-stone`** (Japanese Stone Lamp, aya.albayati, CC BY 4.0): 8 lanternas ao longo do
  eixo, o mesmo modelo já usado na alameda do Jardim Ordinal (SW da praça), aqui reaproveitado
  sem custo de licença nova.
- **`tree-black-pine`** (Japanese Black Pine, matt z chan, CC BY 4.0, chegou 03/09): **1
  exemplar-hero** no fim do eixo, substituindo o `tree-gnarled` que fazia esse papel na
  primeira versão deste documento como aproximação. É classe de exceção (40.000 triângulos):
  uma instância só, nunca fileira. Fecha o pedido §6 item 1 desta mesma seção (na versão
  anterior).
- **`bamboo-clump`** (Bamboo, arthur, CC BY 4.0, chegou 03/09): tela de bambu nos dois lados do
  núcleo curado, separando-o do bosque comum do distrito sem precisar de muro. Fecha o pedido
  §6 item 2 da versão anterior.

O `tree-gnarled` saiu desta lista porque o pinheiro-negro de verdade chegou; ele continua
disponível e credenciado para outros usos (é o mesmo modelo do jardim norte da Praça Central).

O que FICOU DE FORA por custo, e por que (ver orçamento, seção 7): `temple-hall` (Japanese
Lowpoly temple, carolinefangel, CC BY 4.0, já usado na caverna do Leonidas) custaria **9 novas
chamadas de desenho** sozinho (9 primitivas medidas no glTF), mais do que o Jardim Japonês
inteiro nesta entrega (12). Fica no pedido de espécie como "já disponível, caro"; se o fundador
quiser o pavilhão como âncora do jardim, o custo está escrito na seção 7 para decidir com o
número na mão.

O que este jardim NÃO tem, por ficar fora do escopo dos meus três arquivos: **água**. Um
jardim japonês de verdade quase sempre tem um espelho ou um lago (mesmo que pequeno); eu não
toco em `lagos.ts` nem crio corpo d'água novo. A alternativa honesta, e que é um tipo real e
respeitado de jardim japonês, é o **jardim seco** (karesansui, o vocabulário de Ryōan-ji):
cascalho, pedra, sem água corrente. Esta entrega planta as árvores, as lanternas e o bambu; o
cascalho e a composição de pedra ficam fora (pedido de espécie, seção 6).

### 4.4 Jardim Tropical, o repertório

- **`palm`** (`palm.glb`, gênero não identificado no crédito, CC BY 4.0): bosque informal de
  10 palmeiras, raio 30 a 80 m do centro do jardim, não fileira nem anel (folhagem tropical não
  nasce em grade). Este é o arquivo que NENHUM outro lugar da praça usa hoje (as avenidas e o
  Anel usam `palm-date` e `palm-tall`), então o jardim tem sua própria variedade de copa em vez
  de repetir a palmeira do bulevar.
- **`feto`** (Tropical Fern Phlebodium, The_Structure_World, CC BY 4.0) e **`samambaia`**
  (Realistic Fern Plant Bush, misty-wind, CC BY 4.0): duas camadas de sub-bosque sob as
  palmeiras, 14 pontos cada, o mesmo par que já veste a floresta das ilhas do aquário
  (`aquario.ts`); aqui reaproveitado para dar ao chão do jardim a mesma sensação de mata baixa
  fechada.
- **`banana-tree`** (Banana Tree, Garecra, CC BY 4.0, chegou 03/09): 8 pontos na camada média,
  entre o sub-bosque e o dossel de palmeiras. Fecha o pedido §6 item 3 da versão anterior.
- **`heliconia`** (Heliconia Rostrata, Meownster, CC BY 4.0, chegou 03/09): 5 pontos apenas,
  perto dos caminhos. 15.000 triângulos para uma planta de 2 m é orçamento de hero (a mesma
  lógica da sakura no jardim japonês), então ela é ponto focal de cor, não canteiro. Fecha o
  pedido §6 item 4 da versão anterior.
- **`baobab`** (Realistic Baobab Tree, pighunt3r15, CC BY 4.0, chegou 03/09): **1 exemplar**
  como marco de chegada do jardim. Não fazia parte do pedido original (era uma sugestão livre
  da frente de assets, "silhueta única"); coube melhor aqui, como ícone de savana tropical, do
  que como um marco cívico solto em outro distrito.

O que FICOU DE FORA: `tree-palm.glb` ("Realistic Palm Tree Free", Next Spring, CC BY 4.0, 5
primitivas medidas) é mais caro que `palm` para o mesmo papel e por isso não entrou; `grama-
alta` (tall grass, já usada no aquário) ficou de fora por restrição de orçamento, não por não
servir.

### 4.5 Fora dos dois jardins: a Alameda dos Fundadores (novo, 03/09)

`cidade.json` publica um terceiro lote ainda vazio, "Alameda dos Fundadores" (distrito 2, x
−354, z 1777, rotação 191,25°, faixa de 343,7 × 114,4 m: geometria de passeio, não de praça
redonda). O distrito 2 já tinha acento colunar (vertical, cívico, seção 2.2); o cedro do
Líbano é o contraponto certo, não uma repetição: copa em bandejas horizontais contra o risco
vertical da colunar, e é literalmente a árvore que paisagismo real planta em avenidas de
memorial e fundadores. Duas duplas de **`cedar-lebanon`** (Cedar Of Lebanon, Valery.Li, CC BY
4.0, chegou 03/09) flanqueiam o eixo, 4 chamadas de desenho.

**A sequoia-gigante chegou em 03/09** (`sequoia.glb` e `sequoia-mass.glb`), depois de a busca
não achar licença compatível em banco nenhum: a outra frente a gerou por código
(`blender/build_sequoia.py`, perfil do tronco medido no General Sherman, NPS; crédito próprio,
sem CC-BY porque não veio de terceiro). O "Bosque dos Fundadores" que a versão anterior deste
documento reservava, sem código nenhum apontando para ele, agora existe: 2 exemplares-hero
(`sequoia.glb`, 4 primitivas) nas duas pontas da alameda, além dos cedros já plantados, e 8 da
variante barata para bosque (`sequoia-mass.glb`, 4 primitivas) em pequenos grupos ao redor de
cada hero. Progressão de chegada: cedro perto do centro (já plantado), sequoia longe, nas
pontas, como convém a uma árvore que impressiona por TAMANHO e quer distância para se ler.

---

### 4.6 O Jardim Italiano: TAREFA 1, o sítio (dado, não gosto)

O pedido do fundador, junto com o cânone que ele citou sem saber que estava citando (Villa
d'Este, Villa Lante, Boboli), exige uma coisa que os outros dois jardins não exigiam:
**encosta real, contínua**. Jardim japonês e jardim tropical toleram terreno raso; jardim
italiano renascentista NASCE da encosta, com o eixo de água caindo de terraço em terraço. Sem
declive de verdade, um "jardim italiano" no plano é meia coisa: um parterre sem cascata.

### O que eu tinha para escolher

Medido em 03/09, direto no arquivo real (`public/lunar/btc-core-heightmap.f32`, 429×429,
célula 59,225 m, o mesmo dado que `terrain.ts` interpola, sem abrir navegador): dentro do
tecido construído (`declive_max` publicado é 4,0%, mas isso é meta do GERADOR para o lote, não
um limite que `terrain.ts` de fato impõe ao relevo bruto fora da praça) e no anel além dele, a
maior parte do sítio é Mare Tranquillitatis de verdade: **genuinamente plana**. A única
concentração de relevo forte é o maciço oeste, onde `alpino.ts` já planta a coroa de neve e a
mata de conífera (sempre ativa, sem bandeira) e onde `inverno.ts` esculpe a montanha de
1.065,9 m (atrás de `?inverno=1`, arco 248° a 288°).

**Considerei o pé da montanha de inverno, como pedido, e decidi não usar.** Três motivos, os
três medidos:

1. **Bandeira cruzada.** A montanha de 1.066 m só existe com `?inverno=1` ligada; o anel de
   6.150 a 8.100 m que o pódio já deixa plano virou, por decisão daquela frente, "pista verde
   de acesso e vila-base" (estação, garagem de teleférico), e a montanha de verdade mora de
   r≈8.150 a r≈8.650, dentro do MESMO arco de 40° (248°-288°). Colocar o Jardim Italiano ali
   faria ele exigir `?verde=1 AND ?inverno=1` ao mesmo tempo para aparecer, o que contradiz a
   regra "sua bandeira é `?verde=1`, sem ela nada muda": com `?inverno=1` desligada (o padrão),
   meu jardim sumiria junto com a montanha que não é minha.
2. **Território ocupado.** Mesmo sem a montanha nova, o relevo NATURAL do maciço (pico de
   321,7 m em r=8.283, azimute 264°, medido por `alpino.ts` antes de qualquer sculpting) já é
   plantado por `alpino.ts` (coroa de neve acima de 250 m, mata de conífera de 150 a 250 m,
   SEMPRE ativa). Entrar ali é pisar em cima de um módulo que não é meu e que já tem programa.
3. **Não é a única encosta.** A busca por slope real (abaixo) achou algo melhor: dentro da
   PRÓPRIA malha de peças do programa, fora de qualquer bandeira alheia.

### A busca real, e o achado

Varri os 70 pontos de `cidade.json → programa` contra o gradiente local do heightmap bruto (4
amostras a 40 m, a mesma célula de `alpino.ts`), ranqueado por inclinação:

| Peça | Tipo | r (m) | Altura no ponto | Gradiente local |
|---|---|---|---|---|
| **Floresta de Extrativismo** (VP02) | floresta | 6.762 | 76,9 m | **22,9%** |
| Fundição e Laminação | indústria | 5.928 | 95,6 m | 9,1% |
| Campo Solar Norte | distribuição | 8.994 | 30,5 m | 8,7% |
| Hortas do Poente | jardim | 4.700 | 75,8 m | 7,6% |

**A Floresta de Extrativismo (VP02) vence por larga margem**, e ela está fora de qualquer
bandeira: 107,52 ha, x = −5.612, z = 3.772, rumo próprio 236,1° (o mesmo rumo do seu raio a
partir do centro: a peça já nasce orientada radialmente), tipo `floresta` (produtiva, não
residencial, não é lote de holder: pode ser parcialmente reaproveitada sem tirar endereço de
carteira nenhuma, a regra dura do plano diretor §6.7). Ela fica na **Cinta** (r > 5.500, o
cinturão industrial), a 12° de distância angular da borda do arco do parque de inverno (236°
contra 248°): vizinha do maciço, nunca dentro dele.

Tracei o perfil real ao longo do eixo mais longo da peça e achei um trecho de 280 m com queda
monótona (sem reversão) de 63,6 m:

| Ponto | x | z | h (m) | r (m) |
|---|---|---|---|---|
| **TOPO** (entrada, chegada da villa) | −6.161 | 3.960 | 113,2 | 7.402 |
| **BASE** (belvedere, fim do eixo) | −5.928 | 3.804 | 49,6 | 6.842 |

280 m de comprimento, 63,6 m de queda, **22,7% de declividade média**. Para comparar (seção
4.8 traz a fonte): Villa d'Este cai mais de 45 m do topo à base em encosta íngreme, a mesma
ordem de grandeza, meu jardim até excede um pouco. Isto não é lote raso com terraço fingido: é
relevo real, medido, dentro do próprio arquivo que a cidade usa para desenhar o chão.

**O achado extra, não procurado**: o eixo descendente (rumo 56,1°, de TOPO a BASE) aponta, se
estendido, quase exatamente para o **centro da cidade** (rumo real do BASE até a origem:
57,3°, a 7.043 m). Um patrono de villa renascentista constrói o eixo para terminar numa vista
que mostra seu domínio (Villa d'Este mostra Tivoli; Caprarola mostra o campo); aqui, sem eu
desenhar nada, o declive natural já aponta para o skyline inteiro da DogCity. A "vista no fim
do eixo" que a Tarefa 1 pede não é imaginada, é geometria de terreno relida.

### A peça que eu trocaria, e por que só em parte

Não removo a Floresta de Extrativismo inteira. Uso um núcleo de **cerca de 3,3 ha** (a faixa de
280 × ~120 m do eixo real, seção 4.8) e deixo os outros ~104 ha como estavam: floresta de
produção intacta. Essa floresta remanescente vira, sem esforço extra, o **bosco** que o cânone
exige (seção 4.7): mata informal ao redor do jardim geométrico é justamente o que uma floresta
de extração JÁ é. Não inventei um bosco, herdei um.

### 4.7 O Jardim Italiano: TAREFA 2, o cânone (pesquisado, não clichê)

Fontes: WebSearch em 03/09, citadas ao final desta seção. Sete elementos do cânone, e o que
cada um vira nesta praça:

**EIXO.** O trecho de 280 m da seção 4.6, TOPO a BASE, simetria espelhada nos dois lados. Tudo
abaixo se organiza nele.

**VIALE DEI CIPRESSI.** `tree-cypress` (Cypress tree, ElectroNick, CC BY 4.0; 2.600 triângulos,
2 primitivas) é exatamente o material: coluna estreita e alta, e é o "pinheiro da Toscana
comprido e alto" que o fundador descreveu sem saber o nome botânico certo (cipreste, não
pinheiro; o pinheiro-guarda-chuva vem a seguir, no bosco). Fileira dupla nos primeiros 80 m do
eixo, do TOPO até a boca do parterre, espaçamento 6 m (mais fechado que o espaçamento de rua da
seção 1: aqui é parede vegetal de chegada, não alameda urbana).

**TERRAÇOS, ESCADARIA, BALAUSTRADA.** Fora do meu escopo: são três arquivos meus
(`arborizacao.ts`, `props-table.ts`, `especies.ts`), nenhum deles mexe em terra nem em
alvenaria. O corte do talude, os degraus e a balaustrada de pedra são trabalho de terreno/obra
(o mesmo tipo de módulo que construiu `sp-complex.glb` para o spaceport, por script Blender
dedicado). Planto sobre o `heightAt` que já existe: sem terraço de alvenaria, a fileira de
cipreste e o parterre já seguem a queda real do terreno, o que dá a LEITURA de encosta
trabalhada mesmo antes de qualquer talude ser cortado. O terraço de pedra é melhoria futura,
não bloqueio.

**PARTERRE DE BUXO, COM CASCALHO.** `buxo-sebe` (sebe, 2 primitivas, 1.824 triângulos) e
`buxo-bola` (topiária esférica, 1 primitiva, 1.080 triângulos) chegaram em 03/09 (ainda SEM
linha de crédito em `sf-assets.ts`, que não é meu arquivo: ver a ressalva no fim desta seção).
Quatro compartimentos (2×2), 26 × 22 m cada, com caminho central de 6 m entre eles (a mesma
geometria em cruz de Villa Lante, quatro tabuleiros ao redor de uma fonte central), sebe
contornando cada compartimento e uma bola de buxo em cada um dos 4 cantos. **O cascalho já
existe**: o piso é regolito lunar, que é literalmente cascalho fino, então o "chão entre os
compartimentos" que separa jardim italiano de jardim inglês está resolvido pelo material que a
cidade inteira já usa, sem decal novo.

**ÁGUA COMO EIXO.** Fora do escopo dos meus três arquivos (é `lagos.ts`/`canais.ts`, outra
frente). O que planto é a MOLDURA: `fountain-basin` (Fuente de agua, Harold.Llanos, CC BY 4.0,
já usado 3× na Praça Central, aqui reaproveitado) marca o ponto de chegada da água no
belvedere, na BASE do eixo. A catena d'acqua descendo pelos terraços (o gesto mais
reconhecível de Villa d'Este) fica pedida, não construída: ver seção 4.8/6.

**BOSCO.** A própria Floresta de Extrativismo remanescente (seção 4.6), mais uma bolsa
plantada de `pine-umbrella` (pinheiro-manso, chegou 03/09, SEM crédito ainda, 2 primitivas,
6.000 triângulos) na faixa mais baixa e mais sombria do eixo (entre o parterre e o belvedere):
é o pinheiro real de Roma, Pinus pinea, 15 a 25 m de altura, copa em guarda-chuva de 8 a 12 m
de vão (Villa Borghese é a referência clássica). Plantado em bosque informal (a mesma função
`bosque()` que já uso no Jardim Tropical), não em fileira: bosco é o contraste INFORMAL contra
o parterre geométrico, e teria sido erro alinhar os dois.

**LIMONAIA.** `limao-vaso-test` (nome de arquivo com sufixo "-teste": tratar como provisório,
sem crédito ainda) em vaso de terracota, fileira dupla flanqueando o trecho do eixo reservado
para a catena d'agua (12 exemplares, 6 de cada lado, espaçamento 6 m). Nunca no chão: em vaso,
em fileira, encostado numa borda, exatamente o gesto que a Tarefa 2 pediu.

**CICA (adendo do fundador, 03/09).** `Cycas revoluta`, cicadácea e não palmeira apesar do
nome popular: mesmo papel do limoeiro, exemplar jovem em vaso de terracota, em PAR simétrico,
ladeando escadaria, portão e borda de terraço. `cycas-vaso.glb` foi pedido à frente de espécies
(mesma classe de massa do buxo, 2.500 a 3.500 triângulos) e AINDA NÃO CHEGOU ao disco: a linha
de código já está escrita (ela carrega sozinha quando o arquivo aparecer, `loadSf` nunca quebra
por asset ausente), mas o efeito visual é zero até lá. Quatro pares (8 exemplares): no portão de
entrada do TOPO, no alto de cada uma das duas quebras de terraço, e na entrada do belvedere.

**FLORES DENTRO DO COMPARTIMENTO.** Oleandro, roseira, alfazema, glicínia (em pérgola), jasmim
e íris (o símbolo de Florença): todos pedidos à frente de espécies, nenhum chegou ainda. O
cânone é claro e a versão anterior deste documento já citava a regra para os outros jardins:
flor entra DENTRO do compartimento de buxo e na borda dele, nunca espalhada em maciço solto.
Contagem e posição exatas na seção 4.8; nenhuma linha de código as referencia hoje porque eu
não tenho nome de arquivo real para arriscar (um nome errado apontaria para um arquivo que a
outra frente nunca criaria com aquele nome, e a peça nunca apareceria mesmo depois de pronta).

**Fontes desta seção** (WebSearch, 03/09): Villa d'Este (área 4,5 ha, queda de mais de 45 m,
eixo longitudinal central com cinco eixos transversais, cerca de 50 fontes): visititaly.eu,
UNESCO (whc.unesco.org/en/list/1025), Wikipedia; Villa Lante (22 ha ao todo, parterre
quadripartido com 4 bacias e 12 canteiros de buxo esculpido ao redor da Fonte dos Mouros):
italia.it, Wikipedia; Boboli (cerca de 45 ha, Viottolone de cerca de 300 m ladeado por
ciprestes até o Isolotto): florenceinferno.com, boboli-gardens.com; Pinus pinea (15 a 25 m de
altura, copa de 8 a 12 m, ícone de Villa Borghese): treesandshrubsonline.org, vdberk.com,
rome.us.

### 4.8 O Jardim Italiano: TAREFA 3, os números

**Núcleo curado**: 280 × 120 m ao longo do eixo, **3,36 ha**. Comparado aos outros dois
jardins (Japonês 2,54 ha, Tropical implícito no mesmo raio de 90 m ≈ 2,54 ha): o italiano é o
maior dos três, e isso é DEFENSÁVEL pelas referências: Villa d'Este sozinha (sem contar o
parque externo) já tem 4,5 ha; Villa Lante, se contar só o parterre formal (a "grandiosa
composição" ao redor da Fonte dos Mouros), é bem menor que os 22 ha totais da propriedade
(a maior parte de Villa Lante é bosco, não parterre); Boboli tem quase 45 ha, mas a maior parte
também é bosco e anfiteatro, não canteiro. 3,36 ha de núcleo curado contra 104 ha de floresta
remanescente ao redor é uma proporção parterre:bosco perto da de Villa Lante, não um exagero.

**Contagem por espécie** (todas atrás de `?verde=1`; ⚠️ marca arquivo sem linha de crédito em
`sf-assets.ts` ainda, fora do meu escopo editar):

| Espécie | Papel | Instâncias | Primitivas (chamadas) |
|---|---|---|---|
| `tree-cypress` | viale dei cipressi | 26 (13 por lado) | 2 |
| `pine-umbrella` ⚠️ | bosco | 14 | 2 |
| `buxo-sebe` ⚠️ | contorno dos 4 compartimentos | ~148 (perímetro a cada 2,6 m) | 2 |
| `buxo-bola` ⚠️ | topiária dos cantos | 16 (4 por compartimento) | 1 |
| `limao-vaso-test` ⚠️ | limonaia | 12 | 2 |
| `cycas-vaso` (arquivo pendente) | pares de escadaria/portão | 8 (código pronto, efeito zero até o arquivo chegar) | NÃO MEDIDO |
| `garden-urn` | balaustrada do belvedere (reaproveitado) | 4 | 2 |
| `fountain-basin` | moldura da água no belvedere (reaproveitado) | 1 | 1 |
| **Total desta seção** | | **221 instâncias plantadas + 8 pendentes** | **12** (mais o que `cycas-vaso` custar) |

**Flores pedidas, ainda sem arquivo** (seção 6): 6 compartimentos de canteiro (2 por
"tabuleiro" dos 4 quadrantes do parterre, mais 2 nas bordas junto à escadaria) recebem,
quando chegarem: íris nas bordas voltadas para o caminho central (o símbolo muda em uso mais
visível), lavanda e roseira dividindo o miolo dos 4 compartimentos, oleandro em pontos isolados
nas quinas externas do parterre (arbusto maior, marca de esquina), jasmim e glicínia
trepando uma pérgola na transição do parterre para o bosco (a pérgola em si é peça de
arquitetura, fora do escopo, mas o local está reservado). Nenhuma contagem de instância aqui é
final: sem arquivo, é intenção de projeto, não plantio.

**Transição para o entorno, sem virar parque temático isolado**: ao norte e a leste do núcleo
(fora dos 280 × 120 m), a Floresta de Extrativismo continua produtiva e sem árvore curada
nenhuma extra: é o bosco cânone, herdado de graça (seção 4.6). Ao sul, a peça encosta na
Cinta industrial (Fundição e Laminação, Reservatório do Poente): o jardim não finge que a
vizinhança industrial não existe, ele vira o contraponto cultivado dela, que é exatamente o
papel que jardins de patrono cumpriam na Itália real, cercados por terra de trabalho, não por
outros jardins.

---

## 5. Os números, e a reconciliação com o capítulo 3.4

### 5.1 O que o código planta hoje, por camada

| Camada | Contagem (antes da rejeição de máscara) | Bandeira |
|---|---|---|
| Cova (peças/praças) | (parte dos 20.756 de hoje, contagem não separada nesta medição) | sempre |
| Bulevar (12 avenidas) | ~25.992 (medido 01/09, `arborizacao.ts`) | sempre |
| Anel (7 anéis) | ~26.634 (medido 01/09, `arborizacao.ts`) | sempre |
| Total plantado hoje (pós-rejeição de via) | **20.756** (medido, `gta5.md`) | sempre |
| Via de contorno (1 lado, 1.862 quarteirões) | **30.661** (calculado em 03/09 pela fórmula do próprio código sobre `cidade-malha.json`) | `?arvcont=1` (existente, opt-in) |
| Travessa (bookend, k=2/3/4, 3.031 segmentos × 2) | **6.062** (calculado em 03/09) | `?verde=1` (novo) |
| Jardim Japonês (peças curadas) | 12 instâncias | `?verde=1` |
| Jardim Tropical (peças curadas) | 38 instâncias | `?verde=1` |
| Jardim Italiano (peças curadas, seção 4.8) | 221 instâncias + 8 pendentes | `?verde=1` |
| Alameda dos Fundadores (cedro + sequoia) | 4 + 10 = 14 instâncias | `?verde=1` |

Os quatro jardins e a alameda são `props-table.ts` (adereço, contagem de INSTÂNCIA por linha,
sem teto próprio hoje); a linha de cima é `arborizacao.ts` (árvore procedural, teto duro
`TETO`). São dois orçamentos diferentes, medidos separadamente; a seção 7 trata do de
`props-table.ts`.

Com `?verde=1` sozinho (sem `?arvcont=1`), só a arborização procedural: 20.756 + 6.062 + 50 ≈
**26.868**, folgado abaixo do teto de instância de 40.000 (`TETO`, `arborizacao.ts`), sem
precisar tocar o teto. Os jardins e a Alameda não entram nesta conta: são instâncias de
`props-table.ts`, orçadas à parte na seção 7.

Com `?verde=1&arvcont=1` juntos: 20.756 + 30.661 + 6.062 + 50 ≈ **57.529**, que ULTRAPASSA o
teto de 40.000. Isto não é bug desta entrega: o teto já cortava silenciosamente (`if
(mudas.length >= TETO) return`, comportamento existente) qualquer combinação que passasse dele,
e `?arvcont=1` sozinho, mesmo sem esta mudança, já se aproxima do teto (20.756 + 30.661 ≈
51.417). **NÃO MEDI** o corte exato que resulta dessa combinação; ele depende da ordem de
inserção do laço, que não mudou. Se o fundador quiser as duas bandeiras juntas de verdade, o
teto precisa subir, e isso é uma decisão de orçamento de renderização que não me cabe tomar
sozinho aqui: a subida também dilui o raio de "árvore cheia" (`R_CHEIA`/histograma de CAP por
espécie), então mais árvore total significa menos árvore em detalhe pleno por metro quadrado.

### 5.2 Por que isto não bate com os 159.890 do capítulo 3.4

O capítulo 3.4 do plano diretor descreve uma cidade em disco com Praças de Quarto e 54.432
lotes, uma abstração que precede o gerador real. A cidade que `scripts/gerar_cidade.py`
efetivamente constrói (a que este documento arboriza) tem outra topologia: 1.862 quarteirões
em 6 distritos e 4 bandas, sem "Praça de Quarto" nem contagem de 80 árvores/ha por miolo
verde. As duas contagens medem cidades DIFERENTES; não há reconciliação lote a lote possível,
e eu não vou forçar uma. O que É comparável, e vale registrar:

- O teto de instância que o capítulo 3.4 mede (300.000, com caixa de lote, não árvore) segue
  sendo a referência certa de orçamento; o teto local de árvore (`TETO = 40.000` em
  `arborizacao.ts`) é uma fatia conservadora dele, medida à parte porque árvore custa mais
  triângulo por instância que caixa de lote (a nota do capítulo 3.4 sobre o bípede de 312
  triângulos vale o mesmo raciocínio para árvore).
- A regra 3-30-300 (3 árvores visíveis, 30% de copa, 300 m até verde público) não foi
  reavaliada nesta entrega: ela depende de cobertura de copa por área construída, que é conta
  de urbanismo (`plano-diretor.md` §3), não de espécie por via. Fica **NÃO MEDIDO** se a
  hierarquia desta entrega muda a fração de copa visível; a MISTURA de espécie que troquei não
  muda a DENSIDADE de plantio em nenhuma via existente (bulevar e anel mantêm o mesmo passo de
  7,6 m de antes).

---

## 6. O pedido de espécie

Atualizado em 03/09, duas vezes: os itens 1 a 4 do pedido original (Japonês/Tropical) chegaram
(pinheiro-negro, bambu, bananeira, helicônia); depois o Jardim Italiano trouxe um pedido novo
inteiro (seção 6.4). Ficam quatro listas: o que chegou, o que já está disponível mas não
wireado, o que genuinamente ainda falta, e o pedido do Jardim Italiano especificamente.

### 6.1 Chegou e foi incorporado (03/09)

| Espécie pedida | Arquivo | Onde entrou |
|---|---|---|
| Pinheiro-negro-japonês (*Pinus thunbergii*) | `tree-black-pine.glb` | Jardim Japonês, hero único (§4.3) |
| Bambu (*Phyllostachys* sp.) | `bamboo-clump.glb` | tela do Jardim Japonês (§4.3) |
| Bananeira (*Musa* sp.) | `banana-tree.glb` | camada média do Jardim Tropical (§4.4) |
| Ave-do-paraíso / helicônia (*Heliconia* sp.) | `heliconia.glb` | pontos focais do Jardim Tropical (§4.4) |

Vieram junto, sem pedido prévio, e foram incorporados por caber bem no projeto: `baobab.glb`
(marco do Jardim Tropical, §4.4) e `cedar-lebanon.glb` (Alameda dos Fundadores, §4.5).
`tree-pine.glb` também chegou, mas foi destinado pela própria frente de assets à floresta de
conífera do maciço de inverno (`alpino.ts`), fora do escopo deste documento.

### 6.2 Já disponível, não wireado nesta entrega (custo conhecido)

| Arquivo | Nome/crédito | Primitivas (custo em chamadas) | Onde serviria |
|---|---|---|---|
| `temple-hall.glb` | Japanese Lowpoly temple, carolinefangel, CC BY 4.0 | 9 | pavilhão-âncora do Jardim Japonês |
| `tree-palm.glb` | Realistic Palm Tree Free, Next Spring, CC BY 4.0 | 5 | segunda variedade de palmeira do Jardim Tropical |
| `tree-olive-old.glb` | Old olive tree (variante robusta), massive-graphisme, CC BY 4.0 | 1 | acento de "árvore velha" em banda Núcleo/Meio |
| `tree-date-hero.glb` | (hero da tamareira já em uso), evolveduk, CC BY 4.0 | 1 | specimen isolado num portal de bulevar |
| `grama-alta.glb` | Realistic Lowpoly Grass, Mega 3D, CC BY 4.0 | 2 | terceira camada de sub-bosque do Jardim Tropical |

### 6.3 Ainda genuinamente faltando

1. **Flamboyant** (*Delonix regia*). Existe um arquivo publicado (`flamboyant.glb`, gerado por
   código, `blender/build_flamboyant.py`), mas a frente que o gerou avisou em 03/09: a copa
   saiu em hélice, versão ruim, "não conte com ele até eu avisar". Continua fora do jardim até
   segunda notícia.
2. **Bétula** ou espécie de casca branca (*Betula pendula* ou similar). Porte 10 a 15 m, copa
   fina, tronco branco muito reconhecível. Para: um porte/textura que nenhuma das quatro
   silhuetas procedurais nem os modelos novos oferecem (todos têm tronco escuro), útil para
   marcar a transição de banda Bairro para Borda com um elemento genuinamente novo.
3. **Musgo/pedra de jardim seco**, não é árvore mas é o item que fecha o Jardim Japonês como
   karesansui de verdade: uma textura de cascalho rastelado e 3 a 5 pedras de composição
   (tamanhos variados, não uniformes). Sem água, isto é o que carrega o jardim; hoje ele tem
   árvore, lanterna e bambu, mas nenhum piso de jardim seco.

A sequoia-gigante SAIU desta lista: chegou em 03/09 gerada por código (`sequoia.glb`,
`sequoia-mass.glb`), plantada na Alameda dos Fundadores (§4.5).

### 6.4 O pedido do Jardim Italiano (novo, 03/09)

Três arquivos já chegaram ao disco mas **ainda sem linha de crédito em `sf-assets.ts`** (que
não é meu arquivo para editar; a frente de espécies foi interrompida por limite de sessão no
meio do trabalho, e crédito é ela quem escreve): `pine-umbrella.glb` (pinheiro-manso, 2
primitivas, 6.000 triângulos), `buxo-sebe.glb` (sebe, 2 primitivas, 1.824 triângulos) e
`buxo-bola.glb` (topiária, 1 primitiva, 1.080 triângulos). Usei os três no projeto (seção 4.7)
porque estão atrás de `?verde=1` (nunca aparecem em produção sem a bandeira) e porque o
crédito é dado que chega depois, não geometria: quando a linha existir, o jardim já está
pronto para exibir, sem eu precisar tocar em código de novo.

Um quarto arquivo, `limao-vaso-test.glb`, tem sufixo "-teste" no próprio nome: tratei como
provisório na seção 4.7 (usei, mas sinalizado), porque um nome com "teste" pode não ser a
malha final que a frente pretende publicar.

Pendente, sem arquivo nenhum ainda, todos pedidos à frente de espécies e usados no projeto da
seção 4.8 por posição e quantidade, mesmo sem geometria:

| Espécie pedida (pelo fundador, adendo "muitas flores"/"mini sagu") | Nome científico | Onde entra | Quantidade prevista |
|---|---|---|---|
| Cica (mini sagu) | *Cycas revoluta* | pares em vaso, escadaria/portão do Jardim Italiano | 8 (4 pares) |
| Oleandro | *Nerium oleander* | quinas externas do parterre | ~4 |
| Roseira | *Rosa* sp. | miolo dos compartimentos de buxo | ~2 compartimentos |
| Alfazema/lavanda | *Lavandula* sp. | miolo dos compartimentos de buxo, junto à roseira | ~2 compartimentos |
| Glicínia | *Wisteria sinensis* | pérgola na transição parterre → bosco (a pérgola é arquitetura, fora do escopo) | 1 trecho |
| Jasmim | *Jasminum* sp. | junto à glicínia, mesma pérgola | 1 trecho |
| Íris | *Iris germanica* (o símbolo de Florença) | bordas dos compartimentos voltadas para o caminho central | ~4 pontos |

`cycas-vaso.glb` já tem a linha de código escrita (props-table.ts, seção 4.8); os seis
restantes não têm arquivo nem nome confirmado, então não há linha de código para eles ainda:
arriscar um nome de arquivo errado deixaria a peça muda mesmo depois de pronta, porque
`props.ts` procura pelo nome exato.

---

## 7. Orçamento de renderização

`props.ts` (outra frente, lido em 03/09) mede a cena em **45 primitivas/InstancedMesh** de
adereço antes desta entrega, cruzando 52 arquivos em `public/city/sf/` com 24 espécies em uso
em `props-table.ts`. Esta entrega soma, contando as sete espécies novas (seção 6.1):

| Item | Chamadas novas | Bandeira |
|---|---|---|
| Jardim Japonês (sakura-hero 3, lamp-stone 1, black-pine 3, bamboo-clump 5) | **12** | `?verde=1` |
| Jardim Tropical (palm 3, feto 1, samambaia 1, banana-tree 5, heliconia 3, baobab 2) | **15** | `?verde=1` |
| Alameda dos Fundadores (cedar-lebanon 4) | **4** | `?verde=1` |
| **Total** | **31** | `?verde=1` |

31 chamadas a mais sobre 45 é +69%, e é bem mais do que a estimativa da primeira versão deste
documento (10, antes das sete espécies novas chegarem).

**E o Jardim Italiano soma mais 12** (tree-cypress 2, pine-umbrella 2, buxo-sebe 2, buxo-bola
1, limao-vaso-test 2, garden-urn 2, fountain-basin 1) **mais 8 da Alameda dos Fundadores**
(sequoia 4, sequoia-mass 4) que já estavam contadas na linha "Alameda dos Fundadores" acima
como parte da atualização de 03/09. Somando as três rodadas desta entrega:

| Rodada | Chamadas novas |
|---|---|
| Jardim Japonês + Jardim Tropical + cedro (primeira rodada) | 31 |
| Jardim Italiano (viale, bosco, parterre, limonaia, belvedere) | 12 |
| Sequoia na Alameda dos Fundadores (segunda rodada, mesma linha da tabela acima) | 8 |
| **Total acumulado desta entrega** | **51** |

51 chamadas a mais sobre as 45 originais de `props.ts` é **+113%**: mais que dobra a fatia de
adereço da cena. Continua **atrás de bandeira desligada por padrão** (o caminho de produção de
hoje não ganha um draw call sequer sem `?verde=1`), mas o número já não é pequeno e eu não vou
fingir que é: se o orçamento total de `props.ts` (que outra frente mede e possui) não tiver
folga para 51 chamadas a mais mesmo opt-in, os cortes mais baratos, em ordem, são: `baobab` (2,
specimen único, não veio de pedido), `fountain-basin` (1, moldura simbólica, a água de verdade
nem existe ainda), `heliconia` (3, já é hero de poucos pontos) e `bamboo-clump` (5, a tela pode
virar decal de chão em vez de modelo, se algum dia alguém escrever esse decal). O corte mais
caro e menos recomendável é o viale de cipreste (`tree-cypress`, 2 chamadas mas é o elemento
mais reconhecível do cânone citado pelo fundador): cortar esse antes dos outros desmontaria o
projeto pelo motivo errado.

A arborização procedural (seções 1 e 2) não soma NENHUM material nem geometria nova: a
hierarquia inteira é peso de mistura sobre as 4 silhuetas e o material único que já existiam, e
o `?verde=1` sozinho no bulevar/anel/contorno/travessa não muda a contagem de InstancedMesh de
árvore (continuam os mesmos 6: 4 de perto, 1 de longe, 1 de arbusto), só a distribuição de
espécie dentro deles, os TRÊS pigmentos de base corrigidos (seção 0.1) e o raio de LOD cheio,
que já era medido por histograma e continua sendo.

O que NÃO entrou por custo, com o número escrito para decidir depois: `temple-hall` (9
chamadas) e `tree-palm.glb` (5 chamadas), seção 6.2.

**Variação de cor por instância (pendente, reservada).** Uma terceira frente está dando a
`PropSpec` a capacidade de variar cor por cópia (hoje toda instância de uma espécie GLB é clone
bit a bit, sem tinte nenhum, diferente do sistema procedural que já tem `tintarMuda`). Reservei
a decisão de paisagismo em `props-table.ts` (`PALETA_INSTANCIA_PENDENTE`, matiz/saturação/luz
por arquivo: prata para oliveira, rosa estreito para sakura, verde-amarelo para folhagem
tropical, quase sem faixa para os dois heros de pinheiro) para não perder a decisão enquanto o
campo exato não existe. Quando o nome do campo chegar, é só espalhar esses valores nas linhas
correspondentes.

---

## 8. O que fica pendente, marcado NÃO MEDIDO

- Contagem exata de árvores por espécie ao vivo, com `?verde=1` ligado (o console de
  `arborizacao.ts` já emite a linha, mas ninguém rodou a página nesta entrega, regra 1 do
  fundador).
- Efeito da combinação `?verde=1&arvcont=1` sobre o teto de instância (seção 5.1): sobe o
  `TETO`, ou aceita o corte silencioso que já existia antes desta mudança.
- Se a fração de copa visível (3-30-300, plano diretor §3.4) muda com a nova mistura: a
  densidade de plantio não mudou, só a espécie, mas eu não tenho medição de copa por espécie a
  ponto de garantir que guarda-chuva (10,1 m de copa) e conífera (copa de saia, mais estreita)
  cobrem a mesma área projetada.
- Qual arquivo exatamente corresponde a "Coconut Palm"/"Coconut tree" nos créditos de
  `sf-assets.ts` (não encontrei arquivo com esse nome em `public/city/sf/`; é possível que
  `palm.glb` ou `tree-palm.glb` sejam essa conversão sob nome genérico, mas não abri o modelo
  para confirmar).
- O talude, a escadaria e a balaustrada de pedra do Jardim Italiano NÃO existem: plantei sobre
  o `heightAt` real, que já dá a queda de 22,7%, mas a alvenaria que faria os quatro
  compartimentos de parterre ficarem realmente NIVELADOS (terraço plano, não rampa) é obra de
  terreno, fora dos meus três arquivos. NÃO MEDI se plantar sem nivelar deixa a sebe de buxo
  visivelmente inclinada demais para ler como parterre geométrico.
- O comprimento real do módulo de `buxo-sebe.glb` (o "tamanho de um segmento de sebe"): sem
  abrir o modelo num visualizador, usei um passo de 2,6 m escolhido por proporção com o buxo-
  bola, não medido no glTF. Se o módulo nativo for muito maior ou menor, o contorno dos
  compartimentos pode ficar com sebe sobreposta ou com vão.
- Se `pine-umbrella`, `buxo-sebe`, `buxo-bola` e `limao-vaso-test` ganharem linha de crédito em
  `sf-assets.ts` com um NOME DE ARQUIVO diferente do que usei aqui (a frente de espécies foi
  interrompida antes de escrever a linha, então o nome final não está confirmado): as quatro
  linhas de `props-table.ts` que os referenciam quebram silenciosamente (viram prop ausente,
  não erro), até alguém trocar o nome.

---

## O que fotografar (para a conferência visual, que o fundador roda)

1. **Bulevar cardinal completo** (uma das quatro pontes, olhando ao longo do eixo): confirmar
   que a calçada lê como fileira quase pura de esfera e o canteiro alterna guarda-chuva/
   colunar sem virar salada.
2. **Um bulevar intermediário** ao lado de um cardinal, mesma altura de câmera: confirmar que
   dá para DISTINGUIR os dois pela mistura, não só pela largura do asfalto.
3. **Os sete anéis**, um enquadramento por anel se possível, ou ao menos Anel Interior vs.
   Avenida da Doca lado a lado: confirmar a transição Núcleo (folhosa) para Cinta (conífera).
4. **Uma travessa com as duas bocas visíveis** (`?verde=1`, sem precisar de `?arvcont=1`):
   confirmar que a árvore marca a passagem sem parecer erro de plantio solto.
5. **Contorno em duas bandas diferentes** (um quarteirão do Núcleo, um da Borda, com
   `?verde=1&arvcont=1`): confirmar o gradiente de formalidade decrescente.
6. **Jardim Japonês**, enquadramento do eixo inteiro (chegada com as duas sakuras, olhando
   para o fim com o pinheiro-negro hero) e um close na tela de bambu vista de fora do núcleo
   (confirmar que ela realmente separa o jardim do bosque comum sem virar muro sólido).
7. **Jardim Tropical**, dois enquadramentos: de dentro do bosque de palmeiras olhando para
   baixo (o sub-bosque de feto/samambaia/banana, confirmar se lê como mata fechada) e do marco
   de chegada olhando para o baobá (confirmar se a silhueta se destaca do bosque de palmeiras
   atrás dela em vez de se confundir).
8. **Vista alta dos dois lotes de jardim** (r ~2.090 m do centro), com e sem `?verde=1`, para
   comparar o núcleo curado (2,54 ha) contra o bosque comum ao redor (27,5 ha) e confirmar que
   a transição não parece um recorte abrupto.
9. **A Alameda dos Fundadores** (distrito 2, x −354 z 1777), com `?verde=1`: confirmar que os
   quatro cedros flanqueando o eixo já dão a sensação de avenida de memorial mesmo vazia,
   antes da sequoia chegar.
10. **Comparação de pigmento das quatro silhuetas procedurais**, uma muda de cada espécie lado
    a lado (esfera, cone, copada, colunar), com e sem `?verde=1`: é o teste mais direto do
    conserto da seção 0.1, e o mais fácil de julgar errado a distância (as quatro têm que
    parecer QUATRO plantas, não quatro tons do mesmo verde).
11. **O eixo inteiro do Jardim Italiano**, do TOPO (x −6.161 z 3.960) até a BASE (x −5.928
    z 3.804), câmera baixa alinhada ao rumo 56°: é o enquadramento que testa a tarefa 1 inteira
    (o declive real de 22,7% tem que LER como encosta, não como terreno raso com árvore em
    cima) e a tarefa 2 (o viale de cipreste emoldurando o parterre de buxo lá embaixo).
12. **O parterre de buxo visto de cima** (drone/câmera alta sobre o núcleo curado): confirmar
    que os 4 compartimentos com sebe e as 16 bolas de topiária realmente leem como geometria,
    não como mancha verde solta, e que o regolito entre eles passa por "cascalho".
13. **A transição do Jardim Italiano para a Floresta de Extrativismo ao redor**: um
    enquadramento na borda dos 280 × 120 m mostrando o parterre geométrico de um lado e a
    floresta de produção contínua do outro, sem cerca nem faixa dura entre os dois.
14. **A limonaia e as duas primeiras cicas** (se `cycas-vaso.glb` já tiver chegado): confirmar
    o gesto de vaso-em-fileira contra vaso-em-par, lado a lado, que é a diferença de composição
    entre os dois elementos que a tarefa 4 pediu.
