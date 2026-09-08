# Força tarefa da Sphere

Registro dos achados dos especialistas. Este arquivo é CHECKPOINT: cada rodada
custa centenas de milhares de tokens e a rodada 1 perdeu 8 de 9 agentes no limite
de sessão. O que está aqui não se paga duas vezes.

Transcrições completas (um JSON por agente, com o retorno inteiro):
`~/.claude/projects/-home-bitmax-Projects-bitcoin-fullstack/<sessão>/subagents/workflows/<run>/journal.jsonl`

- rodada 1: `wf_57f1f65c-0cb` (1 de 9 concluiu)
- rodada 2: `wf_89c2c49f-c1c`

---

## Rodada 1, arquitetura de conteúdo: o registro de longe

O único agente que terminou. Três achados críticos.

### 1. O registro de longe nunca mostrou um valor inteiro, de azimute nenhum

Não é defeito de implementação, é aritmética. Com 16 casas na volta e um valor de
7 caracteres, `repetirNaVolta` produz 2 cópias de período 8. A janela legível de
um azimute satura em `casas/3` = 5,33 casas, porque o arco com compressão de
largura acima de 0,5 satura em 120°. Para ver uma cópia inteira são precisas 7
casas. **5,33 < 7, em qualquer distância, para sempre.**

Fração de azimutes com o valor de 7 caracteres INTEIRO à vista, tela da live:

| registro | 300m | 620m | 799m | 1500m | 3000m | 4734m | 7520m |
|---|---|---|---|---|---|---|---|
| esc 8 (32 casas) | 0% | 14% | 21% | 33% | 39% | **42%** | 43% |
| esc 10 (24 casas) | 0% | 0% | 0% | 3% | 8% | 9% | 11% |
| esc 12 (21 casas) | 0% | 0% | 0% | 0% | 0% | 0% | 0% |
| esc 16 (16 casas) | 0% | 0% | 0% | 0% | 0% | 0% | **0%** |

Modelo validado contra o número já publicado no próprio arquivo: em D/R = 3,21
devolve 11,1% contra os 13% que `sphere.ts:637` mediu para a esfera de 196 m.

### 2. O invariante que fecha a questão

Numa fonte 5x7 sobre grade equirretangular, casas por volta e altura da letra são
inversamente acopladas:

    casas x altura = 1,75 x π x R

Ele não depende da grade (COLS e ROWS se cancelam), só de R. **Toda tentativa de
comprar alcance vende janela de leitura**, e a janela já é o gargalo. A escala 8 é
o único ponto da curva em que um valor de 7 caracteres chega a aparecer inteiro.

Portanto: registro único, escala 8 mais escala 4, sem troca. Aceitar o limite e
deixar a faixa virar anel liso além dele.

### 3. A troca disparava com a câmera PARADA

`distTexto` sai de `uPxAng`, que vem de `spherePxAng(fov, alturaCss, governor.pixelRatio)`.
O `FrameGovernor` mexe no `pixelRatio` sozinho por carga de quadro, em passos de
x0,9 e x1,08. **A amplitude que ele percorre é maior que a banda morta da
histerese**, então o layout trocava sem ninguém mover a câmera: bastava a taxa de
quadro cair. Pior que a queixa do fundador.

### Mapa de remoção (linhas da época; conferir antes de aplicar)

Sai: o bloco de doc e `FX_LONGE_ESCALA`; `FX_MARGEM` fica morto; `SPHERE_CHARS_LONGE`
(exportado, zero consumidores); o parâmetro `longe` de `pintarTextura`; o ramo
`if (longe)`; `let longe`; o bloco `queroLonge`.

Muda: `FX_MARGEM_PERTO` volta a ser `FX_MARGEM`; `uTextoDist` deixa de dobrar; o
degrau de fillrate deixa de usar `distTexto * 2`.

⚠️ **Duas coisas que não podem quebrar junto.** Primeira: o degrau de fillrate no
celular hoje nunca entra (dá 17.981 m, além do `sphereCull` de 14.000) e passa a
entrar em 8.991 m; dentro da cidade nada muda, mas a vista `montanharasante`
(12.631 m) passa a usar o material liso. Segunda: a faixa tem 128 linhas e o
comentário diz que foi "para caber o registro de longe". Tirado o registro, o
próximo leitor encolhe de volta para 108 e move o texto. A razão nova é melhor e
precisa ficar escrita: com margem 18 o miolo da linha grande cai na linha 414, a
2,18 m do centro óptico da silhueta.

### 4. Os comentários do arquivo estão mentindo desde que a esfera cresceu

Publicados para a esfera de 196 m, e nunca remedidos. Com a peça em 401,0 m:

| | comentário diz | é |
|---|---|---|
| passo do LED | 30,07 cm | **61,51 cm** |
| letra grande | 16,84 m | **34,45 m** |
| letra pequena | 8,42 m | **17,22 m** |
| alcance na tela da live | 2.757 m | **5.639 m** |

`SPHERE_PASSO`, `SPHERE_LETRA_ALTURA` e `SPHERE_TEXTO_PX` precisam de revisão.


---

# Rodada 2 (wf_89c2c49f-c1c), 7 de 7 concluíram, 750 mil tokens



## diag:glifo

{
 "achados": [
  {
   "titulo": "A compensacao 1/cos(lat) e um escalar unico para um glifo que cobre 43,95 graus de latitude: a base sai 2,80x mais larga que o topo",
   "causa": "Causa (a) do enunciado, e ela DOMINA. `escalaX` e calculado uma vez a partir de `LINHA_MARCA = 230` e aplicado como `g.scale(escalaX, 1)` sobre a marca inteira. Mas o glifo tem 250 linhas de LED, ou seja vai da linha 105 (lat 71,543 graus) a linha 355 (lat 27,598 graus), 43,95 graus de latitude. Na equirretangular a largura FISICA de um segmento de N texels vale N * 0,61513 * cos(lat) metros de arco, entao com N constante a largura real varia com cos(lat) ao longo da altura: topo cos 0,31659, centro cos 0,64851, base cos 0,88622. Relativo ao centro o topo sai com 0,48818 da largura e a base com 1,36654, razao base/topo = 2,7992. O glifo nao e um B, e uma cunha que fecha para cima. Causa (b), os bojos 0,86w e 1,00w, e RUIDO e alem disso e intencional: no simbolo real o lobo de cima e mesmo menor. Medindo bojo a bojo (centros nas linhas 182,5 e 277,5): largura fisica 70,80 contra 116,59, razao 0,6072; dessa razao ln(0,86) responde por 30,2 por cento e a latitude por 69,8 por cento. Ou seja o desenho explica menos de um terco do que o fundador ve.",
   "evidencia": "/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/app/city/plaza/sphere-conteudo.ts:624 (`const escalaX = 1 / Math.max(Math.cos(lat), 0.2)` = 1,54199, calculado so para a linha 230) e :629 (`g.scale(escalaX, 1)` aplicado ao glifo de 250 linhas). Numeros: cos(71,543)=0,31659, cos(49,570)=0,64851, cos(27,598)=0,88622; erro relativo topo -51,18 por cento, base +36,65 por cento, razao 2,7992. Bojos em :590 ([[0.12,0.38,0.86],[0.50,0.38,1.0]]) contribuem 1,163x contra 2,799x.",
   "conserto": "Deletar `escalaX` e o par `g.save()/g.scale/g.restore()` de `pintarCorpoBitcoin` e trocar por largura por linha (ver achado 3). Manter os bojos 0,86 e 1,00 em `marcaBitcoin`, sao corretos.",
   "severidade": "critico"
  },
  {
   "titulo": "Mesmo com a largura certa o topo continua menor: a marca esta 33,0 graus acima do centro optico e a borda de cima cai a 0,574 de escala vertical na vista",
   "causa": "Segunda causa, fora da lista do enunciado, e ela nao se resolve mexendo na largura. O centro optico da silhueta e lat +16,56 graus (linha 418), mas `LINHA_MARCA = 230` poe a marca em lat +49,570 graus. Numa esfera vista de fora a escala aparente na direcao radial e cos(gama), gama = distancia angular ao centro optico: topo gama 54,98 graus, cos 0,5738; centro gama 33,01, cos 0,8386; base gama 11,04, cos 0,9815. A altura aparente da base e 1,7105x a do topo. Combinando com o achado 1 (largura) a AREA APARENTE do topo do glifo vale 0,2801 contra 1,3413 da base: 4,79x. Esse 4,79 e o numero que amarra o relato do fundador. O comentario em :615 admite a origem: a marca subiu de 418 para 230 so para nao colidir com a faixa de dado das linhas 368 a 496, ou seja um conserto de layout pagou com a geometria da peca.",
   "evidencia": "/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/app/city/plaza/sphere-conteudo.ts:619 (`const LINHA_MARCA = 230`) contra :567 (`const LINHA_CENTRO = 418`, que existe e nao e usado por `pintarCorpoBitcoin`). cos(54,98)=0,5738, cos(11,04)=0,9815, razao de altura 1,7105; area 0,2801 contra 1,3413, razao 4,788.",
   "conserto": "Usar `LINHA_CENTRO` (418) em `pintarCorpoBitcoin` e resolver a colisao pelo outro lado: o quadro Bitcoin e identidade, nao dado, entao `slotBitcoin` deve suprimir a faixa (ja passa `faixaFundo: null`) ou baixar a faixa para as linhas 590 a 640, que ainda cabem antes do corte da casca na linha 652,5 (lat -24,69) e comportam a letra pequena de 28 linhas.",
   "severidade": "alto"
  },
  {
   "titulo": "A transformacao correta e uma largura por LINHA de textura, e em canvas 2D isso exige rasterizar o glifo fora e blitar fatia a fatia",
   "causa": "`g.scale` e afim e nao consegue variar com y. A regra exata: fixe a largura ALVO em arco (nao em texels), `arcoW = 0.62 * ALT_L` medida em passos de LED de 0,61513 m, e converta por linha. Para a linha de textura v (0 no topo, 1023 embaixo): lat(v) = PI/2 - PI*(v+0.5)/1024 e largura_em_texels(v) = arcoW / cos(lat(v)). Conferencia com a proposta (centro 418, ALT_L 300, arcoW 186): linha 268 da 253,9 texels, linha 418 da 194,0, linha 568 da 188,8, ou seja o glifo na textura vira uma cunha que ABRE para cima, exatamente o inverso do que esta la hoje. Laco: `const off = document.createElement('canvas'); off.width = 2*Math.ceil(arcoW*L); off.height = Math.ceil(ALT_L*L); marcaBitcoin(offCtx, off.width/2, off.height/2, off.height, '#140B04')` desenhando o glifo SEM distorcao (o 2x horizontal e supersampling para nao serrilhar), depois `g.imageSmoothingQuality='high'` e para k de 0 a ALT_L-1: `const v = topoL + k + 0.5; const larg = (arcoW / Math.cos(Math.PI/2 - Math.PI*v/1024)) * L; g.drawImage(off, 0, k*off.height/ALT_L, off.width, off.height/ALT_L, cx - larg/2, (topoL+k)*L, larg, L)`. Erro residual dentro de uma fatia de 1 linha: d(ln s)/dv = tan(lat)*PI/1024, que na faixa proposta (pior caso lat 42,89) da 0,285 por cento por linha, invisivel; na faixa atual (lat 71,54) daria 0,919 por cento por linha, o que ja obrigaria fatia de 1 linha. Custo: 300 `drawImage` por repintura, entao cachear a cunha pronta num offscreen e blitar N vezes por longitude, uma so vez por troca de quadro.",
   "evidencia": "/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/app/city/plaza/sphere-conteudo.ts:625-631 (o laco atual so translada e escala) e :620-622 (`cy`, `lat`, `alt` derivados de uma unica linha). Passo de LED 0,61513 m confere com o passo vertical medido 2*PI*200,5/2048 = 0,61513, entao 1 texel horizontal no equador = 1 texel vertical, e a formula fecha.",
   "conserto": "Reescrever o corpo de `pintarCorpoBitcoin` com o laco por linha acima e manter `marcaBitcoin` intacta, so trocando a chamada para um contexto offscreen de aspecto verdadeiro (largura = 0,62 * altura).",
   "severidade": "alto"
  },
  {
   "titulo": "Com a correcao certa, N_MARCAS = 6 na linha 230 e geometricamente impossivel: as copias somam 516 graus de longitude",
   "causa": "Erro de forma sob compensacao constante, em funcao dos graus cobertos: razao(D) = cos(latc - D)/cos(latc + D), com D a meia altura em latitude. Hoje latc 49,57 e D 21,97, logo 2,799. Com a correcao por linha esse erro vai a ZERO na metrica da superficie e o unico limite que sobra e o escorco da vista, cos(D) na borda: D 10 graus 1,5 por cento, 15 graus 3,4, 20 graus 6,0, 26,4 graus 10,4, 30 graus 13,4. O limiar em que o olho le como defeito e cerca de 10 por cento, entao D max = 26,4 graus, ou seja 300 linhas de altura. E ai aparece a incompatibilidade: aplicada a correcao certa na marca de hoje, a largura na linha 105 exige 489,6 texels, que sao 86,06 graus de longitude; 6 copias pedem 516 graus de 360 disponiveis, e ate 4 copias deixariam so 3,9 graus de folga. Ou seja o codigo atual so cabe com 6 porque a compensacao errada esta espremendo o topo. RECOMENDACAO: N = 4, uma por quadrante, mesma regra que `pintarCorpoDog` ja adota e justifica em :654; centro na linha 418 (lat +16,56, o centro optico); altura 300 linhas de LED (linhas 268 a 568, 184,5 m de arco, 52,73 graus de latitude). Envelope maximo 44,6 graus de longitude por copia contra passo de 90, sobram 45,4 graus de laranja pleno entre marcas, que e a leitura Las Vegas: uma marca de frente e as vizinhas caindo no limbo. Com N 6 a folga cairia para 15,4 graus e a casca viraria estampa, nao logo. Alcance de leitura da marca de 300 linhas, pela mesma escala da letra grande (34,45 m a 5.639 m): 30,2 km, ou seja legivel de todo o sitio, inclusive do parque a 9,8 km.",
   "evidencia": "/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/app/city/plaza/sphere-conteudo.ts:565 (`const N_MARCAS = 6`) e :626 (`const cx = ((i + 0.5) / N_MARCAS) * w`). Medido: correcao por linha na config atual da 489,6 texels na linha 105 = 86,06 graus, 6 x 86,06 = 516 graus > 360. Proposta 418/300/N4: texels 254 / 194 / 189, escorco de borda 0,896.",
   "conserto": "Em `pintarCorpoBitcoin`: `N_MARCAS = 4`, `LINHA_MARCA = LINHA_CENTRO` (418), `ALT_L = 300`, largura alvo `0.62 * ALT_L` em passos de LED, e a largura por linha do achado 3. Se o fundador quiser ainda mais folga entre copias, 240 linhas com N 4 da 33,0 graus de envelope, 57,0 de folga e escorco de borda 0,933, ao custo de baixar o alcance para 24,2 km.",
   "severidade": "medio"
  }
 ]
}

## diag:tipografia

{
 "achados": [
  {
   "titulo": "O separador so sai a DIREITA, e o corte perigoso e o da FRENTE",
   "causa": "Em repetirNaVolta a montagem e ' '.repeat(esq) + t + (dir > 0 ? SEPARADOR + ' '.repeat(dir - 1) : ''). O · fica colado a direita da copia e o vao esquerdo fica em branco, entao uma copia cortada na FRENTE nao carrega aviso nenhum. O comentario de sphere.ts:1451 a 1458 afirma o contrario (\"com o separador o leitor ve ·18.2M\"): isso so vale para o corte de TRAS. Simulei a funcao em /tmp e varri os 32 azimutes com a janela de 8 casas dos 315 m. Para '418.2M' a saida e | 418.2M· 418.2M· 418.2M· 418.2M·| e 50% dos azimutes entregam fragmento colado na borda esquerda SEM aviso: |18.2M· 4|, |8.2M· 41|, |.2M· 418|, |2M· 418.|. Para '0.00113' sao 63%: |00113·0.| le como numero inteiro e valido. E exatamente o erro de 20x que a nota de sphere.ts:1456 diz ter consertado.",
   "evidencia": "app/city/plaza/sphere.ts:1476 (a linha do out +=); nota falsa em sphere.ts:1451-1458; medido: 50% dos azimutes com fragmento sem aviso em '418.2M', 63% em '0.00113', janela de 8 de 32 casas",
   "conserto": "Em repetirNaVolta, emitir o · dos DOIS lados de cada copia e cobrar as duas casas no denominador: rep = Math.floor(nChars / (t.length + 2)) e out += ' '.repeat(esq) + SEPARADOR + t + SEPARADOR + ' '.repeat(vao - esq), com vao = larg - t.length - 2. Custo medido: para L=6 ('418.2M') rep continua 4 e nao se perde nada; para L=4 ('KRAY') cai de 6 para 5 copias, que e ganho e nao perda (achado 2).",
   "severidade": "critico"
  },
  {
   "titulo": "A repeticao E o texto: rep = floor(nChars/(len+1)) carimba 6 vezes KRAY na volta",
   "causa": "repetirNaVolta nao tem teto de copias, e o numero de copias cresce quando o texto encurta. Rodei a funcao: 'KRAY' em 32 casas devolve |KRAY·KRAY· KRAY·KRAY·KRAY· KRAY·|, seis copias de periodo 5,33. Na janela de 8 casas dos 315 m o observador ve sempre uma copia e meia, ou seja le KRAY KRAY. O '$DOG' tambem sai 6 vezes, 'TOWER' 5, 'WALLET' e 'DOGCITY' 4. Isso e otimo para DADO (94% dos azimutes veem a palavra inteira) e pessimo para ANUNCIO, porque marca repetida em serie le como letreiro travado, nao como mensagem. O fundador esta descrevendo literalmente essa string quando diz \"kray, kray\".",
   "evidencia": "app/city/plaza/sphere.ts:1467 (const rep = Math.max(1, Math.floor(nChars / (t.length + 1)))); saida medida para KRAY em 32 casas: 6 copias, periodo 5,33 casas, 94% dos azimutes com copia inteira",
   "conserto": "Passar repMax pela classe do slot dentro de escrever, e nao deixar a geometria decidir sozinha: rep = Math.min(repMax, Math.floor(nChars / (L + 2))), com repMax = 2 para classe 'anuncio' e 'marca' e sem teto para classe 'dado'. Com repMax 2 e L=4 o periodo vai a 16 casas e a janela de 8 mostra UMA copia por vez, nunca duas.",
   "severidade": "alto"
  },
  {
   "titulo": "A segmentacao que o fundador viu e o SLOT, nao a volta: 3 quadros de 24 s sem marca comum",
   "causa": "slotAnuncio quebra um anuncio unico em tres quadros independentes de MS_ANUNCIO/3 = 24 s cada, e o valor da linha grande muda a cada quadro: 'KRAY' com rotulo 'KRAY WALLET', depois 'WALLET' com 'SELF CUSTODY', depois 'TOWER' com 'SATOSHI PLAZA'. Somando o carimbo espacial do achado 2, quem passa 72 s de frente para a peca le exatamente a sequencia que ele relatou: KRAY, KRAY, self custody, wallet. Nenhum quadro isolado identifica o anunciante alem do primeiro, e a marca some da tela por 48 s dos 72. O arquivo ja documenta a doutrina certa em sphere-conteudo.ts:71-75 (\"um modulo de dado nao e uma frase quebrada em pedacos; e uma sequencia de leituras, cada uma completa em si\") e o proprio anuncio a viola.",
   "evidencia": "app/city/plaza/sphere-conteudo.ts:719 (ms = MS_ANUNCIO/3, 24 s) e 728-733 (os tres quadros); doutrina contrariada em sphere-conteudo.ts:71-75",
   "conserto": "Travar o valor da linha grande em 'KRAY' nos tres quadros de slotAnuncio e variar so o rotulo: quadro('KRAY', 'SELF CUSTODY', ms), quadro('KRAY', 'BITCOIN WALLET', ms), quadro('KRAY', 'SATOSHI PLAZA', ms). Com L=4 na linha grande o valor fica inteiro em 63% dos azimutes a 315 m e em 100% na saturacao, contra os 25% de 'WALLET' (L=6) e 38% de 'TOWER' (L=5) de hoje. A marca deixa de piscar e passa a ser a constante do slot.",
   "severidade": "alto"
  },
  {
   "titulo": "ORC_GRANDE 7 e ORC_PEQUENA 15 valem o dobro do legivel: 9% e 5% dos azimutes a 315 m",
   "causa": "O orcamento foi calibrado por CABER na volta, nao por ser LIDO de um azimute. Com o separador dos dois lados, rep = floor(casas/(L+2)) e periodo P = casas/rep, a fracao de azimutes que ve a copia inteira e (W - L)/P. Tabulei para as duas linhas com W = casas/4 (janela de projeto, 8 e 16 casas a 315 m) e W = casas/3 (saturacao, 10,7 e 21,3). Linha grande de 32 casas: L=3 da 94% a 315 m, L=4 da 63%, L=5 da 38%, L=6 da 25% e o teto atual L=7 da 9% (34% na saturacao). Linha pequena de 64 casas: L ate 8 da 75% ou mais a 315 m e 100% na saturacao, L=10 da 47%, L=12 da 25% e o teto atual L=15 da 5% (30% na saturacao). Os quatro rotulos de marca sao piores que o teto e nunca sao lidos inteiros de distancia nenhuma: 'THE CHAIN THAT CARRIES $DOG' com 27 caracteres precisa de janela de 59 casas e a janela satura em 21,3.",
   "evidencia": "app/city/plaza/sphere.ts:653-654 e app/city/plaza/sphere-conteudo.ts:76-77; medido: L=7 em 32 casas da 9% a 315 m, L=15 em 64 casas da 5%, L=27 da 0% em qualquer distancia",
   "conserto": "Baixar para ORC_GRANDE = 4 e ORC_PEQUENA = 8 (a ultima faixa com 100% na saturacao), e fazer orcamentoViolado() de sphere-conteudo.ts:118 falhar em teste em vez de existir sem chamador. Substituicoes em ingles para os 24 rotulos acima de 8: marcaBtc 'THE CHAIN THAT CARRIES $DOG'>'ON BITCOIN'(10, ou 'BITCOIN' 7); marcaBtcAlt 'BITCOIN BLOCK HEIGHT'>'BTC BLOCK'(9); marcaDog 'THE RUNE ON BITCOIN'>'A BTC RUNE'(10); marcaDogAlt 'MARE TRANQUILLITATIS'>'THE MOON'(8); precoSpot '$DOG USD SPOT'>'USD SPOT'(8); volume '24H VOLUME DOG'>'24H VOLUME'(10, ou 'VOLUME' 6); alta '24H HIGH USD'>'24H HIGH'(8); baixa '24H LOW USD'>'24H LOW'(7); pendentes 'DOG IN MEMPOOL'>'MEMPOOL'(7); emVoo 'DOG IN FLIGHT'>'IN FLIGHT'(9); taxa 'FEE SATS/VB'>'SATS/VB'(7); blocosFaltam 'BLOCKS TO GO'>'TO GO'(5); blocoAlvo 'SNAPSHOT BLOCK'>'TARGET'(6); estimativa 'ESTIMATE ONLY'>'ESTIMATE'(8); snapshotFeito 'SNAPSHOT TAKEN'>'SNAPSHOT'(8); blocosDesde 'BLOCKS SINCE'>'BLOCKS AGO'(10); doacao 'DOG TO DOGCITY'>'DONATED'(7); doadorDe 'FROM WALLET'>'FROM'(4); doacaoOk 'TX CONFIRMED'>'CONFIRMED'(9); bloco 'BITCOIN BLOCK'>'BTC BLOCK'(9); blocoTx 'DOG TX IN BLOCK'>'DOG TX'(6, preserva o rotulo que o fundador pediu); blocoVol 'DOG MOVED'>'MOVED'(5); mintLotes 'PLOTS MINTED'>'MINTED'(6); mintDono 'NEW LANDOWNER'>'NEW OWNER'(9); krayNome 'KRAY WALLET'>'SELF CUSTODY' vira rotulo do quadro 1 e este some; krayCustodia 'SELF CUSTODY'(12, 25%) >'YOUR KEYS'(9, 55% a 315 m); krayTorre 'SATOSHI PLAZA'>'KRAY TOWER'(10); ocioso 'THE SPHERE'(10) fica. Nos valores de slotAnuncio, 'WALLET'(6) e 'TOWER'(5) saem e viram 'KRAY'(4) pelo achado 3.",
   "severidade": "alto"
  },
  {
   "titulo": "Nao existe camada de formatacao: escrever() recebe texto cru e corta em silencio",
   "causa": "escrever chama repetirNaVolta direto com o texto do quadro, e a unica defesa contra texto grande e o if (t.length >= nChars) return t.slice(0, nChars), que corta no meio do caractere sem marca nenhuma e sem erro. Falta tambem controle de FASE: a copia 0 sempre comeca na coluna 0 da textura equirretangular, que e a longitude 0 do mapa e nao tem relacao com o azimute de acesso a praca, entao a posicao horizontal do texto e sorteada pelo UV. A posicao VERTICAL, essa ja esta boa e nao precisa mexer: lGrande = 368 + 18 = 386 e a letra grande ocupa 7 x 8 = 56 linhas, centro na linha 414, quatro linhas (2,46 m pelo passo de 61,51 cm) acima do centro optico medido na linha 418.",
   "evidencia": "app/city/plaza/sphere.ts:1465 (slice silencioso), 1494 (escrever chama repetirNaVolta sem intermediario), 1496 (glifo ausente cai em continue sem aviso), 1622-1627 (nenhum parametro de fase); layout vertical em sphere.ts:473, 508-511, 541",
   "conserto": "Uma funcao pura formatarVolta(texto, casas, {faseAz, repMax}) que devolve sempre length === casas, e escrever passa a receber so a saida dela. Pseudocodigo: W = casas/4 (janela de projeto a 315 m: 8 e 16 casas); Wsat = casas/3 (teto: 10,7 e 21,3); t = normalizar(texto) com caixa alta, espaco unico e char sem glifo resolvido pela tabela; L = t.length. DECISAO, nesta ordem: se L+2 <= W entao REPETIR; senao se L+2 <= Wsat entao REPETIR com aviso em dev (le so de longe); senao se ABREV[t] existe entao return formatarVolta(ABREV[t], casas, opts), uma unica recursao; senao se L+2 <= casas/2 entao UMA_COPIA centrada; senao lanca ErroDeAutoria(t, L, W), porque texto que nao cabe e erro de conteudo e se resolve quebrando em QUADROS, jamais em slice. MONTAGEM: rep = (modo === UMA_COPIA ? 1 : min(repMax, floor(casas/(L+2)))); para k de 0 a rep-1, larg = floor(casas*(k+1)/rep) - floor(casas*k/rep), vao = larg - L - 2, esq = floor(vao/2), out += ' '*esq + '·' + t + '·' + ' '*(vao-esq); o arredondamento acumulado mantem o fechamento exato da volta que a versao atual ja garante. FASE: desloc = round(faseAz/(2*PI)*casas) - round(casas/rep/2) e return girar(out, desloc), rotacao circular que custa zero porque a volta ja fecha, e que poe uma copia CENTRADA no azimute de acesso a praca em vez de na longitude 0 do UV. POS-CONDICOES a testar: out.length === casas; toda copia inteira tem · dos dois lados; todo caractere de out esta em FONTE; nenhum corte silencioso.",
   "severidade": "alto"
  }
 ]
}

