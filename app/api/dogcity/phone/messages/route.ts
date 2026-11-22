// DOG PHONE: histórico, envio e leitura de uma conversa (contrato em app/api/dogcity/phone/route.ts).
import type { NextRequest } from 'next/server'
import { getMessages, postMessages } from '@/lib/phone/http'
import { phoneDeps, portaHttp } from '@/lib/phone/deps'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 10

export function GET(req: NextRequest) {
  return getMessages(req, portaHttp, phoneDeps)
}

export function POST(req: NextRequest) {
  return postMessages(req, portaHttp, phoneDeps)
}
