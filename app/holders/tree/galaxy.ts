// Matematica pura da galaxia genealogica do DOG: tipos do contrato da API,
// hashes deterministicos e o mapa de posicao das conchas orbitais.
// Sem three aqui de proposito: tudo testavel e livre de DOM.
//
// REGRA DE OURO: nada de Math.random em posicao. Recarregar a pagina
// NUNCA pode rearrumar o ceu, entao toda coordenada nasce de hash
// do endereco (ou do indice, no caso da poeira decorativa).

// ── contrato da API (/api/holders/tree e irmas) ──────────────────────────────
export interface TreeNode {
  w: string
  p: string | null
  d: number
  b: number
  h: boolean
  c: number
  sw: number
  sh: number
  sb: number
  fb: number
  label?: { name: string; source: string }
}

export interface GenStat {
  depth: number
  wallets: number
  holders: number
}

export interface TreeResponse {
  root: TreeNode
  nodes: TreeNode[]
  gens: GenStat[]
}

// O enriquecimento (depth/saldos/subarvores) roda em paralelo no Supabase,
// entao qualquer campo numerico pode chegar null durante o dev: saneia tudo
// na entrada pra cena nunca ver NaN.
export function sanitizeNode(raw: Partial<TreeNode> & { w: string }): TreeNode {
  return {
    w: raw.w,
    p: raw.p ?? null,
    d: typeof raw.d === 'number' && Number.isFinite(raw.d) ? raw.d : 0,
    b: typeof raw.b === 'number' && Number.isFinite(raw.b) ? raw.b : 0,
    h: !!raw.h,
    c: typeof raw.c === 'number' && Number.isFinite(raw.c) ? raw.c : 0,
    sw: typeof raw.sw === 'number' && Number.isFinite(raw.sw) ? raw.sw : 0,
    sh: typeof raw.sh === 'number' && Number.isFinite(raw.sh) ? raw.sh : 0,
    sb: typeof raw.sb === 'number' && Number.isFinite(raw.sb) ? raw.sb : 0,
    fb: typeof raw.fb === 'number' && Number.isFinite(raw.fb) ? raw.fb : 0,
    label: raw.label,
  }
}

// ── conchas orbitais ─────────────────────────────────────────────────────────
// ⚠️ a profundidade REAL vai a 1663 (correntes de mão em mão medidas na
// tabela); linear, a concha 1663 ficaria a 36 km do sol e o voo até um nó
// fundo levaria a câmera pro nada. Linear até a geração 24 (97%+ do universo)
// e compressão logarítmica dali em diante: fundo continua MAIS LONGE, mas em
// escala visitável.
// 2026-08-26: passo de 22 para 34 e base de 26 para 30 a pedido do fundador:
// as conchas se afastam, as estrelas se separam e da pra navegar ate UMA.
// 26/08 v3: base 48 e passo 42 ("aumentar a distancia tambem ajuda",
// fundador): G1 esferica em r=90 respira e o leque do airdrop abre.
export const SHELL_BASE = 48
export const SHELL_STEP = 42
const SHELL_LINEAR_MAX = 24
export const shellRadius = (depth: number) => {
  const d = Math.max(0, depth)
  if (d <= SHELL_LINEAR_MAX) return SHELL_BASE + d * SHELL_STEP
  return SHELL_BASE + SHELL_LINEAR_MAX * SHELL_STEP + Math.log2(1 + d - SHELL_LINEAR_MAX) * SHELL_STEP * 2.4
}

// FNV-1a com sal e avalanche final: distribui bem enderecos bech32
// (prefixo repetido bc1p...) sem aglomerar num gomo da concha.
export function hash01(s: string, salt: number): number {
  let h = 0x811c9dc5 ^ Math.imul(salt + 1, 0x9e3779b1)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  h ^= h >>> 15
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  return (h >>> 0) / 4294967296
}

// Hash numerico pra poeira decorativa (semente = indice do grao, nunca random).
export function hashIdx(i: number, salt: number): number {
  let h = (i | 0) ^ Math.imul(salt + 91, 0x27d4eb2f)
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39)
  h ^= h >>> 15
  return (h >>> 0) / 4294967296
}

export interface Vec3Like {
  x: number
  y: number
  z: number
}

