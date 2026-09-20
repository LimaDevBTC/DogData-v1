// ═══════════════════════════════════════════════════════════════════════════
// LOTEAR: teste de capacidade do tecido de lotes contra a malha viaria (a teia).
//
// Uso: npx tsx scripts/city/lotear.ts
//
// ⚠️ ISTO E UM TESTE DE CAPACIDADE, NAO O REGISTRO FINAL. Planta as 85.818
// carteiras do snapshot, na ordem ja decidida, dentro dos quarteiroes que a
// teia (app/city/plaza/teia.ts) desenha, e mede se cabe. Nao inventa regra
// nova de urbanismo, nao grava nada em data/ nem em public/: so em /tmp.
//
// ⚠️ A TEIA E A UNICA FONTE DE GEOMETRIA VIARIA, por import direto de
// app/city/plaza/teia.ts (nunca copiada). Os dados de programa, ancoras,
// reservas e agua vem do artefato congelado public/city/mapa-v1.json. O
// terreno (para o teste de agua) e reconstruido exatamente como
// scripts/city/congelar-mapa.ts faz, a partir das mesmas fontes cruas.
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { ANEIS, N_RAD, anguloDe, anelRaio, naAlcaDeTerra } from '../../app/city/plaza/teia'

const leia = (p: string) => readFileSync(p)
const leiaJSON = (p: string) => JSON.parse(leia(p).toString())

const MAPA = leiaJSON('public/city/mapa-v1.json')
const SNAP = leiaJSON('data/snapshots/dog_snapshot_966670_ordem.json')

// ─────────────────────────────────────────────────────────────────────────
// PONTO EM POLIGONO (ray casting), para programa[], ancoras[], crescentes e
// casa_poly. Os poligonos ja vem em coordenadas de mundo (x,z), em metros.
// ─────────────────────────────────────────────────────────────────────────
function dentroPoligono(x: number, z: number, poly: [number, number][]): boolean {
  let dentro = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    const cruza = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi
    if (cruza) dentro = !dentro
  }
  return dentro
}

/**
 * O ponto cai no corredor de uma via RETA que nasce no centro, no rumo
 * `rumoDeg` (graus), entre `rIni` e `rFim` (metros de distancia do centro),
 * com `meiaLargura` (metros) de cada lado do eixo.
 *
 * ⚠️ Conversao de rumo, exatamente como o resto da casa: x = sin(ang)*r,
 * z = -cos(ang)*r. O "ao longo" e a projecao nessa direcao; o "atravessado"
 * e a projecao na perpendicular.
 */
function emCorredorRadial(
  x: number,
  z: number,
  rumoDeg: number,
  meiaLargura: number,
  rIni: number,
  rFim: number,
): boolean {
  const g = (rumoDeg * Math.PI) / 180
  const aoLongo = x * Math.sin(g) - z * Math.cos(g)
  if (aoLongo < rIni || aoLongo > rFim) return false
  const atravessado = x * Math.cos(g) + z * Math.sin(g)
  return Math.abs(atravessado) < meiaLargura
}

// ─────────────────────────────────────────────────────────────────────────
// MASCARAS. A ordem de checagem e a ordem em que o enunciado lista as sete
// categorias, e e essa ordem que decide a categoria contada quando um canto
// cai em mais de uma mascara ao mesmo tempo.
// ─────────────────────────────────────────────────────────────────────────
type Rejeicao = 'agua' | 'programa' | 'ancora' | 'ilha' | 'avenida' | 'canal' | 'alca' | null

const ILHA_POLIS: [number, number][][] = [
  ...MAPA.reservas.foundersClub.crescentes,
  MAPA.reservas.foundersClub.casa_poly,
]

const COTA_AGUA = MAPA.agua.lagos.cota as number
const TALUDE_CANAL = MAPA.agua.canais.talude as number

