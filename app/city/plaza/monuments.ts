// Os monumentos da Praça Satoshi (praca-jardins.md §2): o que dá sentido ao verde.
//
//   NE  Jardim do White Paper: nove estelas de granito negro com as nove páginas
//       REAIS do Bitcoin: A Peer-to-Peer Electronic Cash System gravadas em branco
//       (public/city/whitepaper/p1..9.webp vêm do PDF), e o Bloco Gênese junto à
//       muralha: um cubo de obsidiana com a mensagem da coinbase e o hash do bloco 0.
//   NW  O Espelho de Satoshi: no espelho d'água, a figura de capuz sem rosto em
//       bronze escuro; onde seria o rosto, um espelho. Quem olha é Satoshi.
//   SE  A Pata de Diamante: o espelho da diagonal é a palma, quatro dedos abrem
//       para fora, água preta com borda de luz quente; a marca do DOG na palma.
//   SW  Jardim Ordinal: um círculo de runestones (as pedras do Parque, com a
//       mesma pele) e as placas da Teoria Ordinal e da Runestone.
//
// Tudo procedural e instanciado onde há repetição; texto por canvas. Materiais:
// bronze escuro, obsidiana, granito negro, latão, espelho. Nada colorido: o
// laranja fica para a marca do DOG e as fitas de luz quente.
//
// ═══════════════════════════════════════════════════════════════════════════
// COMO ESTE ARQUIVO É CONSTRUÍDO (reescrito em 02-03/09/2026)
//
// ⚠️ ESTE MÓDULO ERA A TERCEIRA PIOR TRAVADA DO BOOT DE /city: 10,7 s de thread
// bloqueada, em DUAS tarefas de 5.490 ms e 4.498 ms (medição do coordenador,
// 02/09, `PerformanceObserver` em `longtask`, num boot de 63 s com 60,3 s de
// thread presa). NÃO RE-MEDI no navegador, a tarefa proibia abrir um: o que
// segue é a leitura do código, e ela bate com o formato de DUAS tarefas. Os
// `await` de rede partiam a função antiga em exatamente duas metades síncronas:
//
//     1ª  as nove estelas + o Bloco Gênese + o Espelho + a Pata inteira,
//         tudo entre o `await` das páginas e o `await` dos GLB do Leonidas;
//     2ª  o Leonidas + o Jardim Ordinal + o busto + as poças, do `await` dos
//         GLB até o fim.
//
// Nenhuma peça sozinha custa segundos: o custo é a SOMA de ~21 texturas de
// canvas, ~40 geometrias e ~35 materiais rodando sem NUNCA devolver a thread.
//
// A saída é o contrato de `obra.ts`: cada monumento é um `Trabalho` com o seu
// gerador, e o gerador cede POR TEMPO entre operações. Ver `FATIA_MS`.
//
// E A REDE ERA SERIAL, o que não aparece no gráfico de tarefa longa mas
// aparece no relógio: os quatro `await` estavam um DEPOIS do outro no meio da
// construção (as nove páginas → construir → os dois GLB do Leonidas →
// construir → os cristais → construir → o busto). Quatro idas ao servidor em
// fila. Agora todas partem juntas, na primeira linha, e cada peça só consulta
// a caixa quando precisa do arquivo. NÃO MEDI quantos ms isso devolve, é uma
// leitura do código, não um número de relógio.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  STELAE, GENESIS_POS, SATOSHI_POOL, PAW_PALM, PAW_TOES, PAW_TOE_R, PAW_PLAQUE, LEONIDAS_POS, LEONIDAS_PLINTH_R,
  ORDINAL_CENTER, ORDINAL_RING_R, ORDINAL_STONES, ORDINAL_PLAQUES, QUADRANT_ANGLE, POOL_R,
  BUST_POS, HERO_PALMS,
} from './garden-plan'
import { SF, loadSf, dressSf, firstGeometry } from './sf-assets'
import { TIERS, crystalMaterialFor, loadCrystalTextures } from './park'
import { buildLeonidas } from './statues'
import type { PerfProfile, DistanceCuller } from './perf'
import { makeGlowTexture, makeGroundPool, POOL_SPREAD, type PoolDisc, type Pool } from './light-pool'
import { emFatias, type Tarefa, type Trabalho } from './obra'

const WARM = new THREE.Color('#FFB35C')

/**
 * ⚠️ O ALVO É 3 ms POR FATIA, E O NÚMERO NÃO É O ORÇAMENTO DA OBRA. A `Obra`
 * gasta 6 ms por QUADRO, mas ela só olha o relógio ENTRE cessões: uma peça que
 * ceda de 200 em 200 ms não é segurada por orçamento nenhum, ele só decide se a
 * PRÓXIMA fatia começa. Ceder duas vezes numa tarefa de 5 s entrega três
 * travadas de 1,6 s, que continua sendo engasgo visível.
 *
 * Com 3 ms de alvo a fatia só passa disso pelo custo de UMA operação indivisível
 * (um canvas, uma geometria, um clone de cena), que é a granularidade mínima que
 * este arquivo alcança sem editar `statues.ts` nem o GLTFLoader.
 */
const FATIA_MS = 3

/** o relógio de uma fatia. Uso: `if (rel.estourou()) { yield; rel.reinicia() }` */
function novoRelogio(alvoMs = FATIA_MS) {
  let t0 = performance.now()
  return {
    estourou: () => performance.now() - t0 > alvoMs,
    /** REINICIAR DEPOIS DO `yield`, NUNCA ANTES. Entre o `yield` e o retorno
     *  passa um quadro inteiro: um relógio zerado antes da cessão já nasce
     *  estourado e a fatia seguinte cede na primeira checagem, sem fazer nada. */
    reinicia: () => { t0 = performance.now() },
  }
}

/** Uma promessa que o gerador consulta sem poder esperá-la (gerador não tem await). */
interface Caixa<T> { pronta: boolean; valor?: T; erro?: unknown }
function caixa<T>(p: Promise<T>): Caixa<T> {
  const c: Caixa<T> = { pronta: false }
  p.then((v) => { c.valor = v; c.pronta = true }, (e) => { c.erro = e; c.pronta = true })
  return c
}
// ⚠️ NADA DE `yield*` NESTE ARQUIVO, E NÃO É ESTILO. O tsconfig do repo tem
// "target": "es5" sem `downlevelIteration`, e o tsc RECUSA a delegação: medido
// com `npx tsc --noEmit`, nove erros TS2802, um por `yield*` que eu
// tinha escrito. (`obra.ts` compila porque só usa `yield` simples.) Então todo
// gerador aninhado é acionado à mão, sempre com a mesma linha:
//
//     const it = emFatias(...); while (!it.next().done) yield
//
// que é exatamente a semântica de `yield*` para um gerador que não devolve
// valor. Esperar por um arquivo vira `while (!cx.pronta) yield`.
//
// E A ESPERA TEM UM CUSTO QUE NÃO MEDI. A `Obra` só checa o relógio ENTRE
// cessões, então enquanto o arquivo não chega o laço gira gastando o orçamento
// de construção daquele quadro (uma retomada de gerador por volta, que é
// barata, mas é o orçamento inteiro), e o `Trabalho` atrás na fila não anda.
// Por isso TODA peça faz primeiro o que não depende de rede e só depois
// consulta a caixa, e por isso as cargas partem todas na construção, antes da
// primeira fatia.

export interface Monuments {
  group: THREE.Group
  update: (t: number) => void
  dispose: () => void
}

export interface MonumentsOpts {
  heightAt: (x: number, z: number) => number
  gltf?: GLTFLoader
  envMap?: THREE.Texture | null
  profile?: PerfProfile
  culler?: DistanceCuller
}

