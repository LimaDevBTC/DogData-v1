// ═══════════════════════════════════════════════════════════════════════════
// AS PRAÇAS DE QUARTO: os 226 vazios que a documentação chamava de estrutura.
//
// ⚠️ O DEFEITO QUE ORIGINOU ESTE ARQUIVO. Cada quarto é 3x3 células de 180 m e a
// célula CENTRAL nunca recebe lote: em 226 quartos a célula (1,1) não aparece na
// lista de quarteirões nenhuma vez. A documentação registrava isso como "já era
// estrutura e não precisou de demarcação", e era verdade NO DADO e mentira NA
// TELA: nada desenhava aquele chão, então do alto a cidade tinha buracos pretos
// em xadrez. Depois que a rua nasceu ficou pior, porque a malha viária passou a
// contornar um vazio.
//
// ⚠️ TIPOLOGIA, NÃO 226 DESENHOS. A regra da casa é que cada peça do programa
// tem desenho próprio (elipse não é projeto), e ela vale para as 38 peças, que
// são únicas e têm nome. Praça de bairro que se repete 144 vezes é outro
// problema: um masterplan de verdade resolve isso com um VOCABULÁRIO de três ou
// quatro tipos e variação determinística, senão vira ou carimbo ou colcha de
// retalhos. Os quatro tipos aqui têm desenho de projeto; o que se repete é o
// tipo, não a praça.
//
// O tipo não é sorteado no vácuo: ele segue o raio. Perto da Praça Central manda
// o parterre formal, na periferia manda o largo verde. É o gradiente que toda
// cidade tem entre o centro cerimonial e o bairro.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { look2 } from './look'
import { vestir, type Superficie } from './materiais'

/** metros de mundo por unidade de UV das fitas da praça. ⚠️ O UV É DE MUNDO,
 *  NÃO DO QUAD: a praça é feita de quads de tamanhos diferentes (o tabuleiro de
 *  168 m, a diagonal de 8 m, a cova de 3,2 m) e um UV 0..1 por quad esticaria o
 *  ladrilho num e espremeria no outro. Com XZ de mundo a laje continua a mesma
 *  laje de um pedaço da praça pro outro, que é o ponto de existir junta. */
const UV_ESCALA = 100

export interface PracasOpts {
  heightAt: (x: number, z: number) => number
  sombra?: boolean
}

/** ponto onde a arborização deve plantar: a praça marca a cova, não a árvore */
export interface Cova { x: number; z: number; r: number }

export interface Pracas {
  group: THREE.Group
  pracas: number
  covas: Cova[]
  triangulos: number
  dispose(): void
}

// ⚠️ AS COTAS SÃO CAMADAS, NÃO MATERIAIS, E ERRAR ISSO APAGA A PRAÇA INTEIRA. A
// primeira versão dava uma cota fixa por material (grama 0,30, água 0,22) e
// desenhava um piso corrido de 168 m por cima em 0,33: gramado e espelho ficavam
// DEBAIXO da laje e não apareciam. Aqui a base é sempre Y_BASE e o que vem em
// cima sobe de camada, seja lá de que material for. No largo verde a base é
// grama e o caminho é que sobe; nos outros a base é piso.
// Os degraus de 3 a 4 cm também são o que evita z-fighting entre duas
// superfícies coplanares, que na chapa aparece como mancha piscando.
// Tudo abaixo do plinto de lote (0,45) e casando com a calçada da via (0,33):
// quem anda pela rua entra na praça sem degrau, e é isso que faz ela ser parte
// da malha e não um pátio isolado.
const Y_BASE = 0.33
const Y_L1 = 0.36
const Y_L2 = 0.40
const Y_L3 = 0.44

const COR_PISO = '#C6BFB1'
const COR_GRAMA = '#3E5F42'
const COR_SEBE = '#2F4A34'
const COR_AGUA = '#1E3A52'
const COR_PEDRA = '#B4AC9E'
const COR_COVA = '#6B5F4E'

type Alvo = 'piso' | 'grama' | 'agua' | 'cova'
type Volume = 'sebe' | 'pedra'

// ⚠️ 84 É O MEIO DA CÉLULA MENOS A VIA. A célula tem 180 e a via de contorno
// come 6 m de cada lado (a outra metade dos 12 é do vizinho), então a praça
// ocupa 168, exatamente o mesmo que um quarteirão. Se ela ocupasse 180 o piso
// entraria por baixo da pista.
const MEIA = 84

