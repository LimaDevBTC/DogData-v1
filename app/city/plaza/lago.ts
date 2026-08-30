// ═══════════════════════════════════════════════════════════════════════════
// O LAGO DA PRAÇA: o anel de água entre a Praça Central e a cidade, com quatro
// pontes atravessando e ilhas reservadas para projeto parceiro.
//
// ⚠️ ELE NÃO CUSTA UM LOTE, e é isso que torna a ideia barata. O lote começa em
// r 1.300 e a muralha do precinto está em r 900: os 400 m entre os dois nunca
// tiveram endereço nenhum. O anel era regolito vazio, e regolito vazio no meio
// da cidade é a coisa que mais denuncia que a cidade não foi projetada.
//
// ⚠️ E ELE EXIGIU MEXER NO TERRENO, o que foi medido antes de decidir. Sonda de
// 36 rumos em r 1.300: o regolito ia de −18,7 a +25,1, ou seja 43,8 m de
// amplitude só por rumo. Uma lâmina plana ali afundaria 18,7 m de um lado e
// boiaria 25,1 m do outro. Por isso `terrain.ts` estendeu o platô de 960 para
// 1.340 e escavou uma bacia dentro dele: com o anel inteiro no nível 0, a água
// fica plana e o barranco tem a mesma altura em toda a volta.
//
// A GEOMETRIA, publicada por terrain.ts em `lago`:
//   fundo   −26 m      a bacia escavada no platô
//   lâmina  −17 m      9 m de água
//   margem  r 1.020 a 1.200, mais 70 m de talude de cada lado
//
// ⚠️ AS QUATRO PONTES CAEM NOS BULEVARES, nos rumos 0, 90, 180 e 270. Não é
// simetria por simetria: os quatro são costura de setor, então a ponte entrega
// quem atravessa direto no eixo radial que leva ao Cinturão. Ponte que
// desembarca no meio de um quarteirão seria ponte para lugar nenhum.
//
// AS ILHAS são reservas nomeadas, e é assim que elas têm de ler antes de
// existir projeto: um disco de terra com cais, sem construção em cima. A
// primeira é do Dog Social Club por decisão do fundador; as outras sete ficam
// marcadas para projeto parceiro.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'

export interface LagoOpts {
  heightAt: (x: number, z: number) => number
  lago: { r0: number; r1: number; agua: number; fundo: number }
  sombra?: boolean
}

export interface Ilha { id: string; nome: string; x: number; z: number; r: number; dono: string | null }

/**
 * ⚠️ A MARGEM DA ILHA NÃO É UM CÍRCULO, E QUEM PLANTA NELA PRECISA DA MESMA CURVA.
 * Se a praia usar o raio deformado e a floresta usar o raio redondo, a palmeira
 * nasce na água num lado da ilha e no meio da trilha no outro. Por isso o contorno
 * é uma função exportada, e não uma conta repetida em dois arquivos.
 * `k` é o índice da ilha (cada uma deforma diferente), `a` o ângulo em radianos.
 */
export function contornoIlha(k: number, a: number, base: number): number {
  return base * (1 + 0.062 * Math.sin(a * 3 + k) + 0.038 * Math.sin(a * 5 - k * 2))
}

/** o ângulo LOCAL da ilha `k` onde o píer encosta: nada de mato pode nascer nele */
export function anguloDesembarque(k: number): number {
  const ang = ((22.5 + k * 45) * Math.PI) / 180
  return Math.atan2(Math.cos(ang), -Math.sin(ang))
}

export interface Lago {
  group: THREE.Group
  /** avança a ondulação da água; chame no laço com o tempo em segundos */
  update(t: number): void
  pontes: number
  ilhas: Ilha[]
  areaHa: number
  triangulos: number
  dispose(): void
}

