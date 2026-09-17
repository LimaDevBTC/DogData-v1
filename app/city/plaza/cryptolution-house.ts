// A CASA DO VINCENT — a Cryptolution House, agora DENTRO da cidade 3D.
//
// A landing (/dogcity) já tinha a chapa da casa; o fundador pediu o prédio de
// verdade na praça. Esta é a construção: uma CASA lunar (não uma torre — torre é
// pra âncora institucional) cuja FACHADA é um telão, e o telão mostra o vídeo do
// dia do Vincent (@cryptolution101, canal "Cryptolution"). Fica na cabeça do
// eixo norte, olhando por cima da Grande Fonte para Satoshi Plaza e a Needle.
//
// ⚠️ O MESMO CONTRATO DO CHALÉ (chalet.ts): `build…()` devolve `{ group, update,
// dispose }`, quem chama posiciona o group na âncora e chama `update(t)` no laço
// e `dispose()` na limpeza. Nada de rede aqui — o vídeo do dia entra por
// parâmetro (o retrato embutido de lib/cryptolution/feed.ts), então a casa nasce
// certa mesmo em localhost sem rede.
//
// ⚠️ O TELÃO É UM PÔSTER, NÃO O PLAYER. Sampler de vídeo do YouTube em WebGL não
// existe (e os Termos exigem tocar no player deles). Então a face mostra a
// thumbnail real do vídeo (i.ytimg.com serve com CORS liberado — ver feed.ts) com
// o play e o título por cima; o play de verdade é o overlay <iframe> que a cena
// levanta ao clicar (plaza-scene.tsx), e o visitante nunca sai da cidade.
import * as THREE from 'three'

// A paleta agora vive no modelo do Blender (public/city/cryptolution-house.glb);
// aqui só resta o telão dinâmico, que desenha suas próprias cores no canvas.

export interface CryptolutionHouseVideo {
  id: string
  title: string
  /** thumbnail hqdefault, i.ytimg.com (CORS liberado) */
  thumb: string
}

export interface CryptolutionHouse {
  group: THREE.Group
  /** o mesh do telão — quem clica nele abre o vídeo (raycast em plaza-scene) */
  screen: THREE.Mesh
  /** o vídeo que está no telão agora */
  video: CryptolutionHouseVideo
  /** altura do topo da chaminé, pra quem quiser mirar a câmera */
  apexY: number
  update: (t: number) => void
  dispose: () => void
}

