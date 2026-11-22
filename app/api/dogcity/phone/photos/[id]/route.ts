// DOG PHONE: o arquivo de uma foto da Câmera, só para a dona (lib/phone/http.ts).
import type { NextRequest } from 'next/server'
import { getPhoto } from '@/lib/phone/http'
import { armazemFotos, phoneDeps, portaHttp } from '@/lib/phone/deps'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 15

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return getPhoto(req, portaHttp, phoneDeps, armazemFotos, id)
}
