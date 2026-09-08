// ═══════════════════════════════════════════════════════════════════════════
// O PLANO DO JARDIM DA SPHERE: só geometria e nomes, sem `three`.
//
// Mesma disciplina de `garden-plan.ts`: quem PLANTA (as linhas de
// `props-table.ts` que põem tamareira, buxo e cipreste) e quem PAVIMENTA
// (`sphere-jardim.ts`, que constrói piso, aro, parapeito e escadaria) leem o
// MESMO desenho. Um número, um lugar.
//
// ⚠️ TUDO AQUI SAI DE `SPHERE_MOD`, E ISSO É REQUISITO ESCRITO. O fundador
// avisou em 07/09 que estuda mudar a Sphere de lugar, e a peça já é paramétrica
// (`sphereSitio`, `sphereDeckPoly`, cota medida por `sphereAssentar`). O jardim
// tinha de nascer igual: **não existe uma coordenada de mundo cravada neste
// arquivo nem em `sphere-jardim.ts`**. Trocar `SPHERE_MOD` move o jardim
// inteiro, e `scripts/city/verificar-sphere-jardim.ts` prova isso rodando o
// plano contra um módulo diferente e conferindo que todo ponto andou junto.
//
// ⚠️ E O JARDIM NÃO PLANTA NO CHÃO, PORQUE O CHÃO NÃO ESTÁ AQUI. O deck é uma
// plataforma NIVELADA em 116,4 m sobre relevo que vai de 99,78 a 116,00 sob ela
// (medido em `sphereAssentar`), e a cota ao vivo a 500 m na direção da praça
// central é **82,38 m**, ou seja a peça senta num alto e o deck está 34,0 m
// acima do chão dali. `arborizacao.ts` planta na SUPERFÍCIE do relevo
// (`o.heightAt(m.x, m.z)`, linha 880): usado aqui ele enterraria as árvores da
// borda em até 16,6 m ou as penduraria no ar. Por isso o jardim é feito de
// CANTEIRO CONSTRUÍDO em cota de deck, com aro de alvenaria e terra dentro, e
// nenhuma peça deste plano consulta `heightAt` para achar o seu y.
//
// ═══════════════════════════════════════════════════════════════════════════
// O PARTIDO, EM UMA FRASE
//
// **Tudo é anel concêntrico com a esfera, de passo angular constante, e o
// portão se faz APAGANDO vagas, nunca movendo as que ficam.**
//
// As duas metades disso são pagas:
//
//  1. CONCÊNTRICO porque a esfera é sólido de revolução e o pódio é anel, e
//     porque é a mesma lógica que o pátio em leque do precinto já usa e o
//     fundador já aprovou (`precinct.ts`: *"por construção ele é concêntrico
//     com tudo o mais, então não existe alinhamento para errar"*). O lote NÃO
//     ajuda: medido, o deck é um trapézio torto (arestas de 248,55 / 230,48 /
//     259,83 / 228,80 m, e as duas do arco correm com 37 m de inclinação em
//     relação ao eixo radial, porque o anel da teia é DODECÁGONO). Qualquer
//     desenho ortogonal herdaria essa torção; o desenho em anel não a vê.
//
//  2. APAGAR VAGA porque é a regra de gosto do fundador, escrita:
//     *"elementos repetidos igualmente espaçados; excluir é melhor que
//     desalinhar"*. Então a coroa de tamareira tem 48 vagas de 7,50° e ficam
//     40; a topiária tem 48 vagas e ficam as que couberem; o cipreste tem 24
//     vagas de 15,00°. Nenhuma peça é empurrada para caber: ou ela está na
//     vaga, ou ela não existe.
// ═══════════════════════════════════════════════════════════════════════════
import {
  SPHERE_MOD, SPHERE_PODIO_H, SPHERE_PODIO_LARG, SPHERE_COLAR_H,
  sphereSitio, sphereDeckPoly, sphereRaioNaCota,
} from './sphere'

export type Ponto = [number, number]

