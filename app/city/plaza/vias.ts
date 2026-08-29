// ═══════════════════════════════════════════════════════════════════════════
// AS VIAS: a rua da DogCity, que até 29/08/2026 não existia.
//
// ⚠️ O DIAGNÓSTICO QUE ORIGINOU ESTE ARQUIVO. O levantamento mediu a cena com
// ?tecido=1 e achou o motivo de o loteamento parecer amador, e não era
// acabamento, era ausência: as únicas ruas com geometria eram os 12 bulevares de
// costura. Tudo que se lia como "rua" dentro dos quarteirões era o VÃO entre os
// plintos dos lotes, o recuo de 1,4 m de tecido.ts. Sem calçada, sem meio-fio,
// sem travessa, sem esquina. Um loteamento sem via desenhada é uma mancha com
// frestas, e é isso que a chapa mostrava.
//
// A referência (maqueteiros de masterplan: RJ Models, Artistic Models, Pipers)
// diz que em maquete a rua é o que se GRAVA, e o limite de lote é implícito. Por
// isso aqui a pista é mais ESCURA que o regolito e a calçada é mais CLARA que o
// lote: de cima a malha viária vira uma teia desenhada, com fio claro na borda e
// miolo escuro, que é como um plano de massas se lê numa prancha.
//
// Toda a geometria sai de public/city/cidade-malha.json, que o gerador publica:
// 1.182 quarteirões com centro, lado e GIRO, mais os 12 bulevares. Nada aqui é
// inventado; se o gerador mudar a malha, a rua muda junto.
//
// Três seções, todas em constantes.* do mesmo json:
//   contorno  12 m  em volta de cada quarteirão (6 m por quarteirão, ver abaixo)
//   travessa   9 m  duas por quarteirão, em z local [-34,-25] e [25,34]
//   bulevar   34 m  12 raios sobre a costura de setor, com canteiro central
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { LIMIAR_PRACA } from './pracas'

export interface ViasOpts {
  heightAt: (x: number, z: number) => number
  /** sombra própria no meio-fio: dá relevo à guia e custa pouco */
  sombra?: boolean
}

export interface Vias {
  group: THREE.Group
  quarteiroes: number
  pracas: number
  bulevares: number
  triangulos: number
  metrosDeVia: number
  dispose(): void
}

// ⚠️ AS COTAS SÃO O QUE FAZ A RUA TER SEÇÃO E NÃO SER UM ADESIVO. O plinto do
// lote em tecido.ts tem 0,45 m; a calçada fica 0,12 abaixo dele e a pista 0,15
// abaixo da calçada. Esses 15 cm são o meio-fio residencial universal dos EUA
// (6 in), o único número de guia que a pesquisa achou em fonte primária.
const Y_PISTA = 0.18
const Y_CALCADA = 0.33
const Y_CANTEIRO = 0.40

// Paleta: a pista é o valor mais escuro da cidade e a calçada o mais claro. O
// lote (PEDRA em tecido.ts) fica entre os dois de propósito, senão a teia some.
const COR_PISTA = '#57534B'
const COR_CALCADA = '#CBC4B6'
const COR_MEIOFIO = '#8F8879'
const COR_CANTEIRO = '#4A5C3E'

type Alvo = 'pista' | 'calcada' | 'canteiro' | 'meiofio'

/** uma faixa da seção: de/até em metros a partir da borda t=0, na cota alt */
interface Banda { de: number; ate: number; alt: number; alvo: Alvo }