## diag:contraste

{
 "achados": [
  {
   "titulo": "Hipotese CONFIRMADA: o painel refletido lava o preto e derruba 44x para 2,9x ao sol",
   "causa": "Em `cor = uPainel * (uAmb + uSolCor * sol + borda * 1.5) + conteudo * (sinal * uGanho * ...)` o primeiro termo e ADITIVO e independe da textura, entao ele entra igual no glifo e no vao. Com uPainel = linear(#2C2C2D) = (0,0272; 0,0272; 0,0277), uAmb = (0,34; 0,35; 0,40) e uSolCor = (1,6; 1,56; 1,48), o piso de painel vale Y = 0,04836 ao sol pleno, 0,02862 a meia luz e 0,00888 na sombra. O conteudo do corpo (#141414 no stop 0,18) emite so Y = 0,00294 a uGanho 0,42, ou seja o painel e 16,5x o emitido ao sol, 9,7x a meia luz e 3,0x na sombra: a casca ociosa e 94,3% reflexao ao sol. Os 44x sao a razao Y(#E8660D)/Y(#121212) = 0,26688/0,006049 = 44,1x, valida so na textura, antes do shader.",
   "evidencia": "sphere.ts:1113 (FS) e sphere.ts:1180 (FS_LISO), a soma; uniformes em sphere.ts:1824 (uSolCor), 1825 (uAmb), 1826 (uPainel), 1793 (uGanho 0,42); chao da faixa #121212 em sphere.ts:1605. Contraste efetivo do dado contra o chao da faixa, calculado em luminancia Rec.709 linear: SOL PLENO 5,08x de perto (sinal do disco = 1/uPreenche = 1,9894) e 3,15x de longe (sinal = 1); MEIA LUZ 4,88x e 2,87x; SOMBRA 16,64x e 10,59x. Nominal 44,1x. Perda ao sol: 93% do contraste. Com a cobertura REAL do traco a 5.639 m (box de 6,22 LEDs por pixel, media de 16 fases, cobertura de pico 0,872) cai para 2,88x, e no vale de uVida (amplitude 0,16, sphere.ts:930) para 2,59x, abaixo do 3:1 de WCAG para texto.",
   "conserto": "Nao ha conserto dentro de `pintarTextura`: o teto matematico da textura ao sol (chao preto puro, cobertura 1,0, uGanho 0,42) e 3,32x, contra os 3,15x de hoje. O denominador so cai mexendo no termo de painel dentro da faixa (ver o achado do `uPainelFaixa`) ou subindo `uGanho`. Registrar no dossie que o numero publicavel do dado e 3,15x ao sol e 10,59x na sombra, e nao 44x. NAO MEDI duas coisas que empurram na mesma direcao: o `toneMapping` do renderer (fora dos dois arquivos autorizados) e o fator de nevoa, ja que os dois materiais tem `fog: true` (sphere.ts:1832 e 1837) e o fog mistura pico e vale para a MESMA cor, cortando o contraste por mais um (1 - fogFactor) justamente aos 5.639 m.",
   "severidade": "critico"
  },
  {
   "titulo": "A alavanca real e um `mix` no painel dentro de `naFaixa`, e ela vale +109% contra +6% das tecnicas de textura",
   "causa": "`naFaixa` ja esta calculado nos dois shaders (FS por `step` das uv, FS_LISO por `asin` e `smoothstep`) e nao e usado para o painel, so para o conteudo e para uVida. Como o painel e o denominador inteiro do contraste, atenua-lo apenas nas 128 linhas da faixa (12,5% da altura da grade, linhas 368 a 496) ataca o problema onde ele existe, e os outros 87,5% da casca continuam em #2C2C2D, ou seja a silhueta contra o ceu preto da Lua nao volta ao defeito do #15161A.",
   "evidencia": "sphere.ts:1113 e sphere.ts:1180 (o `uPainel *` que precisa do fator) e o `naFaixa` das linhas 1096 e 1176. Calculado: painel uniforme com multiplicador m na faixa, ao sol, cobertura de pico 0,872, uGanho 0,42: m = 1,00 da 2,88x; m = 0,60 da 4,47x; m = 0,45 da 5,51x; m = 0,35 da 6,63x. Modulando pela luminancia do proprio conteudo, o pico nao perde nada e so o vao escurece: m = 0,45 da 6,03x (pico Y = 0,1464, vale Y = 0,0243), ou seja +109% sobre os 2,88x de hoje.",
   "conserto": "Nos dois shaders, trocar `uPainel * (uAmb + ...)` por `uPainel * mix(1.0, mix(uPainelFaixa, 1.0, dot(conteudo, vec3(0.2126, 0.7152, 0.0722)) * 4.0), naFaixa) * (uAmb + ...)`, com `uniform float uPainelFaixa` em 0,45. No FS_LISO usar `uCorFaixa` no lugar de `conteudo`. Custo: dois `mix`, um `dot` e um `mul` por fragmento, contra os ~40 ALU do shader liso. O `mix` interno e o que resolve o risco de a faixa virar sulco escuro: o painel so recua onde o LED esta APAGADO e volta a cheio sob o glifo, e alem do `textCull` o conteudo vira `uCorFaixa` (a media medida em pintarTextura, sphere.ts:1668), a luminancia sobe e o painel volta a quase cheio, entao o anel de 3 km nao escurece. Validar com `?stats=1` ao sol pleno antes de fechar o valor de 0,45.",
   "severidade": "alto"
  },
  {
   "titulo": "uGanho 0,42 ja esta a 82% do teto, e o teto nao e o contraste, e o clipping do canal vermelho",
   "causa": "uGanho multiplica so o conteudo emitido, entao ele sobe o numerador e o denominador do contraste efetivo pelo mesmo delta absoluto: CR(g) = (P + g*s*D) / (P + g*s*F), que cresce monotonamente e so tende aos 44x com g tendendo ao infinito. O retorno e forte no comeco e depois trava, mas o limite duro chega antes: dentro do disco do LED, ao sol, o canal R do dado vale 0,807 * 1,9894 * g, e somado ao painel de 0,0489 ele estoura 1,0 em g = 0,592 com uVida neutro e em g = 0,511 com uVida no pico de 1,16. Acima disso o R satura enquanto o G continua subindo: o #E8660D deixa de ser #E8660D e escorrega para amarelo, que e exatamente a regra de paleta que a peca protege.",
   "evidencia": "sphere.ts:1793 (uGanho 0,42), 1810 (uPreenche = pi * 0,16, logo sinal = 1,9894 dentro do disco), 930 (SPHERE_VIDA_AMP = 0,16). Curva calculada ao sol com sinal = 1: g 0,42 da 3,15x; 0,50 da 3,54x; 0,60 da 4,01x; 0,80 da 4,92x; 1,00 da 5,79x; 2,00 da 9,63x. Com a cobertura real do traco a 5.639 m: g 0,42 da 2,88x (2,59x no vale de uVida) e g 0,50 da 3,21x (2,88x no vale).",
   "conserto": "Subir `uGanho` de 0,42 para 0,50 no estado ocioso (sphere.ts:1793 e o padrao de `SphereConteudo.ganho` em sphere.ts:864). A conta: 0,50 e 98% do teto de 0,511 imposto pelo clipping do R com uVida no pico dentro do disco, e paga +12% de contraste efetivo, tirando o vale da respiracao de 2,59x para 2,88x, ou seja o texto ao sol para de cair abaixo de 3:1 no fundo da respiracao. NAO passar de 0,51 sem antes escurecer o painel na faixa, e mesmo com `uPainelFaixa` em 0,45 o teto so vai a 0,525, porque o painel contribui pouco no canal R: quem trava e o proprio dado. NAO MEDI o `toneMapping` do renderer; se for ACES ou AgX o teto nao e um clip duro e sim desaturacao progressiva a partir de ~0,7 linear, o que muda o joelho da curva mas nao a conclusao de que subir ganho custa croma do laranja.",
   "severidade": "alto"
  },
  {
   "titulo": "Das tres tecnicas de textura, so a dilatacao paga, e so com guarda de vizinho; halo escuro e matematicamente impotente aqui",
   "causa": "O halo escuro so pode baixar o chao de #121212 (Y = 0,006049) para 0, e o chao ja e 12,5% do piso de painel ao sol: o ganho maximo do halo e de 3,15x para 3,32x, +5,4%, e ele custa um segundo passe de fillRect no canvas de 2.048 x 1.024 (que ja pesa ~7 ms de thread principal) e ainda BAIXA a media da faixa, que e `uCorFaixa`, a cor do anel aceso alem do textCull e no material liso, ou seja escurece a peca a 3 km para ganhar 5% a 5,6 km. Espessura de traco e inviavel: a matriz e 5x7 com traco de 1, o menor vao interno MEDIDO na tabela e de 1 celula (o miolo do '0', do '8', do 'M'), entao engrossar dentro da matriz fecha os glifos; sair para uma matriz maior obriga a refazer 47 glifos que o comentario declara compartilhados com `construction-fund.tsx:209` e `build_central_tower.py:339`, e mexer no avanco de 8 quebra os 2048/(8*8) = 32 caracteres exatos que fecham a volta sem emenda. Sobra a dilatacao, mas a cega tambem erra: ela ajuda o traco isolado e destroi o miolo.",
   "evidencia": "sphere.ts:1503 (o `fillRect` de uma celula), 1492 (avanco = 8 * escala), 1605 (chao #121212). Simulacao com box de 6,22 LEDs por pixel a 5.639 m, media de 16 fases, ao sol, uGanho 0,42. Haste isolada ('00100'): d = 0 da 2,88x, d = 1 da 3,07x (+6,6%), d = 2 da 3,15x (+9,4%). Alternado 1:1 ('10101', o miolo do 0 e do M): d = 0 da 3,09x, d = 1 CAI para 2,74x (-11%), d = 2 CAI para 2,03x (-34%). Vao interno de 1 celula = 8 LEDs, que d = 2 reduz a 4 LEDs, ou 0,64 px de tela a 5.639 m, abaixo do resolvivel.",
   "conserto": "Dilatacao de 1 LED por lado COM GUARDA DE VIZINHO, dentro de `escrever` em sphere.ts:1503, substituindo o fillRect por: `const dd = Math.max(1, Math.round(1 * f)); const on = (cc, rr) => cc >= 0 && cc < 5 && rr >= 0 && rr < 7 && ((glifo[cc] >> rr) & 1); const el = (!on(c-1,r) && !on(c-2,r)) ? dd : 0; const er = (!on(c+1,r) && !on(c+2,r)) ? dd : 0; const et = (!on(c,r-1) && !on(c,r-2)) ? dd : 0; const eb = (!on(c,r+1) && !on(c,r+2)) ? dd : 0; g.fillRect(Math.round(x0 + c*s) - el, Math.round((linhaTopo + r*escala)*f) - et, Math.ceil(s) + el + er, Math.ceil(s) + et + eb)`. Ele so expande para o lado que tem DUAS celulas apagadas, entao o miolo do '0' e do 'M' fica intacto e as hastes do 'H', do '1' e do 'L' engordam. Resultado: +6,6% no caso limitante, 0% de perda, mesma quantidade de fillRect, zero casa perdida na volta, fonte compartilhada intacta. O `Math.max(1, ...)` cobre o perfil de textura reduzida, onde f = texW/2048 (sphere.ts:1759) pode valer 0,5 e 1 LED nao seria representavel em pixel de canvas inteiro.",
   "severidade": "medio"
  }
 ]
}

## projeto:tecnica

{
 "nome": "GRAMÁTICA DE CASCA: quatro gestos num vec4, baralho de peles e escada de raridade",
 "partido": "A peça tem HOJE um único ponto de exclamação e o gasta seis vezes por hora.\n\nO que medi na programação que está no ar:\n\n· A volta do ANEL é 6 x 48 s de dado + 72 s de intervalo = **360 s exatos**, 10 voltas por hora. A fatia de anúncio real é **20,0%**, não os 27,27% do docstring: `fracaoNominalAnuncio` tem padrão `nModulos = 4` e o anel embarcado tem 6 posições de dado. O teto de 30% nunca é o gargalo de nada que eu acrescentar, porque tudo que acrescento é dado e só empurra a fatia para baixo.\n· Casca inteira no ar: `marca-btc` 48 s + `marca-dog` 48 s = **26,7% do tempo**, e são sempre os MESMOS DOIS bitmaps. Numa hora o espectador vê o mesmo ₿ laranja 10 vezes e o mesmo $DOG 10 vezes. Isso não é programa, é papel de parede com dois quadros.\n· Os dois momentos de casca não são igualmente espaçados: o vão depois do `marca-btc` é 96 s (volume + pulso) e depois do `marca-dog` é 168 s (snapshot + anúncio + preço), razão **1,75:1**. O comentário do escalonador promete \"a cada ~2,8 min\", que é a média e não o que se vê. A casa prefere simetria em elemento repetido.\n· Todo evento produz o MESMO gesto: `entrarNo` chama `o.pulsar?.(1)` com 1 cravado, e o envelope é sempre 600 ms de subida, 2,6 s de queda, `uEvento` até 0,88. Bloco, doação e mint são visualmente indistinguíveis a qualquer distância. Com 144 blocos por dia, um a cada ~10 min, o gesto mais raro da peça virou o mais repetido dela. É por isso que o bloco lê como notificação: não porque falta brilho, e sim porque não tem FORMA própria nem peso próprio.\n· E o alcance está invertido em relação à audiência. Com pxAng 6,787e-4, o disco da esfera mede 590.835/d pixels: 196,9 px a 3 km, 29,5 px a 20 km, **10,0 px a 59,1 km**. A letra grande morre em 5.639 m. Ou seja o gesto de casca inteira atravessa **10,5x mais longe que a letra**, e a peça investe 100% do vocabulário no que morre primeiro.\n\nO PARTIDO: separar PONTUAÇÃO de CONTEÚDO.\n\nConteúdo é a faixa: texto, números, frequente, perto. Já está resolvido e não muda.\nPontuação é a casca inteira: rara, com FORMA, movida por uniforme, feita para 20 km e para o clipe do X. Hoje ela tem uma palavra só (\"clarão\"). Precisa de quatro, e as quatro cabem num vec4.\n\nE a raridade tem de vir da CADEIA, não do relógio. Se todo bloco ganha cerimônia, cerimônia não vale nada. `pulsar()` já aceita intensidade e o chamador joga fora: um bloco com 0 tx de DOG e um bloco com 40 tx de DOG são o mesmo clarão. É o desperdício mais caro do módulo, porque o argumento já existe.\n\nRegra de escala que sai da conta e comanda o desenho do baralho: a partir de ~59 km a esfera é um ponto de 10 px e o espectador só enxerga a MÉDIA da pele. Duas peles com a mesma média são a mesma peça de longe. Por isso o baralho alterna média clara e média escura, que é justamente o que as duas peles atuais já fazem por acaso (`pintarCorpoBitcoin` é laranja chapado, `pintarCorpoDog` é `#0A0B0D`). Isso vira regra escrita, não coincidência.",
 "implementacao": "CAMADA 1: UM VEC4, QUATRO GESTOS, ZERO PROGRAMA NOVO\n\n`sphere.ts`, junto de `uEvento` (bloco de uniformes, ~linha 1799):\n\n    uOnda: { value: new THREE.Vector4(0, 0, 0, 0) }   // fase 0..1, modo, largura, força\n\nEm `FS` e em `FS_LISO`, o MESMO trecho, termo a termo (o arquivo já declara essa invariante: se as duas contas divergirem a peça muda de cor ao cruzar o degrau de fillrate). Custo ~10 ALU, e ele não precisa de nenhuma conta nova:\n\n· `FS` já tem `lat` (do `asin`) e já tem `naFaixa`.\n· `FS_LISO` já tem `v` (do mesmo `asin`) e já tem `naFaixa`.\n\n    // fora da faixa: a onda NUNCA lava o número\n    float s = sin(lat);                       // FS_LISO usa (v - 0.5) * 2.0\n    float alvo = mix(1.0, -0.4, uOnda.x);     // a frente varre do polo até abaixo da faixa\n    float banda = 1.0 - smoothstep(0.0, uOnda.z, abs(s - alvo));\n    float nivel = 1.0 - smoothstep(alvo, alvo + uOnda.z, s);\n    float conv  = 1.0 - smoothstep(0.0, uOnda.z, abs(abs(s - 0.285) - (1.0 - uOnda.x)));\n    float g = uOnda.y < 0.5 ? 0.0\n            : uOnda.y < 1.5 ? banda\n            : uOnda.y < 2.5 ? nivel : conv;\n    cor = mix(cor, uCorEvento, g * uOnda.w * (1.0 - naFaixa));\n\nOs quatro modos e o que cada um SIGNIFICA (é aqui que mora o programa editorial):\n\n  1 VARRE   uma banda desce do polo norte e assenta na faixa. Lê como \"alguma coisa POUSOU na peça\".\n  2 ENCHE   a tinta sobe do corte até um nível proporcional. Lê como MEDIDOR, e é o único gesto que carrega informação em vez de pontuação.\n  3 CONVERGE  duas bandas simétricas vêm dos dois polos PARA a faixa. Lê como \"a cidade RECEBEU\".\n  4 ABRE    o inverso, da faixa para os polos. Lê como \"a cidade ENTREGOU\".\n\nAtribuição:\n  bloco minerado    → VARRE, 1,4 s\n  doação/compra     → CONVERGE, 1,8 s\n  mint de terreno   → ABRE, 1,8 s\n  módulo snapshot   → ENCHE, uma vez por volta, nível = fração andada até o bloco 966.670\n\nHoje os três eventos são o mesmo clarão. Com isto, um espectador a 20 km distingue \"chegou dinheiro\" de \"saiu terra\" sem ler uma letra.\n\nEnvelope na CPU, dentro do `update()`, no mesmo lugar em que o envelope de `pulsoT0` já é calculado (mesmo `relogio()`, mesmo `suave()`, mesmas três comparações). API nova ao lado de `pulsar()`:\n\n    ondear(modo: number, ms: number, forca = 1)\n\nNão sobrecarregue `pulsar()`: o anel e a casca têm donos diferentes e o dia em que forem o mesmo argumento alguém vai pulsar o anel querendo varrer a casca.\n\nCAMADA 2: BARALHO DE PELES (novidade de graça)\n\nO repaint de 7 ms JÁ acontece na entrada de cada slot. Trocar QUAL `pintarCorpo` roda custa exatamente zero a mais. `slotBitcoin` e `slotDog` passam a sortear de um baralho, sem repetir até esgotar:\n\n  Baralho BTC   (a) ₿ em negativo sobre laranja, a atual, média CLARA\n                (b) polaridade invertida: casco `#0A0B0D`, ₿ em `#E8660D`, média ESCURA\n                (c) a altura do bloco corrente em letra de 90 linhas dando a volta, 4 cópias, sem ₿ (numa peça nativa de cadeia o número É a marca), média escura\n                (d) bandeira: casca inteira em `#E8660D` com UMA cinta escura de 24 linhas, sem glifo nenhum. É a pele que ainda funciona a 59 km, e é a mais barata de todas.\n  Baralho DOG   (a) $DOG laranja sobre escuro, a atual, média escura\n                (b) polaridade invertida, média clara\n                (c) `DOGCITY` em letreiro espaçado, 3 cópias (é a logo da casa, JetBrains Mono espaçada)\n                (d) a runa em glifo repetido, 6 cópias, quando o vetor existir\n\nRegra escrita do baralho: **cartas consecutivas alternam média clara e média escura**, porque a média é a única coisa que a maior parte da audiência vê. Regras já estabelecidas que continuam valendo: N cópias igualmente espaçadas, largura dividida por `cos(lat)`, polo só cor, `faixaFundo: null` em toda pele que pinta a casca inteira.\n\nEfeito medido: com 4 + 4 cartas, a primeira repetição de um mesmo bitmap sai de 6 min para 24 min, e uma hora de transmissão mostra 8 imagens de casca inteira distintas em vez de 2.\n\nCAMADA 3: A ESCADA DE RARIDADE (o que segura horas)\n\n  48 s        quadro troca dentro do slot (já existe, 16 a 24 s por quadro)\n  6 min       duas peles de casca inteira por volta, alternando média\n  ~10 min     bloco, com VARRE e PESO PRÓPRIO (ver abaixo)\n  1 h         THE HOUR: um slot fora do anel, na virada da hora UTC, 24 s, com uma pele que só aparece na hora cheia. É o marco que faz o espectador de live sentir o tempo passar, e transforma a esfera no relógio da cidade. Custa 24 s por hora, 0,67% do ar.\n  ~1,7 h      altura de bloco terminada em 0 (a cada 10 blocos): a mesma VARRE com o dobro da largura. Custo zero.\n  ~6,9 dias   altura terminada em 000: cerimônia inteira, VARRE + ENCHE + as três peles em sequência.\n  data única  bloco 966.670: os últimos 10 blocos rodam ENCHE com o nível subindo a cada bloco, e o bloco do snapshot leva o único gesto que a peça nunca usou antes. Guardar UM gesto sem estrear é decisão editorial, não sobra.\n  dia lunar   o módulo já recebe o vetor do sol por `iluminar()`. Programar as peles de média CLARA para a parte escura do dia lunar, quando a esfera é o objeto mais brilhante do quadro. Zero código além de ler o que já chega.\n\nO BLOCO DE BITCOIN, ESPECIFICADO (o pedido explícito)\n\nHoje: `empilhar(eventoBloco)` interrompe, `pulsar(1)`, três quadros de 8 s. Um clarão e um texto, igual ao anterior e igual ao próximo: notificação.\n\nProposto, 26 s, ainda UMA interrupção e ainda ZERO repaint extra:\n\n  ATO 1, CHEGADA (0 a 1,4 s)   VARRE do polo norte até assentar na faixa. A faixa ainda não mudou. Alguma coisa está descendo pela peça.\n  ATO 2, POUSO (1,4 a 4,6 s)   o swell de `uEvento` que já existe, mas com INTENSIDADE PROPORCIONAL AO PESO DO BLOCO: `pulsar(0.45)` para bloco sem DOG, `pulsar(1.0)` na mediana diária de `last_dog_block_count`, `pulsar(1.6)` acima do percentil 90. O argumento já existe na assinatura e é jogado fora hoje. Um bloco gordo de DOG passa a ser visivelmente mais pesado a 20 km.\n  ATO 3, A CONTA (4,6 a 26 s)  os três quadros atuais (#altura / n tx / volume), intocados.\n\nE o bloco vazio tem leitura HONESTA e menor: sem VARRE, pulso curto de 0,45 só no anel, 16 s de quadros. Com metade dos blocos quietos, dar cerimônia a todos é o mesmo que não dar a nenhum. Dando a cerimônia cheia só acima da mediana, o gesto grande cai de 6 para ~3 vezes por hora, que é a diferença entre marco e notificação, e custa UMA comparação.\n\nONDE ENCOSTAR, ARQUIVO A ARQUIVO\n\n`sphere.ts`\n  · uniforme `uOnda` junto de `uEvento`\n  · o mesmo trecho em `FS` e `FS_LISO`, depois do `mix` de `uEvento`, multiplicado por `(1.0 - naFaixa)`\n  · envelope dentro do `if (pulsoT0 > 0)` do `update()`\n  · `ondear()` no objeto devolvido, ao lado de `pulsar()`\n\n`sphere-conteudo.ts`\n  · `interface Slot` ganha `onda?: { modo: number; ms: number; forca: number }`\n  · `entrarNo` dispara junto do `o.pulsar?.(1)` que já está lá (uma linha)\n  · `eventoBloco` devolve o peso e passa para `pulsar`, em vez do 1 cravado\n  · `slotBitcoin`/`slotDog` indexam o baralho por um contador que anda na entrada\n  · ANEL reordenado para `['preco','volume','marca-btc','pulso','anuncio','marca-dog','snapshot']`: vãos de **120 s e 144 s** (razão 1,20) contra os 96 s e 168 s de hoje (razão 1,75)\n  · THE HOUR entra por `fila.push(slot)` DIRETO, sem passar por `empilhar()`: `proximoSlot` já drena a fila antes do anel, então ele estreia no próximo limite natural e não decepa um módulo de dado no meio. `empilhar()` só devolve o resto do slot quando ele é anúncio; um módulo de dado interrompido perde o tempo dele.",
 "custo": "THREAD PRINCIPAL: inalterada.\nO ciclo atual gasta 1 repaint a cada 18,9 s, ou seja **190 repaints por hora x 7 ms = 1,33 s, 0,037% da thread**. O baralho de peles adiciona ZERO repaints (troca o bitmap de um repaint que já ia acontecer). THE HOUR adiciona ~2 por hora. Total depois: 0,038%.\n\nBARRAMENTO: o vec4 a 60 Hz são 960 B/s, **3,46 MB por hora**, contra os **1.524 MB por hora** que os repaints de 8 MB já pagam. A camada animada inteira custa **0,23%** do que a camada estática já gasta. É a razão de todo efeito novo nascer como uniforme.\n\nGPU: ~10 ALU no `FS` (que já roda `asin`, `atan`, dois `log2` e duas buscas de textura) e ~10 no `FS_LISO` (que tem ~40 ALU). O trecho não faz busca de textura nem derivada, e reaproveita `lat`/`v` e `naFaixa`, que os dois shaders já calculam. Nenhum `asin` novo.\n\nPROGRAMAS DE SHADER: **zero novos**. Os quatro modos são um `uniform float` com três `mix`/ternário, não `#define`. A cena já tem ~555 programas compilados.\n\nTETO DE PROPAGANDA: intocado, e na verdade folgado. A volta real é 360 s com 20,0% de anúncio contra o teto de 30%. Cada slot que eu acrescento é dado e empurra a fatia para baixo (com THE HOUR a volta média da hora vira 384 s e a fatia cai para 18,75%).\n\nREDE: zero chamadas novas. O peso do bloco sai de `last_dog_block_count`, que já vem no mesmo payload do feed; a mediana e o percentil 90 são uma janela deslizante de 144 amostras em memória, ~1 KB.\n\nTEMPO DE OBRA, na minha estimativa e não medida: camada 1 é um uniforme, dois trechos de shader gêmeos e um envelope; camada 2 são 6 funções de canvas de ~40 linhas cada, cada uma verificável offline pelo mesmo caminho que `orcamentoViolado()` usa; camada 3 é reordenar um array e duas condições.",
 "riscos": "1. MODO POR `#define` VIRA PERMUTAÇÃO DE PROGRAMA. Se alguém implementar os quatro gestos com `material.defines` ou quatro shaders, são 4 modos x 2 materiais = 8 programas novos numa cena que já tem ~555, e o primeiro gesto de cada tipo engasga a live compilando. O modo TEM de ser `uniform` com ramo de dado.\n\n2. A ONDA LAVANDO O NÚMERO. Sem o `(1.0 - naFaixa)` a varredura passa por cima do preço e a peça mente por 1,4 s em 401 m. `naFaixa` já existe nos dois shaders: é uma multiplicação, não uma conta nova.\n\n3. O GESTO SÓ NO `FS`. O celular troca para `FS_LISO` além do degrau de fillrate, que é exatamente a faixa de distância em que o gesto é a ÚNICA coisa que sobra. Efeito que não existe no liso some justamente longe, que é o defeito que o fundador já apontou uma vez nesta peça.\n\n4. AS DUAS CONTAS DIVERGIREM. `FS` e `FS_LISO` têm de receber o trecho termo a termo. Se diferirem, a peça muda de cor ao cruzar o degrau e o degrau vira visível, que é a única coisa que ele não pode ser.\n\n5. THE HOUR ALIMENTANDO O ANÚNCIO NUM APAGÃO. `montar()` só escreve `ultimoDadoValido` no ramo dos módulos de cadeia, de propósito: com tudo fora do ar, `podeAnunciar` recusa o intervalo depois de 96 s e a peça fica calada em vez de virar outdoor. Se THE HOUR (ou qualquer slot novo) escrever `ultimoDadoValido`, ele mantém o anúncio vivo para sempre com zero dado no ar. Relógio não é dado de cadeia.\n\n6. RARIDADE INFLACIONADA. Se a VARRE for para todo bloco, em uma semana ela é a nova bola de discoteca. A trava é de conteúdo (só acima da mediana de tx de DOG), e ela tem de ser código, pelo mesmo motivo que `TETO_ANUNCIO` é código: a pressão de \"só desta vez\" é permanente.\n\n7. FREQUÊNCIA. A doutrina da casa está em `SPHERE_VIDA_PERIODO_MS`: 0,083 Hz é maré, acima de ~3 Hz é estroboscópio. Uma varredura de 1,4 s é passagem ÚNICA, não periódica, e por isso é legítima. Encadear varreduras em sequência sem intervalo recria o estroboscópio por outro caminho. Um gesto por evento, e evento não se acumula.\n\n8. GESTO DENTRO DO INTERVALO COMERCIAL. O anúncio já roda em ganho 0,90 o tempo todo. Movimento ali é exatamente a inversão que o teto existe para impedir, e além disso o parceiro comprou uma peça parada. Nenhum modo de onda durante `classe === 'anuncio'`.\n\n9. NÚMERO VELHO NA COPY DE MARKETING. Os comentários de `sphere.ts` e de `construirPodio` ainda falam em \"peça de 196 m\", \"disco de 96 px a 3 km\" e \"linha de 180,0 m de largura\", que são da geometria anterior. Contra `SPHERE_DIAM = 401.0` o disco a 3 km é de **196,9 px** e os 181,0 m são o RAIO do círculo de contato com o piso, não a largura. Se o plano de marketing sair citando 196 m, a casa publica o número errado sobre a própria peça. Conferir antes de qualquer press kit; eu não toquei em arquivo nenhum.\n\n10. DEGRADAÇÃO DO GESTO COM A DISTÂNCIA, medida: a varredura viaja 0,358 do diâmetro do disco em 1,4 s, ou seja 50,2 px/s a 3 km, 7,5 px/s a 20 km e 2,6 px/s a 59 km. Além de ~20 km ela deixa de ser movimento legível e quem carrega o momento passa a ser a mudança de MÉDIA (o `uEvento` e a polaridade da pele). Isso não é defeito, é a escada: só não invente um gesto cujo único canal seja movimento e espere que ele chegue a 50 km.\n\n11. CLIPE DO X. O gesto inteiro tem de fechar em menos de 5 s (1,4 s de varredura + 3,2 s de swell = 4,6 s) para caber numa reprodução automática e sobreviver a um reencode de 480p. Glifo de 9 px não sobrevive a essa compressão; mudança de média da casca inteira sobrevive. É o argumento quantitativo de por que a casca, e não a letra, é o que sustenta o plano de marketing."
}