// ═══════════════════════════════════════════════════════════════════════════
// 1. O QUADRO LOCAL: (r, φ) em volta da esfera
// ═══════════════════════════════════════════════════════════════════════════

/** Onde o jardim mora. É o centro da peça, e ele NÃO se recalcula aqui:
 *  `sphereSitio()` já devolve o centroide de `polyDoModulo` (o ponto polar
 *  `(sin·rm, −cos·rm)` cai a 58 m dele, porque o anel é dodecágono). Medido: o
 *  centroide do deck coincide com o da peça em **0,00 m**.
 *
 *  Serve também para o corte por distância medir DELE e não da praça central (a
 *  Sphere está a 5.118 m dali; sem isto o jardim apareceria visto da praça e
 *  sumiria justamente quando alguém chegasse perto). */
export function sphereJardimCentro(): Ponto {
  const s = sphereSitio()
  return [s.x, s.z]
}

/**
 * O quadro do jardim: centro da peça e um eixo `u` que aponta para FORA pela
 * face de rua do lote. `v` é o perpendicular, e `φ` se mede de `u` para `v`.
 *
 * ⚠️ `u` NÃO É O RADIAL DA TEIA, E A DIFERENÇA É 8,57°, MEDIDA. Esta foi a
 * primeira versão deste arquivo e ela estava errada: `sphereSitio().rumoDeg` dá
 * a bissetriz angular do módulo, mas o deck é um TRAPÉZIO TORTO, porque o anel
 * da teia é dodecágono e o módulo cai atravessado numa face. Medidas as quatro
 * normais externas do deck, em relação ao radial da teia:
 *
 *     face          distância do centro   normal
 *     rua EXTERNA        113,50 m         351,43°
 *     rua INTERNA        113,50 m         171,43°   (paralelas, 180,00° exatos)
 *     ponta do arco +    125,18 m          91,40°
 *     ponta do arco −    126,10 m         268,62°
 *
 * Com o eixo no radial da teia, os quatro compartimentos saíam com 74,2° /
 * 57,1° / 74,2° / 57,1°, e o vão em frente à rua ficava descentrado 8,57° do
 * portão que deveria enfrentá-la: uma escadaria monumental torta em relação à
 * rua que ela serve. Com o eixo na NORMAL DA RUA os dois portões de rua ficam
 * perpendiculares à divisa (é a definição de portão) e o desenho volta a ser
 * espelhado nos dois lados.
 *
 * ⚠️ AS DUAS FACES DE 113,50 SÃO AS RUAS, e isso é da regra da casa: a peça de
 * infra ocupa um número inteiro de módulos porque **os lados do módulo SÃO
 * rua**, e `sphereDeckPoly()` só encurta o deck no ARCO. As faces de 125,18 e
 * 126,10 não são divisa: além delas ainda há 58 a 65 m de terreno natural
 * dentro do próprio lote, medidos.
 *
 * A face escolhida para φ = 0 é a de MAIOR componente radial para fora, que é
 * um critério determinístico e sobrevive a uma troca de `SPHERE_MOD`.
 */
let _quadro: { cx: number; cz: number; rumoRad: number; ux: number; uz: number; vx: number; vz: number } | null = null
export function jardimQuadro() {
  if (_quadro) return _quadro
  const [cx, cz] = sphereJardimCentro()
  const s = sphereSitio()
  const a = (s.rumoDeg * Math.PI) / 180
  const rx = Math.sin(a), rz = -Math.cos(a)     // o radial da teia, só para escolher a face
  let melhor = { nx: rx, nz: rz, k: -Infinity }
  for (const e of arestasCruas(cx, cz)) {
    const k = e.nx * rx + e.nz * rz
    if (k > melhor.k) melhor = { nx: e.nx, nz: e.nz, k }
  }
  _quadro = {
    cx, cz,
    rumoRad: Math.atan2(melhor.nx, -melhor.nz),
    ux: melhor.nx, uz: melhor.nz,
    vx: -melhor.nz, vz: melhor.nx,
  }
  return _quadro
}

