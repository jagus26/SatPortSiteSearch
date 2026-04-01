import { useCallback } from 'react'
import Map, { NavigationControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { ViewState } from '../../types/map'
import './MapView.css'

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

interface MapViewProps {
  viewState: ViewState
  onViewStateChange: (viewState: ViewState) => void
}

export function MapView({ viewState, onViewStateChange }: MapViewProps) {
  const handleMove = useCallback(
    (evt: { viewState: ViewState }) => {
      onViewStateChange(evt.viewState)
    },
    [onViewStateChange]
  )

  return (
    <div className="map-container">
      <Map
        {...viewState}
        onMove={handleMove}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLE}
      >
        <NavigationControl position="top-right" />
      </Map>
    </div>
  )
}
