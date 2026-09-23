'use client'

// ═══════════════════════════════════════════════════════════════════════════
// O PAINEL LATERAL: o que aparece quando o visitante clica num lote.
//
// ⚠️ NUNCA MOSTRA O ENDEREÇO DO DONO. O .bin derivado que este mapa lê
// (lotes-indice.bin) nem carrega endereço, de propósito: ver
// scripts/city/mapa/gerar-derivados.mjs. O parâmetro `?lot=` na URL leva só o
// lot_id, nunca a carteira; é o mesmo contrato de privacidade da escritura.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react'
import type { Registro } from './registro'
import { lotIdDe, idDoQuarteirao } from './registro'
import { CODIGO_SETOR, nomeDoSetor, TIPOLOGIA_DA_FORMA, fmtInt, fmtM, LARANJA } from './estilo'

export function Painel({ registro, i, aoFechar }: { registro: Registro; i: number; aoFechar: () => void }) {
  const [copiado, setCopiado] = useState(false)
  const lotId = lotIdDe(registro, i)
  const setor = registro.setor[i]
  const bairro = nomeDoSetor(setor)
  const forma = TIPOLOGIA_DA_FORMA[registro.forma[i]] ?? 'Plot'

  const copiar = () => {
    navigator.clipboard?.writeText(lotId).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    }).catch(() => {})
  }

  return (
    // ⚠️ bottom-28 (não h-full): os botões de zoom moram fixos em
    // bottom-right z-20 (mapa-client.tsx). Um aside de altura cheia cobre a
    // caixa deles por baixo (mesmo canto), e clique não atravessa: o
    // Playwright falhava com "aside intercepts pointer events" chegando por
    // ?lot= (achado da revisão). 112px de folga é mais que os ~92px que os
    // dois botões (36px cada + gap) ocupam a partir do fundo, em qualquer tela.
    <aside
      className="fixed right-0 top-0 bottom-28 z-30 flex w-[300px] max-w-[88vw] flex-col gap-4 overflow-y-auto border-l border-white/10 bg-[#0A0A0C] p-5 font-mono text-[13px] text-[#EDE6D6]"
      aria-label="Plot details"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">{CODIGO_SETOR(setor)} · {bairro}</p>
          <h2 className="mt-1 text-[17px] font-semibold tracking-tight text-white">{lotId}</h2>
        </div>
        <button
          onClick={aoFechar}
          aria-label="Close"
          className="rounded border border-white/15 px-2 py-1 text-[11px] text-white/60 hover:bg-white/10"
        >
          ×
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
        <dt className="text-white/45">Block</dt>
        <dd className="text-right">{idDoQuarteirao(registro, i)}</dd>
        <dt className="text-white/45">Area</dt>
        <dd className="text-right">{fmtInt(registro.area[i])} m²</dd>
        <dt className="text-white/45">Frontage × depth</dt>
        <dd className="text-right">{fmtM(registro.frente[i])} × {fmtM(registro.prof[i])} m</dd>
        <dt className="text-white/45">Shape</dt>
        <dd className="text-right">{forma}</dd>
        <dt className="text-white/45">Elevation</dt>
        <dd className="text-right">{fmtM(registro.cota[i])} m</dd>
      </dl>

      {registro.dsc[i] === 1 && (
        <span className="inline-flex w-fit items-center gap-1 rounded-full border border-[#7FD4E0]/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#7FD4E0]">
          DSC plot
        </span>
      )}

      {/* O endereço do dono FICA DE FORA por padrão: ver o aviso no topo do
          arquivo. Se um dia existir uma rota que confirme posse (ex.: a
          própria carteira logada pedindo o lote dela), ela entraria aqui como
          um bloco condicional, nunca lendo o CSV com endereço no cliente. */}

      <div className="mt-1 flex flex-col gap-2 border-t border-white/10 pt-3">
        <button
          onClick={copiar}
          className="rounded border border-white/15 px-3 py-2 text-left text-[11px] text-white/70 hover:bg-white/10"
        >
          {copiado ? 'Copied' : 'Copy plot ID'}
        </button>
        {/* ⚠️ "?view=deck" é placeholder (pedido explícito da tarefa). Quando
            o visualizador 3D aceitar um parâmetro de lote, troque por
            `/city?view=deck&lot=${encodeURIComponent(lotId)}` e ligue
            `apiRef.current?.flyTo(...)` lá dentro na chegada, não antes,
            porque hoje o 3D não tem esse gancho. */}
        <a
          href="/city?view=deck"
          className="rounded px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-black"
          style={{ backgroundColor: LARANJA }}
        >
          Open in 3D
        </a>
      </div>
    </aside>
  )
}
