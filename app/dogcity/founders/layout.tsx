import type { Metadata } from "next"

// Metadata desta rota. page.tsx é "use client" (usa <Layout> da casa, que puxa
// useRouter, e busca o fundo ao vivo num useEffect) e um Client Component não
// pode exportar `metadata`; este layout.tsx irmão, Server Component, é quem
// carrega isso para /dogcity/founders. Mesmo arranjo de /dogcity/docs.
//
// ⚠️ NENHUM NÚMERO VIVO AQUI. O valor do fundo e a contagem de Founders mudam
// todo dia; um card do X é a única parte da página que a pessoa lê sem abrir o
// site, e um número velho nele contradiz a própria página. Só entra o que não
// envelhece: a meta de 10.000.000 $DOG, que é fixa por definição.
//
// ⚠️ A imagem é obrigatória, senão todo link compartilhado sai como card sem
// imagem. O `?v=` existe porque X e Facebook guardam a chapa pela URL e não
// voltam a buscar quando o arquivo muda no mesmo caminho.
const OG = "https://www.dogdata.xyz/og-dogcity.jpg?v=3"

export const metadata: Metadata = {
  title: "DogCity Founders Pack | DOG DATA",
  description:
    "A Founder is anyone who contributes to the construction fund before it reaches 10,000,000 $DOG. There is no cap on the number of Founders. What closes is the time, never the seat.",
  openGraph: {
    title: "DogCity Founders Pack: what closes is the time, never the seat",
    description:
      "A goal, not a sale. A construction fund, not a raise. Every rung includes everything below it, the Founder number is assigned by order of arrival, and no lot is ever drawn.",
    type: "website",
    url: "https://www.dogdata.xyz/dogcity/founders",
    siteName: "DOG DATA",
    images: [
      {
        url: OG,
        width: 1200,
        height: 630,
        alt: "Inside the DogCity dome at Mare Tranquillitatis: the honeycomb shell overhead, the bay, the road web and Satoshi Plaza",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DogCity Founders Pack: what closes is the time, never the seat",
    description:
      "Contributions are counted per wallet and they add up. The Founder number is assigned by order of arrival. No lot is ever drawn.",
    images: [OG],
  },
}

export default function DogCityFoundersLayout({ children }: { children: React.ReactNode }) {
  return children
}
