// O CÍRCULO DOS FUNDADORES (praca-jardins.md §3, movido em 2026-08-19): no PÉ DA
// TORRE, sobre o deck, e não mais no bulevar norte (que um dia leva à quarta
// âncora, e a placa de quem pagou a cidade não pode ficar no caminho de um lote
// futuro).
//
//   dois anéis de placas de latão em volta da Needle, na ordem de chegada
//   (founder_seq de /api/donate/leaderboard), com o endereço gravado, o total em
//   DOG e a data; depois das ocupadas, placas escuras à espera;
//   e o ANEL DE LUZ em volta delas, que fecha na proporção do fundo: quando o
//   círculo fechar (10M DOG), a cidade abre.
//
// Nada inventado: os dados chegam vivos da API; a placa de quem doou hoje está
// aqui na próxima visita. Uma malha só para as 48 placas (atlas de textura) e
// duas instâncias para as molduras.
import * as THREE from 'three'
import { DECK_Y, FOUNDERS_RINGS, FOUNDERS_SLOTS, FOUNDERS_RING_R } from './garden-plan'
import type { PerfProfile, DistanceCuller } from './perf'
import { makeGroundPool, type PoolDisc } from './light-pool'

export interface Founder {
  founder_seq: number
  address: string
  crossed_at: string
  total: number
  license?: string
}
export interface FoundersData {
  founders: Founder[]
  goal: number
  total_received: number
  progress_pct: number
}

export interface FoundersWalk {
  group: THREE.Group
  update: (t: number) => void
  dispose: () => void
}

