// ═══════════════════════════════════════════════════════════════════════════
// AS PEÇAS DO PROGRAMA, cada uma com desenho próprio.
//
// ⚠️ ELIPSE NÃO É PROJETO. A primeira versão desenhava as 38 peças como chapas
// ovais coloridas: estádio, lago, jardim botânico e alfândega saíam com a mesma
// forma e o mesmo tamanho de adesivo. O fundador viu e disse o que era: espaço
// extra sem o menor projeto específico.
//
// Aqui cada TIPO ganha uma tipologia de verdade, ainda em registro de massa
// (volume sem fachada), porque o fundador travou que se demarca agora e se
// constrói depois:
//
//   agua          margem irregular, sem simetria, com praia clara em volta
//   esporte       arquibancada em anel escalonado, com pista ou campo dentro
//   jardim        parterre com eixos, canteiros e alameda de árvores
//   civico        adro na frente e volume recuado atrás
//   distribuicao  pátio industrial com fileiras de contêiner e galpão
//
// A geometria sai de `PROGRAMA` em scripts/gerar_cidade.py, publicada em
// public/city/cidade.json: id, tipo, centro, meios-eixos e rotação.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { MODULOS } from './pecas/index'
import { Prancheta, type Ctx, type Cova } from './pecas/kit'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export interface Peca {
  id: string; nome: string; tipo: string
  x: number; z: number; a: number; b: number; rot: number; ha: number; forma?: string
}

const COR = {
  agua: '#1E3A52', praia: '#8E856F', grama: '#3E5F42', sebe: '#2F4A34',
  pista: '#8C4B3A', campo: '#3F6B44', arquibancada: '#B9B2A4', concreto: '#C6BEB0',
  asfalto: '#4A443C', conteiner: '#7C6A55', galpao: '#A9A092', adro: '#B4AC9E',
}

/** ruído determinístico: a peça é a mesma em toda visita */
function ruido(seed: number, k: number): number {
  let t = (seed * 2654435761 + k * 40503) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
function semente(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/** caixa deitada no plano local da peça */
function caixa(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d)
  g.translate(x, y + h / 2, z)
  return g
}

/** anel escalonado: a arquibancada, e é ela que faz estádio parecer estádio */
function arquibancada(a: number, b: number, degraus: number, esp: number, piso: number): THREE.BufferGeometry {
  const pos: number[] = []; const idx: number[] = []
  const SEG = 72
  const perfil: [number, number][] = [[0, 0]]
  for (let k = 0; k < degraus; k++) {
    perfil.push([(k + 1) * piso, k * esp])
    perfil.push([(k + 1) * piso, (k + 1) * esp])
  }
  let ant: number[] | null = null
  for (let i = 0; i <= SEG; i++) {
    const t = (i / SEG) * Math.PI * 2
    const ct = Math.cos(t), st = Math.sin(t)
    const col: number[] = []
    for (const [d, y] of perfil) {
      col.push(pos.length / 3)
      pos.push((a + d) * ct, y, (b + d) * st)
    }
    if (ant) for (let k = 0; k < col.length - 1; k++) {
      idx.push(ant[k], col[k], col[k + 1]); idx.push(ant[k], col[k + 1], ant[k + 1])
    }
    ant = col
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx); g.computeVertexNormals()
  return g
}

/** disco irregular: margem de lago, que não pode ser elipse */
function margem(a: number, b: number, seed: number, escala: number): THREE.Shape {
  const s = new THREE.Shape()
  const N = 64
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2
    // três harmônicos com fase sorteada: dá reentrância e ponta sem virar estrela
    const r = 1
      + 0.16 * Math.sin(3 * t + ruido(seed, 1) * 6.28)
      + 0.10 * Math.sin(5 * t + ruido(seed, 2) * 6.28)
      + 0.06 * Math.sin(8 * t + ruido(seed, 3) * 6.28)
    const x = Math.cos(t) * a * r * escala
    const z = Math.sin(t) * b * r * escala
    if (i === 0) s.moveTo(x, z); else s.lineTo(x, z)
  }
  return s
}

