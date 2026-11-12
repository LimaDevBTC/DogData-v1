// Rodar: npx tsx --test app/dogcity/landing/licenca-no-lote.test.ts
//
// A licença ao lado do lote na busca (contrato FUNIL_LOTE_LICENCA_CASA.md §2 e §4):
// o bloco do índice das casas, o estado da casa e as frases. Nenhuma frase pode ter
// travessão, preço ou data; quem tem licença nunca lê um botão de compra.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  blocoDe, blocoExiste, estadoNoBloco, fraseDaCasa, fraseDeSubir, idDaCasa, rotuloDeConstruir, tamanhoDoBloco,
  CTA_CONSTRUIR, NOTA_CONSTRUIR, type EstadoDaCasa,
} from './licenca-no-lote'

const LOTE = 'S05-Q19-B2116-L128'
// a forma real do arquivo de bloco (play.dogcity.space/city/dados/casas/-10_-4.json, 01/11/2026), enxuta
const BLOCO = {
  v: 1,
  bloco: '-10_-4',
  mintados: ['S05-Q19-B2116-L133'],
  entradas: [{ id: 'CASA_S05_Q19_B2116_L128', nome: 'Timberline Main Street Building' }],
}

test('o id da casa troca hifens por sublinhado', () => {
  assert.equal(idDaCasa(LOTE), 'CASA_S05_Q19_B2116_L128')
})

test('o bloco sai do piso de x e z pelo tamanho do bloco', () => {
  assert.equal(blocoDe(-4653.62, -1775.16, 500), '-10_-4')
  assert.equal(blocoDe(0, 0, 500), '0_0')
  assert.equal(blocoDe(499.9, -0.1, 500), '0_-1')
  assert.equal(blocoDe('x', 0, 500), null)
  assert.equal(blocoDe(0, NaN, 500), null)
  assert.equal(blocoDe(0, 0, 0), null)
})

test('o indice.json: tamanhoBloco e a lista de blocos', () => {
  const indice = { v: 1, tamanhoBloco: 500, blocos: { '-10_-4': 2 } }
  assert.equal(tamanhoDoBloco(indice), 500)
  assert.equal(tamanhoDoBloco({ tamanhoBloco: -1 }), null)
  assert.equal(tamanhoDoBloco(null), null)
  assert.equal(blocoExiste(indice, '-10_-4'), true)
  assert.equal(blocoExiste(indice, '3_3'), false)
  // sem lista, não se nega: pode existir
  assert.equal(blocoExiste({ tamanhoBloco: 500 }, '3_3'), true)
})

test('o arquivo do bloco: casa de pé, mintado sem casa, ausente', () => {
  assert.equal(estadoNoBloco(BLOCO, LOTE), 'construida')
  assert.equal(estadoNoBloco(BLOCO, 'S05-Q19-B2116-L133'), 'mintado_sem_casa')
  assert.equal(estadoNoBloco(BLOCO, 'S05-Q19-B2116-L999'), 'ausente')
  // dado torto nunca lança nem inventa casa
  assert.equal(estadoNoBloco(null, LOTE), 'ausente')
  assert.equal(estadoNoBloco({ entradas: 'x', mintados: 7 }, LOTE), 'ausente')
})

test('as frases de quem tem licença, por estado', () => {
  assert.deepEqual(fraseDaCasa('personal', 'construida'), { titulo: 'Your Personal house is built.', nota: null, verCasa: true })
  assert.equal(fraseDaCasa('commercial', 'mintado_sem_casa').titulo, 'Your Commercial house is in production.')
  assert.equal(fraseDaCasa('commercial', 'mintado_sem_casa').nota, 'It appears on this lot in the city.')
  assert.equal(fraseDaCasa('personal', 'ausente').nota, 'It stands on this lot in the city once the deed is minted.')
  assert.deepEqual(fraseDaCasa('personal', 'desconhecido'), { titulo: 'Your Personal licence is on this lot.', nota: null, verCasa: false })
  // Patron: sempre "residence in design", nunca "house"
  for (const e of ['construida', 'mintado_sem_casa', 'ausente', 'desconhecido'] as EstadoDaCasa[]) {
    const f = fraseDaCasa('patron', e)
    assert.equal(f.titulo, 'Your Patron residence is in design.')
    assert.doesNotMatch(f.titulo + (f.nota ?? ''), /house/i)
  }
})

test('subir de degrau é link discreto, e o Patron não sobe', () => {
  assert.deepEqual(fraseDeSubir('personal'), { proximo: 'commercial', rotulo: 'Move up to Commercial: pay only the difference' })
  assert.deepEqual(fraseDeSubir('commercial'), { proximo: 'patron', rotulo: 'Move up to Patron: pay only the difference' })
  assert.equal(fraseDeSubir('patron'), null)
})

test('o botão de quem não tem licença: "Build your house" só com escritura conhecida', () => {
  assert.equal(rotuloDeConstruir('construida'), CTA_CONSTRUIR.mintado)
  assert.equal(rotuloDeConstruir('mintado_sem_casa'), CTA_CONSTRUIR.mintado)
  assert.equal(rotuloDeConstruir('ausente'), CTA_CONSTRUIR.desconhecido)
  assert.equal(rotuloDeConstruir('desconhecido'), CTA_CONSTRUIR.desconhecido)
  assert.equal(CTA_CONSTRUIR.mintado, 'Build your house')
})

test('nenhuma frase tem travessão, preço, data ou contagem', () => {
  const frases: string[] = [CTA_CONSTRUIR.mintado, CTA_CONSTRUIR.desconhecido, NOTA_CONSTRUIR]
  for (const d of ['personal', 'commercial', 'patron'] as const) {
    for (const e of ['construida', 'mintado_sem_casa', 'ausente', 'desconhecido'] as EstadoDaCasa[]) {
      const f = fraseDaCasa(d, e)
      frases.push(f.titulo)
      if (f.nota) frases.push(f.nota)
    }
    const s = fraseDeSubir(d)
    if (s) frases.push(s.rotulo)
  }
  for (const f of frases) {
    assert.doesNotMatch(f, /[–—]/, `travessão em "${f}"`)
    assert.doesNotMatch(f, /US\$|\$DOG|\d{4}|\d+,\d{3}/, `preço, data ou contagem em "${f}"`)
  }
})
