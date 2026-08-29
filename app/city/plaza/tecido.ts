// ═══════════════════════════════════════════════════════════════════════════
// O TECIDO: o loteamento inteiro sobre o terreno real.
//
// ⚠️ DOIS REGISTROS, E CONFUNDIR OS DOIS FOI ERRO MEU. A primeira versão pintava
// cada lote com a cor da coorte e deixava tudo chapado na altura de um plinto:
// isso é CHAPA DE DIAGNÓSTICO, boa para achar lote em máscara e costura torta, e
// péssima como imagem, porque uma cidade pintada de heatmap parece planilha
// extrudada. O fundador viu e disse o que era: amador.
//
//   'massa'       (padrão)  modelo de massa de arquiteto: volume claro, sem
//                           fachada, altura pela tipologia, rua legível, sombra
//                           lateral de sol baixo. É o registro certo para um
//                           plano ANTES de projetar prédio.
//   'demarcacao'            plinto raso, para conferência de geometria.
//
// ⚠️ NADA AQUI É PROJETO DE PRÉDIO. Massa não é fachada: são caixas sem detalhe,
// que é exatamente como se apresenta plano urbano antes de existir arquitetura.
//
// Lê public/city/cidade-lotes.bin (11 bytes por lote) e public/city/cidade.json.
// A ordem dos registros é a mesma de data/dogcity_lotes.csv, onde mora o dono.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { buildPecas, type Peca } from './pecas'

export interface TecidoOpts {
  heightAt: (x: number, z: number) => number
  modo?: 'massa' | 'demarcacao'
  /** 'pedra' é a paleta de maquete; 'idade' e 'forma' são lentes de diagnóstico */
  pintura?: 'pedra' | 'idade' | 'forma'
}

export interface Tecido {
  group: THREE.Group
  lotes: number
  pecas: number
  triangulos: number
  dispose(): void
}

// ⚠️ A PALETA PADRÃO NÃO É DE DADO, É DE MAQUETE. Quatro tons de concreto claro
// sobre regolito: a variação por lote é o que impede a cidade de virar um bloco
// só, e a ausência de cor forte é o que a faz parecer cidade e não gráfico.
const PEDRA = ['#D8D2C6', '#C9C2B4', '#BBB3A4', '#E2DCD1']
const CORES_COORTE = ['#FFE9C4', '#FFC97A', '#F7931A', '#E8660D', '#C24A12', '#8E3A1B', '#5C2D1E', '#3A2320']
const CORES_FORMA = ['#8B8B93', '#C9A227', '#3FA7D6', '#E8660D', '#E5484D']

// altura de massa por tipologia do utxo_count, em metros. Não é projeto: é a
// silhueta que a regra 4 do fundador já determina (1 UTXO é massa única, 10+ é
// torre), posta em volume para o plano ter relevo.
const ALTURA = [7, 11, 17, 30, 52]

interface Meta {
  setores: number; giroPorSetor: number; bulevar_m: number
  raioInicio: number; raioSitio: number; raioBorda: number
  plantadas: number; programa: Peca[]
}

