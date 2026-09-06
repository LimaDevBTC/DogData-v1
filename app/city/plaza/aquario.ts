// ═══════════════════════════════════════════════════════════════════════════
// O AQUÁRIO: o Lago da Praça é um aquário marinho, e a parte submersa dele é de
// vidro para o visitante ver o fundo do mar. Na Lua.
//
// Decisão do fundador em 29/08/2026. Ela troca a natureza da peça: o lago deixa
// de ser paisagem e vira ATRAÇÃO, que é a coisa que a cidade mais precisa ter
// antes do mint, porque até o mint não existe prédio nenhum para entrar.
//
// ⚠️ O VIDRO NÃO É CARVADO NO TERRENO, É CONSTRUÍDO DENTRO DA ÁGUA. A bacia tem
// talude de 70 m nas duas margens (terrain.ts), e talude é rampa: não há como
// encostar uma parede vertical de vidro nela sem antes recortar um penhasco, o
// que estragaria a praia que dá o desenho do lago. Então a galeria é um objeto
// que fica EM PÉ no fundo, encostado na margem interna, com o teto na cota da
// praça e o vidro virado para fora. É assim que aquário público de verdade é
// feito: o visitante desce, e não a água sobe.
//
// DUAS PEÇAS DE VIDRO:
//   GALERIA   anel submerso na margem interna, teto na cota 0, vidro para fora
//   TÚNEL     tubo atravessando o fundo no rumo 45, entre duas pontes, ligando
//             a praça à cidade por baixo da água
//
// ⚠️ O VIDRO É BARATO DE PROPÓSITO. MeshPhysicalMaterial com `transmission` faz
// o renderizador desenhar a cena de novo por objeto transparente, e esta cena já
// tem 2 milhões de triângulos. Aqui o vidro é MeshStandardMaterial transparente
// com `depthWrite: false` e `renderOrder` alto: custa uma passada, deixa o peixe
// e o coral aparecerem atrás, e a 200 m de distância ninguém distingue os dois.
//
// A VIDA MARINHA vem de Sketchfab, CC0 e CC-BY, com crédito em sf-assets.ts, e é
// instanciada por props.ts como qualquer outro adereço da praça. Cardume não é um
// modelo de cardume: são peixes instanciados em nuvem, porque assim a densidade e
// a altura na coluna d'água são minhas e não do autor do modelo.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import type { PropSpec } from './props'
import { contornoIlha } from './lago'

export interface AquarioOpts {
  heightAt: (x: number, z: number) => number
  lago: { r0: number; r1: number; agua: number; fundo: number }
  /** as ilhas do lago, para a floresta e para o recife não nascer dentro delas */
  ilhas: { x: number; z: number; r: number }[]
  sombra?: boolean
}

export interface Aquario {
  group: THREE.Group
  /**
   * ⚠️ A ÚNICA EXCEÇÃO À GUARDA DE CHÃO DA CÂMERA. O laço nunca deixa a câmera
   * entrar no regolito (1,7 m = olhos de pé), e é isso que impede o usuário de
   * cair para dentro do planeta. Mas a galeria e o túnel são espaços FECHADOS
   * abaixo da lâmina: dentro deles a câmera tem de poder estar submersa, senão o
   * aquário não pode ser visitado, que é a razão de ele existir.
   */
  dentro(p: THREE.Vector3): boolean
  /** adereços a somar aos PROPS da cena: recife, peixe e floresta das ilhas */
  specs: PropSpec[]
  recife: number
  peixes: number
  floresta: number
  triangulos: number
  dispose(): void
}

const COR_VIDRO = '#8FB8C9'
const COR_ESTRUTURA = '#8F8879'
const COR_AREIA = '#8E856F'

