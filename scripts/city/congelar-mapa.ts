// ═══════════════════════════════════════════════════════════════════════════
// CONGELAR O MAPA: o artefato único do traçado da DogCity.
//
// Uso:  npx tsx scripts/city/congelar-mapa.ts [--saida=public/city/mapa-v1.json]
//
// ⚠️ POR QUE ELE EXISTE. Até 18/09/2026 o traçado morava em DOIS lugares que
// discordavam: `teia.ts` (26 anéis × 168 radiais, de 11/09) desenhava a RUA e
// encaixava as PEÇAS, enquanto `cidade-malha.json` e `cidade-lotes.bin` (a grade
// do gerador Python, de 08/09) desenhavam o LOTE. É a mesma família do defeito
// que o fundador apontou em 31/08 ("as peças extras não conversam com as ruas"),
// consertado para a peça e nunca consertado para o lote.
//
// 🔒 DECISÃO DO FUNDADOR, 18/09/2026: "a teia manda". Este script torna isso
// executável: lê a teia, roda o encaixe do programa FORA do navegador (hoje a
// posição final das peças só existe em tempo de execução, dentro da cena) e
// grava um artefato único que o gerador de lotes passa a CONSUMIR em vez de
// inventar a própria grade.
//
// ⚠️ ELE NÃO DECIDE NADA. Toda geometria aqui vem de um módulo que já existe. Se
// um número parecer errado, ele está errado na fonte, e é lá que se conserta.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import {
  ANEIS, N_RAD, NIVEIS, R_DENTRO, R_FORA, HR, vaoDoAnel, nasceEm, anguloDe,
  AVENIDAS, AV_R_INICIO, AV_R_FIM, AVENIDA_ALCA, ALCA_TERRA, ALCA_R_DENTRO,
  caixaDoModulo, polyDoModulo, areaDoModulo, aneisDaCidade, type Modulo,
} from '../../app/city/plaza/teia'
import {
  PODIO_Y, PODIO_R0, PODIO_R1, PODIO_R2, PODIO_R3, PODIO_R3_PARQUE, DOME_R,
} from '../../app/city/plaza/dome'
import { ESTADIO_MOD } from '../../app/city/plaza/estadio'
import { GEODE_MOD } from '../../app/city/plaza/geode'
import { SPHERE_MOD } from '../../app/city/plaza/sphere'
import { CAMPUS_MOD } from '../../app/city/plaza/campus'
import { ATLETISMO_MOD } from '../../app/city/plaza/atletismo'
import { AQUATICS_MOD } from '../../app/city/plaza/aquatics'
import { DERBY_MOD } from '../../app/city/plaza/derby'

const arg = (k: string, d: string) =>
  (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1]
const SAIDA = arg('saida', 'public/city/mapa-v1.json')

const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex')
const leia = (p: string) => readFileSync(p)

const M = JSON.parse(leia('public/city/cidade-malha.json').toString())
const C = JSON.parse(leia('public/city/cidade.json').toString())

// ⚠️ A SATOSHI PLAZA É TUDO DENTRO DE r 1.420, e o número não é escolha deste
// script: o tecido começa em 1.450 e os bulevares nascem em 1.420
// (tiersposition.md §3.12.5, 🔒). O Distrito Financeiro mora DENTRO dela.
const PLAZA_R = 1420

// ⚠️ OS ANÉIS DE EXPANSÃO (masterplan §14). Demarcados em 18/09/2026 a pedido do
// fundador ("vamos demarcar o segundo anel para não crescer além do limite").
// A coroa entre o fim do pódio e a casca está VAZIA hoje: medido em 17/09, não
// há uma peça de programa entre r 7.000 e 8.000. O limite duro é a casca, que é
// limite de PRESSÃO e não de desenho: do Anel 4 em diante a cidade precisa de
// casca nova, que é o gancho dos módulos vizinhos.
//
// ⚠️ EM φ, NUNCA EM RAIO, e este foi um erro meu de 18/09 pego a tempo. O sítio
// é uma superelipse: o contorno vai de 7.718 m no rumo mais apertado a 9.766 no
// mais largo. Uma coroa circular de 8.100 cairia FORA da cidade de um lado e
// deixaria 1,6 km de terra boa sobrando do outro. A cidade inteira já mede em φ,
// e o anel de expansão tem de medir na mesma régua.
//
// ⚠️ E POR ISSO O POLÍGONO NÃO VAI PUBLICADO AQUI. φ não é o contorno escalado:
// `gerar_cidade.py` faz a forma "entrar aos poucos" (φ é o raio junto do lago e
// vira superelipse indo para a borda), então a curva de nível de φ 7.200 não é o
// contorno vezes 0,809. Publicar um polígono calculado por escala seria uma
// reserva que mente. Quem tem φ é o gerador, e é ele que devolve o polígono
// quando passar a consumir este arquivo.
const ANEL2 = { de: 7200, ate: 8100 }
const ANEL3 = { de: 8100, ate: 8900 }

