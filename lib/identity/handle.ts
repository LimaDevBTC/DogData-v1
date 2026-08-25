// Validacao de handle do DogCity, modulo puro sem I/O.
// Compartilhado entre app/api/profile (cria o handle) e app/api/chat (confere
// no POST que o autor ja tem um). Contrato: regex ^[a-z0-9_]{3,15}$, lista de
// reservados, normalizacao trim+lowercase. O mesmo regex esta gravado como
// CHECK na tabela dogcity_profiles (migration 018), isto aqui e a validacao
// que roda antes de chegar no banco.

const HANDLE_REGEX = /^[a-z0-9_]{3,15}$/

// Nomes que nenhuma carteira pode reivindicar: identidade do projeto, papeis
// administrativos e marcas parceiras que ja vivem dentro do DogCity.
const RESERVED_HANDLES = new Set([
  'admin',
  'dog',
  'dogdata',
  'dogcity',
  'satoshi',
  'mod',
  'moderator',
  'support',
  'kray',
  'bitflow',
  'ordcards',
  'wallet',
  'system',
  'null',
  'root',
])

export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase()
}

export interface HandleValidation {
  ok: boolean
  reason?: 'invalid_format' | 'reserved'
  handle?: string
}

// Recebe o valor bruto do body, normaliza e valida num passo so. `handle` na
// resposta ja vem pronto pra gravar quando ok e true.
export function validateHandle(raw: string): HandleValidation {
  const handle = normalizeHandle(raw)
  if (!HANDLE_REGEX.test(handle)) {
    return { ok: false, reason: 'invalid_format' }
  }
  if (RESERVED_HANDLES.has(handle)) {
    return { ok: false, reason: 'reserved' }
  }
  return { ok: true, handle }
}

// Mesma checagem, mas devolve uma frase pronta pra mostrar no formulario (uso
// do componente de perfil: components/wallet/profile-modal.tsx). null quando
// o handle esta valido. Copy em ingles porque e texto de tela, nao comentario.
export function handleProblem(raw: string): string | null {
  const handle = normalizeHandle(raw)
  if (handle.length < 3 || handle.length > 15) {
    return '3 to 15 characters.'
  }
  if (!HANDLE_REGEX.test(handle)) {
    return 'Lowercase letters, numbers, and underscores only.'
  }
  if (RESERVED_HANDLES.has(handle)) {
    return 'This handle is reserved.'
  }
  return null
}
