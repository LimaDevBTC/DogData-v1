import type { Metadata } from "next"
import { OG_URL, OG_ALT, OG_IMAGE } from "@/lib/og"
import { ATLAS_PLATES, ATLAS_SHEETS } from "./atlas-data"

// page.tsx e "use client" (Layout da casa usa useRouter); a metadata mora aqui.
export const metadata: Metadata = {
  alternates: { canonical: "https://dogcity.space/atlas" },
  title: "DogCity Atlas | DOG DATA",
  description:
    `The DogCity Atlas: ${ATLAS_PLATES.length} plates of the city at Bitcoin block 966,670. City plan, relief, water, tiers, streets, landmarks and ${ATLAS_SHEETS.length} registry sheets that place every lot, with a pre-release specimen of the on-chain deed.`,
  openGraph: {
    title: "DogCity Atlas: every lot on a numbered sheet",
    description: `${ATLAS_PLATES.length} plates and ${ATLAS_SHEETS.length} registry sheets for the city fixed at Bitcoin block 966,670.`,
    type: "website",
    url: "https://dogcity.space/atlas",
    siteName: "DOG DATA",
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", title: "DogCity Atlas", images: [{ url: OG_URL, alt: OG_ALT }] },
}

export default function DogCityAtlasLayout({ children }: { children: React.ReactNode }) {
  return children
}
