// Os ADEREÇOS da praça: modelos de fora (public/city/sf/*.glb) colocados por
// TABELA, não por código. Acrescentar uma peça é acrescentar uma linha em
// `props-table.ts`; este módulo carrega uma vez, instancia quando a peça se
// repete, assenta no terreno, e registra tudo no culling por distância.
//
// Regras que valem para todo adereço (praca-jardins.md):
//   · licença CC0/CC-BY, com o crédito em `sf-assets.ts` (o menu Places mostra);
//   · o modelo já vem em metros, com a origem no chão (o conversor cuida);
//   · nada é decorativo por decorar: cada linha da tabela diz o porquê.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { loadSf, dressSf, firstGeometry } from './sf-assets'
import type { PerfProfile, DistanceCuller } from './perf'

/** Uma peça posta na praça. `at` são pontos (x, z) em metros no quadro three. */
export interface PropSpec {
  /** nome do arquivo em public/city/sf/, sem .glb */
  file: string
  /** por que está aqui (aparece só no código, mas é a regra da praça) */
  why: string
  at: [number, number][]
  /** giro em torno de y, em graus; 'center' = de frente para o centro da praça */
  yaw?: number | 'center' | 'out'
  scale?: number
  /** variação de escala por peça (± fração), semeada pela posição */
  jitter?: number
  /** metros acima do terreno (para peça que deve afundar ou flutuar) */
  lift?: number
  /** a partir de quantos metros some; padrão: o `smallCull` do perfil */
  cull?: number
  castShadow?: boolean
  envMapIntensity?: number
}

export interface Props {
  group: THREE.Group
  dispose: () => void
}

const hash = (x: number, z: number) => {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
}

export async function buildProps(opts: {
  specs: readonly PropSpec[]
  heightAt: (x: number, z: number) => number
  gltf?: GLTFLoader
  profile?: PerfProfile
  culler?: DistanceCuller
}): Promise<Props> {
  const group = new THREE.Group()
  group.name = 'Props'
  const disposables: { dispose: () => void }[] = []
  const gltf = opts.gltf ?? new GLTFLoader()
  const yAt = opts.heightAt
  const SMALL = opts.profile?.smallCull ?? 2600

  await Promise.all(opts.specs.map(async (spec) => {
    if (!spec.at.length) return
    const root = await loadSf(gltf, `/city/sf/${spec.file}.glb`)
    if (!root) return
    dressSf(root, { envMapIntensity: spec.envMapIntensity ?? 1.0, castShadow: spec.castShadow ?? true })
    const o = new THREE.Object3D()
    const place = (x: number, z: number) => {
      const h = hash(x, z)
      const s = (spec.scale ?? 1) * (1 + (spec.jitter ?? 0) * (h - 0.5) * 2)
      const yaw = spec.yaw === 'center' ? Math.atan2(-x, -z) : spec.yaw === 'out' ? Math.atan2(x, z) : THREE.MathUtils.degToRad(spec.yaw ?? 0) + (spec.jitter ? h * 6.28 : 0)
      o.position.set(x, yAt(x, z) + (spec.lift ?? 0), z)
      o.rotation.set(0, yaw, 0)
      o.scale.setScalar(s)
      o.updateMatrix()
      return o.matrix.clone()
    }
    const single = firstGeometry(root)
    if (spec.at.length > 1 && single) {
      // repetido: uma chamada de desenho para todas as cópias
      const im = new THREE.InstancedMesh(single.geo, single.mat, spec.at.length)
      disposables.push(single.geo)
      spec.at.forEach(([x, z], i) => im.setMatrixAt(i, place(x, z)))
      im.instanceMatrix.needsUpdate = true
      im.castShadow = spec.castShadow ?? true
      im.receiveShadow = true
      im.name = `prop:${spec.file}`
      group.add(im)
      opts.culler?.add(im, spec.cull ?? SMALL)
    } else {
      spec.at.forEach(([x, z], i) => {
        const g = i === 0 ? root : root.clone(true)
        const m = place(x, z)
        m.decompose(g.position, g.quaternion, g.scale)
        g.name = `prop:${spec.file}`
        group.add(g)
        opts.culler?.add(g, spec.cull ?? SMALL, new THREE.Vector3(x, 0, z))
      })
    }
  }))

  return {
    group,
    dispose() {
      for (const d of disposables) d.dispose()
      group.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh) { m.geometry?.dispose(); const mm = m.material as THREE.Material; mm?.dispose?.() }
      })
    },
  }
}
