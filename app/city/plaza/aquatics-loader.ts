// ═══════════════════════════════════════════════════════════════════════════
// A CARGA DE DOG AQUATICS: duas transferências independentes, como o atletismo.
//
// A base traz a peça inteira e basta sozinha; o detalhe é ADITIVO e só existe
// no desktop, perto, fora de economia de dados. O primeiro pedido só nasce
// depois de a cidade abrir: nada disto participa do boot.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import type { PerfProfile } from './perf'
import { assentarAquatics, aquaticsCull } from './aquatics'

export const AQUATICS_BASE_URL = '/city/dog-aquatics-base.glb'
export const AQUATICS_DETAIL_URL = '/city/dog-aquatics-detail.glb'
export const AQUATICS_DETAIL_IN = 1100
export const AQUATICS_DETAIL_OUT = 1400

type Estado = 'pending' | 'loading' | 'ready' | 'error' | 'disabled'
export interface Aquatics {
  group: THREE.Group
  update(camera: THREE.Vector3, cidadeAberta: boolean, agoraMs?: number): void
  dispose(): void
}

interface Opcoes {
  profile: Pick<PerfProfile, 'tier' | 'quality'>
  alturaEm(x: number, z: number): number
  carregar(url: string): Promise<THREE.Object3D>
  /** usa o ambiente e o aquecimento de shader da cena anfitriã */
  preparar(root: THREE.Object3D): Promise<void>
  economizarDados?: boolean
}

function descartar(root: THREE.Object3D) {
  const geometrias = new Set<THREE.BufferGeometry>()
  const materiais = new Set<THREE.Material>()
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    geometrias.add(mesh.geometry)
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materiais.add(m)
  })
  geometrias.forEach((g) => g.dispose())
  materiais.forEach((m) => m.dispose())
  root.removeFromParent()
}

export function criarAquatics(o: Opcoes): Aquatics {
  const group = new THREE.Group()
  assentarAquatics(group, o.alturaEm)
  group.visible = false
  const permiteDetalhe = o.profile.tier === 'desktop' && o.profile.quality !== 'low' && !o.economizarDados
  const estado: { base: Estado; detalhe: Estado } = {
    base: 'pending', detalhe: permiteDetalhe ? 'pending' : 'disabled',
  }
  group.userData.aquatics = estado
  let disposed = false
  let detalhe: THREE.Object3D | null = null
  let pertoDesde: number | null = null
  let proximaSonda = 0
  let ultimoD2 = Infinity
  const alcance2 = aquaticsCull(o.profile.tier) ** 2

  async function carregar(fase: 'base' | 'detalhe') {
    estado[fase] = 'loading'
    let root: THREE.Object3D | null = null
    try {
      root = await o.carregar(fase === 'base' ? AQUATICS_BASE_URL : AQUATICS_DETAIL_URL)
      if (disposed) { descartar(root); return }
      root.name = fase === 'base' ? 'AQUATICS_BASE' : 'AQUATICS_DETAIL'
      root.traverse((n) => {
        const mesh = n as THREE.Mesh
        if (!mesh.isMesh) return
        mesh.castShadow = o.profile.tier === 'desktop'
        const materiais = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        // ⚠️ A CASCA PROJETA SOMBRA MAS NÃO RECEBE, pela mesma razão que a
        // membrana do atletismo: o mapa de sombras global produz acne (pontos
        // pretos) numa superfície clara e curva, e a casca desta peça é as duas
        // coisas. O bias das outras peças não muda.
        mesh.receiveShadow = !materiais.some((m) => m.name === 'AQU_CANOPY')
      })
      await o.preparar(root)
      if (disposed) { descartar(root); return }
      if (fase === 'detalhe') {
        detalhe = root
        root.visible = ultimoD2 < AQUATICS_DETAIL_OUT ** 2
      }
      group.add(root)
      estado[fase] = 'ready'
      console.log(`[aquatics] ${fase} pronta (${o.profile.tier})`)
    } catch (err) {
      if (root) descartar(root)
      if (disposed) return
      estado[fase] = 'error'
      console.error(`[aquatics] falha ao carregar ${fase}`, err)
    }
  }

  return {
    group,
    update(camera, cidadeAberta, agoraMs = performance.now()) {
      if (disposed) return
      if (!cidadeAberta) { group.visible = false; pertoDesde = null; return }
      if (agoraMs < proximaSonda) return
      proximaSonda = agoraMs + 200
      ultimoD2 = camera.distanceToSquared(group.position)
      // ⚠️ A BASE SÓ BAIXA DENTRO DO ALCANCE, E ANTES BAIXAVA SEMPRE. O pedido
      // saía no primeiro quadro com a cidade aberta, sem olhar distância: quem
      // entra na praça central e nunca cruza a avenida de 90° pagava 55 KB por
      // uma peça que o `cull` esconde. A margem de 20% no raio (44% em distância
      // ao quadrado) existe para a carga terminar ANTES de a peça entrar no
      // alcance, senão o conserto viraria pop-in, que é pior que o desperdício.
      if (estado.base === 'pending' && ultimoD2 < alcance2 * 1.44) void carregar('base')
      group.visible = estado.base === 'ready' && ultimoD2 < alcance2
      if (detalhe) {
        if (ultimoD2 > AQUATICS_DETAIL_OUT ** 2) detalhe.visible = false
        else if (ultimoD2 < AQUATICS_DETAIL_IN ** 2) detalhe.visible = true
      }
      if (estado.detalhe !== 'pending' || estado.base !== 'ready') return
      if (ultimoD2 >= AQUATICS_DETAIL_IN ** 2) { pertoDesde = null; return }
      if (pertoDesde === null) pertoDesde = agoraMs
      // passar voando pela peça não dispara download de detalhe
      if (agoraMs - pertoDesde >= 600) void carregar('detalhe')
    },
    dispose() {
      if (disposed) return
      disposed = true
      descartar(group)
      group.clear()
      detalhe = null
    },
  }
}
