#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUDITORIA DE CONECTIVIDADE DO PAVIMENTO DESENHADO.
//
// ⚠️ NAO LE `cidade-malha.json`, E ISSO E O PONTO. O json publica o EIXO
// PLANEJADO e ele NAO e o que a cena desenha: o anel virado poligono tem o meio
// da corda em cos(15 graus) = 96,6% do raio, e `vias.ts` ainda TROCA
// `malha.bulevares` pelo proprio `avenidasGeom()`. Medir o plano contra o
// desenho inventa centenas de "buracos" que sao so a diferenca entre circulo e
// dodecagono. A pergunta do fundador ("pedacos de estrada que nao ligam nada")
// e sobre o desenho contra ele mesmo, e se responde com componente conexo.
//
// Rasteriza toda superficie dirigivel numa grade e roda flood fill. O maior
// componente e a rede; todo o resto e ilha, e ilha e o defeito.
//
// Uso:  node scripts/city/vias-varredura.mjs [--cel=6] [--saida=...]
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from '/home/bitmax/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1]
const CEL = +arg('cel', 6)
const SAIDA = arg('saida', '/tmp/vias')
const PRAZO = +arg('prazo', 900000)

mkdirSync(SAIDA, { recursive: true })
const nav = await chromium.launch()
try {
  const pag = await (await nav.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  const url = 'http://localhost:3000/city?stats=1&quality=high&view=deck&live=0&look=2'
  console.log(`carregando ${url}`)
  await pag.goto(url, { waitUntil: 'domcontentloaded' })
  await pag.waitForFunction(() => !!window.__plazaScene && !!window.__plazaPerfil, null, { timeout: PRAZO })
  await pag.waitForFunction(() => window.__plazaPronto === true, null, { timeout: PRAZO })
  await pag.waitForTimeout(4000)
  console.log('cena pronta, rasterizando o pavimento')

  await pag.evaluate((d) => { window.__dilata = d }, +arg('dilata', 0))
  const res = await pag.evaluate(async ({ CEL }) => {
    const cena = window.__plazaScene
    const THREE = window.__plazaTHREE
    // ⚠️ SO SUPERFICIE DIRIGIVEL. Calcada, meio-fio e canteiro nao ligam nada:
    // incluir a calcada costuraria trechos que um carro nao percorre.
    // ⚠️ `canais:#8E856F` ENTRA PORQUE E O TABULEIRO DA PONTE. Em canais.ts a
    // ponte e desenhada com `B(COR_CAIS)`, que vira essa malha por cor; sem ela
    // toda travessia de canal aparece como interrupcao da rede e o relatorio
    // acusa buraco onde existe ponte. O passeio de cima do canal compartilha a
    // cor, entao componente que so existe por causa dessa fonte fica marcado.
    const DIRIGIVEL = new Set(['via:pista', 'orla:pista', 'eclusas:pista', 'canais:#8E856F'])
    const cel = new Map()               // chave -> nome da fonte
    const chave = (i, j) => (i + 4096) * 16384 + (j + 4096)
    const dechave = (c) => [Math.floor(c / 16384) - 4096, (c % 16384) - 4096]
    const v = new THREE.Vector3()
    cena.traverse((o) => {
      if (!o.isMesh || !DIRIGIVEL.has(o.name)) return
      o.updateWorldMatrix(true, false)
      const g = o.geometry, p = g.attributes.position, idx = g.index
      const n = idx ? idx.count : p.count
      const pt = (k) => {
        const a = idx ? idx.getX(k) : k
        v.set(p.getX(a), p.getY(a), p.getZ(a)).applyMatrix4(o.matrixWorld)
        return [v.x, v.z]
      }
      for (let k = 0; k + 2 < n; k += 3) {
        const A = pt(k), B = pt(k + 1), C = pt(k + 2)
        const i0 = Math.floor(Math.min(A[0], B[0], C[0]) / CEL), i1 = Math.floor(Math.max(A[0], B[0], C[0]) / CEL)
        const j0 = Math.floor(Math.min(A[1], B[1], C[1]) / CEL), j1 = Math.floor(Math.max(A[1], B[1], C[1]) / CEL)
        if ((i1 - i0) > 400 || (j1 - j0) > 400) continue
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
          const cx = i * CEL + CEL / 2, cz = j * CEL + CEL / 2
          const d1 = (B[0] - A[0]) * (cz - A[1]) - (B[1] - A[1]) * (cx - A[0])
          const d2 = (C[0] - B[0]) * (cz - B[1]) - (C[1] - B[1]) * (cx - B[0])
          const d3 = (A[0] - C[0]) * (cz - C[1]) - (A[1] - C[1]) * (cx - C[0])
          if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) {
            const q = chave(i, j)
            if (!cel.has(q)) cel.set(q, o.name)
          }
        }
      }
    })

    // ⚠️ A DILATACAO DE UMA CELULA E DIAGNOSTICO, NAO COSMETICA. Rodar com e sem
    // separa dois defeitos que a contagem crua confunde: pavimento que de fato
    // nao se liga, e pavimento que se liga mas cujo triangulo nao cobriu o
    // centro de uma celula da grade. Se a ilha some com 6 m de dilatacao ela era
    // artefato de medida, nao buraco na cidade.
    const DILATA = +(new URLSearchParams(location.search).get('_') || 0) || window.__dilata || 0
    for (let d = 0; d < DILATA; d++) {
      const add = []
      for (const q of cel.keys()) {
        const i = Math.floor(q / 16384) - 4096, j = (q % 16384) - 4096
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nq = chave(i + di, j + dj)
          if (!cel.has(nq)) add.push([nq, cel.get(q)])
        }
      }
      for (const [q, f] of add) if (!cel.has(q)) cel.set(q, f)
    }

    // ⚠️ 8-CONEXO, E NAO 4. Duas fitas que se cruzam em diagonal (anel x bulevar
    // fora do angulo reto) podem se tocar so pela quina de uma celula; com
    // 4-conexo cada uma vira ilha e o relatorio inventa defeito.
    const comp = new Map()
    const grupos = []
    for (const q of cel.keys()) {
      if (comp.has(q)) continue
      const id = grupos.length
      const pilha = [q], membros = []
      comp.set(q, id)
      while (pilha.length) {
        const c = pilha.pop(); membros.push(c)
        const [i, j] = dechave(c)
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue
          const nq = chave(i + di, j + dj)
          if (cel.has(nq) && !comp.has(nq)) { comp.set(nq, id); pilha.push(nq) }
        }
      }
      grupos.push(membros)
    }
    grupos.sort((a, b) => b.length - a.length)

    const rede = new Set(grupos[0])
    const perto = (c) => {
      const [i, j] = dechave(c)
      for (let R = 1; R <= 40; R++) {
        for (let di = -R; di <= R; di++) for (let dj = -R; dj <= R; dj++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== R) continue
          if (rede.has(chave(i + di, j + dj))) return R * CEL
        }
      }
      return null
    }

    const ficha = []
    for (let g = 0; g < grupos.length; g++) {
      const m = grupos[g]
      let sx = 0, sz = 0, xi = Infinity, xa = -Infinity, zi = Infinity, za = -Infinity
      const fontes = new Set()
      for (const c of m) {
        const [i, j] = dechave(c)
        const x = i * CEL + CEL / 2, z = j * CEL + CEL / 2
        sx += x; sz += z
        if (x < xi) xi = x; if (x > xa) xa = x
        if (z < zi) zi = z; if (z > za) za = z
        fontes.add(cel.get(c))
      }
      const cx = sx / m.length, cz = sz / m.length
      // a distancia ate a rede: so faz sentido para ilha, e so a menor delas
      let d = null
      if (g > 0) {
        d = Infinity
        for (const c of m) { const dd = perto(c); if (dd !== null && dd < d) d = dd }
        if (d === Infinity) d = null
      }
      ficha.push({
        celulas: m.length, area: Math.round(m.length * CEL * CEL),
        centro: [Math.round(cx), Math.round(cz)], r: Math.round(Math.hypot(cx, cz)),
        extensao: [Math.round(xa - xi), Math.round(za - zi)],
        fontes: [...fontes], ateARede: d,
      })
    }

    // e o pavimento sobre agua: ponte de verdade ou rua deitada no lago
    const perfil = window.__plazaPerfil
    const amostra = [], amChave = []
    for (const q of cel.keys()) { const [i, j] = dechave(q); amChave.push(q); amostra.push([i * CEL + CEL / 2, j * CEL + CEL / 2]) }
    const ys = perfil(amostra)
    let molhadas = 0
    const porComp = new Map()
    for (let k = 0; k < ys.length; k++) if (ys[k] <= -40) {
      molhadas++
      const g = comp.get(amChave[k])
      porComp.set(g, (porComp.get(g) || 0) + 1)
    }
    return { cel: CEL, totalCelulas: cel.size, molhadas, molhadasPorComp: [...porComp].sort((a, b) => b[1] - a[1]).slice(0, 10), grupos: ficha }
  }, { CEL })

  writeFileSync(`${SAIDA}/conexao.json`, JSON.stringify(res, null, 1))
  const km2 = (n) => ((n * res.cel * res.cel) / 1e6).toFixed(2)
  console.log('')
  console.log(`pavimento dirigivel: ${res.totalCelulas.toLocaleString('pt-BR')} celulas de ${res.cel} m = ${km2(res.totalCelulas)} km2`)
  console.log(`${res.grupos.length} componente(s) conexo(s)`)
  console.log('')
  const [rede, ...ilhas] = res.grupos
  console.log(`REDE  ${km2(rede.celulas)} km2 (${(100 * rede.celulas / res.totalCelulas).toFixed(1)}% do pavimento), `
    + `${rede.extensao[0]} x ${rede.extensao[1]} m, fontes: ${rede.fontes.join(' ')}`)
  console.log('')
  const grandes = ilhas.filter((i) => i.area >= 2000)
  console.log(`ILHAS: ${ilhas.length} no total, ${grandes.length} com 2.000 m2 ou mais`)
  for (const i of grandes.slice(0, 40)) {
    console.log(`  ${String(i.area).padStart(7)} m2  r ${String(i.r).padStart(5)}  centro (${i.centro[0]},${i.centro[1]})`
      + `  ${String(i.extensao[0]).padStart(4)}x${String(i.extensao[1]).padStart(4)} m`
      + `  a ${i.ateARede === null ? '>240' : i.ateARede} m da rede  [${i.fontes.join(' ')}]`)
  }
  const somaIlhas = ilhas.reduce((s, i) => s + i.celulas, 0)
  console.log('')
  console.log(`soma das ilhas: ${km2(somaIlhas)} km2 (${(100 * somaIlhas / res.totalCelulas).toFixed(1)}% do pavimento)`)
  console.log(`pavimento abaixo da lamina (-40): ${km2(res.molhadas)} km2 (${(100 * res.molhadas / res.totalCelulas).toFixed(1)}%)`)
} finally {
  await nav.close()
}
