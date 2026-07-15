import type { Metadata } from 'next'
import LunarClientWrapper from './lunar-client-wrapper'

export const metadata: Metadata = {
  title: 'DogCity Luna — terrain preview',
  description: 'Phase 1 verification: DogCity zones mapped onto real lunar terrain (Mare Tranquillitatis, Shackleton, Peary).',
  robots: { index: false, follow: false },
}

export default function CityLunaPage() {
  return <LunarClientWrapper />
}
