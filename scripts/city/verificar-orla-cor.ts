/**
 * Prova do conserto das manchas escuras na faixa de areia da orla nobre.
 *
 * Lê o atributo `color` de verdade da malha `Regolith` (a mesma que a cena
 * desenha, já passada por `corCurta` em 16 bits) e conta, DENTRO do arco da
 * alça (`ALCA_TERRA`, 346° a 116,5°) e na faixa oficial de praia (0 a
 * `ALCA_PRAIA_LARGURA` m além de cada margem, `ALCA_R_BAIA`/`ALCA_R_MAR`),
 * quantos vértices leem como areia e quantos leem como escuro.
 *
 *   npx tsx scripts/city/verificar-orla-cor.ts [--dump caminho.json]
 *
 * Com `--dump` salva `color.r` de TODO vértice dentro da janela de raio da
 * alça (5.700 a 7.900 m, a mesma porta rápida de `alcaAlturaAt`), marcado
 * dentro/fora do arco. É assim que o script de invólucro (rodar antes do
 * conserto via `git stash`, depois com o conserto) compara os dois lados e
 * prova que NENHUM vértice fora do arco mudou.
 *
 * Classificação: em `look2` (padrão) o canal usado pela cena é `color.r`
 * (ver `corVertice`/`corAt`, que colapsa para cinza normalizado contra
 * `BASE`); "areia" é `color.r >= 0.99` (a faixa oficial, depois do conserto,
 * bate em exatamente 1.0 pela saturação da mistura, ver o comentário de
 * `COR_AREIA_ORLA` em `terrain.ts`), "escuro" é todo o resto.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import * as THREE from 'three'
import { ALCA_TERRA, noArcoDoAnel } from '../../app/city/plaza/teia'
import { ALCA_R_BAIA, ALCA_R_MAR, ALCA_PRAIA_LARGURA } from '../../app/city/plaza/alca'

const M = JSON.parse(readFileSync('public/city/cidade-malha.json', 'utf8'))

async function main() {
  Object.assign(globalThis, {
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

  const mesh = terrain.group.getObjectByName('Regolith') as THREE.Mesh
  if (!mesh) throw new Error('mesh Regolith não encontrada em terrain.group')
  const geo = mesh.geometry
  const pos = geo.getAttribute('position')
  const col = geo.getAttribute('color')
  if (!pos || !col) throw new Error('atributos position/color ausentes na malha Regolith')
  console.log(`Regolith: ${pos.count} vértices (attr color normalizado: ${(col as THREE.BufferAttribute).normalized})`)

  const LIMIAR_AREIA = 0.99

  let dentroFaixaAreia = 0, dentroFaixaEscuro = 0
  let minFaixa = Infinity, maxFaixa = -Infinity
  // dump para o script de invólucro comparar fora-do-arco entre as duas rodadas
  const dumpIdx: number[] = [], dumpR: number[] = [], dumpNoArco: number[] = []

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i)
    const dist = Math.hypot(x, z)
    // mesma porta rápida de `corVertice`/`alcaAlturaAt`: fora da janela de raio
    // da alça nem entra no teste de arco.
    if (dist < 5700 || dist > 7900) continue
    const anguloRad = Math.atan2(x, -z)
    const noArco = noArcoDoAnel({ arco: ALCA_TERRA }, anguloRad)
    const r = col.getX(i)
    dumpIdx.push(i); dumpR.push(r); dumpNoArco.push(noArco ? 1 : 0)

    if (!noArco) continue
    const distMargem = Math.min(dist - ALCA_R_BAIA, ALCA_R_MAR - dist)
    if (distMargem >= 0 && distMargem <= ALCA_PRAIA_LARGURA) {
      minFaixa = Math.min(minFaixa, r)
      maxFaixa = Math.max(maxFaixa, r)
      if (r >= LIMIAR_AREIA) dentroFaixaAreia++
      else dentroFaixaEscuro++
    }
  }

  console.log(`faixa oficial de praia (0 a ${ALCA_PRAIA_LARGURA} m de cada margem), dentro do arco da alça:`)
  console.log(`  areia (color.r >= ${LIMIAR_AREIA}): ${dentroFaixaAreia}`)
  console.log(`  escuro (color.r < ${LIMIAR_AREIA}): ${dentroFaixaEscuro}`)
  console.log(`  color.r na faixa: min ${isFinite(minFaixa) ? minFaixa.toFixed(4) : 'n/a'}, max ${isFinite(maxFaixa) ? maxFaixa.toFixed(4) : 'n/a'}`)

  const dumpPath = process.argv.includes('--dump') ? process.argv[process.argv.indexOf('--dump') + 1] : null
  if (dumpPath) {
    writeFileSync(dumpPath, JSON.stringify({ idx: dumpIdx, r: dumpR, noArco: dumpNoArco }))
    console.log(`dump salvo em ${dumpPath} (${dumpIdx.length} vértices na janela de raio)`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
