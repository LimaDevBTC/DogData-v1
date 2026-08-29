// ═══════════════════════════════════════════════════════════════════════════
// A PRANCHETA: a ferramenta com que cada peça da DogCity é desenhada.
//
// Cada peça do programa tem MÓDULO PRÓPRIO em app/city/plaza/pecas/<id>.ts.
// Este arquivo é o que todos eles usam, e ele existe por dois motivos:
//
//  (1) as armadilhas medidas ficam resolvidas UMA vez, aqui dentro, em vez de
//      cada módulo ter chance de cair nelas de novo;
//  (2) um módulo de peça vira composição (números e chamadas) em vez de
//      geometria crua, que é onde se erra.
//
// ⚠️ AS TRÊS ARMADILHAS QUE ESTE ARQUIVO RESOLVE, TODAS MEDIDAS EM 29/08/2026:
//
//  A. SENTIDO DE FACE. Quad com os cantos na ordem errada nasce com a normal
//     para BAIXO e o backface culling apaga a face inteira. Pegou duas vezes no
//     mesmo dia: nas praças (piso, gramado, água e 2.112 covas invisíveis, só o
//     plinto aparecia) e nos anéis viários (sonda vertical achava 8 de 72
//     pontos). Aqui nenhum módulo escolhe ordem de canto: `quad()` normaliza.
//
//  B. COTA É CAMADA, NÃO MATERIAL. Dar uma cota fixa por material e desenhar um
//     piso corrido por cima apaga tudo que ficou embaixo. A base é sempre
//     Y.PARCELA e o que vem depois SOBE. Os degraus de 4 cm também são o que
//     evita z-fighting entre duas superfícies coplanares.
//
//  C. O CHÃO SEGUE O TERRENO, E O TERRENO NÃO É PLANO. `buildPecas` assenta a
//     peça numa altura só, a do centro. Numa elipse de 175 m passava; num Parque
//     Olímpico de 1.080 m uma ponta enterra e a outra flutua. Toda superfície
//     desenhada aqui amostra a altura de verdade, com passo de 18 m, que é o
//     vão que mede zero furo contra a malha do regolito (células de ~59 m).
//     Por isso a geometria sai em X e Z LOCAIS mas com Y de MUNDO, e
//     `buildPecas` só gira e translada no plano.
//
// ⚠️ QUADRO LOCAL: x é a testada da peça e z a profundidade, ambos em metros,
// com a origem no centro da parcela. A parcela vai de -a a +a e de -b a +b.
// MUNDO = R(rot) · LOCAL, a mesma convenção do `giro` da malha.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'

/** ⚠️ A PALETA É FECHADA. Cor nova em peça é material novo na cena, e material é
 *  o recurso escasso aqui (a vista de topo compila 228 programas, teto 235). */
export const COR = {
  CLARO: '#CBC4B6',      // calçada, adro, arquibancada, laje cívica
  MEDIO: '#8F8879',      // galpão, contêiner, mureta
  ESCURO: '#57534B',     // asfalto, pista de rolamento, cova de árvore
  VERDE: '#7E8A6B',      // grama, campo, sebe, canteiro
  AGUA: '#16283C',       // lâmina d'água
  TERRACOTA: '#8C4B3A',  // pista de atletismo, saibro, quadra
} as const
export type Cor = typeof COR[keyof typeof COR]

/** ⚠️ CAMADAS, NÃO MATERIAIS. PARCELA é o chão da peça, no nível da pista da rua
 *  (0,18). MOLDURA é a calçada de borda, no nível da calçada da rua (0,33), e é
 *  ela que faz a peça encostar na cidade sem degrau. Tudo abaixo do plinto de
 *  lote (0,45). Entre camadas há 4 cm, que é o que separa duas superfícies
 *  coplanares sem z-fighting. */
// ⚠️ 12 cm ENTRE CAMADAS, E O NÚMERO FOI MEDIDO NUMA PEÇA GRANDE. A primeira
// versão usava 4 cm, que é o que basta numa praça de quarto de 168 m e NÃO basta
// no Parque Olímpico de 1.080 m: a esplanada e o gramado brigaram no z-buffer e
// a chapa saiu com a cruz de esplanadas rasgada em mancha, e a Praça das
// Medalhas em estilhaço. Peça grande é vista de longe, e é de longe que a
// precisão de profundidade acaba.
// A MOLDURA fica fora da escada de propósito: ela é 0,33 porque é a calçada da
// RUA, e é isso que faz quem anda pela cidade entrar na peça sem degrau.
export const Y = {
  PARCELA: 0.18,
  L1: 0.30,
  L2: 0.42,
  L3: 0.54,
  MOLDURA: 0.33,
  L4: 0.66,
  L5: 0.78,
} as const

