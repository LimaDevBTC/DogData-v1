'use client'

// ═══════════════════════════════════════════════════════════════════════════
// O MAPA NAVEGÁVEL: /city/mapa. Canvas 2D puro (sem r3f), pan/zoom por mouse e
// toque, três níveis de detalhe, clique abre a escritura resumida do lote.
//
// ⚠️ TUDO QUE O HOLDER LÊ AQUI É EM INGLÊS: o comentário é em português
// (regra da casa), a tela nunca é.
//
// ⚠️ CARREGA SÓ O REGISTRO SELADO + DERIVADOS. Nenhum arquivo aqui contém
// endereço de carteira (ver o aviso em painel.tsx e em
// scripts/city/mapa/gerar-derivados.mjs). Se algum dia isso mudar, é uma
// decisão de privacidade nova, não um acidente de import.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from 'react'
import { carregarRegistro, loteEm, parseLotId, indiceDoLotId, lotIdDe, type Registro } from './registro'
import { carregarMalha, carregarSelo, carregarAgua, type Malha, type Selo, type Agua } from './malha'
import { ligarCamera, nivelDe, type Camera } from './camera'
import { redesenhar } from './desenho'
import { Painel } from './painel'
import { Legenda } from './legenda'
import { linkDoMapa } from './estilo'

const ESCALA_MAX = 6

type Estado = 'carregando' | 'pronto' | 'erro'

