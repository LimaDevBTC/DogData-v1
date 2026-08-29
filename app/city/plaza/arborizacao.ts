// ═══════════════════════════════════════════════════════════════════════════
// A ARBORIZAÇÃO: a árvore da DogCity, e ela é o maior salto de percepção que a
// cidade tem antes do mint, porque até aqui só existia chão desenhado.
//
// ⚠️ A COPA NÃO DESENHA POR VALOR, DESENHA POR SOMBRA, e é isso que dita a
// forma. Verde #7E8A6B contra calçada #CBC4B6 dá 2,11:1 de contraste e contra
// lote dá 1,43:1: de cima, uma copa quase some. O que aparece numa aérea de
// verdade é a SOMBRA dela, uma tracejada escura ao lado da calçada. Uma árvore
// de 7 m com o sol a 32 graus projeta 11,2 m, que mede cerca de 2 px na vista de
// topo. É por isso que a árvore aqui pode ter 30 triângulos e ainda funcionar.
//
// ⚠️ DUAS FORMAS, UM MATERIAL SÓ, e o material é o recurso escasso desta cena
// (a vista de topo compila 228 programas e o teto medido é 235). Esfera e cone
// dividem um MeshStandardMaterial com cor por vértice, e os dois níveis de LOD
// dividem o mesmo: o three compila um programa e cobra uma chamada de desenho
// por InstancedMesh, quatro no total.
//
// ⚠️ O LOD NÃO SE REBALANCEIA POR QUADRO. A spec da maquete marcou o
// rebalanceamento contínuo como NÃO MEDIDO e deixou o plano B escrito: baldes
// refeitos só quando a câmera anda mais que um limiar. É o plano B que está
// implementado aqui, com limiar de 150 m, porque árvore não se mexe e a diferença
// entre cruz e copa a 400 m não muda enquanto a câmera anda meio quarteirão.
//
// Espaçamentos de fonte primária, não de gosto:
//   7,6 m  bulevar e anel      (Portland, 25 ft, faixas C, CC, D, DC, F, FU)
//   9,1 m  via de contorno     (Portland, 30 ft, faixas E, G, GU)
//   1,07 m recuo do meio-fio   (Seattle, 3 ft 6 in do eixo à face da guia)
//   10,7 m recuo de esquina    (NYC, 35 ft do meio-fio da transversal)
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import type { DistanceCuller } from './perf'

export interface Cova { x: number; z: number; r: number }

export interface ArborizacaoOpts {
  heightAt: (x: number, z: number) => number
  /** covas que as praças e as peças pediram, em coordenadas de mundo */
  covas?: Cova[]
  sombra?: boolean
  culler?: DistanceCuller
}

export interface Arborizacao {
  group: THREE.Group
  arvores: number
  cheias: number
  triangulos: number
  update(cam: THREE.Vector3): void
  dispose(): void
}

const COR_TRONCO = new THREE.Color('#6E685C')
const COR_COPA = new THREE.Color('#7E8A6B')

const TETO = 40000        // teto duro de instâncias; o módulo loga o plantado
const R_CHEIA = 400       // além disto a árvore vira cruz de 6 triângulos
const PASSO_REBALANCE = 150

type Forma = 'esfera' | 'cone'
interface Muda { x: number; z: number; forma: Forma; esc: number; giro: number }

/** ruído determinístico: a cidade é a mesma em toda visita */
function hash01(i: number): number {
  let t = (i + 0x9e3779b9) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** pinta uma geometria inteira de uma cor só, como atributo */
function pintar(g: THREE.BufferGeometry, cor: THREE.Color) {
  const n = g.attributes.position.count
  const c = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { c[i * 3] = cor.r; c[i * 3 + 1] = cor.g; c[i * 3 + 2] = cor.b }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3))
  return g
}

