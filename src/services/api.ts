import type { Site, SiteCreate, CompositeScore } from '../types/site'

const API_BASE = 'http://localhost:8000'

export async function fetchSites(): Promise<Site[]> {
  try {
    const response = await fetch(`${API_BASE}/api/sites`)
    if (!response.ok) return []
    return await response.json()
  } catch {
    return []
  }
}

export async function fetchSiteScores(siteId: string): Promise<CompositeScore> {
  try {
    const response = await fetch(`${API_BASE}/api/sites/${siteId}/scores`)
    if (!response.ok) return { site_id: siteId, composite: null, scores: {}, details: {} }
    return await response.json()
  } catch {
    return { site_id: siteId, composite: null, scores: {}, details: {} }
  }
}

export async function createSite(data: SiteCreate): Promise<Site> {
  const response = await fetch(`${API_BASE}/api/sites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    throw new Error('Failed to create site')
  }
  return await response.json()
}

export async function enrichSite(siteId: string): Promise<CompositeScore> {
  const response = await fetch(`${API_BASE}/api/sites/${siteId}/scores/enrich`, {
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error('Failed to enrich site')
  }
  return await response.json()
}
