'use client'

import { Layout } from '@/components/layout'
import CityComingSoon from './city-coming-soon'

export function CityPageClient() {
  return (
    <Layout currentPage="city" setCurrentPage={() => {}} fullBleed>
      <CityComingSoon />
    </Layout>
  )
}
