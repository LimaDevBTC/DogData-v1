// Os lagos de cratera: a água que a GEOGRAFIA dá, não a que o desenho impõe.
//
// ⚠️ ESTE MÓDULO EXISTE PORQUE OS CANAIS DE ANEL MORRERAM (fundador, 30/08).
// Eles eram sete círculos geométricos jogados sobre um relevo que não é
// circular — o CA07 passava 20,5 dos seus 34,4 km DENTRO de cratera — e nivelar
// os quinze canais numa lâmina só custaria 276 Mm³ de terraplenagem, mais do que
// o Canal do Panamá inteiro moveu (205 Mm³). A saída foi dele: "já que temos que
// usar o terreno real, é só transformar as crateras em lagos".
//
// ⚠️ E A LÂMINA É UMA SÓ, EM TODA A CIDADE. Também dele, e é hidráulica básica:
// "toda água da cidade precisa ter exatamente o mesmo nível, já que está tudo
// interligado". Água conectada acha um nível. O nível é `cota`, medido em −40 m
// porque é onde o custo desaba: afoga 163 lotes (0,2%) contra 14.958 em −20.
//
// ⚠️ O CONTORNO SE TRAÇA AQUI, NÃO VEM PUBLICADO. O gerador conhece o heightmap
// CRU; o chão que a cidade tem é `superficieAt`, com o pódio da abóbada, a cova
// do parque e a vala do canal já aplicados. Publicar polígono do chão cru poria
// a margem no lugar errado, então o cliente traça a orla a partir do chão final.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { COR_AGUA, aguaDeVerdade } from './lago'

const COR_AREIA = '#8E856F'    // a faixa de praia, no mesmo tom do cais dos canais
const COR_FUNDO = '#243B47'    // o raso junto à margem, para a água não virar chapa
// A ORLA usa a MESMA paleta do cais dos canais (canais.ts), de propósito: é a
// mesma peça urbana encostando na mesma água, e duas paletas para isso leria
// como dois projetos.
const COR_CAIS = '#8E856F'     // o passeio de cima
const COR_MURO = '#6E685C'     // o muro de arrimo e o talude de trás
const COR_PISTA = '#57534B'    // a faixa de rolamento, o valor mais escuro da cidade

export interface LagosOpts {
  /** a lâmina, única para toda a cidade */
  cota: number
  /** o chão que a câmera vê, com pódio, cova e vala já aplicados */
  superficieAt: (x: number, z: number) => number
  /** até onde procurar água: a casca */
  raio: number
  /** passo da amostragem em metros; 30 dá orla lisa sem pesar */
  passo?: number
  /** ⚠️ ONDE A MARGEM NÃO SE DESENHA, mas a ÁGUA ENTRA.
   *
   *  ⚠️ ESTA DISTINÇÃO É O CONSERTO DA BOCA DO CANAL. A versão anterior tirava a
   *  ÁGUA do corredor do canal, e o efeito colateral foi pior que o problema: sem
   *  água ali, o contorno da baía CONTORNA a boca do canal, e a orla (cais, muro,
   *  talude) é construída atravessada na frente dela. O fundador viu um U de cais
   *  fechando a saída do canal e disse, com razão, que a terra bloqueava a saída.
   *
   *  Água e margem são coisas separadas. A lâmina do lago PODE inundar o
   *  corredor: ela está na mesma cota do canal (−40), então as duas se sobrepõem
   *  sem diferença visual nenhuma. O que não pode é a MARGEM cruzar a boca, porque
   *  o canal já tem cais próprio. Aqui só a margem é suprimida. */
  semMargem?: (x: number, z: number) => boolean

  /** ⚠️ ONDE O LAGO NÃO ENTRA. Continua existindo para quem precisar, mas o canal
   *  NÃO usa mais: ver `semMargem` acima. O leito do canal
   *  é cavado a −44, abaixo da lâmina de −40, então o marching squares daqui
   *  inundava a vala inteira e desenhava a borda dela — uma linha azul sinuosa
   *  seguindo o fundo irregular da escavação, por cima da água RETA que
   *  `canais.ts` já desenha no mesmo lugar. O fundador viu as duas sobrepostas e
   *  chamou de "pedaços de um rio tortuoso colocado num canal reto". Não são dois
   *  desenhos do mesmo canal: são dois sistemas de água pisando um no outro. */
  foraDe?: (x: number, z: number) => boolean
  sombra?: boolean
}