/** Os monumentos como peças de obra: o grupo entra na cena vazio e se preenche. */
export interface MonumentosEmObra extends Monuments {
  /** na ordem de construção, todas faixa 2 (fundo).
   *  A ORDEM IMPORTA NUMA COISA SÓ: a última ("Monument lights") funde as
   *  poças de todos os jardins numa malha, então ela tem de rodar depois das
   *  outras. A `Obra` ordena por faixa com `sort` ESTÁVEL, então basta manter
   *  todas na mesma faixa e enfileirar nesta ordem. */
  trabalhos: Trabalho[]
}

// ── texto em canvas: uma textura por placa ─────────────────────────────────
interface TextSpec {
  w?: number; h?: number
  bg?: string
  lines: { text: string; size: number; color?: string; font?: string; y: number; align?: CanvasTextAlign; x?: number; letterSpacing?: number }[]
}
function textTexture(spec: TextSpec): THREE.CanvasTexture {
  const W = spec.w ?? 1024, H = spec.h ?? 512
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  ctx.fillStyle = spec.bg ?? '#0c0c0f'
  ctx.fillRect(0, 0, W, H)
  for (const l of spec.lines) {
    ctx.fillStyle = l.color ?? '#e9e4d8'
    const setFont = (px: number) => {
      ctx.font = `${l.font ?? '500'} ${px}px "JetBrains Mono", "DM Mono", ui-monospace, monospace`
    }
    setFont(l.size)
    ctx.textAlign = l.align ?? 'center'
    ctx.textBaseline = 'middle'
    // ⚠️ O TEXTO ENCOLHE ANTES DE SER CORTADO, e isto é a auditoria de placas do
    // item 5 virada regra. Uma linha que não cabe não some pela borda: a fonte
    // desce até caber em 92% da largura. O piso de 60% existe para não trocar um
    // defeito visível por um ilegível.
    const room = W * 0.92
    const raw = ctx.measureText(l.text).width + (l.letterSpacing ? l.letterSpacing * (l.text.length - 1) : 0)
    if (raw > room) setFont(Math.max(l.size * 0.6, l.size * (room / raw)))
    const x = l.x ?? (l.align === 'left' ? W * 0.06 : W / 2)
    if (l.letterSpacing) {
      // espaçamento manual (letterSpacing do canvas ainda não é universal)
      const chars = l.text.split('')
      const widths = chars.map((ch) => ctx.measureText(ch).width + l.letterSpacing!)
      const total = widths.reduce((a, b) => a + b, 0) - l.letterSpacing
      let cx = (l.align === 'left' ? x : x - total / 2)
      ctx.textAlign = 'left'
      chars.forEach((ch, i) => { ctx.fillText(ch, cx, l.y); cx += widths[i] })
    } else {
      ctx.fillText(l.text, x, l.y)
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}
/** o giro (rotation.y) que faz o +z local de uma peça posta a `side` metros do eixo
 *  de uma diagonal (ângulo `a`) olhar para esse eixo */
function faceAxisYaw(a: number, side: number): number {
  const px = -Math.sin(a), pz = Math.cos(a)
  const sgn = Math.sign(side) || 1
  return Math.atan2(-sgn * px, -sgn * pz)
}
/** quebra um texto em linhas de no máximo `max` caracteres, por palavras */
function wrap(text: string, max: number): string[] {
  const out: string[] = []
  let line = ''
  for (const w of text.split(' ')) {
    if ((line + ' ' + w).trim().length > max) { out.push(line.trim()); line = w }
    else line = (line + ' ' + w).trim()
  }
  if (line) out.push(line)
  return out
}

/** Uma placa de leitura: pedra escura inclinada com face de latão gravado. */
function makePlaque(opts: { title: string; body: string; foot?: string; w?: number }, track: <T extends { dispose: () => void }>(o: T) => T): THREE.Group {
  const g = new THREE.Group()
  const w = opts.w ?? 4.6, h = 2.6
  const stone = new THREE.Mesh(track(new THREE.BoxGeometry(w + 0.6, 1.1, 1.6)), track(new THREE.MeshStandardMaterial({ color: 0x17181d, roughness: 0.75, metalness: 0.15 })))
  stone.position.y = 0.55
  stone.castShadow = stone.receiveShadow = true
  g.add(stone)
  const bodyLines = wrap(opts.body, 54)
  const lines: TextSpec['lines'] = [{ text: opts.title, size: 44, color: '#f2ead6', font: '700', y: 70, letterSpacing: 6 }]
  bodyLines.forEach((t, i) => lines.push({ text: t, size: 30, color: '#d9d2c4', y: 150 + i * 42 }))
  if (opts.foot) lines.push({ text: opts.foot, size: 26, color: '#F7931A', y: 150 + bodyLines.length * 42 + 30, letterSpacing: 4 })
  const tex = track(textTexture({ w: 1024, h: 560, bg: '#151310', lines }))
  const face = new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), track(new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.4, metalness: 0.7 })))
  face.position.set(0, 1.1 + h / 2 * Math.cos(0.42) - 0.1, 0.55)
  face.rotation.x = -0.42
  g.add(face)
  return g
}

/**
 * Os monumentos como peças de obra. NÃO constrói nada aqui dentro: só cria os
 * materiais compartilhados (oito objetos e um canvas de 64 px, que é o que a
 * função antiga também fazia nos seus primeiros milissegundos), dispara todas as
 * cargas de rede e devolve os geradores.
 */
