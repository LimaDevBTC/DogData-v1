import * as THREE from 'three'
import type { PerfProfile } from './perf'
import { assentarDerby, derbyCull } from './derby'

export const DERBY_BASE_URL = '/city/dog-derby-base.glb'
export const DERBY_DETAIL_URL = '/city/dog-derby-detail.glb'
export const DERBY_DETAIL_IN = 1200
export const DERBY_DETAIL_OUT = 1500

type Estado = 'pending' | 'loading' | 'ready' | 'error' | 'disabled'
export interface Derby {
  group: THREE.Group
  update(camera: THREE.Vector3, cidadeAberta: boolean, agoraMs?: number): void
  dispose(): void
}

interface Opcoes {
  profile: Pick<PerfProfile, 'tier' | 'quality'>
  alturaEm(x: number, z: number): number
  carregar(url: string): Promise<THREE.Object3D>
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

/**
 * O canódromo em duas transferências independentes, no mesmo contrato do DOG
 * Athletics: o primeiro pedido nasce DEPOIS de a cidade abrir e não entra no
 * boot; o celular nunca pede nem decodifica o arquivo de detalhe; os dois GLBs
 * são materiais constantes, sem imagem e sem luz nova.
 *
 * ⚠️ A MARQUISE NÃO RECEBE O MAPA DE SOMBRA, só projeta. Ela é uma lâmina de
 * 0,9 m com 30 m de balanço: o mapa global da cidade produz acne (pontos
 * pretos) numa superfície clara tão rasa, que é o mesmo motivo pelo qual a
 * membrana do atletismo está de fora.
 */
export function criarDerby(o: Opcoes): Derby {
  const group = new THREE.Group()
  assentarDerby(group, o.alturaEm)
  group.name = 'DOG_DERBY'
  group.visible = false
  const permiteDetalhe = o.profile.tier === 'desktop' && o.profile.quality !== 'low' && !o.economizarDados
  const estado: { base: Estado; detalhe: Estado } = {
    base: 'pending', detalhe: permiteDetalhe ? 'pending' : 'disabled',
  }
  group.userData.derby = estado
  let disposed = false
  let detalhe: THREE.Object3D | null = null
  let pertoDesde: number | null = null
  let proximaSonda = 0
  let ultimoD2 = Infinity
  const alcance2 = derbyCull(o.profile.tier) ** 2

  async function carregar(fase: 'base' | 'detalhe') {
    estado[fase] = 'loading'
    let root: THREE.Object3D | null = null
    try {
      root = await o.carregar(fase === 'base' ? DERBY_BASE_URL : DERBY_DETAIL_URL)
      if (disposed) { descartar(root); return }
      root.name = fase === 'base' ? 'DERBY_BASE' : 'DERBY_DETAIL'
      root.traverse((n) => {
        const mesh = n as THREE.Mesh
        if (!mesh.isMesh) return
        mesh.castShadow = o.profile.tier === 'desktop'
        const materiais = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        mesh.receiveShadow = !materiais.some((m) => m.name === 'DER_CANOPY')
      })
      await o.preparar(root)
      if (disposed) { descartar(root); return }
      if (fase === 'detalhe') {
        detalhe = root
        root.visible = ultimoD2 < DERBY_DETAIL_OUT ** 2
      }
      group.add(root)
      estado[fase] = 'ready'
      console.log(`[derby] ${fase} pronta (${o.profile.tier})`)
    } catch (err) {
      if (root) descartar(root)
      if (disposed) return
      estado[fase] = 'error'
      console.error(`[derby] falha ao carregar ${fase}`, err)
    }
  }

  return {
    group,
    update(camera, cidadeAberta, agoraMs = performance.now()) {
      if (disposed) return
      if (!cidadeAberta) { group.visible = false; pertoDesde = null; return }
      if (estado.base === 'pending') void carregar('base')
      if (agoraMs < proximaSonda) return
      proximaSonda = agoraMs + 200
      ultimoD2 = camera.distanceToSquared(group.position)
      group.visible = estado.base === 'ready' && ultimoD2 < alcance2
      if (detalhe) {
        if (ultimoD2 > DERBY_DETAIL_OUT ** 2) detalhe.visible = false
        else if (ultimoD2 < DERBY_DETAIL_IN ** 2) detalhe.visible = true
      }
      if (estado.detalhe !== 'pending' || estado.base !== 'ready') return
      if (ultimoD2 >= DERBY_DETAIL_IN ** 2) { pertoDesde = null; return }
      if (pertoDesde === null) pertoDesde = agoraMs
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
