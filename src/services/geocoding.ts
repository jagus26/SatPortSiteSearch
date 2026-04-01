import type { SearchResult, LatLon } from '../types/map'

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search'

export function parseCoordinates(input: string): LatLon | null {
  const cleaned = input.trim()

  // Match "lat, lon" or "lat lon"
  const match = cleaned.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/)
  if (!match) return null

  const latitude = parseFloat(match[1])
  const longitude = parseFloat(match[2])

  if (latitude < -90 || latitude > 90) return null
  if (longitude < -180 || longitude > 180) return null

  return { latitude, longitude }
}

export async function searchByName(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return []

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '5',
    })

    const response = await fetch(`${NOMINATIM_BASE}?${params}`)

    if (!response.ok) return []

    const data = await response.json()

    return data.map((item: Record<string, unknown>) => ({
      displayName: item.display_name as string,
      latitude: parseFloat(item.lat as string),
      longitude: parseFloat(item.lon as string),
      boundingBox: (item.boundingbox as string[])?.map(Number) as
        | [number, number, number, number]
        | null,
      type: 'place' as const,
    }))
  } catch {
    return []
  }
}
