/**
 * Gera a TABELA POR RUMO da alça: para cada 0,25° do arco 346° a 116,5°, acha
 * a margem que olha a cidade (baía) e a margem externa (mar), varrendo o
 * relevo NATURAL (sem a própria terraplanagem da alça, que senão contaminaria
 * a medida com o platô já nivelado).
 *
 *   npx tsx scripts/city/gerar-tabela-alca.ts
 *
 * A saída vai para stdout, pronta para colar em `alca.ts` como duas listas de
 * constantes (`ALCA_TABELA_BAIA` e `ALCA_TABELA_MAR`). É rodado uma vez,
 * offline: a tabela gerada é o que o runtime consulta, sem varredura nenhuma
 * no boot.
 */
import { readFileSync } from 'node:fs'
import { ALCA_TERRA } from '../../app/city/plaza/teia'

const M = JSON.parse(readFileSync('public/city/cidade-malha.json', 'utf8'))
const AGUA = -40
const PASSO_GRAUS = 0.25
const LARGURA_ARCO = ((ALCA_TERRA[1] - ALCA_TERRA[0]) + 360) % 360 // 130,5°
const N = Math.round(LARGURA_ARCO / PASSO_GRAUS) + 1 // 523 pontos, ponta a ponta

// ⚠️ A JANELA DE BUSCA EM RAIO VAI ALÉM DA PORTA RÁPIDA (5.700-7.900), PARA
// GARANTIR ÁGUA DOS DOIS LADOS DENTRO DA VARREDURA: sem essa folga um trecho
// de terra que continuasse seco até a borda da janela pareceria "sem margem"
// em vez de a margem estar só um pouco mais para fora.
const R0 = 5550, R1 = 8100, PASSO_R = 4

function ponto(r: number, g: number): [number, number] {
  const a = (g * Math.PI) / 180
  return [Math.sin(a) * r, -Math.cos(a) * r]
}

async function main() {
  // ⚠️ `window` COM `alca=0` DE PROPÓSITO: sem isso `alca.ts` fica ativo por
  // padrão em Node (a leitura do flag só desliga com `window` definido e o
  // parâmetro `=0`), e a varredura mediria o platô que ELE MESMO já aplainou
  // com a mediana antiga, não o relevo natural que a tabela precisa aprender.
  //
  // ⚠️ E `inverno=0` JUNTO, PORQUE `INVERNO_ATIVO` LÊ O CONTRÁRIO: ele é
  // `typeof window !== 'undefined' && ... !== '0'`, ou seja fica LIGADO assim
  // que `window` existe, a não ser que `inverno=0` diga o contrário. Definir
  // `window` só para desligar a alça acendia o maciço de inverno de graça
  // (viu-se pelo `fetch` que ele disparou e falhou, inofensivo aqui porque o
  // maciço fica a rumo 264°, fora do arco 346°-116,5°, mas não é para contar
  // com a coincidência).
  Object.assign(globalThis, {
    window: { location: { search: '?alca=0&inverno=0' } },
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ putImageData() {} }) }) },
    ImageData: class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} },
  })
  const { buildTerrain, CANAL_LAMINA, LAGO_R1 } = await import('../../app/city/plaza/terrain')
  const meta = JSON.parse(readFileSync('public/lunar/btc-core-heightmap.json', 'utf8'))
  const bin = readFileSync('public/lunar/btc-core-heightmap.f32')
  const terrain = buildTerrain(meta, new Float32Array(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength)), {
    radiais: M.canais.radiais.map((r: { rumo: number; rInicio: number; rFim?: number }) => ({ rumo: r.rumo, secao: CANAL_LAMINA, rInicio: Math.min(r.rInicio, LAGO_R1), rFim: r.rFim ?? 4300 })),
    aneis: M.canais.aneis, talude: M.canais.talude, leito: M.lagos.cota - 4,
  }, { faixaSeca: false })
  const alturaEm = (x: number, z: number) => terrain.heightAt(x, z)

  const baia: number[] = [], mar: number[] = []
  const nR = Math.floor((R1 - R0) / PASSO_R) + 1
  let semMargem = 0

  for (let i = 0; i < N; i++) {
    const g = ALCA_TERRA[0] + i * PASSO_GRAUS
    const seco: boolean[] = []
    for (let k = 0; k < nR; k++) {
      const r = R0 + k * PASSO_R
      const [x, z] = ponto(r, g)
      seco.push(alturaEm(x, z) > AGUA)
    }
    // os trechos secos com água ANTES e água DEPOIS: é o corte transversal da
    // alça (mesma lógica de `scripts/city/alca-varredura.mjs`, agora contra
    // `buildTerrain` direto, sem navegador).
    const trechos: { rIn: number; rOut: number }[] = []
    let k = 0
    while (k < nR) {
      if (!seco[k]) { k++; continue }
      let f = k
      while (f < nR && seco[f]) f++
      const aguaAntes = k > 0 && !seco[k - 1]
      const aguaDepois = f < nR && !seco[f]
      if (aguaAntes && aguaDepois) trechos.push({ rIn: R0 + k * PASSO_R, rOut: R0 + (f - 1) * PASSO_R })
      k = f
    }
    if (trechos.length === 0) {
      // ⚠️ SEM TRECHO ENCONTRADO: acontece perto das duas pontas do arco, onde
      // a alça por definição já está deixando de ter água dos dois lados (é
      // exatamente o limite que `ALCA_TERRA` marca). Repete a margem vizinha
      // mais próxima em vez de inventar um número: a franja de 250 m already
      // reduz o peso da terraplanagem a quase zero bem antes disso.
      semMargem++
      baia.push(baia.length ? baia[baia.length - 1] : 6580)
      mar.push(mar.length ? mar[mar.length - 1] : 7316)
      continue
    }
    // o trecho mais largo, se houver mais de um (ilhota separada por um canal
    // fininho não deveria disputar com a alça principal)
    const maior = trechos.reduce((a, c) => (c.rOut - c.rIn > a.rOut - a.rIn ? c : a))
    baia.push(maior.rIn)
    mar.push(maior.rOut)
  }

  const fmt = (arr: number[]) => arr.map((v) => v.toFixed(1)).join(',')
  console.log(`// gerado por scripts/city/gerar-tabela-alca.ts, ${N} pontos, passo ${PASSO_GRAUS}°, arco ${ALCA_TERRA[0]}° a ${ALCA_TERRA[1]}°`)
  console.log(`// ${semMargem} rumos sem trecho água-terra-água (perto das pontas), preenchidos por repetição do vizinho`)
  console.log(`export const ALCA_TABELA_BAIA: readonly number[] = [${fmt(baia)}]`)
  console.log(`export const ALCA_TABELA_MAR: readonly number[] = [${fmt(mar)}]`)
  console.error('')
  console.error(`baia: min ${Math.min(...baia).toFixed(1)} mediana ${[...baia].sort((a, b) => a - b)[Math.floor(baia.length / 2)].toFixed(1)} max ${Math.max(...baia).toFixed(1)}`)
  console.error(`mar:  min ${Math.min(...mar).toFixed(1)} mediana ${[...mar].sort((a, b) => a - b)[Math.floor(mar.length / 2)].toFixed(1)} max ${Math.max(...mar).toFixed(1)}`)
  console.error(`pontos sem trecho: ${semMargem} de ${N}`)
}

main()