export interface Parte { geo: THREE.BufferGeometry; cor: string; agua?: boolean }
export interface Cova { x: number; z: number; r: number }

/** o que um módulo de peça recebe */
export interface Ctx {
  id: string
  nome: string
  tipo: string
  /** meia-extensão da parcela em x (metade da testada), em metros */
  a: number
  /** meia-extensão da parcela em z (metade da profundidade), em metros */
  b: number
  /** altura do terreno no ponto LOCAL (lx, lz). Já resolve o giro da peça. */
  alt(lx: number, lz: number): number
  /** ruído determinístico em [0,1); a peça é a mesma em toda visita */
  ruido(k: number): number
}

/** o que um módulo de peça devolve */
export interface Desenho {
  partes: Parte[]
  covas: Cova[]
}

const PASSO = 18   // vão máximo de uma superfície, em metros; ver armadilha C

/** acumulador por cor: uma geometria por cor, fundida no fim */
class Balde {
  vs: number[] = []
  ix: number[] = []
  push(x: number, y: number, z: number) { this.vs.push(x, y, z); return this.vs.length / 3 - 1 }
}

export class Prancheta {
  private baldes = new Map<string, Balde>()
  private aguas = new Set<string>()
  readonly covas: Cova[] = []
  constructor(private ctx: Ctx) {}

  /** ⚠️ NaN NÃO PODE VAZAR DAQUI, E TEM DE DIZER DE QUEM É. Um só vértice NaN
   *  envenena o boundingSphere da malha FUNDIDA, e como buildPecas funde todas as
   *  peças por cor, o three reclama uma vez e não diz qual peça errou: some a
   *  cidade inteira daquela cor e a busca vira caça ao fantasma. Aqui o quad é
   *  descartado e o id da peça aparece no console. */
  private podres = 0

  private balde(cor: string, agua = false) {
    if (agua) this.aguas.add(cor)
    let b = this.baldes.get(cor)
    if (!b) { b = new Balde(); this.baldes.set(cor, b) }
    return b
  }

  /**
   * ⚠️ TODO QUAD PASSA POR AQUI E A ORDEM DOS CANTOS NÃO IMPORTA. A normal é
   * calculada e a face é virada para cima se vier de cabeça para baixo. É o
   * conserto definitivo da armadilha A: nenhum módulo pode mais apagar a própria
   * geometria escrevendo os cantos na ordem natural.
   * Os quatro cantos são [x, y, z] em X/Z local e Y de mundo.
   */
  quad(cor: string, A: number[], B: number[], C: number[], D: number[], agua = false) {
    const b = this.balde(cor, agua)
    // normal do primeiro triângulo, só no plano: se aponta para baixo, inverte
    const ux = B[0] - A[0], uz = B[2] - A[2]
    const vx = C[0] - B[0], vz = C[2] - B[2]
    // ⚠️ A COMPONENTE Y DE u x v É uz*vx - ux*vz, E NÃO O CONTRÁRIO. Eu escrevi
    // invertido na primeira versão e o efeito foi cirurgicamente perverso: em vez
    // de não corrigir nada, `quad()` virava justamente as faces que já estavam
    // certas. As 12 peças saíram com o chão inteiro de cabeça para baixo e o que
    // aparecia na cena eram só as caixas e os cilindros, que não passam por aqui.
    // Conferência: para o quad (ax,az) (ax,bz) (bx,bz) (bx,az) com ax<bx e az<bz,
    // que é sabidamente para cima, uz=+dz e vx=+dx, logo ny=+dz*dx>0. Mantém.
    const ny = uz * vx - ux * vz      // componente Y do produto vetorial u x v
    const [p, q, r, s] = ny >= 0 ? [A, B, C, D] : [A, D, C, B]
    for (const v of [p, q, r, s]) {
      if (!Number.isFinite(v[0]) || !Number.isFinite(v[1]) || !Number.isFinite(v[2])) {
        this.podres++
        return
      }
    }
    const i = b.push(p[0], p[1], p[2])
    b.push(q[0], q[1], q[2]); b.push(r[0], r[1], r[2]); b.push(s[0], s[1], s[2])
    b.ix.push(i, i + 1, i + 2, i, i + 2, i + 3)
  }

