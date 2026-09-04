# A rodada da montanha

Refino pesado da região oeste da DogCity: o maciço, o parque de inverno, a mata e
a água que vai nascer ali. Aberta em 04/09/2026 a pedido do fundador.

Este arquivo é o QUARTEL da rodada. Quem entrar no meio da obra lê daqui, não do
histórico da conversa. Cada frente escreve o que fechou; nada de progresso vive só
na cabeça de um agente.

## O pedido, palavra por palavra

> "O foco agora são as montanhas, o parque de inverno, tudo ali. As sequoias estão
> sem tronco. A cadeia de montanhas que são características de lagos, e gostaria de
> floresta e lagoa naquela região. Os picos estão absurdamente pontiagudos, e a neve
> não aparece, em lugar nenhum. A vegetação é completamente esparsa. Talvez começando
> por um novo mapa topográfico, entendendo de fato o que temos hoje e fazer os ajustes
> cirurgicamente, pois a cadeia de montanhas em si está bem legal."

Cinco defeitos nomeados e um desejo:

| # | Defeito | Estado |
|---|---|---|
| 1 | sequoias sem tronco | diagnóstico aberto |
| 2 | picos absurdamente pontiagudos | diagnóstico aberto |
| 3 | neve não aparece em lugar nenhum | diagnóstico aberto |
| 4 | vegetação completamente esparsa | diagnóstico aberto |
| 5 | falta floresta e lagoa na região | diagnóstico aberto |

O desejo é a referência: **cordilheira de região de lagos**, com mata fechada
descendo até a água. Não é alpe genérico e não é morro pelado.

E a restrição do fundador é cirúrgica: **a cadeia de montanhas em si está boa**. O
trabalho é refinar o que existe, não recomeçar.

## A geografia, em número

| Lugar | Onde | Medida |
|---|---|---|
| cume do maciço oeste | (-8325, 291), r 8.330, azimute 268 | 1.065,9 m |
| pico antigo (pré parque de inverno) | (-8234, -902), r 8.283, azimute 264 | 321,7 m |
| Parque Runestone | (8047, -8630), rumo 43, r 11.800 | meio-lado 3.600 |
| casca da abóbada | flecha 5.500, coroa 5.553, rim 53 | raio 9.050 |
| chão da cidade | pódio | mediana 10,6 m |

## Fase 0: o que o terreno REALMENTE é, medido

Três janelas amostradas da cena viva (`superficieAt`, não o heightmap em disco),
com o coletor novo `scripts/city/topo-janela.mjs` e o laudo
`scripts/city/analisa_topo.py`. Os arquivos ficam em
`~/.local/share/dogcity/topo/` (fora do repo: são 4 MB de grade e não são fonte).

### O cume é uma agulha, e agora tem número

Janela do maciço: 5,2 km de lado, célula de 10 m, relevo de -82,9 a 1.115,3 m.
O ponto mais alto está em **(-8230, 887), 1.115,3 m**, r 8.277 do centro.

Perfil radial médio, média de 32 rumos a partir do cume:

| distância do cume | cota média | talude do trecho |
|---|---|---|
| 100 m | 978,3 m | **53,9 graus** |
| 200 m | 797,4 m | **61,1 graus** |
| 300 m | 674,9 m | **50,8 graus** |
| 400 m | 545,5 m | **52,3 graus** |
| 500 m | 474,4 m | 35,4 graus |
| 700 m | 422,1 m | 14,7 graus |
| 1.200 m | 272,1 m | 12,2 graus |

Os primeiros 400 m de descida têm talude médio entre 51 e 61 graus, em TODOS os
rumos, e depois de 700 m o terreno já é chão. Montanha de rocha real fica em 25 a
35 graus de talude médio; 50 a 60 graus é parede, e parede em todos os rumos ao
mesmo tempo é agulha. É isto que o fundador está vendo, e ele está certo.

Área por cota na janela do maciço: **54,2% do recorte está entre 200 e 300 m** e só
**0,44% passa de 1.000 m**. A montanha não tem corpo, tem ponta.