// Seção do meio contorno: o quarteirão tem lado 168 e a célula 180, então sobram
// 12 m entre dois quarteirões vizinhos. ⚠️ CADA QUARTEIRÃO DESENHA SÓ A SUA
// METADE (6 m, da borda 84 até 90); o vizinho desenha a outra e as duas se
// encontram exatamente em 90. Desenhar os 12 m inteiros duplicaria a via em toda
// divisa e o z-fighting apareceria como listra piscando na chapa.
const SEC_CONTORNO: Banda[] = [
  { de: 0.0, ate: 2.5, alt: Y_CALCADA, alvo: 'calcada' },
  { de: 2.5, ate: 6.0, alt: Y_PISTA, alvo: 'pista' },
]
// Travessa de 9 m, seção inteira (ela não é compartilhada com ninguém)
const SEC_TRAVESSA: Banda[] = [
  { de: 0.0, ate: 1.5, alt: Y_CALCADA, alvo: 'calcada' },
  { de: 1.5, ate: 7.5, alt: Y_PISTA, alvo: 'pista' },
  { de: 7.5, ate: 9.0, alt: Y_CALCADA, alvo: 'calcada' },
]
// Bulevar de 34 m com canteiro central: 5 + 10 + 4 + 10 + 5. O canteiro não é
// enfeite, é onde a arborização de eixo vai plantar quando ela existir.
const SEC_BULEVAR: Banda[] = [
  { de: 0.0, ate: 5.0, alt: Y_CALCADA, alvo: 'calcada' },
  { de: 5.0, ate: 15.0, alt: Y_PISTA, alvo: 'pista' },
  { de: 15.0, ate: 19.0, alt: Y_CANTEIRO, alvo: 'canteiro' },
  { de: 19.0, ate: 29.0, alt: Y_PISTA, alvo: 'pista' },
  { de: 29.0, ate: 34.0, alt: Y_CALCADA, alvo: 'calcada' },
]

interface Quarteirao {
  id: string; setor: number; x: number; z: number; r: number
  giro: number; lado: number; lotes: number
}
interface Bulevar {
  id: string; rumo: number; largura: number
  x0: number; z0: number; x1: number; z1: number
}
interface Peca { x: number; z: number; a: number; b: number; rot: number }
interface Quarto {
  id: string; x: number; z: number; giro: number; pracaFracLivre: number
}
interface Malha {
  constantes: {
    setores: number; giroPorSetor: number; quarteirao: number; viaContorno: number
    bulevar: number; raioSitio: number
    travessas: { z0: number; z1: number }[]
  }
  bulevares: Bulevar[]
  quarteiroes: Quarteirao[]
  quartos: Quarto[]
}

/** acumulador de triângulos por alvo: uma malha por material no fim */
class Fita {
  vs: number[] = []
  ix: number[] = []
  add(ax: number, ay: number, az: number, bx: number, by: number, bz: number,
      cx: number, cy: number, cz: number, dx: number, dy: number, dz: number) {
    const b = this.vs.length / 3
    this.vs.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz)
    this.ix.push(b, b + 1, b + 2, b, b + 2, b + 3)
  }
  get triangulos() { return this.ix.length / 3 }
}