// ⚠️ A ÁGUA DO LAGO NÃO USA O AZUL DAS PEÇAS.
// (ver também `aguaDeVerdade()` no fim do arquivo: o azul sozinho não resolve) `#16283C` é o azul de lâmina
// pequena (espelho de praça, piscina), e ele foi escolhido para ler contra
// calçada clara em peça de 60 m. Num lago de 173 ha cercado de regolito claro no
// platô ele lê PRETO: a chapa mostrava um fosso de sombra e não água. Este aqui é
// o mesmo azul um passo mais claro e mais saturado, que é o que faz a lâmina
// pegar o sol raso e virar água.
export const COR_AGUA = '#1D4A66'
const COR_PRAIA = '#8E856F'
const COR_PISO = '#CBC4B6'
const COR_ESTRUTURA = '#8F8879'
const COR_PISTA = '#57534B'
const COR_TRILHA = '#A79C86'   // saibro: a trilha da ilha não é pista de atletismo
const COR_MATO = '#6C7A5B'     // o verde fechado da mata, mais escuro que o gramado
const COR_TERRA = '#7E8A6B'

/** acumulador por cor, com o mesmo cuidado de sentido de face do kit das peças */
class Balde {
  vs: number[] = []; ix: number[] = []
  quad(A: number[], B: number[], C: number[], D: number[]) {
    // ⚠️ a componente Y de u x v é uz*vx - ux*vz. Escrever ao contrário vira
    // justamente as faces que já estavam certas: foi o que apagou as praças e os
    // anéis viários em 29/08, duas vezes no mesmo dia.
    const ny = (B[2] - A[2]) * (C[0] - B[0]) - (B[0] - A[0]) * (C[2] - B[2])
    const [p, q, r, s] = ny >= 0 ? [A, B, C, D] : [A, D, C, B]
    const i = this.vs.length / 3
    this.vs.push(...p, ...q, ...r, ...s)
    this.ix.push(i, i + 1, i + 2, i, i + 2, i + 3)
  }
}

