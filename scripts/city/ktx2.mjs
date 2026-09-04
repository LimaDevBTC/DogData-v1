#!/usr/bin/env node
// CONVERSOR DO ACERVO PARA KTX2, o espelho que o celular carrega.
//
// POR QUE ISTO EXISTE. A /city não abre em celular: o contexto WebGL cai por
// falta de memória. Medido em 04/09, o boot padrão sobe 178 imagens embutidas
// nos GLB do acervo, 197,7 MiB em RGBA8 com mipmap, e 266 das 368 imagens do
// acervo são 512x512. Teto de resolução por lado NÃO ALCANÇA isso: elas já
// cabem folgadas em 2.048. O único remédio é trocar o FORMATO, e é o que KTX2
// faz: a imagem chega comprimida em bloco e é transcodificada direto para o
// formato nativo da GPU, sem nunca virar RGBA8.
//
// ⚠️ SAÍDA É ETC1S, NÃO UASTC, e a diferença é grande no aparelho que interessa.
// Em KTX2Loader.js a entrada `astcSupported` tem `priorityETC1S: Infinity`, ou
// seja ASTC nunca é escolhido para um arquivo ETC1S; quem ganha no iPhone é
// `etc2Supported`, com prioridade 1. Um ETC1S vira RGB_ETC2 (4 bits por texel,
// fator 8 sobre RGBA8) ou RGBA_ETC2_EAC (8 bits, fator 4). Se o arquivo saísse
// em UASTC o iPhone receberia ASTC 4x4 a 8 bits por texel: o DOBRO de VRAM e
// muito mais download, para uma cena que morre de memória.
//
// ⚠️ O ESPELHO É SÓ DO CELULAR. Os arquivos originais em public/city/sf/ ficam
// intocados e o desktop continua carregando exatamente eles, bit a bit. A troca
// é feita em uma linha, por `LoadingManager.setURLModifier`, atrás de
// `profile.cortaTextura`. ETC1S é compressão COM PERDA e o desktop não paga
// esse preço porque não precisa.
//
// ⚠️ E O ESPELHO PRECISA SER COMPLETO. Um arquivo que falte aqui vira 404 no
// telefone, `loadSf` devolve null e a peça some da praça em silêncio. Por isso o
// script converte o acervo inteiro e falha ruidosamente, não peça por peça.
//
// A CADEIA, e cada elo existe por um motivo medido:
//   1. `png --formats "*"`: as imagens do acervo são WebP (EXT_texture_webp) e o
//      transform de KTX as PULA com um aviso fácil de não ler. O padrão de
//      `--formats` é "png", que só pega o que JÁ era png; sem o "*" a conversão
//      passa e não converte quase nada.
//   2. `etc1s`: a conversão de verdade.
//   3. `draco`: o passo 1 DESFAZ o Draco da malha ("Further compression will be
//      lossy") e o arquivo dobra de tamanho. Sem reaplicar, troca-se memória de
//      textura por download de geometria.
//
// ⚠️ O ESPELHO É MAIOR NO DISCO, e o passo 3 não muda isso: ele evita que o
// arquivo DOBRE, não garante arquivo menor. Medido: 19,17 MB para 19,61 MB, ou
// seja +2,3% de download, com 48 dos 89 arquivos crescendo (os piores são
// peixe-palhaco +111%, coral-set +74%, bench-classic +72%). ETC1S é bloco de
// tamanho fixo e não compete com WebP em BYTE DE ARQUIVO; ele ganha em VRAM, que
// é onde o telefone estava morrendo. A troca é 0,44 MB de rede por 392 MiB de
// RGBA8, e é por isso que ela vale.
//
// ⚠️ O ESPELHO É UNIVERSAL, A PODA NÃO. `podarMapasSecundarios` descarta os mapas
// de normal depois da carga, mas ela só cobre dois dos caminhos de GLB da cena
// (props.ts e monuments.ts). Quem for tentado a economizar tirando os normais
// daqui: NÃO. Os outros caminhos (inverno, caverna, montanha, park) carregam do
// mesmo espelho e não passam pela poda, e ficariam sem relevo sem que ninguém
// tivesse pedido.
//
// FERRAMENTA. Nada disso está no package.json de propósito: é ferramenta de
// build de asset, não dependência de runtime. Fica em ~/.cache/dogcity-ktx2:
//   node   v24 (o CLI 4.x usa import attributes, que o node 18 do sistema não lê)
//   npm i --include=optional @gltf-transform/cli    (o sharp precisa das opcionais)
//   KTX-Software 4.4.2, tarball oficial da Khronos extraído sem sudo
//     sha1 c6b08c817f8c8dd299deccae4f2fbb8d55e9acd2
//
// USO:  node scripts/city/ktx2.mjs [--force] [--so=arquivo1,arquivo2]

import { execFileSync } from 'node:child_process'
import { readdirSync, mkdirSync, existsSync, statSync, rmSync } from 'node:fs'
import { join, basename } from 'node:path'
import { homedir, tmpdir } from 'node:os'

const RAIZ = new URL('../../', import.meta.url).pathname
const ORIGEM = join(RAIZ, 'public/city/sf')
const DESTINO = join(RAIZ, 'public/city/sf-ktx2')
const FERRAMENTA = join(homedir(), '.cache/dogcity-ktx2')
const GLTF = join(FERRAMENTA, 'node_modules/.bin/gltf-transform')
const BIN_KTX = join(FERRAMENTA, 'ktxsw/bin')
const LIB_KTX = join(FERRAMENTA, 'ktxsw/lib')
const NODE24 = join(homedir(), '.nvm/versions/node/v24.11.1/bin')

