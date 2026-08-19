// A GALERIA DO DOG SOCIAL CLUB (praca-ajustes.md item 10): a coleção inteira,
// 306 inscrições de Bitcoin, num muro curvo do jardim ao lado da torre Kray.
//
// De onde vêm os dados: o fundador deu o número da inscrição do PFP dele
// (88866326 = f33caeb2…i0); o PAI dessa inscrição é 8a18494d…i0, que é a logo do
// clube, e os FILHOS desse pai são a coleção (306, enumerados pelo endpoint
// recursivo do ordinals.com). As imagens viraram um atlas de 32 colunas
// (`public/city/dsc-atlas.webp`, 128 px por peça, 1 MB) e a lista de ids ficou em
// `dsc-atlas.json` — ou seja: a parede é a coleção de verdade, na ordem da
// cadeia, não uma amostra.
//
// A parede é uma malha só (306 quadrinhos com UV no atlas) + os trechos de pedra
// instanciados: duas chamadas de desenho para a coleção inteira.
import * as THREE from 'three'
import type { PerfProfile, DistanceCuller } from './perf'

export interface DscGallery {
  group: THREE.Group
  update: (t: number) => void
  dispose: () => void
}

interface AtlasMeta { count: number; cols: number; rows: number; tile: number; parent: string }

const WARM = new THREE.Color('#FFB35C')
const ORANGE = new THREE.Color('#F7931A')

/** Centro do muro, no jardim a nordeste do lote da Kray, olhando para a praça. */
export const DSC_CENTER = new THREE.Vector3(596, 0, -232)
const FACE = Math.atan2(-DSC_CENTER.x, -DSC_CENTER.z) // olha para o centro da praça