export function buildLago(o: LagoOpts): Lago {
  const group = new THREE.Group()
  group.name = 'lago'
  const L = o.lago
  const baldes = new Map<string, Balde>()
  const B = (cor: string) => {
    let b = baldes.get(cor)
    if (!b) { b = new Balde(); baldes.set(cor, b) }
    return b
  }
  const P = (x: number, z: number, y: number) => [x, y, z]
  const NO = (x: number, z: number, off: number) => [x, o.heightAt(x, z) + off, z]

  // ── 1. a lâmina d'água ───────────────────────────────────────────────────
  // ⚠️ ELA VAI ALÉM DA MARGEM NOMINAL DE PROPÓSITO. A bacia tem talude de 70 m
  // de cada lado, e a linha d'água cai DENTRO do talude, não na quebra: estender
  // a lâmina 60 m para dentro e para fora garante que ela morra enterrada no
  // barranco em vez de terminar num degrau boiando.
  const rAguaI = L.r0 - 38, rAguaE = L.r1 + 38
  {
    const b = B(COR_AGUA)
    const seg = 240
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2
      const p = (r: number, a: number) => P(Math.sin(a) * r, -Math.cos(a) * r, L.agua)
      b.quad(p(rAguaI, a0), p(rAguaI, a1), p(rAguaE, a1), p(rAguaE, a0))
    }
  }

  // ── 2. OS DOIS ANÉIS DE MARGEM, QUE SÃO VIA E NÃO CALÇADA ────────────────
  //
  // ⚠️ ESTE BLOCO ERA UM PASSEIO DE 14 m E ISSO ESTAVA ERRADO, e o defeito era
  // de SISTEMA e não de desenho. Sondei o chão nos quatro rumos onde as pontes
  // encostam: do lado da praça, em r 960 e 990, a ponte desembocava em REGOLITO
  // PURO, sem via nenhuma. E do lado de fora, as quatro pontes chegavam na
  // cidade sem nada que as ligasse entre si: para ir da ponte norte à ponte
  // leste era preciso atravessar a praça inteira ou dar a volta pela cidade.
  // Quatro pontes espetaculares que não formam rede não são rede, são quatro
  // becos. O fundador viu isso de cima antes de eu medir.
  //
  // Agora são dois ANÉIS VIÁRIOS de verdade, com seção:
  //   ANEL DA PRAÇA  r 975, 20 m   recebe as pontes do lado de dentro
  //   ANEL DA ORLA   r 1.440, 26 m recebe as pontes do lado de fora e alimenta
  //                                os 12 bulevares, que passaram a começar em
  //                                1.420 para encostar nele (gerar_cidade.py)
  // Com eles o sistema fecha: praça → ponte → orla → bulevar → anel → Cinturão.
  const R_ANEL_PRACA = 975, LARG_PRACA = 20
  const R_ANEL_ORLA = L.r1 + 50, LARG_ORLA = 26
  const aneisDeMargem = [
    { r: R_ANEL_PRACA, larg: LARG_PRACA },
    { r: R_ANEL_ORLA, larg: LARG_ORLA },
  ]
  for (const an of aneisDeMargem) {
    const seg = Math.max(160, Math.ceil((2 * Math.PI * an.r) / 18))
    // seção: calçada 3 + pista (larg-6) + calçada 3, com a guia de 15 cm
    const bandas: [number, number, number, string][] = [
      [0, 3, 0.8, COR_PISO],
      [3, an.larg - 3, 0.65, COR_PISTA],
      [an.larg - 3, an.larg, 0.8, COR_PISO],
    ]
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2
      for (const [de, ate, alt, cor] of bandas) {
        const b = B(cor)
        const p = (t: number, a: number) => {
          const r = an.r - an.larg / 2 + t
          return NO(Math.sin(a) * r, -Math.cos(a) * r, alt)
        }
        b.quad(p(de, a0), p(de, a1), p(ate, a1), p(ate, a0))
      }
    }
  }
  // a faixa de praia entre o anel e a água, mais clara que o regolito
  for (const [rIn, rOut] of [[L.r0 - 42, L.r0 - 14], [L.r1 + 14, L.r1 + 42]]) {
    const b = B(COR_PRAIA)
    const seg = Math.max(120, Math.ceil((2 * Math.PI * rOut) / 18))
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2
      const nr = 4
      for (let j = 0; j < nr; j++) {
        const ra = rIn + ((rOut - rIn) * j) / nr, rb = rIn + ((rOut - rIn) * (j + 1)) / nr
        const p = (r: number, a: number) => NO(Math.sin(a) * r, -Math.cos(a) * r, 0.55)
        b.quad(p(ra, a0), p(ra, a1), p(rb, a1), p(rb, a0))
      }
    }
  }
  // ⚠️ A ROTATÓRIA EM CADA CABECEIRA, e ela não é enfeite: é o que faz a ponte
  // ENTREGAR em vez de despejar. Sem ela o tabuleiro de 26 m morre numa faixa de
  // via de 20 e quem chega não tem para onde virar.
  for (const rumo of [0, 90, 180, 270]) {
    const ang = (rumo * Math.PI) / 180
    for (const an of aneisDeMargem) {
      const cx = Math.sin(ang) * an.r, cz = -Math.cos(ang) * an.r
      const N = 36, RE = 26, RI = 11
      for (let k = 0; k < N; k++) {
        const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2
        const P2 = (rr: number, aa: number, off: number) =>
          NO(cx + Math.cos(aa) * rr, cz + Math.sin(aa) * rr, off)
        B(COR_PISTA).quad(P2(RI, a0, 0.65), P2(RI, a1, 0.65), P2(RE, a1, 0.65), P2(RE, a0, 0.65))
        B(COR_TERRA).quad(P2(0, a0, 0.9), P2(0, a1, 0.9), P2(RI, a1, 0.9), P2(RI, a0, 0.9))
      }
    }
  }

  // ── 3. as quatro pontes ──────────────────────────────────────────────────
  // Tabuleiro de 26 m de largura a +7 m do platô, atravessando os 420 m de anel.
  // Duas torres por ponte, de 74 m, com tirantes: é a silhueta que faz a ponte
  // ser vista da praça e do outro lado, que é o que o fundador pediu quando
  // disse "espetaculares".
  // ⚠️ A PONTE VAI DE ANEL A ANEL, e não de praia a praia. Antes ela começava em
  // L.r0 - 70 e terminava em L.r1 + 70, ou seja no meio do nada dos dois lados.
  const R_PONTE_I = R_ANEL_PRACA, R_PONTE_E = R_ANEL_ORLA
  const LARG = 26, Y_DECK = 7.0
  //
  // ⚠️ O TABULEIRO NÃO TINHA RAMPA, E ISSO SÓ APARECEU NA SONDA. Levar a ponte de
  // anel a anel resolveu O PLANO (ela passou a encostar em via dos dois lados),
  // mas não o PERFIL: `Y_DECK` era constante, então a ponte chegava na rotatória
  // a 7 m de altura e a rotatória estava a 0,65 m. Vista de cima parecia ligada;
  // de lado era uma laje voando com um degrau de 6,35 m na cabeceira. Ligação em
  // planta sem ligação em corte não é ligação.
  //
  // Agora o perfil é de viaduto: encontro no nível da via, rampa de 28% do vão
  // (130 m para 6,2 m, ou 4,8%), patamar no meio. A concordância é suavizada
  // (`3k² − 2k³`) porque emenda reta deixa QUINA na crista, e quina numa peça de
  // 465 m aparece de longe.
  const Y_ENC = 0.8                 // o nível do anel, onde o tabuleiro encosta
  const RAMPA = 0.28
  const yDeck = (t: number) => {
    const k = t < RAMPA ? t / RAMPA : t > 1 - RAMPA ? (1 - t) / RAMPA : 1
    return Y_ENC + (Y_DECK - Y_ENC) * (k * k * (3 - 2 * k))
  }
  const TORRES = [0.30, 0.70]        // fração do vão onde cada torre sobe
  const H_TORRE = 74
  let pontes = 0
  for (const rumo of [0, 90, 180, 270]) {
    pontes++
    const ang = (rumo * Math.PI) / 180
    const dx = Math.sin(ang), dz = -Math.cos(ang)
    const px = Math.cos(ang), pz = Math.sin(ang)
    const eixo = (t: number) => {
      const r = R_PONTE_I + (R_PONTE_E - R_PONTE_I) * t
      return [dx * r, dz * r] as const
    }
    // tabuleiro
    {
      const b = B(COR_PISO)
      const n = 40
      for (let k = 0; k < n; k++) {
        const [x0, z0] = eixo(k / n), [x1, z1] = eixo((k + 1) / n)
        const y0 = yDeck(k / n), y1 = yDeck((k + 1) / n)
        b.quad(
          P(x0 - px * LARG / 2, z0 - pz * LARG / 2, y0),
          P(x1 - px * LARG / 2, z1 - pz * LARG / 2, y1),
          P(x1 + px * LARG / 2, z1 + pz * LARG / 2, y1),
          P(x0 + px * LARG / 2, z0 + pz * LARG / 2, y0),
        )
      }
      // as duas laterais do tabuleiro, para ele ter espessura vista de lado
      const be = B(COR_ESTRUTURA)
      for (const s of [-1, 1]) {
        for (let k = 0; k < n; k++) {
          const [x0, z0] = eixo(k / n), [x1, z1] = eixo((k + 1) / n)
          const ox = px * s * LARG / 2, oz = pz * s * LARG / 2
          const y0 = yDeck(k / n), y1 = yDeck((k + 1) / n)
          // ⚠️ NA RAMPA A SAIA TEM DE MORRER NO CHÃO e não acompanhar o tabuleiro:
          // uma viga de 3,2 m pendurada sob o encontro fica boiando sobre a via.
          const e0 = Math.min(3.2, y0 - Y_ENC + 0.6), e1 = Math.min(3.2, y1 - Y_ENC + 0.6)
          be.quad(
            P(x0 + ox, z0 + oz, y0), P(x1 + ox, z1 + oz, y1),
            P(x1 + ox, z1 + oz, y1 - e1), P(x0 + ox, z0 + oz, y0 - e0),
          )
        }
      }
    }
    // torres e tirantes
    for (const t of TORRES) {
      const [tx, tz] = eixo(t)
      const b = B(COR_ESTRUTURA)
      // a torre: um prisma de 4 faces, do fundo da bacia ao topo
      const base = L.fundo
      const lado = 7
      for (const s of [-1, 1]) {
        const ox = px * s * (LARG / 2 - 1), oz = pz * s * (LARG / 2 - 1)
        for (let f = 0; f < 4; f++) {
          const a = (f / 4) * Math.PI * 2, a2 = ((f + 1) / 4) * Math.PI * 2
          const c1x = tx + ox + Math.cos(a) * lado, c1z = tz + oz + Math.sin(a) * lado
          const c2x = tx + ox + Math.cos(a2) * lado, c2z = tz + oz + Math.sin(a2) * lado
          b.quad(P(c1x, c1z, base), P(c2x, c2z, base),
                 P(c2x, c2z, Y_DECK + H_TORRE), P(c1x, c1z, Y_DECK + H_TORRE))
        }
        // tirantes: seis fitas finas do topo da torre até o tabuleiro
        for (let k = 1; k <= 6; k++) {
          const d = (k / 7) * (R_PONTE_E - R_PONTE_I) * 0.34
          for (const dir of [-1, 1]) {
            const ta = t + (dir * d) / (R_PONTE_E - R_PONTE_I)
            const [ax, az] = eixo(ta)
            const w = 0.9
            // o tirante ancora ONDE O TABULEIRO ESTÁ, que na rampa já não é 7 m
            b.quad(
              P(tx + ox - px * w, tz + oz - pz * w, Y_DECK + H_TORRE),
              P(tx + ox + px * w, tz + oz + pz * w, Y_DECK + H_TORRE),
              P(ax + ox + px * w, az + oz + pz * w, yDeck(ta)),
              P(ax + ox - px * w, az + oz - pz * w, yDeck(ta)),
            )
          }
        }
      }
    }
  }

  // ── 4. as ilhas ──────────────────────────────────────────────────────────
  //
  // ⚠️ ELAS ERAM DISCOS DE TERRA E O FUNDADOR CHAMOU DE GENÉRICAS, com razão: um
  // disco verde com mato jogado em cima não é ilha, é mancha. Ilha de verdade tem
  // ORLA (praia, e a praia é o que faz a água ter margem), tem MIOLO (a floresta),
  // tem CLAREIRA (senão não há para onde ir), tem TRILHA ligando as duas, e tem
  // um jeito de CHEGAR. Sem os cinco ela continua sendo mancha por mais palmeira
  // que se plante.
  //
  // ⚠️ E ELAS CONTINUAM SENDO RESERVA. O que está desenhado é o SÍTIO: praia,
  // trilha, clareira e píer. Projeto de parceiro entra na clareira, que é
  // exatamente o pedaço deixado livre. A primeira é do Dog Social Club por
  // decisão do fundador, e por isso ela é maior e tem praça em vez de clareira.
  const rIlha = (rAguaI + rAguaE) / 2
  const ilhas: Ilha[] = []
  for (let k = 0; k < 8; k++) {
    const rumo = 22.5 + k * 45                    // entre as pontes, nunca sob elas
    const ang = (rumo * Math.PI) / 180
    const x = Math.sin(ang) * rIlha, z = -Math.cos(ang) * rIlha
    const dsc = k === 0
    const raio = dsc ? 92 : 54 + (k % 3) * 9      // ⚠️ raio VARIADO: oito ilhas do
                                                  // mesmo tamanho leem como carimbo
    ilhas.push({
      id: `ILHA${String(k + 1).padStart(2, '0')}`,
      nome: dsc ? 'Ilha do Dog Social Club' : `Ilha ${k + 1}, reservada`,
      x, z, r: raio, dono: dsc ? 'Dog Social Club' : null,
    })
    const seg = 44
    const p = (r: number, a: number, y: number) => P(x + Math.cos(a) * r, z + Math.sin(a) * r, y)
    // ⚠️ A MARGEM NÃO É UM CÍRCULO. Dois harmônicos deformam o raio em ±9%: é o
    // suficiente para a ilha ter enseada e ponta, e é o que separa terra de moeda.
    const rr = (a: number, base: number) => contornoIlha(k, a, base)
    for (let j = 0; j < seg; j++) {
      const a0 = (j / seg) * Math.PI * 2, a1 = ((j + 1) / seg) * Math.PI * 2
      const R0 = (a: number) => rr(a, raio)           // linha d'água
      const R1 = (a: number) => rr(a, raio * 0.88)    // fim da praia
      const R2 = (a: number) => rr(a, raio * 0.70)    // trilha
      const R3 = (a: number) => rr(a, raio * 0.655)  // ⚠️ 4,5% do raio, não 8%:
                                                     // a trilha larga lia como
                                                     // pista de atletismo
      const R4 = (a: number) => rr(a, raio * (dsc ? 0.42 : 0.34))  // clareira
      // praia: da linha d'água para dentro, subindo
      B(COR_PRAIA).quad(p(R0(a0), a0, L.agua + 0.15), p(R0(a1), a1, L.agua + 0.15),
                        p(R1(a1), a1, L.agua + 1.5), p(R1(a0), a0, L.agua + 1.5))
      // mata: da praia até a trilha
      B(COR_MATO).quad(p(R1(a0), a0, L.agua + 1.5), p(R1(a1), a1, L.agua + 1.5),
                       p(R2(a1), a1, L.agua + 2.4), p(R2(a0), a0, L.agua + 2.4))
      // trilha: um anel de saibro, que é o que faz a ilha ser percorrível
      B(COR_TRILHA).quad(p(R2(a0), a0, L.agua + 2.6), p(R2(a1), a1, L.agua + 2.6),
                         p(R3(a1), a1, L.agua + 2.6), p(R3(a0), a0, L.agua + 2.6))
      // mata de novo, entre a trilha e a clareira
      B(COR_MATO).quad(p(R3(a0), a0, L.agua + 2.7), p(R3(a1), a1, L.agua + 2.7),
                       p(R4(a1), a1, L.agua + 3.0), p(R4(a0), a0, L.agua + 3.0))
      // ⚠️ A CLAREIRA DAS SETE RESERVADAS É GRAMADO E NÃO LAJE. Laje clara num
      // lote vazio lê como estacionamento; grama lê como terreno guardado.
      if (!dsc)
        B(COR_TERRA).quad(p(R4(a0), a0, L.agua + 3.1), p(R4(a1), a1, L.agua + 3.1),
                          p(0, a1, L.agua + 3.1), p(0, a0, L.agua + 3.1))
    }

    // ── o desembarque: a ponte de tábuas encontra a trilha ──────────────────
    //
    // ⚠️ ISTO É O MESMO DEFEITO DAS PONTES DO LAGO, EM MINIATURA. O píer parava
    // na areia e a trilha corria em anel sem tocar nele: quem desembarcava caía
    // no mato. Uma faixa radial de saibro costura os dois, e é o que transforma
    // praia + trilha + clareira em percurso em vez de três desenhos soltos.
    const aPier = anguloDesembarque(k)
    {
      const meia = 5.5 / raio                       // 5,5 m de meia-largura
      const passos = 10
      for (let j = 0; j < passos; j++) {
        const f0 = 0.30 + (0.62 * j) / passos, f1 = 0.30 + (0.62 * (j + 1)) / passos
        const y = L.agua + 3.0 - 0.5 * (f0 - 0.30) / 0.62   // desce da clareira para a praia
        const q = (f: number, da: number) => p(rr(aPier + da, raio * f), aPier + da, y)
        B(COR_TRILHA).quad(q(f0, -meia), q(f1, -meia), q(f1, meia), q(f0, meia))
      }
    }

    // ── o programa da Ilha do Dog Social Club ──────────────────────────────
    //
    // ⚠️ A CLAREIRA DELA ERA UMA LAJE BRANCA VAZIA OCUPANDO 40% DA ILHA, e um
    // vazio desse tamanho no meio de um cartão de visita não lê como reserva,
    // lê como esquecimento. As outras sete continuam guardadas (gramado, para o
    // projeto do parceiro entrar depois); esta é do Dog Social Club por decisão
    // do fundador, então ela é a única que já tem desenho.
    //
    // A composição é concêntrica e olha bem de cima, que é de onde a cidade é
    // vista: átrio de laje, banco corrido em anel, ESPELHO D'ÁGUA e pódio no
    // centro. O espelho repete a água do lago dentro da ilha, que é o truque que
    // faz a peça pertencer ao lago em vez de estar pousada nele.
    if (dsc) {
      const aro = (rf0: number, rf1: number, y0: number, y1: number, cor: string) => {
        for (let j = 0; j < seg; j++) {
          const a0 = (j / seg) * Math.PI * 2, a1 = ((j + 1) / seg) * Math.PI * 2
          B(cor).quad(p(rr(a0, raio * rf0), a0, y0), p(rr(a1, raio * rf0), a1, y0),
                      p(rr(a1, raio * rf1), a1, y1), p(rr(a0, raio * rf1), a0, y1))
        }
      }
      const Y0 = L.agua + 3.1
      aro(0.42, 0.345, Y0, Y0, COR_PISO)              // átrio
      aro(0.345, 0.335, Y0, Y0 + 0.55, COR_ESTRUTURA) // espelda do banco corrido
      aro(0.335, 0.315, Y0 + 0.55, Y0 + 0.55, COR_ESTRUTURA)
      aro(0.315, 0.305, Y0 + 0.55, Y0, COR_ESTRUTURA)
      // ⚠️ ESPELHO D'ÁGUA NO NÍVEL DO PISO É UM DISCO AZUL PINTADO. Sem parede
      // e sem recuo não há sombra na borda, e sem sombra na borda o olho lê
      // tinta e não líquido. A bacia desce 1,6 m e a lâmina fica 35 cm abaixo
      // do átrio: é o degrau que faz a água existir.
      aro(0.305, 0.295, Y0, Y0 - 1.6, COR_ESTRUTURA)  // a parede da bacia
      aro(0.295, 0.145, Y0 - 0.35, Y0 - 0.35, COR_AGUA)
      aro(0.145, 0.135, Y0 - 1.6, Y0 + 1.2, COR_PISO) // o pé do pódio, dentro da água
      aro(0.135, 0.0, Y0 + 1.2, Y0 + 1.2, COR_PISO)   // o pódio
      // os doze mastros do átrio: é o que dá altura e é o que se vê de longe
      for (let j = 0; j < 12; j++) {
        const a = (j / 12) * Math.PI * 2
        const mx = x + Math.cos(a) * rr(a, raio * 0.385), mz = z + Math.sin(a) * rr(a, raio * 0.385)
        for (let f = 0; f < 4; f++) {
          const b0 = (f / 4) * Math.PI * 2, b1 = ((f + 1) / 4) * Math.PI * 2
          const q = (bb: number, yy: number) => P(mx + Math.cos(bb) * 0.7, mz + Math.sin(bb) * 0.7, yy)
          B(COR_ESTRUTURA).quad(q(b0, Y0), q(b1, Y0), q(b1, Y0 + 15), q(b0, Y0 + 15))
        }
      }
    }

    // ⚠️ O PÍER APONTA PARA A PRAÇA, e não para um rumo qualquer: quem chega de
    // barco vem de lá, que é onde estão as pontes e a cidade velha.
    const dirX = -Math.sin(ang), dirZ = Math.cos(ang)
    const perX = Math.cos(ang), perZ = Math.sin(ang)
    const pIni = raio * 0.92, pFim = raio + 34, w = 4.5
    B(COR_ESTRUTURA).quad(
      P(x + dirX * pIni - perX * w, z + dirZ * pIni - perZ * w, L.agua + 1.4),
      P(x + dirX * pFim - perX * w, z + dirZ * pFim - perZ * w, L.agua + 1.4),
      P(x + dirX * pFim + perX * w, z + dirZ * pFim + perZ * w, L.agua + 1.4),
      P(x + dirX * pIni + perX * w, z + dirZ * pIni + perZ * w, L.agua + 1.4))
    // os pilares do píer, que é o que o faz ler como píer e não como tábua
    for (let j = 0; j <= 5; j++) {
      const t = pIni + ((pFim - pIni) * j) / 5
      for (const sgn of [-1, 1]) {
        const px2 = x + dirX * t + perX * w * 0.8 * sgn
        const pz2 = z + dirZ * t + perZ * w * 0.8 * sgn
        for (let f = 0; f < 4; f++) {
          const b0 = (f / 4) * Math.PI * 2, b1 = ((f + 1) / 4) * Math.PI * 2
          const q = (bb: number, yy: number) =>
            P(px2 + Math.cos(bb) * 0.5, pz2 + Math.sin(bb) * 0.5, yy)
          B(COR_ESTRUTURA).quad(q(b0, L.fundo), q(b1, L.fundo), q(b1, L.agua + 1.4), q(b0, L.agua + 1.4))
        }
      }
    }
  }

  // ── 5. uma malha por cor ─────────────────────────────────────────────────
  const feitas: THREE.Mesh[] = []
  let triangulos = 0
  baldes.forEach((b, cor) => {
    if (!b.ix.length) return
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.vs, 3))
    g.setIndex(b.ix)
    g.computeVertexNormals()
    const agua = cor === COR_AGUA
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      color: cor,
      // ⚠️ ÁGUA COM roughness 0,08 E metalness 0,35 NÃO LÊ COMO ÁGUA AQUI, e
      // isso foi medido na chapa: quase espelho, ela devolve o hemisfério claro
      // da cena inteira e some, virando uma chapa PÁLIDA que parece areia. O
      // valor de piscina de 60 m não serve numa lâmina de 293 ha vista de 400 m.
      // Com 0,30 e 0,02 a cor base manda e o brilho vira reflexo de sol e não
      // fundo de céu.
      roughness: agua ? 0.30 : 0.92,
      metalness: agua ? 0.02 : 0,
      side: THREE.DoubleSide,
    }))
    m.name = `lago:${agua ? 'agua' : cor}`
    m.receiveShadow = !agua
    m.castShadow = (o.sombra ?? true) && !agua
    m.frustumCulled = false
    group.add(m)
    feitas.push(m)
    triangulos += b.ix.length / 3
  })

  const areaHa = (Math.PI * (rAguaE * rAguaE - rAguaI * rAguaI)) / 1e4
  const relogios = feitas.map((m) => aguaDeVerdade(m)).filter(Boolean) as { value: number }[]
  return {
    group, pontes, ilhas, areaHa, triangulos,
    update(t: number) { for (const u of relogios) u.value = t },
    dispose() {
      for (const m of feitas) { m.geometry.dispose(); (m.material as THREE.Material).dispose() }
      group.clear()
    },
  }
}

