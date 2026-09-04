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
- [ ] **Fase 1, diagnóstico.** Sete especialistas, um por subsistema, cada achado conferido
      por um adversário antes de virar tarefa.
- [ ] **Fase 2, projeto.** O que a região deve ser, decidido contra a evidência da fase 1.
- [ ] **Fase 3, obra.** Rodadas de refino, uma frente por arquivo.
- [ ] **Fase 4, conferência.** Chapas contra os enquadramentos de contrato, antes e depois.

## Registro

### 04/09/2026
- Rodada aberta. Coletor de janela topográfica escrito e disparado.
- Diagnóstico dos sete subsistemas em curso.
