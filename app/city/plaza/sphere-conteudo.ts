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
import { isDonation, donationDog, type DogTx, type Snapshot } from './feed'
import { SNAPSHOT } from '../../dogcity/dogcity-data'

// ═══════════════════════════════════════════════════════════════════════════
// 1. O ORÇAMENTO DE ESCRITA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ ESTES DOIS NÚMEROS MANDAM EM TODA A COPY DESTE ARQUIVO, e eles são
 * medição, não gosto: `sphere.ts` mediu que o arco legível de um azimute só é
 * **94° a 300 m**, ou seja **8,4 das 32 casas grandes e 16,8 das 64 pequenas**.
 * Como o texto é distribuído em cópias inteiras na volta
 * (`floor(nChars/(len+1))`) e cada cópia ocupa um período de `nChars/cópias`, a
 * regra que garante UMA cópia inteira é `janela ≥ período`: 7 caracteres na
 * linha grande (4 cópias, 8 casas de período) e 15 na pequena.
 *
 * ⚠️ A GARANTIA VALE DE 300 m PARA FORA, e isso é declarado, não esquecido: com
 * a esfera de 160 m, a 200 m se enxerga só 7,2 casas grandes e o mesmo texto de
 * 7 pode chegar cortado de um lado. A alternativa era um orçamento de 5 casas,
 * que obriga o preço a dois algarismos significativos e congela o painel. A
 * conta inteira está em `SPHERE_ORCAMENTO_*`.
 *
 * Consequência de projeto, e ela é dura: **preço cabe, frase não cabe**. É por
 * isso que este arquivo escreve em QUADROS (valor + rótulo, um de cada vez) em
 * vez de escrever sentenças. Um módulo de dado não é uma frase quebrada em
 * pedaços; é uma sequência de leituras, cada uma completa em si.
 */
export const ORC_GRANDE = 7
export const ORC_PEQUENA = 15

/**
 * Todo rótulo estático deste arquivo passa por aqui, e o comprimento medido vai
 * ao lado. Conferido offline com `npx tsx`: o maior é `DOG TX IN BLOCK`, com
 * 15 caracteres exatos, encostado no teto e não por acaso (é o rótulo do evento
 * que o fundador pediu por escrito).
 */
export const ROTULOS = {
  precoSpot: '$DOG USD SPOT',      // 13
  precoVar: '24H CHANGE',          // 10
  volume: '24H VOLUME DOG',        // 14
  alta: '24H HIGH USD',            // 12
  baixa: '24H LOW USD',            // 11
  pendentes: 'DOG IN MEMPOOL',     // 14
  emVoo: 'DOG IN FLIGHT',          // 13
  taxa: 'FEE SATS/VB',             // 11
  blocosFaltam: 'BLOCKS TO GO',    // 12
  blocoAlvo: 'SNAPSHOT BLOCK',     // 14
  estimativa: 'ESTIMATE ONLY',     // 13
  snapshotFeito: 'SNAPSHOT TAKEN', // 14
  blocosDesde: 'BLOCKS SINCE',     // 12
  doacao: 'DOG TO DOGCITY',        // 14
  doadorDe: 'FROM WALLET',         // 11
  doacaoOk: 'TX CONFIRMED',        // 12
  bloco: 'BITCOIN BLOCK',          // 13
  blocoTx: 'DOG TX IN BLOCK',      // 15  ← o teto, e é o rótulo pedido
  blocoVol: 'DOG MOVED',           // 9
  mintLotes: 'PLOTS MINTED',       // 12
  mintDono: 'NEW LANDOWNER',       // 13
  krayNome: 'KRAY WALLET',         // 11
  krayCustodia: 'SELF CUSTODY',    // 12
  krayTorre: 'SATOSHI PLAZA',      // 13
  ocioso: 'THE SPHERE',            // 10
} as const