**A conta do refino:** para 860 m de desnível (cume 1.115 sobre um platô de 255) ler
como cordilheira de região de lagos, com talude de 30 graus, a base precisa de raio
1.490 m. Hoje o raio efetivo é ~500 m. A montanha precisa ficar **três vezes mais
larga**, não mais baixa. A altura é boa; a planta é que está errada.

### A cadeia existe, e é uma fileira de agulhas

Janela larga (8 km de lado, célula 12,5 m) sobre (-7000, 1500): cinco cumes com
proeminência local acima de 40 m, alinhados norte-sul entre z -2.312 e z 2.420, ou
seja **4,7 km de cadeia**. O maior fora o principal tem 757,2 m com 410 m de
proeminência. Então a cordilheira que o fundador elogiou é real: o defeito não é a
falta de cadeia, é a forma de cada peça dela.

Acima de 400 m: 2,8 km², 4,4% da janela. Uma linha de espinhos num platô.

### O terreno não tem erosão, e o variograma prova

Diferença média de altura por distância, janela do maciço:

| passo | dh médio | dh/passo |
|---|---|---|
| 10 m | 2,80 m | 0,280 |
| 40 m | 10,76 m | 0,268 |
| 160 m | 36,09 m | 0,225 |
| 641 m | 111,46 m | 0,174 |

`dh/passo` quase constante de 10 a 160 m quer dizer expoente de Hurst perto de 1: a
mesma aspereza em toda escala, que é a assinatura de ruído fractal cru sem erosão.
Terreno erodido de verdade satura (o vale enche, a crista arredonda) e o variograma
cai bem mais rápido. Sem isso não há ravina, ombro nem contraforte, e é por isso que
a chapa lê como pedra amassada e não como montanha.

Vizinhos com altura idêntica: 0,3%. Ou seja **não há quantização**: o mosaico que
aparece na chapa é rugosidade real de alta frequência, não degrau de amostragem.
Suavizar em escala fina é seguro.

### A janela do parque não mede o parque

A janela sobre o Parque Runestone voltou com relevo de **-339 a 13 m**: uma cova, sem
nenhuma montanha. Isso NÃO é defeito do parque, é limite do método: `park.ts` tem
terreno PRÓPRIO (ver o comentário na linha 63), e `superficieAt` ali devolve o
regolito rebaixado sob ele. Para medir o parque é preciso um hook que leia a altura
da malha do parque. Fica anotado para não medir errado de novo.

## Fase 1: o diagnóstico, e as cinco queixas têm apenas TRÊS causas

Sete especialistas leram o código sem abrir navegador, cada relatório conferido por
um adversário que reabriu as linhas citadas. Catorze agentes, 1,7 milhão de tokens,
nenhuma alucinação sobreviveu à conferência. O que ficou de pé:

### Causa 1: o carregador guarda uma malha e joga o resto fora

`carregarInstanciavel()` em `app/city/plaza/inverno.ts:1558` percorre o GLB e para na
PRIMEIRA malha:

```ts
let achado: THREE.Mesh | null = null
cena.traverse((o) => { if (!achado && (o as THREE.Mesh).isMesh) achado = o as THREE.Mesh })
```

O exportador glTF quebra a malha em uma primitiva por material. Árvore tem duas:
tronco (material Wood, opaco) e folha (TreeBranch, alphaMode MASK). Em 8 dos 9
arquivos `sq-*.glb` a folha vem primeiro, então **o tronco é descartado**. É a queixa
nº 1, e a causa é uma linha de código, não o asset.

**E o pinheiro é muito pior.** `tree-pine.glb` tem 4 primitivas; a primeira tem 11
triângulos e a dominante tem 2.917. O carregador guarda os 11. O pinheiro é 231 das
~450 árvores próximas, metade da floresta, e está sendo desenhado como **0,3% do
modelo**. Isso, e não a densidade, é o que mais pesa na queixa nº 4.

Números medidos por decodificação dos GLB no nível de accessor glTF:

| | triângulos |
|---|---|
| o que a cena desenha hoje | ~403.616 |
| o que o comentário do próprio arquivo já declara | 1.328.152 |