export async function buildVias(o: ViasOpts): Promise<Vias> {
  const [malha, meta] = await Promise.all([
    fetch('/city/cidade-malha.json').then((r) => r.json() as Promise<Malha>),
    fetch('/city/cidade.json').then((r) => r.json() as Promise<{ programa: Peca[]; raioBorda: number }>),
  ])
  const K = malha.constantes
  const meio = K.quarteirao / 2          // 84
  const group = new THREE.Group()
  group.name = 'vias'

  // ── as duas máscaras que a via tem de respeitar ───────────────────────────
  // (1) as 38 peças do programa: lago, estádio e alfândega já ocupam o chão, e
  //     rua atravessando lago é o erro que a chapa mostra de longe. 26 centros de
  //     quarteirão caem dentro de peça, então o corte tem de ser por SEGMENTO e
  //     não por quarteirão inteiro.
  const pecas = (meta.programa ?? []).map((p) => {
    const rot = (-p.rot * Math.PI) / 180
    return { x: p.x, z: p.z, a: p.a, b: p.b, ca: Math.cos(rot), sa: Math.sin(rot), rr: Math.max(p.a, p.b) ** 2 }
  })
  const emPeca = (px: number, pz: number) => {
    for (const p of pecas) {
      const dx = px - p.x, dz = pz - p.z
      if (dx * dx + dz * dz > p.rr) continue
      const lx = dx * p.ca - dz * p.sa, lz = dx * p.sa + dz * p.ca
      if ((lx / p.a) ** 2 + (lz / p.b) ** 2 <= 1) return true
    }
    return false
  }
  // (2) o corredor dos 12 bulevares. Os quarteirões giram com o setor, então na
  //     costura a grade de um setor não casa com a do vizinho e a via de contorno
  //     entraria por baixo do bulevar. Duas faixas coplanares brigam no z-buffer
  //     e a chapa mostra a briga.
  const meiaBul = K.bulevar / 2 + 3
  const noBulevar = (px: number, pz: number) => {
    const r = Math.hypot(px, pz)
    if (r < 40) return true
    for (let s = 0; s < K.setores; s++) {
      const ang = (s * (2 * Math.PI)) / K.setores
      const dirX = Math.sin(ang), dirZ = -Math.cos(ang)
      const proj = px * dirX + pz * dirZ
      if (proj <= 0) continue
      if (Math.abs(px * Math.cos(ang) + pz * Math.sin(ang)) < meiaBul) return true
    }
    return false
  }
  const rMax = (meta.raioBorda ?? 4400) + 10
  // vão máximo de uma face de via, em metros: ver a nota em faixa()
  const PASSO = 18

  const fitas: Record<Alvo, Fita> = {
    pista: new Fita(), calcada: new Fita(), canteiro: new Fita(), meiofio: new Fita(),
  }
  let metros = 0

  // ── o gerador de faixa: um eixo, uma seção, o relevo de verdade ───────────
  // A linha t=0 é a BORDA da via, não o eixo: é assim que a seção fica escrita
  // como "de 0 até 2,5 é calçada", que é como um projeto de via se lê.
  // pular(x,z) decide segmento a segmento; quando um segmento cai fora, a seção
  // inteira cai junto, senão a calçada continuaria dentro do lago sem a pista.
  const faixa = (
    ax: number, az: number, bx: number, bz: number,
    perpX: number, perpZ: number, secao: Banda[],
    respeitaBulevar = true,
  ) => {
    // ⚠️ O PASSO SAI DO COMPRIMENTO, E ISTO FOI MEDIDO, NÃO ESTIMADO. Com 4
    // passos fixos o lado de 168 m virava trechos de 42 m, e uma faixa plana de
    // 42 m passa POR BAIXO da lombada do regolito no meio do vão: sonda de 4.000
    // pontos achou terreno furando a PISTA em 12,7% das amostras, até 1,00 m
    // acima dela, e a calçada em 5,5%. Não adianta subir a cota (a pista tem de
    // ficar abaixo da calçada, que tem de ficar abaixo do plinto de 0,45): o
    // conserto é encurtar a corda, e o erro cai com o QUADRADO do vão.
    const comp = Math.hypot(bx - ax, bz - az)
    const passos = Math.max(2, Math.ceil(comp / PASSO))
    const larg = secao[secao.length - 1].ate
    const meioSec = larg / 2
    for (let k = 0; k < passos; k++) {
      const t0 = k / passos, t1 = (k + 1) / passos
      const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0
      const x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1
      const mx = (x0 + x1) / 2 + perpX * meioSec, mz = (z0 + z1) / 2 + perpZ * meioSec
      if (Math.hypot(mx, mz) > rMax || emPeca(mx, mz)) continue
      if (respeitaBulevar && noBulevar(mx, mz)) continue
      metros += Math.hypot(x1 - x0, z1 - z0)
      for (let i = 0; i < secao.length; i++) {
        const s = secao[i]
        const pax = x0 + perpX * s.de, paz = z0 + perpZ * s.de
        const pbx = x0 + perpX * s.ate, pbz = z0 + perpZ * s.ate
        const pcx = x1 + perpX * s.ate, pcz = z1 + perpZ * s.ate
        const pdx = x1 + perpX * s.de, pdz = z1 + perpZ * s.de
        fitas[s.alvo].add(
          pax, o.heightAt(pax, paz) + s.alt, paz,
          pbx, o.heightAt(pbx, pbz) + s.alt, pbz,
          pcx, o.heightAt(pcx, pcz) + s.alt, pcz,
          pdx, o.heightAt(pdx, pdz) + s.alt, pdz,
        )
        // a face vertical do meio-fio, no degrau entre esta banda e a próxima
        const prox = secao[i + 1]
        if (prox && prox.alt !== s.alt) {
          const alto = Math.max(s.alt, prox.alt), baixo = Math.min(s.alt, prox.alt)
          const h0 = o.heightAt(pbx, pbz), h1 = o.heightAt(pcx, pcz)
          fitas.meiofio.add(
            pbx, h0 + baixo, pbz, pbx, h0 + alto, pbz,
            pcx, h1 + alto, pcz, pcx, h1 + baixo, pcz,
          )
        }
      }
    }
  }

  // ── 1. via de contorno e travessas, quarteirão a quarteirão ───────────────
  // ⚠️ OS LADOS ±z CORREM 6 m A MAIS DE CADA PONTA e os lados ±x param na borda.
  // É o que resolve a esquina sem sobrepor duas faixas: a calçada dobra a esquina
  // pelo lado ±z e o lado ±x encosta nela. Se os quatro lados corressem até 90 as
  // quatro esquinas teriam faixa dupla.
  let nq = 0
  for (const q of malha.quarteiroes) {
    const g = (q.giro * Math.PI) / 180
    const cg = Math.cos(g), sg = Math.sin(g)
    const mundo = (lx: number, lz: number) => [q.x + lx * cg - lz * sg, q.z + lx * sg + lz * cg] as const
    const dir = (lx: number, lz: number) => [lx * cg - lz * sg, lx * sg + lz * cg] as const
    nq++

    // os quatro lados: [borda local, perpendicular local, extensão nas pontas]
    const lados: [readonly [number, number], readonly [number, number], readonly [number, number]][] = [
      [[-meio - 6, +meio], [+meio + 6, +meio], [0, 1]],   // +z, esticado
      [[+meio + 6, -meio], [-meio - 6, -meio], [0, -1]],  // -z, esticado
      [[+meio, -meio], [+meio, +meio], [1, 0]],           // +x
      [[-meio, +meio], [-meio, -meio], [-1, 0]],          // -x
    ]
    for (const [a, b, p] of lados) {
      const [ax, az] = mundo(a[0], a[1])
      const [bx, bz] = mundo(b[0], b[1])
      const [px, pz] = dir(p[0], p[1])
      faixa(ax, az, bx, bz, px, pz, SEC_CONTORNO)
    }
    // as duas travessas internas: a seção inteira cabe entre z local -34 e -25
    for (const t of K.travessas) {
      const [ax, az] = mundo(-meio, t.z0)
      const [bx, bz] = mundo(+meio, t.z0)
      const [px, pz] = dir(0, 1)
      faixa(ax, az, bx, bz, px, pz, SEC_TRAVESSA)
    }
  }

  // ── 1b. a via em volta da praça de quarto ─────────────────────────────────
  // A célula central de cada quarto não é quarteirão e por isso não entrou no
  // laço acima, mas ela é uma célula de 180 como qualquer outra: sem esta volta
  // a rua morre na divisa da praça e a praça vira um pátio cercado de nada. O
  // limiar vem de pracas.ts para os dois módulos nunca discordarem.
  let np = 0
  for (const q of malha.quartos ?? []) {
    if (q.pracaFracLivre < LIMIAR_PRACA) continue
    if (Math.hypot(q.x, q.z) >= rMax) continue
    np++
    const g = (q.giro * Math.PI) / 180
    const cg = Math.cos(g), sg = Math.sin(g)
    const mundo = (lx: number, lz: number) => [q.x + lx * cg - lz * sg, q.z + lx * sg + lz * cg] as const
    const dir = (lx: number, lz: number) => [lx * cg - lz * sg, lx * sg + lz * cg] as const
    const lados: [readonly [number, number], readonly [number, number], readonly [number, number]][] = [
      [[-meio - 6, +meio], [+meio + 6, +meio], [0, 1]],
      [[+meio + 6, -meio], [-meio - 6, -meio], [0, -1]],
      [[+meio, -meio], [+meio, +meio], [1, 0]],
      [[-meio, +meio], [-meio, -meio], [-1, 0]],
    ]
    for (const [a, b, pp] of lados) {
      const [ax, az] = mundo(a[0], a[1])
      const [bx, bz] = mundo(b[0], b[1])
      const [px, pz] = dir(pp[0], pp[1])
      faixa(ax, az, bx, bz, px, pz, SEC_CONTORNO)
    }
  }

  // ── 2. os 12 bulevares de costura ─────────────────────────────────────────
  // ⚠️ ELES SAEM DE tecido.ts E PASSAM A MORAR AQUI. Lá a pista era desenhada
  // ACIMA do meio-fio (pista em +0,45 e guia em +0,30), ou seja a seção estava de
  // cabeça para baixo e a via ficava um planalto claro com moldura escura. Se os
  // dois módulos desenharem bulevar ao mesmo tempo as faixas brigam no z-buffer.
  for (const b of malha.bulevares) {
    const ang = (b.rumo * Math.PI) / 180
    const perpX = Math.cos(ang), perpZ = Math.sin(ang)
    const larg = b.largura ?? K.bulevar
    const esc = larg / SEC_BULEVAR[SEC_BULEVAR.length - 1].ate
    const secao = esc === 1 ? SEC_BULEVAR : SEC_BULEVAR.map((s) => ({ ...s, de: s.de * esc, ate: s.ate * esc }))
    // a linha t=0 é a borda esquerda: recua meia largura do eixo
    faixa(b.x0 - perpX * larg / 2, b.z0 - perpZ * larg / 2,
          b.x1 - perpX * larg / 2, b.z1 - perpZ * larg / 2,
          perpX, perpZ, secao, false)
  }

  // ── 3. uma malha por material ─────────────────────────────────────────────
  const cores: Record<Alvo, string> = {
    pista: COR_PISTA, calcada: COR_CALCADA, canteiro: COR_CANTEIRO, meiofio: COR_MEIOFIO,
  }
  const feitas: THREE.Mesh[] = []
  let triangulos = 0
  for (const alvo of ['pista', 'calcada', 'canteiro', 'meiofio'] as Alvo[]) {
    const f = fitas[alvo]
    if (!f.ix.length) continue
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(f.vs, 3))
    g.setIndex(f.ix)
    g.computeVertexNormals()
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      color: cores[alvo],
      roughness: alvo === 'canteiro' ? 0.95 : 1,
      metalness: 0,
    }))
    m.name = `via:${alvo}`
    m.receiveShadow = true
    // só a guia projeta sombra: é o que dá relevo à seção. Pista e calçada são
    // chão e sombra de chão sobre chão é só ruído.
    m.castShadow = alvo === 'meiofio' ? (o.sombra ?? true) : false
    m.frustumCulled = false
    group.add(m)
    feitas.push(m)
    triangulos += f.triangulos
  }

  return {
    group,
    quarteiroes: nq,
    pracas: np,
    bulevares: malha.bulevares.length,
    triangulos,
    metrosDeVia: Math.round(metros),
    dispose() {
      for (const m of feitas) {
        m.geometry.dispose()
        ;(m.material as THREE.Material).dispose()
      }
      group.clear()
    },
  }
}