function chapaDaForma(shape: THREE.Shape, y: number): THREE.BufferGeometry {
  const g = new THREE.ShapeGeometry(shape, 12)
  g.rotateX(-Math.PI / 2)
  g.translate(0, y, 0)
  return g
}

interface Parte { geo: THREE.BufferGeometry; cor: string; agua?: boolean }

/** Devolve as partes de uma peça, no plano local dela (x para a frente, z para o lado). */
function desenhar(p: Peca): Parte[] {
  const seed = semente(p.id)
  const a = p.a, b = p.b
  const partes: Parte[] = []

  // ⚠️ A PARCELA VEM ANTES DO DESENHO (29/08). A peça deixou de ser elipse solta
  // e virou retângulo de células da malha, então a primeira coisa que ela tem é
  // um CHÃO com a forma da reserva: recuado 6 m de cada lado, que é a metade da
  // via de contorno de 12 m que ela divide com o quarteirão vizinho.
  // ⚠️ Isto NÃO é o projeto da peça, é a parcela. Enquanto o desenho próprio de
  // cada uma não existir, o que se vê é um pátio com um objeto genérico dentro,
  // e é assim que tem de ler: terra demarcada, obra não projetada. As duas peças
  // da casca (Portão e Farol) continuam elipse e não ganham parcela.
  if (p.forma === 'retangulo') {
    const q = new THREE.Shape()
    q.moveTo(-a + 6, -b + 6); q.lineTo(a - 6, -b + 6)
    q.lineTo(a - 6, b - 6);   q.lineTo(-a + 6, b - 6); q.closePath()
    partes.push({ geo: chapaDaForma(q, 0.18), cor: p.tipo === 'jardim' || p.tipo === 'esporte' ? COR.grama : COR.adro })
  }

  if (p.tipo === 'agua') {
    // ⚠️ LAGO NÃO É ELIPSE. Margem por soma de harmônicos, praia clara por fora,
    // e a lâmina afundada, senão a água fica flutuando sobre o regolito.
    // ⚠️ A ÁGUA VAI POR CIMA DA PRAIA. A praia é uma chapa CHEIA, não um anel, e
    // desenhada mais alto ela tampava o lago inteiro: o resultado era uma mancha
    // de areia com uma ilha no meio e nenhuma água à vista.
    partes.push({ geo: chapaDaForma(margem(a, b, seed, 1.10), 0.4), cor: COR.praia })
    partes.push({ geo: chapaDaForma(margem(a, b, seed, 1.0), 0.9), cor: COR.agua, agua: true })
    // uma ilha, quando o lago é grande o bastante para ter uma
    if (a > 250) {
      const ilha = margem(a * 0.16, b * 0.16, seed + 7, 1)
      const g = chapaDaForma(ilha, 1.5)
      g.translate(a * 0.22, 0, -b * 0.18)
      partes.push({ geo: g, cor: COR.grama })
    }
    return partes
  }

  if (p.tipo === 'esporte') {
    const olimpico = p.nome.includes('Olímpico')
    const futebol = p.nome.includes('Futebol')
    if (olimpico || futebol) {
      // campo ou pista dentro, arquibancada escalonada em volta
      const ia = a * 0.62, ib = b * 0.62
      partes.push({ geo: arquibancada(ia, ib, 9, 1.8, (a - ia) / 9), cor: COR.arquibancada })
      if (olimpico) {
        partes.push({ geo: chapaDaForma(new THREE.Shape().absellipse(0, 0, ia, ib, 0, Math.PI * 2, false, 0), 0.5), cor: COR.pista })
        partes.push({ geo: chapaDaForma(new THREE.Shape().absellipse(0, 0, ia * 0.62, ib * 0.62, 0, Math.PI * 2, false, 0), 0.7), cor: COR.campo })
      } else {
        partes.push({ geo: caixa(ia * 1.5, 0.5, ib * 1.4, 0, 0.2, 0), cor: COR.campo })
      }
      return partes
    }
    // ginásio, complexo aquático e skatepark: laje e volume
    partes.push({ geo: chapaDaForma(new THREE.Shape().absellipse(0, 0, a, b, 0, Math.PI * 2, false, 0), 0.4), cor: COR.concreto })
    if (p.nome.includes('Aquático')) {
      for (let i = 0; i < 3; i++) {
        partes.push({ geo: caixa(a * 0.9, 0.6, b * 0.22, 0, 0.5, (i - 1) * b * 0.4), cor: COR.agua, agua: true })
      }
    } else {
      partes.push({ geo: caixa(a * 1.1, p.nome.includes('Ginásio') ? 16 : 4, b * 1.1, 0, 0.6, 0), cor: COR.concreto })
    }
    return partes
  }

  if (p.tipo === 'jardim') {
    // parterre: gramado, dois eixos cruzados e canteiros de sebe
    partes.push({ geo: chapaDaForma(new THREE.Shape().absellipse(0, 0, a, b, 0, Math.PI * 2, false, 0), 0.4), cor: COR.grama })
    partes.push({ geo: caixa(a * 2, 0.3, 9, 0, 0.5, 0), cor: COR.adro })
    partes.push({ geo: caixa(9, 0.3, b * 2, 0, 0.5, 0), cor: COR.adro })
    const nx = 3, nz = 2
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const w = (a * 0.62) / nx, d = (b * 0.62) / nz
        partes.push({
          geo: caixa(w * 0.72, 1.6, d * 0.72,
            sx * (a * 0.20 + i * w), 0.6, sz * (b * 0.22 + j * d)),
          cor: COR.sebe,
        })
      }
    }
    return partes
  }

  if (p.tipo === 'distribuicao') {
    const central = p.nome.includes('Central')
    partes.push({ geo: chapaDaForma(new THREE.Shape().absellipse(0, 0, a, b, 0, Math.PI * 2, false, 0), 0.4), cor: COR.asfalto })
    if (central) {
      // depósito de setor: galpão com plataforma
      partes.push({ geo: caixa(a * 1.1, 11, b * 0.9, 0, 0.5, 0), cor: COR.galpao })
      partes.push({ geo: caixa(a * 1.3, 1.2, b * 0.28, 0, 0.5, b * 0.62), cor: COR.concreto })
      return partes
    }
    // portão, alfândega e pátio: fileiras de contêiner
    const linhas = Math.max(2, Math.round(b / 26))
    const porLinha = Math.max(3, Math.round(a / 22))
    for (let i = 0; i < linhas; i++) for (let j = 0; j < porLinha; j++) {
      const alt = 2.6 + Math.round(ruido(seed, i * 31 + j) * 2) * 2.6
      partes.push({
        geo: caixa(12, alt, 5.2,
          (j - (porLinha - 1) / 2) * (a * 1.7 / porLinha),
          0.5,
          (i - (linhas - 1) / 2) * (b * 1.5 / linhas)),
        cor: COR.conteiner,
      })
    }
    partes.push({ geo: caixa(a * 0.5, 14, b * 0.4, -a * 0.6, 0.5, 0), cor: COR.galpao })
    return partes
  }

  // cívico: adro na frente, volume recuado atrás
  partes.push({ geo: chapaDaForma(new THREE.Shape().absellipse(0, 0, a, b, 0, Math.PI * 2, false, 0), 0.4), cor: COR.adro })
  const alt = 10 + ruido(seed, 5) * 18
  partes.push({ geo: caixa(a * 1.0, alt, b * 0.8, a * 0.18, 0.6, 0), cor: COR.concreto })
  partes.push({ geo: caixa(a * 0.5, 2.0, b * 1.2, -a * 0.5, 0.6, 0), cor: COR.adro })
  return partes
}

