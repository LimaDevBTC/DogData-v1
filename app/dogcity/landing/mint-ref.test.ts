import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { withMintRef } from './mint-ref'

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
