// DOG PHONE: pedidos, aceite, bloqueio, silêncio e denúncia (contrato em app/api/dogcity/phone/route.ts).
import type { NextRequest } from 'next/server'
import { postFriends } from '@/lib/phone/http'
import { phoneDeps, portaHttp } from '@/lib/phone/deps'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 10

export function POST(req: NextRequest) {
  return postFriends(req, portaHttp, phoneDeps)
}
