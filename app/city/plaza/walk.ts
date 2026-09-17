// ═══════════════════════════════════════════════════════════════════════════════
// O MODO EXPLORAR EM PRIMEIRA/TERCEIRA PESSOA — andar por DogCity como num
// metaverso (Decentraland/Roblox/Minecraft), COM o boneco do $DOG.
//
// O fundador já havia prototipado exatamente esta sensação em
// character/game/dogcity_walker.html: mouse-livre (pointer-lock), WASD, Shift
// correr, Espaço pular (gravidade lunar), V troca 1ª/3ª pessoa, e o DOG andando
// em terceira pessoa. Aquilo rodava numa cidade simples e plana; ISTO traz o
// mesmo modelo de controle + o boneco para a cena REAL (terreno lunar, torres,
// deck), como um MODO que DESLIGA o OrbitControls e assume a câmera.
//
// ⚠️ UM DONO DE CÂMERA POR VEZ. A cena inteira assume que o OrbitControls é o
// dono da orientação (controls.update() reescreve a câmera a partir de
// controls.target todo quadro). Este modo é um MODO de verdade: enquanto ativo,
// o laço PULA controls.update() e o clamp de chão do OrbitControls, e ESTE
// módulo escreve camera.position + camera.quaternion direto (euler YXZ, como o
// walker). Não há briga porque o outro dono simplesmente não roda nesses quadros.
//
// ⚠️ O ALVO É FIXADO 40 m À FRENTE todo quadro. Isso resolve três coisas de uma
// vez: followShadow() ancora o sol em controls.target e dimensiona a caixa de
// sombra pela distância câmera↔alvo (40 m cai no bucket mais apertado, sombra
// nítida no pé do boneco); nearPorDistancia() fica estável; e a SAÍDA para o
// OrbitControls fica sem solavanco — o alvo já está exatamente à frente, então
// reabilitar + um controls.update() reconstrói a MESMA orientação. (Em 3ª
// pessoa o alvo vai no peito do cão, que é o pivô natural.)
//
// PORTE FIEL AO WALKER, com as regras de desempenho da cena real:
//   • boneco carregado SÓ na primeira entrada (3,7 MB fora do boot), compileAsync
//     antes de revelar; some no 1ª pessoa; NENHUMA luz nova (contagem de luz é
//     chave do cache de shaders — luz nova recompila a cena inteira).
//   • sombra do boneco = blob (plano com gradiente), não sombra real por quadro:
//     o shadowMap é sob demanda e caro a 4,3 M de triângulos.
//   • zero setState por quadro: telemetria/prompt vão por refs (padrão do HUD da
//     guerra); setState só nas trocas de modo/vista.
//   • sem raycast contra a cena (4,3 M tri): a recolha da câmera de 3ª pessoa
//     testa contra os poucos círculos de colisão, não contra malhas.
//
// Reutilizável: depende só de three + helpers da cena passados por opts.
// ═══════════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh'
import type { Poi, PoiProximo } from './explore'

export type { Poi, PoiProximo }

// ⚠️ SONDAR O PISO DE VERDADE. `chaoDeAndar` só conhece o terreno + o disco
// plano do deck; ESCADAS, PLINTOS e TERRAÇOS são geometria dos GLBs, invisíveis
// a ele — por isso o boneco travava ao pé da escada em vez de subir. A solução
// que todo jogo usa: um raio PARA BAIXO contra as malhas andáveis, acelerado
// por BVH (three-mesh-bvh já é dependência da cena). Patch de protótipo feito
// uma vez: `acceleratedRaycast` cai no raycast padrão em malha sem boundsTree,
// então não muda o comportamento de nada que já existe (o duplo-toque etc.).
let bvhPatched = false
function patchBVH() {
  if (bvhPatched) return
  bvhPatched = true
  ;(THREE.BufferGeometry.prototype as unknown as { computeBoundsTree: typeof computeBoundsTree }).computeBoundsTree = computeBoundsTree
  ;(THREE.BufferGeometry.prototype as unknown as { disposeBoundsTree: typeof disposeBoundsTree }).disposeBoundsTree = disposeBoundsTree
  ;(THREE.Mesh.prototype as unknown as { raycast: typeof acceleratedRaycast }).raycast = acceleratedRaycast
}