Ou seja o orçamento escrito no código sempre foi o da árvore inteira: hoje roda a 30%
dele porque está quebrado. Consertar multiplica por 3,29 e cai no número já previsto.

⚠️ E o conserto já existe nesta casa: `app/city/plaza/props.ts:381` resolveu o mesmo
bug com uma InstancedMesh por parte, com o comentário "instanciar só a primeira
deixava as palmeiras sem folha e as colunas sem capitel". `inverno.ts` nunca recebeu
esse padrão.

### Causa 2: a montanha é feita de três carimbos rápidos demais

O relevo não é ruído nem cone: são três scans fotogramétricos reais estampados por
`amostrarFeicao` (`inverno.ts:917`) e combinados por `Math.max`.

| carimbo | raioM | pesoAltura | talude implícito |
|---|---|---|---|
| Zwölfernock (o principal) | 820 | 900 | 47,7° na borda, 56,7° no disco pleno |
| Weisse Wand A | 620 | 640 | 45,9° / 55,1° |
| Weisse Wand B | 520 | 430 | 39,6° / 49,0° |
| Fuji (o avental) | 6.600 | 420 | 3,6° a 5,0° |

A minha medição independente na cena viva bate: 53,9° a 61,1° nos primeiros 400 m.
Duas rotas diferentes, o mesmo número.

**O avental está certo e o defeito está isolado nos três carimbos de crista.** Isso é
a melhor notícia do diagnóstico: o refino é cirúrgico, como o fundador pediu. A fonte
do Weisse Wand é literalmente uma parede (o scan bruto mede 900 × 901 × 902 m, razão
altura/largura 0,997), então ali reescalar não basta.

Some-se que o envelope radial cai de 100% a 0% em apenas 370 m com expoente 2,4
(`inverno.ts:518-552`), e que os três carimbos ficam a 16 a 18 graus de azimute um do
outro **sem nenhuma crista os conectando**: entre eles só existe o envelope liso. Por
isso são três agulhas, e não uma cordilheira.

### Causa 3: a neve não está faltando, está enterrada

A hipótese de que a inclinação apagava a neve foi **refutada** pelo conferente, que
reconstruiu o algoritmo sobre o dado real: no ponto medido a inclinação dá 30,7°, e
pela fórmula `s = 1 - suave01((inc - 30) / 25)` a cobertura ali deveria ser de 99,8%.
Pela regra, tem neve. Na tela, não tem.

A causa é geométrica e está medida. `alpino.ts` desenha a neve como uma CASCA numa
grade de `PASSO = 40` m (linha 115), levantada `LEVANTE_BASE = 0.4` m fora da zona do
parque e `LEVANTE_INVERNO = 9` m dentro dela (linhas 416-417). O terreno por baixo tem
detalhe de 10 m e taludes de 50 graus. A corda do quad passa por dentro da rocha:

| onde | terreno fura a casca |
|---|---|
| acima de 250 m, por mais de 0,4 m (levante de fora) | **46,5%** das células |
| acima de 600 m, por mais de 9 m (o levante máximo) | **46,6%** das células |
| erro de corda acima de 600 m | mediano 8,0 m, máximo 108,7 m |

Quase metade da neve do corpo alto da montanha está debaixo da pedra, e o que sobra
aparece em retalhos. É exatamente o que se vê.

⚠️ **E as causas 2 e 3 são a mesma doença:** o erro de corda cresce com o talude.
Alargar os carimbos (causa 2) derruba o erro de corda sozinho, e a neve reaparece sem
que ninguém toque no `alpino.ts`. A ordem da obra importa.

### O que mais ficou provado

- **Densidade**: `TETO_ARVORES = 14.000` (`alpino.ts:144`) num anel de 157 km²; e
  `FLORESTA_R_CHEIA = 1.300` m contra uma vista de contrato a 4.560 m do alvo, ou seja
  a chapa oficial do maciço **sempre** fotografa o orçamento esparso de longe.
- **Sub-bosque**: zero peças no maciço. Árvore espetada em chão pelado lê como maquete.
- **LOD de longe**: `gLonge = ConeGeometry(2.3, 11.5, 4)` (`alpino.ts:617`), um cone de
  4 lados sem fuste, e a mata do maciço está sempre além do `R_CHEIA = 1.400` m.
