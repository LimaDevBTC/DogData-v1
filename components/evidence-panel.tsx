"use client"

import { AlertTriangle, ShieldCheck } from 'lucide-react'
import { EVIDENCE, KINDS, type Evidence, type WalletKind } from '@/lib/dog/taxonomy'
import type { Identity } from '@/components/entity-tag'

/**
 * Por que a gente afirma o que afirma sobre esta carteira.
 *
 * ⚠️ É ISTO QUE NOS SEPARA DE QUEM VENDE RÓTULO. A Arkham escreve "Kraken" ao
 * lado de um endereço e ninguém pode conferir: a conclusão vem sem a conta. A
 * gente já grava o grau da prova e a justificativa em cada linha de `dog_labels`;
 * faltava mostrar. Rótulo auditável é a diferença entre uma fonte e um palpite
 * com tipografia bonita.
 *
 * ⚠️ E ELE DIZ TAMBÉM O QUE A PROVA *NÃO* ALCANÇA. Desenho de fluxo prova função
 * e nunca identidade: quem lê tem direito de saber que "Marketplace" é uma
 * conclusão sobre o COMPORTAMENTO, e que a gente não sabe de quem a carteira é.
 * Omitir esse limite seria deixar o leitor completar a frase sozinho, e ele
 * completa para o lado errado.
 */
export function EvidencePanel({ entity }: { entity: Identity }) {
  const prova = EVIDENCE[(entity.evidence || '') as Evidence]
  const classe = KINDS[(entity.kind || '') as WalletKind]
  const verificado = entity.source === 'verified'
  const soFuncao = prova?.proves === 'what'

  // sem prova nem classe não há o que auditar, e um painel vazio é ruído
  if (!prova && !classe && !verificado) return null

  return (
    <div className="border border-white/[0.06] bg-black/30 p-3">
      <div className="flex items-center gap-2 border-b border-white/[0.05] pb-2">
        {verificado
          ? <ShieldCheck className="h-3 w-3 flex-shrink-0 text-lava" aria-hidden />
          : <AlertTriangle className="h-3 w-3 flex-shrink-0 text-dusty/40" aria-hidden />}
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-dusty/60">
          Why we say this
        </span>
      </div>

      <dl className="mt-2.5 space-y-2 text-[11px] leading-relaxed">
        {classe && (
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-dusty/40">Class</dt>
            <dd className="text-snow/75">
              <span className="text-snow/90">{classe.label}</span> · {classe.definition}
            </dd>
          </div>
        )}

        <div>
          <dt className="font-mono text-[10px] uppercase tracking-wider text-dusty/40">Evidence</dt>
          <dd className="text-snow/75">
            {verificado
              ? 'The owner claimed this address and paid the verification fee.'
              : prova
                ? <><span className="text-snow/90">{prova.label}</span> · {prova.detail}</>
                : 'on-chain analysis'}
          </dd>
        </div>

        {entity.evidence_note && (
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-dusty/40">The numbers</dt>
            <dd className="font-mono text-[10.5px] text-dusty/70">{entity.evidence_note}</dd>
          </div>
        )}

        {/* ⚠️ O LIMITE DA PROVA, dito na cara. */}
        {soFuncao && (
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-dusty/40">What we do not know</dt>
            <dd className="text-dusty/60">
              Who owns this wallet. Flow patterns prove what an address does, never whose it is,
              so we name the behaviour and stop there.
            </dd>
          </div>
        )}
      </dl>
    </div>
  )
}
