import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { destinoDoLink, metaDoClique, ondeNaPagina, withMintRef, withOutboundRef, type ElementoMedido } from './mint-ref'

describe('withMintRef', () => {
  it('acrescenta ?ref=@handle ao link do mint', () => {
    assert.equal(withMintRef('https://mint.dogcity.space', 'alice'), 'https://mint.dogcity.space/?ref=@alice')
    assert.equal(withMintRef('https://mint.dogcity.space/', '@Alice'), 'https://mint.dogcity.space/?ref=@alice')
  })
  it('mantém caminho, consulta e âncora', () => {
    assert.equal(withMintRef('https://mint.dogcity.space/lot/S07-Q01-B001-L001', 'alice'), 'https://mint.dogcity.space/lot/S07-Q01-B001-L001?ref=@alice')
    assert.equal(withMintRef('https://mint.dogcity.space/?address=bc1abc', 'alice'), 'https://mint.dogcity.space/?address=bc1abc&ref=@alice')
    assert.equal(withMintRef('https://mint.dogcity.space/#x', 'alice'), 'https://mint.dogcity.space/?ref=@alice#x')
  })
  it('não mexe em outro host, em ref já presente, em href relativo nem sem handle válido', () => {
    assert.equal(withMintRef('https://dogcity.space/city', 'alice'), 'https://dogcity.space/city')
    assert.equal(withMintRef('https://evil.com/?u=mint.dogcity.space', 'alice'), 'https://evil.com/?u=mint.dogcity.space')
    assert.equal(withMintRef('https://mint.dogcity.space.evil.com/', 'alice'), 'https://mint.dogcity.space.evil.com/')
    assert.equal(withMintRef('https://mint.dogcity.space/?ref=S05-Q07-B0602-L018', 'alice'), 'https://mint.dogcity.space/?ref=S05-Q07-B0602-L018')
    assert.equal(withMintRef('#lookup', 'alice'), '#lookup')
    assert.equal(withMintRef('https://mint.dogcity.space', null), 'https://mint.dogcity.space')
    assert.equal(withMintRef('https://mint.dogcity.space', 'a b!'), 'https://mint.dogcity.space')
  })
})

describe('withOutboundRef / destinoDoLink: o jogo também leva o código', () => {
  it('acrescenta ?ref=@handle ao link do jogo, em qualquer caminho, sem perder consulta nem âncora', () => {
    assert.equal(withOutboundRef('https://play.dogcity.space', 'alice'), 'https://play.dogcity.space/?ref=@alice')
    assert.equal(withOutboundRef('https://play.dogcity.space/?lot=S05-Q07-B0602-L018', 'alice'), 'https://play.dogcity.space/?lot=S05-Q07-B0602-L018&ref=@alice')
    assert.equal(withOutboundRef('https://play.dogcity.space/?addr=bc1abc', '@Alice'), 'https://play.dogcity.space/?addr=bc1abc&ref=@alice')
    assert.equal(withOutboundRef('https://play.dogcity.space/city/#x', 'alice'), 'https://play.dogcity.space/city/?ref=@alice#x')
    assert.equal(withOutboundRef('https://mint.dogcity.space/lot/S07-Q01-B001-L001', 'alice'), 'https://mint.dogcity.space/lot/S07-Q01-B001-L001?ref=@alice')
  })
  it('o formato que o jogo lê: ?ref=@handle (o jogo também aceita %40 e o handle puro, mas o link sai com @)', () => {
    const u = new URL(withOutboundRef('https://play.dogcity.space', 'alice'))
    assert.equal(u.searchParams.get('ref'), '@alice')
  })
  it('não mexe em links próprios do site, em outro host, em http, em ref já presente nem sem handle válido', () => {
    for (const h of ['/dogcity/docs', '/dogcity/atlas', '/dogcity/ranking', '#lookup', 'https://dogcity.space/', 'https://www.dogdata.xyz/',
      'http://play.dogcity.space/', 'https://play.dogcity.space.evil.com/', 'https://evil.com/?u=play.dogcity.space', 'mailto:support@dogcity.space']) {
      assert.equal(withOutboundRef(h, 'alice'), h, h)
    }
    assert.equal(withOutboundRef('https://play.dogcity.space/?ref=bob', 'alice'), 'https://play.dogcity.space/?ref=bob')
    for (const bad of [null, undefined, '', 'a b!', '@handle', '@handle`', 'admin']) {
      assert.equal(withOutboundRef('https://play.dogcity.space', bad), 'https://play.dogcity.space', String(bad))
    }
  })
  it('withMintRef continua só do mint', () => {
    assert.equal(withMintRef('https://play.dogcity.space', 'alice'), 'https://play.dogcity.space')
  })
  it('destinoDoLink separa mint, jogo e o resto', () => {
    assert.equal(destinoDoLink('https://mint.dogcity.space'), 'mint')
    assert.equal(destinoDoLink('https://mint.dogcity.space/verify'), 'mint')
    assert.equal(destinoDoLink('https://play.dogcity.space/?ref=@a'), 'play')
    for (const h of ['/dogcity/docs', 'https://dogcity.space', 'https://x.com/dogcity', '', null, undefined, 'http://mint.dogcity.space']) {
      assert.equal(destinoDoLink(h as string), null, String(h))
    }
  })
})

// um elemento falso: `closest` responde pelos seletores que ele "tem" como ancestrais
function el(ancestors: Record<string, { id?: string }>, text = ''): ElementoMedido {
  return { textContent: text, closest: (sel) => (sel.split(',').map((x) => x.trim()).map((x) => ancestors[x]).find(Boolean) ?? null) }
}

describe('medição do clique de saída', () => {
  it('onde: gaveta, barra, rodapé, seção (id), herói e página', () => {
    assert.equal(ondeNaPagina(el({ '#dc-drawer': {}, nav: {} })), 'drawer')
    assert.equal(ondeNaPagina(el({ nav: {} })), 'nav')
    assert.equal(ondeNaPagina(el({ footer: {} })), 'footer')
    assert.equal(ondeNaPagina(el({ 'section[id]': { id: 'lookup' } })), 'lookup')
    assert.equal(ondeNaPagina(el({ '#build': { id: 'build' } })), 'hero')
    assert.equal(ondeNaPagina(el({})), 'page')
  })
  it('meta: onde, destino, rótulo e só um sim/não de ref; nunca o handle', () => {
    const m = metaDoClique(el({ nav: {} }, '  Play \n '), 'https://play.dogcity.space/?ref=@alice', true)
    assert.deepEqual(m, { where: 'nav', dest: 'play', label: 'Play', has_ref: true })
    assert.ok(!JSON.stringify(m).includes('alice'))
    assert.deepEqual(metaDoClique(el({ footer: {} }, 'mint.dogcity.space'), 'https://mint.dogcity.space', false), { where: 'footer', dest: 'mint', label: 'mint.dogcity.space', has_ref: false })
  })
  it('link que não leva ao mint nem ao jogo não gera evento; rótulo longo é cortado', () => {
    assert.equal(metaDoClique(el({}), '/dogcity/docs', true), null)
    assert.equal(metaDoClique(el({}), '#lookup', false), null)
    assert.equal(metaDoClique(el({}, 'x'.repeat(100)), 'https://play.dogcity.space', false)!.label.length, 40)
  })
})
