export interface Site {
  id: string
  name: string
  slug: string
  latitude: number
  longitude: number
  status: 'candidate' | 'under-review' | 'approved' | 'rejected'
  region: string | null
  country: string | null
  country_code: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SiteCreate {
  name: string
  slug: string
  latitude: number
  longitude: number
  region?: string
  country?: string
  country_code?: string
  notes?: string
}

export interface ScoreDetail {
  raw_score: number
  data_json: Record<string, number | string | null>
  source: string | null
}

export interface CompositeScore {
  site_id: string
  composite: number | null
  scores: Record<string, number>
  details: Record<string, ScoreDetail>
}
