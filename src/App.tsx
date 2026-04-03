import { useCallback, useState } from 'react'
import { MapView } from './components/MapView/MapView'
import { SearchBar } from './components/SearchBar/SearchBar'
import type { ViewState, SearchResult } from './types/map'
import './App.css'

const INITIAL_VIEW: ViewState = {
  longitude: 0,
  latitude: 20,
  zoom: 2,
}

function App() {
  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW)

  const handleSearchSelect = useCallback((result: SearchResult) => {
    if (result.boundingBox) {
      // For places with bounding boxes, center on the result with appropriate zoom
      const [south, north, west, east] = result.boundingBox
      const centerLat = (south + north) / 2
      const centerLon = (west + east) / 2
      // Rough zoom calculation from bounding box
      const latDiff = Math.abs(north - south)
      const lonDiff = Math.abs(east - west)
      const maxDiff = Math.max(latDiff, lonDiff)
      const zoom = Math.max(2, Math.min(18, Math.floor(9 - Math.log2(maxDiff))))

      setViewState({ longitude: centerLon, latitude: centerLat, zoom })
    } else {
      // For coordinates, fly to the point at zoom 10
      setViewState({
        longitude: result.longitude,
        latitude: result.latitude,
        zoom: 10,
      })
    }
  }, [])

  return (
    <div className="app">
      <SearchBar onSelect={handleSearchSelect} />
      <MapView viewState={viewState} onViewStateChange={setViewState} sites={[]} />
    </div>
  )
}

export default App