## projeto:editorial

{
 "nome": "FX-EIXO: um campo escalar, cinco efeitos, quatro uniformes, zero programa novo",
 "partido": "O partido cabe em uma linha: todo efeito de casca inteira vira funcao de UM escalar, s = dot(normalize(vP), uFxEixo), com uFxEixo unitario escrito pela CPU.\n\nPor que esse escalar e nao latitude ou longitude:\n\n1. Ele ja existe nos dois materiais. FS calcula `vec3 p = normalize(vP)` na primeira linha; FS_LISO calcula `normalize(vP)` dentro do `v` da faixa. O campo custa um dot3, 3 ALU, nos dois. Paridade termo a termo sai de graca, que e a regra que o proprio arquivo impoe (\"se as duas divergirem, a peca MUDA DE COR ao cruzar o degrau\").\n\n2. Ele nao tem costura. O arquivo ja documenta que `atan(p.z, p.x)` estoura em mais ou menos pi e que `fwidth` ali desenha uma linha de erro no meridiano para sempre. Um wipe horizontal escrito como angulo herda essa costura; escrito como dot contra um eixo horizontal, nao tem costura nenhuma, porque nunca existe angulo.\n\n3. Ele e LINEAR NA TELA. Para um observador distante, a altura projetada de um ponto da casca e R*sin(lat) = R*s. Entao velocidade constante em s e velocidade constante em pixels, e espessura constante em s e espessura constante em pixels. Nenhuma outra parametrizacao tem isso.\n\n4. Ele ja e o eixo da peca sem ninguem ter notado. O corte da casca esta em lat -24,69 graus, s = -0,4177; o meio aritmetico do campo visivel e (-0,4177 + 1)/2 = 0,2911, ou lat 16,93 graus. O \"centro optico da silhueta\" publicado, +16,56 graus, e s = 0,2850. Os dois batem dentro de 0,006 em s, 1,2 m de casca. O centro optico ja era o meio do campo s; eu nao remedi, so reconheci.\n\n5. Um so campo cobre a familia toda, trocando apenas o EIXO e a lei de movimento da frente:\n   . uFxEixo = (0,1,0), frente andando: varredura de latitude, a barra de luz que sobe.\n   . uFxEixo horizontal girando: meridiano varrendo em azimute, ler igual de qualquer lado.\n   . uFxEixo = normalize(cam - centro), frente de 1 a -1: pulso radial saindo do ponto que encara quem olha, que e o ripple da Sphere de Vegas.\n   . uFxFrente.y = 0 (nitidez zero): a mascara vale 1 na casca inteira e o mesmo codigo vira efeito GLOBAL, sem enum, sem branch a mais. Cortina de transicao e flash em negativo saem daqui.\n   . onda periodica sobre s: respiracao viajante, 3 cristas na altura visivel.\n\nE a divisao de trabalho e dura: FORMA vem da textura (pintarCorpo, 7 ms, uma vez), VIDA vem de uniforme (por quadro). O emoji da Sphere de Vegas e uma textura; o que a familia FX faz e o emoji CHEGAR, PISCAR e SAIR. Nenhum efeito aqui pede pintar().",
 "implementacao": "## 1. OS UNIFORMES (17 floats, 5 entradas, objeto ja compartilhado pelos dois materiais)\n\n```ts\nuFxAtivo:  { value: 0 },                                  // float, porta de uniforme\nuFxEixo:   { value: new THREE.Vector4(0, 1, 0, 0) },      // xyz eixo unitario; w poupa-faixa 0..1\nuFxFrente: { value: new THREE.Vector4(2, 0, 0, 0) },      // x s0; y 1/meia-largura; z tinta; w brilho\nuFxTinta:  { value: new THREE.Vector4(0.79, 0.16, 0.02, 0) }, // rgb linear; a inversao\nuFxOnda:   { value: new THREE.Vector4(0, 0, 0, 0) },      // x amp; y numero de onda; z fase; w cobertura\n```\n\nEntram no MESMO objeto `uniformes` de sphere.ts:1787, que ja e passado aos dois ShaderMaterial. Nenhum uniforme novo do lado JS por material, nenhum #define, nenhum programa novo: os 555 programas continuam 555.\n\nConvencoes que fazem a familia caber em tao pouco:\n- `uFxFrente.y = 0` significa GLOBAL (mascara 1 em toda a casca). Nao existe modo, existe nitidez zero.\n- `uFxOnda.w` e cobertura chapada, somada a tinta da frente e saturada em 1: cortina e faixa colorida compartilham UM mix.\n- `uFxEixo.w` e o \"poupa-faixa\": 1 protege o texto do dado da onda e da inversao, 0 deixa o efeito passar por cima. Slot de dado usa 1, slot de marca usa 0.\n\n## 2. GLSL, FS (material cheio)\n\nDeclaracoes novas, junto das que ja existem. `uMedia` ja existe no objeto de uniformes e so nao era declarado aqui:\n\n```glsl\n  uniform vec3  uMedia;\n  uniform float uFxAtivo;\n  uniform vec4  uFxEixo;\n  uniform vec4  uFxFrente;\n  uniform vec4  uFxTinta;\n  uniform vec4  uFxOnda;\n```\n\nBloco novo, colocado DEPOIS de `conteudo` e de `naFaixa` e ANTES da montagem da cor. Nao ha texture2D dentro do `if`: as duas buscas continuam em fluxo uniforme, que e obrigatorio para o LOD nao virar indefinido.\n\n```glsl\n    // ── FX: a familia de casca inteira ─────────────────────────────────────\n    // ⚠️ UM CAMPO ESCALAR E CINCO EFEITOS. s = dot(p, eixo) e a MESMA conta do\n    // FS_LISO, termo a termo, entao a peca nao muda de cor ao cruzar o degrau de\n    // fillrate. O `if` e sobre UNIFORME: o salto e coerente em todas as lanes,\n    // nao ha divergencia, e a peca ociosa paga uma comparacao escalar.\n    float fxG = 1.0;   // multiplicador do ganho do conteudo\n    float fxT = 0.0;   // peso da tinta chapada\n    if (uFxAtivo > 0.5) {\n      float s = dot(p, uFxEixo.xyz);\n      // cone ao quadrado, nao smoothstep: derivada zero na borda de fora, que e\n      // o que impede a barra de mostrar aresta, e duas instrucoes mais barato.\n      float m = max(0.0, 1.0 - abs(s - uFxFrente.x) * uFxFrente.y);\n      m *= m;\n      // ⚠️ O NUMERO E POUPADO POR PEDIDO, NAO POR PADRAO. Slot de dado escreve\n      // uFxEixo.w = 1 e a onda passa por fora da faixa; slot de marca escreve 0\n      // e o efeito atravessa a peca inteira.\n      float fora = 1.0 - naFaixa * uFxEixo.w;\n      float ti = uFxTinta.a * m * fora;\n      // ⚠️ A INVERSAO E EM TORNO DA MEDIA DO PAINEL, NAO DE 1.0. Refletir em\n      // uMedia conserva o brilho medio do quadro: e o mesmo argumento de energia\n      // que a mascara do disco ja usa. Inverter contra 1.0 estouraria a pele\n      // laranja e escureceria o casco preto ao mesmo tempo.\n      float ia = 1.0 - 2.0 * ti;\n      float ib = 2.0 * ti;\n      conteudo = max(vec3(0.0), conteudo * ia + uMedia * ib);\n      fxG = 1.0 + uFxFrente.w * m\n                + uFxOnda.x * sin(s * uFxOnda.y - uFxOnda.z) * fora;\n      fxT = min(1.0, uFxFrente.z * m + uFxOnda.w);\n    }\n```\n\nTres linhas alteradas no fim do main (o resto do shader nao muda):\n\n```glsl\n    float sinalM = 0.35 + 0.65 * sinal;          // fatorado: o evento ja usava\n    vec3 cor = uPainel * (uAmb + uSolCor * sol + borda * 1.5)\n             + conteudo * (sinal * uGanho * fxG * mix(1.0, uVida, naFaixa));\n    cor = mix(cor, uCorEvento * sinalM, uEvento * 0.88);\n    cor = mix(cor, uFxTinta.rgb * sinalM, fxT);   // a MESMA forma do evento: a\n                                                  // grade do LED continua a vista\n```\n\n## 3. GLSL, FS_LISO (o material barato)\n\nUma linha existente muda, para o `p` ser reaproveitado (o normalize ja era pago):\n\n```glsl\n    vec3 p = normalize(vP);\n    float v = asin(clamp(p.y, -1.0, 1.0)) * 0.31830989 + 0.5;\n```\n\nBloco novo depois de `naFaixa`:\n\n```glsl\n    // ⚠️ MESMO CAMPO, MESMA MASCARA, MESMA LEI. O que muda e o que a mascara\n    // pinta: aqui nao ha textura, entao a INVERSAO troca faixa por corpo. De\n    // longe a leitura e identica (o anel apaga e o casco acende), e custa um\n    // mix escalar no lugar de um mix vec3.\n    float fxG = 1.0;\n    float fxT = 0.0;\n    float nf  = naFaixa;\n    if (uFxAtivo > 0.5) {\n      float s = dot(p, uFxEixo.xyz);\n      float m = max(0.0, 1.0 - abs(s - uFxFrente.x) * uFxFrente.y);\n      m *= m;\n      float fora = 1.0 - naFaixa * uFxEixo.w;\n      nf  = mix(naFaixa, 1.0 - naFaixa, uFxTinta.a * m * fora);\n      fxG = 1.0 + uFxFrente.w * m\n                + uFxOnda.x * sin(s * uFxOnda.y - uFxOnda.z) * fora;\n      fxT = min(1.0, uFxFrente.z * m + uFxOnda.w);\n    }\n    vec3 cor = uPainel * (uAmb + uSolCor * sol + borda * 1.5)\n             + mix(uMedia, uCorFaixa * uVida, nf) * (uGanho * fxG);\n    cor = mix(cor, uCorEvento, uEvento * 0.88);\n    cor = mix(cor, uFxTinta.rgb, fxT);\n```\n\nA assimetria entre os dois (FS multiplica a tinta por `0.35 + 0.65*sinal`, LISO nao) e a mesma que o evento ja tem hoje, e ela e exata no cruzamento: longe, `k` vai a 0, `sinal` vai a 1 e `sinalM` vai a 1,0. Os dois materiais coincidem no ponto de troca por construcao.\n\n## 4. O MOTOR NA CPU, dentro do update() que ja roda\n\nZero alocacao por quadro (`.set()` em Vector4 pre-alocado), um `sin` ou `cos`, uma dezena de operacoes escalares.\n\n```ts\nexport type SphereFx = 'varredura' | 'meridiano' | 'onda' | 'radial' | 'cortina' | 'negativo'\n\n/** o campo so existe de sin(-24,69 graus) para cima: a casca e cortada ali */\nexport const SPHERE_S_MIN = -0.4177\n/** meia-largura minima em s para a frente nao bater na grade de LED (5 linhas) */\nexport const SPHERE_FX_HW_LED = 0.008\n/** meia-largura minima para a frente medir 3 px de tela */\nconst hwTela = (d: number, pxAng: number) => (1.5 * d * pxAng) / SPHERE_R\n/** fracao da ALTURA da tela que o disco ocupa; nao depende de pxAng, so do fov */\nconst discoRel = (d: number) => (2 * SPHERE_R) / (d * 0.7330)\n\nlet fxNome: SphereFx | null = null\nlet fxT0 = 0, fxDur = 0, fxForca = 1\nlet fxMeio: (() => void) | null = null\nconst fxCam = new THREE.Vector3()\n\nconst fxDesligar = () => {\n  fxNome = null; fxMeio = null\n  uniformes.uFxAtivo.value = 0\n  uniformes.uFxFrente.value.set(2, 0, 0, 0)\n  uniformes.uFxOnda.value.set(0, 0, 0, 0)\n  uniformes.uFxTinta.value.w = 0\n}\n\n// dentro de update(), depois de uVida/uEvento:\nif (fxNome) {\n  const k = (t - fxT0) / fxDur\n  if (k >= 1) fxDesligar()\n  else {\n    // ⚠️ A FRENTE POR PIXEL SO EXISTE ONDE A CASCA INTEIRA CABE NA TELA. A\n    // 300 m o disco mede 1,82 vez a altura da tela: uma barra atravessando a\n    // esfera nao e composicao, e um clarao. Abaixo de meia tela o efeito\n    // DEGRADA para o canal chapado, que ja existe e custa 3 instrucoes.\n    const perto = discoRel(d) > 0.5            // d < 1.094 m\n    const hw = Math.max(SPHERE_FX_HW_LED, hwTela(d, uniformes.uPxAng.value), hwNominal)\n    ...\n    uniformes.uFxAtivo.value = perto ? 0 : 1\n    if (perto) uniformes.uEvento.value = Math.max(uniformes.uEvento.value, env * 0.6)\n  }\n}\n```\n\nLeis de movimento, uma por efeito (`k` de 0 a 1, `env` = envelope suave ja existente):\n\n```ts\n// A. VARREDURA: barra de luz subindo. Eixo fixo, s0 linear em s (velocidade\n//    constante em PIXELS, que e a propriedade do campo).\neixo.set(0, 1, 0, 1)                                  // poupa a faixa\nfrente.set(THREE.MathUtils.lerp(SPHERE_S_MIN - hw, 1 + hw, k), 1 / hw, 0, 1.8)\n\n// B. MERIDIANO: o eixo GIRA, a frente fica em s = 0. O conjunto aceso e o\n//    grande circulo perpendicular ao eixo: de qualquer azimute e uma barra\n//    vertical de 40 m cruzando o disco, e quando o eixo aponta para a camera o\n//    circulo vira a propria silhueta e o aro inteiro acende. De graca.\nconst a = 2 * Math.PI * k\neixo.set(Math.cos(a), 0, Math.sin(a), 0)\nfrente.set(0, 1 / 0.10, 0.0, 1.6)\n\n// C. ONDA: continua, nao tem fim. 3 cristas na altura visivel, subindo.\neixo.set(0, 1, 0, 1)\nfrente.set(2, 0, 0, 0)                                 // sem frente\nonda.set(0.22, 13.3, (2 * Math.PI * t) / 2000, 0)\n\n// D. RADIAL: o anel do evento, saindo do ponto que encara quem olha.\n//    s0 = cos(pi k) e nao linear: da velocidade constante SOBRE A SUPERFICIE,\n//    que e como uma onda de verdade anda. Linear em s daria um estouro no\n//    centro e um arrasto no aro.\nfxCam.copy(cam).sub(casca.position).normalize()\neixo.set(fxCam.x, fxCam.y, fxCam.z, 0)\nfrente.set(Math.cos(Math.PI * k), 1 / Math.max(hw, 0.06), 0.55, 2.2)\n\n// E. CORTINA: a transicao de pele sem segunda textura. Cobertura sobe a 1,\n//    pintar() acontece coberto, cobertura desce. Uma repintura, escondida.\nconst cob = k < 0.45 ? suave(0, 0.45, k) : k > 0.55 ? 1 - suave(0.55, 1, k) : 1\nfrente.set(0, 0, 0, 0)                                 // nitidez 0 = global\nonda.set(0, 0, 0, cob)\nif (k >= 0.45 && k <= 0.55 && fxMeio) { fxMeio(); fxMeio = null }\n\n// F. NEGATIVO: o flash em contraste invertido, 220 ms, casca inteira.\nfrente.set(0, 0, 0, 0)\ntinta.w = k < 0.25 ? k / 0.25 : k > 0.75 ? (1 - k) / 0.25 : 1\n```\n\nAPI nova em `Sphere`, uma linha:\n\n```ts\n/** um efeito de casca inteira, por uniforme. NAO repinta. `aoCobrir` so a cortina usa. */\nefeito(nome: SphereFx, o?: { ms?: number; forca?: number; cor?: THREE.Color; aoCobrir?: () => void }): void\n```\n\n## 5. O QUE O PROGRAMA CHAMA (sphere-conteudo.ts)\n\n- Entrada de `marca-btc` e de `marca-dog`: `efeito('cortina', { ms: 700, cor: COR_DADO, aoCobrir: () => o.pintar(c) })` no lugar do dissolve. Hoje a troca desce o ganho para GANHO_VALE 0,04, ou seja a esfera APAGA para trocar de pele. Com a cortina ela acende inteira na cor da marca, troca escondida e revela. E o momento \"ela inteira vira uma coisa so\" que o fundador pediu, e custa a mesma repintura de 7 ms que ja acontece.\n- ⚠️ O `aoCobrir` TEM de ser chamado pelo update() por quadro, nao pelo tick do programa: `MS_TICK` e 250 ms e a janela de cobertura total da cortina tem 70 ms. O tick erraria a janela e a repintura apareceria.\n- Durante os dois slots de marca (48 s cada, dois por volta do anel de 5,6 min): `efeito('onda')` com poupa-faixa 0, amplitude 0,22. A pele laranja do Bitcoin passa a ter tres cristas subindo.\n- Evento (bloco minerado, tx na carteira): `pulsar()` continua, mais `efeito('radial')` de 1.100 ms. O swell chapado atravessa a distancia (ja provado) e o anel radial da a direcao e a origem.\n- Uma vez por volta do anel, na virada do slot de dado: `efeito('varredura', { ms: 1400 })` com poupa-faixa 1. E a assinatura de painel de LED ligado, e nao toca no numero.\n- Emoji de casca inteira: e uma `pintarCorpo` nova (mesma estrutura de `pintarCorpoBitcoin`, N copias igualmente espacadas na linha 230, largura dividida por cos(lat)), entrando e saindo por cortina, com `negativo` de 220 ms no meio para a piscada. Zero shader novo.",
 "custo": "## ALU, contadas a mao instrucao por instrucao (nao medidas em GPU)\n\nFS, material cheio, com o efeito LIGADO:\n```\ndot(p, eixo)                              3\nmascara (sub, abs, mul, rsub, max, mul)   6\nfora = 1 - naFaixa*w                      2\nonda (mul, sub, sin, mul, mul)            4 + 1 SFU\nti = a*m*fora                             2\ninversao: ia, ib, mad vec3, max vec3     11\nfxG = 1 + w*m + onda                      2\nfxT = min(1, z*m + cob)                   3\ntinta: cor*sinalM (3) + mix vec3 (6)      9\nfxG no ganho                              1\n                                        ---\n                                      43 ALU + 1 transcendental\n```\nSobre a base de ~70 ALU documentada em sphere.ts, isso e **+61% de ALU**, sobre um shader que tambem paga 2 buscas de textura, 1 atan, 1 asin, 1 log2 e 1 exp2, ou seja que nao e limitado por ALU. Com o efeito DESLIGADO o custo e uma comparacao escalar contra uniforme, salto coerente, sem divergencia: **~0**. Nao medi em GPU.\n\nFS_LISO, com o efeito ligado:\n```\ndot 3 + mascara 6 + fora 2 + onda 4 + ti 2 + nf 3 + fxG 2 + fxT 3 + mix vec3 6\n                                       = 31 ALU + 1 transcendental\n```\nSobre ~40 ALU, **+78%**. Em valor absoluto e irrelevante: FS_LISO so entra alem do degrau, onde o disco mede 0,5% da tela (ver abaixo).\n\nVariante economica, se a medicao no perfil fraco pedir: tirar a tinta por pixel (as 9 ALU do ultimo mix mais as 3 do fxT no FS) e deixar cor chapada so pelo canal `uEvento` que ja existe. Sobram **31 ALU no FS**, +44%, e a familia perde apenas a faixa COLORIDA correndo na casca; brilho, inversao e onda ficam inteiros.\n\n## Onde o custo cai, medido em fracao de tela\n\nA fracao da ALTURA da tela ocupada pelo disco nao depende de pxAng, so do fov de 42 graus: **fracao = 547,0 / d**. Dai:\n\n```\nd (m)     fracao da altura     celular 390x844 dpr2, area do disco\n  300           1,82                  100% da tela\n  600           0,91                  100% da tela\n1.000           0,55                  50,9%\n1.300           0,30                  30,1%\n2.656           0,21                   7,2%\n5.000           0,11                   2,0%\n10.135          0,05                   0,5%\n```\n\nPor isso o motor tem a porta de `discoRel(d) > 0.5`, ou seja **d < 1.094 m**: abaixo disso a frente por pixel NAO ROLA, e o efeito degrada para o canal chapado que ja existe. Nao e economia arbitraria, e composicao: a 300 m o disco mede 1,82 tela e uma barra atravessando a casca inteira nao se ve como barra. Com essa porta, as 43 ALU novas so rodam quando o disco ocupa **menos de meia tela**, ou seja sobre no maximo 25% dos pixels, e tipicamente sobre 2% a 7%.\n\n## Custo por quadro fora do fragmento\n\n- CPU: uma divisao, um `Math.cos` ou `Math.sin`, ~10 operacoes escalares, 3 `.set()` em Vector4 pre-alocados. Zero alocacao, zero GC. Cabe no `update()` que ja roda, ao lado da conta de `uVida`.\n- GL: 4 chamadas de uniforme a mais por quadro, sobre 1 draw call. Nada.\n- Textura: **zero**. Nenhum efeito da familia chama `pintar()`. A unica repintura e a que a cortina ESCONDE, e ela ja acontecia hoje no fundo do dissolve.\n- Programas: **555 continuam 555**. O salto e por uniforme, nao por `#define`.\n\n## Alcance, para saber ate onde cada efeito paga\n\nEspessura da frente em s vira pixel direto: banda_px = 2*hw*R/(d*pxAng). Na tela da live (pxAng 6,787e-4):\n```\nd (m)    R em px   hw minimo para 3 px    banda equivalente em metros\n1.000      295         0,0051                    2,0\n2.000      148         0,0102                    4,1\n5.000       59         0,0254                   10,2\n8.000       37         0,0406                   16,3\n11.800      25         0,0599                   24,0\n```\nE o piso da grade: uma frente precisa de pelo menos ~5 linhas de LED para nao bater com o padrao de disco, o que da hw >= 0,008 (3,2 m projetados, 5,4 linhas na latitude da faixa). O motor toma o maior dos dois pisos e do nominal, entao **a barra engorda sozinha com a distancia e nunca cintila**, pela mesma logica com que `uVida` engorda a amplitude de longe.\n\nReferencia de leitura: a letra grande alcanca 5.639 m a 9 px. Uma barra de 16 m (hw 0,04) alcanca 3 px a **7.860 m**, e a onda de 94,7 m de comprimento alcanca 3 px a **46 km**. **O efeito de casca inteira vive mais longe que o texto por um fator de 1,4 a 8**, que e exatamente o que sustenta o plano de marketing: a peca continua dizendo alguma coisa depois que ela para de escrever.",
 "riscos": "## 1. Os numeros da prosa de sphere.ts sao da esfera de 196 m, e o codigo e de 401\n\nAchado colateral, e ele contamina qualquer orcamento feito a partir do arquivo. `SPHERE_DIAM = 401.0`, mas os comentarios trazem valores calculados para R = 98 (ou 80). Conferido rodando as proprias formulas do arquivo:\n\n```\n                     escrito no arquivo     valor com R = 200,5   fator\npasso do LED             0,2454 m               0,6151 m          2,51\nletra grande            16,84 m                34,45 m            2,05\nalcance da letra      2.756 m                 5.639 m             2,05\naltura da faixa         38,49 m                78,74 m            2,05\ndisco na tela do        1,7% a 2.656 m          7,2% a 2.656 m     4,19\n  celular\n```\nOs valores da direita sao os que o fundador passou como medidos, e eles fecham com as formulas. Consequencia dura para esta frente: **o fillrate real e 4,19 vezes o que a prosa do arquivo diz** (vai com R ao quadrado). Quem dimensionar o efeito lendo os comentarios vai subestimar o custo em 4x.\n\n## 2. O degrau de fillrate praticamente nao existe mais, e isso muda a prioridade\n\n`querLiso = d > max(limite, distTexto) * 1.15`, e `distTexto = 34,45 / (9 * pxAng)`. Com a letra de 34,45 m:\n```\ncelular dpr 1,5   distTexto 6.611 m   liso entra em  7.603 m\ncelular dpr 2,0   distTexto 8.814 m   liso entra em 10.135 m\ncelular dpr 3,0   distTexto 13.222 m  liso entra em 15.205 m\ndesktop forte     distLiso Infinity   liso nunca entra\n```\nOu seja: **FS_LISO so roda alem de 7,6 km**, onde o disco mede 0,5% da tela. O material que \"o celular usa\" hoje e o CHEIO, sobre 30% da tela a 1.300 m e 100% a 600 m. A exigencia de o efeito valer no liso continua certa e esta atendida (31 ALU la), mas a conta que decide se a familia entra ou nao e a do FS. Isso depende do `pxAng` que o chamador passa no `update()`; nao li city-3d.tsx e nao verifiquei qual valor chega la. Se o chamador nunca passa `pxAng`, vale o padrao `spherePxAng(42, 1080, maxPixelRatio)` e todos esses numeros mudam.\n\n## 3. Dois donos escrevendo cor chapada\n\n`uEvento` (pulsar) e `uFxOnda.w` (cortina) fazem mixes sequenciais para cores possivelmente diferentes. Se um evento cair no meio de uma cortina, a casca recebe os dois e satura. Como as duas cores padrao sao o mesmo `#E8660D`, a composicao e benigna hoje, e deixa de ser no dia em que a cortina de um parceiro usar branco. Regra a escrever no codigo: **a cortina cede ao evento**, `if (uEvento.value > 0.05) fxDesligar()`, uma comparacao por quadro. A alternativa (unificar `uEvento` dentro de `uFxOnda.w` e `uCorEvento` dentro de `uFxTinta.rgb`, economizando 2 uniformes e 3 ALU) e mais limpa mas mexe em codigo ja validado em producao; nao recomendo agora.\n\n## 4. A cortina e a unica coisa aqui que depende de tempo real\n\nA janela de cobertura total tem 70 ms dos 700. Se o `aoCobrir` for chamado pelo tick do programa (MS_TICK = 250 ms) ele erra a janela e os 7 ms de repintura aparecem como estalo no meio de uma casca meio coberta, que e pior que o dissolve atual. O gatilho tem de morar no `update()`. E numa aba de fundo (o programa ja pausa por `visibilitychange`) a cortina precisa ser cancelada, ou volta com a repintura pendurada.\n\n## 5. Riscos de shader que eu vi e evitei, para nao serem reintroduzidos\n\n- **Nenhum texture2D dentro do `if`**. A mascara so mexe em `conteudo` DEPOIS das duas buscas. Amostrar em fluxo nao uniforme deixaria o LOD indefinido e traria de volta o serrilhado que o par `k`/`kc` resolveu.\n- **Nenhuma derivada**. Nada de `fwidth` sobre s: o campo e liso, mas a doutrina do arquivo sobre derivada e costura vale igual.\n- **Nada de longitude por `atan`** no FS_LISO. Um wipe horizontal escrito como angulo custaria um atan (transcendental) e herdaria a costura de mais ou menos pi; escrito como eixo girando custa 3 ALU e nao tem costura.\n- **Inversao contra `uMedia`, nunca contra 1.0**. Contra 1.0 a pele laranja estoura no tone mapping ACES e o casco preto do intervalo da Kray vira branco chapado.\n- **`max(vec3(0.0), ...)` na inversao** e obrigatorio: com `uMedia` escuro e `conteudo` claro o resultado passa de negativo e vaza cor invertida no termo do painel.\n- **O `if` sobre uniforme pode ser achatado pelo compilador** de algum driver movel, e ai o custo ocioso deixa de ser zero e vira 43 ALU sempre. Nao medi. Teste obrigatorio antes de subir: `?stats=1` a 1.300 m no perfil fraco com o efeito ligado e desligado.\n\n## 6. Onde eu recomendaria NAO ir\n\n- Segunda textura para crossfade entre peles: 8 MB a mais de VRAM, um sampler a mais, e o programa muda. A cortina resolve o mesmo problema com zero.\n- Deslocar geometria (onda que deforma a casca): mexe no VS, quebra a silhueta que o embasamento assenta, e a Sphere de Vegas tambem nao deforma. A casca e rigida, quem se mexe e a luz.\n- Efeito ligado o tempo todo: o arquivo tem uma doutrina escrita de \"marco de cidade e nao bola de discoteca\", e ela e do fundador. A familia inteira e feita de eventos curtos (220 ms a 2,4 s) mais a onda continua de amplitude 0,22, que e da ordem da respiracao que ja existe (0,16). O estado normal da peca continua sendo o sobrio."
}