// ⚠️ A ÁREA DA COROA SAI DO CONTORNO MEDIDO, não de πr². Medido em 18/09: o
// contorno fecha 248,310 km² em φ 8.900, logo a constante da forma é
// k = A/φ² = 3,13484 (o disco daria π = 3,14159). Usar π aqui inflaria cada
// coroa em 0,2%, que é pequeno e é exatamente o tipo de erro que se acumula
// calado num orçamento de terra.
const areaContorno = (() => {
  let a = 0
  const c = M.contorno as [number, number][]
  for (let i = 0; i < c.length; i++) {
    const [x1, z1] = c[i], [x2, z2] = c[(i + 1) % c.length]
    a += x1 * z2 - x2 * z1
  }
  return Math.abs(a) / 2
})()
const PHI_BORDA = M.constantes.forma.phiBorda as number
const K_FORMA = areaContorno / (PHI_BORDA * PHI_BORDA)
const coroa = (de: number, ate: number) => (K_FORMA * (ate * ate - de * de)) / 1e6

async function main() {
  // Canvas é só recipiente de material: nenhuma rasterização, navegador ou GPU.
  Object.assign(globalThis, {
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ putImageData() {} }) }) },
    ImageData: class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} },
  })
  const { buildTerrain, CANAL_LAMINA, LAGO_R1 } = await import('../../app/city/plaza/terrain')
  const { encaixaPrograma } = await import('../../app/city/plaza/programa')

  const metaHm = JSON.parse(leia('public/lunar/btc-core-heightmap.json').toString())
  const bufHm = leia('public/lunar/btc-core-heightmap.f32')
  const terrain = buildTerrain(
    metaHm,
    new Float32Array(bufHm.buffer.slice(bufHm.byteOffset, bufHm.byteOffset + bufHm.byteLength)),
    {
      radiais: M.canais.radiais.map((r: any) => ({
        rumo: r.rumo, secao: CANAL_LAMINA,
        rInicio: Math.min(r.rInicio, LAGO_R1), rFim: r.rFim ?? 4300,
      })),
      aneis: M.canais.aneis,
      talude: M.canais.talude,
      leito: M.lagos.cota - 4,
    },
    { faixaSeca: false },
  )

  // ⚠️ O MESMO ENCAIXE DA CENA, COM OS MESMOS ARGUMENTOS. Se divergir daqui, o
  // artefato descreve uma cidade que ninguém vê. A cena chama isto em
  // `plaza-scene.tsx:3180`; mudou lá, muda aqui.
  const molhado = (x: number, z: number) => terrain.superficieAt(x, z) < M.lagos.cota + 1.2
  const programa = encaixaPrograma(
    C.programa.map((q: any) => ({
      id: q.id, nome: q.nome, tipo: q.tipo, x: q.x, z: q.z,
      area: (q.ha ?? 0) * 1e4 || 4 * (q.a ?? 100) * (q.b ?? 100),
    })),
    molhado,
    { aneis: M.aneisViarios.map((r: any) => r.r), bulevares: M.bulevares.map((r: any) => r.rumo) },
  )

  // ⚠️ AS PEÇAS ANCORADAS POR MÓDULO NÃO PASSAM PELO ENCAIXE. Elas escolheram o
  // módulo à mão (e há script de verificação para cada uma), então entram no
  // artefato pelo módulo, não pela busca. Sem elas o mapa mente por omissão: o
  // alocador de lote plantaria em cima do Estádio.
  const ancoradas: { id: string; mod: Modulo }[] = [
    { id: 'ESTADIO', mod: ESTADIO_MOD },
    { id: 'GEODE', mod: GEODE_MOD },
    { id: 'SPHERE', mod: SPHERE_MOD },
    { id: 'CAMPUS', mod: CAMPUS_MOD },
    { id: 'ATLETISMO', mod: ATLETISMO_MOD },
    { id: 'AQUATICS', mod: AQUATICS_MOD },
    { id: 'DERBY', mod: DERBY_MOD },
  ].map(({ id, mod }) => ({ id, mod }))

  const ancoras = ancoradas.map(({ id, mod }) => {
    const c = caixaDoModulo(mod)
    const a = (c.a0 + c.a1) / 2
    return {
      id, mod,
      cx: Math.sin(a) * c.rm, cz: -Math.cos(a) * c.rm,
      rumo: (a * 180) / Math.PI,
      area_m2: Math.round(areaDoModulo(mod)),
      poly: polyDoModulo(mod).map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]),
    }
  })

  const radiais = Array.from({ length: N_RAD }, (_, i) => ({ i, ang: anguloDe(i), nasce: nasceEm(i) }))
    .filter((r) => r.nasce !== null)

  const mapa = {
    versao: 1,
    gerado_em: new Date().toISOString(),
    nota:
      'Artefato unico do tracado da DogCity. A teia manda (decisao do fundador, 18/09/2026). ' +
      'O gerador de lotes CONSOME este arquivo; ele nao inventa grade propria.',
    fontes: {
      'app/city/plaza/teia.ts': sha(leia('app/city/plaza/teia.ts')),
      'app/city/plaza/programa.ts': sha(leia('app/city/plaza/programa.ts')),
      'app/city/plaza/dome.ts': sha(leia('app/city/plaza/dome.ts')),
      'app/city/plaza/terrain.ts': sha(leia('app/city/plaza/terrain.ts')),
      'public/city/cidade-malha.json': sha(leia('public/city/cidade-malha.json')),
      'public/city/cidade.json': sha(leia('public/city/cidade.json')),
      'public/lunar/btc-core-heightmap.f32': sha(bufHm),
      'public/city/founders-club.json': sha(leia('public/city/founders-club.json')),
    },
    teia: {
      rDentro: R_DENTRO, rFora: R_FORA, meiaLargura: HR, nRad: N_RAD,
      niveis: NIVEIS, aneis: ANEIS,
      vaoPorFaixa: [
        { ate: 2200, vao: vaoDoAnel(2000) }, { ate: 3400, vao: vaoDoAnel(3000) },
        { ate: 5000, vao: vaoDoAnel(4500) }, { ate: R_FORA, vao: vaoDoAnel(6000) },
      ],
      radiais,
    },
    avenidas: { rInicio: AV_R_INICIO, rFim: AV_R_FIM, lista: AVENIDAS },
    alca: { avenida: AVENIDA_ALCA, terra: ALCA_TERRA, rDentro: ALCA_R_DENTRO },
    aneisViarios: aneisDaCidade(M.aneisViarios),
    contorno: M.contorno,
    agua: { lagos: M.lagos, canais: M.canais, eclusas: M.eclusas },
    terraplenagem: {
      podio: { y: PODIO_Y, r0: PODIO_R0, r1: PODIO_R1, r2: PODIO_R2, r3: PODIO_R3, r3Parque: PODIO_R3_PARQUE },
      casca: { r: DOME_R },
    },
    programa: programa.map((p) => ({
      id: p.id, nome: p.nome, tipo: p.tipo, mod: p.mod,
      cx: Math.round(p.cx * 10) / 10, cz: Math.round(p.cz * 10) / 10,
      a: Math.round(p.a * 10) / 10, b: Math.round(p.b * 10) / 10,
      rot: p.rot, area_m2: Math.round(p.areaReal),
      poly: p.poly.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]),
    })),
    ancoras,
    reservas: {
      plaza: {
        r: PLAZA_R, area_km2: +((Math.PI * PLAZA_R * PLAZA_R) / 1e6).toFixed(3),
        nota: 'Distrito Financeiro dentro da Plaza (tiersposition 3.12.5). Nao e tecido residencial.',
      },
      anel2: {
        unidade: 'phi', ...ANEL2, area_km2: +coroa(ANEL2.de, ANEL2.ate).toFixed(3),
        estado: 'demarcado, vazio', poligono: null,
      },
      anel3: {
        unidade: 'phi', ...ANEL3, area_km2: +coroa(ANEL3.de, ANEL3.ate).toFixed(3),
        estado: 'demarcado, vazio', poligono: null,
      },
      forma: { phiBorda: PHI_BORDA, k: +K_FORMA.toFixed(5), area_km2: +(areaContorno / 1e6).toFixed(3) },
      // ⚠️ O EIXO DA TERRA, e ele é a única direção da cidade que não sai da
      // geometria: sai do CÉU. A Terra está em azimute 196 e não se move, porque
      // a Lua é travada por maré. Os dois mirantes ficam no rumo OPOSTO (16), e
      // é isso que põe a cidade inteira entre quem olha e a Terra; um mirante no
      // rumo 196 olharia a Terra por cima do regolito vazio.
      //
      // ⚠️ DOIS MIRANTES NO MESMO EIXO, A DUAS ESCALAS (fundador, 20/09): o da
      // Praça, onde todo mundo passa, com a praça e o lago no quadro; o do
      // Pódio, a 7.050, com os 11 km da cidade no quadro. Mesmo alinhamento, duas
      // leituras.
      mirantesDaTerra: {
        azimuteDaTerra: 196,
        elevacaoDaTerra: 16,
        rumo: 16,
        praca: { rumo: 16, r: 900, x: 248.1, z: -865.1 },
        podio: { rumo: 16, r: 7050, x: 1943.2, z: -6776.9 },
        nota: 'a Terra nao nasce nem se poe: um mirante fixo funciona para sempre',
      },
      // ⚠️ A ILHA DO CLUBE ENTRA COMO TERRA, e por isso mora no mapa e não numa
      // lista de peças à parte: ela é terra NOVA criada dentro da água, e o
      // gerador de lotes precisa saber que aquele pedaço de baía deixou de ser
      // lâmina. A geometria nasce em `scripts/city/ilha-founders.py`, que é onde
      // ela foi projetada; aqui ela só é incorporada.
      foundersClub: JSON.parse(leia('public/city/founders-club.json').toString()),
      limite: {
        r: DOME_R,
        nota: 'A casca e limite de pressao. Do Anel 4 em diante a cidade precisa de casca nova.',
      },
    },
    extracao: M.extracao,
    autopistas: M.autopistas,
    metro: M.metro,
  }

  const texto = JSON.stringify(mapa, null, 0)
  writeFileSync(SAIDA, texto)
  const hash = sha(texto)
  writeFileSync(`${SAIDA}.sha256`, `${hash}  ${SAIDA.split('/').pop()}\n`)

  const km2 = (v: number) => v.toFixed(3).padStart(8)
  console.log(`
MAPA v1 congelado em ${SAIDA}   ${(texto.length / 1e6).toFixed(2)} MB
sha256  ${hash}

teia          ${ANEIS.length} aneis de ${R_DENTRO} a ${R_FORA}, ${radiais.length} radiais de ${N_RAD} posicoes
avenidas      ${AVENIDAS.length} radiais de ${AV_R_INICIO} a ${AV_R_FIM}, mais a AN7 da alca em r ${AVENIDA_ALCA.r}
programa      ${programa.length} pecas encaixadas, ${(programa.reduce((s, p) => s + p.areaReal, 0) / 1e6).toFixed(3)} km2
ancoras       ${ancoras.length} pecas por modulo, ${(ancoras.reduce((s, a) => s + a.area_m2, 0) / 1e6).toFixed(3)} km2
contorno      ${M.contorno.length} vertices
canais        ${M.canais.radiais.length} radiais e ${M.canais.aneis.length} aneis
reservas      plaza  ${km2((Math.PI * PLAZA_R * PLAZA_R) / 1e6)} km2  (r ${PLAZA_R})
              anel 2 ${km2(coroa(ANEL2.de, ANEL2.ate))} km2  (phi ${ANEL2.de} a ${ANEL2.ate})
              anel 3 ${km2(coroa(ANEL3.de, ANEL3.ate))} km2  (phi ${ANEL3.de} a ${ANEL3.ate})
forma         contorno ${(areaContorno / 1e6).toFixed(3)} km2 em phi ${PHI_BORDA}, k ${K_FORMA.toFixed(5)}
              ilha do clube  ${(JSON.parse(leia('public/city/founders-club.json').toString()).area_m2.terra / 1e4).toFixed(1)} ha de terra nova na baia
limite        casca em r ${DOME_R}
`)
}

main().catch((e) => { console.error(e); process.exit(1) })
