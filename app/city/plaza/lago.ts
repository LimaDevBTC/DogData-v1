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

export interface Lago {
  group: THREE.Group
  pontes: number
  ilhas: Ilha[]
  areaHa: number
  triangulos: number
  dispose(): void
}

// ⚠️ A ÁGUA DO LAGO NÃO USA O AZUL DAS PEÇAS. `#16283C` é o azul de lâmina
// pequena (espelho de praça, piscina), e ele foi escolhido para ler contra
// calçada clara em peça de 60 m. Num lago de 173 ha cercado de regolito claro no
// platô ele lê PRETO: a chapa mostrava um fosso de sombra e não água. Este aqui é
// o mesmo azul um passo mais claro e mais saturado, que é o que faz a lâmina
// pegar o sol raso e virar água.
const COR_AGUA = '#24597F'
const COR_PRAIA = '#8E856F'
const COR_PISO = '#CBC4B6'
const COR_ESTRUTURA = '#8F8879'
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

  // ── 2. os dois passeios de margem ────────────────────────────────────────
  // Um calçadão de 14 m em cada lado, na cota do platô, que é o que dá borda ao
  // lago. Sem ele a água encontra regolito solto e o desenho para no meio.
  for (const [rIn, rOut] of [[L.r0 - 56, L.r0 - 42], [L.r1 + 42, L.r1 + 56]]) {
    const b = B(COR_PISO)
    // ⚠️ O PASSO SAI DO RAIO, E ISSO FOI MEDIDO NA CHAPA. Com 200 segmentos fixos
    // a corda em r 1.280 dá 40 m, e uma faixa plana de 40 m assentada em cima do
    // talude de 70 m serrilha a margem inteira: foi o dente de serra que apareceu
    // na primeira chapa do lago. 18 m é o mesmo vão que a via e a peça usam.
    const seg = Math.max(120, Math.ceil((2 * Math.PI * rOut) / 18))
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2
      // ⚠️ 0,8 m E NÃO 0,33: numa RAMPA a corda de 18 m afunda mais que a folga
      // plana da rua. Com 0,33 o barranco cintilava em xadrez, que é z-fighting
      // entre a praia e o regolito. Em barranco ninguém percebe 80 cm.
      const p = (r: number, a: number) => NO(Math.sin(a) * r, -Math.cos(a) * r, 0.8)
      b.quad(p(rIn, a0), p(rIn, a1), p(rOut, a1), p(rOut, a0))
    }
  }
  // a faixa de praia entre o calçadão e a água, mais clara que o regolito
  for (const [rIn, rOut] of [[L.r0 - 42, L.r0 - 14], [L.r1 + 14, L.r1 + 42]]) {
    const b = B(COR_PRAIA)
    const seg = Math.max(120, Math.ceil((2 * Math.PI * rOut) / 18))
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2
      // e subdivide no RADIAL também: 48 m de praia atravessam o talude inteiro
      const nr = 4
      for (let j = 0; j < nr; j++) {
        const ra = rIn + ((rOut - rIn) * j) / nr, rb = rIn + ((rOut - rIn) * (j + 1)) / nr
        const p = (r: number, a: number) => NO(Math.sin(a) * r, -Math.cos(a) * r, 0.55)
        b.quad(p(ra, a0), p(ra, a1), p(rb, a1), p(rb, a0))
      }
    }
  }

  // ── 3. as quatro pontes ──────────────────────────────────────────────────
  // Tabuleiro de 26 m de largura a +7 m do platô, atravessando os 420 m de anel.
  // Duas torres por ponte, de 74 m, com tirantes: é a silhueta que faz a ponte
  // ser vista da praça e do outro lado, que é o que o fundador pediu quando
  // disse "espetaculares".
  const R_PONTE_I = L.r0 - 70, R_PONTE_E = L.r1 + 70
  const LARG = 26, Y_DECK = 7.0
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
        b.quad(
          P(x0 - px * LARG / 2, z0 - pz * LARG / 2, Y_DECK),
          P(x1 - px * LARG / 2, z1 - pz * LARG / 2, Y_DECK),
          P(x1 + px * LARG / 2, z1 + pz * LARG / 2, Y_DECK),
          P(x0 + px * LARG / 2, z0 + pz * LARG / 2, Y_DECK),
        )
      }
      // as duas laterais do tabuleiro, para ele ter espessura vista de lado
      const be = B(COR_ESTRUTURA)
      for (const s of [-1, 1]) {
        for (let k = 0; k < n; k++) {
          const [x0, z0] = eixo(k / n), [x1, z1] = eixo((k + 1) / n)
          const ox = px * s * LARG / 2, oz = pz * s * LARG / 2
          be.quad(
            P(x0 + ox, z0 + oz, Y_DECK), P(x1 + ox, z1 + oz, Y_DECK),
            P(x1 + ox, z1 + oz, Y_DECK - 3.2), P(x0 + ox, z0 + oz, Y_DECK - 3.2),
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
            const [ax, az] = eixo(t + (dir * d) / (R_PONTE_E - R_PONTE_I))
            const w = 0.9
            b.quad(
              P(tx + ox - px * w, tz + oz - pz * w, Y_DECK + H_TORRE),
              P(tx + ox + px * w, tz + oz + pz * w, Y_DECK + H_TORRE),
              P(ax + ox + px * w, az + oz + pz * w, Y_DECK),
              P(ax + ox - px * w, az + oz - pz * w, Y_DECK),
            )
          }
        }
      }
    }
  }

  // ── 4. as ilhas ──────────────────────────────────────────────────────────
  // ⚠️ RESERVA NOMEADA, NÃO CONSTRUÇÃO. Enquanto não existir projeto, a ilha é
  // um disco de terra com cais e nada em cima, e é assim que ela tem de ler:
  // lugar guardado com nome, igual ao resto da demarcação da cidade. A primeira
  // é do Dog Social Club por decisão do fundador.
  const rIlha = (rAguaI + rAguaE) / 2
  const ilhas: Ilha[] = []
  for (let k = 0; k < 8; k++) {
    const rumo = 22.5 + k * 45                    // entre as pontes, nunca sob elas
    const ang = (rumo * Math.PI) / 180
    const x = Math.sin(ang) * rIlha, z = -Math.cos(ang) * rIlha
    const raio = k === 0 ? 78 : 54
    ilhas.push({
      id: `ILHA${String(k + 1).padStart(2, '0')}`,
      nome: k === 0 ? 'Ilha do Dog Social Club' : `Ilha ${k + 1}, reservada`,
      x, z, r: raio, dono: k === 0 ? 'Dog Social Club' : null,
    })
    const seg = 40
    const bt = B(COR_TERRA), bp = B(COR_PRAIA), bc = B(COR_PISO)
    for (let j = 0; j < seg; j++) {
      const a0 = (j / seg) * Math.PI * 2, a1 = ((j + 1) / seg) * Math.PI * 2
      const p = (r: number, a: number, y: number) => P(x + Math.cos(a) * r, z + Math.sin(a) * r, y)
      // praia submersa, praia seca e o miolo de terra
      bp.quad(p(raio, a0, L.agua + 0.2), p(raio, a1, L.agua + 0.2),
              p(raio * 0.86, a1, L.agua + 1.6), p(raio * 0.86, a0, L.agua + 1.6))
      bt.quad(p(raio * 0.86, a0, L.agua + 1.6), p(raio * 0.86, a1, L.agua + 1.6),
              p(0, a1, L.agua + 2.6), p(0, a0, L.agua + 2.6))
    }
    // o cais, virado para a praça
    const cx = x - Math.sin(ang) * raio, cz = z + Math.cos(ang) * raio
    bc.quad(P(cx - Math.cos(ang) * 9, cz - Math.sin(ang) * 9, L.agua + 1.2),
            P(cx + Math.cos(ang) * 9, cz + Math.sin(ang) * 9, L.agua + 1.2),
            P(cx + Math.cos(ang) * 9 + Math.sin(ang) * 26, cz + Math.sin(ang) * 9 - Math.cos(ang) * 26, L.agua + 1.2),
            P(cx - Math.cos(ang) * 9 + Math.sin(ang) * 26, cz - Math.sin(ang) * 9 - Math.cos(ang) * 26, L.agua + 1.2))
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
      roughness: agua ? 0.08 : 0.92,
      metalness: agua ? 0.35 : 0,
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
  return {
    group, pontes, ilhas, areaHa, triangulos,
    dispose() {
      for (const m of feitas) { m.geometry.dispose(); (m.material as THREE.Material).dispose() }
      group.clear()
    },
  }
}
