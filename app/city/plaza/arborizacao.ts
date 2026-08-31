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
import { AVENIDAS, avenidasGeom, emAvenida } from './teia'
import type { DistanceCuller } from './perf'

export interface Cova { x: number; z: number; r: number }

export interface ArborizacaoOpts {
  heightAt: (x: number, z: number) => number
  /** covas que as praças e as peças pediram, em coordenadas de mundo */
  covas?: Cova[]
  /** ⚠️ ESTÁ MOLHADO? Sem isto a plantação atravessa a baía.
   *
   *  Medido em 31/08, antes de existir: 13,7% das mudas (cerca de 6.800 de
   *  49.818) estavam sobre água. A rua PARA na baía por decisão do fundador
   *  ("retire as estradas de cima da baía"), e a fileira de árvore seguia em
   *  frente, reta, por cima da lâmina. Vem de `lagos.naAgua`, que é a mesma
   *  rotulagem por preenchimento que desenha a água: fonte única, não uma
   *  conta paralela de altura que divergiria na borda do pódio. */
  molhado?: (x: number, z: number) => boolean
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
const R_CHEIA = 1400      // além disto a árvore vira o volume de longe (8 triângulos)
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
 * O VOLUME DE LONGE: um octaedro alongado, 8 triângulos.
 *
 * ⚠️ ISTO SUBSTITUI A CRUZ DE QUADS (fundador, 30/08: "esse monte de bloco verde
 * é o quê? Horrível, se for algum tipo de árvore precisamos trocar todas"). A
 * cruz eram três quads cruzados: de frente parece árvore, mas na RASANTE, que é
 * como se olha uma cidade, ela vira uma laje verde chapada sem silhueta nenhuma,
 * e eram 39.518 delas contra 1.800 copas de verdade.
 *
 * ⚠️ E O CONSERTO NÃO É MAIS CARO, é 8 triângulos contra 6. O que a cruz nunca
 * teve e o octaedro tem é VOLUME: qualquer ângulo devolve um contorno de copa, a
 * luz varia entre as faces e a sombra projetada é de árvore, não de placa. A
 * cintura fica a 62% da altura, que é onde a copa de uma árvore de rua é mais
 * larga.
 */
function geoLonge(altura: number, larg: number): THREE.BufferGeometry {
  const R = larg / 2
  const yc = altura * 0.62
  const vs: number[] = [0, 0, 0]                 // o pé, na cor do tronco
  const cs: number[] = [COR_TRONCO.r, COR_TRONCO.g, COR_TRONCO.b]
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2
    vs.push(Math.cos(a) * R, yc, Math.sin(a) * R)
    cs.push(COR_COPA.r, COR_COPA.g, COR_COPA.b)
  }
  vs.push(0, altura, 0)                          // o topo
  cs.push(COR_COPA.r, COR_COPA.g, COR_COPA.b)
  const ix: number[] = []
  for (let k = 0; k < 4; k++) {
    const a = 1 + k, b = 1 + ((k + 1) % 4)
    ix.push(0, b, a)                             // a saia, para baixo
    ix.push(a, b, 5)                             // a copa, para cima
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

interface Quarteirao { x: number; z: number; giro: number; lado: number; prof?: number }
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
  // ⚠️ ESTA MÁSCARA ESTAVA MORTA, E CALADA. Ela varria `K.setores`, e
  // `constantes` publica `setoresLegado`, não `setores`: `s < undefined` é falso
  // na primeira volta, o laço nunca rodava e a função só respondia `r < 40`. Ou
  // seja, desde sempre a árvore NÃO desviava de avenida nenhuma, e as fileiras
  // de anel eram plantadas por dentro dos cruzamentos.
  //
  // Undefined numa comparação não estoura, dá falso: a máscara errada tem a
  // mesma aparência de máscara ausente, e nada no console reclama.
  //
  // Agora ela vem da teia, com a largura de CADA avenida (44 nas quatro cardeais,
  // 34 nas outras oito) em vez de um `meiaBul` único.
  const noBulevar = (px: number, pz: number) => {
    if (Math.hypot(px, pz) < 40) return true
    return emAvenida(px, pz, 3)
  }
  const noAnel = (px: number, pz: number) => {
    const r = Math.hypot(px, pz)
    for (const a of aneis) if (Math.abs(r - a.r) <= a.larg / 2 + 3) return true
    return false
  }

  // ⚠️ SE A CONSULTA DE ÁGUA NÃO CHEGAR, RECLAME ALTO. O defeito que ela conserta
  // é invisível no console: máscara ausente e máscara errada têm a mesma cara, e
  // foi assim que `noBulevar` ficou morta por semanas lendo um campo que não
  // existe. Melhor um aviso feio do que 6.800 árvores boiando em silêncio.
  const molhado = o.molhado ?? (() => false)
  if (!o.molhado) console.warn('[arborização] sem consulta de água: a plantação pode atravessar a baía')

  const mudas: Muda[] = []
  const por = (x: number, z: number, forma: Forma, i: number, evitaVia = true) => {
    if (mudas.length >= TETO) return
    const r = Math.hypot(x, z)
    if (r < rMin || r > rMax) return
    if (emPeca(x, z)) return
    if (molhado(x, z)) return
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
    // a cova escapa da máscara de PEÇA (foi a peça que a pediu), nunca da de água
    if (molhado(c.x, c.z)) continue
    mudas.push({ x: c.x, z: c.z, forma: 'esfera', esc: 0.9 + hash01(i) * 0.3, giro: hash01(i * 13) * Math.PI * 2 })
    i++
  }
  const daCova = mudas.length

  // ── 2. os 12 bulevares: cone no canteiro, esfera nas duas calçadas ────────
  // Seção do bulevar (vias.ts): calçada 0 a 5, pista 5 a 15, canteiro 15 a 19,
  // pista 19 a 29, calçada 29 a 34, medida da borda esquerda.
  const PASSO_BUL = 7.6
  // ⚠️ AS AVENIDAS VÊM DE `avenidasGeom()`, NÃO DE `malha.bulevares`. O campo
  // `bulevares` do JSON são as 9 costuras dos 6 distritos, e `vias.ts` as troca
  // pelas 12 simétricas na cópia DELE. Este módulo busca o JSON por conta
  // própria e via as costuras: plantava em 61,9°, 106,9°, 185,6°, 241,9° e
  // 309,4°, onde não há rua, e deixava pelada a avenida de 30, 60, 120, 150,
  // 210, 240, 300 e 330. As duas listas só coincidem em 0, 90, 180 e 270.
  for (const b of avenidasGeom()) {
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
        if (emPeca(x, z) || molhado(x, z)) continue
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
  // ⚠️ A FILEIRA SEGUE O POLÍGONO, NÃO O CÍRCULO. O anel virou dodecágono em
  // 31/08 ("teia é em linha reta") e a flecha vai de 60 m no Anel Interior a
  // 259 m na Pista de Serviço: plantar no círculo deixaria a fileira até 259 m
  // FORA da rua, atravessando o terreno — que é exatamente a leitura de "elemento
  // atrapalhando". Aqui a árvore anda pela corda entre duas avenidas, como a via.
  // ⚠️ O NÚMERO DE VÉRTICES É O NÚMERO DE AVENIDAS, não um 12 escrito à mão. O
  // anel vira polígono com um vértice em cada rotatória (é assim que `vias.ts`
  // o desenha, em `verticesDoAnel`), então derivar daqui é o que impede a
  // fileira de sair da corda no dia em que a teia mudar de contagem.
  const _VERT = AVENIDAS.length
  for (const a of aneis) {
    const n = Math.floor((2 * Math.PI * a.r) / PASSO_BUL)
    for (let k = 0; k < n; k++) {
      const t = (k / n) * Math.PI * 2
      // projeta o ângulo na corda do dodecágono: o vértice fica no raio cheio e
      // o meio da aresta em cos(π/12) dele
      const lado = Math.floor((t / (Math.PI * 2)) * _VERT)
      const g0 = (lado / _VERT) * Math.PI * 2, g1 = ((lado + 1) / _VERT) * Math.PI * 2
      const u = (t - g0) / (g1 - g0)
      const P0x = Math.sin(g0) * a.r, P0z = -Math.cos(g0) * a.r
      const P1x = Math.sin(g1) * a.r, P1z = -Math.cos(g1) * a.r
      const x = P0x + (P1x - P0x) * u, z = P0z + (P1z - P0z) * u
      if (Math.hypot(x, z) < rMin || Math.hypot(x, z) > rMax) continue
      if (emPeca(x, z) || molhado(x, z) || noBulevar(x, z)) continue
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
  // ⚠️ O MEIO SAI DO BLOCO, NÃO DE UMA CONSTANTE. Era `K.quarteirao / 2` (84)
  // para a cidade inteira; com o quarteirão variando por banda (109 no Núcleo,
  // 168 no Meio, 227 no Bairro) isso plantava a fileira de árvores 30 m dentro
  // do lote no Núcleo e 30 m fora dele no Bairro.
  // ⚠️ ESTA FILEIRA FICOU ÓRFÃ EM 31/08 e por isso saiu. Ela era plantada ao
  // longo da VIA DE CONTORNO de cada quarteirão, e a via de contorno deixou de
  // existir quando a cidade passou a ter só as vias principais (7 anéis × 12
  // avenidas). O resultado na chapa eram fileiras pontilhadas atravessando o
  // terreno sem rua nenhuma embaixo, que é o que o fundador viu como elemento
  // atrapalhando. Árvore acompanha rua; sem rua, não há alinhamento.
  //
  // As de BULEVAR e de ANEL continuam, porque essas ruas existem. `?arvcont=1`
  // traz esta de volta para quem restaurar a teia fina.
  const _querCont = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('arvcont') === '1'
  for (const q of (_querCont ? malha.quarteiroes : [])) {
    const meio = q.lado / 2
    // a fileira corre ao longo da TESTADA e recua a PROFUNDIDADE
    const off = (q.prof ?? q.lado) / 2 + 2.5 + 1.07
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
  const gCruzE = geoLonge(7.0, 4.8), gCruzC = geoLonge(11.0, 4.6)

  const nEsf = mudas.filter((m) => m.forma === 'esfera').length
  const nCon = mudas.length - nEsf
  // ⚠️ 900 ERA POUCO DEMAIS e o fundador viu: "esse monte de bloco verde é o quê?
  // Horrível". Com 40.000 árvores e teto de 900 copas, 39.518 delas eram o LOD de
  // longe, então praticamente a cidade INTEIRA era o LOD. Um teto de LOD só vale
  // quando o LOD é a exceção. Os lotes saíram e devolveram 1,03 milhão de
  // triângulos ao orçamento; 6.000 copas custam 180 mil.
  const CAP_CHEIA = 6000             // teto de copas cheias em cena ao mesmo tempo

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
    nEsf * 8 + nCon * 8 + CAP_CHEIA * 30 + CAP_CHEIA * 12

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