// ⚠️ UM LIMIAR SÓ, EXPORTADO. `vias.ts` desenha a via de contorno em volta da
// praça e tem de concordar exatamente com quem vira praça, senão sobra rua em
// volta de nada ou falta rua em volta de praça.
export const LIMIAR_PRACA = 0.5

interface Parque { id: string; x: number; z: number; a: number; b: number; rot: number }
interface Peca { x: number; z: number; a: number; b: number; rot: number; forma?: string }
interface Malha { parques?: Parque[] }

/** ruído determinístico por praça: a cidade é a mesma em toda visita */
function hash01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 100000) / 100000
}

class Fita {
  vs: number[] = []; ix: number[] = []; uv: number[] = []
  // ⚠️ OS QUATRO CANTOS TÊM DE VIR NO SENTIDO ANTI-HORÁRIO VISTO DE CIMA, senão
  // a normal aponta para baixo e o backface culling apaga a face inteira. Foi
  // exatamente o que aconteceu na primeira versão: a praça saía com o plinto
  // (que é BoxGeometry e tem normal certa) boiando num vazio, porque o piso, o
  // gramado, a água e as 2.112 covas estavam todos virados para o chão. Da
  // câmera de cima não se via nada e parecia que o módulo não tinha rodado.
  quad(a: number[], b: number[], c: number[], d: number[]) {
    const i = this.vs.length / 3
    this.vs.push(...a, ...b, ...c, ...d)
    for (const p of [a, b, c, d]) this.uv.push(p[0] / UV_ESCALA, p[2] / UV_ESCALA)
    this.ix.push(i, i + 1, i + 2, i, i + 2, i + 3)
  }
  get triangulos() { return this.ix.length / 3 }
}