/** ESFERA: copa de icosaedro achatada sobre tronco. 30 triângulos, 7,0 m. */
function geoEsfera(): THREE.BufferGeometry {
  const copa = new THREE.IcosahedronGeometry(2.6, 0)
  copa.scale(1, 0.82, 1)
  copa.translate(0, 4.9, 0)
  const tronco = new THREE.CylinderGeometry(0.18, 0.26, 3.4, 5, 1, true)
  tronco.translate(0, 1.7, 0)
  return fundir([pintar(copa, COR_COPA), pintar(tronco, COR_TRONCO)])
}

/** CONE: 12 triângulos, 11,0 m. Só no canteiro de bulevar e de anel. */
function geoCone(): THREE.BufferGeometry {
  const c = new THREE.ConeGeometry(2.4, 11.0, 6)
  c.translate(0, 5.5, 0)
  return pintar(c, COR_COPA)
}

/**
 * CRUZ: três quads cruzados, 6 triângulos, que é o LOD de longe.
 * ⚠️ TRÊS E NÃO UM. Um quad só some quando a câmera fica de perfil com ele, e na
 * rasante isso é exatamente o que acontece com metade da cidade.
 */
function geoCruz(altura: number, larg: number): THREE.BufferGeometry {
  const vs: number[] = [], ix: number[] = [], cs: number[] = []
  const h = larg / 2
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI
    const dx = Math.cos(a) * h, dz = Math.sin(a) * h
    const b = vs.length / 3
    vs.push(-dx, 0, -dz, dx, 0, dz, dx, altura, dz, -dx, altura, -dz)
    for (let j = 0; j < 4; j++) {
      const c = j < 2 ? COR_TRONCO : COR_COPA
      cs.push(c.r, c.g, c.b)
    }
    ix.push(b, b + 1, b + 2, b, b + 2, b + 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3))
  g.setIndex(ix)
  g.computeVertexNormals()
  return g
}

function fundir(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const vs: number[] = [], cs: number[] = [], ix: number[] = []
  for (const g of gs) {
    const base = vs.length / 3
    const p = g.attributes.position as THREE.BufferAttribute
    const c = g.attributes.color as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      vs.push(p.getX(i), p.getY(i), p.getZ(i))
      cs.push(c.getX(i), c.getY(i), c.getZ(i))
    }
    const idx = g.getIndex()
    if (idx) for (let i = 0; i < idx.count; i++) ix.push(base + idx.getX(i))
    else for (let i = 0; i < p.count; i++) ix.push(base + i)
    g.dispose()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3))
  g.setIndex(ix)
  g.computeVertexNormals()
  return g
}

interface Quarteirao { x: number; z: number; giro: number }
interface Bulevar { rumo: number; largura: number; x0: number; z0: number; x1: number; z1: number }
interface Anel { r: number; larg: number }
interface Peca { x: number; z: number; a: number; b: number; rot: number; forma?: string }

