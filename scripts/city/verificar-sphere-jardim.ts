/**
 * Confere o jardim do pódio de THE SPHERE.
 *
 *   npx tsx scripts/city/verificar-sphere-jardim.ts
 *
 * Três perguntas, nesta ordem de importância:
 *
 *  1. **O jardim ANDA JUNTO com a peça?** É o requisito escrito do fundador
 *     ("que possa ser movido junto com ela pra outro lugar"). O teste troca
 *     `SPHERE_MOD` por um módulo vizinho, recarrega o plano e confere que TODO
 *     ponto plantado andou exatamente o mesmo vetor que o centro da esfera.
 *     Uma única coordenada de mundo cravada faz este teste falhar.
 *  2. **O desenho cabe no lote?** Nenhuma peça pode passar da divisa do deck
 *     nem invadir o embasamento, e o cinto tem de ser contínuo nos 360°.
 *  3. **Quanto custa?** Contagem de peças, comprimento de aro e de sebe, área
 *     de canteiro e de piso: os números que vão para `sphere.md`.
 *
 * O que ele NÃO faz: não abre navegador, não mede FPS, não olha os GLB. A
 * chapa é o portão `scripts/city/chapas.mjs`.
 */
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

type P = [number, number]

async function main() {
  // ⚠️ O `document` FALSO PRECISA DE UM CONTEXTO 2D DE VERDADE-O-BASTANTE, e o
  // que o pede é `makeGlowTexture()` (a poça de luz dos postes): ela desenha um
  // gradiente radial num canvas de 64 px. Sem `createRadialGradient` e
  // `fillRect` o módulo do jardim nem carrega fora do navegador, e o custo de
  // geometria não poderia ser medido offline.
  Object.assign(globalThis, {
    document: {
      createElement: () => ({
        width: 0, height: 0,
        getContext: () => ({
          putImageData() {}, fillRect() {}, fillStyle: '',
          createRadialGradient: () => ({ addColorStop() {} }),
        }),
      }),
    },
    ImageData: class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} },
  })

  const plano = await import('../../app/city/plaza/sphere-jardim-plano')
  const S = await import('../../app/city/plaza/sphere')
  const R = plano.resumoDoPlano()

  const num = (n: number, c = 2) => n.toFixed(c)
  console.log('═══ O SÍTIO ═══')
  console.log(`  módulo            ${JSON.stringify(R.modulo)}`)
  console.log(`  centro            (${num(R.centro[0], 1)}, ${num(R.centro[1], 1)})  rumo ${num(R.rumoDeg)}°`)
  console.log(`  círculo inscrito  ${num(R.raioInscrito)} m      vértice mais longe ${num(R.vertice)} m`)

  console.log('\n═══ O PÓDIO (y = deck + 2,20) ═══')
  console.log(`  colar             r ${num(plano.R_COLAR)}`)
  console.log(`  bordadura         r ${num(plano.R_COLAR)} → ${num(plano.R_BORDADURA_EXT)}   larg ${num(plano.BORDADURA_LARG)}`)
  console.log(`  promenade livre   r ${num(plano.R_BORDADURA_EXT)} → ${num(plano.R_COROA - plano.FLOREIRA_R)}   larg ${num(plano.PROMENADE_PODIO)}`)
  console.log(`  coroa (floreiras) r ${num(plano.R_COROA - plano.FLOREIRA_R)} → ${num(plano.R_COROA + plano.FLOREIRA_R)}   eixo ${num(plano.R_COROA)}`)
  console.log(`  balaustrada       r ${num(plano.R_BALAUSTRADA_INT)} → ${num(plano.R_PODIO_EXT)}   alt ${num(plano.PARAPEITO_H)}`)
  const passoCoroa = (2 * Math.PI * plano.R_COROA) / 48
  console.log(`  passo da coroa    ${num(passoCoroa)} m entre vagas (48 vagas de 7,50°)`)

  console.log('\n═══ O DECK (y = 116,4 medido) ═══')
  console.log(`  cinto             r ${num(plano.R_CINTO_INT)} → ${num(plano.R_CINTO_EXT)}   larg ${num(plano.CINTO_LARG)}`)
  console.log(`  passeio de borda  ${num(plano.PASSEIO_BORDA)}   parapeito ${num(plano.PARAPEITO_LARG)} x ${num(plano.PARAPEITO_H)} alt`)
  console.log(`  escadaria         ${R.escada.espelhos} x ${num(R.escada.espelho * 100, 2)} cm de espelho, ${R.escada.espelhos - 1} x ${num(R.escada.piso * 100, 0)} cm de piso`)
  console.log(`                    avanço ${num(R.escada.avanco)} m, largura ${num(R.escada.largura)} m, Blondel ${num(R.escada.blondel * 100, 1)} cm`)
  const peDaEscada = plano.R_PODIO_EXT + plano.ESCADA_AVANCO
  console.log(`                    pé em r ${num(peDaEscada)}, sobra de cinto na frente dela ${num(plano.R_CINTO_EXT - peDaEscada)} m`)

  console.log('\n═══ OS CANTEIROS ═══')
  R.canteiros.forEach((c, i) => {
    const meio = ((c.a0 + c.a1) / 2) * Math.PI / 180
    const prof = plano.raioDoDeck(meio, plano.RECUO_BORDA) - plano.R_CINTO_EXT
    console.log(`  #${i + 1}  φ ${num(c.a0, 1)}° a ${num(c.a1, 1)}°  (${num(c.amplitude, 1)}°)   profundidade no meio ${num(prof)} m`)
  })
  assert.equal(R.canteiros.length, 4, 'o plano tem de dar QUATRO compartimentos')

  // ── área de canteiro e de piso, por integração em coordenada polar ────────
  const N = 2880
  let areaCanteiro = 0, areaPiso = 0, areaDeck = 0
  const dphi = (Math.PI * 2) / N
  for (let i = 0; i < N; i++) {
    const phi = (i + 0.5) * dphi
    const rDeck = plano.raioDoDeck(phi, 0)
    const rBorda = plano.raioDoDeck(phi, plano.RECUO_BORDA)
    areaDeck += 0.5 * rDeck * rDeck * dphi
    // canteiro: a fatia radial que passa em `noCanteiro`
    const passos = 400
    for (let k = 0; k < passos; k++) {
      const r = plano.R_CINTO_EXT + ((k + 0.5) / passos) * Math.max(0, rBorda - plano.R_CINTO_EXT)
      const dr = Math.max(0, rBorda - plano.R_CINTO_EXT) / passos
      if (plano.noCanteiro(r, phi)) areaCanteiro += r * dr * dphi
    }
    // piso: cinto + o que sobra entre o cinto e a divisa que NÃO é canteiro
    areaPiso += 0.5 * (plano.R_CINTO_EXT ** 2 - plano.R_CINTO_INT ** 2) * dphi
    areaPiso += 0.5 * (rDeck ** 2 - plano.R_CINTO_EXT ** 2) * dphi
  }
  areaPiso -= areaCanteiro
  console.log(`  área de canteiro  ${areaCanteiro.toFixed(0)} m²   (${((100 * areaCanteiro) / areaDeck).toFixed(1)}% do deck)`)
  console.log(`  área de piso      ${areaPiso.toFixed(0)} m²   área do deck ${areaDeck.toFixed(0)} m²`)

  console.log('\n═══ A CONTAGEM ═══')
  console.log(`  tamareiras (coroa do pódio)   ${R.contagem.palmeiras}   de 48 vagas`)
  console.log(`  topiárias (buxo em bola)      ${R.contagem.topiarias}   de 48 vagas`)
  console.log(`  ciprestes (leque de 15°)      ${R.contagem.ciprestes}   de 24 vagas`)
  console.log(`  postes de luz                 ${R.contagem.postes}   de 24 vagas`)
  // por compartimento: o desenho tem de ser espelhado, e uma contagem
  // desigual entre quadrantes é o sintoma de eixo torto
  const porCompartimento = (pts: readonly P[]) => R.canteiros.map((c) =>
    pts.filter(([x, z]) => {
      const [du, dv] = plano.paraLocal(x, z)
      const phi = ((Math.atan2(dv, du) * 180) / Math.PI + 360) % 360
      return phi >= c.a0 - 0.5 && phi <= c.a1 + 0.5
    }).length)
  console.log(`  topiárias por compartimento   ${porCompartimento(plano.SPHERE_TOPIARIAS as P[]).join(' / ')}`)
  console.log(`  ciprestes por compartimento   ${porCompartimento(plano.SPHERE_CIPRESTES as P[]).join(' / ')}`)

  // ── 2. cabe no lote? ──────────────────────────────────────────────────────
  console.log('\n═══ CABE NO LOTE? ═══')
  const todos: { nome: string; pts: P[]; folga: number }[] = [
    { nome: 'tamareira', pts: plano.SPHERE_COROA_PALMEIRAS as P[], folga: plano.FLOREIRA_R },
    { nome: 'topiária', pts: plano.SPHERE_TOPIARIAS as P[], folga: 1.5 },
    { nome: 'cipreste', pts: plano.SPHERE_CIPRESTES as P[], folga: 2.0 },
    { nome: 'poste', pts: plano.SPHERE_POSTES as P[], folga: 0.6 },
  ]
  for (const g of todos) {
    let piorDivisa = Infinity, piorEmbasamento = Infinity
    for (const [x, z] of g.pts) {
      const [du, dv] = plano.paraLocal(x, z)
      const r = Math.hypot(du, dv), phi = Math.atan2(dv, du)
      piorDivisa = Math.min(piorDivisa, plano.raioDoDeck(phi, 0) - r - g.folga)
      // as tamareiras vivem SOBRE o pódio; as demais, fora dele
      const limite = g.nome === 'tamareira' ? plano.R_COLAR : plano.R_PODIO_EXT
      piorEmbasamento = Math.min(piorEmbasamento, r - g.folga - limite)
    }
    console.log(`  ${g.nome.padEnd(10)} folga mínima até a divisa ${num(piorDivisa)} m   até o embasamento ${num(piorEmbasamento)} m`)
    assert.ok(piorDivisa > 0, `${g.nome} passa da divisa do deck`)
    assert.ok(piorEmbasamento > 0, `${g.nome} invade o embasamento`)
  }

  // o cinto tem de ser contínuo: nenhuma peça pode cair dentro dele
  for (const g of todos) {
    if (g.nome === 'tamareira') continue
    for (const [x, z] of g.pts) {
      const [du, dv] = plano.paraLocal(x, z)
      const r = Math.hypot(du, dv)
      assert.ok(r - g.folga >= plano.R_CINTO_INT, `${g.nome} dentro do cinto`)
    }
  }
  console.log('  cinto contínuo nos 360°: nenhuma peça plantada dentro dele  OK')

  // ── 1. o jardim anda junto com a peça? ────────────────────────────────────
  console.log('\n═══ ANDA JUNTO COM A PEÇA? ═══')
  const antes = {
    centro: plano.sphereJardimCentro(),
    palmeiras: plano.SPHERE_COROA_PALMEIRAS.map((p) => [...p] as P),
    topiarias: plano.SPHERE_TOPIARIAS.map((p) => [...p] as P),
    ciprestes: plano.SPHERE_CIPRESTES.map((p) => [...p] as P),
    postes: plano.SPHERE_POSTES.map((p) => [...p] as P),
  }
  // troca o módulo NO OBJETO EXPORTADO e recarrega o plano por um segundo
  // registro do módulo (query string), que é o jeito de reavaliar as constantes
  const alvo = { ...S.SPHERE_MOD, j: S.SPHERE_MOD.j + 4 }
  ;(S.SPHERE_MOD as { i: number; nr: number; j: number; ns: number }).i = alvo.i
  ;(S.SPHERE_MOD as { i: number; nr: number; j: number; ns: number }).j = alvo.j
  // ⚠️ A QUERY STRING NÃO É ENFEITE: ela força um SEGUNDO registro do módulo, e
  // é o que faz as constantes de nível de módulo (a coroa, a topiária, o
  // cipreste, o quadro em cache) serem reavaliadas com o `SPHERE_MOD` novo. A
  // variável existe porque com o literal o TypeScript tenta resolver o caminho
  // com a query e não acha o arquivo.
  const outroCaminho = '../../app/city/plaza/sphere-jardim-plano?mudou=1'
  const plano2 = (await import(outroCaminho)) as typeof plano
  const depois = {
    centro: plano2.sphereJardimCentro(),
    palmeiras: plano2.SPHERE_COROA_PALMEIRAS as P[],
    topiarias: plano2.SPHERE_TOPIARIAS as P[],
    ciprestes: plano2.SPHERE_CIPRESTES as P[],
    postes: plano2.SPHERE_POSTES as P[],
  }
  const dx = depois.centro[0] - antes.centro[0], dz = depois.centro[1] - antes.centro[1]
  console.log(`  módulo trocado    j ${alvo.j - 4} → ${alvo.j}`)
  console.log(`  o centro andou    ${num(Math.hypot(dx, dz), 1)} m  (${num(dx, 1)}, ${num(dz, 1)})`)
  assert.ok(Math.hypot(dx, dz) > 50, 'o teste precisa de um deslocamento de verdade')

  // a peça girou junto (o rumo do módulo mudou), então o teste certo não é
  // "andou o mesmo vetor" e sim "andou a mesma TRANSFORMAÇÃO RÍGIDA": a
  // coordenada LOCAL (r, φ) de cada peça tem de ser idêntica antes e depois.
  let pior = 0
  for (const k of ['palmeiras', 'topiarias', 'ciprestes', 'postes'] as const) {
    const a = antes[k], b = depois[k]
    assert.equal(a.length, b.length, `${k}: a contagem mudou com o módulo (${a.length} → ${b.length})`)
    for (let i = 0; i < a.length; i++) {
      const la = plano.paraLocal(a[i][0], a[i][1])
      const lb = plano2.paraLocal(b[i][0], b[i][1])
      pior = Math.max(pior, Math.hypot(la[0] - lb[0], la[1] - lb[1]))
    }
  }
  console.log(`  pior desvio em coordenada LOCAL, peça a peça: ${pior.toExponential(2)} m`)
  assert.ok(pior < 1e-6, 'alguma peça NÃO andou junto: há coordenada de mundo cravada')
  console.log('  o jardim inteiro é rígido com SPHERE_MOD  OK')
  // ⚠️ E O MÓDULO VOLTA AO LUGAR ANTES DE MEDIR O CUSTO. Sem esta linha o bloco
  // seguinte constrói a geometria do módulo de TESTE e publica a cota dele
  // (110,1 m) como se fosse a de produção (116,4). Foi o que aconteceu na
  // primeira rodada deste verificador.
  ;(S.SPHERE_MOD as { j: number }).j = alvo.j - 4

  // ── 3. quanto custa a geometria, construída de verdade ────────────────────
  // ⚠️ ESTE BLOCO CONSTRÓI A MALHA FORA DO NAVEGADOR. É a única forma honesta de
  // publicar contagem de triângulo: contar o buffer que a cena vai receber, e
  // não estimar da conta de trás para a frente.
  console.log('\n═══ O CUSTO DA GEOMETRIA ═══')
  const M = JSON.parse(readFileSync('public/city/cidade-malha.json', 'utf8'))
  const { buildTerrain, CANAL_LAMINA, LAGO_R1 } = await import('../../app/city/plaza/terrain')
  const meta = JSON.parse(readFileSync('public/lunar/btc-core-heightmap.json', 'utf8'))
  const bin = readFileSync('public/lunar/btc-core-heightmap.f32')
  const terreno = buildTerrain(
    meta,
    new Float32Array(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength)),
    {
      radiais: M.canais.radiais.map((r: { rumo: number; rInicio: number; rFim?: number }) =>
        ({ rumo: r.rumo, secao: CANAL_LAMINA, rInicio: Math.min(r.rInicio, LAGO_R1), rFim: r.rFim ?? 4300 })),
      aneis: M.canais.aneis, talude: M.canais.talude, leito: M.lagos.cota - 4,
    },
    { faixaSeca: false },
  )
  const { buildSphereJardim } = await import('../../app/city/plaza/sphere-jardim')
  const { profileFor } = await import('../../app/city/plaza/perf')
  for (const [nome, p] of [['desktop balanced', profileFor('desktop', 'balanced')], ['celular balanced', profileFor('mobile', 'balanced')]] as const) {
    const t0 = Date.now()
    const j = buildSphereJardim({ heightAt: (x, z) => terreno.heightAt(x, z), perfil: p })
    console.log(`  ${nome.padEnd(18)} deck em ${j.plataformaY} m   ${j.custo.chamadas} chamadas   ${j.custo.triangulos.toLocaleString('pt-BR')} triângulos`)
    console.log(`  ${''.padEnd(18)} sebe ${j.custo.instanciasSebe} instâncias   postes ${j.custo.postes}   aro construído ${j.custo.aroMetros} m (o banco do jardim)`)
    console.log(`  ${''.padEnd(18)} construído em ${Date.now() - t0} ms`)
    if (nome.startsWith('desktop')) {
      console.log(`  ${''.padEnd(18)} soleiras de rua (o parapeito abre onde o chão alcança):`)
      if (!j.custo.soleiras.length) console.log(`  ${''.padEnd(18)}   nenhuma: o deck não toca o chão em portão nenhum`)
      for (const s of j.custo.soleiras) console.log(`  ${''.padEnd(18)}   portão φ ${s.portaoDeg}°  desnível ${s.desnivel} m  ${s.degraus} degraus`)
    }
    j.dispose()
  }
  const glbs = [
    ['palm-date', 4, 2600, plano.SPHERE_COROA_PALMEIRAS.length],
    ['buxo-bola', 1, 1080, plano.SPHERE_TOPIARIAS.length],
    ['tree-cypress', 2, 2600, plano.SPHERE_CIPRESTES.length],
  ] as const
  let chamadasGlb = 0, triGlb = 0
  for (const [f, prim, tri, n] of glbs) {
    chamadasGlb += prim; triGlb += tri * n
    console.log(`  ${f.padEnd(18)} ${n} x ${tri.toLocaleString('pt-BR')} tri = ${(tri * n).toLocaleString('pt-BR')}   ${prim} chamadas (o modelo já está na cena: 0 programa novo)`)
  }
  console.log(`  TOTAL das plantas   ${chamadasGlb} chamadas   ${triGlb.toLocaleString('pt-BR')} triângulos`)

  console.log('\nTUDO CERTO.')
}

main().catch((e) => { console.error(e); process.exit(1) })
