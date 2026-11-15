// Rodar: npx tsx --test lib/game/points/igualdade.test.ts
//   (com o jogo ao lado, compara AO VIVO também: DOGCITY_MUNDO_DIR=/caminho/do/dogcity-mundo npx tsx --test ...)
//
// As regras puras dos DC Points no servidor são CÓPIA das do jogo (dogcity-mundo src/economia/README.md: "as regras puras
// são copiadas lá com teste de igualdade"). Este teste roda uma bateria de entradas (valores bons, ruins e hostis) nas
// contas do saldo (regras_saldo), no preço do dia (regras_preco + hash32 + o catálogo de itens), nos números (ECONOMIA) e
// na leitura do save (validarSecao, espelhada em legacyBalanceFromSave) e compara a SOMA DE VERIFICAÇÃO (sha256 do JSON das
// saídas) com a tirada do código do JOGO em 15/11/2026 (dogcity-mundo @ 27dc4fa83). Reprovou: o servidor e o jogo deixaram
// de concordar; copie de novo do jogo (nunca ajuste a soma sem copiar).
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ECONOMIA } from './ajustes_economia'
import { ITENS_PRECO } from './catalogo_itens'
import * as preco from './regras_preco'
import * as saldo from './regras_saldo'
import { legacyBalanceFromSave } from './rules'

const sha = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex')

// as somas tiradas do JOGO (rodando estas mesmas baterias sobre os módulos de dogcity-mundo @ 27dc4fa83)
const SOMA_JOGO = {
  economia: '12dfe2bb4a1ff7af44030ee726f6c3abde82b9a6f3b8e2e2640bed7c6429cf89',
  saldo: '45c293491d790a60fd8733704d039527d7e3f62e945864879ef949835f89d57f',
  preco: '6bee26956de982513b7ed096f272986895810d9f1dba225b66fe719cbe5a173e',
  itens: '05a6a0f0752077d78cd8aa180c75a86d104a02fb24021a81e3973b3f7860ed28',
  save: 'cf06b54b059d6c7398cf2458a4f447e8660e04915d9764a9006f5a3fbe8f06d0',
}

const HOSTIS: unknown[] = [0, 1, 2, 7, 10, 479, 480, 481, 9_999, 10_000, 10_001, 999_999, 1_000_000, 1_000_001, -1, -0, 0.5, 1.5, NaN, Infinity, -Infinity, '5', null, undefined, true, [3], { v: 1 }]

type SaldoMod = typeof saldo
type PrecoMod = typeof preco

function bateriaSaldo(m: SaldoMod, p: typeof ECONOMIA) {
  const out: unknown[] = []
  for (const v of HOSTIS) {
    out.push(['valor', String(v), m.valorValido(v, p), m.saldoValido(v, p), m.diaValido(v)])
    for (const q of [1, 3, 100, 0, -1, 1.5, NaN]) out.push(['total', String(v), q, m.totalDe(v, q, p)])
  }
  const perfis: unknown[] = [null, undefined, {}, { verified: true }, { verified: true, handle: '' }, { verified: true, handle: '  ' },
    { verified: true, handle: 'dog' }, { verified: false, handle: 'dog' }, { verified: 'true', handle: 'dog' }, { verified: true, handle: 5 }, 'x', 7]
  for (const pf of perfis) out.push(['perfil', JSON.stringify(pf ?? null), m.podeAcumular(pf)])
  const dias = [20_407, 20_408, NaN, 1.5]
  const recebidos: (saldo.RecebidoDia | null)[] = [null, { dia: 20_407, total: 0 }, { dia: 20_407, total: 470 }, { dia: 20_407, total: 480 }, { dia: 20_406, total: 480 }, { dia: 20_407, total: -3 }, { dia: 20_407, total: 1.5 }]
  for (const hoje of dias) {
    for (const r of recebidos) {
      out.push(['restante', String(hoje), JSON.stringify(r), m.restanteHoje(r, hoje, p), JSON.stringify(m.recebidoEm(r, hoje))])
      for (const s of [0, 100, 999_990, 1_000_000, -5, 2.5, NaN]) {
        for (const v of [1, 10, 11, 480, 481, 10_000, 10_001, 0, -1, 0.5, NaN, Infinity]) {
          for (const ac of [true, false]) {
            out.push(['receber', s, v, String(hoje), JSON.stringify(r), ac, JSON.stringify(m.receber(s, v, hoje, r as saldo.RecebidoDia, ac, p))])
          }
        }
      }
    }
  }
  for (const s of [0, 5, 100, 1_000_000, -1, 1.5, NaN]) {
    for (const v of [1, 5, 6, 100, 10_000, 10_001, 0, -1, 0.5, NaN]) out.push(['gastar', s, v, JSON.stringify(m.gastar(s, v, p))])
  }
  return out
}

function bateriaPreco(m: PrecoMod, p: typeof ECONOMIA, itens: Record<string, preco.ItemComPreco>) {
  const out: unknown[] = []
  const ids = Object.keys(itens).sort()
  for (const id of ids) {
    const it = itens[id]
    out.push(['base', id, m.precoBaseDe(it, p), m.negociavel(it, p), m.hashId(id)])
    for (let dia = 20_380; dia <= 20_780; dia++) out.push(['dia', id, dia, m.precoDoDia(it, dia, 1, p)])
    for (const esc of [0.5, 2, 3, 10, 0, -1, NaN, Infinity]) out.push(['esc', id, String(esc), m.precoDoDia(it, 20_407, esc, p)])
    for (const dia of [NaN, 1.5, -1, 0, 2 ** 31]) out.push(['diaruim', id, String(dia), m.precoDoDia(it, dia, 1, p)])
  }
  // categoria sem preço próprio e item inventado (a regra da categoria)
  for (const cat of ['Food', 'Drink', 'Fuel', 'Tools', 'Materials', 'Documents', 'Keys', 'Cosmetics', 'Nada', '__proto__']) {
    out.push(['cat', cat, m.precoDoDia({ id: 'x_' + cat, precoBase: 0, categoria: cat }, 20_407, 1, p)])
  }
  return out
}

