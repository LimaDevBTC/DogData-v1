import type { Metadata } from "next"
import { OG_URL, OG_ALT, OG_IMAGE } from "@/lib/og"

// page.tsx e "use client" (Layout da casa usa useRouter); a metadata mora aqui.
export const metadata: Metadata = {
  title: "DogCity Atlas | DOG DATA",
  description:
    "The DogCity Atlas: 46 plates of the city at Bitcoin block 966,670. City plan, relief, tiers, streets, water, landmarks and 27 registry sheets that place every lot.",
  openGraph: {
    title: "DogCity Atlas: every lot on a numbered sheet",
    description: "46 plates and 27 registry sheets for the city decided at Bitcoin block 966,670.",
    type: "website",
    url: "https://www.dogdata.xyz/dogcity/atlas",
    siteName: "DOG DATA",
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", title: "DogCity Atlas", images: [{ url: OG_URL, alt: OG_ALT }] },
}

export default function DogCityAtlasLayout({ children }: { children: React.ReactNode }) {
  return children
}
