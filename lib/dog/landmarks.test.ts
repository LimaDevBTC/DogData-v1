import { test } from "node:test"
import assert from "node:assert/strict"
import { landmarksOf, JOGO_URL } from "./landmarks"

const A = "bc1p" + "q".repeat(58)
const B = "bc1p" + "z".repeat(58)
const catalogo = {
  entradas: [
    { id: "PIPS_HOUSE", nome: "PIPS HOUSE", carteiraDona: A, vista: { jogador: { x: 0, z: 62 } } },
    { id: "ESTADIO", nome: "SATOSHI'S GOAL ARENA", carteiraDona: B, vista: { jogador: { x: 0, z: 1 } } },
    { id: "SEM_VISTA", nome: "No view", carteiraDona: A },
    { id: "PRACA", nome: "Plaza" },
    { id: "bad id!", nome: "x", carteiraDona: A },
  ],
}

test("devolve só as peças da carteira, com o link da vista", () => {
  const r = landmarksOf(catalogo, A)
  assert.deepEqual(r.map((x) => x.id), ["PIPS_HOUSE", "SEM_VISTA"])
  assert.equal(r[0].name, "PIPS HOUSE")
  assert.equal(r[0].url, `${JOGO_URL}?view=pips_house`)
  assert.equal(r[1].url, JOGO_URL)
})

test("bech32 em maiúsculo casa com o catálogo em minúsculo", () => {
  assert.equal(landmarksOf(catalogo, A.toUpperCase()).length, 2)
})

test("catálogo estranho ou carteira sem peça: lista vazia", () => {
  assert.deepEqual(landmarksOf(null, A), [])
  assert.deepEqual(landmarksOf({ entradas: "x" }, A), [])
  assert.deepEqual(landmarksOf(catalogo, "bc1p" + "x".repeat(58)), [])
})
