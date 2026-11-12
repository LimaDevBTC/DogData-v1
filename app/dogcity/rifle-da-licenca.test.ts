// Rodar: npx tsx --test app/dogcity/rifle-da-licenca.test.ts
//
// O rifle de caça de cada licença (decisão do fundador, 10/11/2026): a linha do cartão diz SÓ o rifle, sem data, sem
// "coming soon", sem travessão, sem preço e sem sugerir que só quem tem licença caça. A imagem existe, o crédito CC BY
// sai no cartão e as docs (seção 8) dizem o mesmo rifle de cada nível.
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { TIERS } from './dogcity-data'

const raiz = (rel: string) => new URL(`../../${rel}`, import.meta.url)

const ESPERADO: Record<string, { linha: string; nome: string }> = {
  personal: { linha: 'Hunting rifle: the Field Rifle', nome: 'FIELD RIFLE' },
  commercial: { linha: 'Hunting rifle: the Field Rifle Pro, with scope', nome: 'FIELD RIFLE PRO' },
  patron: { linha: 'Hunting rifle: the Field Rifle Elite, engraved with your @', nome: 'FIELD RIFLE ELITE' },
}

test('cada cartão tem a linha exata do rifle, logo depois dos veículos', () => {
  for (const t of TIERS) {
    const e = ESPERADO[t.key]
    assert.ok(e, `nível inesperado ${t.key}`)
    const i = t.perks.indexOf(e.linha)
    assert.ok(i >= 0, `cartão ${t.key} sem "${e.linha}"`)
    assert.ok(t.perks[i - 1].startsWith('Vehicles: '), `${t.key}: o rifle vem logo depois dos veículos`)
    assert.equal(t.perks.filter((p) => p.startsWith('Hunting rifle: ')).length, 1)
  }
})

test('a linha não tem data, "coming soon", travessão, preço nem exclusividade da caça', () => {
  for (const t of TIERS) {
    const textos = [...t.perks.filter((p) => p.startsWith('Hunting rifle: ')), t.rifle.alt, t.rifle.label]
    for (const x of textos) {
      assert.doesNotMatch(x, /soon|coming|\d{4}|—|–|\$DOG|sats|BTC|only|unlock|exclusive/i, `${t.key}: "${x}"`)
    }
  }
})

test('imagem, rótulo e crédito CC BY do rifle em cada cartão', () => {
  for (const t of TIERS) {
    assert.equal(t.rifle.label, ESPERADO[t.key].nome)
    assert.equal(t.rifle.src, `/landing/licences/rifle-${t.key}.webp`)
    assert.ok(existsSync(raiz(`public${t.rifle.src}`)), `falta public${t.rifle.src}`)
    assert.match(t.rifle.credit.text, /^3D model: .+ by .+, CC BY 4\.0$/)
    assert.match(t.rifle.credit.href, /^https:\/\/sketchfab\.com\/3d-models\/[a-z0-9-]+$/)
  }
})

test('as docs (seção 8) dizem o mesmo rifle de cada nível', () => {
  const docs = readFileSync(raiz('app/dogcity/docs/page.tsx'), 'utf8')
  assert.match(docs, /the \$DOG moto, the Field Rifle \(a hunting rifle\), the DOG Runabout/)
  assert.match(docs, /Hunting rifle: the Field Rifle Pro, with scope\. Boat: /)
  assert.match(docs, /Hunting rifle: the Field Rifle Elite, engraved with its owner's @\. Yacht: /)
})
