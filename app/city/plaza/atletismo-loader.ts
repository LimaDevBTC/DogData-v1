import * as THREE from 'three'
import type { PerfProfile } from './perf'
import { assentarAtletismo, atletismoCull } from './atletismo'

export const ATLETISMO_BASE_URL = '/city/dog-athletics-base.glb'
export const ATLETISMO_DETAIL_URL = '/city/dog-athletics-detail.glb'
export const ATLETISMO_DETAIL_IN = 1100
export const ATLETISMO_DETAIL_OUT = 1400

type Estado = 'pending' | 'loading' | 'ready' | 'error' | 'disabled'
export interface Atletismo {
  group: THREE.Group
  update(camera: THREE.Vector3, cidadeAberta: boolean, agoraMs?: number): void
  dispose(): void
}

interface Opcoes {
  profile: Pick<PerfProfile, 'tier' | 'quality'>
  alturaEm(x: number, z: number): number
  carregar(url: string): Promise<THREE.Object3D>
  /** Usa o ambiente e o aquecimento de shader da cena anfitriã. */
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
 * Estádio em duas transferências independentes. O primeiro pedido só nasce
 * DEPOIS de abrir a cidade: não participa de BOOT_STEPS/Promise.all do boot.
 * O celular nunca pede nem decodifica o arquivo de detalhes do desktop.
 * Ambos os GLBs usam materiais constantes, sem imagens, sem luzes adicionais.
 */
export function criarAtletismo(o: Opcoes): Atletismo {
  const group = new THREE.Group()
  assentarAtletismo(group, o.alturaEm)
  group.name = 'DOG_ATHLETICS'
  group.visible = false
  const permiteDetalhe = o.profile.tier === 'desktop' && o.profile.quality !== 'low' && !o.economizarDados
  const estado: { base: Estado; detalhe: Estado } = {
    base: 'pending', detalhe: permiteDetalhe ? 'pending' : 'disabled',
  }
  // Instrumento pequeno para conferir rede, fases e perfil no navegador.
  group.userData.atletismo = estado
  let disposed = false
  let detalhe: THREE.Object3D | null = null
  let pertoDesde: number | null = null
  let proximaSonda = 0
  let ultimoD2 = Infinity
  const alcance2 = atletismoCull(o.profile.tier) ** 2

  async function carregar(fase: 'base' | 'detalhe') {
    estado[fase] = 'loading'
    let root: THREE.Object3D | null = null
    try {
      root = await o.carregar(fase === 'base' ? ATLETISMO_BASE_URL : ATLETISMO_DETAIL_URL)
      if (disposed) { descartar(root); return }
      root.name = fase === 'base' ? 'ATHLETICS_BASE' : 'ATHLETICS_DETAIL'
      root.traverse((n) => {
        const mesh = n as THREE.Mesh
        if (!mesh.isMesh) return
        mesh.castShadow = o.profile.tier === 'desktop'
        const materiais = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        // A membrana fina mantém a sombra que projeta sobre as arquibancadas,
        // mas não recebe a própria sombra: o mapa global da cidade produz
        // acne (pontos pretos) na face clara. Não muda o bias das outras peças.
        mesh.receiveShadow = !materiais.some((m) => m.name === 'ATH_CANOPY')
      })
      // O grupo ainda está fora da cena: o primeiro render só ocorre depois
      // de preparar os materiais/compilar. A geometria já vem pronta do GLB.
      await o.preparar(root)
      if (disposed) { descartar(root); return }
      if (fase === 'detalhe') {
        detalhe = root
        root.visible = ultimoD2 < ATLETISMO_DETAIL_OUT ** 2
      }
      group.add(root)
      estado[fase] = 'ready'
      console.log(`[atletismo] ${fase} pronta (${o.profile.tier})`)
    } catch (err) {
      if (root) descartar(root)
      if (disposed) return
      estado[fase] = 'error'
      // Falha isolada, sem bloquear entrada e sem repetir pedido por quadro.
      console.error(`[atletismo] falha ao carregar ${fase}`, err)
    }
  }

  return {
    group,
    update(camera, cidadeAberta, agoraMs = performance.now()) {
      if (disposed) return
      if (!cidadeAberta) { group.visible = false; pertoDesde = null; return }
      if (estado.base === 'pending') void carregar('base')
      // Cinco sondas por segundo, sem alocação por quadro. A câmera pode voar
      // pelo mapa, por isso a distância inclui altura, não só a planta.
      if (agoraMs < proximaSonda) return
      proximaSonda = agoraMs + 200
      ultimoD2 = camera.distanceToSquared(group.position)
      group.visible = estado.base === 'ready' && ultimoD2 < alcance2
      if (detalhe) {
        if (ultimoD2 > ATLETISMO_DETAIL_OUT ** 2) detalhe.visible = false
        else if (ultimoD2 < ATLETISMO_DETAIL_IN ** 2) detalhe.visible = true
      }
      if (estado.detalhe !== 'pending' || estado.base !== 'ready') return
      if (ultimoD2 >= ATLETISMO_DETAIL_IN ** 2) { pertoDesde = null; return }
      if (pertoDesde === null) pertoDesde = agoraMs
      // Passar voando pelo estádio não dispara download de detalhe.
      if (agoraMs - pertoDesde >= 600) void carregar('detalhe')
    },
    dispose() {
      if (disposed) return
      disposed = true
      descartar(group)
      group.clear()
      detalhe = null
      // Promessas que ainda estiverem em voo descartam seu próprio resultado.
    },
  }
}
