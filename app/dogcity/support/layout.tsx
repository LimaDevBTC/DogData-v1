import type { Metadata } from "next"
import { OG_URL, OG_ALT } from "@/lib/og"

// Metadata desta rota. page.tsx é "use client" (usa <Layout> da casa), então
// este layout irmão, Server Component, carrega o metadata de /dogcity/support.
export const metadata: Metadata = {
  alternates: { canonical: "https://dogcity.space/support" },
  title: "Support | DogCity",
  description:
    "Official DogCity support: email support@dogcity.space, find your lot, read the docs, and stay safe from impersonators.",
  openGraph: {
    title: "DogCity Support",
    description: "Official support for DogCity: support@dogcity.space.",
    type: "website",
    url: "https://dogcity.space/support",
    siteName: "DOG DATA",
    images: [{ url: OG_URL, width: 1200, height: 630, alt: OG_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DogCity Support",
    description: "Official support for DogCity: support@dogcity.space.",
    images: [OG_URL],
  },
}

export default function DogCitySupportLayout({ children }: { children: React.ReactNode }) {
  return children
}
