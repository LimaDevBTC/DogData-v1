#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ASSAR A REDE VIÁRIA PARA O MAPA 2D: public/city/mapa/vias.json.
//
// ⚠️ POR QUE ISTO EXISTE, 23/09/2026. O fundador olhou a chapa do /city/mapa e
// achou dois defeitos que já tinham sido resolvidos: "tem radial em cima da
// água, tem dodecaedro na orla nobre". Os dois foram resolvidos na CENA 3D
// (`app/city/plaza/vias.ts`, `teia.ts`) meses atrás — a AN7 é círculo desde
// 07/09, a teia para na água desde 03/09 — mas o mapa 2D (`app/city/mapa/
// malha.ts`) nunca lia esse resultado: ele REDERIVAVA a malha a partir do
// manifesto cru (`public/city/mapa-v1.json`), que publica a AN7 como o
// dodecágono de vértice 7.600 que a nota de `AVENIDA_ALCA` em teia.ts chama
// explicitamente de "o valor ABANDONADO", e sem nenhuma das regras de água,
// alça e orla que só existem em código. RÉPLICA DIVERGE; A FONTE NÃO.
//
// ⚠️ POR QUE É PLAYWRIGHT E NÃO NODE PURO (como `congelar-mapa.ts` faz para o
// traçado da teia). A rede final depende de ONDE ESTÁ A ÁGUA — `lagos.ts`
// classifica cada corpo por vão (ponte ou bloqueio) e devolve os eixos de orla
// já recuados da margem, e isso nasce dentro da cena, a partir do terreno
// carregado (`heightAt`/`superficieAt`, que por sua vez leem a malha assada do
// relevo). Reimplementar essa classificação em Node seria escrever a mesma
// regra pela SEGUNDA vez, o defeito exato que esta tarefa veio consertar; ler
// da cena viva, do jeito que `vias-varredura.mjs` já lê para auditar
// conectividade, é a única forma de garantir que o mapa 2D nunca diverge dela
// de novo.
//
// ⚠️ O GANCHO: `window.__plazaVias()`, atrás de `?stats=1`, em vias.ts. Ele
// devolve exatamente os segmentos que `buildVias` desenhou — cada um já vivo,
// já cortado por água/alça/orla e, na teia fina, já podado por componente
// conexo (a mesma poda que decide o que É rede em `vias-varredura.mjs`). Este
// script não decide nada: se um trecho sair errado, o defeito está em
// `vias.ts`, não aqui.
//
// ⚠️ RODADA 2, 23/09: A AVENIDA É A EXCEÇÃO A ESSA REGRA, E ELA MESMA PRECISA
// DE CONSERTO AQUI. `dumpSeg('avenida', ...)` (vias.ts:2289) grava o cordão
// NOMINAL inteiro de cada bulevar (o comentário ali diz "nunca cruza água por
// construção", o que só vale para o RAIO do sítio, não para o terreno no meio
// do caminho); mas o laço que de fato desenha o asfalto (`faixa`, mesmo
// arquivo, `if (paraNaAgua(mx, mz)) continue`, vias.ts:1844) não desenha pista
// sobre água larga. Anel, radial e travessa não têm este problema porque o
// `dumpSeg` deles mora DENTRO desse laço (só grava o que sobreviveu ao mesmo
// teste); o da avenida foi escrito ANTES dele rodar.
//
// Visto na chapa `mar` de `scripts/city/chapas.mjs`: a avenida de rumo ~50
// vira um cais reto que MORRE no meio da baía, sem alcançar a AN7 — o "radial
// em cima da água" que o fundador apontou, só que desta vez na avenida, não na
// teia (que já tinha sido corrigida em 03/09). `corrigirAvenidas`, abaixo,
// reaplica sobre o dump a MESMA régua que a cena usa para as outras vias: a
// mesma lâmina d'água (-40 m, `lagos.ts` `cota`) e o mesmo `LIMIAR_PONTE`
// (150 m, `app/city/plaza/lagos.ts:250`) que decide anel e teia. Não é uma
// segunda regra: é a regra da cena, medida aqui porque só aqui ela nunca tinha
// sido consultada.
//
// Uso:  node scripts/city/mapa/assar-vias.mjs [--porta=3000] [--saida=public/city/mapa/vias.json] [--prazo=900000]
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from '/home/bitmax/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = resolve(AQUI, '../../..')

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1]
const PORTA = arg('porta', 3000)
const SAIDA = arg('saida', 'public/city/mapa/vias.json')
const PRAZO = +arg('prazo', 900000)
// ⚠️ SÓ DESENVOLVIMENTO (tarefa da selagem fora do git, 23/09): `--reg=NOME`
// acrescenta `&reg=NOME` à URL da cena, o MESMO override de `registro-dev.ts`
// que aponta cidade.json/malha/bins para `public/city/NOME/`. Sem `--reg=`,
// a URL sai idêntica à de sempre e o dump lê `public/city/` normal.
const REG = arg('reg', '')
const TETO_BYTES = 3 * 1024 * 1024

