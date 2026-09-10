/**
 * Confere a terraplanagem da alça: a plataforma baixa, a praia entre ela e a
 * água, a franja das duas pontas contra o continente, e quanto a linha
 * d'água (agora um círculo fixo por lado, não mais a margem medida) avançou
 * ou recuou contra o terreno natural.
 *
 *   npx tsx scripts/city/verificar-alca.ts
 *
 * O que ele NÃO faz: não valida lotes do snapshot (não existe lote fixo antes
 * do snapshot), não mede FPS nem GPU, não abre navegador. A peça aqui é o
 * CHÃO, medido contra `buildTerrain`, igual a `verificar-aquatics.ts`.
 */
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { ALCA_TERRA } from '../../app/city/plaza/teia'
import {
  ALCA_PLATAFORMA_Y, ALCA_AGUA, ALCA_PRAIA_LARGURA, ALCA_FRANJA_PONTAS,
  ALCA_R_BAIA, ALCA_R_MAR, ALCA_LEITO_Y,
  ALCA_TABELA_BAIA, ALCA_TABELA_MAR, alcaMargens,
} from '../../app/city/plaza/alca'

const M = JSON.parse(readFileSync('public/city/cidade-malha.json', 'utf8'))

const _ARCO_LARGURA = ((ALCA_TERRA[1] - ALCA_TERRA[0]) + 360) % 360
function ponto(r: number, g: number): [number, number] {
  const a = (g * Math.PI) / 180
  return [Math.sin(a) * r, -Math.cos(a) * r]
}
function mediana(xs: number[]): number {
  const o = [...xs].sort((a, b) => a - b)
  return o.length ? o[Math.floor(o.length / 2)] : 0
}

