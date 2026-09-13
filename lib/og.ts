/**
 * O ÚNICO OpenGraph do DogData.
 *
 * ⚠️ DECISÃO DO FUNDADOR, 13/09/2026: **todas as páginas servem o mesmo card**. Antes
 * existiam QUATRO imagens diferentes (`/DOGDATAOG.png`, `galaxy-og.jpg`, `og-plaza.jpg`,
 * `war-og.png`) e ainda DUAS versões da mesma (`og-dogcity.jpg?v=3` e `?v=5`), e o card
 * que o X mostrava dependia de qual página o link apontava.
 *
 * ⚠️ PARA TROCAR A IMAGEM: mude o arquivo em `public/` e suba o `?v=` daqui. Isso resolve
 * navegador e CDN.
 *
 * ⚠️ MAS NÃO RESOLVE O X, e essa distinção já custou um post: **o X guarda o card pela URL
 * da PÁGINA, não pela URL da imagem**. Subir o `?v=` da imagem não limpa nada do lado
 * deles. Para forçar card novo, poste a página com um parâmetro na ponta
 * (`/dogcity?s=1`): o X trata como URL nova e busca na hora. O parâmetro é ignorado pela
 * página. Card de post já publicado fica congelado, só apagando e repostando.
 * ⚠️ E o Card Validator do X NÃO EXISTE MAIS, foi aposentado. Não procure por ele.
 *
 * ⚠️ E NÃO VOLTE A DEFINIR `images` solto numa página. Importe daqui.
 */
export const OG_URL = 'https://www.dogdata.xyz/og-dogcity.jpg?v=5'

export const OG_ALT =
  'DogCity city plan on real lunar terrain at Mare Tranquillitatis, showing the bay, ' +
  'the spit and the street grid, as decided at Bitcoin block 966,670'

export const OG_IMAGE = { url: OG_URL, width: 1200, height: 630, alt: OG_ALT }
