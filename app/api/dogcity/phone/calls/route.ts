// DOG PHONE: calls (contrato em lib/phone/http.ts e lib/phone/README.md; regras na migração 047).
import type { NextRequest } from 'next/server'
import { getCalls, postCalls } from '@/lib/phone/http'
import { phoneDeps, portaHttp } from '@/lib/phone/deps'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 10

export function GET(req: NextRequest) {
  return getCalls(req, portaHttp, phoneDeps)
}

export function POST(req: NextRequest) {
  return postCalls(req, portaHttp, phoneDeps)
}