// ── câmera ──────────────────────────────────────────────────────────────────
const EYE = 1.7            // altura dos olhos (bate com o clamp de chão da cena: chao+1,7)
const FOV_TP = 60          // 3ª pessoa: largo o bastante para o boneco caber
const FOV_FP = 68          // 1ª pessoa: mais aberto, periferia de jogo
const FOV_SPRINT = 3       // sopro sutil ao correr (aditivo), "premium, não fliperama"
const FOV_TAXA = 5
const LOOK_SENS = 0.0024   // rad por pixel de mouse (pointer-lock e arraste)
const PITCH_MAX = 1.30     // ~74°: olhar bem pra cima (domo/Terra) e pra baixo (o cão)
const LOOK_TARGET_DIST = 40
// ── passo ───────────────────────────────────────────────────────────────────
const WALK_SPEED = 9       // m/s — mesma régua do explore (a praça tem 600 m de vão)
const RUN_MULT = 2.2       // Shift: atravessa uma rua, não um mapa
const MOVE_DAMP = 12       // suavização de velocidade (s⁻¹), independente de fps
const GRAV = 3.1           // gravidade lunar leve
const JUMP = 4.3
const PLAYER_R = 0.6       // raio de colisão horizontal
const MAX_STEP_UP = 0.62   // degrau que a caminhada sobe sozinha (escadas têm ~0,15-0,3 m)
const MAX_STEP_DOWN = 0.62 // queda que "gruda" no chão; maior que isso é despenque lunar
const PROBE_ACIMA = 0.62   // de quanto acima dos pés o raio de piso parte (= degrau máx)
// ── boneco (3ª pessoa) ──────────────────────────────────────────────────────
const DOG_H = 1.62
const TP_DIST = 5.2        // braço da câmera atrás do cão
const TP_HEIGHT = 1.6
const TP_PIVOT = 1.15      // altura do peito (para onde a câmera olha)
const TP_LERP = 14         // mola da câmera de 3ª pessoa
const CAM_MARGIN = 0.5     // folga mínima da câmera sobre o terreno
const BODY_FACE = 10       // o corpo vira para a direção do movimento (angLerp)
// ── giro por teclado (←/→), como no modo de órbita: ~97°/s com rampa ────────
// ⚠️ ←/→ GIRAM, não dão passo lateral. O fundador aprendeu ←/→ = virar no
// modo anterior e estranhou quando aqui viravam A/D. A/D seguem sendo o
// passo lateral de quem já mira com o mouse.
const GIRO_MAX = 1.7
const GIRO_ACEL = 7
const GIRO_FREIO = 9
const POI_ENTRADA_PADRAO = 15
// ── polimento ───────────────────────────────────────────────────────────────
const BOB_AMP = 0.06       // balanço de cabeça (só 1ª pessoa), escala com a velocidade
const BOB_ROLL = 0.012
const ENTER_DUR = 0.7      // mergulho suave da vista atual até o chão ao entrar
const POI_PASSO_S = 0.25
const POI_RAIO_PADRAO = 350

const CIMA = new THREE.Vector3(0, 1, 0)

/** true quando o foco é um campo de texto: busca, follow tx, chat, modal. */
function digitando(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  if (!el || !el.tagName) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}
const damp = (a: number, b: number, l: number, dt: number) => a + (b - a) * (1 - Math.exp(-l * dt))
function angLerp(a: number, b: number, t: number) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

export type Collider = { cx: number; cz: number; r: number }

export type Walk = {
  readonly active: boolean
  enter: () => void
  exit: () => void
  toggle: () => void
  /** uma vez por quadro no laço, no lugar do bloco do OrbitControls; devolve a vista atual */
  update: (dt: number) => void
  setPois: (lista: Poi[]) => void
  poiProximo: () => PoiProximo
  /** re-envia o aviso de proximidade atual ao HUD (chamar quando a div montar) */
  reemitirPoi: () => void
  view: () => 0 | 1
  /** só para teste (?stats=1): piso andável em (x,z) visto de yRef */
  probePiso: (x: number, z: number, yRef: number) => number
  dispose: () => void
}

