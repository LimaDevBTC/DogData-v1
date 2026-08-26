import { redirect } from 'next/navigation'

// O $DOG Galaxy mudou de casa pra /galaxy em 26/08. Esta rota fica de pe
// pra sempre porque ela circulou: links compartilhados, o cartao de
// /holders (trafego do CoinMarketCap) e deep links de analise
// (?view=ego&w=..., ?root=..., ?focus=...) apontavam pra ca.
//
// 307 e nao 308 de proposito, mesma licao do /city: permanente fica
// gravado no navegador e amarraria a rota pra sempre.
//
// ⚠️ A QUERY STRING PRECISA SOBREVIVER: um deep link de analise que perde
// o ?view=ego cai na vitrine e o usuario nao entende o que aconteceu.
export default async function TreeRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') qs.set(k, v)
    else if (Array.isArray(v) && v.length > 0) qs.set(k, v[0])
  }
  const cauda = qs.toString()
  redirect(cauda ? `/galaxy?${cauda}` : '/galaxy')
}
