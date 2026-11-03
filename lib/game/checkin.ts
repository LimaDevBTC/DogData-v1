// Rodar: npx tsx --test lib/game/checkin.test.ts
//
// Logica pura do check-in diario do jogo (sem rede, sem banco). Contrato: dogcity-mundo
// PROGRESSO_boas_vindas.md "Contrato da API"; regras: plano/PESQUISA_FIDELIZACAO.md secoes 2 e 6.
//
// - Dia de jogo vira as 08:00 UTC: dia = data UTC de (agora - 8 h).
// - Streak de CUIDADO: dias marcados, com 2 folgas automaticas em janela movel de 7 dias. Um dia sem marca
//   e' perdoado enquanto a janela de 7 dias que termina nele tiver no maximo 2 dias sem marca; o terceiro
//   quebra. Quebrou: a proxima marca recomeca em 1 ("welcome back"), as folgas voltam inteiras.
// - Hoje ainda nao marcado NAO e' falta (o jogador ainda pode marcar): a conta termina em ontem.
// - Marcos: 7, 14, 30, 60, 100. Bonus de marco: 7 dias = +50 DC Points. Nunca $DOG.

export const DAY_TURN_HOUR_UTC = 8
export const REST_DAYS_PER_WINDOW = 2
export const WINDOW_DAYS = 7
export const WEEK_GOAL = 4
export const MILESTONES = [7, 14, 30, 60, 100] as const
export const HISTORY_DAYS = 90

const MS_DAY = 86_400_000

export interface Checkin {
  day: string
  checkedToday: boolean
  justClaimed: boolean
  streak: number
  best: number
  restDaysLeft: number
  weekDays: number
  nextMilestone: number
  reward: { points: number; items: { id: string; qtd: number }[] } | null
}

export const DAILY_REWARD = {
  points: 10,
  items: [
    { id: 'carne', qtd: 1 },
    { id: 'garrafa_agua', qtd: 2 },
  ],
}
export const MILESTONE_BONUS: Record<number, number> = { 7: 50 }

/** dia de jogo (YYYY-MM-DD) de um instante */
export function gameDay(now: Date | number = Date.now()): string {
  const t = typeof now === 'number' ? now : now.getTime()
  return new Date(t - DAY_TURN_HOUR_UTC * 3_600_000).toISOString().slice(0, 10)
}

const toNum = (day: string) => Math.floor(Date.parse(day + 'T00:00:00Z') / MS_DAY)
const fromNum = (n: number) => new Date(n * MS_DAY).toISOString().slice(0, 10)

export function addDays(day: string, n: number): string {
  return fromNum(toNum(day) + n)
}

/** a data de partida do historico a buscar no banco (inclusive) */
export function historyStart(today: string): string {
  return addDays(today, -HISTORY_DAYS)
}

interface Sim {
  streak: number
  best: number
  /** dias sem marca desde a ultima quebra, ainda dentro da janela */
  misses: number[]
}

/** percorre dia a dia de `first` ate `last` (inclusive) */
function simulate(checked: Set<number>, first: number, last: number): Sim {
  let streak = 0
  let best = 0
  let misses: number[] = []
  for (let d = first; d <= last; d++) {
    if (checked.has(d)) {
      streak++
      if (streak > best) best = streak
      continue
    }
    if (streak === 0) continue
    misses = misses.filter((m) => m > d - WINDOW_DAYS)
    misses.push(d)
    if (misses.length > REST_DAYS_PER_WINDOW) {
      streak = 0
      misses = []
    }
  }
  return { streak, best, misses: misses.filter((m) => m > last - WINDOW_DAYS + 1) }
}

export function nextMilestone(streak: number): number {
  for (const m of MILESTONES) if (m > streak) return m
  return MILESTONES[MILESTONES.length - 1] + 100 * Math.ceil((streak - MILESTONES[MILESTONES.length - 1] + 1) / 100)
}

/** segunda-feira da semana (UTC) do dia de jogo */
export function weekStart(day: string): string {
  const n = toNum(day)
  const dow = (n + 3) % 7 // 1970-01-01 foi quinta; 0 = segunda
  return fromNum(n - dow)
}

/**
 * Estado do check-in a partir dos dias marcados (YYYY-MM-DD, qualquer ordem, duplicatas ok).
 * `justClaimed` e' decidido por quem chama (o POST que de fato inseriu a linha).
 */
export function computeCheckin(days: Iterable<string>, today: string, justClaimed = false): Checkin {
  const checked = new Set<number>()
  let earliest = Infinity
  const t = toNum(today)
  for (const d of days) {
    const n = toNum(d)
    if (!Number.isFinite(n) || n > t) continue
    checked.add(n)
    if (n < earliest) earliest = n
  }
  const checkedToday = checked.has(t)
  let streak = 0
  let best = 0
  let restDaysLeft = REST_DAYS_PER_WINDOW
  if (checked.size > 0) {
    const sim = simulate(checked, earliest, checkedToday ? t : t - 1)
    streak = sim.streak
    best = sim.best
    if (streak > 0) {
      // folgas gastas nos 6 dias anteriores a hoje (hoje, marcado ou nao, ainda nao gasta folga)
      const spent = sim.misses.filter((m) => m > t - WINDOW_DAYS && m < t).length
      restDaysLeft = Math.max(0, REST_DAYS_PER_WINDOW - spent)
    }
  }
  const ws = toNum(weekStart(today))
  let weekDays = 0
  for (let d = ws; d <= t; d++) if (checked.has(d)) weekDays++

  let reward: Checkin['reward'] = null
  if (justClaimed) {
    const bonus = MILESTONE_BONUS[streak] ?? 0
    reward = { points: DAILY_REWARD.points + bonus, items: DAILY_REWARD.items.map((i) => ({ ...i })) }
  }
  return {
    day: today,
    checkedToday,
    justClaimed,
    streak,
    best,
    restDaysLeft,
    weekDays,
    nextMilestone: nextMilestone(streak),
    reward,
  }
}
