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
  /** 'lote' (padrão) é a cidade ANTES do mint: terreno demarcado e nenhum prédio.
   *  'massa' é a prévia de como ela fica cheia. */
  modo?: 'lote' | 'massa'
  /** sombra própria nos 52.991 volumes: transforma a imagem e custa fps */
  sombra?: boolean
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
// ⚠️ CLAY É CINZA MÉDIO, NÃO BRANCO. O valor canônico do clay render é 0,65
// linear, cerca de #CCCCCC. A primeira paleta estava em L 0,70 a 0,87: clara
// demais, estourava no sol e matava o meio-tom. Medido na chapa: 50,4% da cidade
// acima de L 0,72 e só 13,4% de meio-tom, ou seja uma imagem de dois valores.
const PEDRA = ['#B9B3A8', '#ADA79B', '#A19B90', '#C4BEB3']
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
  const modo = o.modo ?? 'lote'
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
    if (modo === 'lote') {
      // ⚠️ O TERRENO NÃO É PRÉDIO. 0,45 m é o suficiente para a borda do lote
      // lançar uma linha de sombra com sol a 16 graus e o parcelamento ficar
      // legível; mais que isso e o loteamento vira maquete de cidade cheia,
      // que é exatamente o que o fundador não quer antes do mint.
      alt = 0.45
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
  // ⚠️ SOMBRA PRÓPRIA, e ela era a causa raiz do achatamento. Até agora os 52.991
  // volumes só RECEBIAM sombra e nunca lançavam: por isso o modelo de massa lia
  // como planta extrudada em vez de maquete.
  // ⚠️ E ELA NÃO É DE GRAÇA. A frente de cena mediu 1,0 ms na vista de plano, mas
  // na rasante, com muito mais lançador dentro da câmera de sombra, o quadro cai
  // de 51 para 24 fps. Fica ligada por padrão no modo massa, que é o registro de
  // CHAPA, e sai com ?sombra=0 para navegar.
  malha.castShadow = o.sombra ?? (modo === 'massa')
  group.add(malha)

  // ── os marcos de esquina ──────────────────────────────────────────────────
  // ⚠️ UM POR LOTE, e é ele que faz o chão parecer DEMARCADO em vez de pintado.
  // De longe some, de perto conta a história certa: terreno medido, com dono,
  // esperando construção. 52.991 instâncias de 12 triângulos, dentro do teto
  // medido de 300.000 e sem chamada de desenho nova relevante.
  let marcos: THREE.InstancedMesh | null = null
  let geoMarco: THREE.BufferGeometry | null = null
  let matMarco: THREE.Material | null = null
  if (modo === 'lote') {
    geoMarco = new THREE.BoxGeometry(0.5, 1.5, 0.5)
    geoMarco.translate(0, 0.75, 0)
    matMarco = new THREE.MeshStandardMaterial({ color: '#8A8375', roughness: 0.95 })
    marcos = new THREE.InstancedMesh(geoMarco, matMarco, n)
    const mm = new THREE.Matrix4()
    const pm = new THREE.Vector3()
    const qm = new THREE.Quaternion()
    const em = new THREE.Vector3(1, 1, 1)
    for (let i = 0; i < n; i++) {
      const off = i * REG
      const x = dv.getInt16(off, true), z = dv.getInt16(off + 2, true)
      const setor = dv.getUint8(off + 4)
      const frente = dv.getUint8(off + 9), prof = dv.getUint8(off + 10)
      const ang = -THREE.MathUtils.degToRad(setor * meta.giroPorSetor)
      const cx = Math.cos(ang), sx = Math.sin(ang)
      // esquina da frente, no canto esquerdo de quem olha da rua
      const lx = -frente / 2 + 0.6, lz = -prof / 2 + 0.6
      const wx = x + lx * cx - lz * sx
      const wz = z + lx * sx + lz * cx
      qm.setFromAxisAngle(eixoY, ang)
      pm.set(wx, o.heightAt(wx, wz), wz)
      mm.compose(pm, qm, em)
      marcos.setMatrixAt(i, mm)
    }
    marcos.instanceMatrix.needsUpdate = true
    marcos.frustumCulled = false
    marcos.castShadow = o.sombra ?? true
    marcos.receiveShadow = true
    group.add(marcos)
  }

  // ── os bulevares de costura MUDARAM DE ARQUIVO ────────────────────────────
  // ⚠️ NÃO REDESENHE BULEVAR AQUI. Eles moram em app/city/plaza/vias.ts desde
  // 29/08/2026, junto com a via de contorno e as travessas, porque rua é uma
  // coisa só e tinha de ter um dono só. A versão que vivia aqui desenhava a
  // pista em +0,45 e o meio-fio em +0,30, ou seja a seção de cabeça para baixo:
  // a via virava um planalto claro com moldura escura em vez de uma calha. Se os
  // dois módulos desenharem, as faixas coplanares brigam no z-buffer.

  // ── as peças demarcadas ───────────────────────────────────────────────────
  // ⚠️ CADA TIPO TEM DESENHO PRÓPRIO, e isso deixou de ser detalhe: enquanto
  // eram elipses coloridas, estádio, lago e alfândega tinham a mesma forma e a
  // cidade parecia um mapa com adesivos. O desenho de cada uma mora em
  // app/city/plaza/pecas.ts. Continua sendo massa, sem fachada.
  const pecas = (meta.programa ?? []) as Peca[]
  const construidas = buildPecas(pecas, o.heightAt)
  group.add(construidas.group)

  const triangulos = n * 12 + construidas.triangulos
  return {
    group,
    lotes: n,
    pecas: pecas.length,
    triangulos,
    dispose() {
      geo.dispose(); mat.dispose()
      geoMarco?.dispose(); matMarco?.dispose()
      construidas.dispose()
    },
  }
}