async function main() {
  // ⚠️ O MESMO SHIM DE scripts/city/congelar-mapa.ts. Canvas e so recipiente
  // de material aqui: nenhuma rasterizacao, navegador ou GPU de verdade.
  Object.assign(globalThis, {
    document: {
      createElement: () => ({ width: 0, height: 0, getContext: () => ({ putImageData() {} }) }),
    },
    ImageData: class {
      constructor(
        public data: Uint8ClampedArray,
        public width: number,
        public height: number,
      ) {}
    },
  })
  const { buildTerrain, CANAL_LAMINA, LAGO_R1 } = await import('../../app/city/plaza/terrain')
  const M = leiaJSON('public/city/cidade-malha.json')
  const metaHm = leiaJSON('public/lunar/btc-core-heightmap.json')
  const bufHm = leia('public/lunar/btc-core-heightmap.f32')
  const terrain = buildTerrain(
    metaHm,
    new Float32Array(bufHm.buffer.slice(bufHm.byteOffset, bufHm.byteOffset + bufHm.byteLength)),
    {
      radiais: M.canais.radiais.map((r: any) => ({
        rumo: r.rumo,
        secao: CANAL_LAMINA,
        rInicio: Math.min(r.rInicio, LAGO_R1),
        rFim: r.rFim ?? 4300,
      })),
      aneis: M.canais.aneis,
      talude: M.canais.talude,
      leito: M.lagos.cota - 4,
    },
    { faixaSeca: false },
  )
  const molhado = (x: number, z: number) => terrain.superficieAt(x, z) < COTA_AGUA + 1.2

  function testaMascara(x: number, z: number): Rejeicao {
    if (molhado(x, z)) return 'agua'
    for (const p of MAPA.programa) if (dentroPoligono(x, z, p.poly)) return 'programa'
    for (const a of MAPA.ancoras) if (dentroPoligono(x, z, a.poly)) return 'ancora'
    for (const ilha of ILHA_POLIS) if (dentroPoligono(x, z, ilha)) return 'ilha'
    for (const av of MAPA.avenidas.lista) {
      if (emCorredorRadial(x, z, av.rumo, av.largura / 2 + 6, MAPA.avenidas.rInicio, MAPA.avenidas.rFim))
        return 'avenida'
    }
    for (const c of MAPA.agua.canais.radiais) {
      if (emCorredorRadial(x, z, c.rumo, c.lamina / 2 + TALUDE_CANAL, c.rInicio, c.rFim)) return 'canal'
    }
    if (naAlcaDeTerra(x, z)) return 'alca'
    return null
  }

  function testarCantos(cantos: [number, number][]): Rejeicao {
    for (const [x, z] of cantos) {
      const r = testaMascara(x, z)
      if (r) return r
    }
    return null
  }

  // ponto no mundo a partir de (raio, angulo em radianos), convencao da casa
  const pt = (r: number, a: number): [number, number] => [Math.sin(a) * r, -Math.cos(a) * r]
  const cantosDe = (r0: number, r1: number, a0: number, a1: number): [number, number][] => [
    pt(r0, a0),
    pt(r0, a1),
    pt(r1, a0),
    pt(r1, a1),
  ]

  // ─────────────────────────────────────────────────────────────────────
  // AS CARTEIRAS, NA ORDEM DECIDIDA. Ordenado por posicao por seguranca
  // (o arquivo ja vem assim).
  //
  // ⚠️ `elegivel: false` NAO TIRA NINGUEM DA CIDADE (fundador, 20/09/2026:
  // "se tinham $DOG no snapshot vao receber a terra de direito"). A marca e o
  // filtro de custodia do masterplan §12.1, `lth_pct >= 50`, e ele e o PRIMEIRO
  // CRITERIO DE ORDEM da regua: decide quem LIDERA a fila, nunca quem tem terra.
  // Este filtro descartava 3.058 carteiras que tinham DOG no bloco 966.670.
  // ─────────────────────────────────────────────────────────────────────
  const carteiras = (SNAP.ordem as any[])
    .sort((a, b) => a.posicao - b.posicao)
    .map((c) => ({ address: c.address as string, area_m2: c.area_m2 as number, posicao: c.posicao as number }))
  const TOTAL_CARTEIRAS = (SNAP.ordem as any[]).length

  let wp = 0 // ponteiro na lista de carteiras: a fila principal, primeira passada

  interface Lote {
    posicao: number
    address: string
    x: number
    z: number
    rot: number
    frente: number
    prof: number
    area: number
    anel: number
    j: number
  }
  const lotes: Lote[] = []

  const rejeicoes: Record<Exclude<Rejeicao, null>, number> = {
    agua: 0,
    programa: 0,
    ancora: 0,
    ilha: 0,
    avenida: 0,
    canal: 0,
    alca: 0,
  }
  let superquadras = 0
  let ultimoAnelIdx = -1
  const disponivelAnel = new Array(ANEIS.length - 1).fill(0) as number[]
  const usadaAnel = new Array(ANEIS.length - 1).fill(0) as number[]

  const round1 = (v: number) => Math.round(v * 10) / 10

  // ⚠️ NAO EXISTE MAIS FILA DE PENDENTES, e a ausencia dela e o conserto: a fila
  // e UMA so e nunca descarta ninguem. Fica declarada vazia porque a saida
  // ainda a imprime, e imprimir zero e a prova de que ela morreu.
  const pendentes: (typeof carteiras)[number][] = []

  function registrarLote(
    w: (typeof carteiras)[number],
    r0: number,
    r1: number,
    a0: number,
    a1: number,
    i: number,
    j: number,
  ) {
    const midAng = (a0 + a1) / 2
    const midR = (r0 + r1) / 2
    const frente = (a1 - a0) * midR
    const prof = r1 - r0
    lotes.push({
      posicao: w.posicao,
      address: w.address,
      x: round1(Math.sin(midAng) * midR),
      z: round1(-Math.cos(midAng) * midR),
      rot: round1(((midAng * 180) / Math.PI + 360) % 360),
      frente: round1(frente),
      prof: round1(prof),
      area: Math.round(frente * prof),
      anel: i,
      j,
    })
    ultimoAnelIdx = Math.max(ultimoAnelIdx, i)
  }

  // ─────────────────────────────────────────────────────────────────────
  // O LOTEAMENTO: FILA CONTINUA SOBRE FILEIRAS ABERTAS
  //
  // ⚠️ AS TRES PRIMEIRAS VERSOES DESTE LACO ERRARAM PELO MESMO MOTIVO, e vale
  // escrever qual: elas percorriam VAGAS oferecendo cada uma a UMA carteira, e
  // quem nao coubesse era descartado para uma fila de pendentes. Com isso a
  // capacidade vazava por todo lado (v1 plantou 67% com 1,7x de testada
  // sobrando; v3 chegou a plantar MENOS com 3,6x sobrando, porque os gigantes
  // do inicio da fila queimavam vaga nos aneis internos).
  //
  // A inversao que conserta: a FILA corre uma vez so, e a vaga e que se abre e
  // se fecha debaixo dela. Uma fileira viva vira um cursor; cada carteira
  // consome a frente que precisa e empurra o cursor; quando o que sobra nao
  // serve, a fileira fecha e a proxima abre. Nenhuma carteira e descartada e
  // nenhuma fileira fica para tras, entao a unica forma de faltar lugar e a
  // cidade acabar de verdade.
  //
  // ⚠️ A ORDEM MANDA NO ANEL E NO QUARTEIRAO, e e ai que ela importa: e ela que
  // decide quem mora perto do centro. DENTRO de uma fileira, quando a ponta que
  // sobra nao serve para a cabeca da fila, o encaixe pode adiantar ate
  // `ESPIADA` posicoes para nao jogar a ponta fora. Isso e desvio de metros
  // dentro da MESMA fileira, nunca de bairro, e paga por si: sem ele cada
  // fileira perde ate uma testada inteira de lote.
  // ─────────────────────────────────────────────────────────────────────
  const MIN_FAIXA = 40          // menor profundidade de faixa que vira fileira
  const TRAVESSA = 9            // a rua de servico entre duas faixas
  const MEIA_RUA = 6            // metade da secao da teia, de cada lado do quarteirao
  const FRENTE_MIN = 5          // testada minima de lote
  const FRENTE_MAX = 60         // acima disto o lote pede quarteirao, nao fileira
  const FRENTE_ALVO = 18        // a proporcao que se persegue: fundo ~ area/18
  const ESPIADA = 20            // quantas posicoes o encaixe pode adiantar na fileira
  const PASSO_SONDA = 4         // amostragem da mascara ao longo da fileira

  const anguloDe = (j: number) => (j / N_RAD) * Math.PI * 2
  const passoDoAnel = (i: number) => (i < 13 ? 2 : 1)

  let plantadasSegunda = 0      // nao ha segunda passada: a fila e uma so
  const antesDaSegunda = 0

  // ⚠️ PONTEIRO E MARCACAO, NUNCA `splice`. Tirar do meio de um array de 82.760
  // custa O(n) por carteira, ou seja 3,4 bilhoes de operacoes na cidade inteira.
  const tomada = new Uint8Array(carteiras.length)
  const avanca = () => { while (wp < carteiras.length && tomada[wp]) wp++ }
  /** a carteira da vez, ou undefined quando a fila acabou */
  const cabeca = () => { avanca(); return wp < carteiras.length ? carteiras[wp] : undefined }

  // ⚠️ A FAIXA E UMA FILEIRA SO, DE FUNDO CHEIO, e esta foi a lição da rodada
  // que plantou 495 lotes e travou. Antes a faixa virava DUAS fileiras de meio
  // fundo, e isso abria uma FAIXA MORTA de tamanho: um lote de 2.000 m² não
  // cabia na fileira (precisaria de 80 m de testada em 25 m de fundo, acima do
  // teto de 60) e também não pedia quarteirão (com 50 m de fundo bastariam 40 m
  // de testada). Ele ficava na cabeça da fila para sempre, e como a fila vem
  // ordenada do maior para o menor, a espiada de 20 posições nunca alcançava
  // um lote pequeno. A cidade inteira parou atrás de uma carteira.
  //
  // Com o fundo cheio, os dois limites passam a ser O MESMO número: a fileira
  // aceita até `FRENTE_MAX * faixa` e o quarteirão começa exatamente aí. Não há
  // mais buraco entre as duas regras, e é isso que garante que a fila anda.
  //
  // ⚠️ E A TESTADA SAI DO FUNDO, não o contrário: `frente = area / faixa`,
  // limitada entre 5 e 60 m. Um lote de 312 m² numa faixa de 50 vira 6,2 x 50,
  // que é lote de casa de canal de Amsterdam (5 a 6 m de testada). Um de 10 m²
  // vira 5 x 2. Nenhum lote fica com área inflada pelo fundo que não usa.

  /** a testada que esta carteira ocupa na faixa */
  const frenteDe = (area: number, faixa: number) =>
    Math.min(FRENTE_MAX, Math.max(FRENTE_MIN, area / faixa))

  /** o fundo que sobra dela, sempre dentro da faixa */
  const fundoDe = (area: number, faixa: number) =>
    Math.min(faixa, area / frenteDe(area, faixa))

  /** ela cabe numa faixa, ou so num quarteirao inteiro? */
  const pedeQuarteirao = (area: number, faixa: number) => area / FRENTE_MAX > faixa

  /**
   * Os trechos VIVOS de uma fileira, em pares de angulo.
   *
   * ⚠️ A MASCARA E TESTADA NA PEGADA DA CELULA, nao no eixo: quatro cantos por
   * passo de sonda. Testar so a linha do meio poe lote com o pe na agua, que e
   * a mesma armadilha que o anel viario pagou em 18/09.
   */
  function trechosVivos(r0: number, r1: number, a0: number, a1: number): [number, number][] {
    const rm = (r0 + r1) / 2
    const passoAng = PASSO_SONDA / Math.max(1, rm)
    const n = Math.max(1, Math.ceil((a1 - a0) / passoAng))
    const out: [number, number][] = []
    let ini = -1
    for (let k = 0; k < n; k++) {
      const b0 = a0 + ((a1 - a0) * k) / n
      const b1 = a0 + ((a1 - a0) * (k + 1)) / n
      const rej = testarCantos(cantosDe(r0, r1, b0, b1))
      if (rej) {
        rejeicoes[rej]++
        if (ini >= 0) { out.push([ini, b0]); ini = -1 }
      } else if (ini < 0) ini = b0
    }
    if (ini >= 0) out.push([ini, a1])
    return out
  }

  // ⚠️ A VAGA FICA ABERTA ATE O ANEL ACABAR, e esta foi a terceira lição do dia.
  // Na versão anterior a fileira era varrida UMA vez: quando a cabeça da fila
  // não cabia no que restava dela, a fileira fechava e a ponta ia fora. Como a
  // fila vem ordenada do maior para o menor, a cabeça quase nunca cabia numa
  // ponta, e a cidade perdeu 1.276 km de testada em pontas abandonadas.
  //
  // Agora as vagas de um anel ficam TODAS abertas enquanto o anel estiver em
  // uso, e cada carteira procura a primeira que a comporte. As pontas pequenas
  // sobram para as carteiras menores, que chegam depois.
  //
  // ⚠️ E O ANEL E A FRONTEIRA DISSO, de propósito. Deixar a vaga aberta pela
  // cidade inteira faria a última carteira da fila cair numa ponta sobrando no
  // anel 2, ou seja endereço central para quem chegou por último, que é
  // exatamente o que a régua existe para impedir. Quando o anel se esgota, o
  // que sobrou nele é abandonado e a fila segue para fora. A ordem manda no
  // anel; dentro do anel, o encaixe manda.
  // ⚠️ A QUADRA PROFUNDA, e ela existe porque a superquadra estava jogando terra
  // fora. Um lote de 3.000 m² não cabe numa faixa de 50 (precisaria de 60 m de
  // testada, o teto) e, na versão anterior, tomava o QUARTEIRÃO INTEIRO de
  // 12.300 m²: 75% de desperdício, e com 620 carteiras nessa faixa de tamanho a
  // cidade ficava sem quadra para elas (todas as 620 que sobraram eram isto).
  //
  // O certo é o óbvio depois de visto: lote grande não precisa de mais QUADRA,
  // precisa de mais FUNDO. Ele atravessa o quarteirão inteiro de rua a rua (110
  // a 286 m de profundidade, sem travessa no meio) e ocupa só um pedaço do arco.
  // Aquele mesmo lote de 3.000 m² vira 27 x 110, que é quadra de armazém, não
  // um quarteirão inteiro vazio.
  //
  // ⚠️ E O QUARTEIRAO E DE UM MODO SO: ou ele se divide em faixas, ou ele é
  // profundo. Quem chega primeiro decide, e como a fila vem do maior para o
  // menor, quem decide é sempre o maior. Misturar os dois no mesmo quarteirão
  // exigiria contabilidade de arco por faixa, que é onde este loteador já se
  // perdeu três vezes.
  interface Vaga {
    r0: number; r1: number; a0: number; a1: number; faixa: number
    i: number; j: number; cursor: number
    bloco: number; profunda: boolean
  }

  /** os trechos vivos de uma faixa viram vagas abertas */
  function vagasDaFaixa(r0: number, r1: number, a0: number, a1: number, i: number, j: number,
                        bloco: number, profunda = false): Vaga[] {
    const faixa = r1 - r0
    return trechosVivos(r0, r1, a0, a1)
      .map(([t0, t1]) => ({ r0, r1, a0: t0, a1: t1, faixa, i, j, cursor: t0, bloco, profunda }))
  }

  const esperandoBloco: number[] = []   // indices de carteira que pedem quarteirao e ainda nao acharam

  for (let i = 0; i < ANEIS.length - 1 && cabeca(); i++) {
    const passo = passoDoAnel(i)

    // ── 1. as vagas e os blocos livres deste anel ──────────────────────────
    const vagas: Vaga[] = []
    const blocos: { a0: number; a1: number; rIn: number; rOut: number; j: number; area: number }[] = []
    for (let j = 0; j < N_RAD; j += passo) {
      const a0 = anguloDe(j), a1 = anguloDe(j + passo)
      const am = (a0 + a1) / 2
      const rIn = anelRaio(ANEIS[i], am) + MEIA_RUA
      const rOut = anelRaio(ANEIS[i + 1], am) - MEIA_RUA
      const prof = rOut - rIn
      if (prof < MIN_FAIXA) continue
      let k = 1
      for (let t = 5; t >= 2; t--) if (t * MIN_FAIXA + (t - 1) * TRAVESSA <= prof) { k = t; break }
      const faixa = (prof - (k - 1) * TRAVESSA) / k
      const arco = (a1 - a0) * ((rIn + rOut) / 2)
      disponivelAnel[i] += k * arco
      const b = blocos.length
      blocos.push({ a0, a1, rIn, rOut, j, area: arco * prof })
      for (let f = 0; f < k; f++) {
        const rf0 = rIn + f * (faixa + TRAVESSA)
        for (const v of vagasDaFaixa(rf0, rf0 + faixa, a0, a1, i, j, b)) vagas.push(v)
      }
      // a mesma quadra, oferecida INTEIRA a quem precisa de fundo
      for (const v of vagasDaFaixa(rIn, rOut, a0, a1, i, j, b, true)) vagas.push(v)
    }
    if (!vagas.length && !blocos.length) continue

    const blocoLivre = blocos.map(() => true)
    const sobra = (v: Vaga) => (v.a1 - v.cursor) * ((v.r0 + v.r1) / 2)

    /** o quarteirao (ou os vizinhos) para quem nao cabe em faixa */
    const tentaBloco = (idx: number): boolean => {
      const c = carteiras[idx]
      for (let b = 0; b < blocos.length; b++) {
        if (!blocoLivre[b]) continue
        let n = 1, acc = blocos[b].area
        while (acc < c.area_m2 && n < 4 && b + n < blocos.length && blocoLivre[b + n]
               && Math.abs(blocos[b + n].a0 - blocos[b + n - 1].a1) < 1e-9) {
          acc += blocos[b + n].area; n++
        }
        if (acc < c.area_m2 * 0.9) continue
        const aFim = blocos[b + n - 1].a1
        const { rIn, rOut, a0, j } = blocos[b]
        if (testarCantos(cantosDe(rIn, rOut, a0, aFim))) continue
        registrarLote(c, rIn, rOut, a0, aFim, i, j)
        superquadras++
        usadaAnel[i] += (aFim - a0) * ((rIn + rOut) / 2)
        for (let t = 0; t < n; t++) blocoLivre[b + t] = false
        tomada[idx] = 1
        avanca()
        return true
      }
      return false
    }

    // ── 2. quem ficou esperando quarteirao tenta primeiro, neste anel novo ──
    for (let e = esperandoBloco.length - 1; e >= 0; e--) {
      if (tomada[esperandoBloco[e]]) { esperandoBloco.splice(e, 1); continue }
      if (tentaBloco(esperandoBloco[e])) esperandoBloco.splice(e, 1)
    }

    // ── 3. a fila anda neste anel ate ninguem mais caber ────────────────────
    let primeira = 0
    while (cabeca()) {
      const idx = wp
      const c = carteiras[idx]
      // a maior faixa que este anel oferece decide se e caso de quarteirao
      const faixaMax = vagas.length ? Math.max(...vagas.map((v) => v.faixa)) : 0
      // quem nem na quadra profunda cabe (area maior que o quarteirao inteiro)
      // vai para os blocos vizinhos, e se nao houver, espera o proximo anel
      if (faixaMax > 0 && pedeQuarteirao(c.area_m2, faixaMax)) {
        const maiorProfunda = vagas.reduce((m, v) => (v.profunda && sobra(v) > 1 ? Math.max(m, v.faixa) : m), 0)
        if (maiorProfunda > 0 && pedeQuarteirao(c.area_m2, maiorProfunda)) {
          if (tentaBloco(idx)) continue
          esperandoBloco.push(idx)
          tomada[idx] = 1
          avanca()
          continue
        }
      }
      while (primeira < vagas.length && sobra(vagas[primeira]) < FRENTE_MIN) primeira++
      let alvo = -1
      for (let v = primeira; v < vagas.length; v++) {
        const vg = vagas[v]
        // ⚠️ A VAGA PROFUNDA SO SERVE A QUEM PRECISA DELA. Sem esta linha o
        // primeiro lote pequeno tomaria a quadra profunda inteira e o modo do
        // quarteirão seria decidido por quem menos precisava dele.
        if (vg.profunda && !pedeQuarteirao(c.area_m2, faixaMax)) continue
        if (!vg.profunda && pedeQuarteirao(c.area_m2, faixaMax)) continue
        if (frenteDe(c.area_m2, vg.faixa) <= sobra(vg)) { alvo = v; break }
      }
      if (alvo < 0) break               // o anel se esgotou para esta carteira
      const v = vagas[alvo]
      const frente = frenteDe(c.area_m2, v.faixa)
      const fundo = fundoDe(c.area_m2, v.faixa)
      const rm = (v.r0 + v.r1) / 2
      const dAng = frente / rm
      registrarLote(c, v.r0, v.r0 + fundo, v.cursor, v.cursor + dAng, i, v.j)
      v.cursor += dAng
      usadaAnel[i] += frente
      if (v.profunda) superquadras++
      // o quarteirao acabou de escolher o modo dele: fecha o outro
      for (const w of vagas) {
        if (w.bloco === v.bloco && w.profunda !== v.profunda) w.cursor = w.a1
      }
      tomada[idx] = 1
      avanca()
    }
  }

  // ⚠️ QUEM PEDIU QUARTEIRAO E NUNCA ACHOU fica registrado como fora, e o numero
  // aparece na saida: e ele que diz se a cidade precisa de quadra maior.
  const plantadas = new Set(lotes.map((l) => l.posicao))
  const semBloco = esperandoBloco.filter((k) => !plantadas.has(carteiras[k].posicao)).length


  // ─────────────────────────────────────────────────────────────────────
  // SAIDA
  // ─────────────────────────────────────────────────────────────────────
  mkdirSync('/tmp/lotear', { recursive: true })

  const areas = lotes.map((l) => l.area).sort((a, b) => a - b)
  const mediana = areas.length ? areas[Math.floor(areas.length / 2)] : 0
  const menor = areas[0] ?? 0
  const maior = areas[areas.length - 1] ?? 0
  const disponivelM = disponivelAnel.reduce((s, v) => s + v, 0)
  const usadaM = usadaAnel.reduce((s, v) => s + v, 0)
  const sobraM = disponivelM - usadaM

  const areasElegiveis = carteiras.map((c) => c.area_m2).sort((a, b) => a - b)
  const medianaElegiveis = areasElegiveis.length ? areasElegiveis[Math.floor(areasElegiveis.length / 2)] : 0

  const porAnel = disponivelAnel.map((disp, i) => ({
    anel: i,
    raio: ANEIS[i],
    disponivel_m: Math.round(disp),
    usada_m: Math.round(usadaAnel[i]),
    uso_pct: disp > 0 ? +((usadaAnel[i] / disp) * 100).toFixed(1) : 0,
  }))

  // aneis sem NENHUM lote (nem superquadra, nem fileira), medido pelos
  // lotes de verdade, nao so pela testada usada
  const aneisComLote = new Set(lotes.map((l) => l.anel))
  const aneisSemLote = disponivelAnel.length - aneisComLote.size
  const testadaAneis0a6M = usadaAnel.slice(0, 7).reduce((s, v) => s + v, 0)

  const resumo = {
    plantadas: lotes.length,
    plantadas_segunda_passada: plantadasSegunda,
    total_carteiras: TOTAL_CARTEIRAS,
    elegiveis: carteiras.length,
    fora: TOTAL_CARTEIRAS - lotes.length,
    mediana_area_m2: mediana,
    mediana_area_elegiveis_m2: medianaElegiveis,
    menor_lote_m2: menor,
    maior_lote_m2: maior,
    ultimo_anel: { indice: ultimoAnelIdx, raio: ultimoAnelIdx >= 0 ? ANEIS[ultimoAnelIdx] : null },
    testada_disponivel_km: +(disponivelM / 1000).toFixed(3),
    testada_sobra_km: +(sobraM / 1000).toFixed(3),
    rejeicoes,
    superquadras,
    aneis_sem_lote: aneisSemLote,
    testada_usada_aneis_0a6_m: Math.round(testadaAneis0a6M),
    por_anel: porAnel,
  }

  writeFileSync('/tmp/lotear/lotes.json', JSON.stringify(lotes))
  writeFileSync('/tmp/lotear/resumo.json', JSON.stringify(resumo, null, 2))

  const fmt = (n: number) => n.toLocaleString('pt-BR')

  const linhasPorAnel = porAnel
    .map((p) => `  anel ${String(p.anel).padStart(2, '0')}  raio ${fmt(p.raio)}  uso ${p.uso_pct}%`)
    .join('\n')

  console.log(`
plantadas             ${fmt(resumo.plantadas)} de ${fmt(resumo.total_carteiras)}  (${fmt(resumo.fora)} de fora)
plantadas na 2a passada ${fmt(plantadasSegunda)}
mediana de area        ${fmt(mediana)} m2  (mediana das elegiveis: ${fmt(medianaElegiveis)} m2)
menor e maior lote      ${fmt(menor)} m2 ate ${fmt(maior)} m2
ultimo anel usado      indice ${resumo.ultimo_anel.indice}, raio ${resumo.ultimo_anel.raio}
testada consumida por anel
${linhasPorAnel}
testada total disponivel ${resumo.testada_disponivel_km} km, sobraram ${resumo.testada_sobra_km} km
rejeicoes por mascara   agua ${rejeicoes.agua} / programa ${rejeicoes.programa} / ancora ${rejeicoes.ancora} / ilha ${rejeicoes.ilha} / avenida ${rejeicoes.avenida} / canal ${rejeicoes.canal} / alca ${rejeicoes.alca}
superquadras            ${superquadras}
aneis sem nenhum lote   ${resumo.aneis_sem_lote} de ${disponivelAnel.length}
testada usada aneis 0-6 ${fmt(resumo.testada_usada_aneis_0a6_m)} m
`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