## refuta

## Três fatos de base que reordenam todos os vereditos

**1. FS_LISO está morto hoje.** `querLiso = d > Math.max(limite, longe ? distTexto*2 : distTexto) * 1.15` (sphere.ts:1977), e `longe` é reescrito duas linhas acima, no mesmo quadro. Então o limiar real do degrau é `2 × distTexto × 1,15`, não `distTexto × 1,15`. Com `SPHERE_LETRA_ALTURA` = 34,447 m e `SPHERE_TEXTO_PX` = 9:

| tela | distTexto | longe entra | **liso entra** | cull (sphere.ts:1434) |
|---|---|---|---|---|
| celular 844 css dpr 1,5 | 6.611 m | 7.602 m | **15.205 m** | 14.000 m |
| celular 844 css dpr 2 | 8.814 m | 10.136 m | **20.271 m** | 14.000 m |
| celular dpr 3 | 13.221 m | 15.204 m | **30.409 m** | 14.000 m |
| desktop 1080 dpr 1, quality low | 5.639 m | 6.485 m | **12.971 m** | 14.000 m |
| desktop forte | 5.639 m | 6.485 m | nunca (`distLiso = Infinity`) | 14.000 m |

`FS_LISO` só roda numa janela de 1.029 m (12.971 a 14.000) num desktop de `quality: 'low'`, com câmera livre fora da cidade. **Em celular ele nunca roda.** A tabela "liso entra em 7.603 / 10.135 / 15.205" da proposta FX-EIXO cita os limiares de `longe`, não os de liso: ela leu `querLiso` sem o termo `longe ? distTexto*2`. E o risco 3 da proposta GRAMÁTICA ("o gesto só no FS some justamente longe, no celular") descreve um cenário que hoje é impossível. Paridade FS/FS_LISO continua sendo disciplina certa, mas é seguro, não prioridade: nenhuma das duas propostas pode ser justificada pelo celular a distância.

**2. O corte não é lat −24,69°.** `cosCorte = -(0,43·200,5 − (0 − 1,0))/200,5 = −0,434988`, `thetaMax = acos` (sphere.ts:1783). Latitude do corte = **−25,785°**, `s = −0,43499`, linha **658,7**. Os −24,69° / linha 652,5 do enunciado e dos três diagnósticos saem de `R = 98` com `SPHERE_PODIO_H = 2,2`, geometria que morreu em 08/09 (`SPHERE_PODIO_H = 0`, sphere.ts:149). Logo `SPHERE_S_MIN = -0.4177` da proposta FX-EIXO está errado por 0,0173 em s (3,5 m de corda) e tem de ser derivado, não cravado. O achado 4 dela ("o meio do campo é o centro óptico") melhora: `(−0,43499+1)/2 = 0,28251` contra `sin(16,56°) = 0,28502`, diferença de 0,0025 em s, 0,5 m. A coincidência é real e mais apertada do que ela mediu.

**3. `uCorFaixa` e `uMedia` são médias em espaço gama, e isso custa 61% do anel.** `mediaDe` (sphere.ts:1631-1638) soma bytes sRGB, divide e só então chama `convertSRGBToLinear()`. Rasterizei a faixa de verdade (368-496, 2048 col, glifos de `GLIFOS`, chão `#121212`, valor `#E8660D`, rótulo `#BEC0C3`):

```
uCorFaixa como o código calcula   Y = 0,02050
média linear verdadeira da faixa  Y = 0,05335     erro −61,6%
uMedia como o código calcula      Y = 0,00615
média linear verdadeira           Y = 0,01033     erro −40,5%
```

O mipmap da GPU faz a média em linear (a textura é `SRGBColorSpace`). Então o `smoothstep` de `uTextoDist` (sphere.ts:1097) troca um conteúdo de Y 0,0534 por um de Y 0,0205 conforme a letra apaga. Consequência medida ao sol pleno: o anel cai de Y 0,0708 para 0,0570 (**−19,5%**) e a razão anel/casco cai de **1,412x para 1,137x**; na sombra a razão cai de 2,94x para 1,64x. É exatamente o defeito que o comentário de sphere.ts:1639-1650 declara resolvido ("a esfera ESCURECIA ao passar do textCull ... lia como PONTO ESCURO"): ele foi atenuado, não eliminado, e o conserto é uma linha (converter cada amostra antes de somar). Nenhum dos três diagnósticos olhou.

---

## O QUE CAI

**D1 achado 2 e 4, "levar a marca para a linha 418 com 300 linhas".** Circular. 418 ± 150 ocupa 268 a 568, que contém inteira a faixa 368-496: é literalmente a colisão que sphere-conteudo.ts:615-618 diz ter consertado subindo a marca para 230. O remendo proposto (baixar a faixa para 590-640) recria o defeito que o fundador rejeitou por escrito em 07/09 ("o texto ... está somente na parte de baixo"), e não cabe: 50 linhas seguram a letra pequena (28) mas não a grande (56) nem o registro de longe (`FX_LONGE_ESCALA = 16`, 7×16 = 112 linhas). Além disso a faixa não é local: `uFaixaV` é escrito uma vez no build a partir de `SPHERE_FAIXA_LINHA0/1` (sphere.ts:1813-1817), `uCorFaixa` sai de `mediaDe(y0,y1)` com os mesmos constantes, e `FS_LISO` deriva o anel inteiro de `uFaixaV`. Mover a faixa por slot faz o anel saltar 172 linhas (106 m) a cada 6 min. A alternativa "suprimir a faixa nos slots de marca" apaga o dado em 26,7% do tempo no ar, contra o pedido explícito de 08/09 de mostrar dado a grandes distâncias.

**D3 achado 2, `uPainelFaixa`.** Inverte o anel. Medido ao sol com a faixa real: `m = 1,00` dá anel/casco 1,137; `m = 0,60` dá **0,751**; `m = 0,45` dá **0,606**. A faixa vira sulco escuro exatamente onde ela é a única assinatura. A mitigação proposta (modular pela luminância do conteúdo) não salva: além do `textCull` o `conteudo` da faixa JÁ é `uCorFaixa`, cujo Y medido é 0,0205, então `dot(...)*4 = 0,082` e `mix(0.45, 1.0, 0.082) = 0,495`, anel/casco 0,649. Continua invertido. E o snippet não tem `clamp`: com o intervalo comercial em `COR_ANUNCIO = '#F2F4F7'` (Y ≈ 0,90), `dot*4 = 3,6` e `mix(0.45, 1.0, 3.6)` **extrapola para 2,43**, ou seja o painel é amplificado 2,4x sob o texto branco do parceiro.

**D3 achado 3, o teto de `uGanho` em 0,511/0,592.** A conta do clipping está certa (canal R do disco ao sol estoura 1,0 em g = 0,5925 com `uVida` neutro, 0,5107 no pico de respiração), mas o teto não existe: o próprio arquivo autorizado nomeia o tone mapping na linha do `uRaioPonto` (sphere.ts:1805-1809): *"sem estourar o `ACESFilmicToneMapping` da cena"*. ACES não corta em 1,0, ele desatura progressivamente. E o teto, se valesse, já condenava a peça inteira: `GANHO_MARCA = 0,78` (sphere-conteudo.ts:690) dá R = **1,301** dentro do disco ao sol, e `GANHO_ANUNCIO = 0,90` dá **1,494**, contra os 0,723 do ocioso. Com o swell de evento (`SPHERE_PULSO_AMP = 0,85`, `uVida` até ~2,01) o ocioso em 0,42 já dá **1,404**. O diagnóstico mediu o estado mais barato da peça e chamou de teto.

**D3 achado 4, o halo escuro.** Correto que é impotente (+5,4%), mas o argumento é mais forte do que ele diz: com `faixaFundo: null` nos dois slots de marca (sphere-conteudo.ts:685 e 708) não existe chão de faixa para escurecer. Cai por não ter onde aplicar em 26,7% do tempo.

**P2 CAMADA 1, o campo `s` no FS_LISO.** `float s = sin(lat)` no FS é `p.y` (seno de arco-seno, um transcendental desperdiçado). No FS_LISO a proposta escreve `(v - 0.5) * 2.0`, e `v = asin(p.y)/π + 0.5`, logo `(v-0.5)*2 = 2·lat/π`, que **não é** `sin(lat)`. Divergência máxima 0,2105 em s aos 50,46° de latitude, o que desloca a frente de onda em **0,3307 rad = 18,9° de latitude = 66,3 m de arco** entre os dois materiais. É a violação exata do risco 4 da própria proposta ("se as duas contas divergirem a peça muda de cor ao cruzar o degrau"). Como o degrau está morto (fato 1) isso não aparece hoje, o que é pior: entra sem sintoma.

**P2, "10 ALU" da camada 1.** O bloco calcula `banda`, `nivel` e `conv` incondicionalmente (3 smoothstep, 4 abs/sub, 1 sin, 3 ternários, 1 mix vec3, 2 mul): **~30 ALU + 1 transcendental, sempre**, sem porta de uniforme. É 3x o orçamento declarado e o ocioso paga tudo, ao contrário do `if (uFxAtivo > 0.5)` da outra proposta.

**Alcances além de 14 km.** `sphereCull()` devolve **14.000** (sphere.ts:1434). Os "10,0 px a 59,1 km" da P2 e os "3 px a 46 km" da onda da P1 são fora do mundo. O parque a 9,8 km está dentro; os 30,2 km de alcance da marca de 300 linhas da D1 e os 7.860 m da barra da P1 (esse sim, válido) precisam ser recortados por 14 km.

---

## O QUE FICA COM AJUSTE

**D1 achado 1, a compensação escalar.** Confere termo a termo: `escalaX = 1/cos(lat(230)) = 1,54199` (sphere-conteudo.ts:624), aplicado a um glifo de 250 linhas que vai da linha 105 (cos 0,31659) à 355 (cos 0,88622), razão base/topo **2,7992**. A área aparente combinada com o escorço radial dá razão 4,788. Tudo reproduzido. Ajustes: (a) o conserto é largura por linha **mantendo `LINHA_MARCA = 230`**, não mudando para 418; com centro 230 e 250 linhas, a linha 105 pede 489,6 texels = 86,06° e **6 cópias somam 516° de 360**, então `N_MARCAS` cai para 4 (envelope 86,06°, folga 3,9°) ou o glifo encurta. Com centro 230 e 200 linhas (`arcoW = 124`), a linha 130 pede 124/cos(67,15°) = 319 texels = 56,1°, e N = 4 deixa 33,9° de folga. Essa é a versão que não mexe na faixa. (b) O laço de blit tem dois furos: `dest y = (topoL+k)*L` e altura `L` com `L = f = 0,5` no perfil de textura reduzida produz linhas de meio pixel; e `cx - larg/2` fracionário costura. Arredondar os dois e cachear a cunha por `f`.

**Custo e paridade da D1:** zero programa novo (só canvas), zero repintura por quadro (roda dentro de `pintarCorpo`, que roda dentro de `pintarTextura`, que roda no fundo do vale do dissolve, sphere.ts:1888 via sphere-conteudo.ts:1067). Funciona no liso por construção, porque o liso lê `uMedia`, que é medido do canvas depois.

**D2 achados 1, 2, 3 e 5.** Simulei `repetirNaVolta` (sphere.ts:1463-1479) e a saída bate caractere a caractere: `|418.2M· 418.2M· 418.2M· 418.2M·|`, `|KRAY·KRAY· KRAY·KRAY·KRAY· KRAY·|` (6 cópias), `$DOG` 6, `TOWER` 5, `WALLET` 4, `DOGCITY` 4. Fragmento colado na borda esquerda sem aviso: **50,0%** dos azimutes em `418.2M` e **62,5%** em `0.00113`, contra 6,3% em `KRAY`. A nota de sphere.ts:1451-1458 ("com o separador o leitor vê ·18.2M") é falsa para o corte da frente. Ajustes: (a) o separador dos dois lados custa mais do que o diagnóstico admite fora dos dois casos que ele testou: `L = 15` cai de 4 para 3 cópias, `L = 12` de 4 para 4, `L = 4` de 6 para 5. (b) A "fase sorteada pelo UV" não é sorteada: `casca.rotation.y = -π` (sphere.ts:1846 com `rumoDeg = 180`) e o sítio é `(0, −R_ANCHOR)`, então a coluna que encara o centro da praça é `u = 0,75`, coluna 1536, determinística. A fase é uma constante de build, não um parâmetro de runtime.

**D2 achado 4, o orçamento.** O diagnóstico está certo e por baixo. `quadro()` (sphere-conteudo.ts:465-467) faz `pequena.slice(0, ORC_PEQUENA)` com `ORC_PEQUENA = 15`, e os quatro rótulos de marca têm 27, 20, 19 e 20 caracteres. **Eles não são "difíceis de ler", são truncados hoje, em silêncio, antes de chegar ao canvas**: `'THE CHAIN THAT CARRIES $DOG'` vai ao ar como `'THE CHAIN THAT '`, `'MARE TRANQUILLITATIS'` como `'MARE TRANQUILLI'`, `'BITCOIN BLOCK HEIGHT'` como `'BITCOIN BLOCK H'`, `'THE RUNE ON BITCOIN'` como `'THE RUNE ON BIT'`. O docstring de sphere-conteudo.ts:80-84 afirma *"o maior é DOG TX IN BLOCK, com 15 caracteres exatos"*: é falso. `orcamentoViolado()` (sphere-conteudo.ts:118) devolveria 4 violações e **não tem um único chamador** (grep em `app/` e `scripts/`).

Mas as porcentagens da tabela dele estão erradas por uma casa, e a janela está errada por um fator 1,7:

```
janela real (compressão de largura > 0,5), medida contra R = 200,5
 d=315 m    53,1°   4,7 casas grandes   (a tabela de sphere.ts:600 diz 8,0, que é R = 98)
 d=500 m    79,4°   7,1
 d=1000 m  100,1°   8,9
 saturação 120°    10,7

fração de azimutes que vê a cópia inteira, com separador dos dois lados, n=32, W=8
 L=3 100,0%   L=4 78,1%   L=5 50,0%   L=6 37,5%   L=7 18,8%   (ele publicou 94/63/38/25/9)
n=64, W=16
 L=6 100,0%   L=8 84,4%   L=10 54,7%   L=12 31,3%   L=15 9,4%  (ele publicou 100/75/47/25/5)
```

A fórmula dele é `(W−L)/P` e a certa é `(W−L+1)/P`. Direção do erro: pessimista. O ajuste que importa é o outro: `W = 8` a 315 m é número da esfera de 196 m; com 401 m são **4,7 casas**, então `ORC_GRANDE = 4` não é folga, é o limite físico, e `ORC_PEQUENA = 8` deveria ser 9,4 casas a 315 m, ou seja **8 é o valor certo pelo motivo errado**.

**P1 (FX-EIXO), o partido.** O campo `s = dot(normalize(vP), eixo)` é a escolha certa e barata: `vec3 p = normalize(vP)` já existe no FS (primeira linha do main) e o `normalize(vP)` já é pago dentro do `v` do FS_LISO. Sem costura (evita o `atan` de ±π que o próprio arquivo documenta), linear na tela (altura projetada = R·s no limite ortográfico), e as leis de movimento estão certas: `s0 = cos(πk)` dá velocidade angular constante sobre a superfície, e o eixo horizontal girando com a frente em `s = 0` acende o grande círculo perpendicular, que vira a silhueta quando o eixo aponta para a câmera. `uMedia` de fato não está declarado no FS (conferi a lista de uniformes, sphere.ts:1033-1053) e já existe no objeto compartilhado (sphere.ts:1827). Zero programa novo, zero repintura por quadro, roda nos dois materiais. Ajustes obrigatórios:

1. `SPHERE_S_MIN` derivado de `SPHERE_ENTERRO`, `SPHERE_PODIO_H` e `SPHERE_R`, valor **−0,43499**, não −0,4177.
2. `discoRel(d) = 547,0/d` está certo, mas "as 43 ALU só rodam sobre no máximo 25% dos pixels" é falso em retrato: no gate (`d = 1.094 m`) o disco mede 0,5 da altura e **42,5%** da área de um 390×844.
3. O `fora = 1.0 - naFaixa * uFxEixo.w` usa o `naFaixa` do FS, que é `step()*step()` (sphere.ts:1096), aresta dura. Gatear um clarão com aresta dura desenha **duas linhas serrilhadas atravessando a esfera** durante todo efeito. O próprio arquivo diz por que o FS_LISO usa `smoothstep` ali (sphere.ts:1176). Precisa de uma versão suavizada de `naFaixa` só para o gate.
4. O modo MERIDIANO escreve `eixo.w = 0`, ou seja atravessa a faixa de dado, contra a regra que a própria proposta escreveu ("slot de dado usa 1").