- **KTX2 está certo**: 89 de 89 assets espelhados, zero 404 silencioso. Não é causa de
  nada aqui. O padrão do celular está mantido.
- **Sombra**: o CSM (`sombra.ts`) está atrás de `?csm=1`, desligado por padrão. No
  caminho normal o maciço quase não tem sombra própria, e relevo sem sombra lê chapado.
- **Lagoa**: não existe uma linha de código de água na região. A água da cidade nasce
  por flood-fill abaixo de uma cota única (-40 m), o que não serve para lagoa de
  montanha: precisa de mecanismo próprio. E `inverno.ts` é o único sistema vizinho que
  NÃO consulta `lagos.naAgua`, então hoje pista e floresta passariam por cima da água.

## Regras de trabalho desta rodada

1. **Agente não abre navegador.** Um `next dev`, um `.next`, uma GPU para todo mundo.
   Quatro abas simultâneas já travaram a máquina do fundador. Chapa e medição de cena
   saem pelo portão `scripts/city/chapas.mjs` e pelo coletor `scripts/city/topo-janela.mjs`,
   rodados pelo maestro, uma carga para todos.
2. **Three.js puro.** `@react-three/fiber` quebra em runtime contra o React deste repo.
3. **KTX2 é o padrão para elemento complexo.** O espelho ETC1S consertou o celular; asset
   novo e pesado nasce com espelho, não depois.
4. **Todo achado tem âncora** (arquivo:linha) e toda afirmação de forma tem número medido.
   Adjetivo não fecha tarefa.
5. **O bot de auto-commit publica de hora em hora e varre a árvore inteira.** Nenhuma frente
   pode terminar o turno com código pela metade no caminho ligado. `tsc --noEmit` limpo é
   portão de saída, não gentileza.
6. **Um arquivo, um dono.** Duas frentes não editam o mesmo arquivo na mesma rodada. Colisão
   se resolve no quartel, antes de escrever.
7. Comentário de código e este documento em português. Tudo que o público lê é inglês.

## Fases

- [x] **Fase 0, levantamento.** FECHADA, ver a seção acima.
       Coletor de janela topográfica (`scripts/city/topo-janela.mjs`,
      novo) e três janelas finas: maciço (célula 10 m), parque (12 m), cordilheira (12,5 m).
      Mais a carta geral e as chapas de contrato.
- [x] **Fase 1, diagnóstico.** FECHADA. Sete especialistas, um por subsistema, cada achado conferido
      por um adversário antes de virar tarefa.
- [ ] **Fase 2, projeto.** O que a região deve ser, decidido contra a evidência da fase 1.
- [x] **Fase 3, obra.** Obra 1 fechada, obra 2 em curso. Rodadas de refino, uma frente por arquivo.
- [ ] **Fase 4, conferência.** Chapas contra os enquadramentos de contrato, antes e depois.

## Fase 3: a obra 1, e o que ela mediu

Tres frentes, um arquivo por dono, medindo offline com `tsx` sem abrir navegador.
Commitada pelo bot em 04/09 as 17:37. `npx tsc --noEmit` limpo.

### Frente A, `inverno.ts` (aprovada pelo revisor)

| o que | antes | depois |
|---|---|---|
| talude medio 0 a 500 m do cume, 32 rumos | 54,0 graus | **35,5 graus** |
| talude medio 0 a 400 m | 57,5 graus | 34,5 graus |
| cota do cume | 1.147,7 m | 1.043,8 m |
| corpo da cunha acima de 400 m | 9,18% | **18,71%** |
| triangulo da arvore media | 917 | 2.957 |
| floresta de perto | 412.567 tri | 1.330.587 tri |
| folga minima contra a casca | 177,5 m | 383,7 m |

A cadeia deixou de ser tres agulhas com vazio entre elas: hoje e crista continua de
azimute 246 a 288, com colos 250 a 300 m abaixo dos cumes. As sete pistas voltaram
para dentro da norma FIS e a maior subida indevida num passo caiu de 92 para 47 m.

