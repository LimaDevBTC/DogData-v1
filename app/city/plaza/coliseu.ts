// ═══════════════════════════════════════════════════════════════════════════
// O COLISEU DA BATALHA DE PREÇO.
//
// ⚠️ NÃO É COLISEU, É HIPÓDROMO, e a proporção decide isso sozinha. O campo que
// o motor desenha tem 458 por 240 m (CAMPO_X 88 e os limites de raia de
// app/city/war/battlefield.ts, vezes a escala 2,6 da cena), proporção 1,91, e a
// pegada da Cratera da Batalha no plano diretor é 760 por 364, proporção 2,09.
// Para comparar: Coliseu de Roma 1,21, Maracanã 1,14, Circo Máximo 5,26.
// Anfiteatro redondo desperdiça as duas pontas, porque as tropas se enfrentam
// em LINHA. A tipologia certa é a do circo romano.
//
// E isso é bom de projeto, não só de arqueologia: hipódromo é uma linha de meio
// quilômetro, e linha é exatamente o que quebra a forma radial da cidade.
//
// ⚠️ O TERRENO ALI É PLANO. Medido no heightmap: 33 a 60 m ao longo de 1,3 km em
// volta de WAR_POS, sem depressão nenhuma. A cratera é nome no plano, não
// relevo. Então a arquibancada É a cova: ela cria a bacia que o nome promete.
//
// A orientação vem do motor e não se escolhe: a batalha está girada 5π/4, com o
// eixo longo apontando para a praça, e a câmera de chegada que o fundador
// enquadrou à mão cai em (265, 20) no quadro do campo, ou seja bem na cabeceira
// nordeste. A tribuna nasce lá porque o enquadramento já estava lá.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'

export interface ColiseuOpts {
  /** centro da cratera em mundo (WAR_POS) */
  centro: THREE.Vector3
  /** a cota do chão da batalha: o mesmo DATUM que o motor usa */
  datum: number
  /** giro do campo, em radianos (o motor usa 5π/4) */
  rotY: number
  /** o chão, para a saia da base pousar no relevo */
  heightAt: (x: number, z: number) => number
  /** meio-eixos da arena livre, em metros; o campo pede 229 por 120 */
  arenaA?: number
  arenaB?: number
  /** degraus da arquibancada */
  degraus?: number
  /** altura e profundidade de cada degrau */
  espelho?: number
  piso?: number
}

export interface Coliseu {
  group: THREE.Group
  /** área da elipse externa, em m², para conferir contra o orçamento de terra */
  areaM2: number
  /** lugares estimados pela área de degrau a 0,5 m² por pessoa */
  lugares: number
  triangulos: number
  dispose(): void
}

const COR_BANCADA = new THREE.Color('#33333A')
const COR_TOPO = new THREE.Color('#5A5A66')
const COR_DOG = new THREE.Color('#E8660D')

/** as duas bocas do hipódromo, em fração de volta, medidas do eixo longo */
const BOCA = 0.052