**P2 (GRAMÁTICA), a leitura editorial.** Confere: `ANEL` tem 7 posições com 6 de dado (sphere-conteudo.ts:1022), volta de **360 s**, fatia real de anúncio **20,0%** contra os 27,27% de `fracaoNominalAnuncio(4)` (sphere-conteudo.ts:270), marca em **26,7%** do ar sempre com os mesmos 2 bitmaps, vãos entre marcas de **96 s e 168 s** (razão 1,75) e a reordenação proposta dá **120 s e 144 s** (razão 1,20). `entrarNo` crava `o.pulsar?.(1)` (sphere-conteudo.ts:1193) enquanto `pulsar(intensidade = 1)` (sphere.ts:1906) aceita o argumento. `montar` escreve `ultimoDadoValido = t` só no ramo dos módulos de cadeia, então o risco 5 (relógio alimentando `podeAnunciar`) é real e verificado. `fila.push` direto sobrevive porque `proximoSlot` drena `fila` antes do anel (sphere-conteudo.ts:1170-1173). Baralho de peles custa zero repintura a mais: `c.pintarCorpo?.(g, W, H)` já roda dentro de todo `pintarTextura` (sphere.ts:1584). Ajustes: trocar `sin(lat)` por `p.y` no FS e por `sin(asin(...))` equivalente no LISO, ou seja usar `p.y` nos dois; pôr o bloco atrás de uma porta de uniforme; e recortar os alcances por 14 km.

**P2 camada 3, a escada de raridade.** Fica inteira. A única correção de número: com ~15 quadros por volta de 360 s a peça já repinta 1 vez a cada 24 s (150/hora), não a cada 18,9 s, porque o repaint é por **quadro** e não por slot (`trocarPara` → `pendente` → `o.pintar` em `tickFade`, sphere-conteudo.ts:1061-1074).

---

## OS BURACOS: o que os três diagnósticos não olharam

1. **A média em espaço gama (fato 3 acima).** O diagnóstico 3 fez análise de luminância inteira sem abrir `mediaDe` (sphere.ts:1631-1638), que é a função que produz os dois uniformes que ele passou o tempo todo usando. `uCorFaixa` está 61,6% escuro, `uMedia` 40,5%. É o defeito de maior alavancagem do arquivo e custa uma linha.

2. **O `textCull` já apagou 68% da letra no alcance publicado.** `smoothstep(uTextoDist*0,75, uTextoDist*1,15, vD)` com `uTextoDist = distTexto` e `d = distTexto = 5.639 m` dá peso **0,684**. O diagnóstico 3 calculou contraste de traço a 5.639 m ignorando o maior termo do shader àquela distância. O limite real de leitura (apagamento < 25%) é **4.890 m**, não 5.639. E é isso que corrói o ganho da dilatação do achado 4 dele, além do modelo de cobertura 0,872 ser insustentável: o traço mede 8 LEDs e a caixa de 1 px mede 6,22 LEDs a 5.639 m, então a cobertura de pico é 1,0 por construção, e a amostragem real é trilinear em mip 2,64, não caixa.

3. **`pintarCorpoDog` não compensa latitude nenhuma.** `g.fillText('$DOG', ...)` em `cyTopo = 235*L` (sphere-conteudo.ts:657-663), latitude 48,68°, `cos = 0,6606`: o `$DOG` sai **34% mais estreito** do que foi desenhado. O diagnóstico 1 citou essa função duas vezes (para elogiar o N = 4) e não olhou a largura, que é o assunto dele.

4. **Nada trata a névoa.** Os dois materiais são `fog: true` (sphere.ts:1832 e 1837) e o VS inclui `fog_pars_vertex`/`fog_vertex` com o remendo de `atmosfera.ts`. A névoa mistura pico e vale para a MESMA cor, então corta contraste de letra, de anel e de todo efeito das duas propostas por `(1 − fogFactor)` justamente na faixa de 5 a 14 km onde as duas vendem alcance. A P1 vende "o efeito de casca vive 1,4 a 8x mais longe que o texto" sem esse termo. Não medi (atmosfera.ts fora do autorizado), mas o fator existe e é o mesmo para os dois lados da comparação só se a névoa for linear em luminância, o que ela não é.

5. **Todos os números de luz do diagnóstico 3 assumem o padrão que o arquivo diz para não usar.** `uSolCor = (1,6; 1,56; 1,48)` e `uAmb = (0,34; 0,35; 0,40)` são o "dia lunar plausível" que existe só para a peça nascer certa se ninguém chamar `iluminar()` (sphere.ts:1821-1825). Se a cena chama `iluminar()` com a luz real, todo o piso de painel muda e as conclusões movem junto. O diagnóstico não declarou essa dependência.

6. **O tone mapping estava no arquivo autorizado.** sphere.ts:1805-1809 nomeia `ACESFilmicToneMapping`. O diagnóstico 3 escreveu "NÃO MEDI o toneMapping" duas vezes enquanto a resposta estava no comentário da constante que ele citou (`uPreenche`).

7. **`temArte` não faz o que o comentário diz.** sphere.ts:1938-1942: com `temArte` verdadeiro, `limite` deixa de ser `min(distLiso, distPadrao)` e passa a ser `distLiso`. Isso **sobe** o limiar, não desliga o degrau. O comentário afirma que a arte de parceiro "SUMIRIA a partir do degrau" e que isso foi consertado: não foi, só foi empurrado. Latente hoje pelo fato 1, vivo no dia em que os limiares mudarem.

8. **`mediaDe` amostra com passo comensurável com a grade do glifo.** `i += 8*4` percorre as colunas 0, 8, 16, ... com `W = 2048`, ou seja 256 amostras por linha, travadas em fase. Para a linha grande (`escala = 8`, célula de 8 px) cai uma amostra por pixel de glifo, sem viés. Para a linha pequena (`escala = 4`, célula de 4 px) cai só nas colunas pares do glifo: as colunas 1 e 3 da matriz 5×7 **nunca entram** em `uCorFaixa`. Viés sistemático numa média que é a assinatura da peça a longa distância.

9. **`grande.slice(0, 7)` quebra na altura de bloco de 7 dígitos.** `quadro()` corta em `ORC_GRANDE = 7` e `slotBitcoin` monta `'#' + altura` (sphere-conteudo.ts:696). Hoje `'#966670'` tem exatamente 7. No bloco 1.000.000 vira `'#100000'`, um número errado por 10x, publicado em 401 m. Mesma classe do erro de 20x que a nota de sphere.ts:1451-1458 diz ter consertado.

10. **A tabela de orçamento de sphere.ts:592-605 inteira é da esfera de 196 m** ("315 m, 90°, 8,0 casas"). Medido contra `R = 200,5`: 53,1° e **4,7 casas** a 315 m. Junto com `SPHERE_PASSO` comentado como 0,2454 m quando vale 0,61513, a letra como 16,84 m quando vale 34,447, a faixa como 38,49 m quando vale 78,74 e o corte como −24,69° quando vale −25,785°, a prosa do arquivo é um segundo conjunto de números que não corresponde ao código. Quem dimensionar qualquer coisa lendo comentário erra fillrate por 4,19x (vai com R²). Isso é dívida de documentação, e é a razão pela qual dois dos três diagnósticos e as duas propostas herdaram o corte errado.

## plano

# PLANO DE EXECUÇÃO: THE SPHERE

Arquivos tocados, os dois: `/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/app/city/plaza/sphere.ts` e `/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/app/city/plaza/sphere-conteudo.ts`. Tudo abaixo foi conferido contra o código, e os números novos que eu produzi estão marcados como medidos por mim.

## DESCARTADO (não implementar)

1. **Mover a marca para `LINHA_CENTRO` 418 com 300 linhas** (D1 achados 2 e 4). 418 ± 150 ocupa 268 a 568 e engole a faixa 368 a 496 inteira: é a colisão que `sphere-conteudo.ts:615-618` já consertou. Baixar a faixa não é local (`uFaixaV`, `uCorFaixa` e o anel procedural do `FS_LISO` saem todos de `SPHERE_FAIXA_LINHA0/1`, `sphere.ts:473-474`) e faria o anel saltar 172 linhas a cada 6 min.
2. **`uPainelFaixa`** (D3 achado 2). Inverte o anel: o painel é o piso do brilho da faixa, atenuá-lo transforma a assinatura em sulco. E o snippet extrapola o `mix` sem `clamp` sob a `COR_ANUNCIO` `#F2F4F7`.
3. **Teto de `uGanho` em 0,511** (D3 achado 3). Não existe: `sphere.ts:1805-1809` nomeia `ACESFilmicToneMapping`, e `GANHO_MARCA = 0,78` (`sphere-conteudo.ts:690`) e `GANHO_ANUNCIO = 0,90` já rodam muito acima disso.
4. **Halo escuro** (D3 achado 4). +5,4% no melhor caso, e nos dois slots de marca `faixaFundo: null` significa que não há chão de faixa para escurecer.
5. **`ORC_GRANDE = 4`** (D2 achado 4). Erro que a crítica também não pegou: `fmtPreco` (`sphere-conteudo.ts:352-372`) é construída em cima de `ORC_GRANDE`. Simulei com o teto em 4: `0,00113` sai como `.001`, quantização de 13% no preço. `ORC_GRANDE` fica em 7 e o corte é por valor, não global.
6. **`repMax = 2` para anúncio** (D2 achado 2). Medi: `KRAY` com 2 cópias é lido inteiro em 4% dos azimutes a 315 m e 31% a 1 km, contra 76% com 5 cópias. A cura é pior que a doença; o conserto certo do "kray, kray" é outro (item B4 e A5).
7. **`sin(lat)` como campo no `FS_LISO`** (P2). `(v-0.5)*2` é `2·lat/π`, não `sin(lat)`: divergência de até 0,2105 em s, 66,3 m de arco entre os dois materiais. Usar `dot(normalize(vP), eixo)` nos dois, e só isso.
8. **MERIDIANO, ONDA contínua e NEGATIVO** da P1. O meridiano atravessa a faixa de dado por escrito (`eixo.w = 0`), a onda contínua é uma segunda respiração empilhada sobre `SPHERE_VIDA_AMP` e é o convite direto para o efeito ficar ligado o tempo todo, e o negativo depende de `uMedia`, que é justamente o uniforme sendo consertado em A2.
9. **Alcances acima de 14 km.** `sphereCull()` devolve 14.000 (`sphere.ts:1435`). Os 30,2 km da D1, os 46 km da P1 e os 59,1 km da P2 estão fora do mundo.

---

## BLOCO A: CONSERTO DE DEFEITO (ordem obrigatória, A1 antes de tudo)

### A1. Remover o registro de longe
`sphere.ts`. Apagar `FX_LONGE_ESCALA` (:539), `SPHERE_CHARS_LONGE` (:604), `FX_MARGEM` (:508, só o ramo de longe usa) e renomear `FX_MARGEM_PERTO` (:540) para `FX_MARGEM`. Tirar o parâmetro `longe` de `pintarTextura` (:1522) e o `if (longe)` (:1617-1628), deixando só o ramo de duas linhas. Em `update()`: apagar `let longe` (:1889), o bloco `queroLonge` (:1957-1963), e simplificar `uTextoDist.value = distTexto` (:1968) e `querLiso = d > Math.max(limite, distTexto) * 1.15` (:1977).

**Consequência que muda o resto do plano:** o termo `longe ? distTexto*2` era o que duplicava o limiar do degrau. Removido, o `FS_LISO` volta a existir de verdade: em celular dpr 1,5 ele entra em **7.602 m** e vai até o cull de 14.000 m, em dpr 2 entra em **10.136 m**. Paridade termo a termo entre `FS` e `FS_LISO` deixa de ser disciplina e vira requisito operacional para o Bloco C.

Critério de pronto: `grep -n "longe\|LONGE"` no arquivo só devolve prosa; com a câmera parada a 6 km e o FrameGovernor mexendo no `pixelRatio`, o contador de repinturas fica constante por 60 s.

### A2. `mediaDe` em espaço linear (maior alavancagem do arquivo, uma linha)
`sphere.ts:1631-1638`. Hoje soma bytes sRGB, divide, e só então chama `convertSRGBToLinear()`. O mipmap da GPU faz a média em linear, porque a textura é `SRGBColorSpace`: os dois uniformes que descrevem a peça de longe estão sistematicamente escuros.

Medido por mim, com LUT sRGB para linear de 256 entradas construída no módulo (custo desprezível sobre as 32.768 amostras):

| uniforme / pele | Y como o código calcula | Y verdadeiro | erro |
|---|---|---|---|
| `uCorFaixa` faixa de dado | 0,03027 | 0,08676 | -65,1% |
| `uCorFaixa` faixa de anúncio (`#F2F4F7`) | 0,03418 | 0,14058 | **-75,7%** |
| `uMedia` esfera ociosa | 0,00539 | 0,01406 | -61,7% |
| `uMedia` pele `marca-dog` | 0,00599 | 0,01914 | -68,7% |
| `uMedia` pele `marca-btc` | 0,20724 | 0,23533 | -11,9% |

Efeito na razão anel/casco, com os uniformes padrão de dia lunar de `sphere.ts:1824-1825` (dependência declarada: se a cena chamar `iluminar()` com luz real, remedir): sol pleno **1,206 vira 1,563**; meia luz **1,338 vira 1,884**; sombra **1,938 vira 3,065**. É o defeito que `sphere.ts:1639-1650` declara resolvido e que só tinha sido atenuado.

Isto também é o que torna A1 seguro: além do degrau o `FS_LISO` mostra `uMedia`, e com a pele `marca-btc` corrigida a esfera lê como bola laranja acesa em vez de esfera apagada.

Correção acoplada, mesma função: o passo `i += 8 * 4` amostra as colunas 0, 8, 16 e assim por diante. Para a linha pequena (`FX_PEQUENA_ESCALA = 4`, célula de 4 px) as colunas 1 e 3 da matriz 5x7 **nunca entram** na média. Trocar o passo para `i += 5 * 4` (5 é primo com 8 e com 4) mantém 409 amostras por linha e tira o travamento de fase.

Critério de pronto: `mediaDe` de uma faixa 100% `#E8660D` devolve exatamente `Y = 0,26688`; com 15% de laranja e 8% de creme sobre `#121212` devolve 0,0868 e não 0,0303.

### A3. `'#' + altura` estoura o orçamento no bloco 1.000.000
`sphere-conteudo.ts:696` monta `'#' + altura` e `quadro()` (:465) faz `grande.slice(0, ORC_GRANDE)`. Hoje `#966670` tem 7 exatos; no bloco 1.000.000 vira `#100000`, um número errado por 10x publicado em 401 m. Conserto: **tirar o `#`** e deixar a identificação no rótulo (`'BTC BLOCK'`, item A4). Ganho colateral medido: L cai de 7 para 6 e a leitura a 1 km sobe de 18% para 36% dos azimutes.

Junto: `quadro()` deixa de fazer `slice` silencioso. Em `NODE_ENV !== 'production'`, lançar; em produção, `slice` com `'…'` no fim, para o corte se anunciar corte.

### A4. Os quatro rótulos de marca já vão ao ar truncados
`ORC_PEQUENA = 15` (`sphere-conteudo.ts:77`) contra `marcaBtc` 27, `marcaBtcAlt` 20, `marcaDog` 19, `marcaDogAlt` 20: hoje a esfera publica `THE CHAIN THAT `, `BITCOIN BLOCK H`, `THE RUNE ON BIT` e `MARE TRANQUILLI`. O docstring de :80-84 afirma que o maior tem 15 exatos, e é falso. `orcamentoViolado()` (:118) devolveria 4 violações e **não tem um único chamador**.

Novo teto: **`ORC_PEQUENA = 9`**. Tabela que eu medi (fração de azimutes com a cópia inteira, `n = 64`, separador dos dois lados, teto de cópias do item A5), janelas de 9,44 casas a 315 m, 14,11 a 500 m, 17,78 a 1 km e 20,71 na saturação:

```
L=5  28%  57%  80%  98%      L=9   3%  40%  69%  91%
L=6  21%  51%  74%  92%      L=10  0%  32%  61%  84%
L=7  15%  44%  67%  86%      L=12  0%  13%  36%  54%
L=8  11%  48%  76%  99%      L=15  0%   0%  17%  36%
```

Substituições, copy em inglês, todas dentro de 9: `marcaBtc` `'ON BITCOIN'` fica em `'BITCOIN'`(7); `marcaBtcAlt` `'BTC BLOCK'`(9); `marcaDog` `'BTC RUNE'`(8); `marcaDogAlt` `'THE MOON'`(8); `precoSpot` `'USD SPOT'`(8); `volume` `'24H VOL'`(7); `alta` `'24H HIGH'`(8); `baixa` `'24H LOW'`(7); `pendentes` `'MEMPOOL'`(7); `emVoo` `'IN FLIGHT'`(9); `taxa` `'SATS/VB'`(7); `blocosFaltam` `'TO GO'`(5); `blocoAlvo` `'TARGET'`(6); `estimativa` `'ESTIMATE'`(8); `snapshotFeito` `'SNAPSHOT'`(8); `blocosDesde` `'SINCE'`(5); `doacao` `'DONATED'`(7); `doadorDe` `'FROM'`(4); `doacaoOk` `'CONFIRMED'`(9); `bloco` `'BTC BLOCK'`(9); `blocoTx` `'DOG TX'`(6, preserva o rótulo pedido pelo fundador); `blocoVol` `'DOG MOVED'`(9); `mintLotes` `'MINTED'`(6); `mintDono` `'NEW OWNER'`(9); `krayCustodia` `'YOUR KEYS'`(9); `krayTorre` `'KRAY TOWER'` não cabe, usar `'THE TOWER'`(9); `precoVar` `'24H'`(3); `ocioso` `'THE SPHERE'` não cabe, usar `'DOGCITY'`(7) no rótulo com `'THE SPHERE'` no valor grande, ou aceitar 10.

Critério de pronto: `orcamentoViolado()` roda em teste e falha o build se devolver algo. Ele existe há tempo demais sem chamador.

### A5. Separador dos dois lados e teto de cópias
`sphere.ts:1463-1479`. Simulei a função: o `·` só sai à direita, e o corte perigoso é o da frente. `418.2M` gera `| 418.2M· 418.2M· 418.2M· 418.2M·|` e **50,0%** dos azimutes entregam fragmento colado na borda esquerda sem aviso; `0.00113` dá **62,5%**. É o erro de 20x que a nota de `sphere.ts:1451-1458` diz ter consertado, e a nota é falsa para metade dos azimutes.

Nova `repetirNaVolta(t, nChars, W)`:
```
rep = max(1, min( floor(n/(L+2)), floor(n/(W - L)) ))
por cópia: larg = floor(n(k+1)/rep) - floor(nk/rep); vao = larg - L - 2
           out += ' '.repeat(esq) + '·' + t + '·' + ' '.repeat(vao - esq)
```
O segundo termo do `min` é o teto de cópias, e ele é o conserto real do "kray, kray": ele garante que `período + L > W` na janela de saturação, ou seja **nunca cabem duas cópias inteiras no campo de nenhum azimute**. `W` é a janela de saturação da linha, 10,35 casas na grande e 20,71 na pequena (medidas abaixo). Custo medido: `KRAY` cai de 6 cópias para 5 e vai de 4% para 76% de leitura a 1 km; `418.2M` continua em 4; `THE SPHERE` cai de 5 para 5.

### A6. Largura por linha em `pintarCorpoBitcoin`
`sphere-conteudo.ts:624-631`. `escalaX = 1/cos(lat(230)) = 1,54199` é um escalar único aplicado por `g.scale(escalaX, 1)` a um glifo de 250 linhas que vai da linha 105 (cos 0,31659) à 355 (cos 0,88622). Reproduzi: a base sai **2,7992x** mais larga que o topo. O glifo não é um ₿, é uma cunha que fecha para cima. Os bojos `0.86w` e `1.00w` de :590 respondem por 1,163x e são intencionais: ficam.

Conserto, mantendo `LINHA_MARCA = 230`:
- `ALT_L = 200` (não 250) e `arcoW = 0.62 * ALT_L = 124` passos de LED. O glifo passa a ocupar as linhas 130 a 330, com 38 linhas (23,4 m) de folga até a faixa em 368.
- Rasterizar o ₿ sem distorção num canvas offscreen de aspecto verdadeiro (`largura = 0,62 * altura`, com 2x horizontal de supersampling), cachear por `f`, e blitar fatia a fatia: para cada linha `v`, `larg(v) = arcoW / cos(π/2 - π(v+0.5)/1024)`. A cunha correta **abre para cima**, o inverso do que está lá.
- **`N_MARCAS = 4`**, não 6. Medido: com a compensação certa a linha 130 pede 319,7 texels, 56,2 graus de longitude; 4 cópias com passo de 90 graus deixam 33,8 de folga, 6 cópias somariam 337 graus e a casca viraria estampa. Com as 250 linhas de hoje a linha 105 pediria 489,6 texels, 86,06 graus, e 6 cópias somariam 516 de 360: o código atual só cabe com 6 porque a compensação errada espreme o topo.
- Arredondar `dest y` e `cx - larg/2` para inteiro: no perfil de textura reduzida `f = 0,5` (`sphere.ts:1759`) e fatias de meio pixel costuram.
- Erro residual dentro de uma fatia de 1 linha: `tan(lat)·π/1024`, pior caso 0,73% na linha 130. Invisível.

Custo de alcance: zero operacional. A marca de 200 linhas mede 123,0 m de arco e subtende 12,9 px a 14 km, que é o cull. Ela lê de qualquer ponto do sítio, inclusive do parque a 9,8 km.

### A7. `pintarCorpoDog` não compensa latitude nenhuma
`sphere-conteudo.ts:657-663`. `g.fillText('$DOG', ...)` em `cyTopo = 235 * L`, latitude 48,68 graus, `cos = 0,6606`: o `$DOG` sai **34% mais estreito** do que foi desenhado. A função foi citada duas vezes como referência de N = 4 e nunca teve a largura olhada. Conserto: `g.save(); g.translate(cx, cyTopo); g.scale(1/0.6606, 1); g.fillText('$DOG', 0, 0); g.restore()`, ou o mesmo blit por linha de A6 se a letra crescer.

Critério de pronto de A6 e A7: chapa pelo portão `scripts/city/chapas.mjs` a 2 km com a esfera de frente; medir a largura do glifo no topo e na base do desenho, razão dentro de 1,10.

### A8. A prosa numérica do arquivo é de outra esfera
Documentação, não código, mas é a raiz de dois dos três diagnósticos terem herdado o corte errado. Contra `SPHERE_DIAM = 401.0`: `SPHERE_PASSO` está comentado como 0,2454 m e vale **0,61513**; a letra grande como 16,84 m e vale **34,447**; o alcance como 2.756 m e vale **5.639**; a faixa como 38,49 m e vale **78,74**; e o corte da casca não é lat -24,69 nem linha 652,5. Calculado direto de `sphere.ts:1782-1783` com `SPHERE_PODIO_H = 0`: `cosCorte = -0,434988`, latitude **-25,785 graus**, `s = -0,43499`, **linha 658,7**. A tabela de orçamento de `sphere.ts:592-605` inteira é de R = 98: a 315 m ela diz 90 graus e 8,0 casas, e o valor com R = 200,5 é **53,1 graus e 4,72 casas grandes, 9,44 pequenas**. Quem dimensionar fillrate lendo comentário erra por 4,19x, porque vai com R².

Tabela de janela que eu medi (compressão de largura acima de 0,5, modelo de observador finito, `R = 200,5`), e que deve substituir a de :592-605:
```
d      graus   casas grandes   casas pequenas
300     49,3       4,38             8,76
315     53,1       4,72             9,44
500     79,4       7,05            14,11
1.000  100,0       8,89            17,78
2.000  110,0       9,78            19,56
5.639  116,5      10,35            20,71   ← saturação
```

---

## BLOCO B: GANHO DE QUALIDADE

### B1. Fase determinística do texto
`sphere.ts:1846` faz `casca.rotation.y = -π` (de `rumoDeg = 180`, `sphere.ts:1318`) e o sítio é `(0, -R_ANCHOR)`: a coluna que encara o centro da praça é `u = 0,75`, coluna 1536. Não é aleatório, é uma constante de build que ninguém usou. Passar `faseAz` para `repetirNaVolta` e rodar a volta ciclicamente por `desloc = round(0.75 * n) - round(n / rep / 2)`, para uma cópia nascer **centrada** no azimute de acesso. Custo zero, a volta já fecha exata. Ganho: o azimute mais visitado da peça deixa de ser sorteado.

### B2. Dilatação de 1 LED com guarda de vizinho
`sphere.ts:1503`. Substituir o `fillRect` de uma célula por expansão apenas para o lado que tem duas células apagadas, para o miolo do `0`, do `8` e do `M` não fechar. Ganho medido pelo diagnóstico 3: +6,6% no traço isolado, 0% de perda no alternado. Mesma quantidade de `fillRect`, zero casa perdida. Baixa prioridade, mas é barato e não tem contraindicação.

Ressalva a registrar no código: a 5.639 m o `textCull` já apagou 68% da letra (`smoothstep(0,75d, 1,15d, d)` com `uTextoDist = distTexto` dá peso 0,684), então o alcance publicável de leitura com apagamento abaixo de 25% é **4.890 m**, não 5.639.

### B3. Valor constante no slot de anúncio e ANEL simétrico
`sphere-conteudo.ts:719-733`: `slotAnuncio` quebra o anunciante em 3 quadros de 24 s e troca a linha grande a cada um (`KRAY`, `WALLET`, `TOWER`). Em 72 s de frente o leitor vê KRAY, self custody, wallet, tower, e o anunciante some da tela por 48 dos 72 s. Contraria a doutrina escrita em :71-75. Travar a linha grande em `'KRAY'` (L = 4, 76% de leitura a 1 km contra 36% de `WALLET` e 49% de `TOWER`) e variar só o rótulo.

