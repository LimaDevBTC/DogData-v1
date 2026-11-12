// Rodar: npx tsx --test app/dogcity/barco-da-licenca.test.ts
//
// O barco de cada licença (decisão do fundador, 12/11/2026): a linha do cartão vem logo depois da do rifle e diz SÓ o barco,
// sem data, sem "coming soon", sem travessão, sem comprimento e sem preço. A imagem existe, o crédito CC BY sai no cartão
// e as docs (seção 8) dizem o mesmo barco de cada nível, com o parágrafo do píer e da boia.
// 12/11 ("licença no lote"): o parágrafo do barco é a frase EXATA de LICENCA_NO_LOTE_CONTRATO.md (o píer é só para lote de canal;
// lote de praia ou de margem de lago ganha boia), e o rifle e o barco vêm da licença mais alta entre os lotes que a carteira guarda.
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { TIERS } from './dogcity-data'

const raiz = (rel: string) => new URL(`../../${rel}`, import.meta.url)

const ESPERADO: Record<string, { linha: string; nome: string }> = {
  personal: { linha: 'Boat: the DOG Runabout, a classic wooden speedboat, kept in the dry-stack boathouse at the public marina', nome: 'DOG RUNABOUT' },
  commercial: { linha: 'Boat: the DOG Cruiser, a sport cruiser with a cabin, with a berth at the public marina', nome: 'DOG CRUISER' },
  patron: { linha: 'Yacht: the DOG Yacht, a flybridge yacht, with a berth at the DOG Key marina', nome: 'DOG YACHT' },
}

test('cada cartão tem a linha exata do barco, logo depois do rifle', () => {
  for (const t of TIERS) {
    const e = ESPERADO[t.key]
    assert.ok(e, `nível inesperado ${t.key}`)
    const i = t.perks.indexOf(e.linha)
    assert.ok(i >= 0, `cartão ${t.key} sem "${e.linha}"`)
    assert.ok(t.perks[i - 1].startsWith('Hunting rifle: '), `${t.key}: o barco vem logo depois do rifle`)
    assert.equal(t.perks.filter((p) => /^(Boat|Yacht): /.test(p)).length, 1)
  }
})

test('a linha não tem data, "coming soon", travessão, comprimento nem preço', () => {
  for (const t of TIERS) {
    const textos = [...t.perks.filter((p) => /^(Boat|Yacht): /.test(p)), t.boat.alt, t.boat.label]
    for (const x of textos) {
      assert.doesNotMatch(x, /soon|coming|\d|—|–|\$DOG|sats|BTC|exclusive/i, `${t.key}: "${x}"`)
    }
  }
})

test('imagem, rótulo e crédito CC BY do barco em cada cartão', () => {
  for (const t of TIERS) {
    assert.equal(t.boat.label, ESPERADO[t.key].nome)
    assert.equal(t.boat.src, `/landing/licences/boat-${t.key}.webp`)
    assert.ok(existsSync(raiz(`public${t.boat.src}`)), `falta public${t.boat.src}`)
    assert.match(t.boat.credit.text, /^3D model: .+ by .+, CC BY 4\.0$/)
    assert.match(t.boat.credit.href, /^https:\/\/sketchfab\.com\/3d-models\/[a-z0-9-]+$/)
  }
})

test('as docs (seção 8) dizem o mesmo barco de cada nível e o parágrafo do píer e da boia', () => {
  const docs = readFileSync(raiz('app/dogcity/docs/page.tsx'), 'utf8')
  assert.match(docs, /the Field Rifle \(a hunting rifle\), the DOG Runabout \(a classic wooden speedboat, kept in the dry-stack boathouse at the public marina\), and early access/)
  assert.match(docs, /Boat: the DOG Cruiser, a sport cruiser with a cabin, with a berth at the public marina"\]/)
  assert.match(docs, /Yacht: the DOG Yacht, a flybridge yacht, with a berth at the DOG Key marina"\]/)
  const plano = docs.replace(/\s+/g, ' ')
  assert.ok(plano.includes('One boat per wallet: the one that comes with the highest licence among the lots the wallet holds. A lot on a canal gets its own pier, and the boat waits there. A lot on a beach or a lake shore gets a mooring buoy in front of the house.'))
  assert.ok(plano.includes('The hunting rifle and the boat come from the highest licence among the lots a wallet holds. Sell that lot and they go with it.'))
  assert.doesNotMatch(plano, /canal or a lake gets its own pier/)
})

test('as docs dizem que a licença pertence ao lote e vai com a escritura (seção 7, 6 e 8)', () => {
  const plano = readFileSync(raiz('app/dogcity/docs/page.tsx'), 'utf8').replace(/\s+/g, ' ').replace(/&apos;/g, "'")
  const frases = [
    'The building licence belongs to the lot. It is never sold on its own: when the deed changes hands, the licence, the house and the items that come with it (vehicles, hunting rifle, boat) go with it.',
    'A licence payment is credited to the wallet that pays and applied to the lot that wallet holds. A wallet that holds more than one lot chooses the lot. A credit with no lot waits for one.',
    'Moving up.</strong> The payments applied to a lot add up, so a lot with Personal pays only the difference to Commercial or Patron. Nobody buys two licences for the same lot.',
    "Founder status and the Original Airdrop Receiver badge belong to the wallet and never move. The Founder's light shines on the building of the lot the Founder holds.",
    'Licence items (the house, its vehicles, the hunting rifle, the boat) belong to the lot and move with the deed.',
  ]
  for (const f of frases) assert.ok(plano.includes(f), `as docs perderam: ${f}`)
  // a regra velha saiu
  for (const velha of ['stay with the wallet that earned them', 'The payments of the wallet that owns the lot', 'on the lot the wallet owns', 'lot whose owner holds the commercial licence']) {
    assert.ok(!plano.includes(velha), `as docs ainda dizem: ${velha}`)
  }
})