function bateriaSave(ler: (save: unknown) => number) {
  const sec = (saldo: unknown, recebido: unknown = { dia: 20_400, total: 10 }, v: unknown = 1) => ({ v, saldo, recebido })
  const saves: unknown[] = [null, 'x', [], {}, { v: 1 }, { v: 2, economia: sec(5) }, { v: 1, economia: null }, { v: 1, economia: [] }]
  for (const s of HOSTIS) saves.push({ v: 1, economia: sec(s) })
  for (const r of [null, {}, { dia: 0, total: 0 }, { dia: 10_000_000, total: 480 }, { dia: 10_000_001, total: 0 }, { dia: -1, total: 0 }, { dia: 1.5, total: 0 }, { dia: 5, total: 481 }, { dia: 5, total: -1 }, { dia: '5', total: 0 }]) {
    saves.push({ v: 1, economia: sec(123, r) })
  }
  for (const v of [0, 2, '1', null, 1.0]) saves.push({ v: 1, economia: sec(77, undefined, v) })
  return saves.map((s) => [JSON.stringify(s ?? null), ler(s)])
}

const itensComoJogo = () => Object.fromEntries(Object.keys(ITENS_PRECO).map((k) => [k, { ...ITENS_PRECO[k] }]))

test('ECONOMIA (os números) é a do jogo', () => {
  assert.equal(sha(ECONOMIA), SOMA_JOGO.economia)
})

test('regras_saldo (receber, gastar, quem acumula, tetos) é a do jogo', () => {
  assert.equal(sha(bateriaSaldo(saldo, ECONOMIA)), SOMA_JOGO.saldo)
})

test('o preço do dia (regras_preco + hash32) é o do jogo, item a item, 400 dias', () => {
  assert.equal(sha(bateriaPreco(preco, ECONOMIA, itensComoJogo())), SOMA_JOGO.preco)
})

test('o catálogo de itens (id, categoria, preço base) é o do jogo', () => {
  assert.equal(sha(itensComoJogo()), SOMA_JOGO.itens)
})

test('a leitura do save para a migração é a validarSecao do jogo (lixo = 0)', () => {
  assert.equal(sha(bateriaSave(legacyBalanceFromSave)), SOMA_JOGO.save)
})

// ── ao vivo: com o repositório do jogo ao lado, as MESMAS baterias rodam nos módulos dele ─────────────────────────
const JOGO = process.env.DOGCITY_MUNDO_DIR ? resolve(process.env.DOGCITY_MUNDO_DIR) : resolve(process.cwd(), '..', 'dogcity-mundo')
const temJogo = existsSync(join(JOGO, 'src/economia/regras_saldo.ts'))

test('ao vivo: as baterias dão o mesmo nos módulos do jogo', { skip: temJogo ? false : `sem o jogo em ${JOGO} (DOGCITY_MUNDO_DIR)` }, async () => {
  const imp = (f: string) => import(pathToFileURL(join(JOGO, f)).href)
  const [jSaldo, jPreco, jAjustes, jItens, jPers] = await Promise.all([
    imp('src/economia/regras_saldo.ts'), imp('src/economia/regras_preco.ts'), imp('src/economia/ajustes_economia.ts'),
    imp('src/inventario/catalogo_itens.ts'), imp('src/economia/persistencia.ts'),
  ])
  const E = jAjustes.ECONOMIA
  const itensJogo = Object.fromEntries(Object.entries(jItens.ITENS as Record<string, { id: string; categoria: string; precoBase: number }>)
    .map(([k, d]) => [k, { id: d.id, categoria: d.categoria, precoBase: d.precoBase }]))
  const lerJogo = (save: unknown) => {
    // o envelope (salvo_jogo.ts) só entrega a seção de um envelope v 1; validarSecao valida a seção; lixo vira zero
    if (!save || typeof save !== 'object' || Array.isArray(save) || (save as any).v !== 1) return 0
    const e = jPers.validarSecao((save as any).economia)
    return e ? e.saldo + 0 : 0
  }
  assert.deepEqual(JSON.parse(JSON.stringify(E)), JSON.parse(JSON.stringify(ECONOMIA)))
  assert.deepEqual(itensJogo, itensComoJogo())
  assert.deepEqual(bateriaSaldo(jSaldo, E), bateriaSaldo(saldo, ECONOMIA))
  assert.deepEqual(bateriaPreco(jPreco, E, itensJogo), bateriaPreco(preco, ECONOMIA, itensComoJogo()))
  assert.deepEqual(bateriaSave(lerJogo), bateriaSave(legacyBalanceFromSave))
  // e as somas do jogo de hoje são as gravadas acima
  assert.deepEqual(
    { economia: sha(E), saldo: sha(bateriaSaldo(jSaldo, E)), preco: sha(bateriaPreco(jPreco, E, itensJogo)), itens: sha(itensJogo), save: sha(bateriaSave(lerJogo)) },
    SOMA_JOGO,
  )
  // o tutorial paga o mesmo que o servidor aceita
  const tut = await imp('src/tutorial/regras.ts')
  const { TUTORIAL_REWARD } = await import('./rules')
  assert.equal(tut.RECOMPENSA_PONTOS, TUTORIAL_REWARD)
})
