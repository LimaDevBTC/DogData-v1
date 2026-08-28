// ═══════════════════════════════════════════════════════════════════════════
// A ABÓBADA DE COLMEIA sobre a DogCity inteira.
//
// Decisão do fundador, 28/08/2026: UMA abóbada só, cobrindo a cidade e o
// coliseu da Cratera da Batalha. Foguete voa fora dela. Não existe abóbada
// separada para o coliseu, e se a estação de foguetes atrapalhar, a estação é
// que se muda.
//
// Por que colmeia, e é a única parte da física que sobreviveu ao corte: a
// tração de membrana de uma calota é N = p·Rc/2, e o raio de curvatura de uma
// célula hemisférica é o raio da própria célula. Então a célula pequena divide
// a tração linearmente, e com ela a espessura do vidro. A baia de 168 m da
// proposta original pedia 107 mm de vidro, que não existe; a célula de 42 m
// pede 23,7 mm, que é vidraça. Isso importa aqui porque decide a ESPESSURA DA
// NERVURA, que é a única coisa desta lista que a câmera vê.
//
// O resto da engenharia (gás, radiação, incêndio) foi descartado pelo fundador
// e com razão: esta cidade é virtual. O critério é a tela.
//
// ⚠️ CINTILAÇÃO É O ÚNICO RISCO REAL. Uma nervura de 0,9 m cai abaixo de 1
// pixel além de ~1.300 m, e a partir daí a malha pisca contra o céu preto
// estrelado, que é o pior artefato possível nesta cena. A cura não é
// estrutural, é LOD: além de `distTextura` a casca devia virar textura
// projetada com mipmap. NÃO IMPLEMENTADO nesta primeira passada, e é a próxima
// coisa a fazer se o fundador aprovar a forma.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** raio em planta: o sítio inteiro, o mesmo de lib/city/lunar/sites.ts:73 */
export const DOME_R = 3500

export interface DomeOpts {
  /** o chão, para a saia da borda pousar no relevo real */
  heightAt: (x: number, z: number) => number
  /** raio circunscrito da célula, em metros. 42 = um quarto do quarteirão de 168 m */
  cell?: number
  /** altura da borda sobre o datum da praça (o relevo do sítio vai de −85 a +66) */
  rim?: number
  /** altura da coroa sobre o datum. 1.200 deixa a câmera do herói (y 640) por dentro */
  crown?: number
  /** largura da nervura em metros; é ela que decide quanto céu a malha come */
  rib?: number
}

export interface Dome {
  group: THREE.Group
  /** quantas células a casca tem, para o painel de ?stats=1 */
  celulas: number
  /** triângulos somados das duas malhas */
  triangulos: number
  dispose(): void
}

const COR_NERVURA = new THREE.Color('#C6C9D2')
const COR_VIDRO = new THREE.Color('#9FC4E8')
const COR_SAIA = new THREE.Color('#26262B')

/** O vidro: quase invisível de frente e aceso na rasante. Sem transmissão de
 *  verdade (cara demais para 8 mil células): um fresnel resolve a leitura. */