/** Quem estourou o orçamento. Vazio é o esperado; serve para medir offline. */
export function orcamentoViolado(): string[] {
  return Object.entries(ROTULOS)
    .filter(([, v]) => v.length > ORC_PEQUENA)
    .map(([k, v]) => `${k}=${v.length}`)
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
export const GANHO_OCIOSO = 0.42
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
 * ⚠️ UMA PEÇA DE 135 m MOSTRANDO DADO ERRADO COM CONFIANÇA É PIOR DO QUE UMA
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
 * ⚠️ O PREÇO DO DOG NÃO CABE EM 7 CASAS SEM UMA DECISÃO, e a decisão está
 * medida. Com o preço na ordem de US$ 0,0004:
 *
 *     `0.00042`   7 casas, 2 algarismos significativos, granularidade **2,4%**
 *     `.000421`   7 casas, 3 algarismos significativos, granularidade **0,24%**
 *
 * A primeira forma deixaria o telão da cidade com um número CONGELADO: o preço
 * teria de andar 2,4% para o painel mudar de dígito, e isso acontece algumas
 * vezes por dia. A segunda respira. O zero à esquerda é o que se paga por isso,
 * e ele é o dígito que menos informa numa linha rotulada `$DOG USD SPOT`.
 *
 * Então a regra é: a maior precisão que couber em 7 casas, preferindo manter o
 * zero à esquerda, e sacrificando o zero SÓ quando ele compra um algarismo.
 */
export function fmtPreco(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return ''
  for (let d = 8; d >= 0; d--) {
    const com = v.toFixed(d)
    if (com.length <= ORC_GRANDE) return aparar(com)
    const sem = com.startsWith('0.') ? com.slice(1) : com
    if (sem.length <= ORC_GRANDE) return aparar(sem)
  }
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

const quadro = (
  grande: string,
  pequena: string,
  ms: number,
  extra: Partial<SphereConteudo> = {},
): Quadro => ({
  ms,
  c: {
    grande: grande.slice(0, ORC_GRANDE),
    pequena: pequena.slice(0, ORC_PEQUENA),
    ganho: GANHO_OCIOSO,
    ...extra,
  },
})

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
  const L = h / 1024   // pixels de canvas por linha de LED da grade de 1.024

  // o casco: preto de verdade, para o branco ter contra o que brilhar
  g.fillStyle = '#07080A'
  g.fillRect(0, 0, w, h)

  // ⚠️ A COROA ACENDE NO POLO, e o polo é o único lugar onde isso pode ser
  // feito: `sphere.ts` mediu que letra ali é ilegível por escorço, então polo é
  // SÓ COR. Esta calota vai da linha 0 à 120, ou seja da latitude 90° à 68,9°,
  // que são (1 - sen 68,9°)/2 = **3,3% da área da esfera**. É um chapéu, não uma
  // bola branca.
  const coroa = g.createLinearGradient(0, 0, 0, 120 * L)
  coroa.addColorStop(0.0, 'rgba(242,244,247,0.95)')
  coroa.addColorStop(1.0, 'rgba(242,244,247,0.0)')
  g.fillStyle = coroa
  g.fillRect(0, 0, w, 120 * L)

  // duas cintas de casco, em latitude de puro escorço: linhas 400-424
  // (lat +19,7° a +15,5°, 4,97 m de altura) e 760-772 (lat -43,6° a -45,7°,
  // 2,48 m). Elas são o que SOBRA a 3 km, quando o texto já morreu no textCull:
  // de longe o intervalo comercial continua sendo uma esfera preta com anéis
  // brancos, e não uma esfera apagada.
  g.fillStyle = '#F2F4F7'
  g.fillRect(0, Math.round(400 * L), w, Math.round(24 * L))
  g.fillStyle = 'rgba(242,244,247,0.72)'
  g.fillRect(0, Math.round(760 * L), w, Math.round(12 * L))
}

function slotAnuncio(): Slot {
  const ms = Math.round(MS_ANUNCIO / 3)   // 24 s por quadro
  const base: Partial<SphereConteudo> = {
    ganho: GANHO_ANUNCIO,
    cor: COR_ANUNCIO,
    corRotulo: COR_ANUNCIO,
    pintarCorpo: pintarCorpoKray,
  }
  return {
    classe: 'anuncio',
    nome: 'kray',
    quadros: [
      quadro('KRAY', ROTULOS.krayNome, ms, base),
      quadro('WALLET', ROTULOS.krayCustodia, ms, base),
      quadro('TOWER', ROTULOS.krayTorre, ms, base),
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
      quadro('#' + alvo, ROTULOS.snapshotFeito, 0),
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
    quadro('#' + alvo, ROTULOS.blocoAlvo, 0),
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
 * reconhece porque é a que a carteira dela mostra no truncado. De 200 m ela lê
 * os próprios seis caracteres num painel de 135 m.
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
      quadro('#' + tx.block_height, ROTULOS.doacaoOk, MS_EVENTO_QUADRO, eventoBase),
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
    quadro('#' + altura, ROTULOS.bloco, MS_EVENTO_QUADRO, eventoBase),
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
  const ANEL = ['preco', 'volume', 'pulso', 'snapshot', 'anuncio'] as const
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
      // a troca de textura mora no fundo do vale: os ~7 ms de repaint caem onde
      // o olho tem menos a que se agarrar
      o.pintar(pendente.c)
      const alvo = pendente.c.ganho ?? GANHO_OCIOSO
      pendente = null
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
    const ev = fila.shift()
    if (ev) return ev
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

  const entrarNo = (s: Slot, t: number) => {
    fecharConta(t)
    slot = s
    iQuadro = 0
    fimQuadro = t + s.quadros[0].ms
    trocarPara(s.quadros[0], t)
  }

  /**
   * ⚠️ O EVENTO INTERROMPE, MAS NÃO CONFISCA O TEMPO DO PARCEIRO. Quando um
   * evento chega no meio do intervalo comercial, o que sobrava do intervalo é
   * devolvido para a fila e roda logo depois. O livro-caixa conta o tempo
   * EXIBIDO, então nem o parceiro perde o que comprou nem a casa paga duas
   * vezes pelo mesmo slot.
   */
  const empilhar = (s: Slot | null, t: number) => {
    if (!s || parado) return
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