async function main() {
  Object.assign(globalThis, { document: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ putImageData() {} }) }) }, ImageData: class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} } })
  const { buildTerrain, CANAL_LAMINA, LAGO_R1 } = await import('../../app/city/plaza/terrain')
  const meta = JSON.parse(readFileSync('public/lunar/btc-core-heightmap.json', 'utf8'))
  const bin = readFileSync('public/lunar/btc-core-heightmap.f32')
  const terrain = buildTerrain(meta, new Float32Array(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength)), {
    radiais: M.canais.radiais.map((r: { rumo: number; rInicio: number; rFim?: number }) => ({ rumo: r.rumo, secao: CANAL_LAMINA, rInicio: Math.min(r.rInicio, LAGO_R1), rFim: r.rFim ?? 4300 })),
    aneis: M.canais.aneis, talude: M.canais.talude, leito: M.lagos.cota - 4,
  }, { faixaSeca: false })
  const alturaEm = (x: number, z: number) => terrain.heightAt(x, z)

  console.log(`tabela por rumo (o "antes"): baía ${Math.min(...ALCA_TABELA_BAIA).toFixed(0)} a ${Math.max(...ALCA_TABELA_BAIA).toFixed(0)} m, `
    + `mar ${Math.min(...ALCA_TABELA_MAR).toFixed(0)} a ${Math.max(...ALCA_TABELA_MAR).toFixed(0)} m, ${ALCA_TABELA_BAIA.length} pontos`)
  console.log(`círculos fixos (o "depois"): baía r ${ALCA_R_BAIA}, mar r ${ALCA_R_MAR}, largura do anel ${ALCA_R_MAR - ALCA_R_BAIA} m`)

  // 0. quanto a linha d'água avançou (tomou terra) e recuou (perdeu para
  //    aterro), por rumo, nos dois lados. AVANÇO = real − círculo, nos dois
  //    lados: positivo em baía significa margem real mais longe da cidade do
  //    que o círculo (aquela faixa de terra virou água); positivo em mar
  //    significa margem real mais longe da cidade do que o círculo (aquela
  //    faixa de terra além do círculo também virou água). Negativo é o
  //    espelho: aterro, água recuando.
  const deltas: number[] = [
    ...ALCA_TABELA_BAIA.map((v) => v - ALCA_R_BAIA),
    ...ALCA_TABELA_MAR.map((v) => v - ALCA_R_MAR),
  ]
  const avancos = deltas.filter((d) => d > 0)
  const recuos = deltas.filter((d) => d < 0).map((d) => -d)
  console.log(`0. linha d'água: avanço (tomou terra) máximo ${Math.max(0, ...avancos).toFixed(0)} m, `
    + `mediana ${mediana(avancos).toFixed(0)} m (${avancos.length} rumos); `
    + `recuo (aterro) máximo ${Math.max(0, ...recuos).toFixed(0)} m, mediana ${mediana(recuos).toFixed(0)} m (${recuos.length} rumos)`)

  // ── faixa segura, longe das duas franjas, para os testes de platô e praia ──
  const BUFFER_GRAUS = ALCA_FRANJA_PONTAS / (ALCA_R_BAIA * Math.PI / 180) + 2
  const G0 = ALCA_TERRA[0] + BUFFER_GRAUS
  const G1 = ALCA_TERRA[1] - BUFFER_GRAUS
  const larguraSegura = ((G1 - G0) + 360) % 360
  assert(larguraSegura > 10, 'arco seguro (fora das franjas) ficou pequeno demais para medir')

  // 1 e 2. a plataforma é plana na cota e nunca fica abaixo da lâmina
  //
  // ⚠️ AS BORDAS DA PLATAFORMA AGORA SÃO OS DOIS CÍRCULOS FIXOS, iguais em
  // todo rumo: não depende mais de `alcaMargens`.
  let pior = 0, n = 0, molhado = 0
  const rIn = ALCA_R_BAIA + ALCA_PRAIA_LARGURA, rOut = ALCA_R_MAR - ALCA_PRAIA_LARGURA
  const PASSO_G = larguraSegura / 400
  for (let g = 0; g <= larguraSegura; g += PASSO_G) {
    const gg = G0 + g
    const passoR = (rOut - rIn) / 30
    for (let r = rIn; r <= rOut; r += passoR) {
      const [x, z] = ponto(r, gg)
      const y = alturaEm(x, z)
      n++
      pior = Math.max(pior, Math.abs(y - ALCA_PLATAFORMA_Y))
      if (y < ALCA_AGUA) molhado++
    }
  }
  assert(n >= 5000, `poucas sondas na plataforma: ${n}`)
  assert(pior <= 0.05, `a plataforma não ficou plana: desvio de ${pior.toFixed(4)} m em ${n} sondas`)
  assert(molhado === 0, `${molhado} sondas da plataforma abaixo da lâmina de ${ALCA_AGUA}`)
  console.log(`1. plataforma plana em ${ALCA_PLATAFORMA_Y} m: ${n.toLocaleString('pt-BR')} sondas, pior desvio ${pior.toFixed(4)} m`)
  console.log(`2. nenhuma das ${n.toLocaleString('pt-BR')} sondas da plataforma está abaixo da lâmina de ${ALCA_AGUA} m`)

  // 3. a declividade da praia (lado terra, 1:8 pedido), medida em >=100 rumos
  //
  // ⚠️ COM O CÍRCULO FIXO A MARGEM É A MESMA EM TODO RUMO, então a divergência
  // que existia com a margem medida (32% das sondas fora do alvo na versão de
  // círculo único de antes) não tem mais de onde vir: aqui não há mais "margem
  // real" nenhuma na conta, só o círculo.
  const RUMOS_PRAIA = 130
  const T1 = 8, T2 = ALCA_PRAIA_LARGURA - 8 // longe das duas pontas do próprio talude
  const declividades: number[] = []
  for (let i = 0; i < RUMOS_PRAIA; i++) {
    const gg = G0 + (larguraSegura * i) / (RUMOS_PRAIA - 1)
    for (const [rA, rB] of [[ALCA_R_BAIA + T1, ALCA_R_BAIA + T2], [ALCA_R_MAR - T1, ALCA_R_MAR - T2]] as const) {
      const [xa, za] = ponto(rA, gg), [xb, zb] = ponto(rB, gg)
      const ya = alturaEm(xa, za), yb = alturaEm(xb, zb)
      declividades.push(Math.abs(yb - ya) / Math.abs(rB - rA))
    }
  }
  assert(declividades.length >= 100, `poucos rumos medidos: ${declividades.length}`)
  const decOrdenadas = [...declividades].sort((a, b) => a - b)
  const decMediana = decOrdenadas[Math.floor(decOrdenadas.length / 2)]
  const decMedia = declividades.reduce((s, d) => s + d, 0) / declividades.length
  const decLimpas = declividades.filter((d) => Math.abs(d - 0.125) < 0.01).length
  assert(Math.abs(decMediana - 0.125) < 0.005, `declividade mediana ${decMediana.toFixed(4)} longe de 1:8 (0,125)`)
  assert(Math.abs(decMedia - 0.125) < 0.01, `declividade média ${decMedia.toFixed(4)} longe de 1:8 (0,125)`)
  assert(decLimpas / declividades.length > 0.9, `só ${decLimpas} de ${declividades.length} medidas batem com 1:8`)
  console.log(`3. declividade da praia em ${declividades.length} medidas (${RUMOS_PRAIA} rumos x 2 margens): `
    + `mediana ${decMediana.toFixed(4)} e média ${decMedia.toFixed(4)} (alvo 0,1250 = 1:8), `
    + `${decLimpas}/${declividades.length} medidas dentro de ±0,01 do alvo`)

  // 4. a franja das pontas não deixa degrau contra o terreno natural
  //
  // ⚠️ O DEGRAU SE MEDE NA COSTURA, NÃO NOS 8° EM VOLTA DELA (ver a nota
  // original desta função: `_suave` tem derivada zero nas duas pontas, então
  // por construção não pode haver degrau ali). A faixa de raio sondada agora
  // é a dos dois círculos fixos, mais folga da própria rampa espelhada.
  let piorDegrau = 0
  const EPS_GRAUS = 0.02
  for (const borda of ALCA_TERRA) {
    for (let r = ALCA_R_BAIA - ALCA_PRAIA_LARGURA; r <= ALCA_R_MAR + ALCA_PRAIA_LARGURA; r += 20) {
      const [xDentro, zDentro] = ponto(r, borda - EPS_GRAUS)
      const [xFora, zFora] = ponto(r, borda + EPS_GRAUS)
      const yDentro = alturaEm(xDentro, zDentro)
      const yFora = alturaEm(xFora, zFora)
      piorDegrau = Math.max(piorDegrau, Math.abs(yDentro - yFora))
    }
  }
  assert(piorDegrau <= 1.0, `degrau de ${piorDegrau.toFixed(2)} m encontrado na costura de uma ponta do arco`)
  console.log(`4. franja das duas pontas (346° e 116,5°): degrau na costura (±${EPS_GRAUS}°) de no máximo ${piorDegrau.toFixed(4)} m (teto 1,0 m)`)

  // 5. a largura de praia resultante, com mediana e extremos (amostragem)
  const ANTECEDENCIA = 15
  const larguras: number[] = []
  for (let i = 0; i < RUMOS_PRAIA * 2; i++) {
    const gg = G0 + (larguraSegura * i) / (RUMOS_PRAIA * 2 - 1)
    for (const margem of ['baia', 'mar'] as const) {
      let rIni = -1, rFim = -1
      const passo = margem === 'baia' ? 1 : -1
      const r0 = margem === 'baia' ? ALCA_R_BAIA - ANTECEDENCIA : ALCA_R_MAR + ANTECEDENCIA
      for (let k = 0; k <= ALCA_PRAIA_LARGURA + 20 + ANTECEDENCIA; k++) {
        const r = r0 + passo * k
        const [x, z] = ponto(r, gg)
        const y = alturaEm(x, z)
        if (rIni < 0 && y > ALCA_AGUA + 0.1) rIni = r
        if (rFim < 0 && y > ALCA_PLATAFORMA_Y - 0.1) { rFim = r; break }
      }
      // ⚠️ CORRIGIDO 10/09: era `rIni > r0 + 0.5`, que só é verdade quando `r`
      // CRESCE a partir de `r0` (lado baía, passo +1). No lado mar (passo −1)
      // `r` decresce, então `rIni` sai sempre MENOR que `r0` e a condição
      // batia falso sempre: metade das amostras (todo o lado mar) era
      // descartada em silêncio, sem afetar o log porque só o lado baía já
      // dava as >=100 medidas mínimas pedidas. `Math.abs` funciona nos dois
      // sentidos.
      if (Math.abs(rIni - r0) > 0.5 && rFim >= 0) larguras.push(Math.abs(rFim - rIni))
    }
  }
  larguras.sort((a, b) => a - b)
  assert(larguras.length >= 100, `poucas larguras de praia medidas: ${larguras.length}`)
  const med = larguras[Math.floor(larguras.length / 2)]
  console.log(`5. largura de praia resultante, em ${larguras.length} medidas válidas de ${RUMOS_PRAIA * 4} tentadas: `
    + `mediana ${med.toFixed(1)} m, mínima ${larguras[0].toFixed(1)} m, máxima ${larguras[larguras.length - 1].toFixed(1)} m `
    + `(alvo de desenho: ${ALCA_PRAIA_LARGURA} m para 1:8 vencer 10 m)`)

  // 6. CONTINUIDADE: varre o arco seguro a cada 0,25° (a mesma resolução da
  //    tabela antiga) e cada rumo tem de achar praia com largura dentro de
  //    ±1 m do alvo, nas duas margens. Como o círculo é fixo, isto é
  //    exatamente o que o fundador chamou de "trivial de passar": se algum
  //    rumo faltar ou sair da banda, é sinal de bug na integração com
  //    `buildTerrain`, não do desenho em si.
  const TOLERANCIA_M = 1
  const PASSO_CONTINUO = 0.25
  let faltando = 0, foraDaBanda = 0, medidos = 0
  for (let g = 0; g <= larguraSegura; g += PASSO_CONTINUO) {
    const gg = G0 + g
    for (const margem of ['baia', 'mar'] as const) {
      let rIni = -1, rFim = -1
      const passo = margem === 'baia' ? 1 : -1
      const r0 = margem === 'baia' ? ALCA_R_BAIA - ANTECEDENCIA : ALCA_R_MAR + ANTECEDENCIA
      for (let k = 0; k <= ALCA_PRAIA_LARGURA + 20 + ANTECEDENCIA; k++) {
        const r = r0 + passo * k
        const [x, z] = ponto(r, gg)
        const y = alturaEm(x, z)
        if (rIni < 0 && y > ALCA_AGUA + 0.1) rIni = r
        if (rFim < 0 && y > ALCA_PLATAFORMA_Y - 0.1) { rFim = r; break }
      }
      medidos++
      // mesma correção de sentido do item 5: `Math.abs`, não só o lado maior
      if (Math.abs(rIni - r0) <= 0.5 || rFim < 0) { faltando++; continue }
      if (Math.abs(Math.abs(rFim - rIni) - ALCA_PRAIA_LARGURA) > TOLERANCIA_M) foraDaBanda++
    }
  }
  assert(faltando === 0, `${faltando} de ${medidos} rumos (passo ${PASSO_CONTINUO}°) ficaram sem faixa de areia`)
  assert(foraDaBanda === 0, `${foraDaBanda} de ${medidos} rumos com largura de praia fora de ±${TOLERANCIA_M} m do alvo de ${ALCA_PRAIA_LARGURA} m`)
  console.log(`6. continuidade da praia: ${medidos} rumos testados a cada ${PASSO_CONTINUO}°, `
    + `0 sem faixa de areia, 0 fora de ±${TOLERANCIA_M} m do alvo de ${ALCA_PRAIA_LARGURA} m`)

  // 7. a rampa espelhada da escavação também não afunda além do fundo, nem
  //    deixa a plataforma pisar em água (checagem cruzada dos dois lados)
  let piorLeito = 0, acimaDoLeito = 0, nLeito = 0
  for (let i = 0; i < RUMOS_PRAIA; i++) {
    const gg = G0 + (larguraSegura * i) / (RUMOS_PRAIA - 1)
    for (const r of [ALCA_R_BAIA - ALCA_PRAIA_LARGURA - 40, ALCA_R_MAR + ALCA_PRAIA_LARGURA + 40]) {
      const [x, z] = ponto(r, gg)
      const y = alturaEm(x, z)
      nLeito++
      piorLeito = Math.max(piorLeito, Math.abs(y - ALCA_LEITO_Y))
      if (y > ALCA_AGUA) acimaDoLeito++
    }
  }
  assert(acimaDoLeito === 0, `${acimaDoLeito} sondas do fundo escavado ficaram acima da lâmina de ${ALCA_AGUA}`)
  console.log(`7. fundo escavado em ${ALCA_LEITO_Y} m: ${nLeito} sondas, pior desvio ${piorLeito.toFixed(4)} m, nenhuma acima da lâmina de ${ALCA_AGUA} m`)

  console.log('\nALÇA: terraplanagem conferida.')
}

main()