function materialVidro(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTint: { value: COR_VIDRO },
      uBase: { value: 0.045 },
      uFres: { value: 0.5 },
    },
    vertexShader: `
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uTint; uniform float uBase; uniform float uFres;
      varying vec3 vN; varying vec3 vV;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0);
        gl_FragColor = vec4(uTint * (0.55 + 0.9 * f), uBase + uFres * f);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

export function buildDome(o: DomeOpts): Dome {
  const a = o.cell ?? 42
  const rim = o.rim ?? 90
  const crown = o.crown ?? 1200
  const ribW = o.rib ?? 0.9

  const group = new THREE.Group()
  group.name = 'abobada'

  // ── a calota ───────────────────────────────────────────────────────────────
  // Esfera que passa pela coroa (r 0, y crown) e pela borda (r R, y rim).
  const f = crown - rim
  const Rc = (DOME_R * DOME_R + f * f) / (2 * f)
  const yc = crown - Rc
  const capY = (r: number) => yc + Math.sqrt(Math.max(0, Rc * Rc - r * r))
  /** a normal da esfera em (x, z), que é o que orienta pillow e nervura */
  const normalEm = (x: number, z: number, out: THREE.Vector3) =>
    out.set(x, capY(Math.hypot(x, z)) - yc, z).normalize()

  // A malha só vai até onde a célula inteira cabe; a saia fecha o resto.
  const rMax = DOME_R - a
  // Almofada: quanto a célula estufa acima da calota. 0,18·a dá a leitura de
  // acolchoado sem virar bolha de plástico.
  const pillow = 0.18 * a
  // Célula grande ganha um anel a mais: a 42 m ela ocupa 28,6 graus da tela e
  // um cone de 6 triângulos apareceria como cone.
  const aneis = a >= 30 ? 2 : 1

  // ── a colmeia ──────────────────────────────────────────────────────────────
  // Rede triangular de topo chato: x = 1,5·a·q, z = √3·a·(r + q/2).
  const passoQ = 1.5 * a
  const passoR = Math.sqrt(3) * a
  const nQ = Math.ceil(DOME_R / passoQ) + 2
  const nR = Math.ceil(DOME_R / passoR) + 2

  const centros: { x: number; z: number }[] = []
  for (let q = -nQ; q <= nQ; q++) {
    for (let r = -nR; r <= nR; r++) {
      const x = passoQ * q
      const z = passoR * (r + q / 2)
      if (Math.hypot(x, z) <= rMax) centros.push({ x, z })
    }
  }

  const CANTO: [number, number][] = []
  for (let k = 0; k < 6; k++) CANTO.push([Math.cos((k * Math.PI) / 3), Math.sin((k * Math.PI) / 3)])

  // ── vidro: uma almofada por célula, tudo fundido numa malha só ────────────
  const vidros: THREE.BufferGeometry[] = []
  const tmpN = new THREE.Vector3()
  for (const c of centros) {
    const pos: number[] = []
    const idx: number[] = []
    normalEm(c.x, c.z, tmpN)
    // centro
    pos.push(c.x, capY(Math.hypot(c.x, c.z)) + pillow * tmpN.y, c.z)
    // anéis, de dentro para fora; o de fora encosta na calota
    for (let anel = 1; anel <= aneis; anel++) {
      const t = anel / aneis
      const raio = a * t
      const alt = pillow * (1 - t * t)
      for (let k = 0; k < 6; k++) {
        const x = c.x + CANTO[k][0] * raio
        const z = c.z + CANTO[k][1] * raio
        pos.push(x, capY(Math.hypot(x, z)) + alt, z)
      }
    }
    // leque do centro para o primeiro anel
    for (let k = 0; k < 6; k++) idx.push(0, 1 + k, 1 + ((k + 1) % 6))
    // faixas entre anéis
    for (let anel = 1; anel < aneis; anel++) {
      const b0 = 1 + (anel - 1) * 6
      const b1 = 1 + anel * 6
      for (let k = 0; k < 6; k++) {
        const k2 = (k + 1) % 6
        idx.push(b0 + k, b1 + k, b1 + k2)
        idx.push(b0 + k, b1 + k2, b0 + k2)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    vidros.push(g)
  }
  const geoVidro = mergeGeometries(vidros, false)!
  vidros.forEach((g) => g.dispose())
  const matVidro = materialVidro()
  const malhaVidro = new THREE.Mesh(geoVidro, matVidro)
  malhaVidro.frustumCulled = false
  malhaVidro.renderOrder = 5
  group.add(malhaVidro)

  // ── nervuras: uma fita por aresta, cada aresta uma vez só ─────────────────
  // A aresta é compartilhada por duas células. Sem a chave de deduplicação a
  // malha desenharia 2x a estrutura e o céu ficaria com o dobro de traço.
  const vistas = new Set<string>()
  const pos: number[] = []
  const nor: number[] = []
  const idx: number[] = []
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), meio = new THREE.Vector3()
  const dir = new THREE.Vector3(), lado = new THREE.Vector3(), nrm = new THREE.Vector3()
  const canto = (cx: number, cz: number, k: number, out: THREE.Vector3) => {
    const x = cx + CANTO[k][0] * a
    const z = cz + CANTO[k][1] * a
    return out.set(x, capY(Math.hypot(x, z)), z)
  }
  for (const c of centros) {
    for (let k = 0; k < 6; k++) {
      canto(c.x, c.z, k, p0)
      canto(c.x, c.z, (k + 1) % 6, p1)
      meio.addVectors(p0, p1).multiplyScalar(0.5)
      const chave = `${Math.round(meio.x / 0.5)}:${Math.round(meio.z / 0.5)}`
      if (vistas.has(chave)) continue
      vistas.add(chave)
      normalEm(meio.x, meio.z, nrm)
      dir.subVectors(p1, p0).normalize()
      lado.crossVectors(dir, nrm).normalize().multiplyScalar(ribW / 2)
      // 0,4 m acima do vidro: sem isso as duas superfícies brigam pelo z-buffer
      const sobe = 0.4
      const base = pos.length / 3
      for (const p of [p0, p1]) {
        pos.push(p.x - lado.x, p.y + nrm.y * sobe - lado.y, p.z - lado.z)
        nor.push(nrm.x, nrm.y, nrm.z)
        pos.push(p.x + lado.x, p.y + nrm.y * sobe + lado.y, p.z + lado.z)
        nor.push(nrm.x, nrm.y, nrm.z)
      }
      idx.push(base, base + 1, base + 3, base, base + 3, base + 2)
    }
  }
  const geoNerv = new THREE.BufferGeometry()
  geoNerv.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geoNerv.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  geoNerv.setIndex(idx)
  const matNerv = new THREE.MeshStandardMaterial({
    color: COR_NERVURA, metalness: 0.55, roughness: 0.38, side: THREE.DoubleSide,
  })
  const malhaNerv = new THREE.Mesh(geoNerv, matNerv)
  malhaNerv.frustumCulled = false
  group.add(malhaNerv)

  // ── a saia da borda ───────────────────────────────────────────────────────
  // Da borda da calota até o relevo real, que dentro do sítio varia de −85 a
  // +66 m. Sem ela a abóbada flutua e o vazio embaixo entrega a farsa.
  const SEG = 360
  const sPos: number[] = []
  const sIdx: number[] = []
  for (let i = 0; i <= SEG; i++) {
    const ang = (i / SEG) * Math.PI * 2
    const x = Math.cos(ang) * rMax
    const z = Math.sin(ang) * rMax
    sPos.push(x, capY(rMax), z)
    sPos.push(x, o.heightAt(x, z) - 8, z)
  }
  for (let i = 0; i < SEG; i++) {
    const b = i * 2
    sIdx.push(b, b + 1, b + 3, b, b + 3, b + 2)
  }
  const geoSaia = new THREE.BufferGeometry()
  geoSaia.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3))
  geoSaia.setIndex(sIdx)
  geoSaia.computeVertexNormals()
  const matSaia = new THREE.MeshStandardMaterial({
    color: COR_SAIA, metalness: 0.3, roughness: 0.8, side: THREE.DoubleSide,
  })
  const malhaSaia = new THREE.Mesh(geoSaia, matSaia)
  malhaSaia.frustumCulled = false
  group.add(malhaSaia)

  const triangulos =
    geoVidro.index!.count / 3 + geoNerv.index!.count / 3 + geoSaia.index!.count / 3

  return {
    group,
    celulas: centros.length,
    triangulos,
    dispose() {
      geoVidro.dispose(); matVidro.dispose()
      geoNerv.dispose(); matNerv.dispose()
      geoSaia.dispose(); matSaia.dispose()
    },
  }
}