const WARM = new THREE.Color('#FFB35C')
const fmtDog = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}K` : n.toFixed(0))
const fmtDate = (iso: string) => {
  const d = new Date(iso)
  const M = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${d.getUTCDate()} ${M[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

function plaqueTile(f: Founder | null, slot: number): HTMLCanvasElement {
  const W = 512, H = 352
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  if (f) {
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, '#b8924e'); g.addColorStop(0.5, '#d4ad66'); g.addColorStop(1, '#a98443')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(60,40,10,0.18)'
    ctx.lineWidth = 1
    for (let y = 6; y < H; y += 7) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
    ctx.strokeStyle = 'rgba(40,26,8,0.55)'
    ctx.lineWidth = 6
    ctx.strokeRect(14, 14, W - 28, H - 28)
    ctx.fillStyle = '#2a1c0a'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '700 40px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText(`FOUNDER ${String(f.founder_seq).padStart(2, '0')}`, W / 2, 62)
    ctx.font = '500 21px "JetBrains Mono", ui-monospace, monospace'
    const a = f.address
    ctx.fillText(a.slice(0, 31), W / 2, 130)
    ctx.fillText(a.slice(31), W / 2, 160)
    ctx.font = '700 46px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText(`${fmtDog(f.total)} DOG`, W / 2, 232)
    ctx.font = '500 22px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText(fmtDate(f.crossed_at), W / 2, 296)
  } else {
    ctx.fillStyle = '#131317'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(201,162,90,0.35)'
    ctx.lineWidth = 4
    ctx.strokeRect(14, 14, W - 28, H - 28)
    ctx.fillStyle = 'rgba(201,162,90,0.45)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '700 34px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText(`FOUNDER ${String(slot).padStart(2, '0')}`, W / 2, 150)
    ctx.font = '500 22px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText('THIS PLAQUE IS WAITING FOR YOU', W / 2, 220)
  }
  return c
}

export function buildFoundersWalk(opts: { heightAt: (x: number, z: number) => number; data: FoundersData | null; profile?: PerfProfile; culler?: DistanceCuller }): FoundersWalk {
  const group = new THREE.Group()
  group.name = 'FoundersCircle'
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => { disposables.push(o); return o }
  const founders = [...(opts.data?.founders ?? [])].sort((a, b) => a.founder_seq - b.founder_seq)
  const progress = THREE.MathUtils.clamp((opts.data?.progress_pct ?? 0) / 100, 0, 1)
  const Y = DECK_Y

  // ── O MURO DOS FUNDADORES: um anel de pedra em volta da torre ────────────
  // As placas deitadas não davam para ler, e os atris de 1,5 m viravam pontos:
  // a praça tem 600 m de diâmetro, então o que é humano some. A resposta é
  // ARQUITETURA: um muro contínuo de 3,2 m em volta do pé da torre, com uma
  // faixa de bronze na altura dos olhos; de longe é um anel escuro com um risco
  // de latão, de perto cada trecho é a placa de um fundador.
  const N = FOUNDERS_SLOTS
  const R0 = FOUNDERS_RINGS[0].r
  const WALL_H = 3.2, WALL_T = 1.6
  const seg = (Math.PI * 2) / N
  const PW = R0 * seg * 0.82        // a largura útil da placa no arco
  const PH = 2.0
  // ⚠️ O ATLAS É A MAIOR TEXTURA DA CENA e por isso ele obedece ao teto do
  // perfil. 8 x 512 por 6 x 352 dá 4096 x 2112 em RGBA: ~46 MB de VRAM com
  // mipmap, o item nº 1 dos 455 MB que derrubavam o contexto WebGL do celular
  // aos 68% do portão. No celular o teto de 2.048 leva o atlas a 2048 x 1056,
  // ~12 MB. Placa de fundador é TEXTO, e texto a 256 px de altura por placa
  // num telefone já está acima do que a tela resolve: aqui o corte não custa
  // leitura nenhuma, que é o que faz esta ser a primeira textura a cair.
  //
  // ⚠️ OS DOIS LADOS CAEM PELO MESMO FATOR. Escalar só o maior deformaria cada
  // célula do atlas, e o UV de cada placa é calculado a partir de COLS/ROWS.
  const COLS = 8, ROWS = 6
  const escT = (opts.profile?.texLado?.(COLS * 512) ?? COLS * 512) / (COLS * 512)
  const TW = Math.round(512 * escT), TH = Math.round(352 * escT)
  const atlas = document.createElement('canvas')
  atlas.width = COLS * TW; atlas.height = ROWS * TH
  const actx = atlas.getContext('2d')!
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [], normals: number[] = []
  const wallMats: THREE.Matrix4[][] = [[], []] // 0 = ocupado (bronze), 1 = vazio (pedra)
  const tmpO = new THREE.Object3D()
  const lightPos: THREE.Vector3[] = []
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2 - Math.PI / 2 // começa ao norte, sentido horário
    const x = Math.cos(a) * R0, z = Math.sin(a) * R0
    const f = founders[k] ?? null
    const col = k % COLS, row = Math.floor(k / COLS)
    // ⚠️ COM O TAMANHO EXPLÍCITO, senão o teto do perfil não vale de nada:
    // `plaqueTile` desenha a placa no tamanho NATIVO dela (512 x 352) e um
    // `drawImage` de três argumentos usa esse tamanho, não o da célula. Com o
    // atlas reduzido no celular, cada placa transbordaria para a célula
    // vizinha e o mural sairia embaralhado em vez de menor.
    actx.drawImage(plaqueTile(f, k + 1), col * TW, row * TH, TW, TH)
    const u0 = col / COLS, u1 = (col + 1) / COLS
    const v0 = 1 - (row + 1) / ROWS, v1 = 1 - row / ROWS
    // a placa na face EXTERNA do muro, à altura dos olhos
    const ca = Math.cos(a), sa = Math.sin(a)
    const px = x + ca * (WALL_T / 2 + 0.14), pz = z + sa * (WALL_T / 2 + 0.14)
    const py = Y + 1.72
    // du cresce para a DIREITA de quem lê de fora: a tangente é (+sa, −ca).
    // Com (−sa, +ca) o texto sai espelhado (foi assim na primeira tentativa).
    const P = (du: number, dv: number): [number, number, number] => [
      px + sa * du * (PW / 2), py + dv * (PH / 2), pz + (-ca) * du * (PW / 2),
    ]
    const base = positions.length / 3
    const c1 = P(-1, -1), c2 = P(1, -1), c3 = P(1, 1), c4 = P(-1, 1)
    positions.push(...c1, ...c2, ...c3, ...c4)
    for (let i = 0; i < 4; i++) normals.push(ca, 0, sa)
    uvs.push(u0, v0, u1, v0, u1, v1, u0, v1)
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
    // o comprimento da caixa (x local) na TANGENTE: rotation.y = −a − π/2
    // (com −a os trechos ficam radiais e o muro vira uma engrenagem)
    tmpO.position.set(x, Y + WALL_H / 2, z); tmpO.rotation.set(0, -a - Math.PI / 2, 0); tmpO.scale.setScalar(1); tmpO.updateMatrix()
    wallMats[f ? 0 : 1].push(tmpO.matrix.clone())
    if (f) lightPos.push(new THREE.Vector3(x, Y, z))
  }
  const atlasTex = track(new THREE.CanvasTexture(atlas))
  atlasTex.colorSpace = THREE.SRGBColorSpace
  atlasTex.anisotropy = 8
  const plaqueGeo = track(new THREE.BufferGeometry())
  plaqueGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  plaqueGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  plaqueGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  plaqueGeo.setIndex(indices)
  // metal puro fica PRETO na face que não pega o sol (a Lua não tem céu para
  // refletir): a gravação emite, e por isso lê de noite e contra a sombra
  // ⚠️ A GRAVAÇÃO SUBIU DE 0,85 PARA UM TERÇO A MAIS, e é porque as duas luzes
  // rasantes que lambiam o muro saíram (ver o bloco de luz no fim do arquivo).
  // A emissão passou a ser a única fonte da placa: quem baixar isto de volta
  // apaga o muro inteiro no `?hour=earthlight`, que é quando ele importa.
  const plaqueMat = track(new THREE.MeshStandardMaterial({ map: atlasTex, roughness: 0.42, metalness: 0.45, envMapIntensity: 1.1, emissive: 0xffffff, emissiveMap: atlasTex, emissiveIntensity: 0.85 * (4 / 3), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }))
  const plaqueMesh = new THREE.Mesh(plaqueGeo, plaqueMat)
  plaqueMesh.castShadow = plaqueMesh.receiveShadow = true
  group.add(plaqueMesh)
  // o muro: um trecho por fundador, curvo por aproximação (a corda de 8,6 m
  // numa circunferência de 414 m não se distingue de um arco)
  const brass = track(new THREE.MeshStandardMaterial({ color: 0xc9a25a, roughness: 0.3, metalness: 0.95, envMapIntensity: 1.2 }))
  const stone = track(new THREE.MeshStandardMaterial({ color: 0x17181d, roughness: 0.72, metalness: 0.18 }))
  const wallGeo = track(new THREE.BoxGeometry(R0 * seg + 0.4, WALL_H, WALL_T))
  for (const [i, mat] of [[0, stone], [1, stone]] as const) {
    if (!wallMats[i].length) continue
    const im = new THREE.InstancedMesh(wallGeo, mat, wallMats[i].length)
    wallMats[i].forEach((m, j) => im.setMatrixAt(j, m))
    im.instanceMatrix.needsUpdate = true
    im.castShadow = im.receiveShadow = true
    group.add(im)
  }
  // a coroa de latão no topo do muro, contínua: é ela que se vê de longe
  const crown = new THREE.Mesh(track(new THREE.CylinderGeometry(R0 + WALL_T / 2, R0 + WALL_T / 2, 0.22, 128, 1, true)), brass)
  crown.position.set(0, Y + WALL_H + 0.11, 0)
  crown.castShadow = true
  group.add(crown)
  const crownIn = new THREE.Mesh(track(new THREE.CylinderGeometry(R0 - WALL_T / 2, R0 - WALL_T / 2, 0.22, 128, 1, true)), brass)
  crownIn.position.set(0, Y + WALL_H + 0.11, 0)
  group.add(crownIn)

  // ── o anel do fundo: fecha na proporção arrecadada ────────────────────────
  const R = FOUNDERS_RING_R
  const litMat = track(new THREE.MeshBasicMaterial({ color: WARM, toneMapped: false }))
  const dimMat = track(new THREE.MeshBasicMaterial({ color: 0x3a2e1c, toneMapped: false }))
  const a0 = -Math.PI / 2 // começa ao norte
  const litLen = Math.max(0.02, progress * Math.PI * 2)
  const lit = new THREE.Mesh(track(new THREE.RingGeometry(R - 0.6, R + 0.6, 128, 1, a0, litLen)), litMat)
  lit.rotation.x = -Math.PI / 2
  lit.position.y = Y + 0.05
  group.add(lit)
  const dim = new THREE.Mesh(track(new THREE.RingGeometry(R - 0.45, R + 0.45, 128, 1, a0 + litLen, Math.PI * 2 - litLen)), dimMat)
  dim.rotation.x = -Math.PI / 2
  dim.position.y = Y + 0.05
  group.add(dim)
  const headA = a0 + litLen
  const hx = Math.cos(headA) * R, hz = Math.sin(headA) * R
  const head = new THREE.Mesh(track(new THREE.CylinderGeometry(0.8, 1.0, 0.5, 24)), brass)
  head.position.set(hx, Y + 0.25, hz)
  group.add(head)

  const sign = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h
    draw(c.getContext('2d')!)
    const t = track(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
    return track(new THREE.MeshBasicMaterial({ map: t, toneMapped: false, transparent: true }))
  }
  const d = opts.data
  const headSign = new THREE.Mesh(track(new THREE.PlaneGeometry(9, 2.25)), sign(512, 128, (ctx) => {
    ctx.fillStyle = '#121317'; ctx.fillRect(0, 0, 512, 128)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#F7931A'; ctx.font = '700 42px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText(d ? `${fmtDog(d.total_received)} / ${fmtDog(d.goal)} DOG` : 'THE FUND', 256, 44)
    ctx.fillStyle = '#c9bfae'; ctx.font = '500 22px "JetBrains Mono", ui-monospace, monospace'
    // duas linhas: a frase inteira não cabe em 512 px (auditoria de placas, item 5)
    ctx.fillText(d ? `${d.progress_pct.toFixed(1)}% RAISED` : 'THE FUND', 256, 82)
    ctx.font = '500 20px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText('WHEN THE RING CLOSES, THE CITY OPENS', 256, 110)
  }))
  headSign.rotation.x = -Math.PI / 2
  headSign.rotation.z = -headA + Math.PI / 2
  headSign.position.set(Math.cos(headA) * (R + 3.4), Y + 0.06, Math.sin(headA) * (R + 3.4))
  group.add(headSign)

  const gate = new THREE.Mesh(track(new THREE.PlaneGeometry(12, 3)), sign(1024, 256, (ctx) => {
    ctx.fillStyle = '#121317'; ctx.fillRect(0, 0, 1024, 256)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#f2ead6'; ctx.font = '700 54px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText("THE FOUNDERS' CIRCLE", 512, 70)
    ctx.fillStyle = '#c9bfae'; ctx.font = '500 26px "JetBrains Mono", ui-monospace, monospace'
    ctx.font = '500 24px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText('every wallet that paid for this city,', 512, 128)
    ctx.fillText('in the order it arrived', 512, 158)
    ctx.fillStyle = '#F7931A'
    ctx.font = '500 26px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText(`${founders.length} founders · ${FOUNDERS_SLOTS - founders.length} plaques waiting`, 512, 204)
  }))
  gate.rotation.x = -Math.PI / 2
  gate.position.set(0, Y + 0.06, -(R + 22))
  group.add(gate)

  // ── luz: NENHUMA PointLight, e é o certo aqui ────────────────────────────
  //
  // Eram duas, rasantes, sorteadas entre as placas ocupadas: cada uma custava em
  // todos os fragmentos das ~500 malhas iluminadas da praça para lamber dois
  // trechos de latão de 8,6 m. E o latão já emitia (a gravação tem `emissiveMap`,
  // justamente para ler sem sol).
  //
  // ⚠️ A POÇA MARCA SÓ AS PLACAS OCUPADAS, e isso é a narrativa do muro, não um
  // detalhe: o círculo acende conforme os fundadores chegam, e quando fechar, a
  // cidade abre. Quem espalhar poça pelos 48 trechos entrega o final antes.
  // meia corda do trecho: as poças de dois fundadores vizinhos se encostam. E o
  // centro fica meio raio à frente da face externa do muro, senão a poça nasce
  // debaixo da pedra e vaza para o lado de dentro do círculo.
  const POOL_R0 = (R0 * seg) / 2
  const OUT = 1 + (WALL_T / 2 + POOL_R0 / 2) / R0
  const pools: PoolDisc[] = lightPos.map((p) => ({
    at: [p.x * OUT, Y + 0.06, p.z * OUT] as [number, number, number],
    r: POOL_R0,
  }))
  const pool = pools.length ? track(makeGroundPool(pools, { name: 'FoundersPools' })) : null
  if (pool) group.add(pool.object)
  const poolBase = pool?.material.opacity ?? 0
  opts.culler?.add(group, (opts.profile?.textCull ?? 1300) * 1.6, new THREE.Vector3(0, 0, 0))
  void opts.heightAt

  return {
    group,
    // a poça respira na cadência que as luzes faziam: aceso e parado lê como
    // textura, aceso e respirando lê como instalação
    update(t) { if (pool) pool.material.opacity = poolBase * (0.9 + 0.1 * Math.sin(t * 1.1)) },
    dispose() { for (const d2 of disposables) d2.dispose() },
  }
}
