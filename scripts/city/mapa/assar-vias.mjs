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
// Uso:  node scripts/city/mapa/assar-vias.mjs [--porta=3000] [--saida=public/city/mapa/vias.json] [--prazo=900000]
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from '/home/bitmax/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1]
const PORTA = arg('porta', 3000)
const SAIDA = arg('saida', 'public/city/mapa/vias.json')
const PRAZO = +arg('prazo', 900000)
const TETO_BYTES = 3 * 1024 * 1024

mkdirSync(SAIDA.split('/').slice(0, -1).join('/') || '.', { recursive: true })

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
  const url = `http://localhost:${PORTA}/city?stats=1&quality=high&view=deck&live=0&look=2`
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

  let saida = bruto
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
