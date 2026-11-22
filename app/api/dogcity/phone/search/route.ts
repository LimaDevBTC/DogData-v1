// DOG PHONE: busca de um jogador pelo @handle exato (contrato em app/api/dogcity/phone/route.ts).
import type { NextRequest } from 'next/server'
import { getSearch } from '@/lib/phone/http'
import { phoneDeps, portaHttp } from '@/lib/phone/deps'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 10

export function GET(req: NextRequest) {
  return getSearch(req, portaHttp, phoneDeps)
}