export function monumentosEmObra(opts: MonumentsOpts): MonumentosEmObra {
  const group = new THREE.Group()
  group.name = 'Monuments'
  const TEXT_CULL = opts.profile?.textCull ?? 1300
  const cullText = (o: THREE.Object3D, x: number, z: number) => opts.culler?.add(o, TEXT_CULL, new THREE.Vector3(x, 0, z))
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => { disposables.push(o); return o }
  const yAt = opts.heightAt
  const lights: THREE.PointLight[] = []
  const pulses: { m: THREE.MeshStandardMaterial; base: number }[] = []
  const texLoader = new THREE.TextureLoader()
  const loadTex = (url: string) => new Promise<THREE.Texture>((res, rej) => texLoader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; res(t) }, undefined, rej))

  const graniteMat = track(new THREE.MeshStandardMaterial({ color: 0x121317, roughness: 0.55, metalness: 0.2, envMapIntensity: 0.6 }))
  const obsidianMat = track(new THREE.MeshPhysicalMaterial({ color: 0x07070a, roughness: 0.08, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.4 }))
  const bronzeMat = track(new THREE.MeshStandardMaterial({ color: 0x2b1f15, roughness: 0.42, metalness: 0.9, envMapIntensity: 1.1 }))
  const mirrorMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.02, metalness: 1, envMapIntensity: 2.2 }))
  const brassMat = track(new THREE.MeshStandardMaterial({ color: 0xc9a25a, roughness: 0.32, metalness: 0.95, envMapIntensity: 1.2 }))
  const waterMat = track(new THREE.MeshStandardMaterial({ color: 0x08111c, roughness: 0.05, metalness: 0.7, emissive: 0x0a1a2c, emissiveIntensity: 0.5, envMapIntensity: 1.6 }))
  const warmRimMat = track(new THREE.MeshBasicMaterial({ color: WARM, toneMapped: false }))
  const upMat = track(new THREE.MeshBasicMaterial({ color: WARM, toneMapped: false, transparent: true, opacity: 0.55 }))

  // ── COMO OS MONUMENTOS ACENDEM (censo de luzes, 2026-08-23) ───────────────
  //
  // Eram nove PointLight só aqui dentro, e o three avalia cada uma em cada
  // fragmento das ~500 malhas iluminadas da cena: o custo é malhas × luzes. Oito
  // delas pintavam halo em cima de peça que JÁ EMITE (as páginas do white paper,
  // as faces do Bloco Gênese, a marca do DOG, as bordas quentes dos espelhos).
  // Essas viraram emissão um pouco mais forte mais poça de luz no piso, que é um
  // desenho e não uma luz.
  //
  // ⚠️ SOBROU UMA, A FRONTAL DO LEONIDAS, e ela não é decoração: ver o bloco SE.
  const glowTex = track(makeGlowTexture())
  const pools: PoolDisc[] = []
  /** ⚠️ A POÇA LARGA VALE METADE DA LUMINÁRIA (0,3 nos postes do precinct → 0,15
   *  aqui). Ela cobre dezenas de metros: no mesmo brilho vira uma mancha branca
   *  que apaga o desenho do piso e o reflexo dos espelhos d'água. */
  const WASH_GAIN = 0.15
  /** ⚠️ QUEM PERDEU A LUZ GANHA EMISSÃO, UM TERÇO A MAIS, e não mais que isso.
   *  A emissão é o que sobra de fonte na peça, mas a gravação clara (as páginas,
   *  as faces do Bloco) já chega perto do branco com o sol de `?hour=day`:
   *  dobrar apaga o texto. Se a praça ainda parecer escura, suba a POÇA antes. */
  const LIT = 4 / 3

  const addLight = (x: number, y: number, z: number, i: number, dist = 90, c: THREE.Color | number = WARM) => {
    const l = new THREE.PointLight(c, i, dist, 1.6)
    l.position.set(x, y, z)
    group.add(l)
    lights.push(l)
    return l
  }
  /** a luminária acesa (o disco emissivo, que é o que o olho lê como fonte) mais
   *  a poça que ela desenha no piso, que é o que faz o monumento parecer aceso */
  const uplight = (x: number, z: number, r = 0.55) => {
    const m = new THREE.Mesh(track(new THREE.CircleGeometry(r, 12)), upMat)
    m.rotation.x = -Math.PI / 2
    m.position.set(x, yAt(x, z) + 0.45, z)
    group.add(m)
    pools.push({ at: [x, yAt(x, z) + 0.42, z], r: r * POOL_SPREAD })
  }
  /** a poça larga que fica no lugar de uma luz que saiu. O raio é o da PEÇA que
   *  ela acendia (todos vêm de garden-plan ou da geometria logo ao lado), nunca
   *  o alcance da PointLight antiga: alcance pinta disco maior que o monumento. */
  const wash = (x: number, z: number, r: number, c?: THREE.ColorRepresentation) => {
    pools.push({ at: [x, yAt(x, z) + 0.42, z], r, gain: WASH_GAIN, color: c })
  }

  // ── A REDE, TODA JUNTA, ANTES DA PRIMEIRA FATIA ───────────────────────────
  // Ver o cabeçalho: os quatro `await` da versão antiga eram uma fila.
  const gl = opts.gltf ?? new GLTFLoader()
  const carregaCena = (url: string) => new Promise<THREE.Object3D | null>((res) => gl.load(url, (gg) => res(gg.scene), undefined, () => res(null)))
  /** as nove páginas do PDF. Uma que falhe vira `null` e a estela nasce lisa: a
   *  praça nunca deixa de abrir por causa de uma imagem. */
  // ⚠️ AS NOVE PÁGINAS SÃO A MAIOR FAMÍLIA DA CENA: 768x994 cada, 4,1 MB, 37 MB
  // somados — mais que qualquer textura individual. Num celular a estela é lida
  // de longe e a página é TEXTO que ninguém consegue ler ali de qualquer forma.
  // `-half` é arquivo próprio (384x497, ~1 MB cada) e não redução no cliente,
  // porque o que derruba o telefone é o PICO da decodificação.
  // ⚠️ A PERGUNTA É "O PERFIL CORTA?", NÃO "ESTE TAMANHO SERIA CORTADO?".
  // `texLado` é um TETO, então ele devolve 768 para uma entrada de 768 e a
  // primeira versão desta linha (`texLado(768) < 768`) era sempre falsa: as
  // páginas nunca trocavam. E teto é o instrumento errado para elas de
  // qualquer forma — cada uma cabe folgada em 2.048, mas são NOVE, e nove
  // vezes 4,1 MB são 37 MB, a maior família da cena inteira. Teto não vê
  // família; ele só vê a maior peça. Por isso a decisão aqui é explícita.
  const meiaPag = opts.profile?.cortaTextura ?? false
  const cxPages = caixa(Promise.all(STELAE.map((s) => loadTex(`/city/whitepaper/p${s.page}${meiaPag ? '-half' : ''}.webp`).catch((err) => {
    console.warn('[plaza] página do white paper não carregou', s.page, err)
    return null
  }))))
  const cxLeo = caixa(Promise.all([carregaCena('/city/leonidas-skull.glb'), carregaCena('/city/leonidas-body.glb')]))
  const cxOrdinal = caixa(Promise.all([
    new Promise<THREE.Group>((res, rej) => gl.load('/city/park/crystals.glb', (g) => res(g.scene), undefined, rej)),
    loadCrystalTextures(),
  ]).catch((err) => { console.warn('[plaza] cristais do Jardim Ordinal não carregaram', err); return null }))
  const cxBust = caixa(loadSf(gl, SF.bust))

  // ═══ NE · O Jardim do White Paper ═════════════════════════════════════════
  // A alameda corre pela diagonal; cada estela fica a 13 m do eixo e olha para
  // ele. A página é gravada na face voltada para a alameda: a imagem invertida
  // do PDF (letras claras) entra como mapa de cor e de emissão sobre o granito.
  function* fWhitepaper(): Tarefa {
    const rel = novoRelogio()
    const aNE = QUADRANT_ANGLE.NE
    const px = -Math.sin(aNE), pz = Math.cos(aNE)
    const STELA_W = 5.6, STELA_H = 7.2, STELA_T = 0.9
    // as quatro geometrias repetidas nascem UMA vez: eram nove caixas de plinto e
    // nove planos de número idênticos, um par por estela. Nenhuma chamada de
    // desenho a menos (as malhas continuam sendo as mesmas), só nove construções
    // de buffer a menos dentro da fatia.
    const stelaGeo = track(new THREE.BoxGeometry(STELA_W, STELA_H, STELA_T))
    const plinthGeo = track(new THREE.BoxGeometry(STELA_W + 1.2, 0.5, STELA_T + 1.6))
    const numGeo = track(new THREE.PlaneGeometry(1.4, 0.36))
    const pageGeo = track(new THREE.PlaneGeometry(STELA_W * 0.86, STELA_W * 0.86 * (994 / 768)))
    if (rel.estourou()) { yield; rel.reinicia() }

    // passo 1: as nove estelas SEM a página, que é o que não depende de rede
    const corpos: THREE.Group[] = []
    const itEstelas = emFatias(STELAE, (s) => {
      const [x, z] = s.pos
      const y = yAt(x, z)
      const g = new THREE.Group()
      g.position.set(x, y, z)
      // a face útil olha para o eixo da alameda: normal = −side × perpendicular
      g.rotation.y = Math.atan2(-s.side * px, -s.side * pz)
      const plinth = new THREE.Mesh(plinthGeo, graniteMat)
      plinth.position.y = 0.25
      plinth.receiveShadow = true
      g.add(plinth)
      const stone = new THREE.Mesh(stelaGeo, graniteMat)
      stone.position.y = 0.5 + STELA_H / 2
      stone.castShadow = stone.receiveShadow = true
      g.add(stone)
      // o número da página, pequeno, no plinto; e o foco no chão
      const num = new THREE.Mesh(numGeo, track(new THREE.MeshBasicMaterial({
        map: track(textTexture({ w: 256, h: 64, bg: '#121317', lines: [{ text: `PAGE ${s.page} OF 9`, size: 30, color: '#a89b80', y: 34, letterSpacing: 4 }] })), toneMapped: false,
      })))
      num.position.set(0, 0.5 + 0.28, STELA_T / 2 + 0.6)
      g.add(num)
      group.add(g)
      corpos.push(g)
      const fx = x + (-s.side * px) * 4, fz = z + (-s.side * pz) * 4
      uplight(fx, fz)
      // a nave era acesa por uma PointLight de 140 m no meio dela; agora cada
      // estela se acende sozinha: a página emite mais e o plinto tem a sua poça
      wash(fx, fz, STELA_W + 1.2, 0xfff0dc) // a largura do plinto é a do rastro no piso
      cullText(num, x, z)
    }, FATIA_MS, 1)
    while (!itEstelas.next().done) yield
    rel.reinicia()

    // passo 2: as páginas, quando chegarem
    while (!cxPages.pronta) yield
    rel.reinicia()
    const pages = cxPages.valor ?? []
    const itPaginas = emFatias(STELAE, (_, i) => {
      const tex = pages[i]
      if (!tex) return
      track(tex)
      const pageMat = track(new THREE.MeshStandardMaterial({
        color: 0x0d0d10, roughness: 0.6, metalness: 0.1,
        map: tex, emissive: 0xfff2dc, emissiveMap: tex, emissiveIntensity: 0.9 * LIT, transparent: false,
      }))
      const page = new THREE.Mesh(pageGeo, pageMat)
      page.position.set(0, 0.5 + STELA_H / 2 + 0.1, STELA_T / 2 + 0.02)
      corpos[i].add(page)
      pulses.push({ m: pageMat, base: 0.9 * LIT })
    }, FATIA_MS, 1)
    while (!itPaginas.next().done) yield
    rel.reinicia()

    // a placa de abertura da nave, à entrada (r 615), lado direito
    // Cessão INCONDICIONAL antes de uma placa: `makePlaque` desenha um canvas de
    // 1024×560 com título, corpo quebrado em linhas e rodapé, e é indivisível
    // daqui (é uma função, não um gerador). Não medi o custo dela; cedo por
    // regra, para ela nunca somar com o que veio antes dentro da mesma fatia.
    // Custa um quadro, e a peça é de fundo.
    yield; rel.reinicia()
    const r = 612, side = -13
    const x = Math.cos(aNE) * r + px * side, z = Math.sin(aNE) * r + pz * side
    const p = makePlaque({
      title: 'BITCOIN', // o título completo não cabe na chapa: vai no corpo
      body: 'A Peer-to-Peer Electronic Cash System. ' +
        'Satoshi Nakamoto, 31 October 2008. Nine pages, published to a cryptography mailing list. Every page is engraved along this walk, in order. At the end, the first block.',
      foot: 'THE WHITEPAPER GARDEN',
      w: 5.2,
    }, track)
    p.position.set(x, yAt(x, z), z)
    p.rotation.y = faceAxisYaw(aNE, side)
    group.add(p)
    cullText(p, x, z)
  }

  // ═══ NE · O Bloco Gênese ══════════════════════════════════════════════════
  function* fGenesis(): Tarefa {
    const rel = novoRelogio()
    const aNE = QUADRANT_ANGLE.NE
    const [gx, gz] = GENESIS_POS
    const gy = yAt(gx, gz)
    const g = new THREE.Group()
    g.position.set(gx, gy, gz)
    g.rotation.y = Math.atan2(-Math.cos(aNE), -Math.sin(aNE)) // a face do título olha para quem chega pela alameda
    const S = 6.4
    const base = new THREE.Mesh(track(new THREE.CylinderGeometry(7.2, 7.8, 0.6, 48)), graniteMat)
    base.position.y = 0.3
    base.receiveShadow = true
    g.add(base)
    if (rel.estourou()) { yield; rel.reinicia() }
    const cube = new THREE.Mesh(track(new THREE.BoxGeometry(S, S, S)), obsidianMat)
    cube.position.y = 0.6 + S / 2 + 0.9
    cube.castShadow = cube.receiveShadow = true
    g.add(cube)
    // flutua sobre um pedestal fino: o bloco não toca o chão
    const stem = new THREE.Mesh(track(new THREE.CylinderGeometry(1.1, 1.4, 0.9, 24)), bronzeMat)
    stem.position.y = 0.6 + 0.45
    g.add(stem)
    group.add(g)
    if (rel.estourou()) { yield; rel.reinicia() }
    // as quatro faces: título, a coinbase, o hash, a recompensa
    const faces: TextSpec[] = [
      { lines: [
        { text: 'BLOCK 0', size: 120, font: '700', color: '#f2ead6', y: 190, letterSpacing: 18 },
        { text: '3 JANUARY 2009 · 18:15:05 UTC', size: 40, color: '#c9bfae', y: 300, letterSpacing: 4 },
        { text: 'THE GENESIS BLOCK', size: 34, color: '#F7931A', y: 380, letterSpacing: 8 },
      ] },
      { lines: [
        { text: 'The Times 03/Jan/2009', size: 62, font: '700', color: '#f2ead6', y: 170 },
        { text: 'Chancellor on brink of', size: 62, font: '700', color: '#f2ead6', y: 250 },
        { text: 'second bailout for banks', size: 62, font: '700', color: '#f2ead6', y: 330 },
        { text: 'WRITTEN INTO THE COINBASE OF THE FIRST BLOCK', size: 26, color: '#a89b80', y: 430, letterSpacing: 4 },
      ] },
      { lines: [
        { text: 'BLOCK HASH', size: 34, color: '#a89b80', y: 120, letterSpacing: 8 },
        { text: '000000000019d6689c085ae165831e93', size: 44, color: '#f2ead6', y: 220 },
        { text: '4ff763ae46a2a6c172b3f1b60a8ce26f', size: 44, color: '#f2ead6', y: 290 },
        { text: 'MINED BY SATOSHI NAKAMOTO', size: 30, color: '#F7931A', y: 400, letterSpacing: 6 },
      ] },
      { lines: [
        { text: '50 BTC', size: 130, font: '700', color: '#f2ead6', y: 200, letterSpacing: 10 },
        { text: 'THE FIRST REWARD · NEVER SPENT', size: 34, color: '#c9bfae', y: 320, letterSpacing: 5 },
        { text: 'BITCOIN BEGINS HERE', size: 30, color: '#F7931A', y: 400, letterSpacing: 8 },
      ] },
    ]
    const faceGeo = track(new THREE.PlaneGeometry(S * 0.9, S * 0.9 * 0.5))
    // UMA FACE POR FATIA: cada uma é um canvas de 1024×512 com texto, que é a
    // operação indivisível mais cara deste arquivo depois da marca do DOG.
    const itFaces = emFatias(faces, (spec, i) => {
      const tex = track(textTexture({ w: 1024, h: 512, bg: '#050507', lines: spec.lines }))
      const m = track(new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.6 * LIT, roughness: 0.15, metalness: 0.2 }))
      const f = new THREE.Mesh(faceGeo, m)
      const a = (i * Math.PI) / 2
      f.position.set(Math.sin(a) * (S / 2 + 0.02), cube.position.y, Math.cos(a) * (S / 2 + 0.02))
      f.rotation.y = a
      g.add(f)
      pulses.push({ m, base: 0.6 * LIT })
    }, FATIA_MS, 1)
    while (!itFaces.next().done) yield
    rel.reinicia()
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2
      uplight(gx + Math.cos(a) * 6.2, gz + Math.sin(a) * 6.2, 0.7)
    }
    wash(gx, gz, 8.1, 0xfff0dc) // 8,1 é o raio do anel de luz que já cerca o Bloco
    if (rel.estourou()) { yield; rel.reinicia() }
    // a linha de luz que segue a alameda até o bloco: a última é a que importa
    const line = new THREE.Mesh(track(new THREE.RingGeometry(7.6, 8.1, 64)), warmRimMat)
    line.rotation.x = -Math.PI / 2
    line.position.set(gx, gy + 0.62, gz)
    group.add(line)
  }

  // ═══ NW · O Espelho de Satoshi ════════════════════════════════════════════
  function* fEspelho(): Tarefa {
    const rel = novoRelogio()
    const [sx, sz] = SATOSHI_POOL
    const sy = yAt(sx, sz)
    const g = new THREE.Group()
    g.position.set(sx, sy, sz)
    // a figura olha para o deck: para dentro, ao longo da diagonal
    g.rotation.y = Math.atan2(-sx, -sz)
    // A figura em lâminas saiu por decisão do fundador (2026-08-19): fica só o
    // busto de bronze, no portão. Sem figura, o plinto perdia a razão e saiu
    // junto: o quarto espelho passa a ser água e jato, como os outros, e a
    // inscrição vira uma laje baixa na borda, do lado do deck.
    // a inscrição no plinto, do lado do deck
    const insc = new THREE.Mesh(track(new THREE.PlaneGeometry(6, 1.0)), track(new THREE.MeshBasicMaterial({
      map: track(textTexture({ w: 1024, h: 170, bg: '#121317', lines: [
        { text: 'WE ARE ALL SATOSHI', size: 60, font: '700', color: '#f2ead6', y: 62, letterSpacing: 10 },
        { text: 'the face is a mirror · look, and you are here', size: 30, color: '#a89b80', y: 126 },
      ] })), toneMapped: false,
    })))
    insc.rotation.x = -Math.PI / 2 // deitada no passeio da borda
    insc.position.set(0, 0.42, POOL_R + 5)
    g.add(insc)
    group.add(g)
    if (rel.estourou()) { yield; rel.reinicia() }
    // luz: dois focos rasantes no passeio do lado do deck, e a poça entre eles.
    // A PointLight que ficava no eixo saiu porque, desde que a figura de lâminas
    // foi embora, não há geometria nenhuma ali para ela modelar: é água preta,
    // uma laje de inscrição e o passeio.
    const ax = -sx / Math.hypot(sx, sz), az = -sz / Math.hypot(sx, sz) // direção para o deck
    for (const sgn of [-1, 1]) {
      const px = -az * sgn, pz = ax * sgn
      const lx = sx + ax * (POOL_R + 6) + px * 12, lz = sz + az * (POOL_R + 6) + pz * 12
      uplight(lx, lz, 0.9)
    }
    wash(sx + ax * (POOL_R + 6), sz + az * (POOL_R + 6), 12, 0xfff0dc) // 12 m: o vão entre os dois focos
  }

  // ── A MARCA DO DOG no fundo da palma ────────────────────────────────────
  // Refeita em 2026-08-19: a primeira versão punha o nome numa linha reta que
  // o disco cortava (a textura era quadrada, o disco é redondo) e o chafariz
  // ficava em cima dela. Agora: emblema grande no centro, o nome CURVADO no
  // anel (cada letra girada no seu ângulo, que é como se escreve num círculo),
  // aro de latão, e o chafariz saiu deste espelho.
  //
  // ESTE É O CANVAS MAIS CARO DO ARQUIVO e por isso ele é um gerador, não uma
  // função: 1024×1024, um gradiente radial no disco inteiro (~800 mil pixels),
  // três aros, 52 glifos girados um a um e um "$DOG" de 210 px com
  // `shadowBlur` de 40. NÃO MEDI cada etapa; cedo entre elas porque cada uma é
  // grande o bastante para valer a checagem, e cortar aqui é a única forma de a
  // fatia da Pata não ser a soma das seis.
  function* marcaDoDog(): Generator<void, THREE.CanvasTexture, unknown> {
    const rel = novoRelogio()
    const S = 1024
    const c = document.createElement('canvas')
    c.width = S; c.height = S
    const ctx = c.getContext('2d')!
    const R = S / 2
    // fundo: só dentro do círculo (fora fica transparente e não aparece borda)
    ctx.beginPath(); ctx.arc(R, R, R - 2, 0, Math.PI * 2); ctx.closePath()
    const g = ctx.createRadialGradient(R, R, 10, R, R, R)
    g.addColorStop(0, '#101b26'); g.addColorStop(0.72, '#0a1017'); g.addColorStop(1, '#070b10')
    ctx.fillStyle = g; ctx.fill()
    if (rel.estourou()) { yield; rel.reinicia() }
    // aros de latão
    const ring = (rr: number, w: number, col: string) => {
      ctx.beginPath(); ctx.arc(R, R, rr, 0, Math.PI * 2)
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke()
    }
    ring(R - 12, 10, '#c9902a')
    ring(R - 30, 3, 'rgba(201,144,42,0.55)')
    ring(R * 0.52, 3, 'rgba(201,144,42,0.4)')
    if (rel.estourou()) { yield; rel.reinicia() }
    // o nome, curvado no anel: metade em cima (da esquerda para a direita) e a
    // outra metade embaixo, invertida, para ler dos dois lados do espelho
    const curved = (text: string, radius: number, centerAngle: number, size: number, flip: boolean) => {
      ctx.save()
      ctx.translate(R, R)
      ctx.font = `700 ${size}px "JetBrains Mono", "DM Sans", system-ui, sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = '#e9dfc6'
      // no arco de baixo os glifos saem na ordem inversa (o percurso é
      // anti-horário): inverte a string para o texto ler da esquerda para a direita
      const chars = flip ? text.split('').reverse() : text.split('')
      const widths = chars.map((ch) => ctx.measureText(ch).width + size * 0.28)
      const total = widths.reduce((a, b) => a + b, 0)
      // `flip`: o texto vai no arco de BAIXO, lido de fora (letra girada 180°)
      let ang = centerAngle - (flip ? -1 : 1) * (total / radius) / 2
      for (let i = 0; i < chars.length; i++) {
        const step = widths[i] / radius
        const a = ang + (flip ? -1 : 1) * step / 2
        ctx.save()
        ctx.rotate(a)
        ctx.translate(0, flip ? radius : -radius)
        if (flip) ctx.rotate(Math.PI)
        ctx.fillText(chars[i], 0, 0)
        ctx.restore()
        ang += (flip ? -1 : 1) * step
      }
      ctx.restore()
    }
    curved('DOG • GO • TO • THE • MOON', R - 62, 0, 46, false)   // arco de cima
    if (rel.estourou()) { yield; rel.reinicia() }
    curved('RUNE 840000:3 · APRIL 2024', R - 62, 0, 40, true)     // arco de baixo
    if (rel.estourou()) { yield; rel.reinicia() }
    // o emblema: $DOG grande, com sombra quente
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(247,147,26,0.55)'; ctx.shadowBlur = 40
    ctx.fillStyle = '#F7931A'
    ctx.font = '700 210px "JetBrains Mono", "DM Sans", system-ui, sans-serif'
    ctx.fillText('$DOG', R, R - 18)
    ctx.shadowBlur = 0
    if (rel.estourou()) { yield; rel.reinicia() }
    ctx.fillStyle = '#c9bfae'
    ctx.font = '500 44px "JetBrains Mono", system-ui, sans-serif'
    ctx.fillText('THE DIAMOND PAW', R, R + 96)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }

  // ═══ SE · A Pata de Diamante ══════════════════════════════════════════════
  function* fPata(): Tarefa {
    const rel = novoRelogio()
    const [px, pz] = PAW_PALM
    const itMarca = marcaDoDog()
    let passoMarca = itMarca.next()
    while (!passoMarca.done) { yield; passoMarca = itMarca.next() }
    const markTex = track(passoMarca.value)
    rel.reinicia()
    const MARK_R = 30 // era 14: o emblema agora ocupa a palma inteira
    const mark = new THREE.Mesh(track(new THREE.CircleGeometry(MARK_R, 96)), track(new THREE.MeshStandardMaterial({
      map: markTex, transparent: true, roughness: 0.25, metalness: 0.5, envMapIntensity: 1.2,
      emissive: 0xffffff, emissiveMap: markTex, emissiveIntensity: 0.5 * LIT,
    })))
    mark.rotation.x = -Math.PI / 2
    // o topo do texto para fora, para quem chega do deck ler certo (Euler XYZ: Rz primeiro)
    mark.rotation.z = Math.atan2(-Math.cos(QUADRANT_ANGLE.SE), -Math.sin(QUADRANT_ANGLE.SE))
    mark.position.set(px, yAt(px, pz) + 0.27, pz)
    group.add(mark)
    if (rel.estourou()) { yield; rel.reinicia() }
    // aro de latão em relevo em volta do emblema, para ele não boiar no preto
    const markRing = new THREE.Mesh(track(new THREE.TorusGeometry(MARK_R + 0.6, 0.35, 8, 96)), brassMat)
    markRing.rotation.x = Math.PI / 2
    markRing.position.set(px, yAt(px, pz) + 0.3, pz)
    group.add(markRing)
    // de noite, a marca acende a água. Eram dois focos rasantes de fora do
    // espelho; agora é a própria gravação que emite, com a poça no tamanho exato
    // do emblema, que é o desenho que a luz fazia na água.
    wash(px, pz, MARK_R, 0xffd9a0)
    if (rel.estourou()) { yield; rel.reinicia() }
    // os quatro dedos: espelhos menores, água preta, borda de luz quente
    const toeGeo = track(new THREE.CircleGeometry(PAW_TOE_R, 48))
    const toeRimGeo = track(new THREE.RingGeometry(PAW_TOE_R - 0.5, PAW_TOE_R + 0.5, 64))
    const toeWalkGeo = track(new THREE.RingGeometry(PAW_TOE_R + 0.6, PAW_TOE_R + 4.5, 64))
    const walkMat = track(new THREE.MeshStandardMaterial({ color: 0x17181d, roughness: 0.75, metalness: 0.15 }))
    const itDedos = emFatias(PAW_TOES, ([tx, tz]) => {
      const y = yAt(tx, tz)
      const w = new THREE.Mesh(toeGeo, waterMat); w.rotation.x = -Math.PI / 2; w.position.set(tx, y + 0.25, tz); w.receiveShadow = true; group.add(w)
      const r = new THREE.Mesh(toeRimGeo, warmRimMat); r.rotation.x = -Math.PI / 2; r.position.set(tx, y + 0.32, tz); group.add(r)
      const wk = new THREE.Mesh(toeWalkGeo, walkMat); wk.rotation.x = -Math.PI / 2; wk.position.set(tx, y + 0.34, tz); wk.receiveShadow = true; group.add(wk)
      // uma poça por dedo no lugar da luz única que cobria os quatro: o raio é o
      // do passeio em volta do espelho, e a borda quente do dedo já é emissiva
      wash(tx, tz, PAW_TOE_R + 4.5)
    }, FATIA_MS, 1)
    while (!itDedos.next().done) yield
    rel.reinicia()
    // a borda quente da palma também (a dos outros espelhos é branca): a pata é uma só
    const palmRim = new THREE.Mesh(track(new THREE.RingGeometry(POOL_R - 0.6, POOL_R + 0.6, 96)), warmRimMat)
    palmRim.rotation.x = -Math.PI / 2
    palmRim.position.set(px, yAt(px, pz) + 0.33, pz)
    group.add(palmRim)
    // Cessão INCONDICIONAL antes de uma placa: `makePlaque` desenha um canvas de
    // 1024×560 com título, corpo quebrado em linhas e rodapé, e é indivisível
    // daqui (é uma função, não um gerador). Não medi o custo dela; cedo por
    // regra, para ela nunca somar com o que veio antes dentro da mesma fatia.
    // Custa um quadro, e a peça é de fundo.
    yield; rel.reinicia()
    const [qx, qz] = PAW_PLAQUE
    const p = makePlaque({
      title: 'THE DIAMOND PAW',
      body: 'DOG • GO • TO • THE • MOON, rune 840000:3, was airdropped in April 2024 to every wallet holding a Runestone. Diamond paws never sold. The pool is a paw print, four toes open toward the plain; the mark of the DOG lies under the water of the palm.',
      foot: '$DOG',
    }, track)
    p.position.set(qx, yAt(qx, qz), qz)
    p.rotation.y = faceAxisYaw(QUADRANT_ANGLE.SE, 12)
    group.add(p)
    cullText(p, qx, qz)
  }

  // ═══ SE · Leonidas, o fundador do DOG ═════════════════════════════════════
  // No eixo da diagonal, atrás dos dedos da pata, olhando para o deck por cima
  // da pata: quem chega do Anel vê a pata e, ao fundo, a figura de capa negra e
  // caveira amarela. Plinto de granito, passeio em volta (a alameda contorna).
  function* fLeonidas(): Tarefa {
    const rel = novoRelogio()
    const [lx, lz] = LEONIDAS_POS
    const ly = yAt(lx, lz)
    const g = new THREE.Group()
    g.position.set(lx, ly, lz)
    g.rotation.y = Math.atan2(-lx, -lz) // +z local → o deck
    const plinth = new THREE.Mesh(track(new THREE.CylinderGeometry(LEONIDAS_PLINTH_R * 0.62, LEONIDAS_PLINTH_R * 0.7, 2.2, 48)), graniteMat)
    plinth.position.y = 1.1
    plinth.castShadow = plinth.receiveShadow = true
    g.add(plinth)
    if (rel.estourou()) { yield; rel.reinicia() }
    const step = new THREE.Mesh(track(new THREE.CylinderGeometry(LEONIDAS_PLINTH_R, LEONIDAS_PLINTH_R + 0.4, 0.5, 48)), graniteMat)
    step.position.y = 0.25
    step.receiveShadow = true
    g.add(step)
    group.add(g)
    if (rel.estourou()) { yield; rel.reinicia() }
    // a inscrição no plinto, do lado do deck
    const insc = new THREE.Mesh(track(new THREE.PlaneGeometry(7, 1.2)), track(new THREE.MeshBasicMaterial({
      map: track(textTexture({ w: 1024, h: 176, bg: '#121317', lines: [
        // O nome e o título que o fundador escreveu, 2026-08-21. Era "founder of
        // DOG", que dizia menos do que a pessoa fez: a Runestone veio antes.
        { text: 'LEONIDAS', size: 66, font: '700', color: '#e8b62b', y: 58, letterSpacing: 14 },
        { text: 'creator of Runestone', size: 30, color: '#c9bfae', y: 112 },
        { text: 'and $DOG • GO • TO • THE • MOON', size: 30, color: '#c9bfae', y: 150 },
      ] })), toneMapped: false,
    })))
    // o plinto afunila (0,7R embaixo, 0,62R em cima): a placa acompanha o
    // talude, 0,12 m fora dele, senão a pedra corta o texto de baixo
    insc.position.set(0, 1.25, LEONIDAS_PLINTH_R * 0.66 + 0.14)
    insc.rotation.x = -Math.atan((0.7 - 0.62) * LEONIDAS_PLINTH_R / 2.2)
    g.add(insc)
    cullText(insc, lx, lz)
    if (rel.estourou()) { yield; rel.reinicia() }
    // o passeio em volta do plinto, onde a alameda contorna
    const walk = new THREE.Mesh(track(new THREE.RingGeometry(LEONIDAS_PLINTH_R + 0.5, LEONIDAS_PLINTH_R + 7, 64)), track(new THREE.MeshStandardMaterial({ color: 0x17181d, roughness: 0.75, metalness: 0.15 })))
    walk.rotation.x = -Math.PI / 2
    walk.position.set(lx, ly + 0.35, lz)
    walk.receiveShadow = true
    group.add(walk)
    // dois focos rasantes vindos da frente, quentes: a caveira acende
    const ax = -lx / Math.hypot(lx, lz), az = -lz / Math.hypot(lx, lz)
    for (const sgn of [-1, 1]) {
      const px = -az * sgn, pz = ax * sgn
      const fx = lx + ax * 12 + px * 7, fz = lz + az * 12 + pz * 7
      uplight(fx, fz, 0.9)
    }
    // ⚠️ A ÚNICA PointLight QUE SOBROU NOS MONUMENTOS, e ela fica. O Leonidas
    // tem 11,5 m de figura escura sobre um plinto de granito, e é a peça da
    // praça que mais depende de MODELADO: sem uma fonte fora dela a silhueta
    // fecha em preto e a caveira amarela flutua sozinha no escuro. Poça não
    // resolve isso, poça é tinta no chão e não dá volume a nada.
    addLight(lx + ax * 12, ly + 4, lz + az * 12, 3.4, 70, 0xfff0dc)

    // a figura, quando os dois GLB chegarem
    while (!cxLeo.pronta) yield
    const par = cxLeo.valor
    const skullScene = par ? par[0] : null
    const bodyScene = par ? par[1] : null
    if (!skullScene || !bodyScene) { console.warn('[plaza] leonidas did not load'); return }
    // INDIVISÍVEL, E FICA NUMA FATIA SÓ. `buildLeonidas` mora em `statues.ts`
    // (que não é meu): ele clona duas cenas glTF, clona os materiais das duas e
    // desenha um canvas de 512×512 com o glifo ₿ de 330 px. É UMA chamada, não
    // tem por onde cortar daqui, então ela cede antes e não divide a fatia com
    // mais nada. Não medi o custo dela.
    yield
    rel.reinicia()
    const LEO_SCALE = 11.5 // o modelo tem altura 1,0: 11,5 m
    // SEM CAPA: entrou em 2026-08-19 (item 9) e o fundador mandou tirar no
    // mesmo dia. O manto continua assado em `blender/build_leonidas_cape.py`
    // → `public/city/leonidas-cape.glb`, e volta com um argumento se ele quiser.
    const leo = buildLeonidas(skullScene, bodyScene, LEO_SCALE)
    disposables.push(leo)
    leo.group.scale.setScalar(LEO_SCALE)
    leo.group.position.y = 2.2
    g.add(leo.group)
  }

  // ═══ SW · O Jardim Ordinal ════════════════════════════════════════════════
  function* fOrdinal(): Tarefa {
    const rel = novoRelogio()
    const [cx, cz] = ORDINAL_CENTER
    // um chão de saibro claro dentro do círculo, e a borda de pedra: nada disto
    // depende de rede, então vem antes de consultar a caixa dos cristais
    const floor = new THREE.Mesh(track(new THREE.CircleGeometry(ORDINAL_RING_R + 6, 64)), track(new THREE.MeshStandardMaterial({ color: 0x2a2825, roughness: 1 })))
    floor.rotation.x = -Math.PI / 2
    floor.position.set(cx, yAt(cx, cz) + 0.28, cz)
    floor.receiveShadow = true
    group.add(floor)
    const kerb = new THREE.Mesh(track(new THREE.RingGeometry(ORDINAL_RING_R + 5.6, ORDINAL_RING_R + 6.4, 96)), track(new THREE.MeshBasicMaterial({ color: 0xF2EAD6, toneMapped: false, transparent: true, opacity: 0.5 })))
    kerb.rotation.x = -Math.PI / 2
    kerb.position.set(cx, yAt(cx, cz) + 0.36, cz)
    group.add(kerb)
    // Cessão INCONDICIONAL antes de uma placa: `makePlaque` desenha um canvas de
    // 1024×560 com título, corpo quebrado em linhas e rodapé, e é indivisível
    // daqui (é uma função, não um gerador). Não medi o custo dela; cedo por
    // regra, para ela nunca somar com o que veio antes dentro da mesma fatia.
    // Custa um quadro, e a peça é de fundo.
    yield; rel.reinicia()
    // sem luz própria: as marcas das pedras já emitem
    // as duas placas na alameda: a Teoria Ordinal e a Runestone
    const [p1, p2] = ORDINAL_PLAQUES
    const a = QUADRANT_ANGLE.SW
    const q1 = makePlaque({
      title: 'ORDINAL THEORY',
      body: 'Every satoshi has a number, given by the order in which it was mined. An inscription writes on one of them, and the number carries the writing forever. Bitcoin learned to remember. 2022.',
      foot: 'THE ORDINAL GARDEN',
    }, track)
    q1.position.set(p1[0], yAt(p1[0], p1[1]), p1[1]); q1.rotation.y = faceAxisYaw(a, 12); group.add(q1); cullText(q1, p1[0], p1[1])
    // Cessão INCONDICIONAL antes de uma placa: `makePlaque` desenha um canvas de
    // 1024×560 com título, corpo quebrado em linhas e rodapé, e é indivisível
    // daqui (é uma função, não um gerador). Não medi o custo dela; cedo por
    // regra, para ela nunca somar com o que veio antes dentro da mesma fatia.
    // Custa um quadro, e a peça é de fundo.
    yield; rel.reinicia()
    const q2 = makePlaque({
      title: 'THE RUNESTONE',
      body: 'One stone inscribed to 112,383 wallets, the largest airdrop of its kind. Months later, DOG • GO • TO • THE • MOON fell on the same wallets. The stones in this circle are the same stone that stands 500 metres tall in the park.',
      foot: 'RUNESTONE ORDINAL PARK · 5 KM NORTH-EAST',
    }, track)
    q2.position.set(p2[0], yAt(p2[0], p2[1]), p2[1]); q2.rotation.y = faceAxisYaw(a, -12); group.add(q2); cullText(q2, p2[0], p2[1])

    // as pedras, quando o crystals.glb e as duas texturas chegarem
    while (!cxOrdinal.pronta) yield
    const carga = cxOrdinal.valor
    if (!carga) return // o aviso já saiu na carga; o jardim fica com o chão e as placas
    rel.reinicia()
    const crystals = carga[0]
    const bcTex = carga[1][0], nmTex = carga[1][1]
    track(bcTex); track(nmTex)
    const geos: THREE.BufferGeometry[] = []
    crystals.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { const idx = Number((o.name.match(/CRYSTAL_(\d+)/) || [])[1]); if (!Number.isNaN(idx)) geos[idx] = m.geometry } })
    if (rel.estourou()) { yield; rel.reinicia() }
    // A malha do crystals.glb vem de PONTA PARA BAIXO: y de −2,96 (a ponta) a
    // −0,19 (a base), medido em runtime. No parque as matrizes do Blender trazem
    // o giro que a endireita; aqui a pedra é virada de propósito (π em torno de x,
    // antes do giro em y) e a base, que passa a ficar em +0,19·s, assenta no chão.
    const FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI)
    const upright = (yaw: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)).multiply(FLIP)
    const baseAfterFlip = (bg: THREE.BufferGeometry) => { bg.computeBoundingBox(); return -bg.boundingBox!.max.y } // 0,19
    const stoneMat = track(crystalMaterialFor(TIERS[6], bcTex, nmTex)) // T4: pedras médias, marca a 1,4
    const bigMat = track(crystalMaterialFor(TIERS[4], bcTex, nmTex))   // T5 para a do centro
    if (rel.estourou()) { yield; rel.reinicia() }
    const ringGeo = geos[6] ?? geos[0]
    const ringBase = baseAfterFlip(ringGeo)
    const ring = new THREE.InstancedMesh(ringGeo, stoneMat, ORDINAL_STONES)
    const o = new THREE.Object3D()
    for (let i = 0; i < ORDINAL_STONES; i++) {
      const ang = (i / ORDINAL_STONES) * Math.PI * 2
      const x = cx + Math.cos(ang) * ORDINAL_RING_R, z = cz + Math.sin(ang) * ORDINAL_RING_R
      const s = 2.2 + ((i * 7) % 5) * 0.28 // 6..9 m
      // enterrada 28 %, como no parque: a pedra afunila nas duas pontas e, só
      // encostada, parecia flutuar
      o.position.set(x, yAt(x, z) - ringBase * s + 0.2 - 0.78 * s, z)
      o.quaternion.copy(upright(-ang + Math.PI / 2 + 0.2))
      o.scale.setScalar(s)
      o.updateMatrix()
      ring.setMatrixAt(i, o.matrix)
      // CEDER AQUI DENTRO NÃO CUSTA A INSTÂNCIA: o `InstancedMesh` já existe e
      // as matrizes vão sendo escritas no buffer; só o `needsUpdate` fica para o
      // fim. Uma chamada de desenho, como antes.
      if (rel.estourou()) { yield; rel.reinicia() }
    }
    ring.instanceMatrix.needsUpdate = true
    ring.castShadow = ring.receiveShadow = true
    group.add(ring)
    if (rel.estourou()) { yield; rel.reinicia() }
    const bigGeo = geos[4] ?? geos[0]
    const big = new THREE.Mesh(bigGeo, bigMat)
    const S = 5.2 // 14 m
    big.position.set(cx, yAt(cx, cz) - baseAfterFlip(bigGeo) * S + 0.2 - 0.78 * S, cz)
    // a marca da pedra central olha para o Chalé (o sul)
    big.quaternion.copy(upright(Math.atan2(0 - cx, 620 - cz)))
    big.scale.setScalar(S)
    big.castShadow = big.receiveShadow = true
    group.add(big)
  }

  // ═══ Sketchfab: o busto do Satoshi ════════════════════════════════════════
  // (créditos em sf-assets.ts; CC-BY exige nome do autor, e ele está no menu Places)
  // as palmeiras passaram para props-table.ts (tamareira de verdade)
  function* fBusto(): Tarefa {
    const rel = novoRelogio()
    // o busto de bronze na entrada da alameda do Espelho: quem vem do deck o
    // encontra antes da figura que some na água. Dois Satoshis: o que se vê e
    // o que desaparece.
    const [bx, bz] = BUST_POS
    const by = yAt(bx, bz)
    const g = new THREE.Group()
    g.position.set(bx, by, bz)
    g.rotation.y = Math.atan2(-bx, -bz) // o rosto (e a placa) para o centro da praça
    const plinth = new THREE.Mesh(track(new THREE.CylinderGeometry(3.1, 3.4, 1.5, 40)), graniteMat)
    plinth.position.y = 0.75
    plinth.castShadow = plinth.receiveShadow = true
    g.add(plinth)
    const rim = new THREE.Mesh(track(new THREE.TorusGeometry(3.15, 0.06, 8, 64)), brassMat)
    rim.rotation.x = Math.PI / 2
    rim.position.y = 1.52
    g.add(rim)
    if (rel.estourou()) { yield; rel.reinicia() }
    const insc = new THREE.Mesh(track(new THREE.PlaneGeometry(4.4, 0.9)), track(new THREE.MeshBasicMaterial({
      map: track(textTexture({ w: 1024, h: 200, bg: '#121317', lines: [
        { text: 'SATOSHI NAKAMOTO', size: 54, font: '700', color: '#f2ead6', y: 66, letterSpacing: 10 },
        { text: 'no face, no name, no key that anyone can turn', size: 28, color: '#a89b80', y: 138 },
      ] })), toneMapped: false,
    })))
    insc.position.set(0, 0.78, 3.42)
    insc.rotation.x = -0.18
    g.add(insc)
    group.add(g)
    // o foco no passeio e a poça no plinto: a luz que havia aqui era um halo
    // de 50 m de alcance em volta de um busto de pouco mais de 3 m
    uplight(bx + 4, bz + 2, 0.8)
    wash(bx, bz, 3.4, 0xfff0dc) // 3,4 é o raio do plinto
    cullText(insc, bx, bz)

    while (!cxBust.pronta) yield
    const bust = cxBust.valor
    if (!bust) return // `loadSf` já avisou; o plinto fica, e ele é uma peça do passeio
    dressSf(bust, { envMapIntensity: 0.85, roughness: 0.55 }) // bronze de museu, não troféu
    bust.scale.setScalar(1.35)
    bust.position.y = 1.5
    g.add(bust)
  }

  // ═══ as poças dos quatro jardins numa malha só ════════════════════════════
  // uma chamada de desenho para tudo o que substituiu as oito luzes.
  // TEM DE SER O ÚLTIMO: `pools` só está completo depois que todas as peças
  // acima chamaram `uplight`/`wash`. Se uma peça cair, a poça dela some junto e
  // o resto continua certo.
  let pool: Pool | null = null
  let poolBase = 0
  function* fPocas(): Tarefa {
    if (!pools.length) return
    yield // fatia própria: a fusão é uma passada de escrita em ~35 chapas de quatro vértices
    pool = track(makeGroundPool(pools, { texture: glowTex, name: 'MonumentPools' }))
    group.add(pool.object)
    poolBase = pool.material.opacity
  }

  const trabalhos: Trabalho[] = [
    { nome: 'The Whitepaper Garden', peso: 12, faixa: 2, fatia: fWhitepaper },
    { nome: 'The Genesis Block', peso: 8, faixa: 2, fatia: fGenesis },
    { nome: 'The Satoshi Mirror', peso: 2, faixa: 2, fatia: fEspelho },
    { nome: 'The Diamond Paw', peso: 10, faixa: 2, fatia: fPata },
    { nome: 'The Ordinal Garden', peso: 6, faixa: 2, fatia: fOrdinal },
    { nome: 'Leonidas', peso: 6, faixa: 2, fatia: fLeonidas },
    { nome: 'The Satoshi bust', peso: 3, faixa: 2, fatia: fBusto },
    { nome: 'Monument lights', peso: 1, faixa: 2, fatia: fPocas },
  ]

  return {
    group,
    trabalhos,
    update(t) {
      for (const p of pulses) p.m.emissiveIntensity = p.base * (0.9 + 0.1 * Math.sin(t * 0.7))
      for (const l of lights) l.intensity = (l.userData.base ??= l.intensity) * (0.94 + 0.06 * Math.sin(t * 1.3 + l.position.x * 0.03))
      // a poça respira na mesma cadência que as luzes faziam: sem isso a praça
      // fica acesa mas parada, e é o movimento que faz parecer instalação viva
      // (só depois que ela existe: `update` roda com a obra pela metade)
      if (pool) pool.material.opacity = poolBase * (0.94 + 0.06 * Math.sin(t * 1.3))
    },
    dispose() { for (const d of disposables) d.dispose() },
  }
}

/**
 * O caminho antigo, mantido enquanto o orquestrador não religa na `Obra`: uma
 * promessa que resolve com tudo montado.
 *
 * ⚠️ ELE JÁ NÃO É UM MONOLITO. Drena os mesmos geradores, mas devolve a thread
 * ao navegador a cada 8 ms de trabalho: as duas tarefas de 5.490 e 4.498 ms
 * viram tarefas de no máximo ~8 ms mais o custo de uma operação indivisível.
 * O `setTimeout(0)` é obrigatório e não pode virar `await Promise.resolve()`:
 * microtarefa não devolve a thread ao laço de eventos, e um laço de microtarefas
 * que se re-agenda trava a aba para sempre.
 */
export async function buildMonuments(opts: MonumentsOpts): Promise<Monuments> {
  const obra = monumentosEmObra(opts)
  for (const t of obra.trabalhos) {
    const g = t.fatia()
    let t0 = performance.now()
    for (;;) {
      let pronto = false
      try {
        pronto = !!g.next().done
      } catch (err) {
        // uma peça que morre não leva os monumentos junto, que é a mesma regra
        // da `Obra`: a praça abre com um jardim a menos e o log conta qual
        console.error(`[plaza] monumento "${t.nome}" caiu e foi descartado`, err)
        break
      }
      if (pronto) break
      if (performance.now() - t0 > 8) {
        await new Promise<void>((res) => setTimeout(res, 0))
        t0 = performance.now()
      }
    }
  }
  return { group: obra.group, update: obra.update, dispose: obra.dispose }
}
