// Os monumentos da Praça Satoshi (praca-jardins.md §2): o que dá sentido ao verde.
//
//   NE  Jardim do White Paper: nove estelas de granito negro com as nove páginas
//       REAIS do Bitcoin: A Peer-to-Peer Electronic Cash System gravadas em branco
//       (public/city/whitepaper/p1..9.webp vêm do PDF), e o Bloco Gênese junto à
//       muralha: um cubo de obsidiana com a mensagem da coinbase e o hash do bloco 0.
//   NW  O Espelho de Satoshi: no espelho d'água, a figura de capuz sem rosto em
//       bronze escuro; onde seria o rosto, um espelho. Quem olha é Satoshi.
//   SE  A Pata de Diamante: o espelho da diagonal é a palma, quatro dedos abrem
//       para fora, água preta com borda de luz quente; a marca do DOG na palma.
//   SW  Jardim Ordinal: um círculo de runestones (as pedras do Parque, com a
//       mesma pele) e as placas da Teoria Ordinal e da Runestone.
//
// Tudo procedural e instanciado onde há repetição; texto por canvas. Materiais:
// bronze escuro, obsidiana, granito negro, latão, espelho. Nada colorido: o
// laranja fica para a marca do DOG e as fitas de luz quente.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  STELAE, GENESIS_POS, SATOSHI_POOL, PAW_PALM, PAW_TOES, PAW_TOE_R, PAW_PLAQUE, LEONIDAS_POS, LEONIDAS_PLINTH_R,
  ORDINAL_CENTER, ORDINAL_RING_R, ORDINAL_STONES, ORDINAL_PLAQUES, QUADRANT_ANGLE, POOL_R,
} from './garden-plan'
import { TIERS, crystalMaterialFor, loadCrystalTextures } from './park'
import { buildSatoshiLugano, buildLeonidas } from './statues'

const WARM = new THREE.Color('#FFB35C')

export interface Monuments {
  group: THREE.Group
  update: (t: number) => void
  dispose: () => void
}

// ── texto em canvas: uma textura por placa ─────────────────────────────────
interface TextSpec {
  w?: number; h?: number
  bg?: string
  lines: { text: string; size: number; color?: string; font?: string; y: number; align?: CanvasTextAlign; x?: number; letterSpacing?: number }[]
}
function textTexture(spec: TextSpec): THREE.CanvasTexture {
  const W = spec.w ?? 1024, H = spec.h ?? 512
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  ctx.fillStyle = spec.bg ?? '#0c0c0f'
  ctx.fillRect(0, 0, W, H)
  for (const l of spec.lines) {
    ctx.fillStyle = l.color ?? '#e9e4d8'
    ctx.font = `${l.font ?? '500'} ${l.size}px "JetBrains Mono", "DM Mono", ui-monospace, monospace`
    ctx.textAlign = l.align ?? 'center'
    ctx.textBaseline = 'middle'
    const x = l.x ?? (l.align === 'left' ? W * 0.06 : W / 2)
    if (l.letterSpacing) {
      // espaçamento manual (letterSpacing do canvas ainda não é universal)
      const chars = l.text.split('')
      const widths = chars.map((ch) => ctx.measureText(ch).width + l.letterSpacing!)
      const total = widths.reduce((a, b) => a + b, 0) - l.letterSpacing
      let cx = (l.align === 'left' ? x : x - total / 2)
      ctx.textAlign = 'left'
      chars.forEach((ch, i) => { ctx.fillText(ch, cx, l.y); cx += widths[i] })
    } else {
      ctx.fillText(l.text, x, l.y)
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}
/** o giro (rotation.y) que faz o +z local de uma peça posta a `side` metros do eixo
 *  de uma diagonal (ângulo `a`) olhar para esse eixo */
function faceAxisYaw(a: number, side: number): number {
  const px = -Math.sin(a), pz = Math.cos(a)
  const sgn = Math.sign(side) || 1
  return Math.atan2(-sgn * px, -sgn * pz)
}
/** quebra um texto em linhas de no máximo `max` caracteres, por palavras */
function wrap(text: string, max: number): string[] {
  const out: string[] = []
  let line = ''
  for (const w of text.split(' ')) {
    if ((line + ' ' + w).trim().length > max) { out.push(line.trim()); line = w }
    else line = (line + ' ' + w).trim()
  }
  if (line) out.push(line)
  return out
}

/** Uma placa de leitura: pedra escura inclinada com face de latão gravado. */
function makePlaque(opts: { title: string; body: string; foot?: string; w?: number }, track: <T extends { dispose: () => void }>(o: T) => T): THREE.Group {
  const g = new THREE.Group()
  const w = opts.w ?? 4.6, h = 2.6
  const stone = new THREE.Mesh(track(new THREE.BoxGeometry(w + 0.6, 1.1, 1.6)), track(new THREE.MeshStandardMaterial({ color: 0x17181d, roughness: 0.75, metalness: 0.15 })))
  stone.position.y = 0.55
  stone.castShadow = stone.receiveShadow = true
  g.add(stone)
  const bodyLines = wrap(opts.body, 54)
  const lines: TextSpec['lines'] = [{ text: opts.title, size: 44, color: '#f2ead6', font: '700', y: 70, letterSpacing: 6 }]
  bodyLines.forEach((t, i) => lines.push({ text: t, size: 30, color: '#d9d2c4', y: 150 + i * 42 }))
  if (opts.foot) lines.push({ text: opts.foot, size: 26, color: '#F7931A', y: 150 + bodyLines.length * 42 + 30, letterSpacing: 4 })
  const tex = track(textTexture({ w: 1024, h: 560, bg: '#151310', lines }))
  const face = new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), track(new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.4, metalness: 0.7 })))
  face.position.set(0, 1.1 + h / 2 * Math.cos(0.42) - 0.1, 0.55)
  face.rotation.x = -0.42
  g.add(face)
  return g
}