export async function buildArborizacao(o: ArborizacaoOpts): Promise<Arborizacao> {
  const [malha, meta] = await Promise.all([
    fetch('/city/cidade-malha.json').then((r) => r.json() as Promise<{
      constantes: { setores: number; quarteirao: number; viaContorno: number; bulevar: number }
      quarteiroes: Quarteirao[]; bulevares: Bulevar[]
    }>),
    fetch('/city/cidade.json').then((r) => r.json() as Promise<{
      programa: Peca[]; raioBorda: number; raioInicio: number; aneis?: Anel[]
    }>),
  ])
  const K = malha.constantes
  const group = new THREE.Group()
  group.name = 'arborizacao'

  // ── as máscaras: árvore respeita o mesmo que a rua respeita ───────────────
  const pecas = (meta.programa ?? []).map((p) => {
    const rr = (p.rot * Math.PI) / 180
    return { x: p.x, z: p.z, a: p.a, b: p.b, ret: p.forma !== 'elipse',
             ca: Math.cos(rr), sa: Math.sin(rr), rr2: p.a * p.a + p.b * p.b }
  })
  const emPeca = (px: number, pz: number) => {
    for (const p of pecas) {
      const dx = px - p.x, dz = pz - p.z
      if (dx * dx + dz * dz > p.rr2) continue
      const lx = dx * p.ca + dz * p.sa, lz = -dx * p.sa + dz * p.ca
      if (p.ret) { if (Math.abs(lx) <= p.a && Math.abs(lz) <= p.b) return true }
      else if ((lx / p.a) ** 2 + (lz / p.b) ** 2 <= 1) return true
    }
    return false
  }
  const rMax = meta.raioBorda ?? 4400
  const rMin = (meta.raioInicio ?? 1300) - 40
  const aneis = meta.aneis ?? []
  const meiaBul = K.bulevar / 2 + 3
  const noBulevar = (px: number, pz: number) => {
    const r = Math.hypot(px, pz)
    if (r < 40) return true
    for (let s = 0; s < K.setores; s++) {
      const ang = (s * 2 * Math.PI) / K.setores
      if (px * Math.sin(ang) - pz * Math.cos(ang) <= 0) continue
      if (Math.abs(px * Math.cos(ang) + pz * Math.sin(ang)) < meiaBul) return true
    }
    return false
  }
  const noAnel = (px: number, pz: number) => {
    const r = Math.hypot(px, pz)
    for (const a of aneis) if (Math.abs(r - a.r) <= a.larg / 2 + 3) return true
    return false
  }

  const mudas: Muda[] = []
  const por = (x: number, z: number, forma: Forma, i: number, evitaVia = true) => {
    if (mudas.length >= TETO) return
    const r = Math.hypot(x, z)
    if (r < rMin || r > rMax) return
    if (emPeca(x, z)) return
    if (evitaVia && (noBulevar(x, z) || noAnel(x, z))) return
    mudas.push({ x, z, forma, esc: 0.86 + hash01(i) * 0.28, giro: hash01(i * 7) * Math.PI * 2 })
  }

  // ── 1. as covas que a praça e a peça pediram ─────────────────────────────
  // Elas já vêm com posição escolhida por quem desenhou o chão, então não passam
  // pela máscara de peça: a cova DENTRO de uma peça é justamente a que a peça pôs.
  let i = 0
  for (const c of o.covas ?? []) {
    if (mudas.length >= TETO) break
    const r = Math.hypot(c.x, c.z)
    if (r < rMin || r > rMax) continue
    mudas.push({ x: c.x, z: c.z, forma: 'esfera', esc: 0.9 + hash01(i) * 0.3, giro: hash01(i * 13) * Math.PI * 2 })
    i++
  }
  const daCova = mudas.length

  // ── 2. os 12 bulevares: cone no canteiro, esfera nas duas calçadas ────────
  // Seção do bulevar (vias.ts): calçada 0 a 5, pista 5 a 15, canteiro 15 a 19,
  // pista 19 a 29, calçada 29 a 34, medida da borda esquerda.
  const PASSO_BUL = 7.6
  for (const b of malha.bulevares) {
    const ang = (b.rumo * Math.PI) / 180
    const dirX = Math.sin(ang), dirZ = -Math.cos(ang)
    const perpX = Math.cos(ang), perpZ = Math.sin(ang)
    const L = Math.hypot(b.x1 - b.x0, b.z1 - b.z0)
    const n = Math.floor(L / PASSO_BUL)
    const larg = b.largura ?? K.bulevar
    const meia = larg / 2
    for (let k = 0; k <= n; k++) {
      const d = k * PASSO_BUL
      const bx = b.x0 + dirX * d, bz = b.z0 + dirZ * d
      // cone no eixo do canteiro (t = 17 da borda, ou seja o meio)
      por(bx, bz, 'cone', i++, false)
      // esfera a 1,07 m da face de cada meio-fio: t = 3,93 e t = 30,07
      for (const t of [3.93 - meia, 30.07 - meia]) {
        const x = bx + perpX * t, z = bz + perpZ * t
        if (Math.hypot(x, z) < rMin || Math.hypot(x, z) > rMax) continue
        if (emPeca(x, z)) continue
        if (mudas.length >= TETO) break
        mudas.push({ x, z, forma: 'esfera', esc: 0.86 + hash01(i) * 0.28, giro: hash01(i * 7) * Math.PI * 2 })
        i++
      }
    }
  }
  const doBulevar = mudas.length - daCova

  // ── 3. os 3 anéis: cone no canteiro central ──────────────────────────────
  // ⚠️ ISTO NÃO ESTAVA NA SPEC porque o anel não existia quando ela foi escrita.
  // É a peça que faltava para o verde da cidade ser SISTEMA e não ilha: o anel
  // plantado liga um distrito ao outro por baixo de árvore.
  for (const a of aneis) {
    const n = Math.floor((2 * Math.PI * a.r) / PASSO_BUL)
    for (let k = 0; k < n; k++) {
      const t = (k / n) * Math.PI * 2
      const x = Math.sin(t) * a.r, z = -Math.cos(t) * a.r
      if (Math.hypot(x, z) < rMin || Math.hypot(x, z) > rMax) continue
      if (emPeca(x, z) || noBulevar(x, z)) continue
      if (mudas.length >= TETO) break
      mudas.push({ x, z, forma: 'cone', esc: 0.86 + hash01(i) * 0.28, giro: hash01(i * 7) * Math.PI * 2 })
      i++
    }
  }
  const doAnel = mudas.length - daCova - doBulevar

  // ── 4. a via de contorno, UM lado por quarteirão ─────────────────────────
  // ⚠️ UM LADO E NÃO OS DOIS, e isso é decisão urbana e não economia: plantio
  // unilateral em rua estreita de 7 m é padrão real, e a referência de maquete
  // (RJ Models) entrega masterplan com entourage deliberadamente limitado. Os
  // dois lados dariam mais de 35 mil árvores só aqui.
  const PASSO_CONT = 9.1
  const RECUO_ESQ = 10.7
  const meio = K.quarteirao / 2
  const off = meio + 2.5 + 1.07     // 1,07 m da face do meio-fio da calçada
  for (const q of malha.quarteiroes) {
    const g = (q.giro * Math.PI) / 180
    const cg = Math.cos(g), sg = Math.sin(g)
    const meia = meio - RECUO_ESQ
    const n = Math.floor((meia * 2) / PASSO_CONT)
    for (let k = 0; k <= n; k++) {
      const lx = -meia + k * PASSO_CONT
      const x = q.x + lx * cg - off * sg, z = q.z + lx * sg + off * cg
      por(x, z, 'esfera', i++)
    }
  }
  const doContorno = mudas.length - daCova - doBulevar - doAnel

  // ── 5. quatro InstancedMesh, UM material ─────────────────────────────────
  // ⚠️ DoubleSide POR CAUSA DA CRUZ: um quad de costas some, e metade das cruzes
  // fica de costas para qualquer câmera. Custa fragmento a mais em copa de 30
  // triângulos, o que não move o ponteiro, e é o que faz a cruz existir.
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide,
  })
  const gEsf = geoEsfera(), gCon = geoCone()
  const gCruzE = geoCruz(7.0, 4.4), gCruzC = geoCruz(11.0, 4.2)

  const nEsf = mudas.filter((m) => m.forma === 'esfera').length
  const nCon = mudas.length - nEsf
  const CAP_CHEIA = 900              // teto de copas cheias em cena ao mesmo tempo

  const malhas: Record<string, THREE.InstancedMesh> = {
    cruzEsfera: new THREE.InstancedMesh(gCruzE, mat, Math.max(1, nEsf)),
    cruzCone: new THREE.InstancedMesh(gCruzC, mat, Math.max(1, nCon)),
    cheiaEsfera: new THREE.InstancedMesh(gEsf, mat, CAP_CHEIA),
    cheiaCone: new THREE.InstancedMesh(gCon, mat, CAP_CHEIA),
  }
  for (const [nome, m] of Object.entries(malhas)) {
    m.name = `arvore:${nome}`
    m.castShadow = o.sombra ?? true
    m.receiveShadow = false          // copa recebendo sombra de copa é só ruído
    m.frustumCulled = false
    group.add(m)
  }

  const m4 = new THREE.Matrix4()
  const pos = new THREE.Vector3()
  const qua = new THREE.Quaternion()
  const esc = new THREE.Vector3()
  const eixoY = new THREE.Vector3(0, 1, 0)
  const y0 = mudas.map((m) => o.heightAt(m.x, m.z))
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)

  let ultima = new THREE.Vector3(1e9, 1e9, 1e9)
  let cheias = 0
  const rebalancear = (cam: THREE.Vector3) => {
    let iCE = 0, iCC = 0, iXE = 0, iXC = 0
    for (let k = 0; k < mudas.length; k++) {
      const m = mudas[k]
      const dx = m.x - cam.x, dz = m.z - cam.z
      const perto = dx * dx + dz * dz < R_CHEIA * R_CHEIA
      pos.set(m.x, y0[k], m.z)
      qua.setFromAxisAngle(eixoY, m.giro)
      esc.set(m.esc, m.esc, m.esc)
      m4.compose(pos, qua, esc)
      if (m.forma === 'esfera') {
        if (perto && iCE < CAP_CHEIA) { malhas.cheiaEsfera.setMatrixAt(iCE++, m4) }
        else malhas.cruzEsfera.setMatrixAt(iXE++, m4)
      } else {
        if (perto && iCC < CAP_CHEIA) { malhas.cheiaCone.setMatrixAt(iCC++, m4) }
        else malhas.cruzCone.setMatrixAt(iXC++, m4)
      }
    }
    for (let k = iCE; k < CAP_CHEIA; k++) malhas.cheiaEsfera.setMatrixAt(k, ZERO)
    for (let k = iCC; k < CAP_CHEIA; k++) malhas.cheiaCone.setMatrixAt(k, ZERO)
    malhas.cruzEsfera.count = iXE
    malhas.cruzCone.count = iXC
    for (const m of Object.values(malhas)) m.instanceMatrix.needsUpdate = true
    cheias = iCE + iCC
  }
  rebalancear(new THREE.Vector3(0, 0, 0))

  const triangulos =
    nEsf * 6 + nCon * 6 + CAP_CHEIA * 30 + CAP_CHEIA * 12

  console.log(
    `[arborização] ${mudas.length.toLocaleString('pt-BR')} árvores: ` +
    `${daCova.toLocaleString('pt-BR')} de cova, ${doBulevar.toLocaleString('pt-BR')} de bulevar, ` +
    `${doAnel.toLocaleString('pt-BR')} de anel, ${doContorno.toLocaleString('pt-BR')} de contorno`,
  )

  return {
    group,
    arvores: mudas.length,
    get cheias() { return cheias },
    triangulos,
    /** ⚠️ SÓ REFAZ OS BALDES QUANDO A CÂMERA ANDOU 150 m. Rebalancear por quadro
     *  é O(40.000) e a spec marcou o custo disso como não medido; árvore não se
     *  mexe, e a diferença entre cruz e copa a 400 m não muda em meio quarteirão. */
    update(cam: THREE.Vector3) {
      if (cam.distanceToSquared(ultima) < PASSO_REBALANCE * PASSO_REBALANCE) return
      ultima = cam.clone()
      rebalancear(cam)
    },
    dispose() {
      for (const m of Object.values(malhas)) { m.geometry.dispose(); m.dispose() }
      mat.dispose()
      group.clear()
    },
  }
}