/**
 * ⚠️ ÁGUA NÃO É UMA COR, É UM COMPORTAMENTO, e foi por não entender isso que eu
 * gastei três tentativas trocando o azul. Um MeshStandardMaterial azul liso é
 * uma CHAPA azul: de cima ela é do tom que se escreveu e de raso ela continua do
 * mesmo tom, o que nenhum líquido faz. O que faz o olho reconhecer água são
 * três coisas, e nenhuma delas é a cor:
 *
 *   1. FRESNEL. Olhando de cima você vê o corpo d'água (escuro); olhando de raso
 *      ela devolve o céu (claro). É o contraste entre esses dois extremos DENTRO
 *      da mesma lâmina que diz "isto é líquido".
 *   2. ONDULAÇÃO. Duas cristas cruzadas de período longo (26 e 40 m) inclinam a
 *      normal alguns graus. Não se vê a onda; vê-se o brilho do sol se partindo
 *      nela, e é isso que tira a cara de vidro parado.
 *   3. MOVIMENTO. As cristas andam. Uma lâmina parada num plano de 293 ha lê
 *      como piso polido.
 *
 * Tudo isso cabe em `onBeforeCompile`: zero draw call novo, zero material novo,
 * zero pós-processamento. A cena já compila 228 programas com teto medido de 235,
 * e um Reflector de verdade (que redesenha a cena por espelho) está proibido pela
 * spec da maquete, decisão D10.
 */
