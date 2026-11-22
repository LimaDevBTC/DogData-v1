// DOG PHONE: wall (contrato em lib/phone/http.ts e lib/phone/README.md; regras na migração 047).
import type { NextRequest } from 'next/server'
import { getWall, postWall } from '@/lib/phone/http'
import { phoneDeps, portaHttp } from '@/lib/phone/deps'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 10

export function GET(req: NextRequest) {
  return getWall(req, portaHttp, phoneDeps)
}

export function POST(req: NextRequest) {
  return postWall(req, portaHttp, phoneDeps)
}
