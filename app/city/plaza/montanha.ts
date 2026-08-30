// ═══════════════════════════════════════════════════════════════════════════
// A MONTANHA DE NEVE do Vale do Poente.
//
// ⚠️ SÃO DUAS COISAS SOBREPOSTAS E CADA UMA TEM UM TRABALHO. O monte esculpido em
// `terrain.ts` é o TERRENO: ele garante que a pista, o snowpark e a base fiquem
// na montanha e não flutuando no ar. O modelo aqui é a SUPERFÍCIE que se vê.
// O esculpido é de propósito mais baixo (360 m contra 438 do modelo): se passasse
// por cima, furaria o modelo e apareceria como um morro liso rasgando a crista.
//
// ⚠️ O MODELO É A ESTAÇÃO DE ESQUI REAL DE GUDAURI, na Geórgia, escaneada e
// publicada em CC-BY (crédito em sf-assets.ts). Decimada de 904.879 para 19.999
// triângulos pelo conversor da casa. Ela foi escolhida em vez de uma montanha
// genérica porque tem ravina, ombro e crista, que é o que faz terreno ESQUIÁVEL;
// o monte que eu havia esculpido era um cosseno, matematicamente correto e
// visualmente morto.
//
// ⚠️ E ELA É UMA CRISTA, NÃO UM CONE: 1.541 × 634 m em planta por 438 de altura.
// Por isso o monte esculpido encolheu de 1.400 para 700 m de raio, para caber
// debaixo dela. Escalar o modelo para cobrir os 2.800 m originais o levaria a
// 797 m de altura.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export interface MonteSpec {
  x: number; z: number; raio: number; altura: number
  modelo?: { file: string; escala?: number; giroY?: number }
}
export interface MontanhaOpts {
  monte: MonteSpec
  /** ⚠️ `superficieAt`, o chão que a câmera vê: é nele que a saia da montanha pousa */
  heightAt: (x: number, z: number) => number
  gltf?: GLTFLoader
  sombra?: boolean
}
export interface Montanha {
  group: THREE.Group
  triangulos: number
  dispose(): void
}

export async function buildMontanha(o: MontanhaOpts): Promise<Montanha | null> {
  const m = o.monte
  if (!m?.modelo?.file) return null
  const loader = o.gltf ?? new GLTFLoader()
  const gltf = await new Promise<{ scene: THREE.Object3D }>((ok, err) =>
    loader.load(`/city/sf/${m.modelo!.file}.glb`, ok as never, undefined, err))
  const raiz = gltf.scene
  const group = new THREE.Group()
  group.name = 'montanha'

  // ⚠️ O MODELO É ASSENTADO PELO PÉ, NÃO PELO CENTRO. `Box3` dá a caixa real
  // depois da conversão; usar a origem do arquivo enterraria ou levantaria a
  // montanha por um valor que ninguém consegue prever olhando o código.
  const cx = new THREE.Box3().setFromObject(raiz)
  const alt = cx.max.y - cx.min.y
  const esc = m.modelo.escala ?? 1
  raiz.scale.setScalar(esc)
  raiz.rotation.y = THREE.MathUtils.degToRad(m.modelo.giroY ?? 0)
  // centraliza em planta e pousa o pé no chão do vale
  const cen = cx.getCenter(new THREE.Vector3())
  // ⚠️ O PÉ VAI NO PÉ DO MONTE, NÃO NO CENTRO DELE. Amostrar `heightAt` no centro
  // devolve o CUME do monte esculpido (~620 m), e a montanha inteira subia para
  // cima dele: medido, base em y 592 e topo em 1.030, boiando sobre o próprio
  // morro. A cota certa é a do anel do pé, onde a saia encontra o vale.
  let yPe = 0
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2
    yPe += o.heightAt(m.x + Math.cos(a) * m.raio * 1.15, m.z + Math.sin(a) * m.raio * 1.15)
  }
  yPe /= 8
  raiz.position.set(
    m.x - cen.x * esc,
    yPe - cx.min.y * esc - 6,      // 6 m enterrado: a saia some no chão
    m.z - cen.z * esc,
  )

  let triangulos = 0
  raiz.traverse((k) => {
    const mesh = k as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = o.sombra ?? true
    mesh.receiveShadow = true
    const g = mesh.geometry
    triangulos += g.index ? g.index.count / 3 : g.attributes.position.count / 3
  })
  group.add(raiz)

  if (Math.abs(alt * esc - m.altura) > m.altura * 0.6) {
    // ⚠️ GRITA EM VEZ DE ACEITAR CALADO: modelo com altura muito diferente da
    // esculpida quer dizer que um dos dois vai furar o outro, e isso só apareceria
    // na chapa depois de alguém subir a montanha.
    console.warn(`[montanha] o modelo tem ${(alt * esc).toFixed(0)} m e o monte ` +
      `esculpido ${m.altura} m: um vai furar o outro`)
  }
  return {
    group, triangulos: Math.round(triangulos),
    dispose() {
      raiz.traverse((k) => {
        const mesh = k as THREE.Mesh
        if (mesh.isMesh) { mesh.geometry.dispose(); (mesh.material as THREE.Material)?.dispose?.() }
      })
      group.clear()
    },
  }
}
