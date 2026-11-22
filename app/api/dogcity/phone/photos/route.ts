// DOG PHONE: fotos da Câmera (contrato em lib/phone/http.ts e lib/phone/README.md; regras na migração 048).
import type { NextRequest } from 'next/server'
import { getPhotos, postPhotos } from '@/lib/phone/http'
import { armazemFotos, phoneDeps, portaHttp } from '@/lib/phone/deps'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 15

export function GET(req: NextRequest) {
  return getPhotos(req, portaHttp, phoneDeps)
}

export function POST(req: NextRequest) {
  return postPhotos(req, portaHttp, phoneDeps, armazemFotos)
}