mkdirSync(SAIDA.split('/').slice(0, -1).join('/') || '.', { recursive: true })

// ── a MESMA superfície que a cena consulta para desenhar (`superficieAt`),
// assada offline em data/superficie.f32 (doutrina igual à de scripts/city/
// carta.mjs, que já usa este par de arquivos para o mesmo fim). Lida em Node
// puro, sem depender do navegador: é só leitura de grade, não classificação
// de corpo d'água (essa continua vindo de dentro da cena, para tudo que não é
// avenida — ver o cabeçalho).
function carregarSuperficie() {
  const meta = JSON.parse(readFileSync(resolve(process.env.SUPERFICIE_DIR || resolve(RAIZ, 'data'), 'superficie.json'), 'utf8'))
  const buf = readFileSync(resolve(process.env.SUPERFICIE_DIR || resolve(RAIZ, 'data'), 'superficie.f32'))
  const H = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + meta.n * meta.n * 4))
  return { H, n: meta.n, R: meta.raio, cel: (2 * meta.raio) / (meta.n - 1) }
}
const SUP = carregarSuperficie()
const alturaEm = (x, z) => {
  const { H, n, R, cel } = SUP
  const fi = (x + R) / cel, fj = (z + R) / cel
  const i = Math.max(0, Math.min(n - 2, Math.floor(fi))), j = Math.max(0, Math.min(n - 2, Math.floor(fj)))
  const u = fi - i, v = fj - j
  return H[j * n + i] * (1 - u) * (1 - v) + H[j * n + i + 1] * u * (1 - v)
    + H[(j + 1) * n + i] * (1 - u) * v + H[(j + 1) * n + i + 1] * u * v
}
const COTA_AGUA = -40      // lagos.ts: `cota`, a lâmina única da cidade
const LIMIAR_PONTE = 150   // app/city/plaza/lagos.ts:250, a régua de anel e teia
const naAgua = (x, z) => alturaEm(x, z) < COTA_AGUA
// ⚠️ A AVENIDA TAMBÉM NÃO É DESENHADA NA TERRA DA ALÇA (`faixa()` pula `naAlca` em
// vias.ts), e o dump gravava o cordão inteiro: os pedaços A0b a A3b (r 6.580 a 7.050)
// eram avenida fantasma em cima da Orla Nobre. A regra é a de `naAlcaDeTerra`, com os
// números LIDOS de teia.ts.
const _teiaTs = readFileSync(resolve(RAIZ, 'app/city/plaza/teia.ts'), 'utf8')
const _mR = _teiaTs.match(/export const ALCA_R_DENTRO\s*=\s*([0-9.]+)/)
const _mT = _teiaTs.match(/export const ALCA_TERRA[^=]*=\s*\[\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\]/)
if (!_mR || !_mT) throw new Error('assar-vias: ALCA_R_DENTRO ou ALCA_TERRA mudou de forma em teia.ts')
const ALCA_R_DENTRO = Number(_mR[1]), ALCA_A0 = Number(_mT[1]), ALCA_A1 = Number(_mT[2])
const naAlca = (x, z) => {
  if (Math.hypot(x, z) < ALCA_R_DENTRO) return false
  const a = ((Math.atan2(x, -z) * 180) / Math.PI + 360) % 360
  return ALCA_A0 <= ALCA_A1 ? a >= ALCA_A0 && a <= ALCA_A1 : a >= ALCA_A0 || a <= ALCA_A1
}

/** reamostra cada avenida a cada 10 m contra `naAgua` e corta onde o vão de
 *  água passa de `LIMIAR_PONTE` (ver a doutrina grande no cabeçalho). Um vão
 *  curto (ponte) não muda nada: a avenida é reta, então o cordão de 2 pontos
 *  já cobre ponte e terra dos dois lados sem precisar marcar nada à parte. Um
 *  vão longo (bloqueio) fecha o pedaço na última terra antes dele e abre um
 *  novo pedaço (`id` com sufixo de letra) na primeira terra depois. */