  /** retângulo alinhado ao quadro local, seguindo o terreno */
  chao(cor: string, x0: number, z0: number, x1: number, z1: number, y: number = Y.PARCELA, agua = false) {
    const nx = Math.max(1, Math.ceil(Math.abs(x1 - x0) / PASSO))
    const nz = Math.max(1, Math.ceil(Math.abs(z1 - z0) / PASSO))
    const P = (lx: number, lz: number) => [lx, this.ctx.alt(lx, lz) + y, lz]
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const ax = x0 + ((x1 - x0) * i) / nx, bx = x0 + ((x1 - x0) * (i + 1)) / nx
        const az = z0 + ((z1 - z0) * j) / nz, bz = z0 + ((z1 - z0) * (j + 1)) / nz
        this.quad(cor, P(ax, az), P(ax, bz), P(bx, bz), P(bx, az), agua)
      }
    }
  }

  /** anel ou arco (a0/a1 em radianos, 0 = para -z, cresce para +x), seguindo o terreno */
  anel(cor: string, cx: number, cz: number, ri: number, re: number,
       y: number = Y.PARCELA, a0 = 0, a1 = Math.PI * 2, agua = false) {
    const seg = Math.max(8, Math.ceil((Math.abs(a1 - a0) * (re + ri) / 2) / PASSO))
    const P = (rr: number, aa: number) => {
      const lx = cx + Math.sin(aa) * rr, lz = cz - Math.cos(aa) * rr
      return [lx, this.ctx.alt(lx, lz) + y, lz]
    }
    for (let k = 0; k < seg; k++) {
      const t0 = a0 + ((a1 - a0) * k) / seg, t1 = a0 + ((a1 - a0) * (k + 1)) / seg
      this.quad(cor, P(ri, t0), P(ri, t1), P(re, t1), P(re, t0), agua)
    }
  }

  /** disco cheio */
  disco(cor: string, cx: number, cz: number, r: number, y: number = Y.PARCELA, agua = false) {
    this.anel(cor, cx, cz, 0, r, y, 0, Math.PI * 2, agua)
  }

  /** elipse cheia, útil para lâmina d'água e gramado orgânico */
  oval(cor: string, cx: number, cz: number, ra: number, rb: number, y: number = Y.PARCELA, agua = false) {
    const seg = Math.max(16, Math.ceil((2 * Math.PI * Math.max(ra, rb)) / PASSO))
    const P = (t: number, k: number) => {
      const lx = cx + Math.cos(t) * ra * k, lz = cz + Math.sin(t) * rb * k
      return [lx, this.ctx.alt(lx, lz) + y, lz]
    }
    for (let i = 0; i < seg; i++) {
      const t0 = (i / seg) * Math.PI * 2, t1 = ((i + 1) / seg) * Math.PI * 2
      this.quad(cor, P(t0, 0), P(t0, 1), P(t1, 1), P(t1, 0), agua)
    }
  }

  /** fita de largura constante ao longo de uma polilinha local (caminho, alameda) */
  fita(cor: string, pts: [number, number][], larg: number, y: number = Y.PARCELA) {
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, z0] = pts[k], [x1, z1] = pts[k + 1]
      const dx = x1 - x0, dz = z1 - z0
      const L = Math.hypot(dx, dz) || 1
      const px = (-dz / L) * (larg / 2), pz = (dx / L) * (larg / 2)
      const n = Math.max(1, Math.ceil(L / PASSO))
      const P = (lx: number, lz: number) => [lx, this.ctx.alt(lx, lz) + y, lz]
      for (let i = 0; i < n; i++) {
        const ax = x0 + (dx * i) / n, az = z0 + (dz * i) / n
        const bx = x0 + (dx * (i + 1)) / n, bz = z0 + (dz * (i + 1)) / n
        this.quad(cor, P(ax - px, az - pz), P(bx - px, bz - pz), P(bx + px, bz + pz), P(ax + px, az + pz))
      }
    }
  }

  /**
   * ⚠️ A MOLDURA É O QUE FAZ A PEÇA ENCOSTAR NA CIDADE. Sem ela a peça vira um
   * adesivo largado no chão: um anel de calçada de `larg` m na cota da calçada
   * da rua, com face vertical de 15 cm (o mesmo meio-fio) fazendo sombra na
   * borda inteira. Chame isto em TODA peça, antes de qualquer outra coisa.
   */
  moldura(larg = 4.0) {
    const { a, b } = this.ctx
    const A = a - 6, B = b - 6         // 6 m: a metade da via de contorno que a peça cede
    this.chao(COR.CLARO, -A, -B, A, -B + larg, Y.MOLDURA)
    this.chao(COR.CLARO, -A, B - larg, A, B, Y.MOLDURA)
    this.chao(COR.CLARO, -A, -B + larg, -A + larg, B - larg, Y.MOLDURA)
    this.chao(COR.CLARO, A - larg, -B + larg, A, B - larg, Y.MOLDURA)
    // a face vertical da guia, virada para dentro
    const F = (x0: number, z0: number, x1: number, z1: number) => {
      const h0 = this.ctx.alt(x0, z0), h1 = this.ctx.alt(x1, z1)
      this.quad(COR.MEDIO,
        [x0, h0 + Y.PARCELA, z0], [x1, h1 + Y.PARCELA, z1],
        [x1, h1 + Y.MOLDURA, z1], [x0, h0 + Y.MOLDURA, z0])
    }
    F(-A + larg, -B + larg, A - larg, -B + larg)
    F(-A + larg, B - larg, A - larg, B - larg)
    F(-A + larg, -B + larg, -A + larg, B - larg)
    F(A - larg, -B + larg, A - larg, B - larg)
  }

  /** caixa: volume sem fachada, que é como plano de massas mostra obra pública.
   *  ⚠️ NÃO RECEBE COTA. Volume assenta na parcela por definição, e o último
   *  argumento é o GIRO em radianos. Um agente passou `Y.L1` aqui achando que era
   *  altura e o museu nasceu torto 17 graus; no `cilindro` logo abaixo o mesmo
   *  engano caiu no número de LADOS e devolveu vértice NaN. */
  vol(cor: string, cx: number, cz: number, sx: number, alturaM: number, sz: number, giro = 0) {
    const g = new THREE.BoxGeometry(sx, alturaM, sz)
    g.translate(0, alturaM / 2, 0)
    if (giro) g.rotateY(giro)
    g.translate(cx, this.ctx.alt(cx, cz) + Y.PARCELA, cz)
    this.solto(cor, g)
  }

  /** cilindro em pé (torre, silo, mastro).
   *  ⚠️ NÃO RECEBE COTA: o último argumento é o número de LADOS. Ver a nota em
   *  vol(). O clamp abaixo é o que impede o engano de virar NaN em silêncio. */
  cilindro(cor: string, cx: number, cz: number, r: number, alturaM: number, seg = 16) {
    seg = Math.max(3, Math.round(seg))
    const g = new THREE.CylinderGeometry(r, r, alturaM, seg)
    g.translate(cx, this.ctx.alt(cx, cz) + Y.PARCELA + alturaM / 2, cz)
    this.solto(cor, g)
  }

  /**
   * ARQUIBANCADA: anel de degraus, que é a forma que faz estádio parecer estádio
   * em plano de massas. `n` degraus subindo de `ri` a `re`, altura total `h`.
   * ⚠️ flatShading é responsabilidade do material fundido; aqui cada degrau é
   * mesmo um degrau, senão vira rampa lisa (medido em 28/08 no Estádio Olímpico).
   */
  arquibancada(cor: string, cx: number, cz: number, ri: number, re: number,
               n: number, h: number, a0 = 0, a1 = Math.PI * 2, alongar = 1) {
    const dr = (re - ri) / n, dh = h / n
    for (let k = 0; k < n; k++) {
      const r0 = ri + dr * k, r1 = ri + dr * (k + 1)
      const y0 = Y.PARCELA + dh * k, y1 = Y.PARCELA + dh * (k + 1)
      const seg = Math.max(12, Math.ceil((Math.abs(a1 - a0) * r1) / 24))
      const P = (rr: number, aa: number, yy: number) => {
        const lx = cx + Math.sin(aa) * rr * alongar, lz = cz - Math.cos(aa) * rr
        return [lx, this.ctx.alt(lx, lz) + yy, lz]
      }
      for (let j = 0; j < seg; j++) {
        const t0 = a0 + ((a1 - a0) * j) / seg, t1 = a0 + ((a1 - a0) * (j + 1)) / seg
        this.quad(cor, P(r0, t0, y1), P(r0, t1, y1), P(r1, t1, y1), P(r1, t0, y1))   // piso do degrau
        this.quad(cor, P(r0, t0, y0), P(r0, t1, y0), P(r0, t1, y1), P(r0, t0, y1))   // espelho
      }
    }
  }

  /**
   * PISTA DE ATLETISMO DE 400 m, com a medida de verdade: duas retas de 84,39 m
   * e duas curvas de raio 36,50 m na raia 1. `esc` só escala tudo junto.
   */
  pista400(cx: number, cz: number, esc = 1, corPista: string = COR.TERRACOTA, corCampo: string = COR.VERDE) {
    const R = 36.5 * esc, S = 84.39 * esc, W = 9.76 * esc   // 8 raias de 1,22 m
    const P = (lx: number, lz: number, y: number) => [lx, this.ctx.alt(lx, lz) + y, lz]
    const arco = (sx: number, r0: number, r1: number, cor: string, y: number) => {
      const seg = 28
      for (let k = 0; k < seg; k++) {
        const a0 = (k / seg) * Math.PI - Math.PI / 2, a1 = ((k + 1) / seg) * Math.PI - Math.PI / 2
        const X = (rr: number, aa: number) => cx + sx * (S / 2 + Math.cos(aa) * rr)
        const Z = (rr: number, aa: number) => cz + Math.sin(aa) * rr * sx
        this.quad(cor, P(X(r0, a0), Z(r0, a0), y), P(X(r0, a1), Z(r0, a1), y),
                       P(X(r1, a1), Z(r1, a1), y), P(X(r1, a0), Z(r1, a0), y))
      }
    }
    this.chao(corPista, cx - S / 2, cz - R - W, cx + S / 2, cz - R, Y.L1)
    this.chao(corPista, cx - S / 2, cz + R, cx + S / 2, cz + R + W, Y.L1)
    arco(+1, R, R + W, corPista, Y.L1)
    arco(-1, R, R + W, corPista, Y.L1)
    this.chao(corCampo, cx - S / 2, cz - R, cx + S / 2, cz + R, Y.L2)
    arco(+1, 0, R, corCampo, Y.L2)
    arco(-1, 0, R, corCampo, Y.L2)
  }

  /** cova de árvore: marca escura no chão e um ponto para a arborização plantar */
  cova(lx: number, lz: number, raio = 4.5) {
    this.chao(COR.ESCURO, lx - 1.6, lz - 1.6, lx + 1.6, lz + 1.6, Y.L5)
    this.covas.push({ x: lx, z: lz, r: raio })
  }

  /** alinhamento de covas ao longo de uma reta, com espaçamento de manual de rua */
  alinhamento(x0: number, z0: number, x1: number, z1: number, passo = 9, raio = 4.5) {
    const L = Math.hypot(x1 - x0, z1 - z0)
    const n = Math.max(1, Math.round(L / passo))
    for (let k = 0; k <= n; k++) this.cova(x0 + ((x1 - x0) * k) / n, z0 + ((z1 - z0) * k) / n, raio)
  }

  /** geometria pronta (Box, Cylinder, Lathe...) já posicionada em local+mundo */
  solto(cor: string, g: THREE.BufferGeometry, agua = false) {
    const b = this.balde(cor, agua)
    const pos = g.attributes.position as THREE.BufferAttribute
    const idx = g.index
    const base = b.vs.length / 3
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) { this.podres++; g.dispose(); return }
      b.push(x, y, z)
    }
    if (idx) for (let i = 0; i < idx.count; i++) b.ix.push(base + idx.getX(i))
    else for (let i = 0; i < pos.count; i++) b.ix.push(base + i)
    g.dispose()
  }


  // ══════════════════════════════════════════════════════════════════════════
  // O VERTICALZINHO: poste, mastro, refletor, cobertura, guarda-corpo, banco.
  //
  // ⚠️ É ISTO QUE TIRA A CARA DE MAQUETE. Um plano de massas tem volume e chão e
  // por isso lê como maquete branca: falta a coisa fina e alta que dá ESCALA
  // HUMANA. Um poste de 9 m ao lado de um galpão de 14 diz quanto o galpão tem;
  // sem ele, o galpão pode ter 3 m ou 30. E na chapa de sol raso é a SOMBRA
  // comprida do poste que desenha, não o poste.
  //
  // ⚠️ ORÇAMENTO: cada peça destas custa entre 12 e 60 triângulos. Pode haver
  // centenas por peça sem mover o ponteiro, mas NÃO milhares: a cidade toda já
  // roda com 51 peças e 39 mil árvores.
  // ══════════════════════════════════════════════════════════════════════════

  /** poste de iluminação: fuste + braço + luminária. 9 m é o padrão de via. */
  poste(lx: number, lz: number, alturaM = 9, giro = 0, cor: string = COR.MEDIO) {
    this.vol(cor, lx, lz, 0.34, alturaM, 0.34)
    const bx = lx + Math.cos(giro) * 1.5, bz = lz + Math.sin(giro) * 1.5
    const y = this.ctx.alt(lx, lz) + Y.PARCELA + alturaM
    const g = new THREE.BoxGeometry(3.0, 0.28, 0.28)
    g.rotateY(-giro)
    g.translate((lx + bx) / 2, y, (lz + bz) / 2)
    this.solto(cor, g)
    const l = new THREE.BoxGeometry(1.5, 0.34, 0.8)
    l.rotateY(-giro)
    l.translate(bx + Math.cos(giro) * 0.9, y - 0.3, bz + Math.sin(giro) * 0.9)
    this.solto(COR.CLARO, l)
  }

  /** fila de postes ao longo de uma reta, com o braço virado para dentro */
  postes(x0: number, z0: number, x1: number, z1: number, passo = 32, alturaM = 9) {
    const L = Math.hypot(x1 - x0, z1 - z0)
    const n = Math.max(1, Math.round(L / passo))
    const giro = Math.atan2(z1 - z0, x1 - x0) + Math.PI / 2
    for (let k = 0; k <= n; k++) {
      this.poste(x0 + ((x1 - x0) * k) / n, z0 + ((z1 - z0) * k) / n, alturaM, giro)
    }
  }

  /** mastro: fuste fino e alto, para bandeira, antena ou marco. */
  mastro(lx: number, lz: number, alturaM = 26, cor: string = COR.CLARO) {
    this.cilindro(cor, lx, lz, 0.5, alturaM, 6)
  }

  /**
   * REFLETOR DE ESTÁDIO: torre de 4 pernas com a bateria de luz no topo. É a
   * silhueta que faz um campo virar estádio numa aérea, e ela é alta de
   * propósito: 42 m é a altura real de torre de iluminação de estádio grande.
   */
  refletor(lx: number, lz: number, alturaM = 42, giro = 0) {
    for (const [ox, oz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]] as const) {
      const cx = lx + ox * Math.cos(giro) - oz * Math.sin(giro)
      const cz = lz + ox * Math.sin(giro) + oz * Math.cos(giro)
      this.vol(COR.MEDIO, cx, cz, 0.6, alturaM, 0.6)
    }
    const y = this.ctx.alt(lx, lz) + Y.PARCELA + alturaM
    const cab = new THREE.BoxGeometry(11, 4.5, 2.2)
    cab.rotateY(-giro)
    cab.translate(lx, y + 2.2, lz)
    this.solto(COR.CLARO, cab)
  }

  /**
   * COBERTURA DE ARQUIBANCADA: anel ou arco em balanço sobre os degraus. Uma
   * arquibancada sem cobertura lê como degrau de concreto; com ela lê como
   * estádio, porque a sombra do balanço desenha a bacia inteira.
   */
  cobertura(cx: number, cz: number, ri: number, re: number, alturaM: number,
            a0 = 0, a1 = Math.PI * 2, cor: string = COR.CLARO, alongar = 1) {
    const seg = Math.max(16, Math.ceil((Math.abs(a1 - a0) * re) / 20))
    const P = (rr: number, aa: number, y: number) => {
      const lx = cx + Math.sin(aa) * rr * alongar, lz = cz - Math.cos(aa) * rr
      return [lx, this.ctx.alt(lx, lz) + y, lz]
    }
    for (let k = 0; k < seg; k++) {
      const t0 = a0 + ((a1 - a0) * k) / seg, t1 = a0 + ((a1 - a0) * (k + 1)) / seg
      this.quad(cor, P(ri, t0, alturaM), P(ri, t1, alturaM), P(re, t1, alturaM), P(re, t0, alturaM))
      this.quad(COR.MEDIO, P(re, t0, alturaM), P(re, t1, alturaM),
                P(re, t1, alturaM - 1.4), P(re, t0, alturaM - 1.4))
    }
    const np = Math.max(4, Math.round((Math.abs(a1 - a0) * 180) / Math.PI / 18))
    for (let k = 0; k <= np; k++) {
      const aa = a0 + ((a1 - a0) * k) / np
      const lx = cx + Math.sin(aa) * re * alongar, lz = cz - Math.cos(aa) * re
      this.vol(COR.MEDIO, lx, lz, 1.1, alturaM, 1.1)
    }
  }

  /** guarda-corpo ao longo de uma polilinha: montantes a cada 4 m e um corrimão */
  guardaCorpo(pts: [number, number][], alturaM = 1.1, cor: string = COR.MEDIO) {
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, z0] = pts[k], [x1, z1] = pts[k + 1]
      const L = Math.hypot(x1 - x0, z1 - z0)
      const n = Math.max(1, Math.round(L / 4))
      for (let j = 0; j <= n; j++) {
        this.vol(cor, x0 + ((x1 - x0) * j) / n, z0 + ((z1 - z0) * j) / n, 0.16, alturaM, 0.16)
      }
      const y0 = this.ctx.alt(x0, z0) + Y.PARCELA + alturaM
      const y1 = this.ctx.alt(x1, z1) + Y.PARCELA + alturaM
      const w = 0.1
      const dx = ((z1 - z0) / (L || 1)) * w, dz = (-(x1 - x0) / (L || 1)) * w
      this.quad(cor, [x0 - dx, y0, z0 - dz], [x1 - dx, y1, z1 - dz],
                     [x1 + dx, y1, z1 + dz], [x0 + dx, y0, z0 + dz])
    }
  }

  /** banco: assento e dois pés. 1,8 m é o comprimento de banco público real. */
  banco(lx: number, lz: number, giro = 0, cor: string = COR.MEDIO) {
    const y = this.ctx.alt(lx, lz) + Y.PARCELA
    const a = new THREE.BoxGeometry(1.8, 0.14, 0.55)
    a.rotateY(-giro); a.translate(lx, y + 0.45, lz)
    this.solto(cor, a)
    for (const s of [-1, 1]) {
      const px = lx + Math.cos(giro) * 0.7 * s, pz = lz + Math.sin(giro) * 0.7 * s
      this.vol(cor, px, pz, 0.14, 0.45, 0.5, giro)
    }
  }

  /** placar: painel em pé sobre dois pés, virado para um ponto */
  placar(lx: number, lz: number, larg = 18, alturaM = 9, giro = 0) {
    for (const s of [-1, 1]) {
      this.vol(COR.MEDIO, lx + Math.cos(giro) * (larg / 2 - 1) * s,
               lz + Math.sin(giro) * (larg / 2 - 1) * s, 0.7, alturaM, 0.7)
    }
    const y = this.ctx.alt(lx, lz) + Y.PARCELA + alturaM
    const g = new THREE.BoxGeometry(larg, alturaM * 0.62, 0.6)
    g.rotateY(-giro)
    g.translate(lx, y + alturaM * 0.31, lz)
    this.solto(COR.ESCURO, g)
  }

  /** fecha a prancheta e devolve as partes, uma por cor */
  fechar(): Desenho {
    if (this.podres) {
      console.warn(`[peça ${this.ctx.id} ${this.ctx.nome}] ${this.podres} faces descartadas por coordenada NaN ou infinita`)
    }
    const partes: Parte[] = []
    this.baldes.forEach((b, cor) => {
      if (!b.ix.length) return
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.vs, 3))
      g.setIndex(b.ix)
      g.computeVertexNormals()
      partes.push({ geo: g, cor, agua: this.aguas.has(cor) })
    })
    return { partes, covas: this.covas }
  }
}