/** ruído determinístico: o recife é o mesmo em toda visita */
function hash01(i: number): number {
  let t = (i + 0x9e3779b9) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function buildAquario(o: AquarioOpts): Aquario {
  const group = new THREE.Group()
  group.name = 'aquario'
  const L = o.lago
  const rMeio = (L.r0 + L.r1) / 2

  // ── 1. a galeria de vidro na margem interna ──────────────────────────────
  // Um anel de 22 m de largura em pé no fundo, com o teto na cota 0 (o piso da
  // praça) e o vidro na face de fora. Quem está na praça desce por uma rampa e
  // anda dentro dela com a água inteira do lado.
  // ⚠️ A GALERIA FICA DEPOIS DA QUEBRA DA RAMPA, e isso foi medido: em r 1.078 o
  // talude ainda está em -20,4 e o piso da galeria em -25,4, ou seja ela nasceria
  // ENTERRADA. Encostada em L.r0 ela pega o fundo cheio e o vidro dela abre
  // exatamente na linha d'água.
  const R_GAL_I = L.r0 - 12, R_GAL_E = L.r0 + 10
  const Y_TETO = 0.0, Y_PISO = L.fundo + 0.6
  const vs: number[] = [], ix: number[] = []
  const vidro: number[] = [], ixv: number[] = []
  const quad = (V: number[], I: number[], A: number[], B: number[], C: number[], D: number[]) => {
    const i = V.length / 3
    V.push(...A, ...B, ...C, ...D)
    I.push(i, i + 1, i + 2, i, i + 2, i + 3)
  }
  const P = (r: number, a: number, y: number) => [Math.sin(a) * r, y, -Math.cos(a) * r]
  {
    const seg = 200
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2
      // o vidro: a face externa inteira, do piso ao teto
      quad(vidro, ixv, P(R_GAL_E, a0, Y_PISO), P(R_GAL_E, a1, Y_PISO),
                       P(R_GAL_E, a1, Y_TETO), P(R_GAL_E, a0, Y_TETO))
      // piso, teto e a parede de trás, que são estrutura e não vidro
      quad(vs, ix, P(R_GAL_I, a0, Y_PISO), P(R_GAL_I, a1, Y_PISO),
                   P(R_GAL_E, a1, Y_PISO), P(R_GAL_E, a0, Y_PISO))
      quad(vs, ix, P(R_GAL_I, a0, Y_TETO), P(R_GAL_E, a0, Y_TETO),
                   P(R_GAL_E, a1, Y_TETO), P(R_GAL_I, a1, Y_TETO))
      quad(vs, ix, P(R_GAL_I, a0, Y_PISO), P(R_GAL_I, a0, Y_TETO),
                   P(R_GAL_I, a1, Y_TETO), P(R_GAL_I, a1, Y_PISO))
    }
    // as costelas: uma a cada 9 graus, senão o vidro vira uma lâmina sem escala
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2, w = 0.006
      quad(vs, ix, P(R_GAL_E + 0.4, a - w, Y_PISO), P(R_GAL_E + 0.4, a + w, Y_PISO),
                   P(R_GAL_E + 0.4, a + w, Y_TETO), P(R_GAL_E + 0.4, a - w, Y_TETO))
    }
  }

  // ── 2. o túnel de vidro no fundo, rumo 45 ────────────────────────────────
  // ⚠️ O RUMO 45 NÃO É ENFEITE: as quatro pontes estão em 0, 90, 180 e 270, e o
  // túnel tem de cair ENTRE elas, senão quem anda por baixo passa na sombra da
  // ponte e não vê nada. Ele atravessa o lago inteiro e emerge dos dois lados.
  const ANG_TUN = (45 * Math.PI) / 180
  const dx = Math.sin(ANG_TUN), dz = -Math.cos(ANG_TUN)
  const px = Math.cos(ANG_TUN), pz = Math.sin(ANG_TUN)
  {
    const rI = L.r0 - 50, rE = L.r1 + 50
    const n = 60, RAIO = 5.5, LADOS = 10
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n
      const r0 = rI + (rE - rI) * t0, r1 = rI + (rE - rI) * t1
      const y0 = L.fundo + 1.2 + RAIO, y1 = L.fundo + 1.2 + RAIO
      for (let f = 0; f < LADOS; f++) {
        const b0 = (f / LADOS) * Math.PI * 2, b1 = ((f + 1) / LADOS) * Math.PI * 2
        const pt = (r: number, y: number, b: number) => [
          dx * r + px * Math.cos(b) * RAIO,
          y + Math.sin(b) * RAIO,
          dz * r + pz * Math.cos(b) * RAIO,
        ]
        quad(vidro, ixv, pt(r0, y0, b0), pt(r1, y1, b0), pt(r1, y1, b1), pt(r0, y0, b1))
      }
    }
    // os aros de estrutura do túnel, um a cada 6 trechos
    for (let k = 0; k <= n; k += 6) {
      const r = rI + (rE - rI) * (k / n)
      for (let f = 0; f < LADOS; f++) {
        const b0 = (f / LADOS) * Math.PI * 2, b1 = ((f + 1) / LADOS) * Math.PI * 2
        const pt = (rr: number, b: number) => [
          dx * rr + px * Math.cos(b) * (RAIO + 0.35),
          L.fundo + 1.2 + RAIO + Math.sin(b) * (RAIO + 0.35),
          dz * rr + pz * Math.cos(b) * (RAIO + 0.35),
        ]
        quad(vs, ix, pt(r - 0.7, b0), pt(r + 0.7, b0), pt(r + 0.7, b1), pt(r - 0.7, b1))
      }
    }
  }

  // ── 3. o fundo de areia, que é o que faz o recife ter chão ───────────────
  {
    const seg = 160
    const areia: number[] = [], ixa: number[] = []
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2
      const p = (r: number, a: number) => {
        const x = Math.sin(a) * r, z = -Math.cos(a) * r
        return [x, o.heightAt(x, z) + 0.25, z]
      }
      // ⚠️ SUBDIVIDE NO RADIAL, E ESTE FOI O ERRO QUE TAPOU O LAGO INTEIRO. A
      // primeira versão fazia UM quad de r 1.050 a r 1.430: nas duas pontas o
      // chão está em 0 (fora da bacia) e no meio em −26, então o quad plano virou
      // uma TAMPA a −1,9 m sobre a água de −17. A sonda vertical achava
      // `aquario:areia @ −1,9` acima de `lago:agua @ −17,0`, e a chapa mostrava
      // um deserto claro onde devia haver lago. 18 m é o mesmo vão da via, da
      // peça e da praia.
      const rIn = L.r0 - 40, rOut = L.r1 + 40
      const nr = Math.max(1, Math.ceil((rOut - rIn) / 18))
      for (let j = 0; j < nr; j++) {
        const ra = rIn + ((rOut - rIn) * j) / nr, rb = rIn + ((rOut - rIn) * (j + 1)) / nr
        quad(areia, ixa, p(ra, a0), p(ra, a1), p(rb, a1), p(rb, a0))
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(areia, 3))
    g.setIndex(ixa)
    g.computeVertexNormals()
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: COR_AREIA, roughness: 1 }))
    m.name = 'aquario:areia'
    m.receiveShadow = true
    m.frustumCulled = false
    group.add(m)
  }

  // ── 4. as duas malhas: estrutura e vidro ─────────────────────────────────
  const feitas: THREE.Mesh[] = []
  const fazer = (V: number[], I: number[], nome: string, mat: THREE.Material) => {
    if (!I.length) return
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(V, 3))
    g.setIndex(I)
    g.computeVertexNormals()
    const m = new THREE.Mesh(g, mat)
    m.name = nome
    m.frustumCulled = false
    group.add(m)
    feitas.push(m)
  }
  const matEstrutura = new THREE.MeshStandardMaterial({
    color: COR_ESTRUTURA, roughness: 0.7, metalness: 0.1, side: THREE.DoubleSide,
  })
  // ⚠️ depthWrite FALSE E renderOrder ALTO: sem os dois o vidro escreve
  // profundidade e apaga o peixe e o coral que estão atrás dele, que é
  // exatamente o que se quer ver através dele.
  const matVidro = new THREE.MeshStandardMaterial({
    color: COR_VIDRO, roughness: 0.05, metalness: 0.1,
    transparent: true, opacity: 0.17, depthWrite: false, side: THREE.DoubleSide,
  })
  fazer(vs, ix, 'aquario:estrutura', matEstrutura)
  fazer(vidro, ixv, 'aquario:vidro', matVidro)
  const malhaVidro = feitas[feitas.length - 1]
  if (malhaVidro) malhaVidro.renderOrder = 12
  matEstrutura.side = THREE.DoubleSide

  // ── 5. o recife e os peixes, como adereço instanciado ────────────────────
  // ⚠️ NADA NASCE DENTRO DE ILHA NEM DEBAIXO DE PONTE. A ilha tem terra até a
  // cota da praia e a ponte tem pilar: coral crescendo lá dentro apareceria
  // atravessando geometria sólida.
  const dentroDeIlha = (x: number, z: number) =>
    o.ilhas.some((i) => Math.hypot(x - i.x, z - i.z) < i.r + 14)
  const sobPonte = (x: number, z: number) => {
    for (const rumo of [0, 90, 180, 270]) {
      const a = (rumo * Math.PI) / 180
      const proj = x * Math.sin(a) - z * Math.cos(a)
      if (proj <= 0) continue
      if (Math.abs(x * Math.cos(a) + z * Math.sin(a)) < 22) return true
    }
    return false
  }
  const pontos = (n: number, semente: number, rIn: number, rOut: number): [number, number][] => {
    const out: [number, number][] = []
    for (let k = 0; k < n * 3 && out.length < n; k++) {
      const a = hash01(semente + k * 2) * Math.PI * 2
      const r = rIn + hash01(semente + k * 2 + 1) * (rOut - rIn)
      const x = Math.sin(a) * r, z = -Math.cos(a) * r
      if (dentroDeIlha(x, z) || sobPonte(x, z)) continue
      out.push([x, z])
    }
    return out
  }

  const R_REC_I = L.r0 - 30, R_REC_E = L.r1 + 30
  const recifePontos = {
    coralSet: pontos(260, 11, R_REC_I, R_REC_E),
    coralPeca: pontos(150, 77, R_REC_I, R_REC_E),
    // ⚠️ A CONTAGEM COMPENSA O QUE A DECIMAÇÃO NÃO CONSEGUIU. O conversor tem
    // piso (razão mínima 0,02): o Stylaster parou em 2.000 triângulos e a alga em
    // 4.828, contra os 900 do coral em campo. Medido antes de compensar: o grupo
    // de adereços da cena saltou para 8,1 MILHÕES de triângulos. Peça pesada
    // entra em número pequeno, peça leve entra em número grande, e o recife lê
    // pela densidade do leve.
    stylaster: pontos(70, 131, R_REC_I, R_REC_E),
    anemona: pontos(110, 191, R_REC_I, R_REC_E),
    alga: pontos(35, 233, R_REC_I, R_REC_E),
  }
  // os peixes ficam em três alturas da coluna d'água, e a nuvem de cada altura é
  // diferente: cardume junto no meio, peixe grande solto perto do fundo
  const peixePontos = {
    neonBaixo: pontos(420, 307, R_REC_I, R_REC_E),
    neonMeio: pontos(380, 401, R_REC_I, R_REC_E),
    palhacoBaixo: pontos(180, 509, R_REC_I, R_REC_E),
    palhacoMeio: pontos(140, 601, R_REC_I, R_REC_E),
  }
  // a floresta das ilhas: palmeira, samambaia, feto e grama alta
  //
  // ⚠️ SUPERADA POR `ilha-mata.ts` EM 06/09, QUE SOBE SEMPRE (sem bandeira),
  // enquanto isto continua atrás de `?aquario=1`. Quem abrir a praça com essa
  // bandeira planta as duas: esta (rala, `LIFT_ILHA` único, sem cor por
  // instância) por cima da nova (densa, cota exata por patamar, LOD de
  // dossel). Não removi porque `?aquario=1` é experimento do vidro submerso,
  // não desta floresta, e mexer nele não era o pedido; fica registrado para
  // quem for religar a bandeira e achar duas florestas na mesma ilha.
  //
  // ⚠️ ELA ESTAVA PLANTADA NO FUNDO DO LAGO. `props.ts` assenta no terreno, e sob
  // a ilha o terreno é a bacia (L.fundo): sem `lift` a palmeira nascia 12 m abaixo
  // do chão da ilha e 9 m debaixo d'água. Vista de cima a ilha era um disco pelado
  // com um borrão submerso em volta, e era isso que a fazia parecer genérica.
  const LIFT_ILHA = L.agua + 2.7 - L.fundo
  //
  // ⚠️ E ELA NÃO PODE CAIR EM QUALQUER LUGAR DA ILHA. A ilha tem praia, mata
  // (contínua, sem trilha desde 06/09) e clareira; mato na clareira ocupa o
  // vazio natural que ela é agora. A floresta vive nas DUAS FAIXAS abaixo,
  // que hoje são só um recorte convencional da mesma mata contínua de
  // `lago.ts` (fora, perto da praia; dentro, perto da clareira), não mais os
  // dois lados de um anel de saibro que não existe mais.
  const MATA_EXT: [number, number] = [0.72, 0.86]   // perto da praia
  const MATA_INT: [number, number] = [0.44, 0.60]   // perto da clareira
  //
  // ⚠️ E ELA NÃO PODE SER UM ANEL UNIFORME. Mato sorteado ponto a ponto numa
  // faixa dá densidade CONSTANTE, e densidade constante lê como cerca-viva
  // plantada por jardineiro, não como mata. Mata tem BOSQUE e tem CLARO: por
  // isso o sorteio é de bosques (2 a 6 pés cada, num raio de ~13 m), e não de
  // indivíduos. É a mesma lição dos afloramentos do Parque Runestone.
  // ⚠️ SEM `aPath`/`meiaPath` DESDE 06/09: a ilha não tem mais píer (o
  // fundador tirou, junto com a trilha), então não há mais ângulo nenhum
  // para desviar. `anguloDesembarque` saiu de `lago.ts`; esta função parava
  // de plantar numa faixa de 18 m de largura que hoje é mata como o resto.
  const naIlha = (n: number, semente: number, k: number, faixa: [number, number]): [number, number][] => {
    const out: [number, number][] = []
    const ilha = o.ilhas[k]
    if (!ilha) return out
    let posto = 0
    for (let g = 0; posto < n && g < n; g++) {
      const ga = hash01(semente + g * 7) * Math.PI * 2
      const gf = faixa[0] + hash01(semente + g * 7 + 3) * (faixa[1] - faixa[0])
      const quantos = Math.min(n - posto, 2 + Math.floor(hash01(semente + g * 7 + 5) * 5))
      for (let j = 0; j < quantos; j++) {
        posto++
        const a = ga + (hash01(semente + g * 31 + j * 3) - 0.5) * (26 / ilha.r)
        const f = Math.min(faixa[1], Math.max(faixa[0],
          gf + (hash01(semente + g * 31 + j * 3 + 1) - 0.5) * 0.09))
        const rr = contornoIlha(k, a, ilha.r * f)
        out.push([ilha.x + Math.cos(a) * rr, ilha.z + Math.sin(a) * rr])
      }
    }
    return out
  }
  const florestaPalm: [number, number][] = []
  const florestaSamambaia: [number, number][] = []
  const florestaFeto: [number, number][] = []
  const florestaGrama: [number, number][] = []
  o.ilhas.forEach((_, k) => {
    const dsc = k === 0
    // a palmeira fica na faixa de fora: é ela que desenha a silhueta contra a água
    florestaPalm.push(...naIlha(dsc ? 30 : 16, 1000 + k * 97, k, MATA_EXT))
    florestaPalm.push(...naIlha(dsc ? 10 : 5, 1500 + k * 97, k, MATA_INT))
    florestaSamambaia.push(...naIlha(dsc ? 26 : 14, 2000 + k * 97, k, MATA_EXT))
    florestaSamambaia.push(...naIlha(dsc ? 22 : 12, 2500 + k * 97, k, MATA_INT))
    florestaFeto.push(...naIlha(dsc ? 30 : 17, 3000 + k * 97, k, MATA_EXT))
    florestaFeto.push(...naIlha(dsc ? 24 : 13, 3500 + k * 97, k, MATA_INT))
    florestaGrama.push(...naIlha(dsc ? 44 : 25, 4000 + k * 97, k, MATA_EXT))
    florestaGrama.push(...naIlha(dsc ? 34 : 19, 4500 + k * 97, k, MATA_INT))
  })

  // ⚠️ `lift` é o que põe o bicho na coluna d'água. props.ts assenta no terreno,
  // e o terreno aqui é o fundo da bacia: sem lift o peixe fica encalhado.
  const ALTURA_AGUA = L.agua - L.fundo      // 9 m de lâmina
  const specs: PropSpec[] = [
    // ⚠️ O `cull` AQUI É DISTÂNCIA DA CÂMERA AO CENTRO DA PRAÇA, e não à peça:
    // props.ts registra no DistanceCuller com centro na origem. Para o aquário
    // isso é sorte boa, porque ele MORA no centro: com 1.500 a 1.700 o recife
    // inteiro some assim que a câmera sai para a cidade, e a vista de topo não
    // paga um triângulo dele.
    { file: 'coral-set', why: 'o grosso do recife do aquário', at: recifePontos.coralSet, scale: 2.6, jitter: 0.4, lift: 0.3, cull: 1700, castShadow: false },
    { file: 'coral-peca', why: 'coral solto, para o recife não repetir', at: recifePontos.coralPeca, scale: 2.2, jitter: 0.45, lift: 0.3, cull: 1700, castShadow: false },
    { file: 'coral-stylaster', why: 'Stylaster escaneado pelo Smithsonian, o coral de perto', at: recifePontos.stylaster, scale: 2.0, jitter: 0.4, lift: 0.3, cull: 1500, castShadow: false },
    { file: 'anemona', why: 'anêmona do fundo, o que se mexe quando houver corrente', at: recifePontos.anemona, scale: 2.4, jitter: 0.4, lift: 0.3, cull: 1500, castShadow: false },
    { file: 'alga', why: 'alga e kelp: o volume vertical que o coral não dá', at: recifePontos.alga, scale: 1.8, jitter: 0.5, lift: 0.2, cull: 1700, castShadow: false },
    { file: 'peixe-neon', why: 'cardume do meio da coluna d’água', at: peixePontos.neonMeio, scale: 9, jitter: 0.3, lift: ALTURA_AGUA * 0.55, cull: 1500, castShadow: false },
    { file: 'peixe-neon', why: 'cardume rente ao recife', at: peixePontos.neonBaixo, scale: 8, jitter: 0.3, lift: ALTURA_AGUA * 0.25, cull: 1500, castShadow: false },
    { file: 'peixe-palhaco', why: 'peixe-palhaço junto do coral', at: peixePontos.palhacoBaixo, scale: 11, jitter: 0.3, lift: ALTURA_AGUA * 0.2, cull: 1500, castShadow: false },
    { file: 'peixe-palhaco', why: 'peixe-palhaço solto na lâmina', at: peixePontos.palhacoMeio, scale: 12, jitter: 0.3, lift: ALTURA_AGUA * 0.6, cull: 1500, castShadow: false },
    { file: 'palm-tall', why: 'a palmeira que faz a ilha ler como paraíso', at: florestaPalm, scale: 1.15, lift: LIFT_ILHA, jitter: 0.28, yaw: 0, cull: 3000 },
    { file: 'samambaia', why: 'samambaia do sub-bosque da ilha', at: florestaSamambaia, scale: 1.6, lift: LIFT_ILHA, jitter: 0.35, cull: 1500, castShadow: false },
    { file: 'feto', why: 'moita de feto: o chão da floresta', at: florestaFeto, scale: 1.4, lift: LIFT_ILHA, jitter: 0.4, cull: 1500, castShadow: false },
    { file: 'grama-alta', why: 'grama alta entre as moitas', at: florestaGrama, scale: 1.5, lift: LIFT_ILHA, jitter: 0.45, cull: 1200, castShadow: false },
  ]

  const recife = Object.values(recifePontos).reduce((s, a) => s + a.length, 0)
  const peixes = Object.values(peixePontos).reduce((s, a) => s + a.length, 0)
  const floresta = florestaPalm.length + florestaSamambaia.length + florestaFeto.length + florestaGrama.length

  const R_TUN_I = L.r0 - 50, R_TUN_E = L.r1 + 50
  const Y_TUN = L.fundo + 1.2 + 5.5
  return {
    group, specs, recife, peixes, floresta,
    dentro(p: THREE.Vector3) {
      const r = Math.hypot(p.x, p.z)
      // a galeria: anel entre R_GAL_I e R_GAL_E, do piso ao teto
      if (r >= R_GAL_I - 2 && r <= R_GAL_E + 2 && p.y >= Y_PISO - 2 && p.y <= Y_TETO + 2) return true
      // o túnel: distância ao eixo radial do rumo 45, dentro do raio do tubo
      const proj = p.x * dx + p.z * dz
      if (proj >= R_TUN_I - 8 && proj <= R_TUN_E + 8) {
        const lat = p.x * px + p.z * pz
        if (Math.hypot(lat, p.y - Y_TUN) <= 7.5) return true
      }
      return false
    },
    triangulos: (ix.length + ixv.length) / 3,
    dispose() {
      for (const m of feitas) { m.geometry.dispose(); (m.material as THREE.Material).dispose() }
      group.traverse((o2) => {
        const m = o2 as THREE.Mesh
        if (m.isMesh) { m.geometry?.dispose(); (m.material as THREE.Material)?.dispose() }
      })
      group.clear()
    },
  }
}