export interface Lagos {
  group: THREE.Group
  area: number
  corpos: number
  triangulos: number
  /** ⚠️ ESTÁ NA BAÍA? (o maior corpo, não uma poça qualquer)
   *
   *  Existe porque a RUA precisa saber. Travessia sobre um canal de 60 m ou sobre
   *  uma cratera de 300 m é ponte; travessia sobre 20,5 km² não é ponte, é outra
   *  coisa — e o fundador decidiu que ali não passa estrada. Sem esta consulta a
   *  via não tem como distinguir os dois casos, porque para ela toda água é água.
   *
   *  A resposta sai da mesma rotulagem por preenchimento que decide quem ganha
   *  orla, então as duas pontas nunca divergem. */
  naBaia: (x: number, z: number) => boolean
  /** ⚠️ ESTÁ MOLHADO? QUALQUER CORPO, não só a baía.
   *
   *  Existe porque a ÁRVORE precisa saber, e por muito tempo não soube: medido em
   *  31/08, 13,7% da plantação (cerca de 6.800 de 49.818 mudas) estava plantada
   *  em cima d'água. A fileira da avenida de rumo 0 seguia reta da margem até
   *  r 5.400, com a rua parando na baía e as árvores atravessando. Foi o que o
   *  fundador viu como "fileiras de árvores em locais que não temos ruas".
   *
   *  ⚠️ E É SEPARADA DA `naBaia` DE PROPÓSITO. Para a RUA a distinção importa
   *  (cratera de 300 m é ponte, 20,5 km² não é); para quem PLANTA não importa
   *  nada: toda água é igualmente inplantável. Uma consulta só, respondendo as
   *  duas perguntas, faria uma das duas errar.
   *
   *  `folga` é em METROS e é medida de verdade, não dilatação de célula: a grade
   *  tem passo de 30 m e crescer por célula saltaria de 0 para 30. */
  naAgua: (x: number, z: number, folga?: number) => boolean
  update: (t: number) => void
  dispose: () => void
}

/**
 * ⚠️ MARCHING SQUARES, E É O QUE FAZ A ORLA FICAR LISA. A tentação é emitir um
 * quadrado por célula abaixo da cota — sai em degrau de 30 m, que a 200 m de
 * distância lê como serra. Aqui cada célula da grade é resolvida pelo caso dos
 * seus quatro cantos e o corte cai no ponto INTERPOLADO em que o chão cruza a
 * lâmina. A margem passa a ser a curva de nível de verdade.
 *
 * Os 16 casos saem de uma tabela: para cada combinação de cantos submersos,
 * o polígono da parte molhada, em índices onde 0..3 são os cantos e 4..7 são os
 * pontos das arestas.
 */
const CASOS: number[][] = [
  [],                    // 0000
  [0, 4, 7],             // 0001
  [1, 5, 4],             // 0010
  [0, 1, 5, 7],          // 0011
  [2, 6, 5],             // 0100
  [0, 4, 5, 2, 6, 7],    // 0101 (sela)
  [1, 2, 6, 4],          // 0110
  [0, 1, 2, 6, 7],       // 0111
  [3, 7, 6],             // 1000
  [0, 4, 6, 3],          // 1001
  [1, 5, 4, 3, 7, 6],    // 1010 (sela)
  [0, 1, 5, 6, 3],       // 1011
  [2, 3, 7, 5],          // 1100
  [0, 4, 5, 2, 3],       // 1101
  [1, 2, 3, 7, 4],       // 1110
  [0, 1, 2, 3],          // 1111
]

// ═══════════════════════════════════════════════════════════════════════════
// A ORLA DA BAÍA
//
// ⚠️ A BAÍA É DECISÃO DE PROJETO (fundador, 30/08: "eu gostei da baía, vamos
// organizar a cidade em torno disso"). Ela não foi desenhada: apareceu quando o
// nível único de −40 encontrou a encosta do sítio, e o nordeste inteiro da
// cúpula virou água — 20,5 dos 23,3 km² num corpo só. A cidade para de fingir
// que aquilo é acidente e passa a ter FRENTE PARA A ÁGUA.
//
// ⚠️ E SÓ A BAÍA GANHA CAIS. As outras 19 crateras continuam margem natural, com
// a faixa de praia. A regra é legível de longe: água grande é urbana, poça é
// paisagem. Sem isso, 19 lagoas de 300 m ganhariam muro de arrimo e a cidade
// leria como um parque de concreto.
const ORLA_ALTURA = 2.2        // o passeio acima da lâmina: um cais, não uma praia
const ORLA_PE     = 3.5        // quanto o muro desce dentro d'água
const ORLA_PASSEIO = 26.0      // largura do passeio
const ORLA_PISTA  = 14.0       // a faixa de rolamento atrás dele
const ORLA_TALUDE = 12.0       // onde a orla encontra o chão de verdade

