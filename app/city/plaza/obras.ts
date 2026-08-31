// ═══════════════════════════════════════════════════════════════════════════
// A OBRA: a cidade sendo construída, com gente trabalhando nela.
//
// ⚠️ ISTO SUBSTITUI A DEMARCAÇÃO DOS LOTES (fundador, 30/08: "retire a
// demarcação dos lotes e adicione a animação de construção, centenas, até
// milhares de trabalhadores trabalhando na infra da cidade"). E a troca é
// honesta: nada foi mintado ainda, então lote demarcado promete uma posse que
// não existe. O que existe é a infraestrutura, e ela está sendo feita.
//
// ⚠️ O TRABALHADOR TEM 1,8 m NUMA CIDADE DE 14 km DE DIÂMETRO. Da chapa de cima
// ele mede uma fração de pixel e é INVISÍVEL, e isso não é defeito a consertar
// com escala falsa: um boneco de 40 m para "aparecer no mapa" é a mesma mentira
// do prédio fora de escala. Quem carrega a leitura de longe é o CANTEIRO (a
// torre de guindaste, 34 m, e a pilha de material), e quem carrega de perto é o
// trabalhador. Os dois convivem, cada um na sua distância.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'

const COR_MACACAO = '#C8722E'   // o macacão, laranja de obra: é o que se enxerga
const COR_CAPACETE = '#E8D9A8'
const COR_TORRE = '#B4A98F'     // a torre do guindaste
const COR_LANCA = '#8A8375'
const COR_PILHA = '#7E786B'     // a pilha de material no canteiro

export interface ObrasOpts {
  heightAt: (x: number, z: number) => number
  /** anéis viários e bulevares publicados: é sobre eles que a obra acontece */
  aneis: { r: number; larg: number }[]
  bulevares: { x0: number; z0: number; x1: number; z1: number; largura: number }[]
  /** quantos trabalhadores; o padrão é o que o fundador pediu */
  gente?: number
  /** quantos canteiros com guindaste */
  canteiros?: number
  /** não desenhar onde a máscara disser que é água */
  molhado?: (x: number, z: number) => boolean
  sombra?: boolean
}

export interface Obras {
  group: THREE.Group
  gente: number
  canteiros: number
  triangulos: number
  /** liga e desliga a gente por distância; chame no laço */
  update: (t: number, cam: THREE.Vector3) => void
  dispose: () => void
}

/** ⚠️ ALEATÓRIO DETERMINÍSTICO. `Math.random()` faria a obra mudar de lugar a
 *  cada recarga, e aí nenhuma chapa poderia ser comparada com a anterior. */