`sphere-conteudo.ts:1022`: `ANEL = ['preco','marca-btc','volume','pulso','marca-dog','snapshot','anuncio']` dá vãos de **96 s e 168 s** entre as duas peles, razão 1,75, contra a promessa de "a cada ~2,8 min" do comentário. Reordenar para `['preco','volume','marca-btc','pulso','anuncio','marca-dog','snapshot']`: vãos de **120 s e 144 s**, razão 1,20. A casa prefere simetria em elemento repetido.

### B4. `pulsar()` recebe peso
`sphere-conteudo.ts:1193` crava `o.pulsar?.(1)` enquanto `pulsar(intensidade = 1)` (`sphere.ts:1906`) aceita o argumento. Com 144 blocos por dia todos idênticos, o gesto mais raro da peça virou o mais repetido. Passar o peso de `last_dog_block_count`, que já vem no payload: 0,45 para bloco sem DOG, 1,0 na mediana da janela de 144 amostras em memória, 1,6 acima do percentil 90. Zero chamada de rede nova.

---

## BLOCO C: RECURSO NOVO, FX-EIXO ENXUTO (três gestos, um vec4)

Só entra depois de A1 (o degrau voltou a existir, então paridade é obrigatória) e A2 (`uMedia` confiável). O partido é o certo: `s = dot(p, uFxEixo.xyz)`, com `vec3 p = normalize(vP)` que **já existe** nos dois shaders. Sem costura de meridiano, sem `atan`, sem `fwidth`, sem derivada, sem `texture2D` dentro de ramo, sem programa novo (os ~555 continuam ~555, o salto é por uniforme).

### C1. Uniformes e campo
No mesmo objeto compartilhado de `sphere.ts:1787`:
```
uFxAtivo:  { value: 0 }
uFxEixo:   { value: new THREE.Vector4(0, 1, 0, 1) }   // xyz eixo unitário, w poupa-faixa
uFxFrente: { value: new THREE.Vector4(2, 0, 0, 0) }   // x s0, y 1/meia-largura, z tinta, w brilho
uFxTinta:  { value: new THREE.Vector4(0.79, 0.16, 0.02, 0) }
```
`uMedia` precisa ser **declarado** no `FS` (a lista de `sphere.ts:1033-1053` não tem, e o uniforme já existe em :1827).

`SPHERE_S_MIN` derivado, nunca cravado: `-(SPHERE_ENTERRO * SPHERE_R - (SPHERE_PODIO_H - 1.0)) / SPHERE_R` invertido, valor **-0,43499**. O meio do campo visível é `(-0,43499 + 1)/2 = 0,28251` contra `sin(16,56°) = 0,28502`: o centro óptico já era o meio do campo `s`, com 0,0025 de diferença, 0,5 m de casca. Reconhecer, não remedir.

**Gate suave obrigatório.** `naFaixa` no `FS` (`sphere.ts:1096`) é `step()*step()`, aresta dura. Gatear um clarão com ela desenha duas linhas serrilhadas atravessando a esfera durante todo o efeito, que é exatamente o motivo pelo qual o `FS_LISO` usa `smoothstep` em :1176. Calcular uma `faixaSuave` com a fórmula do `FS_LISO` sobre `uv.y` e usar só no gate do FX. 5 ALU.

### C2. Três gestos, e só três
- **VARREDURA**, eixo `(0,1,0)`, `s0` linear de `SPHERE_S_MIN - hw` a `1 + hw`, 1,4 s, poupa-faixa 1. Bloco minerado, e só acima da mediana de tx de DOG.
- **RADIAL**, eixo `normalize(cam - centro)`, `s0 = cos(πk)` (velocidade constante sobre a superfície, não em `s`), 1,1 s, poupa-faixa 1. Doação, tx na carteira, mint.
- **CORTINA**, `uFxFrente.y = 0` (nitidez zero, máscara 1 na casca inteira), cobertura sobe, `pintar()` acontece coberto, cobertura desce, 700 ms. Substitui o dissolve que hoje derruba o ganho para o vale e **apaga** a esfera para trocar de pele. O gatilho da repintura mora no `update()`, nunca no tick de 250 ms: a janela de cobertura total tem 70 ms.

Piso de espessura: `hw = max(0.008, 1.5 * d * pxAng / R)`. Os 0,008 são ~5 linhas de LED e impedem a frente de bater com o padrão de disco. A barra engorda sozinha com a distância, pela mesma lógica com que `uVida` engorda a amplitude.

Porta de composição: `discoRel(d) = 547,0 / d`; abaixo de `d = 1.094 m` o disco ocupa mais de meia tela e a frente por pixel não rola, degrada para o canal chapado do `uEvento`, que já existe. Correção do que a P1 afirmou: no gate, em retrato 390x844, o disco ocupa **42,5% da área**, não 25%.

Custo, contado a mão e não medido em GPU: `dot` 3, máscara 6, gate suave 5, `fxG` 2, `fxT` 3, tinta 9, total **~28 ALU** atrás de `if (uFxAtivo > 0.5)`, salto coerente sobre uniforme. Ocioso: uma comparação escalar. Risco declarado: driver móvel que achata o `if` paga as 28 sempre.

Guarda de dois donos: `if (uEvento.value > 0.05) fxDesligar()`. A cortina cede ao evento.

Critério de pronto: `?stats=1` a 1.300 m no perfil BALANCED, fps com e sem efeito dentro de 3%; e a mesma frente medida no `FS` e no `FS_LISO` a 11 km em celular dpr 2 (janela que A1 devolveu) coincide dentro de 1 linha de LED.

### C3. Baralho de peles
O repaint de 7 ms já acontece na entrada de cada quadro (`sphere-conteudo.ts:1061-1074`), ~150 por hora. Trocar **qual** `pintarCorpo` roda custa exatamente zero a mais. Quatro cartas por baralho, com a regra escrita de que cartas consecutivas alternam média clara e média escura, porque além de ~7 km o espectador só enxerga a média. Com 4 + 4 a primeira repetição de um bitmap sai de 6 min para 24 min.

Cartas que eu recomendo, na ordem de custo: (a) as duas atuais; (b) polaridade invertida de cada uma; (c) a altura do bloco em letra de 90 linhas dando a volta, que resolve o problema de A3 pelo lado certo (numa peça nativa de cadeia o número é a marca, e 90 linhas leem a 14 km enquanto 7 caracteres na faixa leem a 1 km); (d) bandeira, casca inteira em `#E8660D` com uma cinta escura de 24 linhas, sem glifo, a mais barata e a que ainda funciona no cull.

---

## O QUE NÃO FAZER

- **Não subir `uGanho` agora.** A2 já move o brilho aparente do anel em +30% ao sol e +58% na sombra. Mexer nos dois ao mesmo tempo torna impossível atribuir o resultado. Remedir depois, e a escada 0,42 ocioso / 0,78 marca / 0,90 anúncio é decisão de projeto, não folga.
- **Não engrossar traço nem trocar a matriz 5x7.** O menor vão interno é de 1 célula e a fonte é compartilhada com `construction-fund.tsx:209` e `build_central_tower.py:339`. Mexer no avanço de 8 quebra os 2048/(8·8) = 32 caracteres exatos que fecham a volta sem emenda.
- **Não deformar geometria.** A silhueta é o que o embasamento assenta, e a Sphere de Vegas também não deforma. A casca é rígida, quem se mexe é a luz.
- **Não segunda textura para crossfade.** 8 MB de VRAM, um sampler e programa novo. A cortina resolve com zero.
- **Não deixar efeito ligado continuamente.** `SPHERE_VIDA_PERIODO_MS` é a doutrina: 0,083 Hz é maré, acima de 3 Hz é estroboscópio. Passagem única de 1,4 s é legítima, sequência encadeada recria o estroboscópio por outro caminho.
- **Não mover a faixa, nem suprimi-la nos slots de marca.** Suprimir apaga o dado em 26,7% do tempo no ar, contra o pedido explícito de mostrar dado a grandes distâncias.
- **Não publicar 196 m, 0,2454 m de passo, 16,84 m de letra, 2.756 m de alcance ou lat -24,69 em nenhum press kit.** Os números certos estão em A8.

## PENDENTE DE DECISÃO DO FUNDADOR

1. **A esfera vai ficar visivelmente mais clara de longe** depois de A2, e o anel do anúncio, mais de 4x. É o conserto correto, mas é mudança de aparência em produção. Ver chapa antes de subir.
2. **`N_MARCAS` cai de 6 para 4** e a marca encolhe de 250 para 200 linhas. Sem isso a compensação certa não cabe na volta. Alternativa: manter 250 linhas com N = 4 e aceitar 3,9 graus de folga entre cópias, que lê como estampa e não como logo.
3. **`ORC_PEQUENA` em 9 ou 8.** 9 dá 69% de leitura a 1 km e permite `'YOUR KEYS'`, `'IN FLIGHT'`, `'CONFIRMED'`. 8 dá 76% e obriga a cortar mais. Recomendo 9.
4. **Peso do bloco:** dar cerimônia só acima da mediana de tx de DOG derruba o gesto grande de ~6 para ~3 vezes por hora. É a diferença entre marco e notificação, e é escolha editorial.
5. **THE HOUR** (24 s na virada da hora UTC, 0,67% do ar) fica de fora deste plano por ser recurso e não conserto. Se entrar, tem de passar por `fila.push` direto e **não pode escrever `ultimoDadoValido`**: relógio não é dado de cadeia, e escrever ali mantém o anúncio vivo para sempre com zero dado no ar.
6. **`temArte`** (`sphere.ts:1938-1942`) não desliga o degrau como o comentário afirma, ele sobe o limiar. Hoje é inerte porque `distTexto` domina. Depois de A1 vale confirmar que a pele de parceiro além de 7,6 km em celular pode ler como média chapada, que é o comportamento correto mas é o conteúdo comprado.

---

# Rodada 3 (wf_6641272b-c5d): o baralho de peles



## cartas:marca

{
 "cartas": [
  {
   "nome": "THE EPOCH",
   "oQueSeVe": "Um anel de 24,6 m em que cada coluna de LED acesa e um bloco minerado do epoch corrente, e ele fecha a volta no bloco do retarget.",
   "porQueSurpreende": "2016 blocos contra 2048 colunas: o epoch de dificuldade cabe quase exato na volta da esfera, um bloco por LED. Nao e uma barra de progresso desenhada, e a grade fisica da peca virando odometro da cadeia. Quem pega ve o anel completo e a costura de 32 colunas fechando; nos 13,9 dias seguintes ele nasce vazio de novo. Sentimento: peguei o dia em que o relogio do Bitcoin zera.",
   "desenho": "Campo #0A0A0A na casca toda, faixaFundo fica no padrao #121212 (campo escuro nao precisa de null). ANEL: linhas 296 a 336 (40 linhas, 24,6 m), lat +37,97 a +30,94 graus, centro na linha 316 (lat +34,45, cos 0,8246). Uma coluna de textura por bloco: colunas 0 a 2015 sao o epoch, minerado em #E8660D, por minerar em #2A1206; as 32 colunas restantes ficam em #141414 e sao a COSTURA do epoch, centrada no meridiano 0. Repeticoes na volta: 2016 (uma por bloco) mais 8 marcas de oitavo igualmente espacadas a cada 252 colunas, 2 colunas de largura, subindo das linhas 280 a 352 (72 linhas, 44,3 m) em #C6BFB1. COMPENSACAO DE LARGURA: nenhuma, e por deducao e nao por preguica. Esta e a unica carta que quer largura constante em TEXEL e nao em arco, porque um bloco nao tem largura fisica; na linha 316 cada coluna vale 0,61511 x 0,8246 = 0,507 m de arco e o epoch inteiro mede 1.022,5 m dos 1.038,7 m da circunferencia naquela latitude. Media linear estimada 0,038 contra os 0,01406 da esfera ociosa, entao ela nao vira ponto escuro a 3 km. Faixa: grande = String(tip) (7 casas), pequena = RETARGET (8, dentro do teto de 10).",
   "quando": "Evento de bloco, em snapshot(), quando tip % 2016 === 0, mais os 6 blocos de vespera (tip % 2016 >= 2010) para nao ser um piscar de 8 s. Classe evento, gesto varredura (e da cadeia, vem de fora), peso 1,6, ganho GANHO_EVENTO 0,62. Frequencia alvo: 26 vezes por ano, uma a cada 13,9 dias, janela de cerca de 1 h.",
   "risco": "Alguem vai querer esticar 2016 para 2048 e fechar a costura; no dia em que isso acontecer uma coluna deixa de ser um bloco e a carta comeca a mentir bonito. A costura e o dado, nao o defeito. Segundo risco: feed velho atrasa o preenchimento, e 20 blocos de atraso sao 10,1 m de anel faltando; a carta so pode entrar com snapshot fresco, pela mesma regra de validade que os modulos de dado ja usam."
  },
  {
   "nome": "WHALE",
   "oQueSeVe": "Dois anexos solidos emoldurando a faixa e, acima deles, uma escada de degraus contaveis: um degrau por 10 milhoes de DOG movidos na transacao que acabou de chegar.",
   "porQueSurpreende": "O valor ja esta escrito na faixa, mas a faixa nao diz TAMANHO, diz numero. A escada diz tamanho: de 1 km a pessoa nao le o numero e mesmo assim conta cinco degraus e entende cinquenta milhoes. O que faz a carta e a raridade: se ela aparecesse toda hora viraria decoracao. Sentimento: a esfera de 401 m parou o que estava fazendo por causa de uma transacao.",
   "desenho": "Campo #0A0A0A. ANEL DE BASE: linhas 340 a 366 (26 linhas, 16,0 m), lat +30,23 a +25,66, em #E8660D, encostado no topo da faixa (368). ANEL ESPELHO: linhas 497 a 523, mesma espessura, escolhido por igual distancia em SENO do meio da faixa (linha 432, sin 0,2430) e nao por igual distancia em linha, que e como o olho compara dois aneis numa esfera. DEGRAUS: 4 linhas acesas e 4 apagadas, empilhando para cima a partir da linha 336; degrau 1 em 333 a 336, degrau 2 em 325 a 328, ate o degrau 12 em 245 a 248 (lat +47,0). Cada degrau 2,46 m de espessura, passo 4,92 m, cor #C6BFB1 creme para separar contagem de moldura. O degrau 12 sai com 8 linhas em vez de 4: ele significa 12 OU MAIS e nao pode ser lido como valor exato. Repeticoes na volta: 1 por elemento, todos sao paralelos completos. COMPENSACAO DE LARGURA: nao se aplica, anel de latitude tem largura infinita em longitude e nao distorce. Media linear so dos dois aneis: 52/1024 = 5,1% x 0,307 = 0,0156, acima dos 0,01406 do ocioso mesmo com zero degrau. Contagem legivel ate cerca de 1,5 km (2,46 m rendem 3,6 px a 1 km com 678,7 urad/px).",
   "quando": "No evento de transacao que ja existe, em transacao(tx, 'entrou'), quando donationDog(tx) passa do piso. Classe evento, gesto radial (e daqui, nao da cadeia), peso 1,6, ganho 0,62. Frequencia alvo: no maximo 1 por semana, e ela NAO se garante por limiar e sim por trava de recorrencia de 72 h; o piso sai do percentil 99 medido offline em dog_transactions, nunca de uma EMA de sessao.",
   "risco": "O valor tem de ser LIQUIDO. Uma baleia falsa nasce de publicar o UTXO inteiro em vez do delta por endereco, que e exatamente o erro de 24/08 (doacao de 10 mil saindo de um UTXO de 600 mil, sessenta vezes maior na tela). Segundo risco: o piso envelhece. Se o preco do DOG andar, 10 milhoes deixa de ser baleia, a carta vira comum e morre como carta; o piso precisa de data de remedicao, nao de constante eterna."
  },
  {
   "nome": "AFTER DARK",
   "oQueSeVe": "A esfera em modo de espera: so a grade de LED piloto acesa, um ponto a cada 4 texels, com dois fios de luz creme dando a volta, e a faixa mostrando a hora LOCAL de quem esta olhando.",
   "porQueSurpreende": "E a unica carta que nao vem da cadeia, vem do relogio do espectador. As 3 da manha ele ve um telao de 401 m dormindo e mostrando 03:14 para ele, e ninguem mais no mundo esta vendo aquele numero. A captura de tela e a prova. Sentimento: a cidade sabe que horas sao pra mim.",
   "desenho": "Campo #0A0A0A. RETICULA PILOTO: um texel aceso a cada 4 colunas e a cada 4 linhas, em #E8660D, ou seja 1/16 dos texels, passo de 2,46 m nos dois eixos. FIOS: dois aneis cheios de 4 linhas (2,46 m) em #C6BFB1, nas linhas 300 a 303 (lat +37,27) e 547 a 550 (lat -6,15), escolhidos por igual distancia em SENO do meio da faixa (0,3588 para cada lado a partir de sin 0,2430). Repeticoes na volta: 512 colunas de ponto, 2 aneis. COMPENSACAO DE LARGURA: nenhuma, e aqui isso nao e aproximacao e sim definicao: a reticula E a grade de texel da propria peca, ja em coordenada de LED, entao ela e por construcao a estrutura fisica do painel. Media linear 0,0625 x 0,307 = 0,0192, acima dos 0,01406 do ocioso, que e o que impede a carta de virar buraco preto contra o ceu da Lua. Faixa: grande = hora local em 5 casas com o glifo ':' que a fonte ja tem (03:14), pequena = AFTER DARK (10, no teto exato).",
   "quando": "Nao e evento. Ela troca a PELE do slot ocioso e do modulo pulso quando a hora local do navegador esta entre 02:00 e 05:59. Ganho fica em GANHO_OCIOSO 0,50: o escuro vem da pele, nunca do ganho, senao ela some. Nunca substitui o intervalo comercial, porque o parceiro comprou uma aparencia. Frequencia: 16,7% do relogio, alvo declarado de menos de 1 em 15 sessoes.",
   "risco": "E a carta com maior chance de violar o requisito escrito de 07/09 (ela nao pode desaparecer por completo em momento nenhum). Toda mudanca nesta pele tem de ser remedida com o mesmo mediaDe(0, H) em LINEAR que pintarTextura ja usa, e ficar em ou acima de 0,01406; baixar a reticula para 1 em 8 ja derruba para 0,0048 e mata a peca a 3 km. Segundo risco: ela publica um numero que nao e da cadeia. So pode publicar a hora, jamais um dado de dinheiro, para nao ensinar o espectador que a faixa as vezes fala de outra fonte."
  },
  {
   "nome": "THE ETCH",
   "oQueSeVe": "A idade da rune em anos, um algarismo unico de 103,3 m de altura, quatro vezes na volta, e a faixa publicando o bloco 840000.",
   "porQueSurpreende": "A carta se reescreve sozinha uma vez por ano: quem viu o 2 em 2026 nao vai ver o 2 de novo nunca mais. E ela e o exercicio limpo da distorcao equirretangular, aquele que o fundador pegou a olho no simbolo do Bitcoin. Sentimento: a esfera esta comemorando um aniversario que eu tambem tenho.",
   "desenho": "Campo #0A0A0A. ALGARISMO: a mesma matriz 5x7 da faixa, em escala 24 (24 linhas de LED por pixel de glifo), ou seja 7 x 24 = 168 linhas de altura = 103,3 m, ocupando as linhas 146 a 313, centrado na linha 230. Cor #E8660D. Largura nominal 5 x 24 = 120 texels. COMPENSACAO DE LARGURA, por LINHA: larg(v) = 120 / cos(lat(v)), com lat(v) = pi/2 - pi(v+0,5)/1024. Na linha 146 (lat +64,34, cos 0,4331) isso da 277,1 texels; na linha 313 (lat +34,98, cos 0,8193) da 146,5. A cunha ABRE para cima, razao 1,90, exatamente o inverso do defeito que pintarCorpoBitcoin corrigiu. Implementacao identica a que ja funciona: rasterizar o glifo num canvas fora de tela em aspecto verdadeiro e blitar fatia por fatia com drawImage, uma linha por vez, com 2x de supersampling horizontal. Repeticoes na volta: 4, igualmente espacadas; na linha de cima somam 4 x 277,1 = 1.108 dos 2.048 texels, 54,1%, sobrando 45,9% de campo entre elas. Mais dois aneis de piso de 12 linhas em #E8660D nas linhas 340 a 352 e 511 a 523, que e o que segura a media linear em cerca de 0,0157. Faixa: grande = 840000, pequena = THE ETCH (8).",
   "quando": "Entra no anel de dado no lugar do slot marca-dog durante as 24 h do dia 20 de abril em UTC, com ganho GANHO_MARCA 0,78 (identidade, nao anuncio, e nunca consome cota de parceiro). Frequencia: 1 vez por ano.",
   "risco": "A data e o bloco tem de ser conferidos contra o dado da propria casa antes de subir. Publicar um aniversario errado num painel de 401 m e a pior falha possivel desta casa, e ja aconteceu uma vez com o preco de teste cravado. Segundo risco, e ele tem data: quando a idade chegar a 2 algarismos, 4 copias pedem 4 x 554 = 2.216 texels na linha de cima e nao cabem nos 2.048; N tem de cair para 3 antes de abril de 2034, com a mesma regra de espacamento igual. Terceiro: FONTE e GLIFOS sao privados de sphere.ts, entao ou se exporta a matriz ou se redeclara os 10 digitos, e redeclarar cria duas fontes na mesma peca."
  },
  {
   "nome": "FIRST LOT",
   "oQueSeVe": "A casca inteira vira mapa de lote: uma graticula alaranjada de ruas dando a volta, com exatamente UMA celula acesa em creme, e a cauda do endereco do dono na faixa.",
   "porQueSurpreende": "Ela acontece uma vez na historia da cidade e nunca mais. E ela recompensa quem se mexe: a celula acesa esta em um azimute so, entao a pessoa tem de girar a camera para achar o primeiro lote mintado da DogCity. Sentimento: existe uma celula acesa naquela esfera, e ela tem dono.",
   "desenho": "Campo #0A0A0A. GRATICULA: aneis a cada 32 linhas (32 aneis, da linha 0 a 1023) com 2 texels de espessura, e meridianos a cada 32 colunas (64 meridianos) com 2 texels de largura, tudo em #E8660D. A malha e cortada na linha 652,5 (o briefing traz 658,7; a diferenca de 6 linhas, 3,8 m, some no corte e nao muda nada aqui). Celula de 32 x 32 texels = 19,7 x 19,7 m, contra os cerca de 778 m2 por carteira do tecido real (66,767 km2 sobre 85.824 carteiras): e emblema, nao escala de lote. O LOTE: a celula das linhas 304 a 336, com a coluna sorteada de forma deterministica pelo txid do mint, preenchida em #C6BFB1 creme, que e o creme do letreiro. COMPENSACAO DE LARGURA, por LINHA, e SO na celula: larg(v) = 32 / cos(lat(v)), o que da 39,8 texels na linha 304 (lat +36,56) e 37,3 na linha 336 (lat +30,94); sem isso o lote sai trapezio. A graticula NAO e compensada de proposito: graticula que converge para o polo e o que faz a peca ler como globo. Repeticoes na volta: 64 meridianos, 32 aneis, 1 celula. Media linear cerca de 0,037, folgada. Faixa: grande = fmtCauda(endereco) em 6 casas, pequena = FIRST LOT (9).",
   "quando": "No gancho mint() que ja existe e nunca foi chamado, quando o contador de mints do servidor for exatamente 1. Classe evento, gesto radial, peso 1,6, ganho 0,62, e depois a carta e aposentada para sempre.",
   "risco": "Ela dispara uma vez e nao tem segunda chance, entao tem de ser ensaiada contra um mint falso antes do dia do mint, com um portao de previa do tipo ?pele=firstlot. E o primeiro tem de ser decidido no SERVIDOR: um contador no cliente reinicia a cada recarga e faria a carta de uma vez na historia disparar para cada visitante, que e o jeito mais rapido de transformar a peca mais rara do baralho na mais comum."
  },
  {
   "nome": "THE HALVING",
   "oQueSeVe": "Uma pilha de sete aneis cheios em que cada um tem metade da espessura do anterior, de 39,4 m ate 0,62 m, convergindo para dentro da faixa de dado.",
   "porQueSurpreende": "E a curva de emissao do Bitcoin desenhada em latitude, e ela termina exatamente onde o numero comeca: a faixa e o limite da convergencia. Nada tiquetea, nada gira, e mesmo assim a peca conta uma historia de 4 anos numa imagem. Sentimento: eu estava olhando a esfera no halving, e tenho a chapa.",
   "desenho": "Campo #0A0A0A. ANEIS em #E8660D, cada um com metade da espessura e metade do vao do anterior: linhas 150 a 213 (64 linhas, 39,4 m, lat +63,63 a +52,56), 246 a 277 (32 linhas, 19,7 m), 294 a 309 (16, 9,8 m), 318 a 325 (8, 4,9 m), 330 a 333 (4, 2,5 m), 336 a 337 (2, 1,2 m) e 339 (1 linha, 0,62 m). O ultimo anel para na linha 339 e a faixa comeca na 368: 28 linhas, 17,2 m, de folga limpa. Total aceso 127 linhas = 78,1 m. Repeticoes na volta: 1 por anel, e essa e a simetria mais forte que a peca tem, porque um paralelo completo e igual de todo azimute. COMPENSACAO DE LARGURA: nenhuma e nenhuma e necessaria, e esta carta e a que ensina a outra metade da regra: a distorcao equirretangular so existe para forma LOCAL; anel de latitude e meridiano nao distorcem. Media linear 127/1024 = 12,4% x 0,307 = 0,038, a carta mais acesa do baralho. Faixa na vespera: grande = blocos que faltam, pequena = TO GO (rotulo que ja existe); no bloco: grande = 1050000, pequena = HALVING (7).",
   "quando": "Substitui o slot marca-btc no anel de dado durante os 144 blocos anteriores (cerca de 24 h) com ganho GANHO_MARCA 0,78, e vira evento de classe evento com gesto varredura e peso 1,6 no bloco exato. Frequencia: 1 vez a cada 210.000 blocos, 3,99 anos. A proxima e o bloco 1.050.000, 83.330 blocos depois do snapshot 966.670, cerca de 579 dias.",
   "risco": "Ela e escrita hoje e roda daqui a mais de um ano e meio, quando ninguem lembrar que existe. Sem um portao de previa (?pele=halving) e um teste do gatilho na suite, ela e codigo morto que estreia errado no dia de maior audiencia da cadeia. Segundo risco: a tentacao de antecipar a vespera para 2016 blocos para ver a carta mais cedo; isso a poe no ar por 14 dias e queima justamente a raridade que e todo o valor dela."
  }
 ]
}