/** ruído determinístico por lote: a cidade é a mesma em toda visita */
function hash01(i: number): number {
  let t = (i + 0x9e3779b9) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export async function buildTecido(o: TecidoOpts): Promise<Tecido> {
  const [meta, buf] = await Promise.all([
    fetch('/city/cidade.json').then((r) => r.json() as Promise<Meta>),
    fetch('/city/cidade-lotes.bin').then((r) => r.arrayBuffer()),
  ])
  const dv = new DataView(buf)
  const REG = 11
  const n = Math.floor(buf.byteLength / REG)
  const group = new THREE.Group()
  group.name = 'tecido'
  const modo = o.modo ?? 'massa'
  const pintura = o.pintura ?? 'pedra'

  // ⚠️ O RECUO É O QUE FAZ A RUA EXISTIR. Sem ele os lotes se encostam, o
  // quarteirão vira uma mancha só e a cidade perde a coisa mais básica que ela
  // tem, que é o desenho da rua entre as coisas. 1,4 m de cada lado.
  const RECUO = 1.4

  const geo = new THREE.BoxGeometry(1, 1, 1)
  geo.translate(0, 0.5, 0)          // pivô no pé: a massa cresce do chão para cima
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0.0 })
  const malha = new THREE.InstancedMesh(geo, mat, n)
  const m4 = new THREE.Matrix4()
  const cor = new THREE.Color()
  const q = new THREE.Quaternion()
  const eixoY = new THREE.Vector3(0, 1, 0)
  const pos = new THREE.Vector3()
  const esc = new THREE.Vector3()

  for (let i = 0; i < n; i++) {
    const off = i * REG
    const x = dv.getInt16(off, true), z = dv.getInt16(off + 2, true)
    const setor = dv.getUint8(off + 4), coorte = dv.getUint8(off + 5)
    const flags = dv.getUint8(off + 8)
    const frente = dv.getUint8(off + 9), prof = dv.getUint8(off + 10)
    const forma = Math.min(4, (flags >> 1) & 7)
    const r01 = hash01(i)

    let alt: number
    if (modo === 'demarcacao') {
      alt = 1.6
    } else {
      // altura pela tipologia, modulada pela área e por um ruído fixo, para o
      // quarteirão ter perfil em vez de virar um degrau só
      const areaRel = Math.min(3, (frente * prof) / 300)
      alt = ALTURA[forma] * (0.72 + 0.5 * areaRel * 0.35 + 0.4 * r01)
    }

    q.setFromAxisAngle(eixoY, -THREE.MathUtils.degToRad(setor * meta.giroPorSetor))
    pos.set(x, o.heightAt(x, z), z)
    esc.set(Math.max(3, frente - RECUO * 2), alt, Math.max(3, prof - RECUO * 2))
    m4.compose(pos, q, esc)
    malha.setMatrixAt(i, m4)

    if (pintura === 'idade') cor.set(CORES_COORTE[Math.min(7, coorte)])
    else if (pintura === 'forma') cor.set(CORES_FORMA[forma])
    else {
      cor.set(PEDRA[(i + forma) % PEDRA.length])
      // escurece de leve com o ruído: quatro tons chapados ainda leem como quatro
      const k = 0.88 + 0.16 * r01
      cor.setRGB(cor.r * k, cor.g * k, cor.b * k)
    }
    if (flags & 1) cor.set('#7FD4E0')      // o condomínio DSC continua marcado
    malha.setColorAt(i, cor)
  }
  malha.instanceMatrix.needsUpdate = true
  if (malha.instanceColor) malha.instanceColor.needsUpdate = true
  malha.frustumCulled = false
  malha.receiveShadow = true
  group.add(malha)

  // ── os bulevares de costura ───────────────────────────────────────────────
  // Faixa de piso mais clara que o regolito, com meio-fio escuro dos dois lados:
  // sem o meio-fio a via some no chão e a cidade fica sem estrutura visível.
  const faixa = (meia: number, alturaOff: number, cor2: string) => {
    const vs: number[] = []; const ix: number[] = []
    const r0 = meta.raioInicio, r1 = meta.raioBorda
    const passos = 48
    for (let s = 0; s < meta.setores; s++) {
      const ang = (s * (360 / meta.setores) * Math.PI) / 180
      const dirX = Math.sin(ang), dirZ = -Math.cos(ang)
      const perpX = Math.cos(ang), perpZ = Math.sin(ang)
      const base = vs.length / 3
      for (let k = 0; k <= passos; k++) {
        const r = r0 + (k * (r1 - r0)) / passos
        for (const lado of [-1, 1]) {
          const px = dirX * r + perpX * meia * lado
          const pz = dirZ * r + perpZ * meia * lado
          vs.push(px, o.heightAt(px, pz) + alturaOff, pz)
        }
      }
      for (let k = 0; k < passos; k++) {
        const a = base + k * 2
        ix.push(a, a + 1, a + 3, a, a + 3, a + 2)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3))
    g.setIndex(ix)
    g.computeVertexNormals()
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: cor2, roughness: 1 }))
    m.receiveShadow = true
    m.frustumCulled = false
    group.add(m)
    return { g, m }
  }
  const meioFio = faixa(meta.bulevar_m / 2 + 1.6, 0.30, '#4A443C')
  const pista = faixa(meta.bulevar_m / 2, 0.45, '#8A8377')

  // ── as peças demarcadas ───────────────────────────────────────────────────
  // ⚠️ CADA TIPO TEM DESENHO PRÓPRIO, e isso deixou de ser detalhe: enquanto
  // eram elipses coloridas, estádio, lago e alfândega tinham a mesma forma e a
  // cidade parecia um mapa com adesivos. O desenho de cada uma mora em
  // app/city/plaza/pecas.ts. Continua sendo massa, sem fachada.
  const pecas = (meta.programa ?? []) as Peca[]
  const construidas = buildPecas(pecas, o.heightAt)
  group.add(construidas.group)

  const triangulos = n * 12 + 12 * 48 * 4 + construidas.triangulos
  return {
    group,
    lotes: n,
    pecas: pecas.length,
    triangulos,
    dispose() {
      geo.dispose(); mat.dispose()
      meioFio.g.dispose(); (meioFio.m.material as THREE.Material).dispose()
      pista.g.dispose(); (pista.m.material as THREE.Material).dispose()
      construidas.dispose()
    },
  }
}