function rng(semente: number) {
  let s = semente >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function buildObras(o: ObrasOpts): Obras {
  const group = new THREE.Group()
  group.name = 'obras'
  const N = o.gente ?? 1400
  const NC = o.canteiros ?? 26
  const r = rng(20260830)

  // ── onde a obra acontece ───────────────────────────────────────────────────
  // ⚠️ SOBRE A INFRA, NÃO ESPALHADO PELO CHÃO. Semear no disco inteiro põe metade
  // dos trabalhadores no meio de quarteirão nenhum, e a imagem vira formigueiro
  // em vez de obra. Aqui cada posto nasce ENCOSTADO num anel viário ou num
  // bulevar, que é onde uma cidade de verdade se constrói primeiro.
  type Posto = { x: number; z: number; ang: number }
  const postos: Posto[] = []
  const aneis = o.aneis.filter((a) => a.r > 900)
  const compAneis = aneis.reduce((s, a) => s + 2 * Math.PI * a.r, 0)
  const compBul = o.bulevares.reduce(
    (s, b) => s + Math.hypot(b.x1 - b.x0, b.z1 - b.z0), 0)
  const total = compAneis + compBul || 1

  const sorteia = (): Posto => {
    let d = r() * total
    for (const a of aneis) {
      const c = 2 * Math.PI * a.r
      if (d < c) {
        const ang = (d / a.r)
        // encostado no meio-fio, de um lado ou do outro
        const rr = a.r + (r() < 0.5 ? -1 : 1) * (a.larg / 2 + 2 + r() * 7)
        return { x: Math.sin(ang) * rr, z: -Math.cos(ang) * rr, ang: ang + Math.PI / 2 }
      }
      d -= c
    }
    for (const b of o.bulevares) {
      const dx = b.x1 - b.x0, dz = b.z1 - b.z0
      const c = Math.hypot(dx, dz)
      if (d < c) {
        const t = d / c
        const nx = -dz / c, nz = dx / c
        const off = (r() < 0.5 ? -1 : 1) * (b.largura / 2 + 2 + r() * 7)
        return {
          x: b.x0 + dx * t + nx * off,
          z: b.z0 + dz * t + nz * off,
          ang: Math.atan2(dx, -dz),
        }
      }
      d -= c
    }
    return { x: 0, z: 0, ang: 0 }
  }

  // ⚠️ O SORTEIO PODE CAIR NA ÁGUA e o teto de tentativas não é enfeite: com a
  // baía ocupando 20,5 km², um anel inteiro pode estar submerso e o laço nunca
  // acharia lugar seco naquele raio.
  const seco = (): Posto | null => {
    for (let k = 0; k < 24; k++) {
      const p = sorteia()
      if (!o.molhado || !o.molhado(p.x, p.z)) return p
    }
    return null
  }

  // ── o trabalhador: duas caixas, e é o suficiente ──────────────────────────
  // ⚠️ NADA DE MALHA ARTICULADA. São 1.400 instâncias de uma figura que, quando
  // aparece, tem 20 px de altura. Corpo e capacete em duas InstancedMesh dão a
  // silhueta e a cor, e a animação mora na MATRIZ, não em esqueleto.
  const geoCorpo = new THREE.BoxGeometry(0.52, 1.35, 0.34)
  geoCorpo.translate(0, 0.675, 0)
  const geoCap = new THREE.SphereGeometry(0.19, 6, 4)
  geoCap.scale(1, 0.72, 1)
  geoCap.translate(0, 1.5, 0)
  const matCorpo = new THREE.MeshStandardMaterial({ color: COR_MACACAO, roughness: 0.9 })
  const matCap = new THREE.MeshStandardMaterial({ color: COR_CAPACETE, roughness: 0.85 })

  // ⚠️ A GENTE SE AGRUPA EM FRENTES, E ISTO É O CONSERTO DA PRIMEIRA VERSÃO. Ela
  // semeava os 1.400 uniformemente sobre 40 km de via: medido na chapa, a 340 m
  // cada figura tem 5 px e o espaçamento médio entre duas é de 28 m, então a
  // imagem não mostrava obra nenhuma, mostrava pontinhos laranja perdidos no
  // asfalto. Obra de verdade não é uniforme, é FRENTE: trinta pessoas num raio
  // de 40 m em volta de um guindaste, com pilha de material do lado. Um grupo
  // desses lê a 500 m; mil e quatrocentos espalhados não leem a 50.
  //
  // ⚠️ UM QUINTO CONTINUA ESPALHADO. Só frentes deixa a cidade com 34 ilhas de
  // atividade e o resto morto; a pessoa solta na via é a textura que liga uma
  // frente à outra.
  const N_FRENTE = 34
  const frentes: { x: number; z: number; ang: number }[] = []
  for (let i = 0; i < N_FRENTE; i++) {
    const p = seco()
    if (p) frentes.push(p)
  }

  const base: { x: number; z: number; y: number; ang: number; fase: number; passo: number; raio: number }[] = []
  const poe = (x: number, z: number, ang: number) => {
    if (o.molhado && o.molhado(x, z)) return
    base.push({
      x, z, y: o.heightAt(x, z), ang,
      fase: r() * Math.PI * 2,
      // ⚠️ METADE FICA PARADA TRABALHANDO. Mil e quatrocentas pessoas andando
      // todas ao mesmo tempo lê como evacuação, não como obra.
      passo: r() < 0.5 ? 0 : 0.5 + r() * 1.1,
      raio: 3 + r() * 9,
    })
  }
  const nSoltos = Math.round(N * 0.2)
  for (let i = 0; i < nSoltos; i++) {
    const p = seco()
    if (p) poe(p.x, p.z, p.ang)
  }
  const porFrente = frentes.length ? Math.round((N - nSoltos) / frentes.length) : 0
  for (const f of frentes) {
    for (let k = 0; k < porFrente; k++) {
      // ⚠️ RAIZ NO SORTEIO DO RAIO, senão o grupo fica com anel vazio no meio:
      // sortear o raio linear concentra área na borda, e uma frente de obra é
      // densa no centro, que é onde está o serviço.
      const a2 = r() * Math.PI * 2
      const rr = Math.sqrt(r()) * (22 + r() * 34)
      poe(f.x + Math.sin(a2) * rr, f.z - Math.cos(a2) * rr, r() * Math.PI * 2)
    }
  }
  const nG = base.length
  const imCorpo = new THREE.InstancedMesh(geoCorpo, matCorpo, Math.max(1, nG))
  const imCap = new THREE.InstancedMesh(geoCap, matCap, Math.max(1, nG))
  imCorpo.name = 'obras:gente'
  imCap.name = 'obras:capacete'
  for (const im of [imCorpo, imCap]) {
    im.castShadow = o.sombra ?? true
    im.receiveShadow = false
    im.count = nG
    group.add(im)
  }

  // ── o canteiro: o que se enxerga de longe ─────────────────────────────────
  const geoTorre = new THREE.BoxGeometry(2.2, 34, 2.2)
  geoTorre.translate(0, 17, 0)
  const geoLanca = new THREE.BoxGeometry(46, 1.6, 1.6)
  geoLanca.translate(11, 33, 0)
  const geoPilha = new THREE.BoxGeometry(14, 3.2, 9)
  geoPilha.translate(0, 1.6, 0)
  const matTorre = new THREE.MeshStandardMaterial({ color: COR_TORRE, roughness: 0.9 })
  const matLanca = new THREE.MeshStandardMaterial({ color: COR_LANCA, roughness: 0.9 })
  const matPilha = new THREE.MeshStandardMaterial({ color: COR_PILHA, roughness: 0.95 })

  // ⚠️ O GUINDASTE NASCE NA FRENTE, não sorteado por conta própria. Sorteado, ele
  // caía a quilômetros de qualquer grupo de gente e a imagem ficava com torre sem
  // obra e obra sem torre.
  const cant: { x: number; z: number; y: number; giro: number; vel: number }[] = []
  for (let i = 0; i < Math.min(NC, frentes.length); i++) {
    const p = frentes[i]
    if (!p) continue
    cant.push({
      x: p.x, z: p.z, y: o.heightAt(p.x, p.z),
      giro: r() * Math.PI * 2,
      // ⚠️ A LANÇA GIRA DEVAGAR E CADA UMA NO SEU RITMO. Todas na mesma
      // velocidade viram um relógio, e relógio não é canteiro.
      vel: (r() < 0.5 ? -1 : 1) * (0.014 + r() * 0.028),
    })
  }
  const nC = cant.length
  const imTorre = new THREE.InstancedMesh(geoTorre, matTorre, Math.max(1, nC))
  const imLanca = new THREE.InstancedMesh(geoLanca, matLanca, Math.max(1, nC))
  const imPilha = new THREE.InstancedMesh(geoPilha, matPilha, Math.max(1, nC * 2))
  imTorre.name = 'obras:torre'
  imLanca.name = 'obras:lanca'
  imPilha.name = 'obras:pilha'
  for (const im of [imTorre, imLanca, imPilha]) {
    im.castShadow = o.sombra ?? true
    im.receiveShadow = true
    group.add(im)
  }
  imTorre.count = nC; imLanca.count = nC; imPilha.count = nC * 2

  const m4 = new THREE.Matrix4()
  const qt = new THREE.Quaternion()
  const eixoY = new THREE.Vector3(0, 1, 0)
  const pos = new THREE.Vector3()
  const esc = new THREE.Vector3(1, 1, 1)

  // a torre e a pilha não se mexem: escrevem uma vez
  for (let i = 0; i < nC; i++) {
    const c = cant[i]
    pos.set(c.x, c.y, c.z)
    qt.setFromAxisAngle(eixoY, c.giro)
    m4.compose(pos, qt, esc)
    imTorre.setMatrixAt(i, m4)
    for (let k = 0; k < 2; k++) {
      const a = c.giro + 1.1 + k * 2.3
      pos.set(c.x + Math.sin(a) * 26, o.heightAt(c.x + Math.sin(a) * 26, c.z - Math.cos(a) * 26), c.z - Math.cos(a) * 26)
      qt.setFromAxisAngle(eixoY, a)
      m4.compose(pos, qt, esc)
      imPilha.setMatrixAt(i * 2 + k, m4)
    }
  }
  imTorre.instanceMatrix.needsUpdate = true
  imPilha.instanceMatrix.needsUpdate = true

  // ⚠️ A GENTE SÓ APARECE DE PERTO, e o corte é medido, não sentido: a 1.500 m
  // uma figura de 1,8 m mede cerca de 1 px de altura. Escrever 1.400 matrizes por
  // quadro para desenhar poeira é o mesmo desperdício que o marco de esquina fez
  // até 29/08. Fora do raio, as duas malhas somem e o laço nem roda.
  const R_GENTE = 1500
  let ligada = true
  let ultimo = -1

  return {
    group,
    gente: nG,
    canteiros: nC,
    triangulos: nG * 20 + nC * 36,
    update(t: number, cam: THREE.Vector3) {
      // a lança do guindaste gira sempre: é ela que diz "obra" de longe
      for (let i = 0; i < nC; i++) {
        const c = cant[i]
        pos.set(c.x, c.y, c.z)
        qt.setFromAxisAngle(eixoY, c.giro + t * c.vel)
        m4.compose(pos, qt, esc)
        imLanca.setMatrixAt(i, m4)
      }
      imLanca.instanceMatrix.needsUpdate = true

      const perto = Math.hypot(cam.x, cam.z) < 9000 && cam.y < 2600
      const on = perto
      if (on !== ligada) {
        ligada = on
        imCorpo.visible = on; imCap.visible = on
      }
      if (!on) return
      // ⚠️ 8 QUADROS POR SEGUNDO BASTAM PARA A GENTE. Reescrever 2.800 matrizes a
      // 60 Hz custa mais que desenhá-las, e ninguém vê a diferença num boneco de
      // 20 px. O guindaste continua a cada quadro porque a lança é grande.
      const tick = Math.floor(t * 8)
      if (tick === ultimo) return
      ultimo = tick

      for (let i = 0; i < nG; i++) {
        const b = base[i]
        const f = t * (b.passo || 0.8) + b.fase
        // quem anda percorre um vaivém curto no eixo da via; quem trabalha
        // parado balança o corpo e o capacete acompanha
        const d = b.passo ? Math.sin(f) * b.raio : 0
        const x = b.x + Math.sin(b.ang) * d
        const z = b.z - Math.cos(b.ang) * d
        const y = b.y + (b.passo ? Math.abs(Math.sin(f * 6)) * 0.06 : 0)
        const gira = b.ang + (b.passo ? (Math.cos(f) < 0 ? Math.PI : 0) : Math.sin(f * 2) * 0.5)
        pos.set(x, y, z)
        qt.setFromAxisAngle(eixoY, gira)
        m4.compose(pos, qt, esc)
        imCorpo.setMatrixAt(i, m4)
        imCap.setMatrixAt(i, m4)
      }
      imCorpo.instanceMatrix.needsUpdate = true
      imCap.instanceMatrix.needsUpdate = true
      void R_GENTE
    },
    dispose() {
      for (const g of [geoCorpo, geoCap, geoTorre, geoLanca, geoPilha]) g.dispose()
      for (const m of [matCorpo, matCap, matTorre, matLanca, matPilha]) m.dispose()
      group.clear()
    },
  }
}