## cartas:dado

{
 "cartas": [
  {
   "nome": "O GLIFO DE 181 M",
   "oQueSeVe": "A esfera inteira vira UM caractere: um mais, um menos ou um algarismo de 180,8 m de altura, quatro vezes na volta.",
   "porQueSurpreende": "Hoje o maior conteudo da peca e a letra de 90 linhas do $DOG (55,4 m). Este glifo tem 294 linhas e le a 24,7 km, ou seja de fora da cidade: e o unico formato em que a esfera nao mostra um dado, ela E o dado. E o + e o - dizem a direcao do dia sem verde nem vermelho, so peso (GANHO_ALTA 0,50 contra GANHO_QUEDA 0,38) e temperatura (COR_DADO_FRACO), que e a regra ja escrita da casa.",
   "desenho": "Faixa APAGADA: grande:'' e pequena:'' (string vazia; NUNCA ' ', porque repetirNaVolta com um espaco tem t.length=1 e desenha tres grupos de '· ·' na esfera), faixaFundo:null. Casco #0A0B0D. Glifo da matriz 5x7 de sphere.ts:652 em escala 42 linhas de LED por pixel de glifo: altura 7x42 = 294 linhas = 180,8 m, centrado na LINHA 418 (o centro optico), ocupando as linhas 271 a 565, lat +42,36 a -9,32, cos 0,739 a 0,987. Arco do glifo 5x42 = 210 texels = 36,9 graus; a largura em TEXTURA sai por linha, larg(v) = 210/cos(lat(v)), o que da 284 texels na linha 271 e 213 na 565 (a cunha ABRE para cima). Implementacao: rasterizar o glifo em aspecto verdadeiro num offscreen de 2x horizontal e blitar fatia a fatia com drawImage, exatamente o laco de pintarCorpoBitcoin em sphere-conteudo.ts:663, so trocando o conteudo do offscreen; sao 294 drawImage por copia, 1.176 no total, contra os 800 que o ₿ ja faz. Quatro copias em (i+0,5)/4 da volta: periodo 512 texels, folga de 228 na linha mais larga. Tinta #E8660D. O '-' e a linha 3 de 7: vira quatro barras de 42 linhas (25,8 m) por 123 m de arco, separadas por 178 m de vao, o que NAO se confunde com a cinta continua da Kray. O grupo de 210 texels cabe na janela legivel (que satura em 116,5 graus, 663 texels) ja aos 315 m do orcamento.",
   "quando": "Quadro 2 do slot 'preco' (24 s), no lugar do fmtPct atual; no evento 'bloco' quando o bloco trouxe de 0 a 9 tx de DOG (o '0' e noticia, como o codigo ja diz); e nos ultimos nove blocos antes do bloco 966.670, uma vez na historia.",
   "risco": "ARMADILHA REAL: pele parametrizada por dado e um CLOSURE novo a cada quadro, e trocaDePele compara identidade de funcao ((q.c.pintarCorpo ?? null) !== peleAtual). Toda troca de valor vai disparar a cortina de 700 ms. Ou memoiza por valor num Map<string, fn>, ou aceita uma cortina por quadro. Segundo risco: a 24,7 km o espectador ve o sinal e nao a magnitude, entao o quadro 1 (o preco na faixa) e obrigatorio antes dele."
  },
  {
   "nome": "O REGRESSIVO GIGANTE",
   "oQueSeVe": "Os tres digitos que faltam para o snapshot, com 103,3 m de altura, dando a volta na esfera tres vezes.",
   "porQueSurpreende": "E o unico numero do projeto que todo mundo esta esperando, e hoje ele sai na faixa em 34,45 m, lido a 4,7 km. Aqui ele le a 14,1 km e ocupa a peca inteira: o predio do DogData vira o relogio do snapshot. Nada tiquetea, ele so anda quando a ponta da chain anda, que e a doutrina de snapshot.tsx.",
   "desenho": "Faixa apagada (grande:'', pequena:'', faixaFundo:null). Casco #0A0B0D, digitos #E8660D. Matriz 5x7 em escala 24: altura 168 linhas = 103,3 m, centrada na 418, linhas 334 a 502, lat +31,3 a -0,3, cos 0,854 a 1,000. Grupo de 3 digitos = 2x(8x24) + 5x24 = 504 texels = 88,6 graus de longitude; largura por linha larg(v) = 504/cos(lat(v)), 590 texels na linha de cima e 504 na de baixo. Tres copias, periodo 683 texels, folga de 93 na linha mais larga. O grupo INTEIRO entra na janela legivel a partir de ~640 m (interpolando a tabela de janela do proprio arquivo: 302 texels a 315 m, 452 a 500 m, 569 a 1 km, 663 na saturacao). Bonus medido de graca: uCorFaixa e a media das linhas 368 a 496, e o digito atravessa essa banda, entao o anel que sobra alem do textCull passa a ser laranja em vez de chumbo.",
   "quando": "Quadro 1 do slot 'snapshot', no lugar do quadro('744','TO GO'); os quadros 2 e 3 (TARGET, ESTIMATE) seguem na faixa normal, com a pele saindo.",
   "risco": "So vale ate 999 blocos. Com 4 digitos o grupo vai a 672 texels e so entra na janela alem de 1,3 km, e um regressivo cortado na frente publica '44' onde faltam 744, que e exatamente a classe de erro que o zero da frente do fmtPreco existe para evitar. Regra: acima de 999 este quadro nao entra e a carta UMA LUZ POR UNIDADE assume."
  },
  {
   "nome": "A SUA CAUDA NO LARANJA",
   "oQueSeVe": "A casca inteira acende em laranja e a cauda de 6 caracteres do endereco de quem acabou de comprar aparece recortada em quase preto, 51,7 m de altura.",
   "porQueSurpreende": "O requisito escrito do fundador e que quem comprou veja a cidade reagir a compra dele. Hoje a cauda sai na faixa, dividindo a peca com o resto; aqui ela e a UNICA coisa em 120.687 m2 de casca. E o mecanismo do recorte ja esta provado: a pele do Bitcoin e exatamente isto, laranja pleno com a marca em negativo.",
   "desenho": "Pele: g.fillStyle #E8660D sobre o canvas inteiro, cauda recortada em #140B04 (o mesmo par da pele do ₿). Faixa apagada (grande:'', pequena:'', faixaFundo:null; o casco laranja e dono do fundo). Matriz 5x7 em escala 12: altura 84 linhas = 51,7 m, centrada na 418, linhas 376 a 460, lat +23,91 a +9,14, cos 0,914 a 0,987. Grupo de 6 caracteres = 5x(8x12) + 5x12 = 540 texels = 94,9 graus; largura por linha larg(v) = 540/cos(lat(v)), 591 texels em cima e 547 embaixo. Tres copias, periodo 683, folga 92. Leitura: pixel de glifo de 7,38 m, 7,0 km, contra 4,7 km da mesma cauda na faixa; e o grupo inteiro entra na janela a partir de ~800 m. Ganho GANHO_EVENTO 0,62, que fica abaixo do 0,78 das peles de marca e do 0,90 do anuncio, entao a hierarquia de voz nao quebra.",
   "quando": "Quadro 2 do evento 'doacao' (ROTULOS.doadorDe) e quadro 2 do evento 'mint' (ROTULOS.mintDono); o quadro 1 continua sendo o VALOR na faixa normal, para o valor nao virar pele.",
   "risco": "Casca laranja plena e a assinatura do ₿; a diferenca aqui e a latitude do conteudo (418 contra 230) e o ganho (0,62 contra 0,78). Se o fundador achar que colidiu, o conserto e trocar o fundo por #0A0B0D e a cauda por #E8660D, sem mexer na geometria. Risco 2: a cauda e dado de uma pessoa em 401 m de tela; ja e doutrina publicada, mas mint em lote (varios lotes, varios donos) precisa de regra de qual endereco sobe."
  },
  {
   "nome": "UMA LUZ POR UNIDADE",
   "oQueSeVe": "A casca vira uma reticula de quadrados de luz e cada quadrado aceso e UMA coisa: uma tx de DOG parada na mempool, ou um bloco que ainda falta para o snapshot.",
   "porQueSurpreende": "E o numero virando imagem sem nenhum algarismo: da para VER a mempool encher e a contagem esvaziar, e a cada bloco minerado o muro perde uma luz sozinho. E o mesmo idioma do estadio (1 assento por carteira) e do The Tally (1.000 cartas), so que em 401 m. Nao e grafico porque nao ha eixo nem escala: cada luz e um objeto.",
   "desenho": "Faixa apagada, casco #141414, celula acesa #E8660D, celula morta #1F1F1F, com 3 texels de rego para a reticula ler como grade. A compensacao de largura se resolve na CONSTRUCAO da celula, nao na pintura: cada fileira tem altura h em linhas e a largura da celula e w = h/cos(lat da fileira), arredondada para COLS/n de modo que a volta feche exata, o que faz TODA celula ser um quadrado de verdade na casca. Versao MEMPOOL, 10 fileiras na banda 168 a 628: celula de 46 linhas = 28,30 m, colunas por fileira 24, 29, 33, 37, 40, 42, 44, 44, 44, 42, TOTAL 379 celulas, cada uma legivel a 27,0 km. Versao SNAPSHOT, 20 fileiras na mesma banda: celula de 23 linhas = 14,15 m, colunas de 46 (lat +58,4) a 88 (equador), TOTAL 1.524 celulas, legiveis a 13,5 km, ou seja 1 celula = 1 bloco enquanto faltarem ate 1.524 blocos (10,6 dias). Ordem de aceso, seguindo a simetria da casa: da fileira mais proxima da linha 418 para fora, e dentro da fileira a partir da coluna que encara a praca (u = 0,75, a fase que repetirNaVolta ja usa), alternando para os dois lados. Custo: 1.524 fillRect contra os ~3.360 que o texto da faixa ja faz.",
   "quando": "Quadro 1 do slot 'pulso' (ROTULOS.pendentes) na versao de 379; e quadro 1 do slot 'snapshot' na versao de 1.524, assumindo quando faltam mais de 999 blocos e o REGRESSIVO GIGANTE nao pode entrar.",
   "risco": "O muro e quase estatico: uma luz morre a cada ~10 min no snapshot, o que e imperceptivel numa visita. Ele vale como retrato, nao como noticia, e depende do evento de bloco (varredura + pulso) para ter movimento. Risco 2: sem legenda, 1.100 luzes acesas nao dizem 1.100; a faixa precisa voltar com o numero pelo menos num dos quadros do slot. Risco 3: com dog_pending acima de 379 a versao mempool satura e mente por saturacao; acima disso, apagar o excedente e escrever o numero."
  },
  {
   "nome": "A COR DA PRESSAO",
   "oQueSeVe": "Nenhum desenho: a esfera inteira assume um tom, e o tom e a taxa da rede naquele momento, em cinco degraus.",
   "porQueSurpreende": "E a unica carta que continua falando a 8 km, onde todo texto ja morreu: uCorFaixa e uMedia passam a ser o proprio tom, entao o disco distante inteiro muda de cor. E a mais barata do baralho, um fillRect. Efeito de marketing: a cidade aprende a olhar para o predio do DogData e saber, sem ler, se a rede esta cara hoje.",
   "desenho": "Unica carta que NAO apaga a faixa: pintarCorpo faz um fillRect do tom no canvas inteiro, faixaFundo recebe o MESMO tom (nao null e nao o padrao #121212, senao volta a tarja escura que o fundador ja apontou), e o texto segue normal. Escada de cinco degraus, misturados de #141414 para #E8660D em sRGB, com a luminancia relativa medida e a razao contra o painel apagado refletido #2C2C2D (Y 0,0253): t 0,26 = #4B2912 (Y 0,0313, 1,24x), t 0,44 = #713811 (Y 0,0638, 2,53x), t 0,62 = #974710 (Y 0,1112, 4,40x), t 0,80 = #BE560E (Y 0,1763, 6,98x), t 0,94 = #DB610D (Y 0,2364, 9,36x). O degrau mais baixo fica ACIMA do painel refletido de proposito: a peca nunca pode ler como apagada. Cortes por sats/vB: menos de 4, 4 a 10, 10 a 25, 25 a 60, acima de 60, que e a mesma logica de escada honesta do ETA do snapshot. Nos degraus 4 e 5 a faixa INVERTE (cor e corRotulo em #140B04), pela mesma razao que slotBitcoin inverte: laranja sobre laranja some.",
   "quando": "Quadro 3 do slot 'pulso' (ROTULOS.taxa, SATS/VB). Pode tambem virar o tom de fundo permanente do slot 'pulso' inteiro, os tres quadros.",
   "risco": "E uma escala sem legenda: ninguem le 40 sats/vB num tom. Ela so vale acompanhada, e por isso a faixa fica viva. Risco 2: o degrau 5 (#DB610D) fica a 0,03 de luminancia do #E8660D da pele do ₿ e, sem a marca recortada, pode ser lido como a pele do Bitcoin; se incomodar, capar em #BE560E e deixar o ultimo passo por conta do ganho. Risco 3: casca chapada e o unico caso em que a ondulacao da grade de LED (hoje ~8% do painel ao sol) fica sozinha, e a esfera arrisca ler como bola lisa em vez de tela."
  },
  {
   "nome": "O PRECO EM SATS",
   "oQueSeVe": "O preco do DOG na unidade nativa, quatro caracteres de 77,5 m dando a volta tres vezes, com SATS na faixa.",
   "porQueSurpreende": "E uma descoberta de produto, nao de desenho: 0.00113 tem 7 caracteres, gasta a linha grande inteira e so aparece inteiro para uma minoria dos azimutes; o MESMO preco em sats tem 4 caracteres e vira pele de casca inteira. A esfera de 401 m nao consegue publicar o preco em dolar como imagem, e consegue publicar em sats. E e a unidade certa para uma rune, dita do predio do DogData.",
   "desenho": "Faixa com grande:'' e pequena:'SATS' (4 caracteres, dentro do teto ORC_PEQUENA de 10), faixaFundo:null; o rotulo continua nas linhas 450 a 478 e a pele fica com o resto. Casco #0A0B0D, digitos #E8660D. Matriz 5x7 em escala 18: altura 126 linhas = 77,5 m, centrada na 418, linhas 355 a 481, lat +27,6 a +5,4, cos 0,886 a 0,996. Grupo de 4 caracteres (por exemplo 10.2, com o ponto valendo uma casa cheia) = 3x(8x18) + 5x18 = 522 texels = 91,8 graus; largura por linha larg(v) = 522/cos(lat(v)), 589 texels em cima e 524 embaixo. Tres copias, periodo 683, folga 94. Leitura: pixel de glifo de 11,07 m, 10,6 km; grupo inteiro dentro da janela a partir de ~710 m. Mesmo laco de blit por linha do ₿.",
   "quando": "Alternando com o quadro 1 do slot 'preco': um ciclo publica 0.00113 / USD SPOT na faixa, o seguinte publica a pele de sats. Um ciclo tem 264 s, entao a esfera troca de unidade a cada ~9 min.",
   "risco": "Precisa de BTC/USD, que este arquivo NAO tem: /api/price/kraken so entrega price_usd do DOG. Sao duas fontes multiplicadas, ou seja um numero DERIVADO publicado em 401 m, que e a mesma classe do preco falso de 0,00042 que ja foi ao ar. Regra dura: so entra com as duas fontes dentro da validade, e se qualquer uma vencer o quadro e PULADO sem lapide. Risco 2: sats por DOG nao e um par cotado em lugar nenhum, entao alguem vai comparar com uma corretora e achar erro; o rotulo SATS ajuda pouco, e o denominador precisa estar escrito em algum lugar do site."
  }
 ]
}

## cartas:momento

{
 "cartas": [
  {
   "nome": "A LUA CHEIA",
   "oQueSeVe": "A esfera vira a Lua cheia, com os mares nas posicoes selenograficas reais e a face que todo mundo conhece de cor virada para a praca.",
   "porQueSurpreende": "E a peca inteira virando um objeto que ninguem precisa aprender, e ela esta EM CIMA do objeto: o telao mostra o chao em que a cidade foi construida. Fecha o ticker DOG GO TO THE MOON sem gastar um caractere com a frase, e o Mar da Tranquilidade, que e o distrito BTC da cidade, cai exatamente sob a faixa de dado.",
   "desenho": "Casca inteira em #9A9488 (planalto aceso); os mares entram em #101010, que e literalmente LED apagado. Cada mar e uma elipse desenhada POR LINHA, sem canvas auxiliar: meiaLarg(v) = a*sqrt(1-((v-vc)/a)^2)/cos(lat(v)) texels, um fillRect por linha, cerca de 1.800 no total (o B de hoje ja faz 800 blits). Conversao 1:1, porque grau de Lua e grau de esfera: 1 grau = 5,689 linhas. Centro em linha / altura em linhas / longitude: Procellarum 407 / 482 / -57 (entra como 3 elipses sobrepostas, e oceano e nao circo), Imbrium 325 / 215 / -15,6, Frigoris 193 / 271 / +1,4, Serenitatis 352 / 133 / +17,5, Crisium 415 / 104 / +59,1, Tranquillitatis 463 / 164 / +31,4, Fecunditatis 556 / 158 / +51,3, Nectaris 598 / 63 / +34,6, Nubium 633 / 134 / -16,6, Humorum 650 / 73 / -38,6. Coluna = ((0,75 + lon/360) mod 1)*2048, entao lon 0 cai na coluna 1.536, que e a que encara a praca pela mesma constante de fase que repetirNaVolta usa. Costa irregular de graca: multiplicar a meia largura por (1 + 0,06*sin(3,1k) + 0,04*sin(7,7k+1,3)), semente fixa, nada sorteado por quadro. Faixa: faixaFundo aceita qualquer fillStyle, entao 'rgba(6,6,6,0.70)' e VEU e nao tarja (o mesmo truque resolve a tarja de 07/09 sem apagar o chao); sob o veu o #E8660D fica em 4,2:1 contra o planalto e em 53:1 contra o mar. Um ponto #E8660D de 6 texels dentro de Tranquillitatis marca a cidade. Copy: '$DOG' / 'THE MOON', que ja existe.",
   "quando": "Segundo quadro do slot marca-dog, 24 s, no lugar do casco escuro de pintarCorpoDog. E troca de uma linha: pintarCorpo: pintarCorpoLua.",
   "risco": "Bola branca. O planalto a ganho 0,78 e a coisa mais clara que a peca ja emitiu e pode ler como esfera embranquecida de longe; medir uMedia contra a pele marca-btc (0,2353) e cair para 0,62 se passar do intervalo comercial. E tudo abaixo de -25,9 graus esta fora da casca: Tycho e os raios do sul nao existem nesta Lua."
  },
  {
   "nome": "O SIMBOLO DE UMA FACE SO",
   "oQueSeVe": "Um unico simbolo do Bitcoin ocupando 77% da altura e 34% da largura da silhueta, virado para a praca, e a peca inteira sem uma letra.",
   "porQueSurpreende": "E o movimento de Las Vegas, e ele contraria de proposito a simetria da casa: uma forma so, uma face, as costas em laranja pleno. De quebra ele conserta um defeito medido: o B de hoje aparece 1,54x GORDO para qualquer olho distante.",
   "desenho": "A compensacao de LARGURA ja existe no arquivo; falta a de ALTURA, e ela e a maior das duas. Medido: o B atual (200 linhas na 230, arco 124 passos) aparece com 75,2 m de largura por 78,7 m de altura, aspecto 0,956 contra os 0,620 do glifo, ou seja 1,54x gordo, e nenhuma conta de cos(lat) conserta porque o erro e da PROJECAO e nao da textura. A regra certa distribui as linhas do glifo por sen(lat) constante: linha k de K vai para sen = s0 - (k+0,5)/K*(s0-s1), e a largura continua sendo arco/cos(lat). Com s0 = +0,80 e s1 = -0,30 o glifo mora nas linhas 209 a 611 (402 linhas de textura para 220,6 m aparentes), arco central de 227,2 passos, saindo 379 colunas na linha do topo, 235 no meio e 238 na base. Aparente 136,7 x 220,6 m, aspecto 0,620 por construcao. N = 1 e cx = 0,75*w (coluna 1.536). Fundo #E8660D, glifo #140B04, marcaBitcoin() sem mudanca nenhuma. Silencio total na faixa: grande e pequena em string VAZIA, porque repetirNaVolta devolve espacos e a FONTE nao tem glifo para espaco, entao nada e desenhado, mais faixaFundo null.",
   "quando": "Primeiro quadro do slot marca-btc, 24 s, seguido do quadro de altura de bloco com as 4 marcas de hoje. Grita, depois informa.",
   "risco": "Tres dos quatro azimutes veem laranja liso por 24 s. E a intencao, mas quem esta do outro lado da praca nao ve marca nenhuma, e isso precisa ser aceito antes do ar. E a peca fica sem dado por 24 s: o teto de anuncio nao conta esse tempo como propaganda, mas ele tambem nao e dado."
  },
  {
   "nome": "UM LED POR CARTEIRA",
   "oQueSeVe": "Casca preta coberta por dezenas de milhares de pontos acesos, um por carteira, com a contagem na faixa.",
   "porQueSurpreende": "E o DogData virando forma em vez de virar frase. A densidade E o dado, o maior ponto e a maior carteira, e um estranho le 'isto conta uma multidao' antes de ler a legenda. E a unica pele em que a peca fala do que a casa faz.",
   "desenho": "Fundo #0A0A0A. Aqui a compensacao nao e de largura, e de DISTRIBUICAO: sortear a linha por AREA, v = linha(asin(s)) com s uniforme em [-0,4365, +1], que e o intervalo de sen da casca visivel. Prova de que esta certo: a mediana cai na linha 418,4, que e o centro optico da silhueta. Sorteando linha uniforme os pontos empilhariam no polo. Coluna uniforme em [0, 2048). PRNG de semente fixa (mulberry32), entao o ceu e o MESMO em toda repintura e nada cintila. Tamanho por saldo: 1 texel na cauda, 3x3 acima de 1M DOG, 9x9 na maior (a Kraken quente com 12,69B vira o ponto que sobrevive a 1 km). Cor #E8660D para carteira que ja gastou e #C6BFB1 para a que nunca enviou (as 6.035 diamond paws), que e status por familia de cor e nao por matiz nova. Densidade medida: 958.927 LEDs visiveis, 86 mil pontos = 8,98%, um a cada 11,1. Com os 260.982 da Galaxia daria 27,2% e viraria ruido, entao tem teto. Custo: 86 mil fillRects nao cabem nos 7 ms, entao o ceu e montado UMA vez num canvas de fora e entra por um drawImage; 8 MB a mais de RAM, declarado, remontado so quando a contagem muda. Copy: grande com a contagem (6 caracteres, a FONTE tem virgula), pequena 'HOLDERS'.",
   "quando": "Quinto modulo de dado do anel, 48 s em dois quadros (contagem e a fatia da maior carteira). Isso leva a fatia de propaganda de 27,27% para 23,08%, ou seja para o lado certo do teto.",
   "risco": "O ponto de 1 texel morre a 443 m, que e onde o LED encosta em 1 px, entao de 5 km isto e um brilho medio e nao um censo; so os pontos grandes atravessam. A faixa cobre 26,4% da AREA visivel (nao os 12,5% da altura), porque ela mora onde a area e densa: se incomodar, faixaFundo 'rgba(10,10,10,0.85)' deixa os pontos grandes fantasmarem por tras do texto. E a contagem tem de vir de rota com validade, nunca de constante: foi assim que o preco mentiu em 07/09."
  },
  {
   "nome": "A PLANTA NO POLO",
   "oQueSeVe": "O topo da esfera e a planta da DogCity vista de cima, aneis e radiais, com um ponto laranja exatamente onde o espectador esta.",
   "porQueSurpreende": "Transforma o polo, que ate hoje so podia ser cor, na melhor superficie da peca: a camera da /city sobe sem teto e desce ate o zenite (minPolarAngle 0), e e de cima que esta cidade e olhada. E a projecao azimutal polar e o unico caso em que a compensacao de largura DESAPARECE: anel vira linha horizontal, radial vira barra vertical, e a esfera usa a cartografia da bandeira da ONU.",
   "desenho": "Fundo #0A0A0A, escala 20 m por linha, centro da cidade no polo. Aneis sao DODECAGONOS, com r sendo o VERTICE e a face em 96,59%, entao cada anel e uma senoide de 12 periodos na volta com amplitude r*0,0341/20 linhas: r 2.000 oscila entre as linhas 96,6 e 100,0; r 3.500 entre 169,0 e 175,0; r 5.000 entre 241,5 e 250,0; a AN7 em 6.950 entre 335,7 e 347,5. Traco de 2 linhas em #6E6A60. Radiais: 12 barras de 2 colunas a cada 170,67 colunas, da linha 45 (dominio da praca, r 900) ate o anel que servem. Sitio phi 5.500 na linha 275, contorno de 1 linha em #C6BFB1. Baia: mancha #0A0A0A com borda #2C2C2D entre as linhas 300 e 347 no azimute dela. O lote da Sphere fica em r 5.117,5, linha 256, e o mapa e girado para esse azimute cair na coluna 1.536: ponto #E8660D de 6x6 texels, que e o 'voce esta aqui' no meio exato do que se ve da praca. Nada abaixo da linha 350, entao a faixa fica intacta com o chao padrao #121212. Copy: 'DOGCITY' / 'THE CITY'.",
   "quando": "Estado ocioso e modulo SNAPSHOT. Hoje o ocioso e casca preta com DOGCITY escrito; com a planta ele passa a dizer o que a peca e sem gastar caractere, e o estado neutro deixa de ser ausencia.",
   "risco": "As vias saem 4 a 6 vezes mais largas que a escala (2 linhas = 40 m contra asfalto de 6 a 10 m): isto e diagrama, nao planta, e nao pode virar argumento de terreno. A azimutal equidistante espreme o azimute em 18% na borda (sin(theta)/theta em 61,08 graus). E nao desenhar lote nenhum: lote so nasce no snapshot."
  },
  {
   "nome": "A ESFERA ENCHENDO",
   "oQueSeVe": "A esfera enche de laranja de baixo para cima, um degrau visivel a cada bloco de Bitcoin, no ultimo dia antes do snapshot.",
   "porQueSurpreende": "E um medidor que dispensa legenda: qualquer pessoa entende 'esta enchendo'. E respeita a doutrina de nada tiquetear, porque quem move o nivel e o bloco e nao o relogio, exatamente como o countdown da landing.",
   "desenho": "A linha do nivel NAO e latitude proporcional, e area de SILHUETA. A casca e cortada em sen -0,4365, entao a area aparente vale F(1)-F(-0,4365) = 2,4126 R^2, com F(y) = y*sqrt(1-y^2) + asin(y). Resolvendo F(t) = F(-0,4365) + p*2,4126: 25% cai na linha 550,6; 50% na 451,4 (e nao no equador, e essa e a armadilha); 75% na 338,4; 90% na 240,4. Abaixo da linha #E8660D, acima #0A0A0A, com 3 linhas de menisco em #C6BFB1 na borda para ler como nivel e nao como corte. Janela de 144 blocos (o ultimo dia): cada bloco move cerca de 4 linhas, 2,5 m de casca, degrau visivel que some antes de virar animacao. A faixa e um DEGRAU do medidor e nao um obstaculo: com o nivel abaixo da linha 496 (p < 38,8%) a faixa fica normal; quando o nivel entra nela, a faixa acende inteira com faixaFundo '#E8660D' e cor '#140B04'; acima de p 69,1% o preenchimento continua por cima. Tres estados de conteudo, zero mecanismo novo. Copy: grande com os blocos que faltam, pequena 'TO GO', que ja existe.",
   "quando": "Slot proprio com prioridade nos 144 blocos antes do bloco 966.670, repintando no evento de bloco que o feed ja entrega (custo de rede zero). Fora dessa janela ele nao existe.",
   "risco": "Medidor vazio e a pior imagem possivel de uma peca de 401 m, entao a janela tem de ser curta o bastante para o nivel ja nascer alto (144 blocos, nunca 10.000). E se ele for reapontado para arrecadacao em vez de contagem de bloco, o denominador vira promessa e a esfera passa a publicar quanto falta para os 10M, que e decisao comercial e nao de cena."
  },
  {
   "nome": "A COROA DO PARCEIRO",
   "oQueSeVe": "O casco preto da Kray com a coroa branca dela repetida 4 vezes na volta, logo acima das duas cintas.",
   "porQueSurpreende": "O parceiro deixa de ser duas cintas e um nome escrito e ganha a mesma cerimonia geometrica que o Bitcoin tem. E o que muda de verdade e que o baralho vira produto: a compensacao sai de dentro de pintarCorpoBitcoin e vira peleMarca(), entao o proximo parceiro entra sem ninguem tocar em trigonometria de novo.",
   "desenho": "peleMarca(g, w, h, { fundo, tinta, desenhar, n, s0, s1 }) faz o laco que hoje esta enterrado no Bitcoin, com as DUAS compensacoes: linhas distribuidas por sen(lat) constante e largura por arco/cos(lat). Kray: fundo #07080A, tinta #F2F4F7, n = 4, s0 = +0,92 e s1 = +0,72, ou seja linhas 131 a 250, com 52,1 m de largura por 40,1 m de altura aparentes (a coroa e mais larga que alta, razao 1,30) e arco de 85,5 passos. Largura em colunas: 218 na linha do topo, 149 no meio, 123 na base, contra as 512 do passo de 4 copias, ou seja 43% de duty no pior caso e preto de sobra entre elas. O caminho vem do mesmo KRAY_CROWN_ICON que ja gira no topo da torre da praca, entrando como Path2D: uma fonte de verdade so para a marca do parceiro. Ficam de pe a coroa de polo (linhas 0 a 120, 3,3% da area) e as duas cintas em 260-284 e 563-587; a pele nova encosta na cinta de cima com 10 linhas de folga.",
   "quando": "O mesmo intervalo comercial de 72 s, ganho 0,90, os 3 quadros com KRAY na linha grande. Nenhuma mudanca no livro-caixa nem no teto de propaganda.",
   "risco": "E a marca do parceiro em geometria propria, entao precisa do aval visual deles antes do ar: a coroa esticada por 1/cos(lat) e CORRETA na esfera e estranha no canvas, e quem abrir a textura vai jurar que esta errada. Acima de s 0,92 ela entra no escorco do polo, onde a peca ja mediu que forma vira mancha."
  }
 ]
}

