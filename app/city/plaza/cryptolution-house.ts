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
// ⚠️ O TELÃO SAIU DAQUI EM 22/09/2026, E A CASA NUNCA CHEGOU A ENTRAR NA CENA.
// Este módulo estava completo e ninguém o chamava. O fundador decidiu separar as
// duas coisas — "colocar o telão passando o vídeo dele na praça principal e
// deixar a mansão dele separada" — e o telão virou peça própria da Satoshi
// Plaza, em `telao.ts`, a 248,7° no pente do deck. A casa continua aqui,
// dormente, e nasce SEM telão: o vão da fachada fica como o Blender o abriu.
//
// ⚠️ SE UM DIA A CASA ENTRAR COM TELÃO PRÓPRIO, é só passar `{ telao: true }`.
// O desenho do pôster é um só e mora em `telao.ts` (`makeScreenTexture`), para
// não existirem dois pôsteres divergindo com o tempo.
import * as THREE from 'three'
import { makeScreenTexture, type CryptolutionVideo } from './telao'

// A paleta agora vive no modelo do Blender (public/city/cryptolution-house.glb);
// aqui só resta o telão dinâmico, que desenha suas próprias cores no canvas.

/** ⚠️ O TIPO E O DESENHO DO PÔSTER MUDARAM-SE PARA `telao.ts` em 22/09/2026,
 *  quando o fundador separou o telão da casa. O apelido continua exportado para
 *  quem já importava daqui. */
export type CryptolutionHouseVideo = CryptolutionVideo

export interface CryptolutionHouse {
  group: THREE.Group
  /** o mesh do telão, quando a casa é construída com ele; `null` por padrão,
   *  desde que o telão virou peça da praça (ver `telao.ts`) */
  screen: THREE.Mesh | null
  /** o vídeo que está no telão agora */
  video: CryptolutionHouseVideo
  /** altura do topo da chaminé, pra quem quiser mirar a câmera */
  apexY: number
  update: (t: number) => void
  dispose: () => void
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
export function buildCryptolutionHouse(video: CryptolutionHouseVideo, shell: THREE.Object3D, opts?: { telao?: boolean }): CryptolutionHouse {
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

  // ── o telão dinâmico, SÓ SE PEDIDO ─────────────────────────────────────────
  // Posição LOCAL medida do modelo do Blender (build_house.py): o vão do telão
  // tem centro em (0, 42, 30.7) e a face olha para +Z — a frente que, com o group
  // sem rotação, aponta para a praça. Tamanho 96×54, igual ao que o Blender abriu.
  // Por padrão a casa nasce sem ele: o telão é peça da praça agora.
  let screen: THREE.Mesh | null = null
  if (opts?.telao) {
    const screenTex = track(makeScreenTexture(video))
    const SCREEN_W = 96, SCREEN_H = 54
    screen = new THREE.Mesh(
      track(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H)),
      track(new THREE.MeshBasicMaterial({ map: screenTex.texture, toneMapped: false })),
    )
    screen.position.set(0, 42, 30.7)
    screen.name = 'CryptolutionScreen'
    screen.userData.cryptolution = true // marca pro raycast do clique→vídeo
    group.add(screen)
  }

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
