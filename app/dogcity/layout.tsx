import type { Metadata } from 'next'

// The landing itself is a client component, so it cannot export metadata.
// This layout carries it.
//
// Without this the official entry page inherited the explorer's title —
// "DOG DATA — Real-time DOG•GO•TO•THE•MOON Rune Data API & Explorer" — which is
// what every share card and browser tab showed. The copy below is taken
// verbatim from the page's own hero and from LOT_SEGMENTATION in
// dogcity-data.ts, so nothing here claims anything the page does not.
// ⚠️ OS NÚMEROS AQUI SÃO MEDIDOS, NÃO ARREDONDADOS DE MEMÓRIA. A versão anterior
// dizia "97.673 lotes" e a cidade publicada tem 85.843 — o número vinha de uma
// contagem antiga que somava BTC, SOL e STX, e a cidade de hoje é só BTC. Sempre
// conferir contra `public/city/cidade.json` antes de mexer nesta cópia:
//   carteiras 85.843 · área de lote 30,36 km² · lote mediano 238 m²
//
// ⚠️ E A IMAGEM É OBRIGATÓRIA. Não havia `images` aqui, então todo link
// compartilhado do /dogcity aparecia como card sem imagem — o pior formato
// possível para um anúncio.
// ⚠️ O `?v=` existe porque X e Facebook guardam a chapa pela URL e não
// voltam a buscar quando o arquivo muda no mesmo caminho. Ao trocar o JPG,
// incremente o número, senão o post sai com a imagem antiga.
const OG = 'https://www.dogdata.xyz/og-dogcity.jpg?v=3'

export const metadata: Metadata = {
  title: 'DogCity: a virtual city for DOG holders, on real lunar terrain | dogdata.xyz',
  description:
    'DogCity is a virtual city for DOG holders, built over real mapped lunar terrain. Every self-custody DOG wallet already has a plot: 85,843 of them, placed by DOG history and connected to Bitcoin.',
  openGraph: {
    title: 'DogCity: every DOG wallet already has a plot on the Moon',
    description:
      'Built over mapped lunar elevation at Mare Tranquillitatis. 85,843 wallets, 30.36 km² of plots under a single dome. Balance snapshot Sunday, September 6, 12 PM ET.',
    type: 'website',
    url: 'https://www.dogdata.xyz/dogcity',
    siteName: 'DOG DATA',
    images: [{ url: OG, width: 1200, height: 630,
               alt: 'Inside the DogCity dome at Mare Tranquillitatis: the honeycomb shell overhead, the bay, the road web and Satoshi Plaza' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DogCity: every DOG wallet already has a plot on the Moon',
    description:
      '85,843 wallets mapped over real lunar terrain. Balance snapshot Sunday, September 6, 12 PM ET.',
    images: [OG],
  },
}

// ⚠️ ESTE SCRIPT CORRE ANTES DA HIDRATAÇÃO, E É POR ISSO QUE ELE EXISTE.
//
// A página já tinha um `history.scrollRestoration = "manual"` dentro de um
// `useEffect` em page.tsx. O problema é QUANDO: efeito roda depois da
// hidratação, e num celular a restauração do navegador acontece ANTES disso, na
// carga. Quem chega primeiro ganha, e não éramos nós. Fundador, 31/08: "a
// landing está carregando com a hero já com um pouco de scroll, ao menos em
// mobile; quero ela carregando no topo, mostrando o header".
//
// ⚠️ E O DOCUMENTO TEM 18.694 PX. Restaurar "um pouco" aqui é cair vários
// milhares de pixels adentro, passando do herói inteiro. Numa landing isso não
// é uma inconveniência, é o visitante nunca ver a primeira frase.
//
// O `#âncora` explícito continua valendo: chegar em /dogcity#build é pedido, não
// posição restaurada. Por isso a guarda de hash aqui e no efeito.
const TOPO_ANTES_DA_HIDRATACAO = `
try {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) {
    window.scrollTo(0, 0);
    // a carga ainda vai mexer no layout (fontes, imagens, o scrub do herói):
    // reafirma no 'load' e um quadro depois dele, que é quando a altura para
    // de mudar. Sem isto, um deslocamento tardio desfaz o reset silenciosamente.
    addEventListener('load', function () {
      if (location.hash) return;
      window.scrollTo(0, 0);
      requestAnimationFrame(function () { if (!location.hash) window.scrollTo(0, 0); });
    }, { once: true });
  }
} catch (e) { /* navegador que proíbe: o efeito em page.tsx ainda tenta */ }
`

export default function DogCityLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: TOPO_ANTES_DA_HIDRATACAO }} />
      {children}
    </>
  )
}