## crivo

## BARALHO FINAL, na ordem de exibição

Dois ciclos alternados de 264 s (4 módulos de 48 s + intervalo de 72 s). Ninguém que fica 5 min vê a mesma sequência duas vezes, e a alternância de média fica resolvida por posição e não por sorte.

| # | ciclo A | média | ciclo B | média |
|---|---|---|---|---|
| P1 | MARCA-BTC (₿ laranja, já existe, corrigida) | **CLARA** 0,240 | idem | **CLARA** |
| P2 | PREÇO (faixa, chão #121212) | escura 0,014 | **O TIPO GIGANTE** (regressivo) | escura 0,04 |
| P3 | **A LUA CHEIA** | **CLARA** 0,258 | idem | **CLARA** |
| P4 | **O CENSO** (holders) | escura 0,022 | MARCA-DOG ($DOG, já existe) | escura 0,03 |
| P5 | INTERVALO KRAY | escura 0,03 (ganho 0,90) | idem | escura |

Fora do anel, por gatilho:
- **A CAUDA NO LARANJA**, média **CLARA**, eventos `doacao` e `mint`, quadro 2.
- **A ESFERA ENCHENDO**, média que sobe de escura para CLARA, só nos 144 blocos antes do 966.670, no lugar de P2 do ciclo B.
- **O CENSO / AFTER DARK**: mesma pele, ganho 0,50 e faixa com hora local, entre 02:00 e 05:59 do relógio do espectador.

Achado estrutural que muda o plano: só existem **duas** peles claras permanentes (₿ e LUA), e nenhuma das duas é dado. Por isso a alternância não pode ser módulo a módulo. A regra implementável é mais fraca e honesta: **nunca duas claras adjacentes, no máximo duas escuras seguidas**, e a única emenda escura-escura de cada ciclo é P4 colando no intervalo, aceita porque a Kray é branco cravado sobre preto (a silhueta muda mesmo com a média igual). Intervalo comercial fica em 72/264 = 27,27%, o de hoje; acrescentar um quinto módulo leva a 23,08%.

E a alternância não deve ser lista cravada. `pintarTextura` já calcula a média com `mediaDe` em linear por repintura: cada pele roda uma vez na carga contra um canvas de descarte, o programa guarda o número e recusa emendar duas do mesmo lado. Evento chega fora de ordem, então a CAUDA nasce com as duas versões (laranja pleno e casco escuro) e o motor escolhe pela média do quadro que está saindo.

## O QUE CAIU

**O SIMBOLO DE UMA FACE SO** e **A COROA DO PARCEIRO**: não são cartas, são a mesma infraestrutura, e ela é adotada inteira. Laranja pleno com um ₿ tem silhueta idêntica à `pintarCorpoBitcoin` que já está no ar (critério 3), e "N = 1" é o mesmo laço com outro parâmetro. O que sobrevive das duas é `peleMarca(g, w, h, { fundo, tinta, desenhar, n, s0, s1 })` com as **duas** compensações, e o defeito que elas apontaram é real: o ₿ de hoje sai **1,54x gordo** porque a compensação de altura não existe. Ver seção de adoções.

**A PLANTA NO POLO**: o conteúdo mora onde `sphere.ts` já mediu que letra e forma viram mancha por escorço, e a peça tem 401 m de altura num terreno de praça, ou seja o polo raramente entra no enquadramento. Segundo motivo, mais duro: publica malha viária e célula de lote antes do snapshot, exatamente o que `LOT_SEGMENTATION` foi apagada para não fazer.

**UMA LUZ POR UNIDADE** e **THE EPOCH**: cortadas por silhueta repetida contra O CENSO. A célula de 28,3 m tem rego de 3 texels (1,85 m), que some em 0,6 px a 3 km; passado isso as três peles são a mesma mancha escura salpicada de laranja. O EPOCH ainda leva um agravante próprio: a informação dele é a **posição** de uma fronteira de 0,507 m num anel de 3,9% da altura, publicada 26 vezes por ano em janelas de 1 h, ou seja 0,3% do tempo de peça. Escrever anel de progresso vale a pena uma vez, e o slot que paga por isso é A ESFERA ENCHENDO.

**WHALE**: colide com o parceiro, que é o pior lugar do baralho para colidir. Dois anéis cheios simétricos em seno em torno da faixa é literalmente a pele da Kray de hoje (260-284 e 563-587, mesmo `sin` de distância). E os degraus contáveis têm 4 linhas (2,46 m), que rendem 3,6 px a 1 km e nada a 3 km: a contagem, que é o valor inteiro da carta, morre antes da distância em que a peça é vista.

**AFTER DARK**: absorvida, não cortada. Retícula de 1 em 16 sobre casco escuro é a mesma silhueta do CENSO, então ela vira **estado** do CENSO (mesma pele, ganho 0,50, faixa com a hora local) em vez de pele própria. Resolve o risco declarado de média junto: a pele fica a 0,022 e nunca cai perto do piso de 0,01406.

**FIRST LOT**: dissolvida. Uma célula de 19,7 m é 4 px a 5 km, e a carta inteira é achar esse pixel. Dispara uma vez, sem ensaio, e depende de contador de servidor que ainda não existe. A gratícula (anéis a cada 32 linhas, meridianos a cada 32 colunas, sem compensação, para a peça ler como globo) fica anotada como pele do **dia do mint** com N células acesas, não como a peça do primeiro lote.

**O PRECO EM SATS**: desenho aprovado, fonte reprovada. Exige BTC/USD, que este arquivo não tem, e publicar produto de duas rotas em 401 m é a mesma classe do preço de teste que foi ao ar. Volta quando existir uma rota única que entregue sats por DOG com validade.

**A COR DA PRESSAO**: casca chapada é a única condição em que a peça arrisca ler como bola lisa em vez de tela, e o degrau 5 (#DB610D) fica a 0,03 de luminância da pele do ₿, ou seja é a marca do Bitcoin sem a marca. Sobra um uso legítimo e restrito: o tom da pressão como `faixaFundo` do slot pulso, que colore sem chapar a casca.

**THE HALVING**: bom desenho, prazo errado. Estreia em 579 dias, e o pedido é surpreender quem está olhando agora. Sete anéis paralelos também disputam a assinatura de anel do parceiro. O motor de "N anéis com espessura em progressão geométrica" custa 7 `fillRect` e pode ser escrito no dia, com prévia, sem ficar 1,5 ano parado no repositório.

**THE ETCH**: não é carta, é um **uso** do TIPO GIGANTE (um algarismo, escala grande, 20 de abril em UTC). Custo zero depois que a máquina existe, e resolve sozinho o risco de fonte que ela mesma levantou, porque a máquina já precisa da matriz 5x7 exportada.

## CORREÇÕES QUE O CRIVO IMPÕE ÀS CARTAS APROVADAS

**A elipse da Lua não pode ser desenhada pela aproximação `a/cos(lat)`.** Ela é de primeira ordem e engorda a mancha nas latitudes altas. Medido em Procellarum (ρ 42,36°, centro na linha 407), na linha 250: exata 443,7 texels, aproximada 526,5 texels, **erro de 18,7%**. É a mesma classe do ₿ gordo que o fundador pegou a olho. A forma exata é um `acos` por linha e custa nada. Ver pseudocódigo.

**O corte da casca é a linha 652,5, não 658,7.** `sphere-conteudo.ts:563` traz a conta contra `thetaMax` = 114,70°. A diferença de 6,2 linhas (3,8 m) não muda nada em quase tudo, mas na Lua ela decide: com 652,5, **Humorum some quase inteiro** (centro na 650,9) e **Nubium é cortado ao meio** (566 a 700). O sul da Lua não existe nesta casca, e não adianta desenhar.

**Metade da textura é o lado oculto.** Com lon 0 na coluna 1.536, a face visível ocupa as colunas 1.024 a 2.048 e a outra metade é o lado que ninguém conhece: planalto liso, sem mares. Isso é surpresa de produto de graça (quem gira a câmera 180° acha o outro lado da Lua), e é também o que puxa a média para cima.

**A Lua entra com ganho 0,62, não 0,78.** Medido: planalto #9A9488 tem Y linear 0,2989; com mares em ~14% da casca a média é **0,2575**, contra **0,2402** da pele marca-btc, ou seja 7% mais clara e **acromática**, que é o que produz a leitura de bola branca. O ajuste é no ganho e não na cor do planalto, porque planalto mais escuro deixa de ler como Lua.

**O TIPO GIGANTE precisa de memo por valor.** `trocaDePele` compara identidade de função (`(q.c.pintarCorpo ?? null) !== peleAtual`), e pele parametrizada por dado é closure novo a cada quadro, o que dispara a cortina de 700 ms a cada troca de valor. Um `Map<string, fn>` com a chave sendo o texto resolve.

**Altura aparente não é arco.** O regressivo "de 103,3 m" mede 103,3 m de arco e **98,1 m de projeção** (R vezes a diferença de senos). O número que vai para copy e para chapa é o de projeção.

## PSEUDOCÓDIGO

Comuns a todas: `L = h/1024`; `lat(v) = π/2 - π(v+0,5)/1024`; `R = 200,5`; 1 texel no equador = 0,6151 m; corte da malha na linha 652,5.

### 1. A LUA CHEIA (P3, CLARA, ganho 0,62)

```
pintarCorpoLua(g, w, h):
  L = h/1024
  g.fillStyle = '#9A9488'; g.fillRect(0,0,w,h)     // planalto, os dois lados
  MARES = [ // nome, lat0°, lon0°, diametro em graus de arco
    ['PROCELLARUM', 18.37, -57.0, 84.72],   // 3 elipses sobrepostas, e oceano
    ['IMBRIUM',     32.80, -15.6, 37.79],
    ['FRIGORIS',    56.00,  +1.4, 47.63],
    ['SERENITATIS', 28.00, +17.5, 23.32],
    ['CRISIUM',     17.00, +59.1, 18.34],
    ['TRANQUILL',    8.50, +31.4, 28.82],
    ['FECUNDITAT',  -2.00, +51.3, 27.77],
    ['NECTARIS',   -15.20, +34.6, 10.98],
    ['NUBIUM',     -21.30, -16.6, 23.55],
  ]
  g.fillStyle = '#101010'                          // LED apagado, literal
  para cada mar:
    ρ  = rad(diam/2);  φ0 = rad(lat0)
    v0 = (90-lat0)/180*1024                        // linha do centro
    vTopo = max(0,     v0 - ρ*(1024/π))
    vBase = min(652.5, v0 + ρ*(1024/π))            // ⚠ corte, nao 1024
    para v de floor(vTopo) ate ceil(vBase):
      φ = lat(v)
      arg = (cos ρ - sin φ0 * sin φ) / (cos φ0 * cos φ)   // ⚠ EXATA
      se arg >  1: continua                        // linha fora do circulo
      se arg < -1: Δλ = π                          // circulo envolve o polo
      senao:       Δλ = acos(arg)
      meia = Δλ/(2π) * 2048                        // ja em texels de TEXTURA
      meia *= 1 + 0.06*sin(3.1*v) + 0.04*sin(7.7*v+1.3)   // costa, semente fixa
      cx = ((0.75 + lon0/360) mod 1) * 2048        // lon 0 na coluna 1536
      g.fillRect((cx-meia)*L, v*L, 2*meia*L, L)    // envolve na volta se sair
  // a cidade
  g.fillStyle = '#E8660D'
  g.fillRect(colunaDe(+31.4)*L - 3*L, 463*L - 3*L, 6*L, 6*L)  // em Tranquillitatis
```
`faixaFundo: 'rgba(6,6,6,0.70)'` (véu, não tarja: sob ele o #E8660D fica em 4,2:1 contra o planalto). Copy: `'$DOG'` / `'THE MOON'`. Compensação de largura: resolvida dentro do `acos`, que já devolve longitude e não arco, então não há divisão por `cos` em lugar nenhum. Cerca de 1.800 `fillRect`, contra os 800 blits que o ₿ já faz.

### 2. O TIPO GIGANTE (P2 do ciclo B, escura; e A CAUDA, invertida)

A compensação é dupla e as duas saem da mesma projeção: vista do lado, a altura aparente de um ponto é `R·sen φ` e a largura aparente de um arco é `R·cos φ·Δλ`. Logo linha por **seno constante**, largura por **1/cos φ**.

```
peleTipo(g, w, h, { texto, escala, fundo, tinta, n, s0, s1 }):
  g.fillStyle = fundo; g.fillRect(0,0,w,h)
  // REGRESSIVO: texto='744', s0=0.5338 (lat 32.26, linha 328.5),
  //             s1=0.0350 (lat  2.01, linha 501.0), n=3
  //   altura aparente = R*(s0-s1) = 200.5*0.4988 = 100.0 m
  //   coluna de glifo  = 100.0/7 = 14.29 m de arco = 23.23 texels
  //   grupo 3 digitos  = 17 colunas = 394.9 texels de arco = 69.4 graus
  //   3 copias, periodo 682.7; na linha do topo (cos 0.8459) o grupo pede
  //   466.8 texels de textura, folga 215.9. Entra na janela legivel a ~420 m.
  // CAUDA: texto=fmtCauda(addr), 6 casas, fundo #E8660D, tinta #140B04,
  //   s0=0.4050 s1=0.1640 (altura aparente 48.3 m), n=3, ganho 0.62
  K = 7 * escala                                   // fatias verticais do glifo
  off = canvas( ceil(colsGlifo*passoTexel*L*2), ceil(K*L) )   // 2x supersample
  desenhaMatriz5x7(off, texto, tinta)              // aspecto VERDADEIRO
  para i de 0 a n-1:
    cx = ((i+0.5)/n) * w
    para k de 0 a K-1:
      s   = s0 - (k+0.5)/K * (s0-s1)               // ⚠ ALTURA por SENO
      φ   = asin(s)
      v   = (90 - deg(φ))/180 * 1024               // linha de textura da fatia
      vN  = (90 - deg(asin(s0-(k+1)/K*(s0-s1))))/180*1024
      larg = (arcoTotalTexels / max(cos φ, 0.05)) * L   // ⚠ LARGURA por 1/cos
      dy = round(v*L); dh = max(1, round(vN*L) - dy)
      g.drawImage(off, 0, k*off.height/K, off.width, off.height/K,
                       round(cx-larg/2), dy, round(larg), dh)
```
`faixaFundo: null`, `grande: ''`, `pequena: ''`. Nunca `' '`: `repetirNaVolta` com um espaço tem `length` 1 e desenha `'· ·'` na casca. Trava dura: acima de 999 blocos o grupo passa da janela e o quadro **não entra**, porque regressivo cortado na frente publica `44` onde faltam `744`. Memoizar por valor num `Map<string,fn>`, senão a cortina de 700 ms dispara a cada troca de dígito.

### 3. O CENSO (P4 do ciclo A, escura, ganho 0,50)

```
// montado UMA vez fora do caminho critico; chave de cache = contagem
montarCenso(holders):
  off = canvas(2048, 1024); og = off.getContext('2d')
  og.fillStyle = '#0A0A0A'; og.fillRect(0,0,2048,1024)
  rnd = mulberry32(0xD06DA7A)                      // semente fixa: nada cintila
  S0 = sin(rad(-24.70)) = -0.4179                  // ⚠ corte da malha (652.5)
  para cada carteira:
    s = S0 + rnd()*(1 - S0)                        // ⚠ AMOSTRA POR AREA
    v = (90 - deg(asin(s)))/180 * 1024             // mediana cai na linha 415.8,
    u = floor(rnd()*2048)                          //   ou seja no centro optico
    lado = saldo > 1e9 ? 9 : saldo > 1e6 ? 3 : 1   // 5.5 m / 1.85 m / 0.62 m
    og.fillStyle = jaGastou ? '#E8660D' : '#C6BFB1'  // 6.035 diamond paws
    og.fillRect(u - lado/2, floor(v) - lado/2, lado, lado)
  retorna off
pintarCorpoCenso(g,w,h): g.drawImage(cache, 0, 0, w, h)   // 1 drawImage, ~1,5 ms
```
Densidade real: 86.000 pontos sobre 1.336.320 texels acima do corte = **6,44%**, um a cada 15,5. Sem compensação de largura, e aqui isso é definição e não descuido: a amostragem por área já é a distribuição correta na casca, e ponto de 1 texel não tem forma para distorcer. Faixa: `grande` = contagem vinda de rota com validade (nunca constante), `pequena` = `'HOLDERS'`. Estado noturno: mesma pele, ganho 0,50, `grande` = hora local em 5 casas (o `:` existe na `FONTE`), `pequena` = `'AFTER DARK'`, exatos 10 caracteres do teto.

### 4. A ESFERA ENCHENDO (substitui P2 do ciclo B nos 144 blocos finais)

O nível é área de **silhueta**, não latitude proporcional. `F(y) = y√(1-y²) + asin(y)`, casca de `y0 = -0,4179` a `1`, área total `F(1) - F(y0) = 1,5708 - (-0,8107) = 2,3815`.

```
pintarCorpoNivel(g, w, h, p):        // p = fracao ja cheia, 0..1
  alvo = -0.8107 + p*2.3815
  t = resolve F(t) = alvo por bissecao em [-0.4179, 1]   // ~20 passos
  vN = (90 - deg(asin(t)))/180 * 1024
  g.fillStyle = '#0A0A0A'; g.fillRect(0, 0, w, vN*L)
  g.fillStyle = '#E8660D'; g.fillRect(0, vN*L, w, h - vN*L)
  g.fillStyle = '#C6BFB1'; g.fillRect(0, vN*L, w, 3*L)   // menisco, 1.85 m
```
Níveis medidos com o corte 652,5: **p 25% na linha 547,1; p 50% na 449,4 e não no equador, que é a armadilha; p 75% na 337,2; p 90% na 239,8**. A faixa é degrau do medidor e não obstáculo: abaixo de **p 38,1%** o nível está sob a linha 496 e a faixa fica normal; entre 38,1% e **68,7%** ela acende inteira (`faixaFundo: '#E8660D'`, `cor: '#140B04'`, o mesmo par invertido do ₿); acima disso o preenchimento passa por cima. Sem compensação de largura, e nenhuma é necessária: paralelo de latitude não distorce. Janela de 144 blocos, cerca de 4 linhas por bloco, 2,5 m de casca por bloco, degrau visível que some antes de virar animação. Repinta no evento de bloco que o feed já entrega, custo de rede zero. Copy: blocos restantes / `'TO GO'`.

## AS DUAS ADOÇÕES DE INFRAESTRUTURA

1. **`peleMarca()` com as duas compensações**, extraída de `pintarCorpoBitcoin` (`sphere-conteudo.ts:663`). O laço de blit por linha já está certo na largura; o que falta é a distribuição por seno. Com ela o ₿ de hoje deixa de sair 1,54x gordo, e o próximo parceiro entra por parâmetro sem ninguém tocar em trigonometria. A coroa da Kray é o primeiro cliente (`n=4`, `s0=+0,92`, `s1=+0,72`, `Path2D` vindo do mesmo `KRAY_CROWN_ICON` que já gira no topo da torre), mas ela é entrega de parceiro e precisa de aval visual antes do ar, porque a coroa esticada por `1/cos φ` é correta na esfera e parece errada quando se abre a textura.

2. **`pintarCorpoDog` também está sem compensação de altura.** O comentário do arquivo diz que um escalar único basta porque a letra tem 90 linhas e o erro residual é 4,6%. Isso vale para a largura. A altura aparente da letra na linha 235 (lat 48,68°) é `R·Δsen` = 200,5·(sen 52,63 - sen 44,74) = 200,5·(0,7946 - 0,7038) = **18,2 m**, e não os 55,4 m de arco que a doutrina do baralho vem repetindo. O `$DOG` da casa é três vezes menor do que se supõe. Não é urgente, mas o número está errado em toda conversa sobre a peça.

Arquivos lidos: `/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/app/city/plaza/sphere-conteudo.ts` (peles em 542, 663, 739; slots em 782-840; `trocaDePele` em 1206) e `/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/app/city/plaza/sphere.ts` (`SphereConteudo` em 777, `GLIFOS`/`FONTE` em 652-720, `SPHERE_FAIXA_LINHA0/1` em 473, `pintarTextura` em 1762).