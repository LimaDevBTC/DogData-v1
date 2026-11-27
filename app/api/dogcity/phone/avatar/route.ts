// DOG PHONE: a foto de perfil do Social City (contrato em lib/phone/http.ts postAvatar; regras na migração 049).
import type { NextRequest } from 'next/server'
import { postAvatar } from '@/lib/phone/http'
import { armazemFotos, phoneDeps, portaHttp } from '@/lib/phone/deps'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 15

export function POST(req: NextRequest) {
  return postAvatar(req, portaHttp, phoneDeps, armazemFotos)
}
