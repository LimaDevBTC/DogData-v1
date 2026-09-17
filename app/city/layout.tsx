import { RadiolaPlayer } from '@/components/radiola/radiola-player'

// O player do Radiola vive SÓ dentro do DOG CITY (/city e sub-rotas), não no
// dogdata inteiro. Montado aqui, aparece na cidade, na praça e na guerra.
export default function CityLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <RadiolaPlayer />
    </>
  )
}