export default function MapaClient() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dadosRef = useRef<{ registro: Registro; malha: Malha; selo: Selo; agua: Agua; fundoImg: HTMLImageElement | null } | null>(null)
  const controleRef = useRef<ReturnType<typeof ligarCamera> | null>(null)
  const tamanhoRef = useRef({ cw: 0, ch: 0, dpr: 1 })

  const [estado, setEstado] = useState<Estado>('carregando')
  const [erro, setErro] = useState('')
  const [selecionado, setSelecionado] = useState(-1)
  const [selo, setSelo] = useState<Selo | null>(null)

  const redesenharAgora = useCallback(() => {
    const canvas = canvasRef.current
    const dados = dadosRef.current
    const controle = controleRef.current
    if (!canvas || !dados || !controle) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { cw, ch } = tamanhoRef.current
    const cam: Camera = controle.cam
    redesenhar({
      ctx, cw, ch, cam,
      nivel: nivelDe(cam.escala),
      malha: dados.malha,
      agua: dados.agua,
      registro: dados.registro,
      selo: dados.selo,
      fundoImg: dados.fundoImg,
      selecionado,
    })
  }, [selecionado])

  const aoRedimensionar = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const cw = container.clientWidth
    const ch = container.clientHeight
    tamanhoRef.current = { cw, ch, dpr }
    canvas.width = Math.round(cw * dpr)
    canvas.height = Math.round(ch * dpr)
    canvas.style.width = `${cw}px`
    canvas.style.height = `${ch}px`
    const ctx = canvas.getContext('2d')
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
    redesenharAgora()
  }, [redesenharAgora])

  // ── carga inicial: registro + malha + selo + água + a imagem de fundo ────
  useEffect(() => {
    let vivo = true
    Promise.all([
      carregarRegistro(),
      carregarMalha(),
      carregarSelo(),
      carregarAgua(),
      new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => resolve(null) // sem fundo não é fatal: o mapa ainda funciona sobre fundo escuro liso
        img.src = '/city/mapa/fundo.webp'
      }),
    ]).then(([registro, malha, seloCarregado, agua, fundoImg]) => {
      if (!vivo) return
      dadosRef.current = { registro, malha, selo: seloCarregado, agua, fundoImg }
      setSelo(seloCarregado)
      setEstado('pronto')
    }).catch((e) => {
      if (!vivo) return
      console.error('mapa: falha ao carregar', e)
      setErro(e instanceof Error ? e.message : String(e))
      setEstado('erro')
    })
    return () => { vivo = false }
  }, [])

  // ── câmera + canvas: só depois que os dados chegaram ─────────────────────
  useEffect(() => {
    if (estado !== 'pronto') return
    const canvas = canvasRef.current
    const dados = dadosRef.current
    if (!canvas || !dados) return

    const raioSitio = dados.malha.raioCasca + 600
    const escalaMinPelaTela = () => {
      const { cw, ch } = tamanhoRef.current
      return Math.max(0.008, Math.min(cw, ch) / (2 * raioSitio) * 0.94)
    }

    const controle = ligarCamera(canvas, { x: 0, z: 0, escala: 0.02 }, {
      escalaMin: 0.008,
      escalaMax: ESCALA_MAX,
      limiteXZ: raioSitio,
      aoMudar: redesenharAgora,
      aoClicar: (wx, wz) => {
        const idx = loteEm(dados.registro, wx, wz)
        setSelecionado(idx)
        if (idx >= 0) {
          window.history.replaceState(null, '', linkDoMapa(lotIdDe(dados.registro, idx)))
        } else {
          window.history.replaceState(null, '', '/city/mapa')
        }
      },
    })
    controleRef.current = controle

    // ?lot=S03-Q12-B004-L017 vindo da escritura: centraliza perto, com o
    // painel já aberto. Um id que não bate com nenhum lote é ignorado: o
    // mapa abre na visão padrão em vez de travar numa tela em branco.
    //
    // ⚠️ DESLOCA O ALVO PARA A ESQUERDA (achado da revisão): o painel (right-0,
    // w-[300px] max-w-[88vw]) chega já aberto e cobre a metade direita da
    // tela. Sem o deslocamento, centralizar no meio da TELA CHEIA (como
    // aoClicar faz) põe o lote embaixo do painel; no celular (88vw de painel)
    // ele desaparecia por completo, provado pela revisão em rev-mobile-s07.png.
    // Metade da largura do painel é o suficiente para o lote cair no meio da
    // faixa que sobra visível à esquerda, em qualquer largura de tela.
    const params = new URLSearchParams(window.location.search)
    const lotParam = params.get('lot')
    let centralizouEmLote = false
    if (lotParam) {
      const p = parseLotId(lotParam)
      if (p) {
        const idx = indiceDoLotId(dados.registro, lotParam)
        if (idx >= 0) {
          const larguraPainel = Math.min(300, window.innerWidth * 0.88)
          controle.irPara(dados.registro.x[idx], dados.registro.z[idx], 1.4, larguraPainel / 2)
          setSelecionado(idx)
          centralizouEmLote = true
        }
      }
    }

    const ro = new ResizeObserver(aoRedimensionar)
    ro.observe(canvas.parentElement ?? canvas)
    aoRedimensionar()
    if (!centralizouEmLote) controle.irPara(0, 0, escalaMinPelaTela())

    return () => {
      ro.disconnect()
      controle.destruir()
      controleRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado])

  // qualquer troca de selecionado precisa redesenhar (para o realce laranja)
  useEffect(() => { redesenharAgora() }, [selecionado, redesenharAgora])

  const zoomBotao = (fator: number) => controleRef.current?.zoomBotao(fator)

  if (estado === 'erro') {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-[#0A0A0C] px-6 text-center font-mono text-white/70">
        <p className="text-sm">Could not load the city map.</p>
        <p className="max-w-md text-[11px] text-white/40">{erro}</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative h-screen w-full touch-none overflow-hidden bg-[#0A0A0C]">
      <canvas ref={canvasRef} className="block h-full w-full" />

      {estado === 'carregando' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0A0A0C]">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/50">Loading city map</p>
        </div>
      )}

      {estado === 'pronto' && (
        <>
          <a
            href="/city"
            className="fixed left-2 top-2 z-20 rounded border border-white/15 bg-[#0A0A0C] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-white/70 hover:bg-white/10 sm:left-4 sm:top-4"
          >
            ← DogCity
          </a>

          <div className="fixed bottom-2 right-2 z-20 flex flex-col gap-1 sm:bottom-4 sm:right-4">
            <button onClick={() => zoomBotao(1.6)} aria-label="Zoom in" className="h-9 w-9 rounded border border-white/15 bg-[#0A0A0C] font-mono text-lg text-white/80 hover:bg-white/10">+</button>
            <button onClick={() => zoomBotao(1 / 1.6)} aria-label="Zoom out" className="h-9 w-9 rounded border border-white/15 bg-[#0A0A0C] font-mono text-lg text-white/80 hover:bg-white/10">−</button>
          </div>

          {/* ⚠️ NUNCA REDERIVA EM SILÊNCIO (ver a doutrina em malha.ts): se
             `public/city/mapa/vias.json` faltou, o mapa continua de pé (lote,
             quarteirão e programa não dependem de via) e diz assim, no canto,
             em vez de inventar uma malha própria de novo. */}
          {dadosRef.current?.malha.vias === null && (
            <div className="pointer-events-none fixed bottom-2 left-2 z-20 rounded border border-white/15 bg-[#0A0A0C]/90 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.15em] text-white/50 sm:bottom-4 sm:left-4">
              Road network unavailable
            </div>
          )}

          <Legenda selo={selo} />

          {selecionado >= 0 && dadosRef.current && (
            <Painel
              registro={dadosRef.current.registro}
              i={selecionado}
              aoFechar={() => { setSelecionado(-1); window.history.replaceState(null, '', '/city/mapa') }}
            />
          )}
        </>
      )}
    </div>
  )
}
