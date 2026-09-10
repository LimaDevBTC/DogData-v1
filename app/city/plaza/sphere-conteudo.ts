// ═══════════════════════════════════════════════════════════════════════════
// O CONTEÚDO VIVO DA SPHERE
//
// A peça (`sphere.ts`) nasceu pronta e vazia: ela sabe desenhar LED, faixa de
// texto e escalonar por perfil, e expõe uma porta só, `pintar(SphereConteudo)`.
// Este arquivo é o que entra por essa porta.
//
// A grade é a que o fundador fechou em 07/09: PREÇO, VOLUME, PULSO e SNAPSHOT
// em ciclo; três eventos que interrompem o ciclo (transação para a carteira da
// cidade, bloco de Bitcoin minerado com o DOG que entrou nele, mint de terreno);
// e um intervalo comercial, por enquanto de um parceiro só, a Kray.
//
// ⚠️ CUSTO DE REDE ADICIONAL DO PULSO E DO SNAPSHOT: ZERO. Os dois vêm do
// MESMO `startFeed` que a /city já consome a cada 6 s (`feed.ts`), pelos
// mesmos `onSnapshot`/`onEnter`/`onLand` que a órbita já usa. Uma segunda
// assinatura do `/api/mempool/dog` é exatamente o defeito que a landing pagou em
// 27/08 (duas enquetes de 20 s no mesmo endpoint) e que o incidente de IO de
// 26/08 tornou inaceitável. O mesmo vale para o EVENTO DE DOAÇÃO: ele sai do
// feed, com os helpers `isDonation`/`donationDog` que já existem, e NÃO da rota
// `/api/donate/leaderboard`, que faz uma varredura de 5.000 linhas em
// `dog_transactions` com disjuntor de 8 s. Aquela rota é o portão de carga da
// landing, não um relógio de parede.
//
// ⚠️ CUSTO DE REDE DO PREÇO E DO VOLUME: 2 buscas por CICLO de 264 s, ou seja
// 0,45 requisição por minuto, e as duas SOB DEMANDA (8 s antes do módulo
// entrar). Para comparar, o feed da órbita faz 10 por minuto. As duas rotas têm
// cache de servidor (30 s a de preço, 60 s a do ticker), então o que sai daqui
// morre no cache antes de chegar na Kraken.
//
// ⚠️ NADA TIQUETEIA. Doutrina da casa, escrita em `snapshot.tsx` e paga: o
// countdown do snapshot é EM BLOCOS, a estimativa de tempo é texto recalculado
// só quando a ponta da chain anda, e o quadro mais curto que este programa
// aceita é de 8 s (`QUADRO_MIN`). Um número que se mexe sozinho na tela é
// indistinguível de uma promessa.
//
// ⚠️ A PROPORÇÃO DADO/PROPAGANDA É GARANTIDA AQUI, NÃO EM POLÍTICA COMERCIAL.
// Ver `TETO_ANUNCIO` e `podeAnunciar()`: existe um livro-caixa de tempo de tela
// e o intervalo comercial é RECUSADO quando a fatia dele passaria do teto.
// Anúncio paga e dado não; sem teto no código essa pressão esvazia a
// diferenciação sozinha com o tempo.
// ═══════════════════════════════════════════════════════════════════════════
import type { SphereConteudo } from './sphere'
import { escreverGlifos } from './sphere'
import { isDonation, donationDog, type DogTx, type Snapshot } from './feed'
import { SNAPSHOT } from '../../dogcity/dogcity-data'

// ═══════════════════════════════════════════════════════════════════════════
// 1. O ORÇAMENTO DE ESCRITA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ ESTES DOIS NÚMEROS MANDAM EM TODA A COPY DESTE ARQUIVO, e eles são
 * medição, não gosto: com a esfera de **196 m**, `sphere.ts` mediu que o arco
 * legível de um azimute só é **90° a 315 m**, ou seja **8,0 das 32 casas grandes
 * e 16,0 das 64 pequenas**. O texto é distribuído em cópias inteiras na volta
 * (`floor(nChars/(len+1))`), e com 7 caracteres saem 4 cópias de 8 casas de
 * período: é aí que o orçamento fecha.
 *
 * ⚠️ E A DISTÂNCIA EM QUE ELE FECHA ANDOU DE 257 PARA 315 m COM A PEÇA MAIOR,
 * porque o arco legível depende de `d/R` e não de `d`. O orçamento em CARACTERES
 * não mudou; o que mudou foi de onde ele vale.
 *
 * ⚠️ E NEM MESMO A 315 m EXISTE GARANTIA GEOMÉTRICA. A regra "janela ≥ período"
 * do dossiê estava errada: para conter uma cópia inteira em QUALQUER azimute a
 * janela precisa de `período + comprimento` = 15 casas, e ela nunca passa de ~10.
 * Medido por azimute a 315 m: cópia inteira em **13%**, cortada na frente em
 * 44%, cortada atrás em 44%, e no pior azimute só 3,5 dos 7 caracteres. A
 * garantia real é TIPOGRÁFICA e mora em dois lugares: o separador `·` entre
 * cópias (`repetirNaVolta`, que faz um pedaço se anunciar pedaço) e o zero da
 * frente do preço (`fmtPreco`). A conta inteira está em `SPHERE_ORCAMENTO_*`.
 *
 * Consequência de projeto, e ela é dura: **preço cabe, frase não cabe**. É por
 * isso que este arquivo escreve em QUADROS (valor + rótulo, um de cada vez) em
 * vez de escrever sentenças. Um módulo de dado não é uma frase quebrada em
 * pedaços; é uma sequência de leituras, cada uma completa em si.
 */
export const ORC_GRANDE = 7
export const ORC_PEQUENA = 10

/**
 * ⚠️ O TETO CAIU DE 15 PARA 10 EM 08/09, E QUATRO RÓTULOS JÁ IAM AO AR CORTADOS.
 * O docstring anterior afirmava que o maior tinha "15 caracteres exatos", e era
 * falso: `marcaBtc` tinha 27, `marcaBtcAlt` e `marcaDogAlt` 20, `marcaDog` 19. A
 * esfera publicava `THE CHAIN THAT `, `BITCOIN BLOCK H`, `THE RUNE ON BIT` e
 * `MARE TRANQUILLI`, porque `quadro()` faz `slice()` em silêncio.
 *
 * ⚠️ E O TETO NÃO É DE ESPAÇO, É DE LEITURA. Medido, fração de azimutes que veem
 * o rótulo INTEIRO, com a janela da linha pequena (9,44 casas a 315 m, 14,11 a
 * 500, 17,78 a 1 km, 20,71 na saturação):
 *
 *     L=5   28%  57%  80%  98%
 *     L=7   15%  44%  67%  86%
 *     L=9    3%  40%  69%  91%
 *     L=10   0%  32%  61%  84%
 *     L=12   0%  13%  36%  54%
 *     L=15   0%   0%  17%  36%
 *
 * A 315 m um rótulo de 15 é lido por NINGUÉM, em azimute nenhum. Curto não é
 * economia, é o que faz a mensagem existir.
 *
 * ⚠️ `orcamentoViolado()` EXISTIA SEM UM ÚNICO CHAMADOR. Ele é chamado agora, e
 * em desenvolvimento ele grita: um rótulo longo demais é defeito de produto numa
 * peça que vende anúncio, não detalhe de acabamento.
 */
export const ROTULOS = {
  marcaDog: 'BTC RUNE',           // 8
  marcaDogAlt: 'ON LUNA',         // 7
  precoSpot: 'USD SPOT',          // 8
  precoVar: '24H',                // 3
  volume: '24H VOL',              // 7
  alta: '24H HIGH',               // 8
  baixa: '24H LOW',               // 7
  pendentes: 'MEMPOOL',           // 7
  emVoo: 'IN FLIGHT',             // 9
  taxa: 'SATS/VB',                // 7
  blocosFaltam: 'TO GO',          // 5
  blocoAlvo: 'TARGET',            // 6
  estimativa: 'ESTIMATE',         // 8
  snapshotFeito: 'SNAPSHOT',      // 8
  blocosDesde: 'SINCE',           // 5
  doacao: 'DONATED',              // 7
  doadorDe: 'FROM',               // 4
  doacaoOk: 'CONFIRMED',          // 9
  bloco: 'BTC BLOCK',             // 9
  blocoTx: 'DOG TX',              // 6
  blocoVol: 'DOG MOVED',          // 9
  mintLotes: 'MINTED',            // 6
  mintDono: 'NEW OWNER',          // 9
  ocioso: 'SPHERE',               // 6
} as const

/** Quem estourou o orçamento. Vazio é o esperado. */
export function orcamentoViolado(): string[] {
  return Object.entries(ROTULOS)
    .filter(([, v]) => v.length > ORC_PEQUENA)
    .map(([k, v]) => `${k}=${v.length}`)
}

