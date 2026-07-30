export interface VitalData {
  p75: number; avg: number; good_pct: number; needs_pct: number; poor_pct: number
  rating: string; score: number; samples: number
}

export interface Report {
  period: { days: number; from: string; to: string }
  summary: { pageviews: number; unique_sessions: number; avg_pages_per_session: number }
  by_day: Record<string, number>
  top_pages: { page: string; views: number }[]
  by_country: { country: string; views: number }[]
  by_device: Record<string, number>
  by_browser: { browser: string; views: number }[]
  by_referrer: { referrer: string; views: number }[]
  realtime: Record<string, number>
  web_vitals: Record<string, VitalData>
  performance_score: number | null
  vitals_by_day: Record<string, number | string>[]
  vitals_by_device: Record<string, number | string>[]
  slowest_pages: Record<string, { page: string; p75: number }[]>
}

export interface AdsReport {
  advertiser: string
  period: { days: number; from: string; to: string }
  summary: { impressions: number; clicks: number; ctr: string }
  by_page: Record<string, { impressions: number; clicks: number }>
  by_device: Record<string, { impressions: number; clicks: number }>
  by_day: Record<string, { impressions: number; clicks: number }>
}
