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
  /** liga e desliga os marcos de esquina por distância; chame no laço */
  update(cam: THREE.Vector3): void
  /** covas de árvore que as peças com módulo próprio pediram, em mundo */
  covas: { x: number; z: number; r: number }[]
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
  // ⚠️ UMA MALHA POR SETOR, E NÃO UMA SÓ, PORQUE O FRUSTUM PRECISA DE UMA ESFERA
  // QUE SIRVA DE TESTE. Com os 52.984 lotes numa InstancedMesh única, a esfera
  // envolvente dela tem raio de 6.894 m e cobre a cidade inteira: ela intersecta
  // o frustum SEMPRE, olhando para onde for, e por isso o módulo vivia com
  // `frustumCulled = false`. Resultado medido em 29/08: 1,44 milhão de triângulos
  // desenhados em toda vista, inclusive nas que olham para o lado oposto.
  // Fatiado em 12 setores, cada esfera tem raio de cerca de 1.700 m e o
  // renderizador descarta as que estão fora do quadro. Custa 11 chamadas de
  // desenho a mais, que é o troco.
  const SET = meta.setores
  const porSetor: { m: number[]; c: number[] }[] = Array.from({ length: SET }, () => ({ m: [], c: [] }))
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
    // ⚠️ O PÉ DO LOTE É O PONTO MAIS ALTO DA TESTADA, NÃO O CENTRO. Uma caixa é
    // plana e o terreno não: assentando pelo centro, a metade de cima do lote
    // afunda no regolito. Medido em 29/08 com 4.000 sondas verticais: 8,1% das
    // amostras tinham chão por cima do lote, com o pior caso a 11,9 m, e os
    // piores são justamente os maiores (a superquadra tem 168 m de testada num
    // terreno que sobe). Tomando o MÁXIMO dos cinco pontos o lote nunca enterra;
    // no máximo sobra um degrau do lado de baixo, que é o que um embasamento faz
    // num terreno em declive de qualquer jeito.
    const meiaF = frente / 2, meiaP = prof / 2
    let base = o.heightAt(x, z)
    for (const [dx, dz] of [[-meiaF, -meiaP], [meiaF, -meiaP], [-meiaF, meiaP], [meiaF, meiaP]] as const) {
      const gx = THREE.MathUtils.degToRad(-setor * meta.giroPorSetor)
      const cgx = Math.cos(gx), sgx = Math.sin(gx)
      base = Math.max(base, o.heightAt(x + dx * cgx - dz * sgx, z + dx * sgx + dz * cgx))
    }
    pos.set(x, base, z)
    esc.set(Math.max(3, frente - RECUO * 2), alt, Math.max(3, prof - RECUO * 2))
    m4.compose(pos, q, esc)
    const sSet = Math.min(SET - 1, setor)
    porSetor[sSet].m.push(...m4.elements)

    if (pintura === 'idade') cor.set(CORES_COORTE[Math.min(7, coorte)])
    else if (pintura === 'forma') cor.set(CORES_FORMA[forma])
    else {
      cor.set(PEDRA[(i + forma) % PEDRA.length])
      // escurece de leve com o ruído: quatro tons chapados ainda leem como quatro
      const k = 0.88 + 0.16 * r01
      cor.setRGB(cor.r * k, cor.g * k, cor.b * k)
    }
    if (flags & 1) cor.set('#7FD4E0')      // o condomínio DSC continua marcado
    porSetor[sSet].c.push(cor.r, cor.g, cor.b)
  }

  // ── as 12 malhas, uma por setor, cada uma com a esfera dela ──────────────
  const lotes: THREE.InstancedMesh[] = []
  const tmp = new THREE.Matrix4()
  const cen = new THREE.Vector3()
  for (let sIdx = 0; sIdx < SET; sIdx++) {
    const b = porSetor[sIdx]
    const qtd = b.c.length / 3
    if (!qtd) continue
    const im = new THREE.InstancedMesh(geo, mat, qtd)
    im.name = `tecido:lote:S${String(sIdx + 1).padStart(2, '0')}`
    const cx: number[] = []
    for (let k = 0; k < qtd; k++) {
      tmp.fromArray(b.m, k * 16)
      im.setMatrixAt(k, tmp)
      im.setColorAt(k, cor.setRGB(b.c[k * 3], b.c[k * 3 + 1], b.c[k * 3 + 2]))
      cx.push(tmp.elements[12], tmp.elements[13], tmp.elements[14])
    }
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    // ⚠️ A ESFERA SAI DAS INSTÂNCIAS, NÃO DA GEOMETRIA. `computeBoundingSphere`
    // do three olha só a caixa de 1 m da geometria base e daria uma esfera
    // minúscula na origem: o setor inteiro sumiria da tela. A esfera correta é a
    // que envolve as POSIÇÕES das instâncias, com folga para a altura do volume.
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (let k = 0; k < qtd; k++) {
      minX = Math.min(minX, cx[k * 3]); maxX = Math.max(maxX, cx[k * 3])
      minZ = Math.min(minZ, cx[k * 3 + 2]); maxZ = Math.max(maxZ, cx[k * 3 + 2])
    }
    cen.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2)
    const raio = Math.hypot(maxX - minX, maxZ - minZ) / 2 + 90   // 90 m de folga
    im.boundingSphere = new THREE.Sphere(cen, raio)
    im.frustumCulled = true
    im.receiveShadow = true
    lotes.push(im)
  }
  const malha = lotes[0]
  // ⚠️ SOMBRA PRÓPRIA, e ela era a causa raiz do achatamento. Até agora os 52.991
  // volumes só RECEBIAM sombra e nunca lançavam: por isso o modelo de massa lia
  // como planta extrudada em vez de maquete.
  // ⚠️ E ELA NÃO É DE GRAÇA. A frente de cena mediu 1,0 ms na vista de plano, mas
  // na rasante, com muito mais lançador dentro da câmera de sombra, o quadro cai
  // de 51 para 24 fps. Fica ligada por padrão no modo massa, que é o registro de
  // CHAPA, e sai com ?sombra=0 para navegar.
  for (const im of lotes) im.castShadow = o.sombra ?? (modo === 'massa')
  for (const im of lotes) group.add(im)

  // ── os marcos de esquina ──────────────────────────────────────────────────
  // ⚠️ UM POR LOTE, e é ele que faz o chão parecer DEMARCADO em vez de pintado.
  // De longe some, de perto conta a história certa: terreno medido, com dono,
  // esperando construção. 52.991 instâncias de 12 triângulos, dentro do teto
  // medido de 300.000 e sem chamada de desenho nova relevante.
  const marcosSetores: { m: THREE.InstancedMesh; cx: number; cz: number; raio: number }[] = []
  let geoMarco: THREE.BufferGeometry | null = null
  let matMarco: THREE.Material | null = null
  if (modo === 'lote') {
    geoMarco = new THREE.BoxGeometry(0.5, 1.5, 0.5)
    geoMarco.translate(0, 0.75, 0)
    matMarco = new THREE.MeshStandardMaterial({ color: '#8A8375', roughness: 0.95 })
    // ⚠️ O MARCO PRECISA SUMIR DE LONGE, E ELE NÃO SUMIA. O comentário acima
    // sempre disse "de longe some": não sumia. Eram 52.984 instâncias de 12
    // triângulos numa malha só, com `frustumCulled = false` e `castShadow`
    // ligado, ou seja 636 mil triângulos desenhados em toda vista MAIS 636 mil na
    // passada de sombra, para postes de 1,5 m que a 1 km medem menos de um pixel.
    // Medido em 29/08: escondendo o grupo `tecido` o quadro caía de 26,6 para
    // 13,3 ms, que é a diferença entre 37 e 75 fps por causa do vsync.
    // Agora são 12 malhas, uma por setor, e cada uma some a 900 m do centro dela.
    const marcosPorSetor: number[][] = Array.from({ length: SET }, () => [])
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
      marcosPorSetor[Math.min(SET - 1, setor)].push(...mm.elements)
    }
    for (let sIdx = 0; sIdx < SET; sIdx++) {
      const arr = marcosPorSetor[sIdx]
      const qtd = arr.length / 16
      if (!qtd) continue
      const im = new THREE.InstancedMesh(geoMarco, matMarco, qtd)
      im.name = `tecido:marco:S${String(sIdx + 1).padStart(2, '0')}`
      let mnX = Infinity, mxX = -Infinity, mnZ = Infinity, mxZ = -Infinity
      for (let k = 0; k < qtd; k++) {
        mm.fromArray(arr, k * 16)
        im.setMatrixAt(k, mm)
        const px = mm.elements[12], pz = mm.elements[14]
        mnX = Math.min(mnX, px); mxX = Math.max(mxX, px)
        mnZ = Math.min(mnZ, pz); mxZ = Math.max(mxZ, pz)
      }
      im.instanceMatrix.needsUpdate = true
      im.frustumCulled = false
      // ⚠️ SOMBRA DESLIGADA NO MARCO. Um poste de 1,5 m projeta 2,4 m com o sol a
      // 32 graus, que na chapa de topo mede 0,4 px. Ele estava dobrando o custo
      // dele na passada de sombra para não desenhar nada.
      im.castShadow = false
      im.receiveShadow = true
      group.add(im)
      marcosSetores.push({ m: im, cx: (mnX + mxX) / 2, cz: (mnZ + mxZ) / 2, raio: Math.hypot(mxX - mnX, mxZ - mnZ) / 2 })
    }
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
  // ⚠️ 900 m É ONDE O MARCO PARA DE CONTAR HISTÓRIA. Ele tem 1,5 m: a essa
  // distância mede cerca de 2 px de altura, e o que ele diz (terreno demarcado,
  // com dono) já foi dito pela própria fileira de lotes.
  const R_MARCO = 900
  return {
    group,
    update(cam: THREE.Vector3) {
      for (const s2 of marcosSetores) {
        const on = Math.hypot(cam.x - s2.cx, cam.z - s2.cz) < R_MARCO + s2.raio
        if (s2.m.visible !== on) s2.m.visible = on
      }
    },
    covas: construidas.covas,
    lotes: n,
    pecas: pecas.length,
    triangulos,
    dispose() {
      geo.dispose(); mat.dispose()
      for (const im of lotes) im.dispose()
      geoMarco?.dispose(); matMarco?.dispose()
      construidas.dispose()
    },
  }
}
