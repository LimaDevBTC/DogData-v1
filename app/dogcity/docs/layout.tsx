import type { Metadata } from "next"

// Metadata desta rota. page.tsx é "use client" (usa <Layout> da casa, que
// puxa useRouter) e um Client Component não pode exportar `metadata`; este
// layout.tsx irmão, Server Component, é quem carrega isso para /dogcity/docs.
export const metadata: Metadata = {
  title: "DogCity Documentation | DOG DATA",
  description:
    "What DogCity is, how the snapshot was built and verified, how land is sized, how the project tells a person from a service, and what the Financial District is.",
}

export default function DogCityDocsLayout({ children }: { children: React.ReactNode }) {
  return children
}