export async function buildPracas(o: PracasOpts): Promise<Pracas> {
  const [malha, meta] = await Promise.all([
    fetch('/city/cidade-malha.json').then((r) => r.json() as Promise<Malha>),
    fetch('/city/cidade.json').then((r) => r.json() as Promise<{ programa: Peca[]; raioBorda: number }>),
  ])
  const group = new THREE.Group()
  group.name = 'pracas'

  // ⚠️ A PEÇA VIROU RETÂNGULO DE CÉLULAS DA MALHA (29/08) e a máscara tem de
  // saber disso. Quem ainda é elipse são só as duas da casca (Portão e Farol),
  // que vivem além de R_ABOBADA onde não há malha para ancorar.
  // ⚠️ CONVENÇÃO ÚNICA: MUNDO = R(rot) · LOCAL, a mesma do `giro` da malha, logo
  // LOCAL = R(-rot) · MUNDO. O gerador usava o sinal invertido até 29/08 e por
  // isso a reserva de terra e o desenho eram espelhados: a máscara guardava 0
  // lote e a elipse desenhada caía em cima de 174. Medido, consertado, e agora
  // os dois lados usam esta mesma linha.
  const pecas = (meta.programa ?? []).map((p) => {
    const rr = (p.rot * Math.PI) / 180
    return { x: p.x, z: p.z, a: p.a, b: p.b, ret: p.forma !== 'elipse',
             ca: Math.cos(rr), sa: Math.sin(rr), rr2: (p.a * p.a + p.b * p.b) }
  })
  const emPeca = (px: number, pz: number) => {
    for (const p of pecas) {
      const dx = px - p.x, dz = pz - p.z
      if (dx * dx + dz * dz > p.rr2) continue
      const lx = dx * p.ca + dz * p.sa, lz = -dx * p.sa + dz * p.ca
      if (p.ret) { if (Math.abs(lx) <= p.a && Math.abs(lz) <= p.b) return true }
      else if ((lx / p.a) ** 2 + (lz / p.b) ** 2 <= 1) return true
    }
    return false
  }
  const rMax = (meta.raioBorda ?? 4400) + 10

  const fitas: Record<Alvo, Fita> = { piso: new Fita(), grama: new Fita(), agua: new Fita(), cova: new Fita() }
  const volumes: Record<Volume, { m: THREE.Matrix4; cor: number }[]> = { sebe: [], pedra: [] }
  const covas: Cova[] = []

  // ── 1. O VERDE DEIXOU DE SER A CÉLULA CENTRAL DE CADA QUARTO ──────────────
  //
  // ⚠️ ESTE MÓDULO DESENHAVA 128 PRAÇAS DE QUARTO E ELAS ERAM O DEFEITO. A célula
  // do meio de cada quarto 3x3 nunca recebia lote, então havia um vazio a cada
  // 540 m em fileira PERFEITA: na planta isso lê como poá, e foi o sinal mais
  // forte de "carimbado" que o fundador viu de cima. Parque de cidade é POUCO,
  // GRANDE e fica onde há motivo.
  // Agora a fonte é `parques` do gerador: 8 elipses escolhidas, sem par
  // simétrico e nenhuma no centro de um distrito. As quatro tipologias ficam
  // (parterre, seca, largo verde, espelho) e passam a preencher a ELIPSE: as
  // coordenadas locais, que eram de uma célula de 168 m, são esticadas por
  // a/84 e b/84 para o desenho ocupar o parque inteiro.
  const escolhidos = (malha.parques ?? [])
    .filter((p) => Math.hypot(p.x, p.z) < rMax)
    .map((p) => ({ id: p.id, x: p.x, z: p.z, r: Math.hypot(p.x, p.z),
                   giro: p.rot, ex: p.a / 84, ez: p.b / 84 }))

  for (const q of escolhidos) {
    const g = (q.giro * Math.PI) / 180
    const cg = Math.cos(g), sg = Math.sin(g)
    const mundo = (lx: number, lz: number): [number, number] => {
      const sx = lx * q.ex, sz = lz * q.ez
      return [q.x + sx * cg - sz * sg, q.z + sx * sg + sz * cg]
    }

    // uma superfície plana em coordenadas locais, subdividida para acompanhar o
    // relevo: um tabuleiro de 168 m sobre terreno inclinado tem de dobrar junto,
    // como a rua dobra, senão a praça flutua numa ponta e afunda na outra.
    //
    // ⚠️ A SUBDIVISÃO SAI DO TAMANHO, E NÃO É ENFEITE. Com 4 divisões o quadro de
    // 168 m virava células de 42 m e a face plana passava POR BAIXO da lombada do
    // regolito no meio do vão: medido em S05-Q03, o terreno saía a 1,37 e o piso
    // a 1,26, ou seja o chão furava a praça e abria uma mordida escura no canto.
    // O erro de corda cai com o quadrado do vão, então 18 m derruba os 11 cm para
    // menos de 2, folgado dentro dos 33 cm de cota. Quem inventar uma peça grande
    // nova não precisa lembrar de nada: o passo se ajusta sozinho.
    const PASSO = 18
    const chao = (alvo: Alvo, x0: number, z0: number, x1: number, z1: number, alt: number) => {
      const div = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0)) / PASSO))
      for (let i = 0; i < div; i++) {
        for (let j = 0; j < div; j++) {
          const ax = x0 + ((x1 - x0) * i) / div, bx = x0 + ((x1 - x0) * (i + 1)) / div
          const az = z0 + ((z1 - z0) * j) / div, bz = z0 + ((z1 - z0) * (j + 1)) / div
          const p = (lx: number, lz: number) => {
            const [wx, wz] = mundo(lx, lz)
            return [wx, o.heightAt(wx, wz) + alt, wz]
          }
          const [wmx, wmz] = mundo((ax + bx) / 2, (az + bz) / 2)
          if (emPeca(wmx, wmz)) continue
          fitas[alvo].quad(p(ax, az), p(ax, bz), p(bx, bz), p(bx, az))
        }
      }
    }
    // um quadrilátero qualquer em coordenadas locais. ⚠️ A DIAGONAL DO LARGO
    // VERDE PRECISA DISTO: montada com retângulos alinhados aos eixos ela vira
    // uma escada de quads que se sobrepõem, e duas faces coplanares brigam no
    // z-buffer. Aqui cada passo é um paralelogramo que encosta no seguinte.
    const chaoLivre = (alvo: Alvo, cantos: [number, number][], alt: number) => {
      const [wmx, wmz] = mundo(
        (cantos[0][0] + cantos[2][0]) / 2, (cantos[0][1] + cantos[2][1]) / 2)
      if (emPeca(wmx, wmz)) return
      const p = (lx: number, lz: number) => {
        const [wx, wz] = mundo(lx, lz)
        return [wx, o.heightAt(wx, wz) + alt, wz]
      }
      fitas[alvo].quad(p(...cantos[0]), p(...cantos[1]), p(...cantos[2]), p(...cantos[3]))
    }
    // um volume (sebe, mureta, plinto) posto no chão pelo centro
    const vol = (tipo: Volume, lx: number, lz: number, sx: number, sy: number, sz: number, cor: string) => {
      const [wx, wz] = mundo(lx, lz)
      if (emPeca(wx, wz)) return
      const m = new THREE.Matrix4()
      m.compose(
        new THREE.Vector3(wx, o.heightAt(wx, wz) + Y_BASE, wz),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -g),
        new THREE.Vector3(sx, sy, sz),
      )
      volumes[tipo].push({ m, cor: new THREE.Color(cor).getHex() })
    }
    const cova = (lx: number, lz: number, raio: number) => {
      const [wx, wz] = mundo(lx, lz)
      if (emPeca(wx, wz)) return
      chao('cova', lx - 1.6, lz - 1.6, lx + 1.6, lz + 1.6, Y_L3)
      covas.push({ x: wx, z: wz, r: raio })
    }

    // ── 2. o tipo: gradiente do centro cerimonial para o bairro ─────────────
    // t vai de 0 na borda do platô a 1 no Cinturão. O sorteio é enviesado por t,
    // então o parterre domina o miolo e o largo verde a periferia sem que exista
    // uma linha dura onde um vira o outro.
    const t = Math.min(1, Math.max(0, (q.r - 1300) / (4400 - 1300)))
    const h = hash01(q.id)
    const tipo = h < 0.42 - 0.30 * t ? 'parterre'
      : h < 0.68 - 0.18 * t ? 'seca'
      : h < 0.90 - 0.06 * t ? 'verde'
      : 'agua'

    if (tipo === 'parterre') {
      // Parterre: dois eixos de piso cruzando quatro quadrantes plantados, sebe
      // de 0,9 m contornando cada quadrante e um espelho d'água no cruzamento.
      chao('piso', -MEIA, -MEIA, MEIA, MEIA, Y_BASE)
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const cx = sx * 42, cz = sz * 42
        chao('grama', cx - 30, cz - 30, cx + 30, cz + 30, Y_L2)
        vol('sebe', cx, cz - 30, 61, 0.9, 1.2, COR_SEBE)
        vol('sebe', cx, cz + 30, 61, 0.9, 1.2, COR_SEBE)
        vol('sebe', cx - 30, cz, 1.2, 0.9, 61, COR_SEBE)
        vol('sebe', cx + 30, cz, 1.2, 0.9, 61, COR_SEBE)
        cova(cx, cz, 5)
      }
      chao('agua', -13, -13, 13, 13, Y_L1)
      vol('pedra', 0, -14, 30, 0.55, 2, COR_PEDRA)
      vol('pedra', 0, 14, 30, 0.55, 2, COR_PEDRA)
      vol('pedra', -14, 0, 2, 0.55, 30, COR_PEDRA)
      vol('pedra', 14, 0, 2, 0.55, 30, COR_PEDRA)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        cova(Math.cos(a) * 74, Math.sin(a) * 74, 4)
      }
    } else if (tipo === 'seca') {
      // Praça seca: piso contínuo, plinto no centro e uma grade 5x5 de covas com
      // o miolo aberto. É a praça de evento, a que aguenta gente em pé.
      chao('piso', -MEIA, -MEIA, MEIA, MEIA, Y_BASE)
      vol('pedra', 0, 0, 30, 1.2, 30, COR_PEDRA)
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
        if (Math.abs(i) < 1 && Math.abs(j) < 1) continue
        cova(i * 32, j * 32, 4.5)
      }
    } else if (tipo === 'verde') {
      // Largo verde: gramado com duas diagonais de piso, que é o caminho que as
      // pessoas fazem de qualquer jeito, e um círculo de piso no encontro.
      chao('grama', -MEIA, -MEIA, MEIA, MEIA, Y_BASE)
      for (const s of [-1, 1]) {
        for (let k = -20; k < 20; k++) {
          const x0 = (k * MEIA) / 20, x1 = ((k + 1) * MEIA) / 20
          // o miolo fica para o círculo: sem isto as duas diagonais se cruzam e
          // as faces coplanares brigam justamente no centro da praça
          if (Math.abs(x0) < 17 || Math.abs(x1) < 17) continue
          chaoLivre('piso', [
            [x0, s * x0 - 4], [x0, s * x0 + 4], [x1, s * x1 + 4], [x1, s * x1 - 4],
          ], Y_L2)
        }
      }
      chao('piso', -17, -17, 17, 17, Y_L2)
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + h * 6.28
        cova(Math.cos(a) * (58 + 18 * hash01(q.id + i)), Math.sin(a) * (58 + 18 * hash01(q.id + 'b' + i)), 5)
      }
    } else {
      // Praça de água: um espelho longo com mureta e duas faixas de grama. É a
      // que dá o brilho pontual na chapa noturna e quebra a repetição das outras.
      chao('piso', -MEIA, -MEIA, MEIA, MEIA, Y_BASE)
      chao('agua', -54, -22, 54, 22, Y_L1)
      vol('pedra', 0, -23, 112, 0.5, 2, COR_PEDRA)
      vol('pedra', 0, 23, 112, 0.5, 2, COR_PEDRA)
      vol('pedra', -55, 0, 2, 0.5, 48, COR_PEDRA)
      vol('pedra', 55, 0, 2, 0.5, 48, COR_PEDRA)
      for (const s of [-1, 1]) chao('grama', -MEIA + 6, s * 44 - 14, MEIA - 6, s * 44 + 14, Y_L2)
      for (let i = -3; i <= 3; i++) { cova(i * 24, -62, 4); cova(i * 24, 62, 4) }
    }
  }

  // ── 3. uma malha por material ─────────────────────────────────────────────
  const cores: Record<Alvo, string> = { piso: COR_PISO, grama: COR_GRAMA, agua: COR_AGUA, cova: COR_COVA }
  const feitas: (THREE.Mesh | THREE.InstancedMesh)[] = []
  let triangulos = 0
  for (const alvo of ['piso', 'grama', 'agua', 'cova'] as Alvo[]) {
    const f = fitas[alvo]
    if (!f.ix.length) continue
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(f.vs, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(f.uv, 2))
    g.setIndex(f.ix)
    g.computeVertexNormals()
    const matAlvo = new THREE.MeshStandardMaterial({
      color: cores[alvo],
      roughness: alvo === 'agua' ? 0.14 : alvo === 'grama' ? 0.95 : 1,
      metalness: alvo === 'agua' ? 0.3 : 0,
    })
    // ⚠️ NÃO HÁ COR POR VÉRTICE AQUI, ENTÃO QUEM MULTIPLICA O MAPA É A TINTA DO
    // MATERIAL, e as cores chapadas de cima não servem: 'campo' já entrega verde
    // (86,112,66 antes do viço) e multiplicar por COR_GRAMA (#3E5F42) daria um
    // verde de pântano. Cada alvo vestido troca a cor por uma TINTA quase
    // branca, com só o desvio de matiz que a praça quer.
    if (look2 && alvo !== 'agua') {
      const veste: Record<'piso' | 'grama' | 'cova', [Superficie, string, number]> = {
        piso: ['calcada', '#EDE7DA', 60],
        grama: ['campo', '#E8EEE2', 90],
        cova: ['pedra', '#B9A98E', 30],   // a cova é terra batida: a tinta puxa pro barro
      }
      const [nome, tinta, macro] = veste[alvo as 'piso' | 'grama' | 'cova']
      matAlvo.color = new THREE.Color(tinta)
      vestir(matAlvo, nome, UV_ESCALA, { macroMetros: macro })
    }
    const m = new THREE.Mesh(g, matAlvo)
    m.name = `praca:${alvo}`
    m.receiveShadow = true
    m.frustumCulled = false
    group.add(m); feitas.push(m); triangulos += f.triangulos
  }
  // sebe e mureta são volume: uma InstancedMesh por tipo, pivô no pé
  const cubo = new THREE.BoxGeometry(1, 1, 1)
  cubo.translate(0, 0.5, 0)
  for (const tipo of ['sebe', 'pedra'] as Volume[]) {
    const lista = volumes[tipo]
    if (!lista.length) continue
    const mat = new THREE.MeshStandardMaterial({ roughness: tipo === 'sebe' ? 0.95 : 0.9 })
    const im = new THREE.InstancedMesh(cubo, mat, lista.length)
    const cor = new THREE.Color()
    lista.forEach((v, i) => { im.setMatrixAt(i, v.m); im.setColorAt(i, cor.setHex(v.cor)) })
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    im.name = `praca:${tipo}`
    im.castShadow = o.sombra ?? true
    im.receiveShadow = true
    im.frustumCulled = false
    group.add(im); feitas.push(im); triangulos += lista.length * 12
  }

  return {
    group,
    pracas: escolhidos.length,
    covas,
    triangulos,
    dispose() {
      for (const m of feitas) {
        if (!(m as THREE.InstancedMesh).isInstancedMesh) m.geometry.dispose()
        ;(m.material as THREE.Material).dispose()
      }
      cubo.dispose()
      group.clear()
    },
  }
}
