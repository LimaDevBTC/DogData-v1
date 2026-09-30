// A pagina de /v1/indexer/address/{addr}/inscription-data da UniSat (modulo puro:
// testado em scripts/salas.test.mjs; quem chama a rede e' lib/ordinals/inscriptions.ts).

export interface InscricaoDaPagina {
  id: string
  number: number
  contentType: string | null
}

interface UnisatInscriptionRow {
  inscriptionId?: string
  inscriptionNumber?: number
  contentType?: string
  utxo?: { inscriptions?: Array<{ inscriptionId?: string; inscriptionNumber?: number }> }
}

/**
 * Uma pagina de /v1/indexer/address/{addr}/inscription-data, lida do jeito
 * certo (30/09/2026). A UniSat devolve UMA LINHA POR INSCRICAO (`inscription[]`,
 * `total` e o `cursor` contam linhas), e cada linha traz tambem `utxo.inscriptions`:
 * TODAS as inscricoes do mesmo UTXO.
 *
 * ⚠️ O BUG QUE ISTO CORRIGE. A leitura antiga ignorava o id da propria linha,
 * achatava `utxo.inscriptions` de cada linha e avancava o cursor pelo numero de
 * itens achatados. Num UTXO com k inscricoes, k linhas viravam k² itens: o
 * cursor saltava (k² - k) linhas por UTXO, pulava inscricoes da carteira e
 * batia no `total` antes do fim. Quem varria "ate' o fim" (a porta do lounge DOG
 * SOCIAL CLUB) concluia "sem posse" sem ter visto tudo: um falso negativo. E uma
 * linha com `utxo.inscriptions` vazio (a UniSat nem sempre preenche) sumia.
 *
 * Agora: o id vem da linha (os do UTXO so' completam, sem repetir), e `linhas`
 * diz quanto o cursor anda.
 */
export function lerPaginaUnisat(json: any): { items: InscricaoDaPagina[]; total: number; linhas: number } {
  const rows: UnisatInscriptionRow[] = json?.data?.inscription ?? []
  const vistos = new Set<string>()
  const items: InscricaoDaPagina[] = []
  const por = (id: string | undefined, numero: number | undefined, tipo: string | undefined): void => {
    if (!id || vistos.has(id)) return
    vistos.add(id)
    // ⚠️ contentType VEM VAZIO NA MAIORIA DAS LINHAS: quem decide se e' imagem e' o metadado do ordinals.com.
    items.push({ id, number: Number(numero ?? 0), contentType: tipo || null })
  }
  for (const row of rows) {
    por(row?.inscriptionId, row?.inscriptionNumber, row?.contentType)
    for (const ins of row?.utxo?.inscriptions ?? []) por(ins?.inscriptionId, ins?.inscriptionNumber, undefined)
  }
  return { items, total: Number(json?.data?.total ?? rows.length), linhas: rows.length }
}