export async function buildDscGallery(opts: {
  heightAt: (x: number, z: number) => number
  profile?: PerfProfile
  culler?: DistanceCuller
}): Promise<DscGallery | null> {
  const [meta, tex] = await Promise.all([
    fetch('/city/dsc-atlas.json').then((r) => (r.ok ? (r.json() as Promise<AtlasMeta>) : null)).catch(() => null),
    new Promise<THREE.Texture | null>((res) => new THREE.TextureLoader().load('/city/dsc-atlas.webp', (t) => { t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 8; res(t) }, undefined, () => res(null))),
  ])
  if (!meta || !tex) { console.warn('[plaza] Dog Social Club: atlas ausente'); return null }

  const group = new THREE.Group()
  group.name = 'DogSocialClub'
  const disposables: { dispose: () => void }[] = [tex]
  const track = <T extends { dispose: () => void }>(o: T): T => { disposables.push(o); return o }

  // ── a geometria do muro: um arco de raio 46 abrindo para a praça ─────────
  const COLS = 34, TILE = 1.7, GAP = 0.14
  const ROWS = Math.ceil(meta.count / COLS)          // 9 fileiras para 306
  const R = 46                                       // raio da curva do muro
  const step = (TILE + GAP) / R                      // ângulo por coluna
  const y0 = opts.heightAt(DSC_CENTER.x, DSC_CENTER.z)
  const BASE = 1.6                                   // o embasamento
  const H = BASE + ROWS * (TILE + GAP) + 1.2         // altura total do muro

  const positions: number[] = [], uvs: number[] = [], indices: number[] = [], normals: number[] = []
  const wallM: THREE.Matrix4[] = []
  const o = new THREE.Object3D()
  const a0 = -((COLS - 1) / 2) * step
  for (let k = 0; k < meta.count; k++) {
    const col = k % COLS, row = Math.floor(k / COLS)
    const a = a0 + col * step
    // quadro local do muro: o arco abre para −z local (a frente)
    const cx = Math.sin(a) * R, cz = R - Math.cos(a) * R
    const cy = BASE + (ROWS - 1 - row) * (TILE + GAP) + TILE / 2
    const nx = Math.sin(a), nz = -Math.cos(a)        // normal para a frente
    const tx = Math.cos(a), tz = Math.sin(a)         // tangente, para a direita de quem lê
    const u0 = (k % meta.cols) / meta.cols, u1 = u0 + 1 / meta.cols
    const v1 = 1 - Math.floor(k / meta.cols) / meta.rows, v0 = v1 - 1 / meta.rows
    const P = (du: number, dv: number): [number, number, number] => [
      // A normal da face de fora do arco é (sen a, −cos a): os quadros vão 0,62
      // NESSE sentido (meia espessura do muro mais folga). Com o sinal trocado
      // eles caíam atrás da pedra, e a coleção não aparecia.
      cx + tx * du * (TILE / 2) + nx * 0.62, cy + dv * (TILE / 2), cz + tz * du * (TILE / 2) + nz * 0.62,
    ]
    const base = positions.length / 3
    positions.push(...P(-1, 1), ...P(1, 1), ...P(1, -1), ...P(-1, -1))
    for (let i = 0; i < 4; i++) normals.push(nx, 0, nz)
    uvs.push(u0, v1, u1, v1, u1, v0, u0, v0)
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
    if (row === 0) {
      o.position.set(cx, H / 2, cz)
      o.rotation.set(0, -a, 0)
      o.scale.setScalar(1)
      o.updateMatrix()
      wallM.push(o.matrix.clone())
    }
  }
  const geo = track(new THREE.BufferGeometry())
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  const tileMat = track(new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.55, metalness: 0.1, envMapIntensity: 0.8,
    emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.45, side: THREE.DoubleSide,
  }))
  const tiles = new THREE.Mesh(geo, tileMat)
  tiles.name = 'DSC_Tiles'
  tiles.castShadow = tiles.receiveShadow = true
  group.add(tiles)

  // o muro atrás dos quadros: um trecho por coluna, instanciado
  const stone = track(new THREE.MeshStandardMaterial({ color: 0x141419, roughness: 0.7, metalness: 0.2 }))
  const wallGeo = track(new THREE.BoxGeometry(TILE + GAP + 0.02, H, 1.1))
  const wall = new THREE.InstancedMesh(wallGeo, stone, wallM.length)
  wallM.forEach((m, i) => wall.setMatrixAt(i, m))
  wall.instanceMatrix.needsUpdate = true
  wall.castShadow = wall.receiveShadow = true
  group.add(wall)
  // coroa laranja no topo, a marca do clube
  const crownGeo = track(new THREE.BoxGeometry(TILE + GAP + 0.06, 0.34, 1.4))
  const crownMat = track(new THREE.MeshStandardMaterial({ color: ORANGE, emissive: ORANGE, emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.6, toneMapped: false }))
  const crown = new THREE.InstancedMesh(crownGeo, crownMat, wallM.length)
  wallM.forEach((m, i) => {
    const mm = m.clone().multiply(new THREE.Matrix4().makeTranslation(0, H / 2 + 0.17, 0))
    crown.setMatrixAt(i, mm)
  })
  crown.instanceMatrix.needsUpdate = true
  group.add(crown)

  // ── o escudo do clube, no eixo, à frente do muro ─────────────────────────
  const logo = await new Promise<THREE.Texture | null>((res) => new THREE.TextureLoader().load('/city/dsc-logo.webp', (t) => { t.colorSpace = THREE.SRGBColorSpace; res(t) }, undefined, () => res(null)))
  if (logo) {
    track(logo)
    const shield = new THREE.Mesh(track(new THREE.PlaneGeometry(7, 7)), track(new THREE.MeshStandardMaterial({
      map: logo, transparent: true, roughness: 0.5, metalness: 0.2, emissive: 0xffffff, emissiveMap: logo, emissiveIntensity: 0.6, side: THREE.DoubleSide,
    })))
    shield.position.set(0, H + 4.6, -1.2)
    shield.rotation.y = Math.PI // a face impressa olha para fora do arco, como os quadros
    group.add(shield)
    const mast = new THREE.Mesh(track(new THREE.CylinderGeometry(0.22, 0.3, 5, 12)), stone)
    mast.position.set(0, H + 1.6, -1.2)
    group.add(mast)
  }

  // ── a placa: o que é isto, com o pai da coleção ─────────────────────────
  {
    const c = document.createElement('canvas')
    c.width = 1024; c.height = 256
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#121317'; ctx.fillRect(0, 0, 1024, 256)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#F7931A'; ctx.font = '700 58px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText('DOG SOCIAL CLUB', 512, 62)
    ctx.fillStyle = '#c9bfae'; ctx.font = '500 26px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText(`${meta.count} inscriptions on Bitcoin,`, 512, 128)
    ctx.fillText('in the order the chain wrote them', 512, 160)
    ctx.fillStyle = '#a89b80'; ctx.font = '500 20px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText(`parent ${meta.parent.slice(0, 12)}…${meta.parent.slice(-4)}`, 512, 210)
    const t = track(new THREE.CanvasTexture(c))
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
    const sign = new THREE.Mesh(track(new THREE.PlaneGeometry(8, 2)), track(new THREE.MeshBasicMaterial({ map: t, toneMapped: false })))
    sign.position.set(0, 1.1, -R * (1 - Math.cos(a0)) - 7)
    sign.rotation.x = -0.35
    group.add(sign)
  }

  group.position.set(DSC_CENTER.x, y0, DSC_CENTER.z)
  // FACE aponta o +z local para o centro da praça; os quadros olham para −z
  // local, então o muro leva mais π para mostrar a coleção a quem chega
  group.rotation.y = FACE + Math.PI
  const lights: THREE.PointLight[] = []
  for (const s of [-1, 1]) {
    const l = new THREE.PointLight(WARM, 12, 90, 1.6)
    l.position.set(s * 22, H * 0.7, -14)
    group.add(l)
    lights.push(l)
  }
  opts.culler?.add(group, (opts.profile?.smallCull ?? 2600) * 1.6, DSC_CENTER)

  return {
    group,
    update(t) { for (const l of lights) l.intensity = 12 * (0.92 + 0.08 * Math.sin(t * 0.9 + l.position.x)) },
    dispose() { for (const d of disposables) d.dispose() },
  }
}
