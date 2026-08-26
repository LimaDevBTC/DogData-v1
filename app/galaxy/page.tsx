import { redirect } from 'next/navigation'

// dogdata.xyz/galaxy: o endereco de divulgacao do $DOG Galaxy. A casa do
// produto continua em /holders/tree (links compartilhados e o trafego do
// CoinMarketCap nao podem quebrar); este alias so encaminha.
// 307 de proposito, nunca 308: permanente fica gravado no navegador e
// amarraria a rota pra sempre (mesma licao do /city).
export default function GalaxyAlias() {
  redirect('/holders/tree')
}