export interface PecasConstruidas {
  /** covas de árvore que as peças pediram, em coordenadas de MUNDO */
  covas: Cova[]
  group: THREE.Group
  triangulos: number
  dispose(): void
}

export function buildPecas(pecas: Peca[], heightAt: (x: number, z: number) => number): PecasConstruidas {
  const group = new THREE.Group()
  group.name = 'pecas'
  // junta por COR, não por peça: 38 peças com 5 partes cada dariam 190 draw
  // calls, e a cena tem orçamento medido de poucas dezenas
  const porCor = new Map<string, { geos: THREE.BufferGeometry[]; agua: boolean }>()
  const covas: Cova[] = []
  let triangulos = 0

  for (const p of pecas) {
    const rot = -THREE.MathUtils.degToRad(p.rot)
    const c = Math.cos(rot), s = Math.sin(rot)
    const y = heightAt(p.x, p.z)

    // ── peça com projeto próprio ─────────────────────────────────────────
    // ⚠️ ELA NÃO GANHA O `y` DA PEÇA, E ISSO É O PONTO. `buildPecas` assenta a
    // peça numa altura só, a do CENTRO. Numa elipse de 175 m passava; num
    // Parque Olímpico de 1.080 m uma ponta enterra e a outra flutua metros
    // acima do regolito. O módulo amostra a altura de verdade ponto a ponto
    // (Prancheta faz isso), devolve Y de MUNDO, e aqui só se gira e translada
    // no plano. Ver a armadilha C em pecas/kit.ts.
    const modulo = MODULOS[p.id]
    if (modulo) {
      const rr = THREE.MathUtils.degToRad(p.rot)
      const cr = Math.cos(rr), sr = Math.sin(rr)
      const ctx: Ctx = {
        id: p.id, nome: p.nome, tipo: p.tipo, a: p.a, b: p.b,
        alt: (lx, lz) => heightAt(p.x + lx * cr - lz * sr, p.z + lx * sr + lz * cr),
        ruido: (k) => { const t = Math.sin(semente(p.id) * 12.9898 + k * 78.233) * 43758.5453; return t - Math.floor(t) },
      }
      const d = modulo(ctx)
      for (const parte of d.partes) {
        const m = new THREE.Matrix4().makeRotationY(rot)
        m.setPosition(p.x, 0, p.z)          // ⚠️ Y ZERO: o módulo já traz o de mundo
        parte.geo.applyMatrix4(m)
        const chave = parte.cor + (parte.agua ? '|agua' : '')
        if (!porCor.has(chave)) porCor.set(chave, { geos: [], agua: !!parte.agua })
        porCor.get(chave)!.geos.push(parte.geo)
        triangulos += (parte.geo.index ? parte.geo.index.count : parte.geo.attributes.position.count) / 3
      }
      for (const cv of d.covas) {
        covas.push({ x: p.x + cv.x * cr - cv.z * sr, z: p.z + cv.x * sr + cv.z * cr, r: cv.r })
      }
      continue
    }

    for (const parte of desenhar(p)) {
      const g = parte.geo
      // do plano local da peça para o mundo
      const m = new THREE.Matrix4().makeRotationY(rot)
      m.setPosition(p.x, y, p.z)
      g.applyMatrix4(m)
      void c; void s
      const chave = parte.cor + (parte.agua ? '|agua' : '')
      if (!porCor.has(chave)) porCor.set(chave, { geos: [], agua: !!parte.agua })
      porCor.get(chave)!.geos.push(g)
      triangulos += (g.index ? g.index.count : g.attributes.position.count) / 3
    }
  }

  const materiais: THREE.Material[] = []
  const geometrias: THREE.BufferGeometry[] = []
  porCor.forEach(({ geos, agua }, chave) => {
    const fundido = mergeGeometries(geos, false)
    geos.forEach((g: THREE.BufferGeometry) => g.dispose())
    if (!fundido) return
    geometrias.push(fundido)
    const mat = new THREE.MeshStandardMaterial({
      color: chave.split('|')[0],
      roughness: agua ? 0.14 : 0.92,
      metalness: agua ? 0.3 : 0.0,
    })
    materiais.push(mat)
    const malha = new THREE.Mesh(fundido, mat)
    malha.receiveShadow = true
    malha.frustumCulled = false
    group.add(malha)
  })

  return {
    group,
    covas,
    triangulos,
    dispose() {
      geometrias.forEach((g: THREE.BufferGeometry) => g.dispose())
      materiais.forEach((m: THREE.Material) => m.dispose())
    },
  }
}