⚠️ O alvo era 28 a 35 graus e ficou em 35,5. Nao foi falta de tentativa: a montanha so
pode existir entre r 6.700 e r 8.650, e um cone simetrico nessa corrida de 1.950 m para
824 m de relevo mede 41 graus no melhor caso. O que salva a metrica e a crista deitada
no azimute. Baixar mais exige mexer em R_QUEDA, que esbarra na fratura do rim da casca.

**A causa raiz do tronco, consertada:** `carregarInstanciavel` passou a devolver TODAS
as primitivas do GLB (uma InstancedMesh por parte, padrao trazido de `props.ts:381`).
O pinheiro, que e metade da floresta, saiu de 11 triangulos para 3.199.

### Frente B, `alpino.ts` (REPROVADA na revisao, corrigida na obra 2)

| o que | antes | depois |
|---|---|---|
| terreno furando a casca de neve | 26,2% dos triangulos | **2,8%** |
| furo acima da cota 600 m | 22,9% | 6,5% |
| p99 do furo | 12,3 m | 0,8 m |
| vertices da casca | 67.614 (3,10 MB) | 12.111 (0,68 MB) |
| arvores na mata do macico | 14.000 | 51.947 |
| densidade por hectare ocupado | 7,4 media | 35,9 media |
| cobertura de copa | 1,9% | **17,6%** |
| pecas de sub-bosque | 0 | 2.208 |

Reprovada por tres defeitos: o balde de arvores de perto enchia na ordem de varredura da
grade e nao por distancia da camera (medido: 7.414 arvores perto caindo no LOD pobre, e
as 6.000 boas todas de um lado), o mesmo vicio no sub-bosque, e o modulo aceitar
`profile?: PerfProfile` sem nunca ler um campo dele (51.947 instancias com sombra e sem
culling, iguais no celular e no desktop).

### Frente C, `chapas.mjs` (REPROVADA, corrigida na obra 2)

As cinco vistas novas foram calculadas contra o relevo ANTIGO e com uma base lunar
constante de 254 m. Medido: no alvo de `vagalagoa` a superficie real e 146,3 m e a base
local e 11,9 m. Erro de ate 242 m. A correcao nao e recalcular a constante, e perguntar
a cota para a cena com `__plazaChao`, como a tabela OLHOS do proprio arquivo ja faz.

## ⚠️ A armadilha que travou a conferencia de 04/09

`next build` foi rodado as 12:13 e sobrescreveu o `.next` que o `next dev` usa desde a
vespera. O servidor local passou a servir 404 nos proprios chunks (o navegador pede
`main-app.js`, que e nome de dev, e o build deixou `main-app-<hash>.js`), e a chapa da
rodada inteira ficou bloqueada. Producao nao foi afetada (`dogdata.xyz/city` respondeu
200 em 0,41 s).

**Regra, e ela e absoluta nesta casa: NINGUEM roda `next build` nesta maquina.** O portao
de qualidade e `npx tsc --noEmit`, que nao escreve nada. Quem buildar derruba o dev, e o
dev e o que alimenta a captura da live do fundador.

E a segunda metade da regra: **nao se reinicia o `next dev` com a live no ar.** O hot
reload pode mandar recarga para a aba que esta sendo transmitida. Em 04/09 a live estava
no ar havia 5h18min quando o defeito apareceu, e a conferencia esperou.

## Fase 4: a obra 2 (em curso)

Corrige os tres defeitos da revisao, poe teto por tier de maquina nas duas frentes de
vegetacao, arruma os topos de teleferico contra o maximo real de cada rumo, e abre a
**lagoa alpina**: a frente do relevo escolhe e esculpe a bacia e exporta `LAGOA_CENTRO`,
`LAGOA_RAIO` e `LAGOA_COTA`; a frente da agua importa esses valores e monta a lamina, a
margem molhada e `naLagoa(x, z)`, tudo atras de `?lagoa=1` ate alguem VER.

## Registro

### 04/09/2026
- Rodada aberta. Coletor de janela topográfica escrito e disparado.
- Diagnóstico dos sete subsistemas em curso.