export function createWalk(opts: {
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  /** chão de andar (inclui a laje do deck); a cena já constrói este */
  chaoDeAndar: (x: number, z: number) => number
  /** dentro de espaço fechado abaixo d'água (aquário): não gruda no "chão" acima da cabeça */
  interior: () => boolean
  /** carrega o GLB do boneco sob demanda (a cena passa loadGlb('/city/dog.glb')) */
  loadAvatar: () => Promise<THREE.Group>
  /** true = tier fraco (mobile/lite): começa em 1ª pessoa, sem balanço, blob simples */
  lite: boolean
  reduced: boolean
  colliders: Collider[]
  /** grupos cuja geometria é PISO ANDÁVEL (deck+escadas, monumentos, precinto):
   *  o raio de piso sobe/desce por eles. BVH é montado sob demanda na 1ª entrada. */
  walkables?: THREE.Object3D[]
  onEnter?: () => void
  onExit?: () => void
  onView?: (v: 0 | 1) => void
  onPoi?: (p: PoiProximo) => void
  /** telemetria imperativa (coord/lugar), throttled pela cena; nunca setState por quadro */
  onTelemetry?: (coord: string, sector: string) => void
}): Walk {
  const { camera, controls, renderer, scene, chaoDeAndar, interior, loadAvatar, lite, reduced, colliders } = opts
  const canvas = renderer.domElement

  // ── sonda de piso: raio para baixo contra as malhas andáveis ────────────────
  const rayPiso = new THREE.Raycaster()
  // three-mesh-bvh lê `firstHitOnly` para parar no primeiro (mais alto) acerto
  ;(rayPiso as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true
  const _origem = new THREE.Vector3()
  const _baixo = new THREE.Vector3(0, -1, 0)
  let malhasAndaveis: THREE.Mesh[] = []
  let rootsMontados = -1 // nº de grupos andáveis já indexados (barato repetir)
  // re-executável e barato: os grupos andáveis chegam ao longo do boot (os
  // monumentos num `.then`), então remontamos só quando a contagem muda. O BVH
  // de cada geometria é montado uma única vez (guardado em `boundsTree`).
  const montaBVH = () => {
    const roots = opts.walkables ?? []
    const n = roots.length
    if (n === 0 || n === rootsMontados) return
    patchBVH()
    const lista: THREE.Mesh[] = []
    for (const raiz of roots) {
      raiz.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh || !m.geometry) return
        const g = m.geometry as THREE.BufferGeometry & { boundsTree?: unknown; computeBoundsTree?: () => void }
        if (!g.boundsTree && g.computeBoundsTree) { try { g.computeBoundsTree() } catch { /* segue sem BVH */ } }
        lista.push(m)
      })
    }
    malhasAndaveis = lista
    rootsMontados = n
  }
  /** altura do piso real em (x,z) a partir de yRef: o topo mais alto abaixo de
   *  yRef+PROBE_ACIMA, dentro do alcance de degrau/queda; -Infinity se não achar */
  const pisoGlb = (x: number, z: number, yRef: number): number => {
    if (!malhasAndaveis.length) return -Infinity
    _origem.set(x, yRef + PROBE_ACIMA, z)
    rayPiso.set(_origem, _baixo)
    rayPiso.far = PROBE_ACIMA + MAX_STEP_DOWN + 0.6
    const hits = rayPiso.intersectObjects(malhasAndaveis, false)
    return hits.length ? hits[0].point.y : -Infinity
  }

  let active = false
  // 1ª pessoa é o padrão no tier fraco (sem esperar o boneco); no desktop
  // começa em 3ª pessoa — a graça do metaverso é VER o $DOG andando.
  let view: 0 | 1 = lite ? 0 : 1
  const player = {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    grounded: true,
  }

  // ── teclado ────────────────────────────────────────────────────────────────
  const teclas: Record<string, boolean> = {}
  let sprint = false
  const MOVE = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
  const onKeyDown = (e: KeyboardEvent) => {
    if (!active || digitando(e.target)) return
    if (e.key === 'Shift') { sprint = true; return }
    if (e.code === 'KeyV') { setView(view ? 0 : 1); return }
    if (e.code === 'Space') { e.preventDefault(); if (player.grounded) { player.vel.y = JUMP; player.grounded = false }; return }
    if (e.code === 'Escape') { exit(); return }
    if (MOVE.has(e.code)) { e.preventDefault(); teclas[e.code] = true; sprint = e.shiftKey }
  }
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Shift') { sprint = false; return }
    if (MOVE.has(e.code)) delete teclas[e.code]
  }
  const soltaTudo = () => { for (const k of Object.keys(teclas)) delete teclas[k]; sprint = false }

  // ── mouse: pointer-lock, com arraste de reserva ──────────────────────────────
  let locked = false
  let dragging = false
  let lastX = 0, lastY = 0
  const applyLook = (dx: number, dy: number) => {
    player.yaw -= dx * LOOK_SENS
    player.pitch = THREE.MathUtils.clamp(player.pitch - dy * LOOK_SENS, -PITCH_MAX, PITCH_MAX)
  }
  // ⚠️ PEDIR O POINTER-LOCK NUNCA PODE DERRUBAR O MODO. Sem gesto do usuário
  // (entrada por API/teste), em iframe ou em webview de carteira, o pedido
  // lança ou devolve promessa rejeitada; se isso subir, o enter() aborta no
  // meio e o React nunca fica sabendo que entrou (foi o que a suíte pegou:
  // câmera no chão e botão ainda "Walk"). Degrada para arraste, em silêncio.
  const pedeLock = () => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    try {
      // devolve Promise em Chrome novo e void em motores antigos: `unknown` +
      // instanceof cobre os dois sem o TS reclamar de testar `void`
      const r: unknown = canvas.requestPointerLock?.()
      if (r instanceof Promise) r.catch(() => {})
    } catch { /* fica no arraste */ }
  }
  const soltaLock = () => { try { document.exitPointerLock?.() } catch { /* nada */ } }
  const onCanvasClick = () => {
    if (!active || locked) return
    pedeLock() // re-trava se perdeu o lock (mas segue andando)
  }
  const onLockChange = () => {
    locked = document.pointerLockElement === canvas
  }
  const onDown = (e: PointerEvent) => { if (active && !locked) { dragging = true; lastX = e.clientX; lastY = e.clientY } }
  const onUp = () => { dragging = false }
  const onMove = (e: PointerEvent) => {
    if (!active) return
    if (locked) applyLook(e.movementX, e.movementY)
    else if (dragging) { applyLook(e.clientX - lastX, e.clientY - lastY); lastX = e.clientX; lastY = e.clientY }
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', soltaTudo)
  document.addEventListener('visibilitychange', soltaTudo)
  document.addEventListener('pointerlockchange', onLockChange)
  canvas.addEventListener('click', onCanvasClick)
  canvas.addEventListener('pointerdown', onDown)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointermove', onMove)

  // ── boneco (carregado na primeira entrada) ───────────────────────────────────
  const dogGroup = new THREE.Group()   // posição/rotação no mundo
  const dogInner = new THREE.Group()   // balanço/inclinação da caminhada
  dogGroup.add(dogInner)
  dogGroup.visible = false
  dogGroup.frustumCulled = false
  scene.add(dogGroup)
  let dogReady = false
  let loadingDog = false
  let dogFacing = 0

  // sombra falsa (blob): um plano com gradiente radial, ZERO luz, ZERO custo de
  // shadowMap. O shadowMap da cena é sob demanda e caro; seguir um corpo em
  // movimento com sombra real refaria o mapa todo quadro.
  let blob: THREE.Mesh | null = null
  const makeBlob = () => {
    const c = document.createElement('canvas'); c.width = c.height = 128
    const x = c.getContext('2d')!
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 62)
    g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)')
    x.fillStyle = g; x.fillRect(0, 0, 128, 128)
    const t = new THREE.CanvasTexture(c)
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.8),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }),
    )
    m.rotation.x = -Math.PI / 2
    m.frustumCulled = false
    m.visible = false
    scene.add(m)
    return m
  }

  const ensureDog = () => {
    if (dogReady || loadingDog) return
    loadingDog = true
    loadAvatar().then(async (g) => {
      // normaliza: altura DOG_H, centrado em x/z, pés em y=0
      const box = new THREE.Box3().setFromObject(g)
      const size = new THREE.Vector3(); box.getSize(size)
      const s = DOG_H / (size.y || 1)
      g.scale.setScalar(s)
      const box2 = new THREE.Box3().setFromObject(g)
      const c2 = new THREE.Vector3(); box2.getCenter(c2)
      g.position.x -= c2.x; g.position.z -= c2.z; g.position.y -= box2.min.y
      g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = false } })
      dogInner.add(g)
      blob = makeBlob()
      // aquece o programa/texturas do novo material ANTES de revelar (um material
      // novo = um shader novo; sem isto o primeiro quadro do cão engasga)
      try { await renderer.compileAsync(dogGroup, camera) } catch { /* segue mesmo assim */ }
      dogReady = true
    }).catch(() => { loadingDog = false })
  }

  // ── entrada / saída ──────────────────────────────────────────────────────────
  const _euler = new THREE.Euler(0, 0, 0, 'YXZ')
  const _dir = new THREE.Vector3()
  const fovBaseAlvo = () => (view === 1 ? FOV_TP : FOV_FP)
  let entering = 0            // conta regressiva do mergulho de entrada
  const enterFrom = new THREE.Vector3()
  let fovAoEntrar = 42

  const setView = (v: 0 | 1) => {
    view = v
    if (v === 1) ensureDog()
    dogGroup.visible = v === 1 && dogReady
    if (blob) blob.visible = v === 1 && dogReady
    opts.onView?.(v)
  }

  const enter = () => {
    if (active) return
    active = true
    // orientação a partir da câmera atual (takeover sem giro)
    _euler.setFromQuaternion(camera.quaternion, 'YXZ')
    player.yaw = _euler.y
    player.pitch = THREE.MathUtils.clamp(_euler.x, -PITCH_MAX, PITCH_MAX)
    // spawn: onde você está OLHANDO, projetado no chão (cai na cidade, de pé,
    // encarando o que via). Clampa a um raio são para não nascer no vazio.
    const tgt = controls.target
    let sx = tgt.x, sz = tgt.z
    const r = Math.hypot(sx, sz)
    const RMAX = 3200
    if (r > RMAX) { sx *= RMAX / r; sz *= RMAX / r }
    player.pos.set(sx, chaoDeAndar(sx, sz), sz)
    player.vel.set(0, 0, 0)
    player.grounded = true
    // mergulho suave da vista atual (pode estar a 600 m no alto) até o chão
    enterFrom.copy(camera.position)
    fovAoEntrar = camera.fov
    entering = ENTER_DUR
    controls.autoRotate = false
    controls.enabled = false
    poiUltimo = '' // o primeiro aviso desta entrada sempre sai
    montaBVH() // monta o índice do piso na 1ª entrada (uma vez)
    // assenta o spawn no piso real (escada/plinto/deck), não só no terreno
    { const g = pisoGlb(player.pos.x, player.pos.z, player.pos.y); if (g > -Infinity) player.pos.y = Math.max(player.pos.y, g) }
    if (view === 1) ensureDog()
    // o React fica sabendo ANTES do pedido de lock: o modo já está de pé
    // mesmo que o lock seja negado
    opts.onEnter?.()
    pedeLock()
  }

  const exit = () => {
    if (!active) return
    active = false
    soltaTudo()
    // zera o roll do balanço e fixa o alvo à frente: o OrbitControls reassume
    // reconstruindo a MESMA orientação a partir do alvo — sem solavanco.
    _euler.set(player.pitch, player.yaw, 0, 'YXZ')
    camera.quaternion.setFromEuler(_euler)
    camera.getWorldDirection(_dir)
    controls.target.copy(camera.position).addScaledVector(_dir, LOOK_TARGET_DIST)
    controls.enabled = true
    controls.autoRotate = false
    // devolve o FOV cinematográfico
    if (camera.fov !== 42) { camera.fov = 42; camera.updateProjectionMatrix() }
    controls.update()
    soltaLock()
    dogGroup.visible = false
    if (blob) blob.visible = false
    opts.onExit?.()
  }

  const toggle = () => { active ? exit() : enter() }

  // ── colisão: empurra o jogador para fora dos círculos, só em X/Z ────────────
  const collide = (p: THREE.Vector3) => {
    for (const c of colliders) {
      const dx = p.x - c.cx, dz = p.z - c.cz
      const d = Math.hypot(dx, dz), min = c.r + PLAYER_R
      if (d < min && d > 1e-4) { p.x = c.cx + (dx / d) * min; p.z = c.cz + (dz / d) * min }
    }
  }

  // ── POIs (mesmo contrato do explore) ─────────────────────────────────────────
  // ⚠️ AVISA AO VIVO: dispara sempre que o marco, o metro arredondado ou o
  // estado "perto" mudam (4 Hz no máximo — escrita barata de textContent). A
  // versão anterior só disparava a cada 3 m e perdia o primeiro aviso quando
  // a div do HUD ainda não tinha montado; agora quem monta depois recebe o
  // estado atual pelo `reemitir()`.
  let pois: Poi[] = []
  let poiAtual: PoiProximo = null
  let poiRelogio = 0
  let poiUltimo = '' // assinatura do último aviso emitido
  const emite = (p: PoiProximo) => {
    const perto = !!p && p.dist <= (p.poi.entrada ?? POI_ENTRADA_PADRAO)
    const assinatura = p ? `${p.poi.key}:${Math.round(p.dist)}:${perto ? 1 : 0}` : ''
    if (assinatura === poiUltimo) return
    poiUltimo = assinatura
    opts.onPoi?.(p)
  }
  const avaliaPois = () => {
    let melhor: PoiProximo = null
    for (const p of pois) {
      const d = Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z)
      if (d <= (p.raio ?? POI_RAIO_PADRAO) && (!melhor || d < melhor.dist)) melhor = { poi: p, dist: d }
    }
    poiAtual = melhor
    emite(poiAtual)
  }
  /** força o HUD a receber o aviso atual (depois que a div montar) */
  const reemitir = () => { poiUltimo = ''; emite(poiAtual) }

  // vetores pré-alocados (nada aloca por quadro)
  const _fwd = new THREE.Vector3()
  const _right = new THREE.Vector3()
  const _wish = new THREE.Vector3()
  const _eye = new THREE.Vector3()
  const _anchor = new THREE.Vector3()
  const _desired = new THREE.Vector3()
  let bob = 0
  let giroVel = 0
  let fovExtra = 0
  let telemRelogio = 0

  const update = (dt: number) => {
    // ── entrada de movimento e giro por teclado ──────────────────────────────
    // A/D = passo lateral; W/S e ↑/↓ = frente/ré; ←/→ = GIRAR (ver GIRO_MAX)
    const ix = (teclas.KeyD ? 1 : 0) - (teclas.KeyA ? 1 : 0)
    const iz = (teclas.KeyW || teclas.ArrowUp ? 1 : 0) - (teclas.KeyS || teclas.ArrowDown ? 1 : 0)
    const ig = (teclas.ArrowLeft ? 1 : 0) - (teclas.ArrowRight ? 1 : 0)
    const noMergulho = entering > 0
    const podeAndar = !noMergulho

    // giro por seta: o yaw persegue a velocidade de giro com a mesma rampa do
    // andar, então vira a cabeça (1ª) ou orbita atrás do cão (3ª) sem trepidar
    const girando = podeAndar && ig !== 0
    giroVel += ((girando ? ig * GIRO_MAX : 0) - giroVel) * (1 - Math.exp(-(girando ? GIRO_ACEL : GIRO_FREIO) * dt))
    if (Math.abs(giroVel) > 1e-3) player.yaw += giroVel * dt
    else if (giroVel !== 0) giroVel = 0

    // base horizontal a partir do yaw
    _fwd.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw))
    _right.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw))
    _wish.copy(_fwd).multiplyScalar(iz).addScaledVector(_right, ix)
    if (podeAndar && _wish.lengthSq() > 1e-6) {
      _wish.normalize().multiplyScalar(WALK_SPEED * (sprint ? RUN_MULT : 1))
    } else {
      _wish.set(0, 0, 0)
    }
    // velocidade horizontal persegue o desejo (nunca position += passo)
    player.vel.x = damp(player.vel.x, _wish.x, MOVE_DAMP, dt)
    player.vel.z = damp(player.vel.z, _wish.z, MOVE_DAMP, dt)

    const dentro = interior()
    // gravidade + integração
    if (!dentro) player.vel.y -= GRAV * dt
    player.pos.x += player.vel.x * dt
    player.pos.z += player.vel.z * dt
    player.pos.y += player.vel.y * dt
    if (!dentro) collide(player.pos)

    // ── contato com o chão real, com degrau/queda limitados ─────────────────
    // O piso é o MAIS ALTO entre o terreno analítico (chaoDeAndar) e o topo
    // sondado nas malhas andáveis (escada/plinto/deck). É isso que faz a
    // escada subir: cada degrau é um topo pouco acima dos pés, dentro de
    // MAX_STEP_UP, então o pé assenta nele em vez de parar no nível do deck.
    // piso sob os pés (terreno OU topo sondado): serve ao grounding E à sombra
    const terreno = chaoDeAndar(player.pos.x, player.pos.z)
    const glb = pisoGlb(player.pos.x, player.pos.z, player.pos.y)
    const floor = Math.max(terreno, glb)
    if (!dentro) {
      if (player.vel.y <= 0) {
        const dyUp = floor - player.pos.y
        if (dyUp >= 0) {
          // subindo: rampa contínua sobe sozinha; borda alta é parede (não teleporta)
          if (dyUp <= MAX_STEP_UP) { player.pos.y = floor; player.vel.y = 0; player.grounded = true }
          else { player.grounded = false } // encostou numa parede de degrau; fica onde está no y
        } else {
          // caindo: "gruda" em quedas curtas (ladeira), despenca nas grandes
          if (-dyUp <= MAX_STEP_DOWN && player.grounded) { player.pos.y = floor; player.vel.y = 0 }
          else { player.grounded = false }
        }
      }
    } else {
      player.grounded = true
      player.vel.y = 0
    }

    const horiz = Math.hypot(player.vel.x, player.vel.z)

    // ── balanço de cabeça (só 1ª pessoa) ─────────────────────────────────────
    if (!reduced && player.grounded && horiz > 0.6) bob += dt * (sprint ? 13 : 9)
    else bob = damp(bob, 0, 8, dt)
    const bobK = Math.min(1, horiz / 4)
    const bobY = view === 0 ? Math.sin(bob) * BOB_AMP * bobK : 0
    const bobRoll = view === 0 ? Math.cos(bob * 0.5) * BOB_ROLL * bobK : 0

    // ── boneco: posição, rumo e gingado ──────────────────────────────────────
    if (dogReady) {
      dogGroup.position.copy(player.pos)
      const face = horiz > 0.5 ? Math.atan2(player.vel.x, player.vel.z)
        : Math.atan2(-Math.sin(player.yaw), -Math.cos(player.yaw))
      dogFacing = angLerp(dogFacing, face, 1 - Math.exp(-BODY_FACE * dt))
      dogGroup.rotation.y = dogFacing
      const wk = Math.min(1, horiz / WALK_SPEED)
      dogInner.position.y = Math.abs(Math.sin(bob * 0.5)) * 0.05 * wk
      dogInner.rotation.z = Math.sin(bob * 0.5) * 0.05 * wk
      dogInner.rotation.x = -0.12 * wk
      dogGroup.visible = view === 1
      if (blob) {
        blob.visible = view === 1
        const bh = player.pos.y - floor // altura do pulo sobre o piso real
        blob.position.set(player.pos.x, floor + 0.03, player.pos.z)
        const sc = THREE.MathUtils.clamp(1 - bh * 0.12, 0.55, 1.1)
        blob.scale.setScalar(sc)
        ;(blob.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.clamp(0.5 - bh * 0.15, 0.12, 0.5)
      }
    }

    // ── câmera ────────────────────────────────────────────────────────────────
    if (view === 0) {
      // 1ª pessoa: olho no lugar, orientação YXZ direta (snappy, sem suavizar)
      _eye.set(player.pos.x, player.pos.y + EYE + bobY, player.pos.z)
      _euler.set(player.pitch, player.yaw, bobRoll, 'YXZ')
      if (noMergulho) {
        const k = 1 - (entering / ENTER_DUR)
        const s = k * k * (3 - 2 * k)
        camera.position.lerpVectors(enterFrom, _eye, s)
      } else {
        camera.position.copy(_eye)
      }
      camera.quaternion.setFromEuler(_euler)
    } else {
      // 3ª pessoa: braço atrás do cão, recolhido pelos círculos de colisão,
      // sempre acima do terreno; mola de posição; olha o peito
      _anchor.set(player.pos.x, player.pos.y + TP_PIVOT, player.pos.z)
      _desired.copy(_anchor).addScaledVector(_fwd, -TP_DIST)
      _desired.y = player.pos.y + EYE + TP_HEIGHT - player.pitch * 2.2
      // recolhe se um círculo de colisão fica entre o cão e a câmera
      for (const c of colliders) {
        const dx = _desired.x - c.cx, dz = _desired.z - c.cz
        const d = Math.hypot(dx, dz)
        if (d < c.r + 0.6) {
          // puxa a câmera para a linha do braço, mais perto do cão
          const back = Math.max(1.4, TP_DIST * 0.5)
          _desired.copy(_anchor).addScaledVector(_fwd, -back)
          _desired.y = player.pos.y + EYE + TP_HEIGHT - player.pitch * 2.2
          break
        }
      }
      // a câmera nunca entra no piso — nem no terreno, nem numa escada/plinto
      const soloCam = Math.max(chaoDeAndar(_desired.x, _desired.z), pisoGlb(_desired.x, _desired.z, _desired.y)) + CAM_MARGIN
      if (_desired.y < soloCam) _desired.y = soloCam
      if (noMergulho) {
        const k = 1 - (entering / ENTER_DUR)
        const s = k * k * (3 - 2 * k)
        camera.position.lerpVectors(enterFrom, _desired, s)
      } else {
        camera.position.lerp(_desired, 1 - Math.exp(-TP_LERP * dt))
      }
      camera.lookAt(_anchor.x, _anchor.y + 0.2, _anchor.z)
    }

    // ── FOV: mistura ao entrar/sair, +sopro sutil ao correr ──────────────────
    const alvoBase = fovBaseAlvo()
    const extraAlvo = (podeAndar && sprint && horiz > 0.5) ? FOV_SPRINT : 0
    fovExtra = fovExtra + (extraAlvo - fovExtra) * (1 - Math.exp(-FOV_TAXA * dt))
    let fovAlvo = alvoBase + fovExtra
    if (noMergulho) {
      const k = 1 - (entering / ENTER_DUR)
      const s = k * k * (3 - 2 * k)
      fovAlvo = fovAoEntrar + (alvoBase - fovAoEntrar) * s
    }
    if (Math.abs(camera.fov - fovAlvo) > 1e-3) { camera.fov = fovAlvo; camera.updateProjectionMatrix() }

    // ⚠️ fixa o alvo do OrbitControls (para followShadow + saída sem solavanco):
    // 40 m à frente em 1ª pessoa; no peito do cão em 3ª. controls.update() NÃO
    // roda neste modo, então escrever o alvo não tem efeito de orientação aqui.
    if (view === 0) {
      camera.getWorldDirection(_dir)
      controls.target.copy(camera.position).addScaledVector(_dir, LOOK_TARGET_DIST)
    } else {
      controls.target.copy(_anchor)
    }

    if (entering > 0) entering = Math.max(0, entering - dt)

    // ── POIs + telemetria (throttled, imperativo) ────────────────────────────
    if (pois.length) {
      poiRelogio += dt
      if (poiRelogio >= POI_PASSO_S) { poiRelogio = 0; avaliaPois() }
    }
    if (opts.onTelemetry) {
      telemRelogio += dt
      if (telemRelogio >= 0.15) {
        telemRelogio = 0
        const sector = poiAtual ? poiAtual.poi.label
          : (player.pos.x * player.pos.x + player.pos.z * player.pos.z < 300 * 300 ? 'Satoshi Plaza' : 'the streets')
        opts.onTelemetry(`${player.pos.x.toFixed(0)}, ${player.pos.z.toFixed(0)}`, sector)
      }
    }
  }

  return {
    get active() { return active },
    enter, exit, toggle, update,
    setPois: (lista) => { pois = lista },
    poiProximo: () => poiAtual,
    reemitirPoi: reemitir,
    view: () => view,
    probePiso: (x, z, yRef) => { montaBVH(); return Math.max(chaoDeAndar(x, z), pisoGlb(x, z, yRef)) },
    dispose: () => {
      if (active) exit()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', soltaTudo)
      document.removeEventListener('visibilitychange', soltaTudo)
      document.removeEventListener('pointerlockchange', onLockChange)
      canvas.removeEventListener('click', onCanvasClick)
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointermove', onMove)
      // solta os índices BVH que montamos nas malhas andáveis (a geometria é
      // da cena, então NÃO a descartamos — só a árvore que adicionamos)
      for (const m of malhasAndaveis) {
        const g = m.geometry as THREE.BufferGeometry & { boundsTree?: unknown; disposeBoundsTree?: () => void }
        if (g.boundsTree && g.disposeBoundsTree) { try { g.disposeBoundsTree() } catch { /* nada */ } }
      }
      malhasAndaveis = []
      scene.remove(dogGroup)
      if (blob) { scene.remove(blob); blob.geometry.dispose(); (blob.material as THREE.Material).dispose() }
      dogInner.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh) { m.geometry?.dispose(); const mm = Array.isArray(m.material) ? m.material : [m.material]; for (const x of mm) x?.dispose() }
      })
    },
  }
}
