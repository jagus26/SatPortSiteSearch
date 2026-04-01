import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchByName, parseCoordinates } from './geocoding'

describe('parseCoordinates', () => {
  it('parses "lat, lon" format', () => {
    const result = parseCoordinates('51.5074, -0.1278')
    expect(result).toEqual({ latitude: 51.5074, longitude: -0.1278 })
  })

  it('parses "lat lon" format (space separated)', () => {
    const result = parseCoordinates('51.5074 -0.1278')
    expect(result).toEqual({ latitude: 51.5074, longitude: -0.1278 })
  })

  it('returns null for non-coordinate strings', () => {
    expect(parseCoordinates('London')).toBeNull()
    expect(parseCoordinates('hello world')).toBeNull()
  })

  it('rejects out-of-range coordinates', () => {
    expect(parseCoordinates('91, 0')).toBeNull()
    expect(parseCoordinates('0, 181')).toBeNull()
  })
})

describe('searchByName', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns search results from Nominatim', async () => {
    const mockResponse = [
      {
        display_name: 'London, England, United Kingdom',
        lat: '51.5074',
        lon: '-0.1278',
        boundingbox: ['51.2867', '51.6919', '-0.5103', '0.3340'],
      },
    ]

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    })

    const results = await searchByName('London')

    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({
      displayName: 'London, England, United Kingdom',
      latitude: 51.5074,
      longitude: -0.1278,
      boundingBox: [51.2867, 51.6919, -0.5103, 0.3340],
      type: 'place',
    })

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('nominatim.openstreetmap.org/search'),
      expect.objectContaining({
        headers: { 'User-Agent': 'SiteSearch/1.0' },
      })
    )
  })

  it('returns empty array on API error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    })

    const results = await searchByName('London')
    expect(results).toEqual([])
  })

  it('returns empty array for empty query', async () => {
    const results = await searchByName('')
    expect(results).toEqual([])
  })
})
