import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchSites, fetchSiteScores, createSite } from './api'
import type { Site, CompositeScore } from '../types/site'

const mockSite: Site = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Sao Paulo Station',
  slug: 'sao-paulo-station',
  latitude: -23.5505,
  longitude: -46.6333,
  status: 'candidate',
  region: 'South America',
  country: 'Brazil',
  country_code: 'BR',
  notes: null,
  created_at: '2026-04-02T12:00:00Z',
  updated_at: '2026-04-02T12:00:00Z',
}

const mockScores: CompositeScore = {
  site_id: '123e4567-e89b-12d3-a456-426614174000',
  composite: 82.5,
  scores: { connectivity: 90, environmental: 75 },
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('fetchSites', () => {
  it('fetches all sites from the API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [mockSite],
    } as Response)

    const sites = await fetchSites()
    expect(sites).toEqual([mockSite])
    expect(fetch).toHaveBeenCalledWith('http://localhost:8000/api/sites')
  })

  it('returns empty array on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

    const sites = await fetchSites()
    expect(sites).toEqual([])
  })
})

describe('fetchSiteScores', () => {
  it('fetches composite scores for a site', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockScores,
    } as Response)

    const scores = await fetchSiteScores('123e4567-e89b-12d3-a456-426614174000')
    expect(scores).toEqual(mockScores)
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/sites/123e4567-e89b-12d3-a456-426614174000/scores'
    )
  })

  it('returns null composite on error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

    const scores = await fetchSiteScores('fake-id')
    expect(scores).toEqual({ site_id: 'fake-id', composite: null, scores: {} })
  })
})

describe('createSite', () => {
  it('sends POST request and returns created site', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockSite,
    } as Response)

    const newSite = {
      name: 'Sao Paulo Station',
      slug: 'sao-paulo-station',
      latitude: -23.5505,
      longitude: -46.6333,
    }
    const result = await createSite(newSite)
    expect(result).toEqual(mockSite)
    expect(fetch).toHaveBeenCalledWith('http://localhost:8000/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSite),
    })
  })

  it('throws on error response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ detail: 'Validation error' }),
    } as Response)

    await expect(createSite({ name: '', slug: '', latitude: 0, longitude: 0 }))
      .rejects.toThrow('Failed to create site')
  })
})
