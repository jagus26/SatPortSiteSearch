import { useCallback } from 'react'
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { ViewState, LatLon } from '../../types/map'
import type { Site } from '../../types/site'
import './MapView.css'

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

interface MapViewProps {
  viewState: ViewState
  onViewStateChange: (viewState: ViewState) => void
  sites: Site[]
  siteScores?: Record<string, number>
  onSelectSite?: (siteId: string) => void
  onMapClick?: (coords: LatLon) => void
}

function pinColor(score: number | undefined): string {
  if (score === undefined) return '#64748b'
  if (score >= 70) return '#22c55e'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

export function MapView({
  viewState,
  onViewStateChange,
  sites,
  siteScores,
  onSelectSite,
  onMapClick,
}: MapViewProps) {
  const handleMove = useCallback(
    (evt: { viewState: ViewState }) => {
      onViewStateChange(evt.viewState)
    },
    [onViewStateChange]
  )

  const handleClick = useCallback(
    (evt: { lngLat: { lng: number; lat: number } }) => {
      if (onMapClick) {
        onMapClick({ latitude: evt.lngLat.lat, longitude: evt.lngLat.lng })
      }
    },
    [onMapClick]
  )

  return (
    <div className="map-container">
      <Map
        {...viewState}
        onMove={handleMove}
        onClick={handleClick}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLE}
      >
        <NavigationControl position="top-right" />
        {sites.map((site) => {
          const score = siteScores?.[site.id]
          const color = pinColor(score)
          return (
            <Marker
              key={site.id}
              longitude={site.longitude}
              latitude={site.latitude}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation()
                if (onSelectSite) onSelectSite(site.id)
              }}
            >
              <div className="score-pin" title={site.name} style={{ '--pin-color': color } as React.CSSProperties}>
                <span className="score-pin-label">{score !== undefined ? Math.round(score) : '–'}</span>
              </div>
            </Marker>
          )
        })}
      </Map>
    </div>
  )
}