function corrigirAvenidas(bruto) {
  const PASSO = 10
  const saida = []
  let avenidasTocadas = 0, cortesTotal = 0, metrosCortados = 0
  for (const seg of bruto) {
    if (seg.tipo !== 'avenida') { saida.push(seg); continue }
    const [[x0, z0], [x1, z1]] = seg.pontos
    const comp = Math.hypot(x1 - x0, z1 - z0)
    const n = Math.max(1, Math.round(comp / PASSO))
    const pts = Array.from({ length: n + 1 }, (_, k) => {
      const t = k / n
      return [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]
    })
    const molhado = pts.map(([x, z]) => naAgua(x, z) || naAlca(x, z))
    if (!molhado.includes(true)) { saida.push(seg); continue }
    avenidasTocadas++

    // runs contíguas de água, [inicio, fimExclusivo)
    const runs = []
    for (let i = 0; i <= n;) {
      if (molhado[i]) { let j = i; while (j <= n && molhado[j]) j++; runs.push([i, j]); i = j } else i++
    }
    // só os vãos REAIS (ponta seca antes -> ponta seca depois) acima do limiar
    const cortes = []
    for (const [ini, fim] of runs) {
      const a = pts[Math.max(0, ini - 1)], b = pts[Math.min(n, fim)]
      const vao = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (vao > LIMIAR_PONTE) cortes.push([ini, fim, vao])
    }
    if (!cortes.length) { saida.push(seg); continue }   // só pontes curtas: sem mudar nada

    let inicioPedaco = 0
    const pedacos = []
    for (const [ini, fim, vao] of cortes) {
      const fimPedaco = Math.max(0, ini - 1)
      if (fimPedaco > inicioPedaco) pedacos.push([pts[inicioPedaco], pts[fimPedaco]])
      cortesTotal++
      metrosCortados += vao
      inicioPedaco = Math.min(n, fim)
    }
    if (inicioPedaco < n) pedacos.push([pts[inicioPedaco], pts[n]])

    pedacos.forEach((p, k) => {
      saida.push({ ...seg, id: pedacos.length > 1 ? `${seg.id}${String.fromCharCode(97 + k)}` : seg.id, pontos: p })
    })
  }
  console.log(`[avenidas] ${avenidasTocadas} avenida(s) tocam água; ${cortesTotal} vão(s) > ${LIMIAR_PONTE} m `
    + `cortado(s) (${metrosCortados.toFixed(0)} m de vão removidos no total)`)
  return saida
}

// ── Douglas-Peucker, só usado se o dump cru estourar o teto de 3 MB ─────────
// (ver a doutrina no cabeçalho: o dump normal já sai em atômicos de 2 pontos,
// então isto só entra em ação depois de ENCADEAR trechos vizinhos do mesmo
// tipo/largura que se tocam ponta a ponta — sem encadear, simplificar um
// segmento de 2 pontos não tira ponto nenhum.)
function dp(pontos, tol) {
  if (pontos.length < 3) return pontos
  let iMax = -1, dMax = 0
  const [ax, az] = pontos[0], [bx, bz] = pontos[pontos.length - 1]
  const dx = bx - ax, dz = bz - az
  const L = Math.hypot(dx, dz) || 1
  for (let i = 1; i < pontos.length - 1; i++) {
    const [px, pz] = pontos[i]
    const d = Math.abs((px - ax) * dz - (pz - az) * dx) / L
    if (d > dMax) { dMax = d; iMax = i }
  }
  if (dMax <= tol) return [pontos[0], pontos[pontos.length - 1]]
  const esq = dp(pontos.slice(0, iMax + 1), tol)
  const dir = dp(pontos.slice(iMax), tol)
  return esq.slice(0, -1).concat(dir)
}

/** encadeia segmentos atômicos {tipo,larg,pontos:[[a],[b]]} num punhado de
 *  polilinhas mais longas, unindo quem tem o MESMO tipo+largura e cuja ponta
 *  encosta na ponta do próximo (a 5 cm, a folga do arredondamento de 1
 *  decimal que `dumpSeg` já aplicou em vias.ts). Não muda a geometria, só o
 *  número de arrays: é o que dá corda pro Douglas-Peucker morder. */
