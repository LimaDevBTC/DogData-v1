// Os fios de verdade da propriedade unida (só servidor): o banco (044), o mint, os totais de licença por lote (037)
// e o arquivo de vizinhos. As duas rotas (/api/dogcity/property e /api/dogcity/properties) usam o mesmo.
import { supabase } from '@/lib/supabase'
import { holderDoMint, lotLicenceStore } from './licence-lot-supabase'
import { vizinhancaDosLotes } from '@/lib/city/lot-vizinhos'
import { areasDosLotes } from '@/lib/city/lot-areas'
import { propertyStore } from './property-merge-supabase'
import type { PropertyDeps } from './property-merge-service'

const licencas = lotLicenceStore(supabase)

export const propertyDeps: PropertyDeps = {
  store: propertyStore(supabase),
  holder: (a) => holderDoMint(a),
  lotTotals: (lots) => licencas.lotTotals(lots),
  vizinho: () => vizinhancaDosLotes(),
  areas: () => areasDosLotes(),
  agoraMs: () => Date.now(),
}