export function buildLagos(o: LagosOpts): Lagos {
  const group = new THREE.Group()
  group.name = 'lagos'
  const L = o.cota
  const passo = o.passo ?? 30
  const R = o.raio
  const n = Math.ceil((R * 2) / passo)

  // ⚠️ A ALTURA É AMOSTRADA UMA VEZ SÓ. `superficieAt` interpola a malha do
  // terreno e não é barata; chamá-la dentro do laço dos casos multiplicaria por
  // quatro. A grade inteira sai antes, e os casos só leem.
  const alt = new Float32Array((n + 1) * (n + 1))
  const px = (i: number) => -R + i * passo
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const x = px(i), z = px(j)
      // fora da casca não há água: a cidade acaba ali
      alt[j * (n + 1) + i] = (Math.hypot(x, z) > R - 40 || (o.foraDe && o.foraDe(x, z)))
        ? 1e6 : o.superficieAt(x, z)
    }
  }
  const A = (i: number, j: number) => alt[j * (n + 1) + i]

  // ⚠️ QUAL DOS CORPOS É A BAÍA se decide MEDINDO, não por caixa de coordenadas.
  // A tentação é "tudo a nordeste é baía": o sítio muda quando o heightmap muda,
  // e a regra amarrada em rumo já mentiu uma vez nesta cidade. Aqui os corpos são
  // rotulados por preenchimento e o MAIOR é a baía — 20,5 dos 23,3 km², sem
  // segundo lugar próximo (o seguinte tem 0,4).
  const rot = new Int32Array((n + 1) * (n + 1)).fill(-1)
  const tam: number[] = []
  const pilha: number[] = []
  for (let p0 = 0; p0 < rot.length; p0++) {
    if (rot[p0] >= 0 || alt[p0] >= L) continue
    const id = tam.length
    let cont = 0
    pilha.length = 0; pilha.push(p0); rot[p0] = id
    while (pilha.length) {
      const q = pilha.pop() as number
      cont++
      const qi = q % (n + 1), qj = (q / (n + 1)) | 0
      if (qi > 0) { const v = q - 1; if (rot[v] < 0 && alt[v] < L) { rot[v] = id; pilha.push(v) } }
      if (qi < n) { const v = q + 1; if (rot[v] < 0 && alt[v] < L) { rot[v] = id; pilha.push(v) } }
      if (qj > 0) { const v = q - (n + 1); if (rot[v] < 0 && alt[v] < L) { rot[v] = id; pilha.push(v) } }
      if (qj < n) { const v = q + (n + 1); if (rot[v] < 0 && alt[v] < L) { rot[v] = id; pilha.push(v) } }
    }
    tam.push(cont)
  }
  let baia = -1
  for (let k = 0; k < tam.length; k++) if (baia < 0 || tam[k] > tam[baia]) baia = k

  const posA: number[] = [], idxA: number[] = []      // a lâmina
  const posP: number[] = [], idxP: number[] = []      // a praia das crateras
  const posM: number[] = [], idxM: number[] = []      // muro de arrimo e talude
  const posC: number[] = [], idxC: number[] = []      // o passeio da orla
  const posR: number[] = [], idxR: number[] = []      // a faixa de rolamento
  const segs: number[] = []                          // (ax,az,bx,bz) da orla da baía
  let area = 0

  /** o ponto onde o chão cruza a lâmina, entre dois cantos */
  const corta = (xa: number, za: number, ya: number, xb: number, zb: number, yb: number) => {
    const t = Math.abs(yb - ya) < 1e-6 ? 0.5 : (L - ya) / (yb - ya)
    const k = Math.min(1, Math.max(0, t))
    return [xa + (xb - xa) * k, za + (zb - za) * k] as [number, number]
  }

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x0 = px(i), x1 = px(i + 1), z0 = px(j), z1 = px(j + 1)
      const y0 = A(i, j), y1 = A(i + 1, j), y2 = A(i + 1, j + 1), y3 = A(i, j + 1)
      const c = (y0 < L ? 1 : 0) | (y1 < L ? 2 : 0) | (y2 < L ? 4 : 0) | (y3 < L ? 8 : 0)
      if (c === 0) continue
      const caso = CASOS[c]
      if (!caso.length) continue
      // os oito pontos: 0..3 cantos, 4..7 meios de aresta interpolados
      const P: [number, number][] = [
        [x0, z0], [x1, z0], [x1, z1], [x0, z1],
        corta(x0, z0, y0, x1, z0, y1),
        corta(x1, z0, y1, x1, z1, y2),
        corta(x1, z1, y2, x0, z1, y3),
        corta(x0, z1, y3, x0, z0, y0),
      ]
      const base = posA.length / 3
      for (const k of caso) { posA.push(P[k][0], L, P[k][1]) }
      for (let k = 1; k < caso.length - 1; k++) idxA.push(base, base + k, base + k + 1)
      // área da parte molhada, por shoelace
      let s = 0
      for (let k = 0; k < caso.length; k++) {
        const a = P[caso[k]], b = P[caso[(k + 1) % caso.length]]
        s += a[0] * b[1] - b[0] * a[1]
      }
      area += Math.abs(s) / 2

      // ⚠️ A MARGEM SE ACABA NA ARESTA CORTADA, e sem isso a água encosta no
      // regolito cru — foi o que o fundador viu como "margem faltando
      // acabamento". Qual acabamento depende do CORPO: a baía recebe cais e
      // passeio (é a frente da cidade), a cratera recebe praia (é paisagem).
      // ⚠️ A MARGEM PODE SER SUPRIMIDA SEM QUE A ÁGUA SEJA. Ver `semMargem`: na
      // boca do canal a lâmina entra, mas o cais da baía não pode cruzar, porque
      // o canal já tem o dele.
      const _mx = (x0 + x1) / 2, _mz = (z0 + z1) / 2
      if (c !== 15 && !(o.semMargem && o.semMargem(_mx, _mz))) {
        const eBaia = rot[j * (n + 1) + i] === baia || rot[j * (n + 1) + i + 1] === baia
          || rot[(j + 1) * (n + 1) + i] === baia || rot[(j + 1) * (n + 1) + i + 1] === baia
        for (let k = 0; k < caso.length; k++) {
          const ia = caso[k], ib = caso[(k + 1) % caso.length]
          if (ia < 4 || ib < 4) continue          // só as arestas de corte
          const a = P[ia], b = P[ib]
          const dx = b[0] - a[0], dz = b[1] - a[1]
          const dl = Math.hypot(dx, dz) || 1
          // a normal aponta para FORA da água (para o lado seco)
          const nx = -dz / dl, nz = dx / dl
          if (!eBaia) {
            const fora = 12
            const bp = posP.length / 3
            posP.push(a[0], L - 0.4, a[1])
            posP.push(b[0], L - 0.4, b[1])
            posP.push(b[0] + nx * fora, L + 1.2, b[1] + nz * fora)
            posP.push(a[0] + nx * fora, L + 1.2, a[1] + nz * fora)
            idxP.push(bp, bp + 1, bp + 2, bp, bp + 2, bp + 3)
            continue
          }
          // ⚠️ A ORLA NÃO SE EMITE AQUI, SÓ SE COLETA. Emitir por aresta foi a
          // primeira versão e o defeito apareceu na chapa de perto: cada aresta
          // calculava a própria normal e nas curvas elas DIVERGEM, então os
          // painéis abriam em leque para fora da margem. Extrusão de 52 m sobre
          // grade de 30 m: a quina erra quase duas células. Aqui o contorno vira
          // corrente e a normal passa a ser do VÉRTICE, com esquadria.
          segs.push(a[0], a[1], b[0], b[1])
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // A ORLA: os segmentos viram CORRENTE, e a normal vira do vértice.
  //
  // ⚠️ ISTO É O CONSERTO DO LEQUE. Marching squares devolve segmentos soltos; a
  // versão anterior extrudia cada um pela própria normal e nas curvas os painéis
  // abriam em leque, com respingo de cais espalhado pela água aberta. Encadear
  // resolve os dois: a normal de cada VÉRTICE é a média das duas arestas que
  // chegam nele (esquadria), então painéis vizinhos compartilham a aresta e não
  // existe nem vão nem sobreposição.
  //
  // ⚠️ E CORRENTE CURTA SE JOGA FORA. Os respingos na água aberta eram ilhotas
  // de UMA célula seca dentro da baía: contorno de 3 ou 4 segmentos, 60 m de
  // perímetro, que viravam uma florzinha de cais no meio do lago. O gerador já
  // descarta corpo d'água com menos de 3 ha pelo mesmo motivo; aqui o corte é
  // por número de segmentos.
  {
    const CHAVE = (x: number, z: number) => `${Math.round(x * 100)},${Math.round(z * 100)}`
    const daPonta = new Map<string, number[]>()
    for (let k = 0; k < segs.length; k += 4) {
      const ch = CHAVE(segs[k], segs[k + 1])
      const l = daPonta.get(ch); if (l) l.push(k); else daPonta.set(ch, [k])
    }
    const usado = new Uint8Array(segs.length / 4)
    const correntes: number[][] = []
    for (let k0 = 0; k0 < segs.length; k0 += 4) {
      if (usado[k0 / 4]) continue
      const pts: number[] = [segs[k0], segs[k0 + 1]]
      let k = k0
      // ⚠️ O TETO DO LAÇO NÃO É ENFEITE: uma corrente mal formada (ponta que
      // aponta para si mesma por arredondamento) faria laço infinito e a página
      // congelaria sem erro nenhum no console.
      for (let guarda = 0; guarda < segs.length / 4 + 2; guarda++) {
        usado[k / 4] = 1
        pts.push(segs[k + 2], segs[k + 3])
        const seg = daPonta.get(CHAVE(segs[k + 2], segs[k + 3]))
        const prox = seg && seg.find((q) => !usado[q / 4])
        if (prox === undefined) break
        k = prox
      }
      // ⚠️ O CORTE É POR COMPRIMENTO, NÃO POR NÚMERO DE SEGMENTOS. Contar
      // segmentos deixou passar o defeito seguinte: BAIXIOS. Onde o leito da
      // baía raspa a cota, o contorno serpenteia em dezenas de fatias de 2 m e
      // some no teste de contagem — na chapa isso vira um rastro pontilhado
      // atravessando a água aberta, que foi exatamente o que sobrou depois de o
      // leque ser consertado. 300 m é a menor coisa que merece cais: menos que
      // isso é banco de areia, e banco de areia não tem passeio.
      let comp = 0
      for (let q = 0; q + 3 < pts.length; q += 2) {
        comp += Math.hypot(pts[q + 2] - pts[q], pts[q + 3] - pts[q + 1])
      }
      if (pts.length >= 2 * 6 && comp >= 300) correntes.push(pts)
    }

    const w1 = ORLA_PASSEIO
    const w2 = w1 + ORLA_PISTA
    const w3 = w2 + ORLA_TALUDE
    const yD = L + ORLA_ALTURA
    for (const pts of correntes) {
      const m = pts.length / 2
      const fechada = Math.hypot(pts[0] - pts[2 * m - 2], pts[1] - pts[2 * m - 1]) < 0.01
      // normal de cada vértice = média das arestas vizinhas, com esquadria
      const NX = new Float64Array(m), NZ = new Float64Array(m)
      const eN = (k: number) => {
        const dx = pts[2 * k + 2] - pts[2 * k], dz = pts[2 * k + 3] - pts[2 * k + 1]
        const dl = Math.hypot(dx, dz) || 1
        return [-dz / dl, dx / dl] as [number, number]
      }
      for (let k = 0; k < m; k++) {
        const ant = k > 0 ? eN(k - 1) : (fechada ? eN(m - 2) : eN(0))
        const pro = k < m - 1 ? eN(k) : (fechada ? eN(0) : eN(m - 2))
        let ax = ant[0] + pro[0], az = ant[1] + pro[1]
        const al = Math.hypot(ax, az) || 1
        ax /= al; az /= al
        // ⚠️ O FATOR DE ESQUADRIA SE LIMITA. Numa quina de quase 180° o
        // comprimento de esquadria vai ao infinito e o cais dispararia num
        // espeto — que é a MESMA aparência do defeito que eu vim consertar.
        const f = Math.min(2.5, 1 / Math.max(0.4, ax * ant[0] + az * ant[1]))
        NX[k] = ax * f; NZ[k] = az * f
      }
      const px = (k: number, w: number) => pts[2 * k] + NX[k] * w
      const pz = (k: number, w: number) => pts[2 * k + 1] + NZ[k] * w
      for (let k = 0; k < m - 1; k++) {
        const faixa = (
          wa: number, ya: number, wb: number, yb: number,
          dest: number[], di: number[], chaoB = false,
        ) => {
          const bp = dest.length / 3
          const y0 = chaoB ? Math.max(o.superficieAt(px(k, wb), pz(k, wb)), L + 0.2) : yb
          const y1 = chaoB ? Math.max(o.superficieAt(px(k + 1, wb), pz(k + 1, wb)), L + 0.2) : yb
          dest.push(px(k, wa), ya, pz(k, wa))
          dest.push(px(k + 1, wa), ya, pz(k + 1, wa))
          dest.push(px(k + 1, wb), y1, pz(k + 1, wb))
          dest.push(px(k, wb), y0, pz(k, wb))
          di.push(bp, bp + 1, bp + 2, bp, bp + 2, bp + 3)
        }
        faixa(0, L - ORLA_PE, 0, yD, posM, idxM)          // o muro, dentro d'água
        faixa(0, yD, w1, yD, posC, idxC)                  // o passeio
        faixa(w1, yD - 0.15, w2, yD - 0.15, posR, idxR)   // a faixa de rolamento
        faixa(w2, yD, w3, yD, posM, idxM, true)           // o talude encontra o chão
      }
    }
  }

  const feitas: THREE.Mesh[] = []
  const monta = (pos: number[], idx: number[], cor: string, agua: boolean, nome: string) => {
    if (!idx.length) return
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      color: cor,
      // os mesmos valores do lago central: os dois se encontram e não podem divergir
      roughness: agua ? 0.30 : 0.92,
      metalness: agua ? 0.02 : 0,
      side: THREE.DoubleSide,
    }))
    m.name = nome
    m.receiveShadow = !agua
    m.castShadow = (o.sombra ?? true) && !agua
    m.frustumCulled = false
    group.add(m)
    feitas.push(m)
  }
  monta(posP, idxP, COR_AREIA, false, 'lagos:praia')
  monta(posM, idxM, COR_MURO, false, 'orla:muro')
  monta(posC, idxC, COR_CAIS, false, 'orla:passeio')
  monta(posR, idxR, COR_PISTA, false, 'orla:pista')
  monta(posA, idxA, COR_AGUA, true, 'lagos:agua')

  // ⚠️ A CONSULTA USA A GRADE JÁ AMOSTRADA, não uma nova. Ela tem passo de 30 m e
  // os rótulos de corpo já estão nela: perguntar é um índice, não um cálculo.
  const naBaia = (x: number, z: number): boolean => {
    const i = Math.round((x + R) / passo), j = Math.round((z + R) / passo)
    if (i < 0 || j < 0 || i > n || j > n) return false
    return rot[j * (n + 1) + i] === baia
  }

  /** a mesma grade, perguntando por QUALQUER corpo (rot >= 0 é água rotulada) */
  const molhadoNoPonto = (x: number, z: number): boolean => {
    const i = Math.round((x + R) / passo), j = Math.round((z + R) / passo)
    if (i < 0 || j < 0 || i > n || j > n) return false
    return rot[j * (n + 1) + i] >= 0
  }
  const naAgua = (x: number, z: number, folga = 0): boolean => {
    if (molhadoNoPonto(x, z)) return true
    if (folga <= 0) return false
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2
      if (molhadoNoPonto(x + Math.cos(a) * folga, z + Math.sin(a) * folga)) return true
    }
    return false
  }

  const relogios = feitas.map((m) => aguaDeVerdade(m)).filter(Boolean) as { value: number }[]
  return {
    group,
    naBaia,
    naAgua,
    area,
    corpos: 0,
    triangulos: (idxA.length + idxP.length + idxM.length + idxC.length + idxR.length) / 3,
    update(t: number) { for (const u of relogios) u.value = t },
    dispose() {
      for (const m of feitas) { m.geometry.dispose(); (m.material as THREE.Material).dispose() }
      group.clear()
    },
  }
}