// ⚠️ EXPORTADO PARA OS CANAIS USAREM O MESMO COMPORTAMENTO. Água de canal com
// outro shader ficaria de outra cor e outro brilho ao lado da água do lago, e
// os dois se encontram: o canal desagua nele.
export function aguaDeVerdade(m: THREE.Mesh): { value: number } | null {
  if (!m.name.endsWith(':agua')) return null
  const mat = m.material as THREE.MeshStandardMaterial
  const uTempo = { value: 0 }
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTempo = uTempo
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMundoAgua;')
      .replace('#include <begin_vertex>',
               '#include <begin_vertex>\nvMundoAgua = (modelMatrix * vec4(position, 1.0)).xyz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>',
               '#include <common>\nuniform float uTempo;\nvarying vec3 vMundoAgua;')
      // a ondulação entra DEPOIS de a normal existir e ANTES de a luz ser somada
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        float ondaA = sin(vMundoAgua.x * 0.241 + uTempo * 0.62);
        float ondaB = sin(vMundoAgua.z * 0.157 - uTempo * 0.44);
        float ondaC = sin((vMundoAgua.x + vMundoAgua.z) * 0.083 + uTempo * 0.31);
        normal = normalize(normal + vec3(ondaA * 0.052 + ondaC * 0.021, 0.0,
                                         ondaB * 0.052 - ondaC * 0.019));
      `)
      // o fresnel entra no fim, sobre a cor já iluminada
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float cosI = clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0);
        float fres = pow(1.0 - cosI, 3.2);
        vec3 ceu = vec3(0.42, 0.52, 0.60);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, ceu, fres * 0.62);
      `)
  }
  mat.needsUpdate = true
  return uTempo
}