// Posicao padrao de um no do esqueleto: angulo por hash do endereco,
// leve respiro radial (a concha nao vira um anel perfeito) e
// espalhamento vertical de +-12 tambem por hash.
export function nodePosition(w: string, depth: number, out: Vec3Like): Vec3Like {
  if (depth <= 0) {
    out.x = 0
    out.y = 0
    out.z = 0
    return out
  }
  // ESFERICA (pedido do fundador, 26/08): cada geracao e uma CASCA de
  // esfera, nao um anel fino. Espalha a mesma populacao por 4*pi*r*r em
  // vez de uma fita: o leque do airdrop deixa de empilhar num disco e as
  // cascas vistas de fora ganham brilho de borda (os aneis viram
  // circulos de silhueta). phi = acos(1 - 2h) e a distribuicao uniforme
  // na esfera.
  const theta = hash01(w, 1) * Math.PI * 2
  const phi = Math.acos(1 - 2 * hash01(w, 2))
  const r = shellRadius(depth) + (hash01(w, 3) - 0.5) * 9
  const sp = Math.sin(phi)
  out.x = sp * Math.cos(theta) * r
  out.y = Math.cos(phi) * r
  out.z = sp * Math.sin(theta) * r
  return out
}

// Filho materializado por clique: leque na concha seguinte, centrado no
// angulo do pai. O jitter final vem do hash do endereco, entao o mesmo
// filho cai sempre no mesmo lugar do leque.
export function childFanPosition(
  parentTheta: number,
  parentPhi: number,
  i: number,
  n: number,
  depth: number,
  w: string,
  out: Vec3Like,
): Vec3Like {
  const spread = Math.min(Math.PI * 0.9, 0.05 * Math.max(1, n) + 0.14)
  const t = n <= 1 ? 0 : i / (n - 1) - 0.5
  const theta = parentTheta + t * spread + (hash01(w, 4) - 0.5) * 0.02
  // calota em volta da direcao do pai: o leque abre em theta e respira
  // em phi, preso longe dos polos pra nao degenerar
  const phi = Math.min(Math.PI - 0.05, Math.max(0.05, parentPhi + (hash01(w, 2) - 0.5) * 0.5))
  const r = shellRadius(depth) + (hash01(w, 3) - 0.5) * 9
  const sp = Math.sin(phi)
  out.x = sp * Math.cos(theta) * r
  out.y = Math.cos(phi) * r
  out.z = sp * Math.sin(theta) * r
  return out
}

// Tamanho da estrela: log10(1 + saldo + subarvore*0.15) mapeado em 2..9.
// 10^10 DOG cobre o supply inteiro, entao a normalizacao e por 10.
export function sizeFor(b: number, sb: number): number {
  const v = Math.log10(1 + Math.max(0, b) + Math.max(0, sb) * 0.15)
  // faixa 1.8 a 5.6 (era ate 9): com o teto de pixels no shader, o tamanho
  // diferencia baleia de sardinha sem virar bola de bokeh
  return 1.8 + Math.min(1, v / 10) * 3.8
}

// Paleta plot-map: holders na familia do laranja bitcoin #f7931a
// (variacao sutil por hash pra nao virar um carimbo), carteiras que ja
// gastaram tudo em cinza-brasa #5a4a42.
const HOLDER_A = { r: 0xf7 / 255, g: 0x93 / 255, b: 0x1a / 255 }
const HOLDER_B = { r: 0xff / 255, g: 0xc0 / 255, b: 0x66 / 255 }
const EMBER = { r: 0x5a / 255, g: 0x4a / 255, b: 0x42 / 255 }

export function colorFor(node: TreeNode, out: Float32Array, offset: number): void {
  if (node.h) {
    const t = hash01(node.w, 7) * 0.55
    out[offset] = HOLDER_A.r + (HOLDER_B.r - HOLDER_A.r) * t
    out[offset + 1] = HOLDER_A.g + (HOLDER_B.g - HOLDER_A.g) * t
    out[offset + 2] = HOLDER_A.b + (HOLDER_B.b - HOLDER_A.b) * t
  } else {
    out[offset] = EMBER.r
    out[offset + 1] = EMBER.g
    out[offset + 2] = EMBER.b
  }
}

// ── formatadores da HUD (copy em ingles) ─────────────────────────────────────
export const fmtDog = (n: number): string =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : n.toFixed(n >= 100 ? 0 : 2)

export const fmtInt = (n: number): string => new Intl.NumberFormat('en-US').format(Math.round(n))

export const shortAddr = (addr: string): string =>
  addr.length <= 16 ? addr : `${addr.slice(0, 8)}...${addr.slice(-6)}`