/** (r, φ) do jardim para (x, z) do mundo. */
export function doJardim(r: number, phi: number): Ponto {
  const q = jardimQuadro()
  const du = Math.cos(phi) * r, dv = Math.sin(phi) * r
  return [q.cx + q.ux * du + q.vx * dv, q.cz + q.uz * du + q.vz * dv]
}

/** (du, dv) local para (x, z) do mundo. */
export function doLocal(du: number, dv: number): Ponto {
  const q = jardimQuadro()
  return [q.cx + q.ux * du + q.vx * dv, q.cz + q.uz * du + q.vz * dv]
}

/** (x, z) do mundo para (du, dv) local. */
export function paraLocal(x: number, z: number): Ponto {
  const q = jardimQuadro()
  const dx = x - q.cx, dz = z - q.cz
  return [dx * q.ux + dz * q.uz, dx * q.vx + dz * q.vz]
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. O LOTE: as quatro arestas do deck, como retas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * As arestas do deck em forma de reta de apoio: normal para FORA e distância do
 * centro. É tudo o que o jardim precisa do lote, e vale para qualquer
 * quadrilátero convexo, que é o que `sphereDeckPoly()` sempre devolve.
 *
 * Medido em 07/09 com `npx tsx`, distância do centro da esfera a cada aresta:
 *
 *     arco INTERNO  (lado da praça central)   113,50 m   comprimento 248,55
 *     radial +v                               125,18 m   comprimento 230,48
 *     arco EXTERNO  (lado de fora)            113,50 m   comprimento 259,83
 *     radial −v                               126,10 m   comprimento 228,80
 *
 *     círculo inscrito no deck                113,50 m
 *     vértice mais distante                   185,75 m
 *     área do deck                         57.701 m²
 *
 * ⚠️ ESTES 113,50 NÃO SÃO OS 114,80 QUE SAEM DE "229,6 / 2". Os 229,6 do
 * cabeçalho de `sphere.ts` são o COMPRIMENTO MÉDIO das duas arestas radiais;
 * 113,50 é a DISTÂNCIA PERPENDICULAR do centro à aresta, que é o número de que
 * um jardim precisa (é ele que diz onde a calçada bate na divisa). Os dois estão
 * certos e medem coisas diferentes; usar o primeiro no lugar do segundo põe o
 * parapeito 1,30 m fora do lote.
 */
function arestasCruas(cx: number, cz: number): { nx: number; nz: number; p: number }[] {
  const q = sphereDeckPoly()
  const out: { nx: number; nz: number; p: number }[] = []
  for (let i = 0; i < q.length; i++) {
    const a = q[i], b = q[(i + 1) % q.length]
    const ex = b[0] - a[0], ez = b[1] - a[1]
    const L = Math.hypot(ex, ez) || 1
    let nx = ez / L, nz = -ex / L
    // a normal tem de apontar para FORA: o centro fica do lado negativo
    if ((cx - a[0]) * nx + (cz - a[1]) * nz > 0) { nx = -nx; nz = -nz }
    out.push({ nx, nz, p: (a[0] - cx) * nx + (a[1] - cz) * nz })
  }
  return out
}

let _arestas: { nx: number; nz: number; p: number }[] | null = null
export function arestasDoDeck(): { nx: number; nz: number; p: number }[] {
  if (!_arestas) {
    const [cx, cz] = sphereJardimCentro()
    _arestas = arestasCruas(cx, cz)
  }
  return _arestas
}

/**
 * O raio do deck no rumo `phi`, opcionalmente recuado `recuo` metros para
 * dentro. Convexo, então basta o menor dos quatro cortes de reta.
 *
 * ⚠️ RECUAR UM POLÍGONO É RECUAR AS RETAS, NÃO OS VÉRTICES. Deslocar vértice
 * para o centro encolhe o polígono de forma desigual num trapézio torto como
 * este; deslocar a RETA de cada aresta dá o offset de verdade, e a quina sai da
 * intersecção sozinha.
 */
export function raioDoDeck(phi: number, recuo = 0): number {
  const q = jardimQuadro()
  // direção do raio no MUNDO (o quadro local só serve para o ângulo)
  const dx = Math.cos(phi) * q.ux + Math.sin(phi) * q.vx
  const dz = Math.cos(phi) * q.uz + Math.sin(phi) * q.vz
  let r = Infinity
  for (const e of arestasDoDeck()) {
    const c = dx * e.nx + dz * e.nz
    if (c > 1e-6) r = Math.min(r, (e.p - recuo) / c)
  }
  return r
}

/** O maior círculo que cabe no deck recuado de `recuo`: 113,50 − recuo. */
export function raioInscrito(recuo = 0): number {
  return Math.min(...arestasDoDeck().map((e) => e.p)) - recuo
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. AS COTAS: duas, e nenhuma delas é o relevo
// ═══════════════════════════════════════════════════════════════════════════

/** O aro do canteiro de parterre acima do piso do deck. **0,45 m não é gosto:
 *  é altura de assento.** São 1.302 m de aro construído (medido), e ele é o
 *  único banco deste jardim, o que dispensou uma espécie de mobiliário inteira
 *  (`bench-classic` custaria 3 chamadas de desenho por 16 assentos). */
export const ARO_H = 0.45
/** A terra do parterre, 10 cm abaixo do topo do aro: é o que faz o aro LER como
 *  aro em vez de risco no chão. */
export const TERRA_H = 0.35
/** O aro da bordadura do pé do colar, no pódio. Mais baixo porque ali não se
 *  senta: se senta a 8 m dali, no aro do parterre lá embaixo. */
export const BORDADURA_ARO_H = 0.35

/** Parapeito do deck e do pódio: 1,10 m é altura de guarda-corpo, e ele é
 *  REQUISITO e não enfeite. Medido: o deck está 0,40 a 16,62 m acima do relevo
 *  na própria divisa, e 34,0 m acima do chão a 500 m na direção da praça. */
export const PARAPEITO_H = 1.10
export const PARAPEITO_LARG = 0.90
/** O passeio dentro do parapeito, todo o perímetro do deck. */
export const PASSEIO_BORDA = 3.60
/** O recuo total da divisa do deck até onde o jardim pode começar. */
export const RECUO_BORDA = PARAPEITO_LARG + PASSEIO_BORDA   // 4,50 m

// ═══════════════════════════════════════════════════════════════════════════
// 4. OS RAIOS, TODOS DERIVADOS
// ═══════════════════════════════════════════════════════════════════════════

/** onde a esfera encosta no topo do colar: 90,02 m (de `sphere.ts`) */
export const R_COLAR = sphereRaioNaCota(SPHERE_PODIO_H + SPHERE_COLAR_H)
/** onde a esfera encosta no topo do pódio: 89,49 m */
export const R_PE = sphereRaioNaCota(SPHERE_PODIO_H)
/** a borda externa do pódio: 102,09 m */
export const R_PODIO_EXT = R_PE + SPHERE_PODIO_LARG

/**
 * A BORDADURA do pé do colar: um canteiro rasteiro de buxo aparado, 1,60 m de
 * largura, encostado na junta entre o colar e o piso do pódio.
 *
 * ⚠️ ELA RESOLVE DUAS COISAS DE UMA VEZ, e as duas são de ofício:
 *   · **parede não encontra piso pelado.** O colar é um chanfro de 25,9° que
 *     morre no piso numa linha de 566 m de comprimento (2π·90,02); sem
 *     bordadura essa junta fica exposta a 1,7 m de altura de olho, que é
 *     exatamente a distância em que ninguém perdoa uma junta.
 *   · **ela é o afastamento da tela.** A casca é um painel de LED; a bordadura
 *     põe 1,60 m de canteiro entre o pé de quem anda e a casca, sem grade e sem
 *     placa de "não toque".
 */
export const BORDADURA_LARG = 1.60
export const R_BORDADURA_EXT = R_COLAR + BORDADURA_LARG

/** O parapeito do pódio, na borda externa: 2,20 m de queda para o deck. */
export const BALAUSTRADA_LARG = 0.50
export const R_BALAUSTRADA_INT = R_PODIO_EXT - BALAUSTRADA_LARG

/**
 * A COROA: o raio das floreiras de tamareira sobre o pódio.
 *
 * ⚠️ ESTE É O GESTO PRINCIPAL, e ele é literalmente o que o fundador pediu:
 * *"paisagismo proposital SOBRE O PÓDIO que a esfera está em cima"*. Uma esfera
 * de 196 m não tem régua: quem chega não sabe se ela tem 50 ou 500 m até haver
 * uma coisa de tamanho conhecido ao pé dela. Quarenta tamareiras de 14 a 18 m,
 * igualmente espaçadas num anel concêntrico, são essa régua, e são o mesmo
 * vocabulário que o precinto já usa e o fundador já aprovou (a alameda dos
 * bulevares é `palm-date`, a mesma espécie).
 *
 * O raio não é escolhido: a floreira encosta na balaustrada por fora, então
 * `R_COROA = R_BALAUSTRADA_INT − FLOREIRA_R`.
 */
export const FLOREIRA_R = 1.70
/** a terra da floreira: 1,10 m é o mínimo de substrato para árvore sobre laje,
 *  e é o número que separa canteiro de vaso decorativo */
export const FLOREIRA_H = 1.10
export const R_COROA = R_BALAUSTRADA_INT - FLOREIRA_R

/** A promenade do pódio: o que sobra entre a bordadura e as floreiras. Livre,
 *  360°, colada na casca de LED. Medida, não escolhida. */
export const PROMENADE_PODIO = R_COROA - FLOREIRA_R - R_BORDADURA_EXT

/** O CINTO: o anel de piso do deck em volta do embasamento. Começa onde o pódio
 *  acaba e termina onde o passeio de borda começa, e por isso a largura dele é
 *  uma SAÍDA do lote, não uma entrada. */
export const R_CINTO_INT = R_PODIO_EXT
export const R_CINTO_EXT = raioInscrito(RECUO_BORDA)
export const CINTO_LARG = R_CINTO_EXT - R_CINTO_INT

// ═══════════════════════════════════════════════════════════════════════════
// 5. OS PORTÕES E AS ESCADARIAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ ISTO FECHA A DÍVIDA DECLARADA DO ACESSO AO PÓDIO. `sphere.md` listava em
 * aberto: *"2,2 m de face vertical não se sobe a pé"*, e a geometria do pódio já
 * estava subdividida em 96 gomos justamente para receber o corte de uma
 * escadaria sem refazer a peça.
 *
 * Quatro escadarias, uma em cada eixo do deck (φ = 0°, 90°, 180°, 270°), todas
 * iguais. A do φ = 180° é a principal: ela aponta para a praça central, que é de
 * onde a cidade chega (a chapa `sphererua` do portão de conferência mira daquele
 * lado, a 500 m).
 *
 * A conta do degrau, e ela é de norma e não de gosto:
 *
 *     desnível              2,20 m   (SPHERE_PODIO_H, já em produção)
 *     espelhos             14 x 15,71 cm
 *     pisos                13 x 36 cm
 *     avanço                4,68 m   (13 x 0,36)
 *     inclinação           23,6°
 *     Blondel (2e + p)     67,4 cm   (a faixa confortável é 63 a 68)
 *     largura              22,00 m   (a mesma do corredor do portão)
 *
 * ⚠️ E O PÉ DA ESCADA NÃO ESTRANGULA O CINTO, medido: ela ocupa de r 102,09 a
 * 106,77, e o cinto vai até 109,00, então sobram **2,23 m** de piso do cinto na
 * frente dela, mais o passeio de borda (3,60 m) nos portões do eixo radial e
 * mais o corredor inteiro (11,68 a 12,60 m) nos do eixo do arco. Ou seja o piso
 * é contínuo do pódio ao parapeito em qualquer portão.
 */
export const ESCADA_ESPELHOS = 14
export const ESCADA_ESPELHO_H = SPHERE_PODIO_H / ESCADA_ESPELHOS
export const ESCADA_PISO = 0.36
export const ESCADA_AVANCO = (ESCADA_ESPELHOS - 1) * ESCADA_PISO
export const PORTAO_LARG = 22.0
export const PORTAO_MEIA_LARG = PORTAO_LARG / 2

/** Os quatro portões, em radianos de φ. 180° é o principal (praça central). */
export const PORTOES = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]

/**
 * Está dentro do corredor de um portão? A medida é LATERAL em metros (a
 * distância do ponto ao eixo do portão), nunca em graus: um portão de 22 m tem
 * 12,6° a r 100 e 5,2° a r 121, e usar ângulo fixo faria o portão abrir em cima
 * e fechar embaixo.
 */
export function noPortao(r: number, phi: number, folga = 0): boolean {
  for (const g of PORTOES) {
    const d = phi - g
    if (Math.cos(d) <= 0) continue
    if (Math.abs(Math.sin(d) * r) <= PORTAO_MEIA_LARG + folga) return true
  }
  return false
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. OS ANÉIS DE VAGA: passo constante, exclusão por regra
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Um anel de vagas igualmente espaçadas, com as que não cabem APAGADAS.
 *
 * ⚠️ O `offset` DE MEIO PASSO NÃO É DETALHE. Sem ele a vaga zero cai
 * exatamente em cima do eixo do portão, ou seja no pior lugar possível, e o
 * anel inteiro fica assimétrico em relação ao portão. Com meio passo o portão
 * fica no MEIO de um vão, e o desenho é espelhado nos dois lados dele.
 */
export function anelDeVagas(
  r: number,
  passoDeg: number,
  cabe: (r: number, phi: number) => boolean,
): { phi: number; r: number; xz: Ponto }[] {
  const n = Math.round(360 / passoDeg)
  const passo = (Math.PI * 2) / n
  const out: { phi: number; r: number; xz: Ponto }[] = []
  for (let i = 0; i < n; i++) {
    const phi = (i + 0.5) * passo
    if (!cabe(r, phi)) continue
    out.push({ phi, r, xz: doJardim(r, phi) })
  }
  return out
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. OS CANTEIROS: quatro compartimentos, onde o lote dá profundidade
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ SÓ EXISTE CANTEIRO ONDE HÁ FUNDO PARA ELE, e este número decide onde.
 * O deck é um trapézio com um disco de 204,18 m (o embasamento) quase encostado
 * nas duas arestas do arco: no eixo radial sobra 12,71 m entre o pódio e a
 * divisa, e desses 4,50 já são parapeito e passeio. Um canteiro de 1,7 m ali
 * não é canteiro, é sobra. Nas quinas, ao contrário, sobram até 72 m.
 *
 * Então o canteiro só nasce onde a profundidade radial disponível chega a
 * **6,00 m**, e as quatro faixas que sobram viram piso. O resultado, medido, é
 * exatamente o desenho clássico de círculo inscrito em retângulo: o disco
 * encosta nos dois lados curtos, e o jardim são as quatro quinas.
 */
export const CANTEIRO_PROF_MIN = 6.0
/** o quanto o cipreste e a topiária se afastam da divisa do canteiro */
export const PLANTA_FOLGA = 3.0

/** Este ponto está num compartimento de canteiro? */
export function noCanteiro(r: number, phi: number, folga = 0): boolean {
  if (r < R_CINTO_EXT + folga) return false
  const rMax = raioDoDeck(phi, RECUO_BORDA)
  if (rMax - R_CINTO_EXT < CANTEIRO_PROF_MIN) return false
  if (r > rMax - folga) return false
  if (noPortao(r, phi, folga)) return false
  return true
}

/**
 * Os arcos de φ em que existe canteiro, um por compartimento, já sem os
 * corredores dos portões. Varrido em passo de 0,1°, que a r 185 (o vértice mais
 * distante do deck) vale 32 cm de resolução.
 */
export function arcosDeCanteiro(folga = 0): { a0: number; a1: number }[] {
  const N = 3600
  const out: { a0: number; a1: number }[] = []
  let ini: number | null = null
  for (let i = 0; i <= N; i++) {
    const phi = (i / N) * Math.PI * 2
    const rMax = raioDoDeck(phi, RECUO_BORDA)
    const ok = i < N
      && rMax - R_CINTO_EXT >= CANTEIRO_PROF_MIN
      && !noPortao(R_CINTO_EXT + folga, phi, folga)
      && !noPortao(rMax - folga, phi, folga)
    if (ok && ini == null) ini = phi
    if (!ok && ini != null) { if (phi - ini > 0.01) out.push({ a0: ini, a1: phi }); ini = null }
  }
  // o primeiro arco pode ter começado antes de φ = 0 e ser o mesmo do fim
  if (out.length > 1 && out[0].a0 < 1e-9 && out[out.length - 1].a1 > Math.PI * 2 - 1e-9) {
    const ult = out.pop()!
    out[0] = { a0: ult.a0 - Math.PI * 2, a1: out[0].a1 }
  }
  return out
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. O QUE SE PLANTA, E ONDE. Estas listas são o que `props-table.ts` consome.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A COROA: 48 vagas de 7,50° sobre o pódio, menos as 8 que caem nos portões.
 *
 * Medido: passo de **13,08 m** entre tamareiras a r 99,89, contra copas de 6 a
 * 8 m de diâmetro, ou seja elas nunca se tocam e a fileira lê como fileira. As
 * 8 apagadas são as duas mais próximas de cada portão (a folga pedida é o raio
 * da floreira mais 1,0 m de circulação).
 */
export const SPHERE_COROA_PALMEIRAS: Ponto[] = anelDeVagas(
  R_COROA, 7.5,
  (r, phi) => !noPortao(r, phi, FLOREIRA_R + 1.0),
).map((v) => v.xz)

/**
 * A TOPIÁRIA: buxo em bola, 48 vagas de 7,50° na primeira fileira do canteiro,
 * 3,20 m para dentro da divisa com o cinto. É a peça que dá borda ao parterre
 * de perto, e ela é o mesmo `buxo-bola` do Jardim Italiano (`props-table.ts`),
 * então não custa nem programa de shader nem textura nova.
 */
export const R_TOPIARIA = R_CINTO_EXT + 3.2
export const SPHERE_TOPIARIAS: Ponto[] = anelDeVagas(
  R_TOPIARIA, 7.5,
  (r, phi) => noCanteiro(r, phi, 1.5),
).map((v) => v.xz)

/**
 * O CIPRESTE: um leque de 15,00°, plantado a 55% da profundidade do canteiro
 * naquele rumo, e SÓ onde o canteiro tem fundo para uma árvore de 15 a 20 m.
 * Mesma espécie (`tree-cypress`) da nave do Jardim do White Paper e do
 * crescente do Espelho de Satoshi.
 *
 * ⚠️ ELE EXISTE POR CAUSA DA MEDIÇÃO DE 07/09 À NOITE: a cota ao vivo a 500 m
 * na direção da praça central é **82,38 m** e o deck está em 116,4, ou seja
 * **34,0 m acima do chão dali**. Quem chega vê um embasamento ALTO com um
 * parapeito em cima. Sem nada plantado atrás do parapeito, o topo do
 * embasamento lê como laje pelada; um cipreste de 15 a 20 m aparece acima da
 * linha do parapeito e dá copa ao coroamento.
 *
 * ⚠️ E A CONTAGEM SAI **3 / 2 / 3 / 2**, NÃO 4 / 4 / 4 / 4, E ISSO É O LOTE
 * FALANDO. Medida a profundidade disponível em cada uma das 20 vagas de 15° que
 * caem em canteiro, o deck entrega dois tipos de quina, porque ele é um
 * trapézio sobre um dodecágono:
 *
 *     compartimento 1   8,98  28,39  69,52  34,04  17,51    → 3 acima de 22 m
 *     compartimento 2  11,79  14,62  27,09  28,39   8,98    → 2
 *     compartimento 3   8,98  28,39  62,03  30,97  16,70    → 3
 *     compartimento 4  12,60  17,07  31,85  28,39   8,98    → 2
 *
 * A regra da casa manda excluir em vez de desalinhar, e é o que se faz: as
 * vagas rasas ficam vazias, as que ficam continuam a 15,00° exatos. Empurrar
 * uma árvore de 18 m para um canteiro de 9 m seria mentir no desenho e matar a
 * árvore no jardim de verdade.
 *
 * O limiar de **22,0 m** não é redondo à toa: as profundidades medidas se
 * separam em dois grupos, um até 17,51 e outro a partir de 27,09, e 22,0 fica
 * no meio do vão. Uma diferença de 0,92 m entre as duas pontas do arco do lote
 * (125,18 contra 126,10) faria um limiar apertado virar a contagem de um
 * compartimento só, que é justamente a assimetria feia.
 */
export const CIPRESTE_PROF_MIN = 22.0
export const CIPRESTE_FRACAO = 0.55
export const SPHERE_CIPRESTES: Ponto[] = (() => {
  const out: Ponto[] = []
  for (let i = 0; i < 24; i++) {
    const phi = (i + 0.5) * (Math.PI / 12)
    const prof = raioDoDeck(phi, RECUO_BORDA) - R_CINTO_EXT
    if (prof < CIPRESTE_PROF_MIN) continue
    const r = R_CINTO_EXT + CIPRESTE_FRACAO * prof
    if (!noCanteiro(r, phi, PLANTA_FOLGA)) continue
    out.push(doJardim(r, phi))
  }
  return out
})()

/**
 * OS POSTES: um anel de 15,00° na borda externa do cinto, fora da linha de
 * caminhar (0,80 m do limite do cinto). Luz quente de jardim, o mesmo
 * vocabulário do precinto (haste fina e globo), e a poça de luz no chão que
 * `light-pool.ts` já sabe desenhar: sem ela a praça vira campo escuro com
 * pontinhos brancos flutuando, defeito que o fundador já apontou uma vez.
 */
export const R_POSTE = R_CINTO_EXT - 0.8
export const SPHERE_POSTES: Ponto[] = anelDeVagas(
  R_POSTE, 15,
  (r, phi) => !noPortao(r, phi, 1.5),
).map((v) => v.xz)

/** Resumo do plano, para o verificador e para o relatório. Nada aqui é
 *  estimado: tudo sai das funções acima. */
export function resumoDoPlano() {
  const arcos = arcosDeCanteiro()
  const grau = (a: number) => ((a * 180) / Math.PI + 360) % 360
  return {
    centro: sphereJardimCentro(),
    rumoDeg: (jardimQuadro().rumoRad * 180) / Math.PI,
    raioInscrito: raioInscrito(),
    vertice: Math.max(...sphereDeckPoly().map(([x, z]) => {
      const [du, dv] = paraLocal(x, z); return Math.hypot(du, dv)
    })),
    podio: { rInt: R_PE, rExt: R_PODIO_EXT, bordadura: [R_COLAR, R_BORDADURA_EXT], promenade: PROMENADE_PODIO, coroa: R_COROA },
    cinto: { rInt: R_CINTO_INT, rExt: R_CINTO_EXT, larg: CINTO_LARG },
    escada: { espelhos: ESCADA_ESPELHOS, espelho: ESCADA_ESPELHO_H, piso: ESCADA_PISO, avanco: ESCADA_AVANCO, largura: PORTAO_LARG, blondel: 2 * ESCADA_ESPELHO_H + ESCADA_PISO },
    canteiros: arcos.map((a) => ({ a0: grau(a.a0), a1: grau(a.a1), amplitude: grau(a.a1) - grau(a.a0) })),
    contagem: {
      palmeiras: SPHERE_COROA_PALMEIRAS.length,
      topiarias: SPHERE_TOPIARIAS.length,
      ciprestes: SPHERE_CIPRESTES.length,
      postes: SPHERE_POSTES.length,
    },
    modulo: SPHERE_MOD,
  }
}