function encadear(segs) {
  const chave = (s) => `${s.tipo}|${s.larg}`
  const porChave = new Map()
  for (const s of segs) {
    const k = chave(s)
    if (!porChave.has(k)) porChave.set(k, [])
    porChave.get(k).push(s)
  }
  const near = (a, b) => Math.abs(a[0] - b[0]) < 0.06 && Math.abs(a[1] - b[1]) < 0.06
  const out = []
  for (const [k, lista] of porChave) {
    const [tipo, largS] = k.split('|')
    const larg = +largS
    const usados = new Uint8Array(lista.length)
    // índice por ponta, para achar o próximo trecho em O(1) amortizado em vez
    // de O(n²) numa lista de milhares de arestas da teia
    const porPonta = new Map()
    const rot = (p) => `${Math.round(p[0] * 20)},${Math.round(p[1] * 20)}` // grade de 5 cm
    for (let i = 0; i < lista.length; i++) {
      for (const p of [lista[i].pontos[0], lista[i].pontos[lista[i].pontos.length - 1]]) {
        const r = rot(p)
        if (!porPonta.has(r)) porPonta.set(r, [])
        porPonta.get(r).push(i)
      }
    }
    for (let i = 0; i < lista.length; i++) {
      if (usados[i]) continue
      usados[i] = 1
      let cadeia = lista[i].pontos.slice()
      // estica pelas duas pontas enquanto achar vizinho não usado
      for (const ponta of ['fim', 'ini']) {
        for (;;) {
          const alvo = ponta === 'fim' ? cadeia[cadeia.length - 1] : cadeia[0]
          const candidatos = porPonta.get(rot(alvo)) || []
          const prox = candidatos.find((j) => !usados[j])
          if (prox === undefined) break
          usados[prox] = 1
          const seg = lista[prox].pontos
          const a0 = seg[0], a1 = seg[seg.length - 1]
          if (ponta === 'fim') {
            cadeia = near(alvo, a0) ? cadeia.concat(seg.slice(1)) : cadeia.concat(seg.slice(0, -1).reverse(), [a0])
          } else {
            cadeia = near(alvo, a1) ? seg.slice(0, -1).concat(cadeia) : seg.slice(1).reverse().concat(cadeia)
          }
        }
      }
      out.push({ tipo, larg, pontos: cadeia })
    }
  }
  return out
}

const nav = await chromium.launch()
try {
  const pag = await (await nav.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  const url = `http://localhost:${PORTA}/city?stats=1&quality=high&view=deck&live=0&look=2${REG ? `&reg=${encodeURIComponent(REG)}` : ''}`
  console.log(`carregando ${url}`)
  await pag.goto(url, { waitUntil: 'domcontentloaded' })
  await pag.waitForFunction(() => !!window.__plazaScene && !!window.__plazaPerfil, null, { timeout: PRAZO })
  await pag.waitForFunction(() => window.__plazaPronto === true, null, { timeout: PRAZO })
  // ⚠️ MESMA FOLGA DE `vias-varredura.mjs`: `__plazaPronto` marca a cena de pé,
  // mas a última camada de guia/marca ainda termina de subir alguns quadros
  // depois; o dump em si já está completo (é escrito dentro de `buildVias`,
  // síncrono), a espera é só para não correr atrás de um fetch em voo de outro
  // módulo que compartilha o mesmo tick de boot.
  await pag.waitForTimeout(2000)

  const bruto = await pag.evaluate(() => {
    if (typeof window.__plazaVias !== 'function') return null
    return window.__plazaVias()
  })
  if (!bruto) {
    throw new Error(
      '__plazaVias() não existe ou devolveu vazio. Confira: (1) a página carregou com ?stats=1; '
      + '(2) vias.ts publica STATS_URL -> window.__plazaVias antes deste ponto; '
      + '(3) o dev server não está servindo um bundle antigo (reinicie o `next dev` depois de editar vias.ts).',
    )
  }
  console.log(`dump cru: ${bruto.length.toLocaleString('pt-BR')} segmentos`)

  let saida = corrigirAvenidas(bruto)
  let cru = JSON.stringify(saida)
  console.log(`tamanho cru: ${(cru.length / 1024).toFixed(1)} KB`)

  if (cru.length > TETO_BYTES) {
    console.log(`> 3 MB: encadeando e simplificando (Douglas-Peucker, 2 m)`)
    const r1m = (p) => [Math.round(p[0]), Math.round(p[1])]
    const cadeias = encadear(saida)
    saida = cadeias.map((c, i) => ({
      id: `${c.tipo[0].toUpperCase()}${i}`,
      tipo: c.tipo,
      larg: c.larg,
      pontos: dp(c.pontos, 2).map(r1m),
    }))
    cru = JSON.stringify(saida)
    console.log(`tamanho após encadear+DP+quantizar a 1 m: ${(cru.length / 1024).toFixed(1)} KB, `
      + `${saida.length.toLocaleString('pt-BR')} polilinhas`)
  }

  writeFileSync(SAIDA, cru)
  console.log(`gravado ${SAIDA}: ${(cru.length / 1024).toFixed(1)} KB, ${saida.length.toLocaleString('pt-BR')} entradas`)

  const porTipo = new Map()
  for (const s of saida) porTipo.set(s.tipo, (porTipo.get(s.tipo) || 0) + 1)
  for (const [t, n] of [...porTipo].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t.padEnd(10)} ${n.toLocaleString('pt-BR')}`)
  }
} finally {
  await nav.close()
}
