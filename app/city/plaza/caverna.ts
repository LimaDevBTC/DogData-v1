// ═══════════════════════════════════════════════════════════════════════════
// A CAVERNA DOS RUNESTONES: o subsolo do Parque Runestone, reservado.
//
// ⚠️ ISTO É RESERVA DE VOLUME, NÃO É OBRA. Igual às 51 peças do programa lá em
// cima: espaço com nome e medida, para que nada nasça por cima e para que o
// projeto venha depois sem desfazer decisão nenhuma. O que se vê é o contorno da
// câmara, o piso e as bocas. A festa, o DJ, a luz e o som vêm depois.
//
// ⚠️ A IDEIA NASCEU DE UM DEFEITO, E O DEFEITO É REAL. O fundador reparou que no
// Parque Runestone a câmera entra na terra. A causa: o parque tem CHÃO PRÓPRIO
// (vale a −61, cordilheira a +240 sobre o datum, `park.ts`), e a guarda de chão
// do laço só conhece o regolito de `terrain.heightAt`, que ali é a cova do
// parque. A câmera respeita o regolito e atravessa a montanha do parque.
// Consertar isso exige o parque publicar a altura dele, e é trabalho de outra
// rodada. Enquanto isso o furo é a porta: já se entra no subsolo, então o
// subsolo passa a ter o que ver.
//
// ⚠️ E O SISTEMA DE NAVEGAÇÃO NÃO É DE BONECO. Ele é órbita sobre a cidade, com
// alvo e distância; não há personagem, não há colisão, não há andar. Reservar o
// volume agora não cria essa dívida: o volume é geometria, e a visita a pé é
// decisão de produto que não depende dele.
//
// A ESCALA É DE PROPÓSITO ABSURDA. Uma câmara de 620 x 420 m com 110 m de pé
// direito é maior que qualquer arena construída na Terra (o Maracanã tem 317 m
// no maior eixo). Numa cidade lunar sob abóbada isso é coerente, e é o tipo de
// número que faz a peça valer a viagem.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { PARK_CENTER } from './park-site'

export interface CavernaOpts {
  /** o regolito, que sob o parque já é a cova: o teto da caverna fica abaixo dele */
  heightAt: (x: number, z: number) => number
}

export interface Camara { id: string; nome: string; x: number; z: number; a: number; b: number; alturaM: number; usoM2: number }

export interface Caverna {
  group: THREE.Group
  camaras: Camara[]
  volumeM3: number
  triangulos: number
  dispose(): void
}

const COR_PISO = '#4A443C'
const COR_PAREDE = '#6E685C'
const COR_MARCO = '#2A2430'      // obsidiana, a paleta do Parque Runestone
const COR_BOCA = '#C25E2A'       // o laranja do DOG marca as entradas