// ⚠️ ELE PASSA A TER CHAMADOR, e essa é a metade que faltava. A função existia
// desde o começo e NUNCA foi chamada por ninguém: enquanto isso, quatro rótulos
// de marca foram ao ar cortados por meses. Regra que não roda não é regra, é
// comentário. Aqui ele grita em desenvolvimento, no carregamento do módulo, que
// é quando o autor do rótulo ainda está com o arquivo aberto.
if (process.env.NODE_ENV !== 'production') {
  const maus = orcamentoViolado()
  if (maus.length) {
    console.error(
      `[sphere] ${maus.length} rótulo(s) acima de ORC_PEQUENA=${ORC_PEQUENA} e serão CORTADOS `
      + `em silêncio no ar: ${maus.join(', ')}`,
    )
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. A PALETA E O GANHO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ `#E8660D`, e nunca o lava `#F56E0F` nem neon. Regra da casa
 * (`project_chart_palette`), repetida no dossiê da peça.
 *
 * ⚠️ VERDE É SÓ STATUS, NUNCA VALOR, E VERMELHO NÃO ENTRA. Nada de vermelho e
 * verde para preço subindo ou descendo: é estética de corretora e o projeto
 * inteiro evita esse registro. Aqui a direção se comunica por DUAS coisas que
 * não são cor de semáforo:
 *
 *   1. **peso**: alta acende em ganho 0,50 e queda em 0,38, uma razão medida de
 *      **1,32x**. Para comparar, o intervalo comercial acende em 0,90, que é
 *      **2,14x** o ocioso. Ou seja a diferença entre subir e cair é um sexto da
 *      diferença entre dado e anúncio: lê como ênfase, não como alarme.
 *   2. **temperatura**: a queda DESBOTA o laranja na direção do creme do
 *      rótulo (35% de mistura, medido abaixo), em vez de trocar de matiz. A cor
 *      continua sendo a mesma cor; ela só fica menos comprometida.
 *
 * ⚠️ ROXO É BANIDO, e isso vale inclusive contra a marca do parceiro: a Kray
 * tem `#7C3AED` no cartão dela em `city-3d.tsx`, mas a presença dela NESTA
 * cidade (o dirigível em `kray-blimp.ts` e a torre da praça) é casco preto com
 * marca branca. O intervalo comercial usa a presença, não o cartão.
 */
export const COR_DADO = '#E8660D'
export const COR_ROTULO = '#C6BFB1'

/**
 * O laranja do dado desbotado 35% na direção do creme do rótulo. Calculado, não
 * escolhido a olho: 0,65·(232,102,13) + 0,35·(198,191,177) = (220,133,70) =
 * **`#DC8546`**. Mesma família, um passo menos saturado.
 */
export const COR_DADO_FRACO = misturarHex(COR_DADO, COR_ROTULO, 0.35)

/** branco de painel, só para o intervalo comercial */
export const COR_ANUNCIO = '#F2F4F7'

/**
 * ⚠️ O LARANJA DO BITCOIN É O DA MARCA DELE, `#F7931A`, E ISSO É EXCEÇÃO PEDIDA
 * PELO FUNDADOR EM 09/09: *"a esfera com o logo do Bitcoin deve usar exatamente o
 * tom de laranja que tá na logo"*. Medido no próprio `public/BTC.png` que ele
 * mandou, e não copiado de memória: 70.251 das amostras opacas do disco são
 * exatamente `#F7931A`, contra 22 do segundo colocado.
 *
 * ⚠️ E ELE NÃO SUBSTITUI `COR_DADO`. A casa continua em `#E8660D` para tudo o que
 * é dado, e a regra contra o lava `#F56E0F` continua de pé: `#F7931A` é a
 * identidade de OUTRA marca dentro da peça, exatamente como o preto e branco da
 * Kray. Quem usar este laranja para publicar número da casa está trocando a
 * paleta da casa pela de terceiro. Ele vale na pele do Bitcoin e em mais nada.
 */
export const COR_BITCOIN = '#F7931A'

/**
 * O BULLET DA MARCA CORRIDA, `●` de 5x5 LEDs (o separador padrão da casa é o `·`
 * de 2x2, que é ponto de pedaço e não de marca).
 *
 * ⚠️ ELE SÓ VALE ONDE A LINHA É MARCA, e nunca num módulo de dado: sobre um preço
 * ele viraria um caractere gordo disputando com o número, que é o oposto do que o
 * `·` faz. Ver `SphereConteudo.sep`.
 */
export const SEP_MARCA = '●'

/**
 * ⚠️ O GANHO É O QUE SEPARA MARCO DE CIDADE DE BOLA DE DISCOTECA.
 *
 * `uGanho` multiplica linearmente o conteúdo emissivo no shader
 * (`cor = painel·(luz) + conteudo·sinal·uGanho`), então estes números são razões
 * de brilho de verdade:
 *
 *     ocioso   0,42   o estado normal da peça, e ele é sóbrio de propósito
 *     queda    0,38   0,90x do ocioso
 *     alta     0,50   1,19x do ocioso, 1,32x da queda
 *     evento   0,62   1,48x: um evento levanta a voz, não grita
 *     anúncio  0,90   2,14x: a ÚNICA coisa que sobe de saturação
 */
/**
 * ⚠️ 0,50 DESDE 08/09, E O TETO É 0,511. Ver a nota de `uGanho` em sphere.ts: o
 * limite não é estético nem de contraste, é o CLIPPING do canal vermelho dentro
 * do disco do LED com `uVida` no pico. Em 0,50 o contraste efetivo do dado sobe
 * 12% e o vale da respiração sai de 2,59x para 2,88x, ou seja o texto ao sol
 * deixa de cair abaixo de 3:1 no fundo da respiração. NÃO passar de 0,51.
 */
export const GANHO_OCIOSO = 0.50
export const GANHO_QUEDA = 0.38
export const GANHO_ALTA = 0.50
export const GANHO_EVENTO = 0.62
export const GANHO_ANUNCIO = 0.90

/** mistura dois hex em espaço sRGB (é para tela de LED, não para física) */
function misturarHex(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [ar, ag, ab] = p(a)
  const [br, bg, bb] = p(b)
  const m = (x: number, y: number) => Math.round(x * (1 - t) + y * t)
  return '#' + [m(ar, br), m(ag, bg), m(ab, bb)]
    .map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. O RITMO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ O PISO DE 8 s POR QUADRO É CUSTO MEDIDO, NÃO CAUTELA.
 *
 * `pintar()` repinta um canvas de 2.048 x 1.024 e reenvia 8 MB para a GPU.
 * Medido fora do navegador com `npx tsx` (a parte de JavaScript, que é a que dá
 * para medir offline):
 *
 *     cópia de 8 MB, que é o que `getImageData` faz     3,03 ms
 *     laço de média sobre a esfera inteira              0,85 ms
 *     laço de média sobre a faixa (120 de 1.024 linhas) 0,10 ms
 *     ~3.360 `fillRect` de texto, no pior caso          resto
 *
 * ou seja da ordem de **7 ms de thread principal por repaint**, mais o envio de
 * textura. A 60 Hz isso é quase metade de um quadro. Com o piso de 8 s o custo
 * amortizado cai para **0,09% da thread**, e o ciclo nominal deste programa
 * usa 14 repaints em 264 s, ou **1 a cada 18,9 s**, que é ainda mais folgado.
 *
 * É também por isso que a transição é um DISSOLVE (ver `MS_SAI`/`MS_ENTRA`): a
 * troca de textura acontece no fundo do vale de brilho, onde o engasgo de 7 ms
 * é o mais difícil de perceber.
 */
export const QUADRO_MIN = 8_000

/**
 * ⚠️ O RITMO PROPOSTO PELO ESTUDO ERA 45 a 60 s por módulo de dado, 3 a 4
 * módulos por ciclo e 60 a 90 s de intervalo. Estes números ficam dentro dele e
 * foram escolhidos para dar quadros INTEIROS acima do piso: 48 s divididos em 3
 * quadros dão 16 s cada, e em 2 quadros dão 24 s. Nenhum quadro deste programa
 * fica abaixo de 16 s, que é o dobro do piso.
 */
export const MS_MODULO = 48_000
export const MS_ANUNCIO = 72_000
/**
 * Quanto de CADA carta com marca a grade miúda ocupa: a Kray tira dos 72 s
 * comprados, o ₿ e o `$DOG` tiram dos 48 s do módulo.
 *
 * ⚠️ UM TERÇO, E NÃO METADE. A grade é o efeito de perto; a marca grande é o que
 * se lê de longe, e é ela que carrega a identidade a 5 km. Metade do tempo em
 * grade trocaria a leitura da cidade inteira por um efeito de aproximação.
 */
export const MS_GRADE_MIUDA = 16_000
/** @deprecated use `MS_GRADE_MIUDA` */
export const MS_KRAY_MIUDO = MS_GRADE_MIUDA
export const MS_EVENTO_QUADRO = 8_000

/** o dissolve. Ver `QUADRO_MIN`: a troca de textura mora no fundo do vale. */
export const MS_SAI = 400
export const MS_ENTRA = 500
/** o ganho no fundo do vale; não é zero para a esfera não piscar de apagada */
const GANHO_VALE = 0.04

/** de quanto em quanto o programa acorda para decidir. Não é um relógio de tela. */
const MS_TICK = 250

/** quanto antes da vez do módulo a busca sai; um ciclo à frente seria dado velho */
const MS_PREFETCH = 8_000

// ═══════════════════════════════════════════════════════════════════════════
// 4. O TETO DURO DE PROPAGANDA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ O TETO É CÓDIGO, E ESTA É A RAZÃO ESCRITA NO DOSSIÊ: anúncio paga e dado
 * não, e essa pressão esvazia a diferenciação sozinha com o tempo. Quem vende o
 * intervalo não pode ser quem decide o tamanho dele.
 *
 * O ciclo NOMINAL já nasce abaixo do teto:
 *
 *     4 módulos de dado x 48 s = 192 s
 *     1 intervalo comercial    =  72 s
 *     ciclo                    = 264 s     fatia de anúncio = 72/264 = **27,27%**
 *
 * E os eventos só empurram a fatia para BAIXO, porque evento é dado: com um
 * bloco de Bitcoin a cada ~10 min e 24 s de anúncio de bloco, o ciclo médio vira
 * 274,6 s e a fatia cai para **26,22%**.
 *
 * Então por que o livro-caixa existe, se a conta já fecha? Porque a conta fecha
 * HOJE. `podeAnunciar()` é o que impede que ela deixe de fechar no dia em que
 * alguém encurtar um módulo, acrescentar um segundo parceiro ou "só desta vez"
 * dobrar o intervalo: o programa RECUSA o slot comercial e roda dado no lugar.
 * O teto não é uma promessa sobre o futuro, é uma trava.
 */
export const TETO_ANUNCIO = 0.30

/** A fatia nominal de propaganda, para conferir offline que o projeto cabe. */
export function fracaoNominalAnuncio(nModulos = 4): number {
  return MS_ANUNCIO / (nModulos * MS_MODULO + MS_ANUNCIO)
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. VALIDADE DO DADO, E O QUE FAZER QUANDO A REDE FALHA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ UMA PEÇA DE 196 m MOSTRANDO DADO ERRADO COM CONFIANÇA É PIOR DO QUE UMA
 * MOSTRANDO QUE NÃO SABE. Não existe, nesta faixa de texto, espaço para um
 * carimbo de idade honesto: sete caracteres não comportam "há 4 min" ao lado do
 * número, e um número velho sem carimbo é uma mentira. Então a regra aqui é
 * **omitir, nunca envelhecer**:
 *
 *   · dado dentro da validade  →  o módulo entra normalmente
 *   · dado fora da validade    →  o módulo é PULADO, sem lápide e sem aviso
 *   · nenhum módulo válido     →  estado NEUTRO (`quadroOcioso`), que não diz
 *                                 número nenhum, só a identidade da peça
 *
 * As validades não são todas iguais porque as grandezas não envelhecem no mesmo
 * ritmo, e isso é medível:
 *
 *   PREÇO      5 min   a rota tem cache de 30 s; 10 caches de atraso é o limite
 *                      do que ainda é "o preço de agora" para quem olha um
 *                      telão de longe
 *   VOLUME    15 min   volume de 24 h se move devagar por construção: 15 min são
 *                      1,04% da janela que ele mede
 *   PULSO      2 min   a mempool troca de estado em segundos; 2 min são 20
 *                      giros do feed, e um pulso de 2 min é ficção
 *   SNAPSHOT  30 min   `tip_height` só muda a cada ~10 min. Uma ponta de 30 min
 *                      erra em ~3 blocos numa contagem de centenas, e continua
 *                      sendo a leitura certa da ordem de grandeza. É o único
 *                      módulo que sobrevive a uma queda longa do watcher, e
 *                      sobrevive PORQUE a grandeza dele é lenta.
 */
export const VALIDADE_PRECO = 300_000
export const VALIDADE_VOLUME = 900_000
export const VALIDADE_PULSO = 120_000
export const VALIDADE_SNAPSHOT = 1_800_000

/** timeout de busca: uma rota pendurada não pode empilhar requisição */
const MS_FETCH = 6_000
/** intervalo mínimo entre tentativas na mesma fonte depois de uma falha */
const MS_RETENTA = 20_000

// ═══════════════════════════════════════════════════════════════════════════
// 6. OS FORMATOS, TODOS LIMITADOS POR CONSTRUÇÃO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ O PREÇO DO DOG NÃO CABE EM 7 CASAS SEM UMA DECISÃO, e a decisão MUDOU em
 * 07/09, contra medição. A regra antiga era "a maior precisão que couber",
 * sacrificando sempre o zero da frente; ela dava, para o preço real de hoje
 * (**0,001126**):
 *
 *     `.001126`   4 algarismos, granularidade **0,089%**   ← o que a regra antiga fazia
 *     `0.00113`   3 algarismos, granularidade **0,888%**   ← o que esta faz
 *
 * ⚠️ E O ZERO DA FRENTE NÃO É ENFEITE, É PROTEÇÃO DO PONTO DECIMAL. Medido em
 * `sphere.ts`: uma cópia INTEIRA do texto só se vê de 13% dos azimutes; de 44%
 * deles o leitor pega a cópia cortada NA FRENTE. E aí:
 *
 *     `.001126`  sem o primeiro caractere lê `001126`  → erro de 10⁶
 *     `0.00113`  sem o primeiro caractere lê `.00113`  → CERTO
 *     `0.00113`  sem o último caractere   lê `0.0011`  → erro de 2,3%
 *
 * O zero é um caractere de sacrifício: ele é o que sobra na mão de quem cortou.
 * Num telão de 196 m, um preço que pode ser lido como um número mil vezes maior
 * é pior do que um preço com um algarismo a menos.
 *
 * ⚠️ MAS ELE SÓ VALE ENQUANTO NÃO CONGELAR O PAINEL, e é isso que `GRAN_MAX`
 * mede. Quando o DOG valia 0,00042 o formato com zero dava `0.00042`, ou seja
 * granularidade de **2,4%**: o preço teria de andar 2,4% para o painel mudar de
 * dígito, e um telão com número congelado é o defeito oposto. Então a regra é:
 * **mantém o zero enquanto a granularidade couber em 1%; acima disso sacrifica o
 * zero para comprar um algarismo.** Com 0,001126 o zero fica (0,89% ≤ 1%); com
 * 0,00042 ele cai e volta o `.000421` de antes. A regra decide sozinha nas duas
 * pontas, em vez de alguém ter de escolher de novo a cada ordem de grandeza.
 */
const GRAN_MAX = 0.01

export function fmtPreco(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return ''
  let comZero: { s: string; d: number } | null = null
  let semZero: { s: string; d: number } | null = null
  for (let d = 8; d >= 0; d--) {
    const s = v.toFixed(d)
    if (!comZero && s.length <= ORC_GRANDE) comZero = { s, d }
    if (!semZero && s.startsWith('0.') && s.length - 1 <= ORC_GRANDE) {
      semZero = { s: s.slice(1), d }
    }
    if (comZero && semZero) break
  }
  // a granularidade é o passo do último dígito sobre o valor: o quanto o preço
  // precisa andar para o painel mudar de algarismo.
  const gran = (x: { d: number } | null) => (x ? 10 ** -x.d / v : Infinity)
  if (comZero && gran(comZero) <= GRAN_MAX) return aparar(comZero.s)
  if (semZero) return aparar(semZero.s)
  if (comZero) return aparar(comZero.s)
  return v.toPrecision(2)
}

/**
 * Tira zero à direita de decimal.
 *
 * ⚠️ NUM PAINEL DE LED ZERO À DIREITA NÃO É PRECISÃO, É RUÍDO. `.000400` ocupa
 * as sete casas inteiras para dizer o que `.0004` diz em quatro, e as três casas
 * que sobram são exatamente o que falta quando o preço andar para `.000421`.
 */
function aparar(s: string): string {
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s
}

/**
 * Quantidade de DOG em 7 casas: `418.2M`, `1.234B`, `12.4K`. O sufixo é a única
 * abreviação aceita porque ele é universal em painel; nada de "MM" nem de
 * unidade inventada.
 */
export function fmtDog(v: number): string {
  if (!Number.isFinite(v)) return ''
  const abs = Math.abs(v)
  // ⚠️ QUATRO ALGARISMOS SIGNIFICATIVOS, NÃO "O MÁXIMO QUE COUBER". A primeira
  // versão pegava as casas de cima para baixo e escrevia `418.20M` e `7.000`,
  // gastando casa com zero que não informa nada. O painel tem sete casas; quem
  // usa duas com zero está jogando fora um quarto da linha.
  const escala = (div: number, suf: string) => {
    const x = v / div
    const inteiras = Math.max(1, Math.floor(Math.log10(Math.abs(x) || 1)) + 1)
    for (let d = Math.max(0, 4 - inteiras); d >= 0; d--) {
      const s = aparar(x.toFixed(d)) + suf
      if (s.length <= ORC_GRANDE) return s
    }
    return Math.round(x) + suf
  }
  if (abs >= 1e9) return escala(1e9, 'B')
  if (abs >= 1e6) return escala(1e6, 'M')
  if (abs >= 1e3) return escala(1e3, 'K')
  return escala(1, '')
}

/**
 * Variação em porcentagem, com o sinal carregando a direção. A precisão cai com
 * a magnitude para caber: `+3.24%`, `+34.2%`, `+345%`.
 *
 * ⚠️ O SINAL É A DIREÇÃO, A COR NÃO É. Ver a nota da paleta: aqui não existe
 * verde de alta nem vermelho de queda.
 */
export function fmtPct(v: number): string {
  if (!Number.isFinite(v)) return ''
  const a = Math.abs(v)
  const casas = a < 10 ? 2 : a < 100 ? 1 : 0
  const s = (v >= 0 ? '+' : '-') + a.toFixed(casas) + '%'
  return s.length <= ORC_GRANDE ? s : (v >= 0 ? '+' : '-') + Math.round(a) + '%'
}

/**
 * A cauda de um endereço, em caixa alta.
 *
 * ⚠️ CAIXA ALTA NÃO DISTORCE UM BECH32. O endereço `bc1p...` tem forma canônica
 * em caixa alta definida no BIP-173 justamente para painel e QR: `BC1P...` é o
 * mesmo endereço, não uma aproximação. E a CAUDA é a parte que a pessoa
 * reconhece, porque é ela que toda carteira mostra no truncado.
 */
export function fmtCauda(addr: string, n = 6): string {
  const s = (addr || '').trim().toUpperCase()
  return s.length <= n ? s : s.slice(-n)
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. OS QUADROS
// ═══════════════════════════════════════════════════════════════════════════

interface Quadro {
  c: SphereConteudo
  ms: number
}

type Classe = 'dado' | 'evento' | 'anuncio'

interface Slot {
  classe: Classe
  nome: string
  quadros: Quadro[]
  /** quanto tempo do slot ainda falta; só o intervalo comercial usa (ver fila) */
  restanteMs?: number
}

/**
 * ⚠️ `orc` É EXCEÇÃO DECLARADA AO ORÇAMENTO, E ELA TEM UM DONO SÓ: o intervalo
 * comercial. `ORC_GRANDE = 7` é um teto de LEITURA, medido em azimutes, e vale
 * para DADO, onde o que importa é o número chegar inteiro ao olho. Marca corrida
 * é outra coisa: `KRAY SPACE` são 10 caracteres pedidos pelo nome do parceiro, e
 * cortar em silêncio para `KRAY SP` publicaria o nome dele errado, que é pior do
 * que publicá-lo em menos azimutes. Quem usar isto para dado está burlando a
 * medição, não ganhando espaço.
 */
const quadro = (
  grande: string,
  pequena: string,
  ms: number,
  extra: Partial<SphereConteudo> = {},
  orc = ORC_GRANDE,
): Quadro => {
  const g = grande.slice(0, orc)
  return {
    ms,
    c: {
      grande: g,
      pequena: pequena.slice(0, ORC_PEQUENA),
      ganho: GANHO_OCIOSO,
      // ⚠️ O TIPO GIGANTE NAO ENTRA NO PADRAO, e a razao e do fundador: *"o dado
      // não precisa ficar gigante, ele só não pode apagar"*. O defeito era o
      // apagamento deliberado no shader (ver `pintarTextura` e a nota do
      // `textCull` em sphere.ts), não o tamanho da letra. `peleValor` fica no
      // arquivo como carta aprovada do baralho e fora da rotação.
      ...extra,
    },
  }
}

/**
 * ⚠️ O ESTADO NEUTRO, e ele não é uma tela de erro. Quando nenhuma fonte está
 * dentro da validade, a esfera continua sendo a esfera: diz o nome da cidade e
 * some com os números. Não escreve "OFFLINE", não escreve "—", não mostra o
 * último preço com uma marca de idade que não cabe. Uma peça que se vê de 5 km
 * anunciando a própria falha é pior do que uma peça calada.
 */
const quadroOcioso = (): Quadro => quadro('DOGCITY', ROTULOS.ocioso, MS_MODULO)

// ═══════════════════════════════════════════════════════════════════════════
// 8. O INTERVALO COMERCIAL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ A KRAY JÁ MORA NESTA CIDADE, e é isso que separa este slot de um outdoor.
 * Ela tem torre na Praça Satoshi (`/city/kray-tower.glb`, com o
 * `KRAY_CROWN_ICON` girando no topo) e dirigível sobrevoando
 * (`kray-blimp.ts`). A peça na Sphere fala COM essa presença: o último quadro
 * do intervalo aponta para onde a torre está, em vez de repetir a marca uma
 * terceira vez.
 *
 * ⚠️ E A IDENTIDADE USADA É A DA PRESENÇA, NÃO A DO CARTÃO. O cartão da Kray em
 * `city-3d.tsx` traz `#7C3AED`, e roxo é banido nesta casa. A Kray desta cidade
 * é casco preto com marca branca (é literalmente como `kray-blimp.ts` descreve
 * o dirigível: "deep-black glossy hull, crisp white Kray marks"), então o
 * intervalo é preto e branco em ganho alto. A regra da casa é respeitada e o
 * parceiro fica MAIS parecido consigo mesmo, não menos.
 */
function pintarCorpoKray(g: CanvasRenderingContext2D, w: number, h: number) {
  // ⚠️ A CAMPANHA É A MARCA E O NOME, E MAIS NADA. Pedido do fundador em 09/09:
  // *"a campanha kray tem elementos diferentes de ·KRAY·KRAY· e a logo da Kray.
  // Não precisa tower nem nada disso"*. O que estava aqui eram duas cintas
  // brancas de casco, que são gesto de peça e não de anunciante, e três quadros
  // que trocavam a linha grande. Agora o parceiro tem UMA imagem: casco preto,
  // marca branca repetida na volta, e o nome dele na faixa.
  //
  // ⚠️ E A MARCA É O ARQUIVO DELA, não um desenho meu. `public/wallets/kray.jpg`
  // já vive no repo, servindo o seletor de carteira: marca branca sobre preto, ou
  // seja a própria luminância é o alfa. `public/city/kray-marca.png` é ela
  // recortada na caixa do traço, com alfa suave para a borda não serrilhar ao ser
  // esticada pelas fatias de seno.
  // ⚠️ A LOGO DESCEU E CRESCEU EM 09/09. Fundador: *"a cena da kray estava com a
  // logo muito no alto... conseguimos usar mais área da logo, visto que toda a
  // lateral, desde a base até o topo é visível"*. Ela ocupava de seno 0,90 a
  // 0,46, ou seja 88 m de altura e 25,9% da área visível, inteira acima da faixa
  // de dado. Agora vai de 0,84 a 0,04: **160 m de altura**, o dobro, e o friso do
  // nome ocupa a faixa logo abaixo dela, em vez de disputar o meio da esfera.
  //
  // ⚠️ DUAS CÓPIAS, E O NÚMERO NÃO É DE COBERTURA, É DE ALINHAMENTO.
  //
  // Fundador, 10/09: *"a logo que está acima não tá centralizada sobre o 'Kray
  // Space', ela parece estar acima do 'K'"*. A causa é aritmética: a logo tinha
  // **3** cópias na volta e o nome `KRAY SPACE` cabe em **2** (10 caracteres em
  // 32 casas dão `floor(32/12)` = 2). Dois e três só coincidem em UM ponto da
  // volta; nos outros a marca passeia sobre o nome, e no pior deles ela cai
  // sobre a primeira letra.
  //
  // Com 2 as fases batem sozinhas, e a conta é a mesma que `repetirNaVolta` já
  // usa para casar rótulo com valor: o friso leva o meio da primeira cópia para
  // 0,75 da volta (`frac = 0,75 − 1/(2·rep)`), ou seja os nomes centram em 0,75 e
  // 0,25; `peleMarca` põe a cópia `i` em `(i + 0,5)/n`, que com n = 2 dá
  // exatamente 0,25 e 0,75. Zero de deriva, sem constante nova.
  //
  // ⚠️ E O PREÇO É COBERTURA, declarado: uma cópia de 160 m pede 48° de longitude
  // no equador, então duas somam 96° dos 360 em vez dos 246 de antes. Vai haver
  // azimute sem a marca à vista, o que não acontecia. É a troca que o pedido
  // pede: o parceiro prefere a marca em cima do nome dele a marca em todo lugar.
  const im = arte('/city/kray-marca.png')
  peleMarca(g, w, h, {
    fundo: '#07080A', tinta: COR_ANUNCIO, n: 2, s0: 0.84, s1: 0.04,
    aspecto: 1,
    desenhar: (og, larg, alt) => desenharArte(og, im, larg, alt),
  })
}

/**
 * A KRAY MIÚDA: a mesma marca, em grade, cobrindo a casca.
 *
 * Pedido do fundador em 10/09: *"consegue fazer ela dar uma piscada e aparecer
 * dezenas de logo da kray pequenas... mesma coisa, só que pequenas, vão caber
 * várias e pra quem tá mais perto vai dar um efeito legal"*.
 *
 * ⚠️ A PISCADA NÃO É EFEITO NOVO, É O VALE DO GANHO QUE JÁ EXISTE. `peleId`
 * governa isso (ver a nota dele em `sphere.ts`): duas peles da MESMA família
 * trocam no vale do ganho, e só a troca de família paga a cortina. Os dois
 * quadros da Kray dividem `peleId: 'anuncio'`, então a casca escurece e volta
 * com a grade, que é exatamente a piscada pedida. Um `peleId` novo aqui daria a
 * cortina inteira, que é gesto de troca de anunciante, não de quadro.
 *
 * ⚠️ O NÚMERO DE CÓPIAS VARIA COM A LATITUDE, e sem isso a grade não é grade.
 * Uma marca de largura fixa em METROS ocupa mais LONGITUDE quanto mais perto do
 * polo (`larg / (R·cos φ)`), então repetir 19 vezes em toda faixa faria as de
 * cima se comerem e as de baixo abrirem vão. Cada faixa recebe
 * `360 / (longitude da cópia × 1,55)`, com 1,55 de respiro, que é o que mantém o
 * espaçamento igual visto de fora. Medido, de 0,90 a −0,34 em 6 faixas de 41,4 m:
 * 11, 15, 18, 19, 19 e 19 cópias, ou seja **101 marcas na casca**.
 *
 * ⚠️ E A REGRA DE SIMETRIA DA CASA CONTINUA VALENDO por faixa, não entre faixas:
 * dentro de cada latitude as cópias são igualmente espaçadas
 * (`(i + 0,5)/n` em `peleMarca`), que é o que o fundador pede em elemento
 * repetido. Entre faixas o número muda porque a esfera manda.
 */
function gradeMiuda(
  g: CanvasRenderingContext2D, w: number, h: number,
  o: {
    fundo: string; tinta: string; aspecto: number
    s0: number; s1: number; faixas: number; respiro: number
    desenhar: (og: CanvasRenderingContext2D, larg: number, alt: number, cor: string) => void
  },
) {
  for (let i = 0; i < o.faixas; i++) {
    const s0 = o.s0 - ((o.s0 - o.s1) * i) / o.faixas
    const s1 = o.s0 - ((o.s0 - o.s1) * (i + 1)) / o.faixas
    const sm = (s0 + s1) / 2
    const alt = SPHERE_R_M * (s0 - s1)
    const lon = ((alt * o.aspecto) / (SPHERE_R_M * Math.max(Math.cos(Math.asin(sm)), 0.08)))
      * (180 / Math.PI)
    const n = Math.max(3, Math.floor(360 / (lon * o.respiro)))
    // ⚠️ AS FILEIRAS SÃO EMBARALHADAS, E NÃO É ENFEITE. Pedido do fundador em
    // 10/09: *"lembre de embaralhar as fileiras, não colocar uma logo exatamente
    // abaixo da outra"*. Sem isto, faixas vizinhas com o mesmo `n` (na Kray são
    // 19, 19 e 19 nas três de baixo) nascem na MESMA longitude e a grade lê como
    // colunas, que é o padrão que o olho pega primeiro e o que faz a casca
    // parecer papel de parede barato.
    //
    // ⚠️ E A FASE É A RAZÃO ÁUREA, NÃO MEIO PASSO ALTERNADO. Com 0, ½, 0, ½ as
    // faixas 1 e 3 voltam a alinhar entre si, que é o mesmo defeito uma linha
    // adiante. `(i · 0,618) mod 1` dá 0, 0,618, 0,236, 0,854, 0,472 e 0,090 nas
    // seis: nenhuma repete e nenhuma fica perto da outra.
    //
    // ⚠️ O ESPAÇAMENTO DENTRO DA FAIXA CONTINUA IGUAL, que é a regra de simetria
    // da casa para elemento repetido. O que se desloca é a fileira inteira.
    const fase = (i * 0.6180339887) % 1
    peleMarca(g, w, h, {
      // ⚠️ SÓ A PRIMEIRA FAIXA PINTA O FUNDO. As outras passam `null`, que é o
      // contrato de empilhamento do `peleMarca`: pintar de novo apagaria as
      // faixas já desenhadas.
      fundo: i === 0 ? o.fundo : null,
      tinta: o.tinta, n, s0, s1, aspecto: o.aspecto, fase,
      desenhar: o.desenhar,
    })
  }
}

function pintarCorpoKrayMiudo(g: CanvasRenderingContext2D, w: number, h: number) {
  const im = arte('/city/kray-marca.png')
  gradeMiuda(g, w, h, {
    fundo: '#07080A', tinta: COR_ANUNCIO, aspecto: 1,
    s0: 0.90, s1: -0.34, faixas: 6, respiro: 1.55,
    desenhar: (og, larg, altura) => desenharArte(og, im, larg, altura),
  })
}

/** O ₿ miúdo: 136 marcas brancas sobre o laranja da moeda. Mesma grade da Kray,
 *  e o aspecto do glifo oficial (474/629) faz caber mais por faixa. */
function pintarCorpoBitcoinMiudo(g: CanvasRenderingContext2D, w: number, h: number) {
  const im = arte('/city/btc-marca.png')
  gradeMiuda(g, w, h, {
    fundo: COR_BITCOIN, tinta: '#FFFFFF', aspecto: 474 / 629,
    s0: 0.90, s1: -0.34, faixas: 6, respiro: 1.55,
    desenhar: (og, larg, altura, cor) => desenharArte(og, im, larg, altura, cor),
  })
}

/**
 * O `$DOG` miúdo: 47 marcas na casca.
 *
 * ⚠️ ELE PRECISA DE MAIS FAIXAS E MENOS RESPIRO, e a razão é o aspecto. `$DOG`
 * são 4 casas de glifo, aspecto **4,57**, contra 1,00 da Kray: com a mesma
 * altura de faixa cada cópia ficaria 4,6x mais larga e caberiam 3 por faixa, o
 * que não é grade, é anel. Oito faixas de 29,6 m com respiro 1,30 devolvem
 * 4 a 7 cópias por latitude e 47 no total, que é a mesma leitura de "muitas" com
 * a marca continuando legível de perto.
 */
function pintarCorpoDogMiudo(g: CanvasRenderingContext2D, w: number, h: number) {
  gradeMiuda(g, w, h, {
    fundo: COR_DADO, tinta: '#140B04', aspecto: (4 * 8) / 7,
    s0: 0.88, s1: -0.30, faixas: 8, respiro: 1.30,
    desenhar: (og, larg, alt, cor) => escreverGlifos(og, '$DOG', larg, alt, cor ?? '#140B04'),
  })
}

/**
 * ⚠️ A CASCA INTEIRA COMO TELA, E NÃO SÓ A FAIXA. Pedido do fundador em 08/09:
 * *"em algum momento ele muda por completo de cor? Quero ele todo em laranja com
 * logo do Bitcoin em algum momento, em outros quero ele escrevendo $DOG"*.
 *
 * O mecanismo já existia e estava subaproveitado: `SphereConteudo.pintarCorpo`
 * recebe o contexto do canvas de 2.048 x 1.024 INTEIRO, antes de a faixa ser
 * desenhada por cima. Até aqui só o intervalo da Kray usava, para pôr duas
 * cintas brancas num casco preto. Estas duas peles usam a casca toda.
 *
 * ⚠️ A MARCA SE REPETE NA VOLTA, E ISSO NÃO É ENFEITE: a esfera é vista de
 * qualquer azimute e não tem costas. Uma marca só apareceria de um lado e
 * deixaria os outros 270° em cor chapada. `N_MARCAS` é o número de cópias
 * igualmente espaçadas, que é a regra de simetria da casa (elementos repetidos
 * igualmente espaçados; excluir é melhor que desalinhar).
 *
 * ⚠️ E A DISTORÇÃO EQUIRETANGULAR É COMPENSADA NA LARGURA. A textura é uma grade
 * de latitude x longitude: um círculo desenhado nela vira uma elipse achatada na
 * esfera, tanto mais quanto mais perto do polo. A marca fica centrada na latitude
 * do CENTRO ÓPTICO (+16,56°, linha 418), e a largura dela é dividida por
 * `cos(lat)` para o glifo sair redondo onde ele é visto. Sem isso o ₿ sai gordo.
 */
const N_MARCAS = 4
/** o raio da esfera em metros, para as contas de projeção das peles */
const SPHERE_R_M = 200.5
/** um texel da grade equirretangular, em metros de arco no equador */
const PASSO_LED = 0.6151
/** a latitude do centro óptico da silhueta, em linha de LED (ver sphere.ts) */
const LINHA_CENTRO = 418
/**
 * ⚠️ A DÍVIDA DA LATITUDE FOI PAGA EM 09/09, E `LINHA_MARCA = 230` SAIU COM ELA.
 * Ela existia porque a marca tinha de caber ACIMA da faixa de dado (linha 368) e
 * por isso vivia a 33° do centro óptico, com a base 1,71x mais alta na aparência
 * que o topo. O conserto que o próprio comentário indicava era o que se fez: a
 * carta do Bitcoin suprime a faixa e a marca atravessa o centro óptico. Quem
 * ainda mora acima da faixa é o mascote e o `$DOG`, e os dois são conteúdo de
 * casca com faixa por baixo, não marca única centrada.
 */


/**
 * PELE 1: A ESFERA INTEIRA EM LARANJA, COM O ₿ EM NEGATIVO.
 *
 * ⚠️ O LARANJA É O FUNDO E A MARCA É O BURACO, e não o contrário. Um ₿ laranja
 * sobre casco escuro seria mais um logo aceso; a esfera INTEIRA acesa em
 * `#E8660D`, com a marca recortada em quase preto, é a peça inteira virando
 * sinal. É esse quadro que responde ao "muda por completo de cor".
 */
/**
 * ⚠️ A COMPENSAÇÃO É DUPLA, E ATÉ AGORA SÓ A METADE EXISTIA. A largura foi
 * consertada em 08/09 (era um escalar único e a base saía 2,80x mais larga que o
 * topo), mas a de ALTURA nunca existiu, e ela é a maior das duas. Medido no ₿ que
 * foi ao ar: 76,3 m de largura aparente por 78,5 m de altura, aspecto **0,971**
 * contra os 0,620 do glifo, ou seja **1,57x gordo** para qualquer olho distante.
 *
 * As duas saem da MESMA projeção. Visto de fora, um ponto de latitude φ aparece a
 * altura `R·sen φ` e um arco de longitude aparece com largura `R·cos φ·Δλ`. Logo:
 *
 *   ALTURA   as fatias do glifo se distribuem por SENO constante, não por
 *            latitude constante. Latitude constante é o que aperta o glifo perto
 *            do polo, e é o defeito que sobrava.
 *   LARGURA  cada fatia leva `arco / cos φ` texels de textura.
 *
 * ⚠️ `s0` E `s1` SÃO SENO, NÃO LINHA, e é por isso que a marca é declarada assim.
 * Com `s0 = 0,92` e `s1 = 0,44` o glifo aparece com **96,2 m de altura e 59,7 m de
 * largura**, aspecto 0,620 por construção, ocupando as linhas 131 a 363, ou seja
 * acima da faixa de dado (368) com 5 linhas de folga. Na linha do topo ele pede
 * 43,5° de longitude; 4 cópias somam 174° dos 360, deixando 46,5° de laranja
 * pleno entre marcas, que é a leitura da referência de Las Vegas.
 */
function peleMarca(
  g: CanvasRenderingContext2D, w: number, h: number,
  o: {
    /** `null` NÃO pinta fundo, e é o que permite empilhar camadas na mesma
     *  casca (o `$DOG` em duas fileiras, a logo do parceiro mais o friso). Quem
     *  empilha pinta o fundo na PRIMEIRA camada e passa `null` nas seguintes. */
    fundo: string | null; tinta: string; n: number; s0: number; s1: number
    desenhar: (og: CanvasRenderingContext2D, larg: number, alt: number, cor: string) => void
    aspecto: number
    /**
     * Deslocamento das cópias, em FRAÇÃO DO PASSO (0 a 1). O padrão é 0, que é a
     * fase histórica `(i + 0,5)/n` e é ela que casa a logo da Kray com o nome no
     * friso: quem mexer aqui numa pele de marca ÚNICA quebra aquele alinhamento.
     * Existe para a grade miúda, onde faixas vizinhas não podem ficar em coluna.
     */
    fase?: number
  },
) {
  const L = h / 1024
  if (o.fundo !== null) {
    g.fillStyle = o.fundo
    g.fillRect(0, 0, w, h)
  }

  const altAparente = SPHERE_R_M * (o.s0 - o.s1)
  const arcoTexels = (o.aspecto * altAparente) / PASSO_LED

  // ⚠️ O GLIFO É RASTERIZADO FORA EM ASPECTO VERDADEIRO. `g.scale` é afim e não
  // sabe variar com y, então não há como pedir isto ao canvas de uma vez. O 2x
  // horizontal é supersampling: sem ele a borda serrilha ao ser esticada.
  const K = 240                                   // fatias verticais
  const off = document.createElement('canvas')
  off.width = Math.max(2, Math.ceil(arcoTexels * L * 2))
  off.height = Math.max(2, Math.ceil(K * L))
  o.desenhar(off.getContext('2d')!, off.width, off.height, o.tinta)
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'high'

  const linhaDe = (sen: number) => ((90 - (Math.asin(sen) * 180) / Math.PI) / 180) * 1024
  for (let i = 0; i < o.n; i++) {
    const cx = (((i + 0.5 + (o.fase ?? 0)) % o.n) / o.n) * w
    for (let k = 0; k < K; k++) {
      const sA = o.s0 - (k / K) * (o.s0 - o.s1)
      const sB = o.s0 - ((k + 1) / K) * (o.s0 - o.s1)
      const phi = Math.asin((sA + sB) / 2)
      const larg = (arcoTexels / Math.max(Math.cos(phi), 0.05)) * L
      const dy = Math.round(linhaDe(sA) * L)
      const dh = Math.max(1, Math.round(linhaDe(sB) * L) - dy)
      g.drawImage(
        off, 0, (k * off.height) / K, off.width, off.height / K,
        Math.round(cx - larg / 2), dy, Math.round(larg), dh,
      )
    }
  }
}

/**
 * PINTAR UMA ARTE DE ALFA DENTRO DA TELA OFFSCREEN DO `peleMarca`.
 *
 * ⚠️ ELA PREENCHE A TELA INTEIRA, e isso não é descuido de enquadramento: é a
 * largura inteira do offscreen que mapeia para `arcoTexels`, ou seja para a
 * largura pretendida da marca no casco. Desenhar "no aspecto certo" dentro dela
 * deixaria sobra dos dois lados e a marca sairia estreita.
 *
 * ⚠️ E O `cor` REPINTA POR `source-in` em vez de multiplicar: as PNG de marca são
 * silhueta branca com alfa, então trocar a tinta é preencher o retângulo por
 * dentro do alfa que já está lá. Sem `cor`, a arte vai como está, que é o caso do
 * mascote (imagem colorida) e da Kray (branca sobre casco preto).
 */
function desenharArte(
  og: CanvasRenderingContext2D, im: HTMLImageElement | null,
  larg: number, alt: number, cor?: string,
) {
  if (!im) return
  og.drawImage(im, 0, 0, larg, alt)
  if (!cor) return
  og.globalCompositeOperation = 'source-in'
  og.fillStyle = cor
  og.fillRect(0, 0, larg, alt)
  og.globalCompositeOperation = 'source-over'
}

function pintarCorpoBitcoin(g: CanvasRenderingContext2D, w: number, h: number) {
  // ⚠️ A MARCA É A LOGO OFICIAL, NÃO UM DESENHO MEU. Eu errei este glifo três
  // vezes seguidas à mão e o fundador reclamou as três. `public/city/btc-marca.png`
  // é o glifo recortado de `public/BTC.png`, que já vivia no repo, e a fidelidade
  // dele está CONFERIDA em 09/09, pixel a pixel contra o original: mesma caixa
  // (474 x 629, aspecto 0,7536) e **0,27% de pixels diferentes, todos de borda**.
  // O arquivo nunca foi o problema.
  //
  // ⚠️ O QUE ESTAVA ERRADO ERA A COR E O LUGAR, e as duas mudaram em 09/09 depois
  // de o fundador ver a peça no ar (*"símbolo do BTC errado... vamos colocar ali
  // um logo oficial do Bitcoin, imagem"*):
  //
  //   COR    o logo oficial é ₿ BRANCO sobre disco laranja. A tinta era `#140B04`,
  //          um quase-preto, com a justificativa de que "o laranja é o fundo e a
  //          marca é o buraco". Era invenção minha, não o logo: a esfera laranja
  //          JÁ É o disco da moeda, e o que faltava para ela ser o logo oficial
  //          era a marca branca.
  //   LUGAR  a marca morava de seno 0,92 a 0,44, ou seja inteira ACIMA do centro
  //          óptico da silhueta (seno 0,284, linha 418), espremida contra o polo
  //          para não bater na faixa de dado. Vista de fora ela ficava no chapéu
  //          da esfera, com a metade de baixo do disco vazia. Agora ela ATRAVESSA
  //          o centro óptico, de 0,74 a -0,22, e a faixa é que sai (ver
  //          `slotBitcoin`): esta pele é identidade, não dado.
  //
  // Medido, com R = 200,5 m: altura aparente **192,5 m** (48% do diâmetro visível,
  // contra 63% do glifo no logo oficial), largura **145,1 m**, ou seja 236 texels
  // e 41,5° de longitude por cópia. Quatro cópias somam 166° dos 360 e a leitura
  // de um azimute satura em 116°, então há sempre uma marca inteira à vista.
  const im = arte('/city/btc-marca.png')
  peleMarca(g, w, h, {
    // ⚠️ ENCOLHEU 15% EM 10/09, A PEDIDO DO FUNDADOR, E O CENTRO NÃO SE MEXEU.
    // Era de seno 0,74 a −0,36: amplitude 1,10, centro em 0,19. A redução é da
    // AMPLITUDE (1,10 × 0,85 = 0,935) em torno do mesmo centro, senão a marca
    // encolhe e sobe ao mesmo tempo, e o que ele pediu foi só o tamanho.
    // A largura acompanha sozinha, porque ela sai da altura pelo `aspecto`:
    // altura aparente de 192,5 m para **163,6 m** (48% para 40,8% do diâmetro
    // visível) e largura de 145,1 para 123,3 m.
    // ⚠️ O PREÇO ESTÁ MEDIDO: a longitude por cópia cai de 41,5° para 35,3°, e as
    // quatro cópias somam 141° dos 360 em vez de 166. A leitura de um azimute
    // satura em 116°, então continua havendo marca inteira à vista, com menos
    // folga do que antes. Encolher muito mais que isto quebra essa garantia.
    fundo: COR_BITCOIN, tinta: '#FFFFFF', n: N_MARCAS, s0: 0.6575, s1: -0.2775,
    aspecto: 474 / 629,                       // a caixa medida do glifo oficial
    desenhar: (og, larg, alt, cor) => desenharArte(og, im, larg, alt, cor),
  })
}

/**
 * O TIPO GIGANTE: o mesmo dado da faixa, em escala que atravessa a cidade.
 *
 * ⚠️ ISTO NÃO É TROCAR DE LAYOUT COM A DISTÂNCIA, e a diferença importa porque o
 * fundador vetou aquilo com razão. Os dois registros existem AO MESMO TEMPO, o
 * tempo todo: de perto o olho lê a faixa, de longe ele lê o gigante, e nada
 * comuta enquanto o visitante navega. É a mesma informação em duas escalas, como
 * um painel de estádio tem placar grande e ficha técnica pequena.
 *
 * ⚠️ E SEM ELE O DADO SIMPLESMENTE NÃO EXISTE ALÉM DE 5 km. Medido: a letra da
 * faixa tem 34,45 m e cai a **6,8 px a 7,5 km**, enquanto o critério de leitura
 * pede 9. Para ler ali a letra precisa de 46 m. A daqui tem **60 m** e lê até
 * **9.847 m**, que cobre o tecido inteiro da cidade (o ponto mais distante fica a
 * 7.520 m do sítio).
 *
 * ⚠️ DUAS CÓPIAS, E É O QUE CABE. Com 6 casas a 60 m de altura o grupo ocupa 118°
 * de longitude; duas cópias somam 236° dos 360, com 62° de folga cada. Três não
 * cabem, e uma só deixaria metade da cidade sem ver o número.
 *
 * ⚠️ MEMOIZADO POR VALOR, e isso não é otimização, é conserto. `tickFade` decide
 * a cortina comparando a IDENTIDADE da função `pintarCorpo`; uma closure nova a
 * cada valor dispararia a cortina de 700 ms a cada troca de dígito, e o preço é
 * uma repintura de 7 ms por cima.
 */
const _cacheGigante = new Map<string, (g: CanvasRenderingContext2D, w: number, h: number) => void>()

function peleValor(valor: string) {
  const t = valor.slice(0, 6).toUpperCase()
  const posto = _cacheGigante.get(t)
  if (posto) return posto
  const fn = (g: CanvasRenderingContext2D, w: number, h: number) => {
    peleMarca(g, w, h, {
      fundo: '#141414', tinta: COR_DADO, n: 2, s0: 0.74, s1: 0.44,
      // 6 casas de 8 pixels de glifo, e 7 de altura: a razão da caixa inteira
      aspecto: (t.length * 8) / 7,
      desenhar: (og, larg, alt, cor) => escreverGlifos(og, t, larg, alt, cor),
    })
  }
  // ⚠️ TETO DE CACHE: preço muda o tempo todo e um `Map` sem teto é vazamento.
  if (_cacheGigante.size > 24) _cacheGigante.clear()
  _cacheGigante.set(t, fn)
  return fn
}

/**
 * CARTA: O MASCOTE.
 *
 * ⚠️ A ESFERA INTEIRA VIRA O CACHORRO, e é o movimento literal da referência de
 * Las Vegas virando um emoji. Pedido do fundador com a arte oficial do $DOG na
 * mão: *"essa imagem é do $DOG oficial, conseguimos projetar ela ali?"*.
 *
 * ⚠️ O FUNDO JÁ VEM TRANSPARENTE, então não houve remoção de fundo: medido no
 * PNG original, 65% dos pixels estão em alfa zero. O arquivo foi recortado na
 * caixa do que é opaco (2269x2269 para 1359x2159) e reduzido para 322x512, que é
 * o bastante para os cerca de 400 texels de altura que ele ocupa e evita carregar
 * 2 MB numa cena que já briga por memória de textura no celular.
 *
 * ⚠️ ELE É BLITADO PELA MESMA MÁQUINA DAS OUTRAS PELES. `peleMarca` já resolve as
 * duas compensações (altura por seno constante, largura por 1/cos φ), então o
 * mascote não precisa de conta nova: ele entra como um `desenhar` que faz um
 * `drawImage` em aspecto verdadeiro, e a esfera cuida da projeção. Foi para isso
 * que `peleMarca` virou máquina em vez de código do ₿.
 *
 * ⚠️ A IMAGEM CARREGA FORA DO CAMINHO DA REPINTURA. `pintarCorpo` é síncrona e
 * roda dentro dos 7 ms do repaint: esperar rede ali travaria a thread. A carta só
 * entra na rotação depois que a imagem está pronta, e antes disso `slotMascote`
 * devolve `null` e o anel gira para o próximo, que é o mesmo contrato que os
 * módulos de dado sem fonte fresca já usam.
 */
/**
 * ⚠️ UM CARREGADOR SÓ PARA TODA ARTE DE PELE. Cada carta que usa imagem precisa da
 * mesma dança (pedir uma vez, guardar, e ficar fora do baralho enquanto não
 * chegou), e duplicá-la por carta é como se perdem casos: basta um `onerror` sem
 * tratamento para a peça travar num quadro vazio.
 */
const _artes = new Map<string, HTMLImageElement | null>()
function arte(url: string): HTMLImageElement | null {
  if (typeof window === 'undefined') return null
  if (!_artes.has(url)) {
    _artes.set(url, null)
    const im = new Image()
    im.decoding = 'async'
    // ⚠️ PRIORIDADE BAIXA DE PROPÓSITO: a arte só é NECESSÁRIA minutos adentro do
    // anel, enquanto os GLB da praça são necessários no primeiro quadro. Sem isso
    // o precarregamento abaixo passaria na frente da cidade na fila da rede.
    // (o cast existe porque o lib.dom desta versão do TS ainda não conhece o campo)
    ;(im as HTMLImageElement & { fetchPriority?: string }).fetchPriority = 'low'
    im.onload = () => _artes.set(url, im)
    im.onerror = () => console.warn(`[sphere] ${url} não carregou; a carta fica fora do baralho`)
    im.src = url
  }
  return _artes.get(url) ?? null
}

function pintarCorpoMascote(g: CanvasRenderingContext2D, w: number, h: number) {
  const im = arte('/city/dog-mascote.png')
  peleMarca(g, w, h, {
    // ⚠️ FUNDO LARANJA, E ELE NÃO É ENFEITE: o mascote é recortado, então sem um
    // fundo aceso a casca seria preta em volta dele e a peça voltaria a ser o
    // buraco que ela era. Laranja pleno é a mesma leitura da pele do Bitcoin, e a
    // média da casca fica alta, que é o que a faz existir a 7 km.
    // ⚠️ SEIS CÓPIAS, E O NÚMERO SAI DA JANELA DE LEITURA. Uma marca alta e
    // estreita cobre pouca longitude: o mascote mede 100 m de altura por 63 de
    // largura, ou seja 18,0° cada. Com período de 60° e a janela de um azimute
    // saturando em 116°, sempre há uma cópia INTEIRA à vista, de qualquer lado da
    // cidade. Com duas cópias (o que eu tinha posto primeiro) a cobertura seria de
    // 36° em 360, e cinco sextos dos azimutes veriam laranja liso.
    //
    // ⚠️ E ELE PARA ANTES DA FAIXA: `s1 = 0,44` põe a base na linha 363, com 5
    // linhas de folga até a faixa de dado em 368. Atravessá-la cortaria o cachorro
    // com o texto, que foi o que a primeira medição pegou.
    fundo: COR_DADO, tinta: '#140B04', n: 4, s0: 0.82, s1: -0.35,
    // a proporção da arte recortada: 1359 por 2159
    aspecto: 1359 / 2159,
    desenhar: (og, larg, alt) => desenharArte(og, im, larg, alt),
  })
}

/**
 * PELE: `$DOG CITY` DANDO A VOLTA, EM DUAS LINHAS.
 *
 * ⚠️ ELA ERA A CASCA PRETA QUE O FUNDADOR FOTOGRAFOU EM 09/09: *"essa versão do
 * banner DOG continua com essa parte de baixo toda preta"*. O fundo era
 * `#0A0B0D` e o único conteúdo era uma linha de letras na latitude 235, ou seja
 * a peça inteira apagada com quatro palavras acesas no alto. Ela agora é a mesma
 * pele do mascote e a do Bitcoin: **fundo laranja pleno, letra escura**. Três
 * defeitos caíram juntos:
 *
 *   1. **a casca apagada.** Medida a média linear da textura, esta pele valia
 *      0,019 contra 0,235 da pele do Bitcoin. De longe ela não era uma esfera
 *      escura escrita, era um buraco.
 *   2. **a tipografia de fora.** Ela desenhava com `g.font` do sistema
 *      (JetBrains Mono), e a peça tem UMA tipografia, que é a matriz 5x7 do
 *      Estádio. Era a única pele que falava outra língua, e é o `$` de serifa
 *      que aparece na foto.
 *   3. **a projeção à mão.** Ela compensava latitude com um escalar único,
 *      admitindo no próprio comentário um erro residual de 4,6%. `peleMarca` já
 *      resolve as duas compensações (altura por seno constante, largura por
 *      1/cos φ) e é o que o mascote, o ₿ e o tipo gigante usam.
 *
 * ⚠️ E ELA PARA ANTES DA FAIXA, como todas: `s1 = 0,44` põe a base na linha 363,
 * com 5 linhas de folga até a faixa de dado em 368.
 */
function pintarCorpoDog(g: CanvasRenderingContext2D, w: number, h: number) {
  // ⚠️ `$DOG CITY` EMPILHADO EM DUAS LINHAS, E A ESCOLHA É MEDIDA. Pedido do
  // fundador em 09/09: *"o último, `$DOG` pode virar `$DOG CITY`"*. Numa esfera,
  // texto largo é caro: a largura vai com o número de casas e a janela de leitura
  // de um azimute satura em 116,5° de longitude, então uma linha só de `$DOG CITY`
  // (9 casas, aspecto 10,29) obriga a escolher entre letra pequena e nome cortado:
  //
  //     uma linha, n=3, letra 40,1 m   cada cópia 124° > janela: NUNCA inteiro
  //     uma linha, n=4, letra 36,1 m   cada cópia 111°, no fio da janela
  //     **empilhado, n=4, letra 56,1 m  cada cópia 83°, sobra 34° de folga**
  //
  // Empilhar devolve 56% de altura de letra e mete o nome inteiro dentro da
  // janela em qualquer azimute. As duas fileiras têm 4 casas cada, então elas
  // alinham coluna a coluna sozinhas, e o vão entre elas (seno 0,18 a 0,10, 16 m)
  // é o que faz as duas lerem como uma marca e não como duas palavras soltas.
  peleMarca(g, w, h, {
    fundo: COR_DADO, tinta: '#140B04', n: 4, s0: 0.46, s1: 0.18,
    aspecto: (4 * 8) / 7,
    desenhar: (og, larg, alt, cor) => escreverGlifos(og, '$DOG', larg, alt, cor ?? '#140B04'),
  })
  peleMarca(g, w, h, {
    fundo: null, tinta: '#140B04', n: 4, s0: 0.10, s1: -0.18,
    aspecto: (4 * 8) / 7,
    desenhar: (og, larg, alt, cor) => escreverGlifos(og, 'CITY', larg, alt, cor ?? '#140B04'),
  })
}

/**
 * OS DOIS QUADROS DE MARCA, que são os que mudam a casca inteira.
 *
 * ⚠️ ELES ENTRAM NO ANEL DE DADO, NÃO NO INTERVALO COMERCIAL, e a diferença é de
 * princípio: o intervalo é tempo VENDIDO, contado no livro-caixa de
 * `podeAnunciar`, e a marca da casa não pode consumir cota de parceiro nem se
 * disfarçar de anúncio. Eles são identidade, e identidade é conteúdo próprio.
 *
 * ⚠️ E O GANHO É ALTO NOS DOIS, POR DESENHO. O estado sóbrio é o do dado; estes
 * são os dois momentos em que a peça levanta a voz sozinha. Ainda assim ficam
 * ABAIXO do intervalo comercial (0,90), porque a regra da casa é que quem grita
 * mais alto é o anúncio, e a diferença entre marca e propaganda tem de ser
 * visível sem legenda.
 */
const GANHO_MARCA = 0.78

function slotBitcoin(_altura: number | null): Slot | null {
  // ⚠️ SEM A ARTE O SLOT NÃO ENTRA, ele cede a vez para o próximo do anel. A pele
  // sem a marca seria só laranja liso: não mente, mas gasta 48 s de uma volta de
  // 408 s dizendo nada. Com o precarregamento isto não deve acontecer nunca; é
  // rede de segurança, e é a mesma regra de `slotMascote`.
  if (!arte('/city/btc-marca.png')) return null
  return {
    classe: 'dado',
    nome: 'marca-btc',
    quadros: [
      // ⚠️ A FAIXA SAI NESTA CARTA, E A DÍVIDA ESTAVA DECLARADA DESDE 08/09 em
      // `LINHA_MARCA`: *"o conserto de verdade é o quadro do Bitcoin SUPRIMIR a
      // faixa (ele é identidade, não dado)"*. Enquanto a faixa mandava, a marca
      // tinha de caber acima da linha 368 e ficava no chapéu da esfera. Sem ela,
      // o ₿ ocupa o meio do disco e a peça vira a moeda.
      //
      // ⚠️ E NÃO SE PERDE DADO NENHUM. Os dois quadros que saíram eram
      // `BITCOIN` / `THE CHAIN` (que não diz nada que o ₿ não diga) e a altura do
      // bloco. A altura continua publicada onde ela é notícia: no EVENTO de bloco
      // minerado (`eventoBloco`, com as tx de DOG dentro) e no módulo do
      // snapshot. Um quadro de 48 s, sem troca de layout no meio.
      // ⚠️ O QUADRO DE 48 s VIROU DOIS, E O TEMPO NÃO CRESCEU. Pedido do fundador
      // em 10/09, o mesmo da Kray: *"quero a mesma coisa com o $DOG e o símbolo
      // do Bitcoin"*. A grade miúda leva `MS_GRADE_MIUDA` dos 48, e a marca
      // grande fica com o resto. Os dois dividem `peleId`, então a troca sai no
      // vale do ganho (a piscada) e não na cortina, que é gesto de trocar de
      // carta, não de quadro.
      quadro('', '', MS_MODULO - MS_GRADE_MIUDA, {
        ganho: GANHO_MARCA,
        pintarCorpo: pintarCorpoBitcoin,
        peleId: 'marca-btc',
        faixaFundo: null,
      }),
      quadro('', '', MS_GRADE_MIUDA, {
        ganho: GANHO_MARCA,
        pintarCorpo: pintarCorpoBitcoinMiudo,
        peleId: 'marca-btc',
        faixaFundo: null,
      }),
    ],
  }
}

/**
 * ⚠️ A CARTA SÓ ENTRA COM A IMAGEM PRONTA, e devolver `null` é o contrato do anel:
 * `montar()` já trata módulo sem fonte fresca assim, e o anel gira para o
 * próximo. Esperar rede dentro de `pintarCorpo` travaria a thread nos 7 ms do
 * repaint.
 */
function slotMascote(): Slot | null {
  if (!arte('/city/dog-mascote.png')) return null
  const base: Partial<SphereConteudo> = {
    ganho: GANHO_MARCA,
    pintarCorpo: pintarCorpoMascote,
    peleId: 'mascote',
    // ⚠️ SEM FAIXA, COMO A CARTA DO BITCOIN, E PELO MESMO MOTIVO: a faixa era
    // dona do meio da esfera e empurrava o mascote para o chapéu. Sem ela ele
    // vai de seno 0,82 a −0,35, ou seja **234,6 m de altura e 87,7% da área
    // visível**, contra 100,2 m e 28,7% de antes. O que a faixa dizia aqui era
    // `$DOG` e `DOGCITY` sobre um desenho que já é o $DOG.
    faixaFundo: null,
  }
  return {
    classe: 'dado',
    nome: 'marca-mascote',
    quadros: [quadro('', '', MS_MODULO, base)],
  }
}

function slotDog(): Slot {
  const base: Partial<SphereConteudo> = {
    ganho: GANHO_MARCA,
    pintarCorpo: pintarCorpoDog,
    peleId: 'marca-dog',
    // ⚠️ SEM CHÃO DE FAIXA E COM TINTA ESCURA, exatamente como a pele do ₿ e a do
    // mascote: quem pinta a casca inteira é dono do fundo dela, e sobre laranja
    // pleno o chão laranja padrão seria carimbo invisível e a letra laranja
    // sumiria. Foi assim que a "tarja preta no meio dela" nasceu em 08/09.
    faixaFundo: null,
  }
  return {
    classe: 'dado',
    nome: 'marca-dog',
    quadros: [
      // ⚠️ UM QUADRO DE 48 s, SEM FAIXA. O segundo quadro era a carta da Lua, que
      // saiu, e a faixa saiu junto: o texto da casca JÁ É `$DOG` em duas fileiras
      // de 56 m, e uma faixa por cima dele escreveria `$DOG` uma terceira vez no
      // meio das duas.
      quadro('', '', MS_MODULO - MS_GRADE_MIUDA, base),
      // ⚠️ A GRADE MIÚDA DO `$DOG`, mesma divisão de tempo do ₿ e da Kray. Ela
      // herda `base` (ganho, `peleId` e a ausência de faixa) e só troca a pele,
      // que é o que faz a troca sair no vale do ganho.
      quadro('', '', MS_GRADE_MIUDA, { ...base, pintarCorpo: pintarCorpoDogMiudo }),
    ],
  }
}

function slotAnuncio(): Slot {
  const base: Partial<SphereConteudo> = {
    ganho: GANHO_ANUNCIO,
    cor: COR_ANUNCIO,
    corRotulo: COR_ANUNCIO,
    pintarCorpo: pintarCorpoKray,
    peleId: 'kray',
    // ⚠️ O PARCEIRO USA A PALETA DELE, e por isso ele pede o chão explicitamente.
    // O padrão da casa virou faixa LARANJA com letra escura em 08/09 (ver
    // `pintarTextura`); a Kray é casco preto com marca branca, e branco sobre
    // laranja seria a peça da casa vestida de parceiro.
    faixaFundo: '#0A0B0D',
    // o bullet cheio, e ele é o pedido literal do fundador (ver `SphereConteudo.sep`)
    sep: SEP_MARCA,
    // ⚠️ O FRISO DO NOME DESCE PARA DEBAIXO DA LOGO. Na latitude padrão ele
    // partiria a marca ao meio; aqui ele vira a base da peça, e a logo fica com
    // a lateral inteira acima dele. As linhas 530 a 630 ficam bem acima do topo
    // do colar (644), que é o que oclui a casca por baixo.
    faixaLinhas: [530, 630] as [number, number],
  }
  return {
    classe: 'anuncio',
    nome: 'kray',
    quadros: [
      // ⚠️ UM QUADRO SÓ, E `THE WALLET` SAIU POR PEDIDO DO FUNDADOR EM 09/09:
      // *"tire o 'the wallet', queremos • Kray Space • Kray Space • Kray Space
      // •…. exatamente assim, e a logo"*. Com o nome do parceiro correndo na
      // volta e a marca dele na casca, o intervalo passou a ter UMA leitura, e é
      // o mesmo conserto que 08/09 já tinha feito pela metade: o anunciante saía
      // da tela em 48 dos 72 s comprados quando a linha grande trocava, e agora
      // ele não sai em segundo nenhum.
      //
      // ⚠️ E A LINHA PEQUENA FICA VAZIA, DE PROPÓSITO. Ela era o lugar da
      // mensagem (`THE WALLET`, `YOUR KEYS`), e sem mensagem um rótulo qualquer
      // seria enchimento sobre tempo vendido. `escrever` com texto vazio não
      // desenha nada: sobra casco preto, que é a peça da Kray.
      //
      // ⚠️ O PREÇO DE LEITURA ESTÁ MEDIDO E É DECLARADO: `KRAY SPACE` tem 10
      // caracteres contra os 4 de `KRAY`, então ele cabe em 2 cópias na volta em
      // vez de 4, e a fração de azimutes que veem o nome INTEIRO cai. Foi pedido
      // pelo nome certo do parceiro, e nome de anunciante não se abrevia por
      // orçamento tipográfico: quem paga escolhe como é chamado.
      // ⚠️ OS 72 s COMPRADOS SE DIVIDEM, NÃO CRESCEM. O anunciante paga
      // `MS_ANUNCIO`; a grade miúda entra DENTRO desse tempo, com 24 dos 72 s,
      // e não como um quarto de minuto a mais de graça.
      quadro('KRAY SPACE', '', MS_ANUNCIO - MS_GRADE_MIUDA, base, 10),
      // ⚠️ O NOME SAI NA GRADE, e é escolha de leitura. Com 101 marcas na casca,
      // um friso de texto por cima disputa com elas e as duas coisas pioram: a
      // grade é a marca falando sozinha, de perto, que foi o pedido. O nome
      // volta no quadro seguinte, que ocupa dois terços do intervalo.
      quadro('', '', MS_GRADE_MIUDA, { ...base, pintarCorpo: pintarCorpoKrayMiudo }, 10),
    ],
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. OS MÓDULOS DE DADO
// ═══════════════════════════════════════════════════════════════════════════

interface FontePreco {
  preco: number
  variacao: number | null
  em: number
}

interface FonteVolume {
  volume24: number | null
  alta24: number | null
  baixa24: number | null
  em: number
}

interface FontePulso {
  pendentes: number
  emVoo: number
  taxaRapida: number | null
  em: number
}

interface FonteCadeia {
  tip: number
  em: number
}

const fresco = (em: number | undefined, validade: number, agora: number) =>
  em !== undefined && agora - em <= validade

/** PREÇO: dois quadros, 24 s cada. Valor grande, rótulo pequeno, sempre. */
function moduloPreco(f: FontePreco | null, agora: number): Quadro[] | null {
  if (!f || !fresco(f.em, VALIDADE_PRECO, agora)) return null
  const texto = fmtPreco(f.preco)
  if (!texto) return null
  const q: Quadro[] = [quadro(texto, ROTULOS.precoSpot, MS_MODULO / 2)]
  if (f.variacao !== null && Number.isFinite(f.variacao)) {
    const sobe = f.variacao >= 0
    q.push(quadro(fmtPct(f.variacao), ROTULOS.precoVar, MS_MODULO / 2, {
      // ⚠️ DIREÇÃO POR PESO E TEMPERATURA. Ver a nota da paleta: 1,32x de razão
      // de ganho entre alta e queda, contra 2,14x entre ocioso e anúncio.
      cor: sobe ? COR_DADO : COR_DADO_FRACO,
      ganho: sobe ? GANHO_ALTA : GANHO_QUEDA,
    }))
  } else {
    q[0].ms = MS_MODULO
  }
  return q
}

/** VOLUME: volume de 24 h, máxima e mínima, como o fundador listou. */
function moduloVolume(f: FonteVolume | null, agora: number): Quadro[] | null {
  if (!f || !fresco(f.em, VALIDADE_VOLUME, agora)) return null
  const q: Quadro[] = []
  if (f.volume24 !== null) q.push(quadro(fmtDog(f.volume24), ROTULOS.volume, 0))
  if (f.alta24 !== null) q.push(quadro(fmtPreco(f.alta24), ROTULOS.alta, 0))
  if (f.baixa24 !== null) q.push(quadro(fmtPreco(f.baixa24), ROTULOS.baixa, 0))
  return dividir(q, MS_MODULO)
}

/** PULSO: o que está em voo agora. Vem de graça no feed da órbita. */
function moduloPulso(f: FontePulso | null, agora: number): Quadro[] | null {
  if (!f || !fresco(f.em, VALIDADE_PULSO, agora)) return null
  const q: Quadro[] = [quadro(String(f.pendentes), ROTULOS.pendentes, 0)]
  if (f.emVoo > 0) q.push(quadro(fmtDog(f.emVoo), ROTULOS.emVoo, 0))
  if (f.taxaRapida !== null && f.taxaRapida > 0) {
    q.push(quadro(String(Math.round(f.taxaRapida)), ROTULOS.taxa, 0))
  }
  return dividir(q, MS_MODULO)
}

/**
 * SNAPSHOT: a contagem até o bloco 966.670.
 *
 * ⚠️ EM BLOCOS, NUNCA EM SEGUNDOS, e a razão é doutrina paga desta casa
 * (`snapshot.tsx`, regra 2): achar bloco é processo de Poisson, e a mil blocos
 * de distância o desvio padrão do tempo até o alvo é 10 min · √1000 ≈ **5,3
 * horas**. Um regressivo em segundos seria lido como compromisso e estaria
 * errado por quase um dia em qualquer direção.
 *
 * ⚠️ A ESTIMATIVA EXISTE, MAS DECLARADA E EM ESCADA DE PRECISÃO. Mesma escada
 * de `snapshot.tsx`: até 6 blocos fala em hora, até 144 fala em horas, além
 * disso fala em dias. Um instrumento honesto perde casas quando não as tem. E
 * ela NÃO tiqueteia: só se recalcula quando a ponta da chain anda, porque só a
 * ponta da chain a alimenta.
 */
function moduloSnapshot(f: FonteCadeia | null, agora: number): Quadro[] | null {
  if (!f || !fresco(f.em, VALIDADE_SNAPSHOT, agora)) return null
  const alvo = SNAPSHOT.block
  if (f.tip >= alvo) {
    return dividir([
      quadro(String(alvo), ROTULOS.snapshotFeito, 0),
      quadro(String(f.tip - alvo), ROTULOS.blocosDesde, 0),
    ], MS_MODULO)
  }
  const faltam = alvo - f.tip
  const min = faltam * SNAPSHOT.minutesPerBlock
  const eta = faltam <= 6 ? '1 HOUR'
    : faltam <= 144 ? `${Math.max(1, Math.round(min / 60))} HRS`
    : `${Math.max(1, Math.round(min / 1440))} DAYS`
  return dividir([
    quadro(String(faltam), ROTULOS.blocosFaltam, 0),
    quadro(String(alvo), ROTULOS.blocoAlvo, 0),
    quadro(eta, ROTULOS.estimativa, 0),
  ], MS_MODULO)
}

/** reparte o módulo igualmente entre os quadros, respeitando o piso de 8 s */
function dividir(q: Quadro[], total: number): Quadro[] | null {
  if (!q.length) return null
  const ms = Math.max(QUADRO_MIN, Math.round(total / q.length))
  for (const x of q) x.ms = ms
  return q
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. OS TRÊS EVENTOS
// ═══════════════════════════════════════════════════════════════════════════

const eventoBase: Partial<SphereConteudo> = { ganho: GANHO_EVENTO, cor: COR_DADO }

/**
 * EVENTO 1, COMPRA OU ENVIO PARA A CARTEIRA DA CIDADE.
 *
 * ⚠️ ESTE É O EVENTO MAIS IMPORTANTE DO PONTO DE VISTA DE PRODUTO, e o requisito
 * do fundador é literal: *quem acabou de comprar vê a cidade inteira reagir à
 * compra dele*. Então o que a peça mostra não é "uma doação chegou": é o VALOR
 * dela e a CAUDA DO ENDEREÇO de quem mandou, que é a parte que a pessoa
 * reconhece porque é a que a carteira dela mostra no truncado. De 400 m ela lê
 * os próprios seis caracteres num painel de 196 m.
 *
 * ⚠️ E O VALOR É LÍQUIDO, TROCO DESCONTADO. `donationDog()` soma só o que foi
 * PARA o endereço da cidade. O bruto é a confusão que o fundador apontou em
 * 24/08: uma doação de 10 mil saiu de um UTXO de 600 mil, e quem lê o bruto lê
 * uma doação sessenta vezes maior.
 *
 * ⚠️ O EVENTO TEM DOIS ATOS, PORQUE A CADEIA TEM DOIS ATOS. A chegada (a
 * transação entra na mempool, e é aí que a pessoa está olhando) e a confirmação
 * (ela pousa num bloco). Os dois já vêm de graça do feed, pelo `onEnter` e pelo
 * `onLand`, e anunciar só o segundo perderia justamente o instante em que ela
 * está com a carteira na mão.
 */
function eventoDoacaoChegou(tx: DogTx): Slot | null {
  const dog = donationDog(tx)
  if (!(dog > 0)) return null
  const q = [quadro(fmtDog(dog), ROTULOS.doacao, MS_EVENTO_QUADRO + 4_000, eventoBase)]
  const de = tx.senders?.[0]
  if (de) q.push(quadro(fmtCauda(de), ROTULOS.doadorDe, MS_EVENTO_QUADRO + 2_000, eventoBase))
  return { classe: 'evento', nome: 'doacao', quadros: q }
}

function eventoDoacaoConfirmou(tx: DogTx): Slot | null {
  if (tx.block_height == null) return null
  return {
    classe: 'evento',
    nome: 'doacao-ok',
    quadros: [
      quadro(String(tx.block_height), ROTULOS.doacaoOk, MS_EVENTO_QUADRO, eventoBase),
    ],
  }
}

/**
 * EVENTO 2, BLOCO DE BITCOIN MINERADO, COM O DOG QUE ENTROU NELE.
 *
 * ⚠️ O PEDIDO DO FUNDADOR FOI ESPECÍFICO: "avisa bloco BTC minerado com X tx de
 * dog com volume de x dog". Bloco cru é informação de explorador; bloco com o
 * DOG dentro é informação que só quem indexa tem, e é a diferença entre a
 * Sphere ser um telão e ser o telão DESTA cidade.
 *
 * ⚠️ E ESSA AGREGAÇÃO NÃO CUSTA CONSULTA NENHUMA. O watcher da casa
 * (`scripts/dog_mempool_watcher.py:692`) já agrega por bloco e publica
 * `last_dog_block`, `last_dog_block_count` e `last_dog_block_amount` no mesmo
 * payload do feed. O valor já é LÍQUIDO: a soma passa por `liquido()`, que
 * desconta troco pela mesma regra de `lib/dog/net-transfer.ts`.
 *
 * ⚠️ BLOCO SEM DOG TAMBÉM É NOTÍCIA, e a leitura é derivável sem consulta
 * nenhuma: se a ponta andou para H e `last_dog_block` não é H, então o bloco H
 * não teve transação de DOG. O painel diz `0`, que é verdade, em vez de fingir
 * que o bloco não aconteceu.
 */
function eventoBloco(s: Snapshot, altura: number): Slot {
  const temDog = s.last_dog_block === altura
  const n = temDog ? Number(s.last_dog_block_count ?? 0) : 0
  const q: Quadro[] = [
    // ⚠️ SEM O `#`, E ISSO É CONSERTO DE NÚMERO ERRADO, não de gosto. `quadro()`
    // faz `slice(0, ORC_GRANDE)` em silêncio: com ORC_GRANDE = 7, o bloco
    // 1.000.000 virava `#100000`, ou seja um número errado por 10x publicado em
    // 401 m de altura. Sem o `#` cabem 7 dígitos até o bloco 9.999.999, e o
    // rótulo já diz que é bloco. Ganho medido de quebra: o texto cai de 7 para 6
    // caracteres e a leitura a 1 km sobe de 18% para 36% dos azimutes.
    quadro(String(altura), ROTULOS.bloco, MS_EVENTO_QUADRO, eventoBase),
    quadro(String(n), ROTULOS.blocoTx, MS_EVENTO_QUADRO, eventoBase),
  ]
  const vol = temDog ? Number(s.last_dog_block_amount ?? 0) : 0
  if (n > 0 && vol > 0) {
    q.push(quadro(fmtDog(vol), ROTULOS.blocoVol, MS_EVENTO_QUADRO, eventoBase))
  }
  return { classe: 'evento', nome: 'bloco', quadros: q }
}

/**
 * EVENTO 3, MINT DE TERRENO.
 *
 * ⚠️ ELE AINDA NÃO ACONTECE, E NASCE PRONTO DE PROPÓSITO. O mint abre depois do
 * snapshot do bloco 966.670, e o dia de maior movimento da cidade é o pior dia
 * possível para descobrir que o telão não tem gancho para o produto acontecendo.
 * Quem for ligar o mint chama `mint()` no controlador e não toca em mais nada:
 * o escalonador, a fila, o teto de propaganda e o dissolve já valem para ele.
 *
 * ⚠️ E ELE RESPEITA A REGRA DE QUE NÃO EXISTE NÚMERO DE LOTE ANTES DO SNAPSHOT
 * (`feedback_sem_numero_antes_do_snapshot`): quem chama passa o que MINTOU, que
 * é um fato consumado, não uma projeção de quantos lotes existem.
 */
export interface MintAnuncio {
  /** quantos lotes foram mintados nesta transação */
  lotes: number
  /** endereço do dono, opcional: a cauda dele é o que vai à tela */
  endereco?: string
}

function eventoMint(m: MintAnuncio): Slot | null {
  if (!(m.lotes > 0)) return null
  const q = [quadro(String(m.lotes), ROTULOS.mintLotes, MS_EVENTO_QUADRO + 4_000, eventoBase)]
  if (m.endereco) {
    q.push(quadro(fmtCauda(m.endereco), ROTULOS.mintDono, MS_EVENTO_QUADRO + 2_000, eventoBase))
  }
  return { classe: 'evento', nome: 'mint', quadros: q }
}

// ═══════════════════════════════════════════════════════════════════════════
// 11. O CONTROLADOR
// ═══════════════════════════════════════════════════════════════════════════

export interface ProgramacaoOpts {
  /** repinta a textura. É `sphere.pintar`, e pode ser nulo enquanto a peça carrega. */
  pintar: (c: SphereConteudo) => void
  /**
   * só o ganho, sem repintar. É `sphere.ganhar`, e é o que faz o dissolve custar
   * uma escrita de uniforme em vez de um envio de 8 MB.
   */
  ganhar: (g: number) => void
  /**
   * um gesto de casca inteira. É `sphere.fx`, e é opcional porque o programa
   * nasce antes da peça. Ver `SPHERE_FX_MS` em sphere.ts.
   */
  fx?: (tipo: 'varredura' | 'radial' | 'cortina', peso?: number, aoCobrir?: () => void) => void
  /**
   * um swell de brilho no anel, para o evento atravessar a distância. É
   * `sphere.pulsar`, e é opcional porque o programa nasce antes da peça.
   *
   * ⚠️ ELE EXISTE PORQUE TEXTO MORRE E BRILHO NÃO. `#965501` / `BITCOIN BLOCK`
   * desvanece no `textCull` (600 a 1.700 m conforme o perfil); da praça central,
   * a 5.175 m, a esfera é um disco de 56 px e a faixa mede 8,6 px dele. O quadro
   * do evento não chega ali, mas o anel subindo 1,85x por três segundos chega.
   * Custa um uniforme, não um shader: ver `SPHERE_PULSO_*` em `sphere.ts`.
   */
  pulsar?: (intensidade?: number) => void
  /** para teste offline: substitui o `fetch` do navegador */
  buscar?: typeof fetch
  /** para teste offline: substitui `Date.now` */
  agora?: () => number
}

export interface ProgramacaoSphere {
  /** ligar no `onSnapshot` do feed. Alimenta PULSO, SNAPSHOT e o evento de bloco. */
  snapshot(s: Snapshot | null, staleSeconds: number | null): void
  /** ligar no `onEnter` e no `onLand` do feed. Só o que toca a carteira vira evento. */
  transacao(tx: DogTx, fase: 'entrou' | 'pousou'): void
  /** o gancho do mint, pronto e sem chamador */
  mint(m: MintAnuncio): void
  /** força o quadro corrente na peça (a esfera nasce depois do programa) */
  repintar(): void
  /** o livro-caixa do tempo de tela, que é onde o teto de propaganda se prova */
  contabilidade(): { msDado: number; msAnuncio: number; fracao: number }
  /** só para medir: entra num slot pelo nome, sem esperar a vez dele no anel */
  forcar(nome: string): boolean
  parar(): void
}

export function criarProgramacao(o: ProgramacaoOpts): ProgramacaoSphere {
  const agora = o.agora ?? (() => Date.now())
  const buscar = o.buscar ?? ((...a: Parameters<typeof fetch>) => fetch(...a))

  // ── as fontes ────────────────────────────────────────────────────────────
  let fPreco: FontePreco | null = null
  let fVolume: FonteVolume | null = null
  let fPulso: FontePulso | null = null
  let fCadeia: FonteCadeia | null = null
  const ultimaTentativa = new Map<string, number>()

  // ── o estado do escalonador ──────────────────────────────────────────────
  // ⚠️ AS DUAS MARCAS ENTRAM ENTRE OS MÓDULOS DE DADO, e a posição é escolhida:
  // uma no meio e outra no fim, para a casca inteira acender duas vezes por volta
  // do anel em vez de duas seguidas. Com sete posições de 48 s, a esfera muda de
  // cor por completo a cada ~2,8 min.
  const ANEL = ['preco', 'marca-btc', 'volume', 'marca-mascote', 'pulso', 'marca-dog', 'snapshot', 'anuncio'] as const

  /**
   * ⚠️ A TRAVA DE CONFERÊNCIA, E ELA EXISTE PORQUE A PEÇA NÃO ERA CONFERÍVEL. Uma
   * volta do anel leva 408 s: quem abre a cidade para julgar uma carta vê a que
   * estiver passando, e para ver a Kray (posição 8) espera até 5,6 min. Foi assim
   * que quatro defeitos de carta chegaram ao fundador em vez de a uma chapa, que
   * é a inversão exata do que o portão de `scripts/city/chapas.mjs` existe para
   * impedir.
   *
   *   ?pele=marca-btc          trava o anel nessa carta, indefinidamente
   *   ?pele=anuncio&quadro=0    trava também o quadro, para a chapa não depender
   *                             de acertar a janela de 24 s de cada quadro
   *   ?pele=marca-dog&eventos=0 recusa também os eventos
   *
   * Nomes válidos: os do `ANEL`.
   *
   * ⚠️ `eventos=0` NASCEU DE UMA CHAPA PERDIDA, em 09/09. A trava de pele não
   * desligava evento, de propósito, porque a peça em conferência tem de continuar
   * sendo a peça que vai ao ar. Só que uma carga da cena leva cerca de 7 min e um
   * bloco de Bitcoin chega a cada 10: a chapa da carta `$DOG CITY` saiu com
   * `BTC BLOCK` na tela, porque o evento entrou entre a carga e a captura. Numa
   * peça em que conferir custa 7 minutos de GPU, deixar o resultado no relógio da
   * chain é perder a chapa uma vez a cada três.
   *
   * ⚠️ E ELE É SÓ PARA CONFERÊNCIA. Em produção a trava inteira fica fora: sem
   * `?pele=` nada disto existe, e o evento continua tendo precedência sobre o
   * anel, que é o coração da peça.
   */
  const busca = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : null
  const TRAVA = busca?.get('pele') ?? null
  const TRAVA_QUADRO = busca?.get('quadro') != null ? Number(busca.get('quadro')) : null
  const SEM_EVENTO = TRAVA != null && busca?.get('eventos') === '0'
  if (TRAVA && !ANEL.includes(TRAVA as typeof ANEL[number])) {
    console.warn(`[sphere] ?pele=${TRAVA} não é carta do anel; ignorado. Válidos: ${ANEL.join(', ')}`)
  }

  // ⚠️ A ARTE É PEDIDA AGORA, NÃO NA VEZ DELA, e este é o conserto de um defeito
  // que foi ao ar em 09/09: `arte()` disparava o download no instante em que o
  // slot entrava, e naquele instante devolvia nulo. Com MS_MODULO de 48 s, uma
  // volta do anel leva 408 s, então a PRIMEIRA aparição de cada carta com imagem
  // saía errada e a segunda chance vinha quase sete minutos depois: o mascote era
  // pulado por `slotMascote` e a Kray ia ao ar com o casco preto e vazio, que é
  // pior, porque anúncio é inventário vendido. Medido em produção com sonda de
  // rede: em 75 s de página aberta nenhuma das duas PNG chegou a ser pedida.
  // 280 KB somados, prioridade baixa, e quando a vez chega elas já estão prontas.
  for (const u of ['/city/btc-marca.png', '/city/dog-mascote.png', '/city/kray-marca.png']) arte(u)
  let iAnel = 0
  let slot: Slot = { classe: 'dado', nome: 'ocioso', quadros: [quadroOcioso()] }
  let iQuadro = 0
  let fimQuadro = 0
  const fila: Slot[] = []
  let parado = false
  let pausado = false

  // ── o livro-caixa do teto de propaganda ──────────────────────────────────
  let msDado = 0
  let msAnuncio = 0
  let inicioSlot = agora()
  /** quando um módulo de DADO entrou pela última vez; ver `podeAnunciar` */
  let ultimoDadoValido = -Infinity

  // ── o dissolve ───────────────────────────────────────────────────────────
  let fadeT0 = 0
  let fadeDe = GANHO_OCIOSO
  let fadePara = GANHO_OCIOSO
  let fadeDur = 0
  let pendente: Quadro | null = null
  let ganhoAtual = GANHO_OCIOSO
  /** a pele que está na textura AGORA, para saber quando a troca é de casca */
  let peleAtual: string | null = null
  /** quantas tx de DOG o último bloco trouxe, para o peso do gesto */
  let ultimoBlocoTx = 0

  const suave = (t: number) => t * t * (3 - 2 * t)

  /**
   * ⚠️ O DISSOLVE É POR TEMPO DECORRIDO, NUNCA POR CONTAGEM DE PASSOS. Numa aba
   * de fundo o navegador estrangula `setTimeout` para 1 Hz; com passos fixos a
   * esfera ficaria PARADA NO ESCURO por dezenas de segundos até a contagem
   * fechar. Lendo o relógio, o primeiro despertar já encontra o fade vencido e
   * fecha nele.
   */
  const tickFade = (t: number) => {
    if (!fadeDur) return
    const k = Math.min(1, (t - fadeT0) / fadeDur)
    ganhoAtual = fadeDe + (fadePara - fadeDe) * suave(k)
    o.ganhar(ganhoAtual)
    if (k < 1) return
    fadeDur = 0
    if (pendente) {
      // ⚠️ TROCA DE PELE VAI SOB A CORTINA; troca de NÚMERO continua no vale.
      // O dissolve por ganho resolve bem a troca de um valor na faixa, que é uma
      // mudança pequena. Trocar a CASCA INTEIRA por ele é outra coisa: o ganho
      // cai ao vale e a esfera apaga por 7 ms com a pele antiga ainda na
      // textura. A cortina cobre a peça, a repintura acontece coberta, e a
      // cobertura desce já com a pele nova. Ver `SPHERE_FX_MS.cortina`.
      const q = pendente
      // ⚠️ POR FAMÍLIA, NÃO POR REFERÊNCIA DE FUNÇÃO. Ver `SphereConteudo.peleId`:
      // o tipo gigante gera uma função por valor, e comparar referência faria a
      // cortina cobrir a peça a cada troca de dígito.
      const trocaDePele = (q.c.peleId ?? null) !== (peleAtual ?? null)
      const alvo = q.c.ganho ?? GANHO_OCIOSO
      pendente = null
      if (trocaDePele && o.fx) {
        peleAtual = q.c.peleId ?? null
        o.fx('cortina', 1, () => o.pintar(q.c))
      } else {
        // a troca de textura mora no fundo do vale: os ~7 ms de repaint caem onde
        // o olho tem menos a que se agarrar
        o.pintar(q.c)
      }
      fadeT0 = t; fadeDe = ganhoAtual; fadePara = alvo; fadeDur = MS_ENTRA
    }
  }

  const trocarPara = (q: Quadro, t: number) => {
    pendente = q
    fadeT0 = t; fadeDe = ganhoAtual; fadePara = GANHO_VALE; fadeDur = MS_SAI
  }

  // ── contabilidade ────────────────────────────────────────────────────────
  const fecharConta = (t: number) => {
    const dt = Math.max(0, t - inicioSlot)
    if (slot.classe === 'anuncio') msAnuncio += dt
    else msDado += dt
    inicioSlot = t
  }

  /**
   * ⚠️ AQUI MORA O TETO DURO. A conta é projetiva, não retrospectiva: pergunta
   * como ficaria a fatia DEPOIS de rodar o intervalo inteiro. Recusar depois de
   * já ter passado do teto seria fechar a porteira com o boi na rua.
   *
   * Com o ciclo nominal (192 s de dado para 72 s de anúncio) a projeção fica em
   * 27,27% e este teste nunca dispara. Ele dispara no dia em que alguém mexer no
   * ritmo, que é exatamente o dia para o qual ele existe.
   */
  const podeAnunciar = (t: number) => {
    // ⚠️ SEM DADO NÃO EXISTE INTERVALO, e esta regra não é generosidade: o
    // parceiro compra o intervalo DE UMA PEÇA QUE SE OLHA, e o que faz olharem é
    // o dado. Sem isto, medido em 30 min com tudo fora do ar, a esfera virava um
    // painel que alternava a marca do parceiro com o próprio nome, 28,6% de
    // propaganda sobre 0% de dado. Uma peça calada é melhor do que um outdoor.
    if (t - ultimoDadoValido > MS_MODULO * 2) return false
    const total = msDado + msAnuncio + MS_ANUNCIO
    return total > 0 && (msAnuncio + MS_ANUNCIO) / total <= TETO_ANUNCIO
  }

  // ── as buscas, sob demanda ───────────────────────────────────────────────
  const podeTentar = (chave: string, t: number) =>
    t - (ultimaTentativa.get(chave) ?? -Infinity) >= MS_RETENTA

  const pegar = async (url: string): Promise<any | null> => {
    const ctrl = new AbortController()
    const relogio = setTimeout(() => ctrl.abort(), MS_FETCH)
    try {
      const r = await buscar(url, { cache: 'no-store', signal: ctrl.signal })
      if (!r.ok) return null
      return await r.json()
    } catch {
      return null
    } finally {
      clearTimeout(relogio)
    }
  }

  const buscarPreco = async (t: number) => {
    if (!podeTentar('preco', t)) return
    ultimaTentativa.set('preco', t)
    const j = await pegar('/api/price/kraken')
    const p = Number(j?.price_usd)
    if (!Number.isFinite(p) || p <= 0) return
    const v = j?.change_24h_pct
    fPreco = { preco: p, variacao: v == null ? null : Number(v), em: agora() }
  }

  const buscarVolume = async (t: number) => {
    if (!podeTentar('volume', t)) return
    ultimaTentativa.set('volume', t)
    const j = await pegar('/api/war/ticker')
    if (!j || j.error) return
    const n = (x: unknown) => (Number.isFinite(Number(x)) && Number(x) > 0 ? Number(x) : null)
    const vol = n(j.volume24), alta = n(j.high24), baixa = n(j.low24)
    if (vol === null && alta === null && baixa === null) return
    fVolume = { volume24: vol, alta24: alta, baixa24: baixa, em: agora() }
  }

  /** dispara a busca do que vai entrar, 8 s antes da vez dele */
  const prefetch = (proximo: string, t: number) => {
    if (proximo === 'preco') void buscarPreco(t)
    else if (proximo === 'volume') void buscarVolume(t)
  }

  // ── o anel ───────────────────────────────────────────────────────────────
  const montar = (nome: string, t: number): Slot | null => {
    if (nome === 'anuncio') return podeAnunciar(t) ? slotAnuncio() : null
    // ⚠️ AS MARCAS NÃO DEPENDEM DE FONTE VIVA, e por isso não podem devolver
    // `null`: elas são identidade, não dado. É o único módulo do anel que nunca
    // some, e é justamente o que garante que a peça tenha o que mostrar mesmo com
    // a rede inteira fora do ar.
    if (nome === 'marca-btc') return slotBitcoin(fCadeia?.tip ?? null)
    if (nome === 'marca-dog') return slotDog()
    if (nome === 'marca-mascote') return slotMascote()
    const q =
      nome === 'preco' ? moduloPreco(fPreco, t)
      : nome === 'volume' ? moduloVolume(fVolume, t)
      : nome === 'pulso' ? moduloPulso(fPulso, t)
      : moduloSnapshot(fCadeia, t)
    if (!q) return null
    ultimoDadoValido = t
    return { classe: 'dado', nome, quadros: q }
  }

  const proximoSlot = (t: number): Slot => {
    // evento tem precedência sobre o anel, sempre
    // ⚠️ COM `eventos=0` A FILA É DESCARTADA, não represada: guardá-la faria os
    // eventos entrarem todos juntos no fim da conferência.
    if (SEM_EVENTO) fila.length = 0
    const ev = fila.shift()
    if (ev) return ev
    // ⚠️ A TRAVA VEM ANTES DO ANEL, e ela não tem plano B: se a carta travada não
    // monta (fonte fora do ar, arte que não chegou), a peça vai para o neutro em
    // vez de girar para a próxima. Girar esconderia justamente o que se foi
    // conferir, que é o defeito que a trava existe para não repetir.
    if (TRAVA) {
      return montar(TRAVA, t) ?? { classe: 'dado', nome: 'ocioso', quadros: [quadroOcioso()] }
    }
    // e o anel gira até achar um módulo com dado válido; se nenhum tiver,
    // a peça cai no neutro em vez de mentir
    for (let k = 0; k < ANEL.length; k++) {
      const nome = ANEL[iAnel % ANEL.length]
      iAnel++
      const s = montar(nome, t)
      if (s) return s
    }
    return { classe: 'dado', nome: 'ocioso', quadros: [quadroOcioso()] }
  }

  /**
   * ⚠️ O PESO DO EVENTO, e ele existe para o gesto não virar rotina. Bloco sem
   * DOG dentro é notícia menor e sai em 0,45; a mediana da janela de 144 amostras
   * (um dia de blocos) sai em 1,0; acima do percentil 90 sai em 1,6. Zero chamada
   * de rede nova: `last_dog_block_count` já vem no mesmo payload do feed.
   */
  const historicoTx: number[] = []
  const pesoDoEvento = (s: Slot): number => {
    if (s.nome !== 'bloco') return 1
    const n = ultimoBlocoTx
    historicoTx.push(n)
    if (historicoTx.length > 144) historicoTx.shift()
    if (n <= 0) return 0.45
    const ord = [...historicoTx].sort((a, b) => a - b)
    const p90 = ord[Math.min(ord.length - 1, Math.floor(ord.length * 0.9))]
    return n >= p90 && ord.length >= 8 ? 1.6 : 1
  }

  const entrarNo = (s: Slot, t: number) => {
    fecharConta(t)
    slot = s
    // ⚠️ COM `?quadro=` O QUADRO NÃO ANDA, e `Infinity` é o que segura: o tick só
    // avança quando `t >= fimQuadro`. Assim a chapa não precisa acertar a janela
    // de 24 s de cada quadro, que é onde uma conferência visual vira sorteio.
    iQuadro = TRAVA_QUADRO != null
      ? Math.max(0, Math.min(TRAVA_QUADRO, s.quadros.length - 1))
      : 0
    fimQuadro = TRAVA_QUADRO != null ? Infinity : t + s.quadros[iQuadro].ms
    // ⚠️ UM PULSO POR EVENTO, NA ENTRADA DO SLOT, e só para evento. O intervalo
    // comercial já sobe para ganho 0,90 o tempo todo e não precisa de swell; o
    // módulo de dado é o estado sóbrio por definição. Pulsar em tudo seria
    // exatamente a bola de discoteca que o dossiê proíbe.
    if (s.classe === 'evento') {
      // ⚠️ O PESO SAI DO DADO, E CRAVAR 1 ERA O DEFEITO. Com 144 blocos por dia
      // todos idênticos, o gesto mais RARO da peça virava o mais repetido, e a
      // raridade é justamente o que o faz funcionar. `pulsar` já aceitava o
      // argumento e ninguém passava.
      o.pulsar?.(pesoDoEvento(s))
      // ⚠️ E CADA CLASSE DE EVENTO TEM O SEU GESTO, para o espectador aprender a
      // ler a peça sem legenda. Bloco de Bitcoin varre de polo a polo, porque ele
      // é da CADEIA e vem de fora. O que toca a carteira da cidade (doação, tx,
      // mint) sai em anel a partir de quem olha, porque ele é DAQUI.
      if (s.nome === 'bloco') o.fx?.('varredura', pesoDoEvento(s))
      else o.fx?.('radial', pesoDoEvento(s))
    }
    trocarPara(s.quadros[iQuadro], t)
  }

  /**
   * ⚠️ O EVENTO INTERROMPE, MAS NÃO CONFISCA O TEMPO DO PARCEIRO. Quando um
   * evento chega no meio do intervalo comercial, o que sobrava do intervalo é
   * devolvido para a fila e roda logo depois. O livro-caixa conta o tempo
   * EXIBIDO, então nem o parceiro perde o que comprou nem a casa paga duas
   * vezes pelo mesmo slot.
   */
  const empilhar = (s: Slot | null, t: number) => {
    if (!s || parado || SEM_EVENTO) return
    fila.push(s)
    if (slot.classe === 'evento') return
    if (slot.classe === 'anuncio') {
      const resto = Math.max(0, fimQuadro - t)
      const sobra = slot.quadros.slice(iQuadro + 1)
      if (resto > QUADRO_MIN / 2 || sobra.length) {
        const q = slot.quadros[iQuadro]
        fila.push({
          classe: 'anuncio',
          nome: slot.nome,
          quadros: [{ c: q.c, ms: Math.max(QUADRO_MIN, resto) }, ...sobra],
        })
      }
    }
    entrarNo(fila.shift()!, t)
  }

  // ── o relógio do programa ────────────────────────────────────────────────
  let relogio: ReturnType<typeof setTimeout> | null = null

  const tick = () => {
    if (parado) return
    const t = agora()
    if (!pausado) {
      tickFade(t)
      if (!fadeDur && !pendente && t >= fimQuadro) {
        if (iQuadro + 1 < slot.quadros.length) {
          iQuadro++
          fimQuadro = t + slot.quadros[iQuadro].ms
          trocarPara(slot.quadros[iQuadro], t)
        } else {
          entrarNo(proximoSlot(t), t)
        }
      }
      // a busca do que vem a seguir, uma janela antes da vez
      if (!fila.length && slot.classe !== 'evento' && t >= fimQuadro - MS_PREFETCH) {
        prefetch(ANEL[iAnel % ANEL.length], t)
      }
    }
    relogio = setTimeout(tick, MS_TICK)
  }

  /**
   * ⚠️ ABA ESCONDIDA PAUSA O PROGRAMA INTEIRO. Ninguém está vendo: não há razão
   * para repintar 8 MB nem para pedir preço. Ao voltar, o quadro corrente vence
   * na hora, então a peça não fica exibindo um preço de vinte minutos atrás
   * enquanto espera a vez dele acabar.
   */
  const aoTrocarVisibilidade = () => {
    const escondido = typeof document !== 'undefined' && document.hidden
    if (escondido === pausado) return
    pausado = escondido
    if (!pausado) {
      const t = agora()
      inicioSlot = t
      fimQuadro = t
      ultimaTentativa.clear()
    }
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', aoTrocarVisibilidade)
  }

  // arranca no neutro e já pede o preço: o anel começa por ele
  o.pintar(slot.quadros[0].c)
  o.ganhar(GANHO_OCIOSO)
  fimQuadro = agora() + QUADRO_MIN
  void buscarPreco(agora())
  relogio = setTimeout(tick, MS_TICK)

  // ── a memória de quem já foi anunciado ───────────────────────────────────
  // Doação é rara, mas o mapa é podado assim mesmo: uma aba aberta por dias não
  // pode virar um vazamento de txid.
  const anunciadas = new Map<string, number>()
  const podar = (t: number) => {
    for (const [k, v] of Array.from(anunciadas.entries())) {
      if (t - v > 7_200_000) anunciadas.delete(k)
    }
  }

  let tipVisto: number | null = null
  let primeiroSnapshot = true

  return {
    snapshot(s, staleSeconds) {
      if (parado || !s) return
      const t = agora()
      // ⚠️ A IDADE É A PIOR DAS DUAS. `stale_seconds` mede o atraso do watcher
      // e o nosso relógio mede o atraso da resposta; um feed que responde rápido
      // com dado velho é tão inútil quanto um que não responde.
      const atraso = Math.max(0, (staleSeconds ?? 0) * 1000)
      const em = t - atraso

      if (typeof s.tip_height === 'number') fCadeia = { tip: s.tip_height, em }
      fPulso = {
        pendentes: Number(s.dog_pending ?? 0),
        emVoo: Number(s.dog_pending_amount ?? 0),
        taxaRapida: s.fee_fast ?? null,
        em,
      }

      // ⚠️ O EVENTO DE BLOCO DISPARA UMA VEZ POR PONTA NOVA, E NUNCA NA
      // PRIMEIRA RESPOSTA. Anunciar na primeira seria anunciar um bloco minerado
      // antes de a pessoa chegar. E se o feed voltar de uma queda com a ponta 20
      // blocos à frente, sai UM anúncio, o do bloco corrente: a peça noticia o
      // presente, não faz a chamada dos ausentes.
      const tip = typeof s.tip_height === 'number' ? s.tip_height : null
      if (tip !== null && !primeiroSnapshot && tipVisto !== null && tip > tipVisto) {
        // o peso do gesto sai daqui: quantas tx de DOG este bloco trouxe
        ultimoBlocoTx = s.last_dog_block === tip ? Number(s.last_dog_block_count ?? 0) : 0
        empilhar(eventoBloco(s, tip), t)
      }
      if (tip !== null) tipVisto = tip
      primeiroSnapshot = false
    },

    transacao(tx, fase) {
      if (parado || !isDonation(tx)) return
      const t = agora()
      podar(t)
      const visto = anunciadas.get(tx.txid)
      if (fase === 'entrou') {
        if (visto) return
        anunciadas.set(tx.txid, t)
        empilhar(eventoDoacaoChegou(tx), t)
        return
      }
      // pousou: se nunca a vimos em órbita, ela chegou direto no bloco e merece
      // o anúncio inteiro; se já anunciamos a chegada, sai só a confirmação
      if (!visto) {
        anunciadas.set(tx.txid, t)
        empilhar(eventoDoacaoChegou(tx), t)
        return
      }
      if (visto < 0) return
      anunciadas.set(tx.txid, -t)   // negativo: já confirmada, não repete
      empilhar(eventoDoacaoConfirmou(tx), t)
    },

    mint(m) {
      if (parado) return
      empilhar(eventoMint(m), agora())
    },

    repintar() {
      if (parado) return
      const q = slot.quadros[Math.min(iQuadro, slot.quadros.length - 1)]
      o.pintar(q.c)
      o.ganhar(ganhoAtual)
    },

    /**
     * ⚠️ ISTO É INSTRUMENTO, NÃO PROGRAMA, e existe porque não dava para VER o que
     * se muda aqui. Uma volta do anel leva 408 s, então a chapa não pode esperar a
     * vez de uma pele: eu subi QUATRO versões do glifo do ₿ sem nunca ter visto
     * nenhuma, e o fundador reclamou as quatro. `?stats=1` expõe isto como
     * `__plazaPele(nome)`, e o portão de chapas usa para enquadrar a pele que
     * interessa. Não mexe na fila de evento; entra no slot e pronto.
     */
    forcar(nome) {
      const t = agora()
      const s = montar(nome, t)
      if (s) entrarNo(s, t)
      return !!s
    },

    contabilidade() {
      const total = msDado + msAnuncio
      return { msDado, msAnuncio, fracao: total > 0 ? msAnuncio / total : 0 }
    },

    parar() {
      parado = true
      if (relogio) clearTimeout(relogio)
      relogio = null
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', aoTrocarVisibilidade)
      }
    },
  }
}
