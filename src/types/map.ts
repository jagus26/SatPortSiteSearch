export interface ViewState {
  longitude: number
  latitude: number
  zoom: number
}

export interface SearchResult {
  displayName: string
  latitude: number
  longitude: number
  boundingBox: [number, number, number, number] | null // [south, north, west, east]
  type: 'place' | 'coordinates'
}

export interface LatLon {
  latitude: number
  longitude: number
}
