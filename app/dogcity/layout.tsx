import type { Metadata } from 'next'

// The landing itself is a client component, so it cannot export metadata.
// This layout carries it.
//
// Without this the official entry page inherited the explorer's title —
// "DOG DATA — Real-time DOG•GO•TO•THE•MOON Rune Data API & Explorer" — which is
// what every share card and browser tab showed. The copy below is taken
// verbatim from the page's own hero and from LOT_SEGMENTATION in
// dogcity-data.ts, so nothing here claims anything the page does not.
// ⚠️ NENHUMA CONTAGEM E NENHUMA DATA NESTE ARQUIVO.
// Esta cópia dizia "85.843 wallets, 30.36 km² of plots" e, pior, "Balance
// snapshot Sunday, September 6, 12 PM ET". As duas coisas ficaram falsas em
// 04/09: o snapshot passou a ser a ALTURA 966.670, e quantos lotes existem só
// é sabido depois dela. Um card do X é a única parte da página que a pessoa lê
// sem abrir o site, então uma data velha aqui contradiz o anúncio no mesmo
// feed onde o anúncio foi publicado. Só entra aqui o que não depende do
// snapshot: o terreno e a altura alvo.
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
    "DogCity is a virtual city for DOG holders, built over real mapped lunar terrain. Bitcoin block 966,670 decides the address of every self-custody DOG wallet. No claim, no signature, nothing to register.",
  openGraph: {
    title: 'DogCity: block 966,670 decides your address on the Moon',
    description:
      "Built over mapped lunar elevation at Mare Tranquillitatis. Whatever $DOG your wallet holds in self custody at that block is what the city reads. A date is our word. A Bitcoin block is Bitcoin's word.",
    type: 'website',
    url: 'https://www.dogdata.xyz/dogcity',
    siteName: 'DOG DATA',
    images: [{ url: OG, width: 1200, height: 630,
               alt: 'Inside the DogCity dome at Mare Tranquillitatis: the honeycomb shell overhead, the bay, the road web and Satoshi Plaza' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DogCity: block 966,670 decides your address on the Moon',
    description:
      "Hold $DOG in self custody before block 966,670. No claim, no signature, nothing to register.",
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
//
// ⚠️ #snapshot É EXCEÇÃO, E A EXCEÇÃO É O CAMINHO MAIS IMPORTANTE DA PÁGINA.
// O anúncio de 04/09 publicou /dogcity#snapshot para uma audiência inteira, e
// desde então a seção do snapshot É a hero: ela abre a página, logo abaixo da
// faixa da mempool. Pedir "#snapshot" é pedir o topo.
//
// Deixar o salto de âncora nativo cuidar disso NÃO funciona, e foi medido em
// 04/09 num viewport de 1440x900: o navegador salta para a posição da seção no
// layout PARCIAL, e o que vem acima dela (o header, o banner de parceiro, a
// faixa da mempool) ainda muda de altura depois. O resultado foi parar 537 px
// ADIANTE do alvo, com o instrumento de blocos inteiro fora da tela. Quem
// chegasse pelo link do anúncio veria a página começando no meio de outra
// seção, e a única leitura possível disso é que o link está quebrado.
//
// Tratando #snapshot como topo, o mesmo reafirmar do 'load' que já existe
// protege o caminho do anúncio, que é o que precisa de proteção.
const TOPO_ANTES_DA_HIDRATACAO = `
try {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  var noTopo = function () { return !location.hash || location.hash === '#snapshot'; };
  if (noTopo()) {
    window.scrollTo(0, 0);
    // a carga ainda vai mexer no layout (fontes, imagens, o scrub do herói):
    // reafirma no 'load' e um quadro depois dele, que é quando a altura para
    // de mudar. Sem isto, um deslocamento tardio desfaz o reset silenciosamente.
    addEventListener('load', function () {
      if (!noTopo()) return;
      window.scrollTo(0, 0);
      requestAnimationFrame(function () { if (noTopo()) window.scrollTo(0, 0); });
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
