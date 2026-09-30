// Regras das salas da sede KRAY•SPACE no DOGCITY, sem rede: DOG SOCIAL CLUB
// (lib/ordinals/dsc.ts + a pagina da UniSat em lib/ordinals/inscriptions.ts), DOG
// DAO (lib/runes/dog-l1.ts) e a conferencia do pedido (lib/dogcity/acesso-salas.ts).
// O caminho REAL (as fontes de verdade) roda em scripts/salas.real.mjs.
// Rodar: node --import ./scripts/ts-resolver.mjs --test scripts/salas.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verificarDsc, eOficialDsc } from '../lib/ordinals/dsc.ts'
import { DSC_IDS, DSC_PAI } from '../lib/ordinals/dsc-colecao.ts'
import { lerPaginaUnisat } from '../lib/ordinals/unisat-pagina.ts'
import { DOG_NOME, DOG_RUNE_ID, fonteKrayDog, fonteOrdDog, unidadesDog, verificarDog } from '../lib/runes/dog-l1.ts'
import { conferirPedido } from '../lib/dogcity/pedido-sala.ts'

const EU = 'bc1pqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'
const OUTRO = 'bc1pzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'
const OFICIAL = DSC_IDS[17]
const FALSO = 'f'.repeat(64) + 'i0' // "DOG SOCIAL CLUB #18" de outra colecao: mesmo nome, outro ID
const id = (n) => n.toString(16).padStart(64, 'a') + 'i0'

/** fonte de lista paginada falsa (cursor em itens) */
function lista(nome, itens, { falha = false } = {}) {
  const chamadas = { n: 0 }
  return {
    chamadas,
    fonte: {
      nome,
      listar: async (_e, cursor, tamanho) => {
        chamadas.n++
        if (falha) throw new Error(`${nome} 503`)
        const items = itens.slice(cursor, cursor + tamanho)
        return { items, total: itens.length, proximo: cursor + items.length }
      },
    },
  }
}
const dono = (mapa, { falha = false } = {}) => async (i) => (falha ? null : mapa[i] ?? null)

// ---- a pagina da UniSat: o falso negativo ----

/** uma pagina no formato da UniSat: uma linha por inscricao, cada linha com TODAS as do UTXO */
function paginaUnisat(utxos, total) {
  const inscription = []
  for (const ids of utxos) for (const i of ids) inscription.push({ inscriptionId: i, inscriptionNumber: 1, utxo: { inscriptions: ids.map((x) => ({ inscriptionId: x, inscriptionNumber: 1 })) } })
  return { code: 0, data: { total: total ?? inscription.length, inscription } }
}

test('UniSat: o id vem da linha, os do UTXO nao repetem, e o cursor anda em LINHAS', () => {
  // 1 UTXO com 3 inscricoes + 1 UTXO com 1: 4 linhas, 4 inscricoes
  const p = lerPaginaUnisat(paginaUnisat([[id(1), id(2), id(3)], [id(4)]]))
  assert.equal(p.linhas, 4)
  assert.deepEqual(p.items.map((x) => x.id), [id(1), id(2), id(3), id(4)])
  // linha sem utxo.inscriptions preenchido: ainda conta
  const q = lerPaginaUnisat({ code: 0, data: { total: 1, inscription: [{ inscriptionId: id(9), inscriptionNumber: 5 }] } })
  assert.deepEqual(q.items.map((x) => x.id), [id(9)])
})