export function buildCaverna(o: CavernaOpts): Caverna {
  const group = new THREE.Group()
  group.name = 'caverna'
  const CX = PARK_CENTER.x + 520, CZ = PARK_CENTER.z - 520   // sob a cordilheira, a nordeste do centro
  const datum = o.heightAt(CX, CZ)

  // ⚠️ AS TRÊS CÂMARAS SÃO UM SISTEMA E NÃO UM BURACO. Uma sala grande sozinha
  // não é caverna, é galpão: o que faz o subsolo ler como subsolo é a sequência
  // átrio, salão, galeria, com pé direito diferente em cada.
  const camaras: Camara[] = [
    { id: 'CV1', nome: 'Salão dos Runestones', x: CX, z: CZ, a: 310, b: 210, alturaM: 110, usoM2: Math.round(Math.PI * 310 * 210) },
    { id: 'CV2', nome: 'Átrio da Descida', x: CX - 430, z: CZ + 430, a: 150, b: 130, alturaM: 62, usoM2: Math.round(Math.PI * 150 * 130) },
    { id: 'CV3', nome: 'Galeria das Lascas', x: CX + 400, z: CZ - 300, a: 230, b: 90, alturaM: 48, usoM2: Math.round(Math.PI * 230 * 90) },
  ]

  const vs: number[] = [], ix: number[] = [], cs: number[] = []
  const cor = new THREE.Color()
  const quad = (A: number[], B: number[], C: number[], D: number[], hex: string) => {
    const i = vs.length / 3
    vs.push(...A, ...B, ...C, ...D)
    cor.set(hex)
    for (let k = 0; k < 4; k++) cs.push(cor.r, cor.g, cor.b)
    ix.push(i, i + 1, i + 2, i, i + 2, i + 3)
  }

  let volume = 0
  for (const c of camaras) {
    const piso = datum - 40 - c.alturaM
    volume += Math.PI * c.a * c.b * c.alturaM
    const seg = 64
    const P = (t: number, k: number, y: number) => [
      c.x + Math.cos(t) * c.a * k, y, c.z + Math.sin(t) * c.b * k,
    ]
    for (let j = 0; j < seg; j++) {
      const t0 = (j / seg) * Math.PI * 2, t1 = ((j + 1) / seg) * Math.PI * 2
      // piso da câmara
      quad(P(t0, 0, piso), P(t0, 1, piso), P(t1, 1, piso), P(t1, 0, piso), COR_PISO)
      // a parede, que é o que dá o pé direito na chapa
      quad(P(t0, 1, piso), P(t1, 1, piso), P(t1, 1, piso + c.alturaM), P(t0, 1, piso + c.alturaM), COR_PAREDE)
    }
    // os runestones cravados: doze blocos de obsidiana em pé, no anel da câmara
    for (let j = 0; j < 12; j++) {
      const t = (j / 12) * Math.PI * 2
      const bx = c.x + Math.cos(t) * c.a * 0.82, bz = c.z + Math.sin(t) * c.b * 0.82
      const h = 16 + ((j * 7) % 11)
      // ⚠️ ROTACIONAR DEPOIS DE TRANSLADAR GIRA EM TORNO DA ORIGEM DO MUNDO, não
      // do próprio bloco. Estes runestones eram transladados para junto da
      // caverna e SÓ ENTÃO girados: cada um saía em órbita a 7,2 km do centro da
      // cidade. Achei pelo bounding box, que dava 21 km de lado e simétrico na
      // origem para uma peça de 900 m escondida no subsolo do parque. Gira
      // primeiro, translada depois.
      const g = new THREE.BoxGeometry(7, h, 5)
      g.rotateY(t)
      g.translate(bx, piso + h / 2, bz)
      const pos = g.attributes.position as THREE.BufferAttribute
      const base = vs.length / 3
      cor.set(COR_MARCO)
      for (let k = 0; k < pos.count; k++) {
        vs.push(pos.getX(k), pos.getY(k), pos.getZ(k))
        cs.push(cor.r, cor.g, cor.b)
      }
      const idx = g.getIndex()!
      for (let k = 0; k < idx.count; k++) ix.push(base + idx.getX(k))
      g.dispose()
    }
  }

  // as duas bocas: onde a caverna encontra o vale do parque. Marcadas em laranja
  // porque entrada é a única coisa desta reserva que já tem de estar decidida.
  for (const c of [camaras[1], camaras[2]]) {
    const piso = datum - 40 - c.alturaM
    const w = 26
    quad([c.x - w, piso + 1, c.z - w], [c.x + w, piso + 1, c.z - w],
         [c.x + w, piso + 1, c.z + w], [c.x - w, piso + 1, c.z + w], COR_BOCA)
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3))
  g.setIndex(ix)
  g.computeVertexNormals()
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide })
  const malha = new THREE.Mesh(g, mat)
  malha.name = 'caverna:reserva'
  malha.frustumCulled = false
  group.add(malha)

  return {
    group, camaras, volumeM3: Math.round(volume), triangulos: ix.length / 3,
    dispose() { g.dispose(); mat.dispose(); group.clear() },
  }
}