const forcar = process.argv.includes('--force')
const soArg = process.argv.find((a) => a.startsWith('--so='))
const filtro = soArg ? new Set(soArg.slice(5).split(',')) : null

if (!existsSync(GLTF)) {
  console.error(`\nFALTA A FERRAMENTA. Esperava ${GLTF}.\nVer o cabeçalho deste arquivo para montar ~/.cache/dogcity-ktx2.\n`)
  process.exit(1)
}
if (!existsSync(join(BIN_KTX, 'ktx'))) {
  console.error(`\nFALTA O BINÁRIO ktx da Khronos em ${BIN_KTX}.\nVer o cabeçalho deste arquivo.\n`)
  process.exit(1)
}

const ambiente = {
  ...process.env,
  PATH: `${BIN_KTX}:${NODE24}:${process.env.PATH}`,
  LD_LIBRARY_PATH: `${LIB_KTX}:${process.env.LD_LIBRARY_PATH ?? ''}`,
}

const passo = (args) => execFileSync(GLTF, args, { env: ambiente, stdio: ['ignore', 'pipe', 'pipe'] })

mkdirSync(DESTINO, { recursive: true })
const trabalho = join(tmpdir(), 'dogcity-ktx2-work')
mkdirSync(trabalho, { recursive: true })

// ⚠️ DOIS ARQUIVOS DO ACERVO ESTÃO QUEBRADOS NA ORIGEM, e o conversor foi quem
// achou a causa. `pedestal.glb` e `torch-pillar.glb` têm uma entrada de textura
// SEM `source` nenhum (`"extensions": {}`, nem EXT_texture_webp nem source), e
// pior: um material APONTA para ela (o baseColorTexture do pedestal, o
// emissiveTexture do segundo material do torch-pillar). O gltf-transform lê null
// e morre com "Cannot read properties of null (reading 'setMagFilter')".
//
// Isto muito provavelmente é a causa que a nota de 01/09 em sf-assets.ts
// registrou e não explicou: os dois avisavam "asset não carregou" com o servidor
// respondendo 200, e a conclusão na época foi que os arquivos estavam íntegros.
// Não estão. Uma textura sem imagem quebra o GLTFLoader do mesmo jeito.
//
// Enquanto os originais não forem reexportados, os dois entram no espelho como
// CÓPIA: o telefone se comporta igual ao desktop (as duas peças não sobem em
// nenhum dos dois) e ninguém ganha um 404 por cima de um defeito que já existia.
// Consertar o asset devolve duas peças à praça e é mudança VISUAL, com chapa.
const QUEBRADOS = new Set(['pedestal.glb', 'torch-pillar.glb'])

const arquivos = readdirSync(ORIGEM).filter((f) => f.endsWith('.glb')).sort()
const alvos = filtro ? arquivos.filter((f) => filtro.has(basename(f, '.glb'))) : arquivos

console.log(`acervo: ${arquivos.length} arquivos, convertendo ${alvos.length}\n`)

let antes = 0, depois = 0, feitos = 0, pulados = 0
const falhas = []

for (const [i, nome] of alvos.entries()) {
  const entrada = join(ORIGEM, nome)
  const saida = join(DESTINO, nome)
  const tamEntrada = statSync(entrada).size

  if (!forcar && existsSync(saida) && statSync(saida).mtimeMs > statSync(entrada).mtimeMs) {
    antes += tamEntrada; depois += statSync(saida).size; pulados++
    continue
  }

  const a = join(trabalho, 'a.glb'), b = join(trabalho, 'b.glb')
  const rotulo = `[${String(i + 1).padStart(3)}/${alvos.length}] ${nome}`
  try {
    // ⚠️ um GLB de 132 bytes (conversão que não terminou: cardume, peixe-anjo,
    // polvo-jardim) não tem malha nenhuma e quebra a cadeia. Copia direto: o
    // espelho precisa do arquivo existindo, e `loadSf` já trata cena vazia.
    if (tamEntrada < 1024 || QUEBRADOS.has(nome)) {
      execFileSync('cp', [entrada, saida])
      antes += tamEntrada; depois += statSync(saida).size; feitos++
      console.log(`${rotulo}  (${QUEBRADOS.has(nome) ? 'textura órfã na origem' : 'vazio'}, copiado)`)
      continue
    }
    passo(['png', '--formats', '*', entrada, a])
    passo(['etc1s', a, b])
    passo(['draco', b, saida])
    const tamSaida = statSync(saida).size
    antes += tamEntrada; depois += tamSaida; feitos++
    const delta = ((tamSaida / tamEntrada - 1) * 100).toFixed(0)
    console.log(`${rotulo}  ${(tamEntrada / 1024).toFixed(0)} KB → ${(tamSaida / 1024).toFixed(0)} KB (${delta > 0 ? '+' : ''}${delta}%)`)
  } catch (e) {
    falhas.push(nome)
    console.error(`${rotulo}  FALHOU: ${String(e.stderr ?? e.message).slice(0, 300)}`)
  }
}

rmSync(trabalho, { recursive: true, force: true })

console.log(`\nconvertidos ${feitos}, reaproveitados ${pulados}, falhas ${falhas.length}`)
console.log(`disco: ${(antes / 1e6).toFixed(1)} MB → ${(depois / 1e6).toFixed(1)} MB`)
if (falhas.length) {
  console.error(`\n⚠️ O ESPELHO ESTÁ INCOMPLETO e NÃO PODE IR AO AR assim: um arquivo que falte`)
  console.error(`vira 404 no telefone e a peça some da praça em silêncio.\nFaltam: ${falhas.join(', ')}\n`)
  process.exit(1)
}