test('UniSat: a leitura ANTIGA pulava inscricoes e concluia "sem posse" (a causa do falso negativo)', () => {
  // 3 paginas de 100 linhas: 50 UTXOs de 2 inscricoes na primeira; o DSC oficial na linha 150 (pagina 2)
  const utxos = []
  for (let k = 0; k < 50; k++) utxos.push([id(1000 + 2 * k), id(1001 + 2 * k)])
  const resto = []
  for (let k = 100; k < 300; k++) resto.push(k === 150 ? OFICIAL : id(5000 + k))
  const linhas = [...utxos.flat().map((x) => ({ x, u: utxos.find((u) => u.includes(x)) })), ...resto.map((x) => ({ x, u: [x] }))]
  const pagina = (cursor) => {
    const fatia = linhas.slice(cursor, cursor + 100)
    return { code: 0, data: { total: linhas.length, inscription: fatia.map(({ x, u }) => ({ inscriptionId: x, utxo: { inscriptions: u.map((y) => ({ inscriptionId: y })) } })) } }
  }
  // o jeito antigo: achata utxo.inscriptions de cada linha e avanca pelo numero de itens achatados
  let cursor = 0
  let viu = false
  for (let i = 0; i < 30; i++) {
    const rows = pagina(cursor).data.inscription
    const achatados = rows.flatMap((r) => r.utxo.inscriptions.map((y) => y.inscriptionId))
    if (achatados.includes(OFICIAL)) viu = true
    cursor += achatados.length
    if (rows.length === 0 || cursor >= linhas.length) break
  }
  assert.equal(viu, false, 'a leitura antiga pula o DSC oficial')
  // o jeito novo: cursor em linhas
  cursor = 0
  viu = false
  for (let i = 0; i < 30; i++) {
    const p = lerPaginaUnisat(pagina(cursor))
    if (p.items.some((x) => x.id === OFICIAL)) viu = true
    cursor += p.linhas
    if (p.linhas === 0 || cursor >= p.total) break
  }
  assert.equal(viu, true, 'a leitura nova acha o DSC oficial')
})

// ---- DOG SOCIAL CLUB ----

test('a lista fechada: 306 filhos diretos do pai, sem o pai e sem o neto manifesto', () => {
  assert.equal(DSC_IDS.length, 306)
  assert.equal(new Set(DSC_IDS).size, 306)
  assert.ok(!eOficialDsc(DSC_PAI))
  assert.ok(!eOficialDsc('0eb8a13fe8d34babe30de64aeb0a2d6893406b5c8d6419a36663df7456496837i0'))
})

test('DSC: item legitimo na pagina 3 de uma carteira grande: acha (paginacao inteira) e confere no ord', async () => {
  const itens = [...Array.from({ length: 250 }, (_, i) => ({ id: id(i), number: i })), { id: OFICIAL, number: 77 }]
  const l = lista('unisat', itens)
  const r = await verificarDsc(EU, { listas: [l.fonte], dono: dono({ [OFICIAL]: EU }) })
  assert.equal(r.status, 'holder')
  assert.equal(r.inscricao.id, OFICIAL)
  assert.equal(l.chamadas.n, 3)
})

test('DSC: mesmo nome, outra colecao (id falso): sem posse; varre ate o fim', async () => {
  const r = await verificarDsc(EU, { listas: [lista('kray', [{ id: FALSO, number: 1 }]).fonte], dono: dono({ [FALSO]: EU }) })
  assert.equal(r.status, 'sem_posse')
})

test('DSC: a primeira fonte cai, a proxima responde (a falha de uma fonte nunca vira "sem posse")', async () => {
  const a = lista('unisat', [], { falha: true })
  const b = lista('kray', [{ id: OFICIAL, number: 0 }])
  const r = await verificarDsc(EU, { listas: [a.fonte, b.fonte], dono: dono({ [OFICIAL]: EU }) })
  assert.equal(r.status, 'holder')
  assert.equal(r.fonte, 'kray')
})

test('DSC: todas as fontes de lista fora: indisponivel (nao "sem posse")', async () => {
  const r = await verificarDsc(EU, { listas: [lista('unisat', [], { falha: true }).fonte, lista('kray', [], { falha: true }).fonte], dono: dono({}) })
  assert.deepEqual(r, { status: 'indisponivel', motivo: 'indexador' })
})

test('DSC: listado mas o ord diz outro dono (transferido): sem posse', async () => {
  const r = await verificarDsc(EU, { listas: [lista('kray', [{ id: OFICIAL, number: 0 }]).fonte], dono: dono({ [OFICIAL]: OUTRO }) })
  assert.equal(r.status, 'sem_posse')
})

