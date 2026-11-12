// ═══════════════════════════════════════════════════════════════════════════
// A RESERVA DO LOTE PELO REGISTRO SELADO (licença no lote, 12/11/2026).
//
// Quando o mint não responde quem guarda o quê, o standing e a cotação sem lote mostram o lote do snapshot
// 966.670 da carteira (o mesmo papel do `lote:<endereço>` gravado na casa do jogo). Só para EXIBIR e para o
// pedido antigo de cotação: a aplicação automática nunca usa a reserva (lib/dog/licence-lot-service.ts).
//
// Arquivo à parte de licence-lot-supabase.ts de propósito: lib/city/escrituras.ts lê public/city/escrituras.bin
// (3 MB) e o rastreio de arquivos do Next o põe no pacote de toda função que importa o leitor. Só o standing
// e a cotação importam este módulo; o placar, a varredura e /lot-licence não.
// ═══════════════════════════════════════════════════════════════════════════
import { buscarEscritura, escrituras } from '@/lib/city/escrituras'
import { normalizeLotId } from './licence-lot'

/**
 * O lote do snapshot de um endereço. null = o endereço não tem lote no registro (ou tem lápide);
 * undefined = o registro não está ao alcance agora.
 */
export function snapshotDoRegistro(origin: string | null): (address: string) => Promise<string | null | undefined> {
  return async (address) => {
    const ix = await escrituras(origin).catch(() => null)
    if (!ix) return undefined
    const e = buscarEscritura(ix, address)
    return e?.kind === 'lote' ? normalizeLotId(e.lotId) : null
  }
}