// ── o telão desenhado num canvas ─────────────────────────────────────────────
// Desenha o pôster do vídeo do dia: fundo escuro, a thumbnail real quando ela
// chega, o degradê, a pílula "DAILY DISPATCH", o botão de play e o título. Roda
// uma vez na hora certa e de novo quando a imagem do YouTube carrega.
function makeScreenTexture(video: CryptolutionHouseVideo): {
  texture: THREE.CanvasTexture
  dispose: () => void
} {
  const W = 1024, H = 576 // 16:9
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8

  let img: HTMLImageElement | null = null

  const wrap = (text: string, maxW: number, font: string): string[] => {
    ctx.font = font
    const words = text.split(/\s+/)
    const lines: string[] = []
    let line = ''
    for (const w of words) {
      const test = line ? line + ' ' + w : w
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line)
        line = w
      } else line = test
    }
    if (line) lines.push(line)
    return lines.slice(0, 2)
  }

  const draw = () => {
    // fundo
    ctx.fillStyle = '#07070b'
    ctx.fillRect(0, 0, W, H)
    // a thumbnail, se já chegou (cobre a tela, recorte "cover")
    if (img && img.complete && img.naturalWidth) {
      const ir = img.naturalWidth / img.naturalHeight
      const cr = W / H
      let dw = W, dh = H, dx = 0, dy = 0
      if (ir > cr) { dh = H; dw = H * ir; dx = (W - dw) / 2 }
      else { dw = W; dh = W / ir; dy = (H - dh) / 2 }
      try { ctx.drawImage(img, dx, dy, dw, dh) } catch { /* taint improvável: i.ytimg tem CORS */ }
    }
    // degradê pra assentar o texto (como a chapa da landing)
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, 'rgba(0,0,0,0.45)')
    g.addColorStop(0.45, 'rgba(0,0,0,0.05)')
    g.addColorStop(1, 'rgba(0,0,0,0.9)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)

    // pílula "DAILY DISPATCH" com o ponto pulsando
    ctx.font = '600 22px ui-monospace, monospace'
    const pill = 'DAILY DISPATCH'
    const pw = ctx.measureText(pill).width
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(28, 28, pw + 58, 40)
    ctx.fillStyle = '#F56E0F'
    ctx.beginPath()
    ctx.arc(50, 48, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.textBaseline = 'middle'
    ctx.fillText(pill, 68, 50)

    // botão de play, centro
    ctx.fillStyle = '#F5B02B'
    ctx.beginPath()
    ctx.arc(W / 2, H / 2, 58, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#08070b'
    ctx.beginPath()
    ctx.moveTo(W / 2 - 20, H / 2 - 30)
    ctx.lineTo(W / 2 - 20, H / 2 + 30)
    ctx.lineTo(W / 2 + 34, H / 2)
    ctx.closePath()
    ctx.fill()

    // título do vídeo, embaixo
    ctx.fillStyle = '#F4F4F6'
    const titleFont = '700 30px ui-sans-serif, system-ui, sans-serif'
    const lines = wrap(video.title, W - 72, titleFont)
    ctx.font = titleFont
    ctx.textBaseline = 'alphabetic'
    let ty = H - 40 - (lines.length - 1) * 36
    for (const l of lines) { ctx.fillText(l, 36, ty); ty += 36 }

    texture.needsUpdate = true
  }

  draw()

  // busca a thumbnail real (CORS liberado no i.ytimg — feed.ts); ao chegar,
  // redesenha com a imagem. Se falhar, o pôster segue com o fundo escuro.
  if (video.thumb) {
    img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = draw
    img.onerror = () => { img = null }
    img.src = video.thumb
  }

  return {
    texture,
    dispose: () => {
      if (img) { img.onload = null; img.onerror = null; img = null }
      texture.dispose()
    },
  }
}

// ── a casa: a carcaça vem do Blender, o telão continua vivo aqui ──────────────
// O fundador achou a versão procedural feia; a arquitetura agora é modelada no
// Blender (blender/… → public/city/cryptolution-house.glb) — uma villa de
// transmissão lunar: pódio de pedra, dois pilares emoldurando o telão como um
// proscênio, andar de vidro em balanço com interior quente, marquise projetada,
// terraço e mastro-farol. O que o Three.js ainda faz é o que o GLB não pode: o
// TELÃO dinâmico (a thumb do vídeo do dia) encaixado no recesso, e o clique→play.
//
// `shell` é o group já carregado do GLB (quem chama usa o loadGlb da cena).
export function buildCryptolutionHouse(video: CryptolutionHouseVideo, shell: THREE.Object3D): CryptolutionHouse {
  const group = new THREE.Group()
  group.name = 'CryptolutionHouse'
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => { disposables.push(o); return o }

  // a carcaça de arquitetura
  shell.name = 'CryptolutionShell'
  group.add(shell)

  // percorre o GLB: sombras, taming de reflexo (como a praça faz nas âncoras) e
  // recolhe os materiais LARANJA (farol + arestas) pra fazê-los respirar no update.
  const pulse = new Set<THREE.MeshStandardMaterial>()
  const glbGeo: THREE.BufferGeometry[] = []
  const glbMat = new Set<THREE.Material>()
  shell.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
    if (mesh.geometry) glbGeo.push(mesh.geometry)
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of mats) {
      if (!m) continue
      glbMat.add(m)
      const sm = m as THREE.MeshStandardMaterial
      // reflexo domado: a praça vive num estúdio lunar escuro, não num showroom
      if ('envMapIntensity' in sm) sm.envMapIntensity = 0.5
      const n = (m.name || '').toLowerCase()
      // ⚠️ A MASSA SOBE, como a praça faz nas âncoras (liftMassing). Pedra crua a
      // ~4% de cinza vira silhueta preta no sol lunar; aqui ela ganha corpo pra
      // ler como arquitetura, não como buraco.
      // ⚠️ COR FIXA, não multiplicação: a pedra do GLB era levemente AZUL e crua;
      // multiplicar revelava um lavanda que destoava das torres. Aqui ela vira um
      // taupe quente-escuro, na família da praça, e o metal um cinza neutro escuro.
      if (n.includes('stone')) { sm.color.setRGB(0.115, 0.10, 0.088); sm.roughness = 0.9 }
      else if (n.includes('metal')) { sm.color.setRGB(0.085, 0.085, 0.095); sm.metalness = 0.9; sm.roughness = 0.4 }
      if (n.includes('warm')) sm.emissiveIntensity = 2.4       // interior quente que brilha
      if (n.includes('lava')) { sm.emissiveIntensity = 1.7; pulse.add(sm) } // laranja, não branco estourado
    }
  })
  const pulseArr = Array.from(pulse)
  const pulseBase = pulseArr.map((m) => m.emissiveIntensity)

  // ── luz própria: a casa acesa (o GLB é só matéria; a vida é a luz) ──────────
  // Posições locais medidas do modelo (Blender→glTF). Fazem o telão, o soffit e o
  // andar de vidro lerem como "acesos à noite", e o farol lança luz laranja.
  const lights: THREE.PointLight[] = []
  const addLight = (color: number, intensity: number, dist: number, x: number, y: number, z: number) => {
    const l = new THREE.PointLight(color, intensity, dist, 2)
    l.position.set(x, y, z)
    group.add(l); lights.push(l)
    return l
  }
  addLight(0xffb060, 34, 150, 0, 78, 30)   // soffit da marquise lavando o telão
  addLight(0xffa64d, 26, 180, 0, 100, 10)  // interior do andar de vidro
  const beaconLight = addLight(0xf56e0f, 46, 320, 56, 140, -12) // o farol
  const beaconBase = beaconLight.intensity

  // ── o telão dinâmico (o vídeo do dia), encaixado no recesso da fachada ──────
  // Posição LOCAL medida do modelo do Blender (build_house.py): o vão do telão
  // tem centro em (0, 42, 30.7) e a face olha para +Z — a frente que, com o group
  // sem rotação, aponta para a praça. Tamanho 96×54, igual ao que o Blender abriu.
  const screenTex = track(makeScreenTexture(video))
  const SCREEN_W = 96, SCREEN_H = 54
  const screen = new THREE.Mesh(
    track(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H)),
    track(new THREE.MeshBasicMaterial({ map: screenTex.texture, toneMapped: false })),
  )
  screen.position.set(0, 42, 30.7)
  screen.name = 'CryptolutionScreen'
  screen.userData.cryptolution = true // marca pro raycast do clique→vídeo
  group.add(screen)

  return {
    group,
    screen,
    video,
    apexY: 132,
    update(t) {
      // o farol e as arestas laranja respiram: o "sinal" de transmissão nova
      const p = 0.5 + 0.5 * Math.sin(t * 1.6)
      for (let i = 0; i < pulseArr.length; i++) {
        pulseArr[i].emissiveIntensity = pulseBase[i] * (0.7 + 0.4 * p)
      }
      beaconLight.intensity = beaconBase * (0.55 + 0.6 * p)
    },
    dispose() {
      for (const d of disposables) d.dispose()
      for (const g of glbGeo) g.dispose()
      for (const m of Array.from(glbMat)) m.dispose()
    },
  }
}