export async function buildMonuments(opts: { heightAt: (x: number, z: number) => number; gltf?: GLTFLoader; envMap?: THREE.Texture | null }): Promise<Monuments> {
  const group = new THREE.Group()
  group.name = 'Monuments'
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => { disposables.push(o); return o }
  const yAt = opts.heightAt
  const lights: THREE.PointLight[] = []
  const pulses: { m: THREE.MeshStandardMaterial; base: number }[] = []
  const texLoader = new THREE.TextureLoader()
  const loadTex = (url: string) => new Promise<THREE.Texture>((res, rej) => texLoader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; res(t) }, undefined, rej))

  const graniteMat = track(new THREE.MeshStandardMaterial({ color: 0x121317, roughness: 0.55, metalness: 0.2, envMapIntensity: 0.6 }))
  const obsidianMat = track(new THREE.MeshPhysicalMaterial({ color: 0x07070a, roughness: 0.08, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.4 }))
  const bronzeMat = track(new THREE.MeshStandardMaterial({ color: 0x2b1f15, roughness: 0.42, metalness: 0.9, envMapIntensity: 1.1 }))
  const mirrorMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.02, metalness: 1, envMapIntensity: 2.2 }))
  const brassMat = track(new THREE.MeshStandardMaterial({ color: 0xc9a25a, roughness: 0.32, metalness: 0.95, envMapIntensity: 1.2 }))
  const waterMat = track(new THREE.MeshStandardMaterial({ color: 0x08111c, roughness: 0.05, metalness: 0.7, emissive: 0x0a1a2c, emissiveIntensity: 0.5, envMapIntensity: 1.6 }))
  const warmRimMat = track(new THREE.MeshBasicMaterial({ color: WARM, toneMapped: false }))
  const upMat = track(new THREE.MeshBasicMaterial({ color: WARM, toneMapped: false, transparent: true, opacity: 0.55 }))

  const addLight = (x: number, y: number, z: number, i: number, dist = 90, c: THREE.Color | number = WARM) => {
    const l = new THREE.PointLight(c, i, dist, 1.6)
    l.position.set(x, y, z)
    group.add(l)
    lights.push(l)
    return l
  }
  /** um foco no chão: disco quente que lê como um uplight aceso */
  const uplight = (x: number, z: number, r = 0.55) => {
    const m = new THREE.Mesh(track(new THREE.CircleGeometry(r, 12)), upMat)
    m.rotation.x = -Math.PI / 2
    m.position.set(x, yAt(x, z) + 0.45, z)
    group.add(m)
  }

  // ═══ NE · O Jardim do White Paper ═════════════════════════════════════════
  // A alameda corre pela diagonal; cada estela fica a 13 m do eixo e olha para
  // ele. A página é gravada na face voltada para a alameda: a imagem invertida
  // do PDF (letras claras) entra como mapa de cor e de emissão sobre o granito.
  const aNE = QUADRANT_ANGLE.NE
  const pages = await Promise.all(STELAE.map((s) => loadTex(`/city/whitepaper/p${s.page}.webp`)))
  pages.forEach((t) => track(t))
  const STELA_W = 5.6, STELA_H = 7.2, STELA_T = 0.9
  const stelaGeo = track(new THREE.BoxGeometry(STELA_W, STELA_H, STELA_T))
  const pageGeo = track(new THREE.PlaneGeometry(STELA_W * 0.86, STELA_W * 0.86 * (994 / 768)))
  STELAE.forEach((s, i) => {
    const [x, z] = s.pos
    const y = yAt(x, z)
    const g = new THREE.Group()
    g.position.set(x, y, z)
    // a face útil olha para o eixo da alameda: normal = −side × perpendicular
    const px = -Math.sin(aNE), pz = Math.cos(aNE)
    const yaw = Math.atan2(-s.side * px, -s.side * pz)
    g.rotation.y = yaw
    const plinth = new THREE.Mesh(track(new THREE.BoxGeometry(STELA_W + 1.2, 0.5, STELA_T + 1.6)), graniteMat)
    plinth.position.y = 0.25
    plinth.receiveShadow = true
    g.add(plinth)
    const stone = new THREE.Mesh(stelaGeo, graniteMat)
    stone.position.y = 0.5 + STELA_H / 2
    stone.castShadow = stone.receiveShadow = true
    g.add(stone)
    const pageMat = track(new THREE.MeshStandardMaterial({
      color: 0x0d0d10, roughness: 0.6, metalness: 0.1,
      map: pages[i], emissive: 0xfff2dc, emissiveMap: pages[i], emissiveIntensity: 0.9, transparent: false,
    }))
    const page = new THREE.Mesh(pageGeo, pageMat)
    page.position.set(0, 0.5 + STELA_H / 2 + 0.1, STELA_T / 2 + 0.02)
    g.add(page)
    pulses.push({ m: pageMat, base: 0.9 })
    // o número da página, pequeno, no plinto; e o foco no chão
    const num = new THREE.Mesh(track(new THREE.PlaneGeometry(1.4, 0.36)), track(new THREE.MeshBasicMaterial({
      map: track(textTexture({ w: 256, h: 64, bg: '#121317', lines: [{ text: `PAGE ${s.page} OF 9`, size: 30, color: '#a89b80', y: 34, letterSpacing: 4 }] })), toneMapped: false,
    })))
    num.position.set(0, 0.5 + 0.28, STELA_T / 2 + 0.6)
    g.add(num)
    group.add(g)
    const fx = x + (-s.side * px) * 4, fz = z + (-s.side * pz) * 4
    uplight(fx, fz)
    // luzes de verdade só a cada três estelas: cada PointLight custa em TODOS os
    // materiais da cena, e as páginas já emitem
    if (i % 3 === 0) addLight(fx, y + 1.6, fz, 1.6, 70, 0xfff0dc)
  })
  // a placa de abertura da nave, à entrada (r 615), lado direito
  {
    const px = -Math.sin(aNE), pz = Math.cos(aNE)
    const r = 612, side = -13
    const x = Math.cos(aNE) * r + px * side, z = Math.sin(aNE) * r + pz * side
    const p = makePlaque({
      title: 'BITCOIN: A PEER-TO-PEER ELECTRONIC CASH SYSTEM',
      body: 'Satoshi Nakamoto, 31 October 2008. Nine pages, published to a cryptography mailing list. Every page is engraved along this walk, in order. At the end, the first block.',
      foot: 'THE WHITEPAPER GARDEN',
      w: 5.2,
    }, track)
    p.position.set(x, yAt(x, z), z)
    p.rotation.y = faceAxisYaw(aNE, side)
    group.add(p)
  }

  // ═══ NE · O Bloco Gênese ══════════════════════════════════════════════════
  {
    const [gx, gz] = GENESIS_POS
    const gy = yAt(gx, gz)
    const g = new THREE.Group()
    g.position.set(gx, gy, gz)
    g.rotation.y = Math.atan2(-Math.cos(aNE), -Math.sin(aNE)) // a face do título olha para quem chega pela alameda
    const S = 6.4
    const base = new THREE.Mesh(track(new THREE.CylinderGeometry(7.2, 7.8, 0.6, 48)), graniteMat)
    base.position.y = 0.3
    base.receiveShadow = true
    g.add(base)
    const cube = new THREE.Mesh(track(new THREE.BoxGeometry(S, S, S)), obsidianMat)
    cube.position.y = 0.6 + S / 2 + 0.9
    cube.castShadow = cube.receiveShadow = true
    g.add(cube)
    // flutua sobre um pedestal fino: o bloco não toca o chão
    const stem = new THREE.Mesh(track(new THREE.CylinderGeometry(1.1, 1.4, 0.9, 24)), bronzeMat)
    stem.position.y = 0.6 + 0.45
    g.add(stem)
    // as quatro faces: título, a coinbase, o hash, a recompensa
    const faces: TextSpec[] = [
      { lines: [
        { text: 'BLOCK 0', size: 120, font: '700', color: '#f2ead6', y: 190, letterSpacing: 18 },
        { text: '3 JANUARY 2009 · 18:15:05 UTC', size: 40, color: '#c9bfae', y: 300, letterSpacing: 4 },
        { text: 'THE GENESIS BLOCK', size: 34, color: '#F7931A', y: 380, letterSpacing: 8 },
      ] },
      { lines: [
        { text: 'The Times 03/Jan/2009', size: 62, font: '700', color: '#f2ead6', y: 170 },
        { text: 'Chancellor on brink of', size: 62, font: '700', color: '#f2ead6', y: 250 },
        { text: 'second bailout for banks', size: 62, font: '700', color: '#f2ead6', y: 330 },
        { text: 'WRITTEN INTO THE COINBASE OF THE FIRST BLOCK', size: 26, color: '#a89b80', y: 430, letterSpacing: 4 },
      ] },
      { lines: [
        { text: 'BLOCK HASH', size: 34, color: '#a89b80', y: 120, letterSpacing: 8 },
        { text: '000000000019d6689c085ae165831e93', size: 44, color: '#f2ead6', y: 220 },
        { text: '4ff763ae46a2a6c172b3f1b60a8ce26f', size: 44, color: '#f2ead6', y: 290 },
        { text: 'MINED BY SATOSHI NAKAMOTO', size: 30, color: '#F7931A', y: 400, letterSpacing: 6 },
      ] },
      { lines: [
        { text: '50 BTC', size: 130, font: '700', color: '#f2ead6', y: 200, letterSpacing: 10 },
        { text: 'THE FIRST REWARD · NEVER SPENT', size: 34, color: '#c9bfae', y: 320, letterSpacing: 5 },
        { text: 'BITCOIN BEGINS HERE', size: 30, color: '#F7931A', y: 400, letterSpacing: 8 },
      ] },
    ]
    const faceGeo = track(new THREE.PlaneGeometry(S * 0.9, S * 0.9 * 0.5))
    faces.forEach((spec, i) => {
      const tex = track(textTexture({ w: 1024, h: 512, bg: '#050507', lines: spec.lines }))
      const m = track(new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.2 }))
      const f = new THREE.Mesh(faceGeo, m)
      const a = (i * Math.PI) / 2
      f.position.set(Math.sin(a) * (S / 2 + 0.02), cube.position.y, Math.cos(a) * (S / 2 + 0.02))
      f.rotation.y = a
      g.add(f)
      pulses.push({ m, base: 0.6 })
    })
    group.add(g)
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2
      uplight(gx + Math.cos(a) * 6.2, gz + Math.sin(a) * 6.2, 0.7)
    }
    addLight(gx, gy + 3, gz, 2.4, 60, 0xfff0dc)
    // a linha de luz que segue a alameda até o bloco: a última é a que importa
    const line = new THREE.Mesh(track(new THREE.RingGeometry(7.6, 8.1, 64)), warmRimMat)
    line.rotation.x = -Math.PI / 2
    line.position.set(gx, gy + 0.62, gz)
    group.add(line)
  }

  // ═══ NW · O Espelho de Satoshi ════════════════════════════════════════════
  {
    const [sx, sz] = SATOSHI_POOL
    const sy = yAt(sx, sz)
    const g = new THREE.Group()
    g.position.set(sx, sy, sz)
    // a figura olha para o deck: para dentro, ao longo da diagonal
    g.rotation.y = Math.atan2(-sx, -sz)
    // plinto no meio da água: baixo, largo, latão na aresta
    const plinth = new THREE.Mesh(track(new THREE.CylinderGeometry(9, 9.6, 1.4, 48)), graniteMat)
    plinth.position.y = 0.95
    plinth.castShadow = plinth.receiveShadow = true
    g.add(plinth)
    const rim = new THREE.Mesh(track(new THREE.TorusGeometry(9.05, 0.08, 8, 96)), brassMat)
    rim.rotation.x = Math.PI / 2
    rim.position.y = 1.66
    g.add(rim)
    // A figura, à maneira de Lugano (statues.ts): sentada de capuz com o laptop,
    // em lâminas de aço sagitais. De frente, para quem chega do deck pela
    // alameda, quase some; de lado aparece inteira. Escala 5: 7 m sentada.
    const satoshi = buildSatoshiLugano()
    disposables.push(satoshi)
    satoshi.group.scale.setScalar(7.5) // 10,8 m sentada, do plinto à ponta do capuz
    satoshi.group.position.y = 1.65
    g.add(satoshi.group)
    // a inscrição no plinto, do lado do deck
    const insc = new THREE.Mesh(track(new THREE.PlaneGeometry(6, 1.0)), track(new THREE.MeshBasicMaterial({
      map: track(textTexture({ w: 1024, h: 170, bg: '#121317', lines: [
        { text: 'WE ARE ALL SATOSHI', size: 60, font: '700', color: '#f2ead6', y: 62, letterSpacing: 10 },
        { text: 'the face is a mirror · look, and you are here', size: 30, color: '#a89b80', y: 126 },
      ] })), toneMapped: false,
    })))
    insc.position.set(0, 0.95, 9.5)
    g.add(insc)
    group.add(g)
    // luz: dois focos frontais rasantes de fora da água, e um halo frio no espelho
    const ax = -sx / Math.hypot(sx, sz), az = -sz / Math.hypot(sx, sz) // direção para o deck
    for (const sgn of [-1, 1]) {
      const px = -az * sgn, pz = ax * sgn
      const lx = sx + ax * (POOL_R + 6) + px * 12, lz = sz + az * (POOL_R + 6) + pz * 12
      addLight(lx, sy + 2, lz, 3.2, 120, 0xfff0dc)
      uplight(lx, lz, 0.9)
    }
  }

  // ═══ SE · A Pata de Diamante ══════════════════════════════════════════════
  {
    const [px, pz] = PAW_PALM
    // a marca do DOG no fundo da palma: um disco de latão com o glifo, sob a água
    const mark = new THREE.Mesh(track(new THREE.CircleGeometry(14, 64)), track(new THREE.MeshBasicMaterial({
      map: track(textTexture({ w: 512, h: 512, bg: '#0a1017', lines: [
        { text: '$DOG', size: 150, font: '700', color: '#F7931A', y: 236, letterSpacing: 6 },
        { text: 'DOG • GO • TO • THE • MOON', size: 34, color: '#c9bfae', y: 350, letterSpacing: 4 },
      ] })), toneMapped: false, transparent: true, opacity: 0.85,
    })))
    mark.rotation.x = -Math.PI / 2
    // o topo do texto para fora, para quem chega do deck ler certo (Euler XYZ: Rz primeiro)
    mark.rotation.z = Math.atan2(-Math.cos(QUADRANT_ANGLE.SE), -Math.sin(QUADRANT_ANGLE.SE))
    mark.position.set(px, yAt(px, pz) + 0.27, pz)
    group.add(mark)
    // os quatro dedos: espelhos menores, água preta, borda de luz quente
    const toeGeo = track(new THREE.CircleGeometry(PAW_TOE_R, 48))
    const toeRimGeo = track(new THREE.RingGeometry(PAW_TOE_R - 0.5, PAW_TOE_R + 0.5, 64))
    const toeWalkGeo = track(new THREE.RingGeometry(PAW_TOE_R + 0.6, PAW_TOE_R + 4.5, 64))
    const walkMat = track(new THREE.MeshStandardMaterial({ color: 0x17181d, roughness: 0.75, metalness: 0.15 }))
    for (const [tx, tz] of PAW_TOES) {
      const y = yAt(tx, tz)
      const w = new THREE.Mesh(toeGeo, waterMat); w.rotation.x = -Math.PI / 2; w.position.set(tx, y + 0.25, tz); w.receiveShadow = true; group.add(w)
      const r = new THREE.Mesh(toeRimGeo, warmRimMat); r.rotation.x = -Math.PI / 2; r.position.set(tx, y + 0.32, tz); group.add(r)
      const wk = new THREE.Mesh(toeWalkGeo, walkMat); wk.rotation.x = -Math.PI / 2; wk.position.set(tx, y + 0.34, tz); wk.receiveShadow = true; group.add(wk)
    }
    addLight(px + Math.cos(QUADRANT_ANGLE.SE) * 70, yAt(px, pz) + 6, pz + Math.sin(QUADRANT_ANGLE.SE) * 70, 2.2, 110, WARM) // uma luz para os quatro dedos
    // a borda quente da palma também (a dos outros espelhos é branca): a pata é uma só
    const palmRim = new THREE.Mesh(track(new THREE.RingGeometry(POOL_R - 0.6, POOL_R + 0.6, 96)), warmRimMat)
    palmRim.rotation.x = -Math.PI / 2
    palmRim.position.set(px, yAt(px, pz) + 0.33, pz)
    group.add(palmRim)
    const [qx, qz] = PAW_PLAQUE
    const p = makePlaque({
      title: 'THE DIAMOND PAW',
      body: 'DOG • GO • TO • THE • MOON, rune 840000:3, was airdropped in April 2024 to every wallet holding a Runestone. Diamond paws never sold. The pool is a paw print, four toes open toward the plain; the mark of the DOG lies under the water of the palm.',
      foot: '$DOG',
    }, track)
    p.position.set(qx, yAt(qx, qz), qz)
    p.rotation.y = faceAxisYaw(QUADRANT_ANGLE.SE, 12)
    group.add(p)
  }

  // ═══ SE · Leonidas, o fundador do DOG ═════════════════════════════════════
  // No eixo da diagonal, atrás dos dedos da pata, olhando para o deck por cima
  // da pata: quem chega do Anel vê a pata e, ao fundo, a figura de capa negra e
  // caveira amarela. Plinto de granito, passeio em volta (a alameda contorna).
  {
    const [lx, lz] = LEONIDAS_POS
    const ly = yAt(lx, lz)
    const g = new THREE.Group()
    g.position.set(lx, ly, lz)
    g.rotation.y = Math.atan2(-lx, -lz) // +z local → o deck
    const plinth = new THREE.Mesh(track(new THREE.CylinderGeometry(LEONIDAS_PLINTH_R * 0.62, LEONIDAS_PLINTH_R * 0.7, 2.2, 48)), graniteMat)
    plinth.position.y = 1.1
    plinth.castShadow = plinth.receiveShadow = true
    g.add(plinth)
    const step = new THREE.Mesh(track(new THREE.CylinderGeometry(LEONIDAS_PLINTH_R, LEONIDAS_PLINTH_R + 0.4, 0.5, 48)), graniteMat)
    step.position.y = 0.25
    step.receiveShadow = true
    g.add(step)
    const gl = opts.gltf ?? new GLTFLoader()
    const loadScene = (url: string) => new Promise<THREE.Object3D | null>((res) => gl.load(url, (gg) => res(gg.scene), undefined, () => res(null)))
    const [skullScene, bodyScene] = await Promise.all([loadScene('/city/leonidas-skull.glb'), loadScene('/city/leonidas-body.glb')])
    if (skullScene && bodyScene) {
      const LEO_SCALE = 11.5 // o modelo tem altura 1,0: 11,5 m
      const leo = buildLeonidas(skullScene, bodyScene, LEO_SCALE)
      disposables.push(leo)
      leo.group.scale.setScalar(LEO_SCALE)
      leo.group.position.y = 2.2
      g.add(leo.group)
    } else {
      console.warn('[plaza] leonidas did not load')
    }
    // a inscrição no plinto, do lado do deck
    const insc = new THREE.Mesh(track(new THREE.PlaneGeometry(7, 1.2)), track(new THREE.MeshBasicMaterial({
      map: track(textTexture({ w: 1024, h: 176, bg: '#121317', lines: [
        { text: 'LEONIDAS', size: 66, font: '700', color: '#e8b62b', y: 64, letterSpacing: 14 },
        { text: 'founder of DOG • GO • TO • THE • MOON', size: 30, color: '#c9bfae', y: 130 },
      ] })), toneMapped: false,
    })))
    insc.position.set(0, 1.25, LEONIDAS_PLINTH_R * 0.66)
    g.add(insc)
    group.add(g)
    // o passeio em volta do plinto, onde a alameda contorna
    const walk = new THREE.Mesh(track(new THREE.RingGeometry(LEONIDAS_PLINTH_R + 0.5, LEONIDAS_PLINTH_R + 7, 64)), track(new THREE.MeshStandardMaterial({ color: 0x17181d, roughness: 0.75, metalness: 0.15 })))
    walk.rotation.x = -Math.PI / 2
    walk.position.set(lx, ly + 0.35, lz)
    walk.receiveShadow = true
    group.add(walk)
    // dois focos rasantes vindos da frente, quentes: a caveira acende
    const ax = -lx / Math.hypot(lx, lz), az = -lz / Math.hypot(lx, lz)
    for (const sgn of [-1, 1]) {
      const px = -az * sgn, pz = ax * sgn
      const fx = lx + ax * 12 + px * 7, fz = lz + az * 12 + pz * 7
      uplight(fx, fz, 0.9)
      addLight(fx, ly + 3, fz, 3.0, 60, 0xfff0dc)
    }
  }

  // ═══ SW · O Jardim Ordinal ════════════════════════════════════════════════
  {
    const [cx, cz] = ORDINAL_CENTER
    const gltf = opts.gltf ?? new GLTFLoader()
    const [crystals, [bcTex, nmTex]] = await Promise.all([
      new Promise<THREE.Group>((res, rej) => gltf.load('/city/park/crystals.glb', (g) => res(g.scene), undefined, rej)),
      loadCrystalTextures(),
    ])
    track(bcTex); track(nmTex)
    const geos: THREE.BufferGeometry[] = []
    crystals.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { const idx = Number((o.name.match(/CRYSTAL_(\d+)/) || [])[1]); if (!Number.isNaN(idx)) geos[idx] = m.geometry } })
    // A malha do crystals.glb vem de PONTA PARA BAIXO: y de −2,96 (a ponta) a
    // −0,19 (a base), medido em runtime. No parque as matrizes do Blender trazem
    // o giro que a endireita; aqui a pedra é virada de propósito (π em torno de x,
    // antes do giro em y) e a base, que passa a ficar em +0,19·s, assenta no chão.
    const FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI)
    const upright = (yaw: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)).multiply(FLIP)
    const baseAfterFlip = (g: THREE.BufferGeometry) => { g.computeBoundingBox(); return -g.boundingBox!.max.y } // 0,19
    const stoneMat = track(crystalMaterialFor(TIERS[6], bcTex, nmTex)) // T4: pedras médias, marca a 1,4
    const bigMat = track(crystalMaterialFor(TIERS[4], bcTex, nmTex))   // T5 para a do centro
    const ringGeo = geos[6] ?? geos[0]
    const ringBase = baseAfterFlip(ringGeo)
    const ring = new THREE.InstancedMesh(ringGeo, stoneMat, ORDINAL_STONES)
    const o = new THREE.Object3D()
    for (let i = 0; i < ORDINAL_STONES; i++) {
      const a = (i / ORDINAL_STONES) * Math.PI * 2
      const x = cx + Math.cos(a) * ORDINAL_RING_R, z = cz + Math.sin(a) * ORDINAL_RING_R
      const s = 2.2 + ((i * 7) % 5) * 0.28 // 6..9 m
      // enterrada 28 %, como no parque: a pedra afunila nas duas pontas e, só
      // encostada, parecia flutuar
      o.position.set(x, yAt(x, z) - ringBase * s + 0.2 - 0.78 * s, z)
      o.quaternion.copy(upright(-a + Math.PI / 2 + 0.2))
      o.scale.setScalar(s)
      o.updateMatrix()
      ring.setMatrixAt(i, o.matrix)
    }
    ring.instanceMatrix.needsUpdate = true
    ring.castShadow = ring.receiveShadow = true
    group.add(ring)
    const bigGeo = geos[4] ?? geos[0]
    const big = new THREE.Mesh(bigGeo, bigMat)
    const S = 5.2 // 14 m
    big.position.set(cx, yAt(cx, cz) - baseAfterFlip(bigGeo) * S + 0.2 - 0.78 * S, cz)
    // a marca da pedra central olha para o Chalé (o sul)
    big.quaternion.copy(upright(Math.atan2(0 - cx, 620 - cz)))
    big.scale.setScalar(S)
    big.castShadow = big.receiveShadow = true
    group.add(big)
    // um chão de saibro claro dentro do círculo, e a borda de pedra
    const floor = new THREE.Mesh(track(new THREE.CircleGeometry(ORDINAL_RING_R + 6, 64)), track(new THREE.MeshStandardMaterial({ color: 0x2a2825, roughness: 1 })))
    floor.rotation.x = -Math.PI / 2
    floor.position.set(cx, yAt(cx, cz) + 0.28, cz)
    floor.receiveShadow = true
    group.add(floor)
    const kerb = new THREE.Mesh(track(new THREE.RingGeometry(ORDINAL_RING_R + 5.6, ORDINAL_RING_R + 6.4, 96)), track(new THREE.MeshBasicMaterial({ color: 0xF2EAD6, toneMapped: false, transparent: true, opacity: 0.5 })))
    kerb.rotation.x = -Math.PI / 2
    kerb.position.set(cx, yAt(cx, cz) + 0.36, cz)
    group.add(kerb)
    addLight(cx, yAt(cx, cz) + 8, cz, 1.6, 90, 0xdfe8ff)
    // as duas placas na alameda: a Teoria Ordinal e a Runestone
    const [p1, p2] = ORDINAL_PLAQUES
    const a = QUADRANT_ANGLE.SW
    const q1 = makePlaque({
      title: 'ORDINAL THEORY',
      body: 'Every satoshi has a number, given by the order in which it was mined. An inscription writes on one of them, and the number carries the writing forever. Bitcoin learned to remember. 2022.',
      foot: 'THE ORDINAL GARDEN',
    }, track)
    q1.position.set(p1[0], yAt(p1[0], p1[1]), p1[1]); q1.rotation.y = faceAxisYaw(a, 12); group.add(q1)
    const q2 = makePlaque({
      title: 'THE RUNESTONE',
      body: 'One stone inscribed to 112,383 wallets, the largest airdrop of its kind. Months later, DOG • GO • TO • THE • MOON fell on the same wallets. The stones in this circle are the same stone that stands 500 metres tall in the park.',
      foot: 'RUNESTONE ORDINAL PARK · 5 KM NORTH-EAST',
    }, track)
    q2.position.set(p2[0], yAt(p2[0], p2[1]), p2[1]); q2.rotation.y = faceAxisYaw(a, -12); group.add(q2)
  }

  return {
    group,
    update(t) {
      for (const p of pulses) p.m.emissiveIntensity = p.base * (0.9 + 0.1 * Math.sin(t * 0.7))
      for (const l of lights) l.intensity = (l.userData.base ??= l.intensity) * (0.94 + 0.06 * Math.sin(t * 1.3 + l.position.x * 0.03))
    },
    dispose() { for (const d of disposables) d.dispose() },
  }
}