test('DSC: listado mas o ord nao responde: indisponivel (conferencia)', async () => {
  const r = await verificarDsc(EU, { listas: [lista('kray', [{ id: OFICIAL, number: 0 }]).fonte], dono: dono({}, { falha: true }) })
  assert.deepEqual(r, { status: 'indisponivel', motivo: 'conferencia' })
})

test('DSC: anunciado a venda e ainda no UTXO do dono (o ord devolve o dono): holder', async () => {
  const r = await verificarDsc(EU, { listas: [lista('ord', [{ id: OFICIAL, number: 0 }]).fonte], dono: dono({ [OFICIAL]: EU.toUpperCase() }) })
  assert.equal(r.status, 'holder')
})

test('DSC: carteira grande demais para varrer agora: indisponivel', async () => {
  const itens = Array.from({ length: 3100 }, (_, i) => ({ id: id(i), number: i }))
  const r = await verificarDsc(EU, { listas: [lista('unisat', itens).fonte], dono: dono({}) })
  assert.deepEqual(r, { status: 'indisponivel', motivo: 'carteira_grande' })
})

// ---- DOG DAO ----

const ord = (runas, { falha = false } = {}) => fonteOrdDog(async () => {
  if (falha) throw new Error('ord 406')
  return { runas }
})
const kray = (utxos, { falha = false } = {}) => fonteKrayDog(async () => {
  if (falha) throw new Error('kray 503')
  return utxos
})

test('DOG: identidade da rune pelo ID e pelo nome espacado', () => {
  assert.equal(DOG_RUNE_ID, '840000:3')
  assert.equal(DOG_NOME, 'DOG•GO•TO•THE•MOON')
  assert.equal(unidadesDog('8481988.12921'), 848198812921n)
  assert.equal(unidadesDog('0.00001'), 1n)
  assert.equal(unidadesDog('0'), 0n)
})

test('DOG: o ord responde com saldo: holder', async () => {
  const r = await verificarDog(EU, [ord([[DOG_NOME, '12.5', '🐕']]), kray([], { falha: true })])
  assert.deepEqual(r, { status: 'holder', fonte: 'ord' })
})

test('DOG: outra rune com "DOG" no nome nao conta', async () => {
  const r = await verificarDog(EU, [ord([['DOG•DOG•DOG', '100', 'D'], ['DOGGOTOTHEMOON', '5', 'D']])])
  assert.equal(r.status, 'sem_posse')
})

test('DOG: ord fora, a Kray decide e so' + "' UTXO confirmado conta", async () => {
  const soNaoConfirmado = [{ confirmado: false, runas: [{ id: DOG_RUNE_ID, quantidade: 500n }] }]
  let r = await verificarDog(EU, [ord([], { falha: true }), kray(soNaoConfirmado)])
  assert.deepEqual(r, { status: 'sem_posse', fonte: 'kray' })
  r = await verificarDog(EU, [ord([], { falha: true }), kray([...soNaoConfirmado, { confirmado: true, runas: [{ id: DOG_RUNE_ID, quantidade: 1n }] }])])
  assert.deepEqual(r, { status: 'holder', fonte: 'kray' })
  // outra rune de mesmo ticker, outro id
  r = await verificarDog(EU, [ord([], { falha: true }), kray([{ confirmado: true, runas: [{ id: '1:0', quantidade: 9n }] }])])
  assert.equal(r.status, 'sem_posse')
})

test('DOG: todas as fontes fora: indisponivel (nunca "sem DOG")', async () => {
  const r = await verificarDog(EU, [ord([], { falha: true }), kray([], { falha: true })])
  assert.deepEqual(r, { status: 'indisponivel', motivo: 'fontes' })
})

// ---- o pedido ----

test('pedido: o endereco do jogo tem de ser o da sessao provada (senao 401 sessao_de_outro)', () => {
  assert.equal(conferirPedido({ address: EU }, { endereco: EU.toUpperCase() }), 'ok')
  assert.equal(conferirPedido({ address: EU }, {}), 'ok')
  assert.equal(conferirPedido({ address: EU }, { endereco: OUTRO }), 'sessao_de_outro')
})