export function buildColiseu(o: ColiseuOpts): Coliseu {
  const A = o.arenaA ?? 250
  const B = o.arenaB ?? 140
  const N = o.degraus ?? 24
  const esp = o.espelho ?? 2.0
  const piso = o.piso ?? 3.0

  const group = new THREE.Group()
  group.name = 'coliseu'
  group.position.set(o.centro.x, o.datum, o.centro.z)
  group.rotation.y = o.rotY

  // ── o perfil da bancada, em (avanço, altura) ──────────────────────────────
  // Escada: pisa para fora, sobe o espelho, pisa de novo. O primeiro ponto é o
  // pé da arquibancada, na borda da arena.
  const perfil: [number, number][] = [[0, 0]]
  for (let k = 0; k < N; k++) {
    perfil.push([k * piso + piso, k * esp])          // a pisada
    perfil.push([k * piso + piso, k * esp + esp])    // o espelho
  }
  const avancoMax = perfil[perfil.length - 1][0]
  const alturaMax = perfil[perfil.length - 1][1]

  // ── varre o perfil em volta da elipse ─────────────────────────────────────
  // A elipse deslocada ((A+d)·cos t, (B+d)·sin t) não é a curva paralela exata,
  // e não precisa ser: a diferença no eixo curto é de centímetros por degrau e
  // ninguém mede degrau de estádio com paquímetro.
  const SEG = 220
  const pos: number[] = []
  const cor: number[] = []
  const idx: number[] = []
  const aberto = (t: number) => {
    // as duas bocas ficam nas pontas do eixo longo, que é por onde as tropas
    // entram: cão de um lado, urso do outro
    const f = (t / (Math.PI * 2)) % 1
    return Math.min(f, 1 - f) < BOCA || Math.abs(f - 0.5) < BOCA
  }

  const cBase = new THREE.Color()
  let anterior: number[] | null = null
  for (let i = 0; i <= SEG; i++) {
    const t = (i / SEG) * Math.PI * 2
    if (aberto(t)) { anterior = null; continue }
    const ct = Math.cos(t), st = Math.sin(t)
    const coluna: number[] = []
    for (const [d, y] of perfil) {
      coluna.push(pos.length / 3)
      pos.push((A + d) * ct, y, (B + d) * st)
      // a cor sobe com o degrau: a bancada escurece no fundo e clareia no topo,
      // que é o que dá leitura de arquibancada sem textura nenhuma
      const k = y / Math.max(1, alturaMax)
      cBase.copy(COR_BANCADA).lerp(COR_TOPO, k * k)
      // rajada por degrau para não virar rampa lisa
      const ruido = 0.9 + 0.2 * (((i * 7 + Math.round(y)) % 5) / 5)
      cor.push(cBase.r * ruido, cBase.g * ruido, cBase.b * ruido)
    }
    if (anterior) {
      for (let k = 0; k < coluna.length - 1; k++) {
        idx.push(anterior[k], coluna[k], coluna[k + 1])
        idx.push(anterior[k], coluna[k + 1], anterior[k + 1])
      }
    }
    anterior = coluna
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  // ⚠️ flatShading LIGADO. Sem ele o computeVertexNormals faz a média entre a
  // pisada e o espelho, a escada vira rampa lisa e a arquibancada some: de
  // longe lê como prato, não como estádio.
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.92, metalness: 0.04, side: THREE.DoubleSide,
    flatShading: true,
  })
  const bancada = new THREE.Mesh(geo, mat)
  // sem castShadow: a 48 m de altura e 640 m de vão a sombra vira uma mancha
  // preta chapada do tamanho do estádio, e a cena da guerra já tem luz própria
  bancada.receiveShadow = true
  group.add(bancada)

  // ── a parede externa ──────────────────────────────────────────────────────
  // ⚠️ SEM ELA O ESTÁDIO FLUTUA. A varredura do perfil desenha só a superfície
  // de assento; por fora fica o avesso da malha aberto e a peça lê como prato
  // pousado no chão. A parede desce do topo da última fileira até o relevo.
  const pPos: number[] = []
  const pIdx: number[] = []
  const cr0 = Math.cos(o.rotY), sr0 = Math.sin(o.rotY)
  const chaoLocal = (lx: number, lz: number) =>
    o.heightAt(o.centro.x + lx * cr0 + lz * sr0, o.centro.z - lx * sr0 + lz * cr0) - o.datum
  for (let i = 0; i <= SEG; i++) {
    const t = (i / SEG) * Math.PI * 2
    const lx = (A + avancoMax) * Math.cos(t)
    const lz = (B + avancoMax) * Math.sin(t)
    pPos.push(lx, alturaMax + esp, lz)
    pPos.push(lx, Math.min(0, chaoLocal(lx, lz)) - 10, lz)
  }
  for (let i = 0; i < SEG; i++) {
    const b = i * 2
    pIdx.push(b, b + 1, b + 3, b, b + 3, b + 2)
  }
  const geoParede = new THREE.BufferGeometry()
  geoParede.setAttribute('position', new THREE.Float32BufferAttribute(pPos, 3))
  geoParede.setIndex(pIdx)
  geoParede.computeVertexNormals()
  const matParede = new THREE.MeshStandardMaterial({ color: '#2C2C33', roughness: 0.95, side: THREE.DoubleSide })
  const parede = new THREE.Mesh(geoParede, matParede)
  parede.receiveShadow = true
  group.add(parede)

  // ── a saia do pé ──────────────────────────────────────────────────────────
  // O relevo sob a arena varia uns 5 m e o pé da bancada é uma linha só na cota
  // do datum: sem a saia aparece fresta de luz por baixo em meia volta.
  const sPos: number[] = []
  const sIdx: number[] = []
  for (let i = 0; i <= SEG; i++) {
    const t = (i / SEG) * Math.PI * 2
    const ct = Math.cos(t), st = Math.sin(t)
    const lx = A * ct, lz = B * st
    // do quadro do coliseu para o mundo, para perguntar a altura do chão
    const cr = Math.cos(o.rotY), sr = Math.sin(o.rotY)
    const wx = o.centro.x + lx * cr + lz * sr
    const wz = o.centro.z - lx * sr + lz * cr
    sPos.push(lx, 0.2, lz)
    sPos.push(lx, Math.min(0, o.heightAt(wx, wz) - o.datum) - 14, lz)
  }
  for (let i = 0; i < SEG; i++) {
    const b = i * 2
    sIdx.push(b, b + 1, b + 3, b, b + 3, b + 2)
  }
  const geoSaia = new THREE.BufferGeometry()
  geoSaia.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3))
  geoSaia.setIndex(sIdx)
  geoSaia.computeVertexNormals()
  const matSaia = new THREE.MeshStandardMaterial({ color: '#25252B', roughness: 1, side: THREE.DoubleSide })
  const saia = new THREE.Mesh(geoSaia, matSaia)
  saia.receiveShadow = true
  group.add(saia)

  // ── o coroamento: uma linha laranja no topo da última fileira ─────────────
  // O laranja do DOG é o único acento, e ele fica no alto porque é a silhueta
  // que a câmera de chegada recorta contra o vidro da abóbada.
  const coroa: THREE.Vector3[] = []
  for (let i = 0; i <= SEG; i++) {
    const t = (i / SEG) * Math.PI * 2
    if (aberto(t)) continue
    coroa.push(new THREE.Vector3((A + avancoMax) * Math.cos(t), alturaMax + 1.2, (B + avancoMax) * Math.sin(t)))
  }
  const geoCoroa = new THREE.BufferGeometry().setFromPoints(coroa)
  const matCoroa = new THREE.LineBasicMaterial({ color: COR_DOG, transparent: true, opacity: 0.85 })
  group.add(new THREE.Line(geoCoroa, matCoroa))   // Line, não LineSegments: LineSegments liga os pontos aos pares e sai tracejado

  const aOut = A + avancoMax, bOut = B + avancoMax
  const areaM2 = Math.PI * aOut * bOut
  // área de pisada útil: coroa elíptica entre a arena e a borda, a 0,5 m²/pessoa
  const lugares = Math.round(((Math.PI * aOut * bOut - Math.PI * A * B) * (1 - 2 * BOCA * 2)) / 0.5)

  return {
    group,
    areaM2,
    lugares,
    triangulos: idx.length / 3 + sIdx.length / 3,
    dispose() {
      geo.dispose(); mat.dispose()
      geoSaia.dispose(); matSaia.dispose()
      geoParede.dispose(); matParede.dispose()
      geoCoroa.dispose(); matCoroa.dispose()
    },
  }
}
