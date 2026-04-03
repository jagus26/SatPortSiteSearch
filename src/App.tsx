import { useCallback, useEffect, useState } from 'react'
import { MapView } from './components/MapView/MapView'
import { SearchBar } from './components/SearchBar/SearchBar'
import { Toolbar } from './components/Toolbar/Toolbar'
import { SitePanel } from './components/SitePanel/SitePanel'
import { fetchSites, fetchSiteScores, createSite } from './services/api'
import type { ViewState, SearchResult, LatLon } from './types/map'
import type { Site, SiteCreate } from './types/site'
import './App.css'

const INITIAL_VIEW: ViewState = {
  longitude: 0,
  latitude: 20,
  zoom: 2,
}

function App() {
  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW)
  const [sites, setSites] = useState<Site[]>([])
  const [siteScores, setSiteScores] = useState<Record<string, number>>({})
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)
  const [panelMode, setPanelMode] = useState<'view' | 'create' | null>(null)
  const [createCoords, setCreateCoords] = useState<LatLon | null>(null)

  useEffect(() => {
    fetchSites().then((data) => {
      setSites(data)
      data.forEach((site) => {
        fetchSiteScores(site.id).then((result) => {
          if (result.composite !== null) {
            setSiteScores((prev) => ({ ...prev, [site.id]: result.composite! }))
          }
        })
      })
    })
  }, [])

  const handleSearchSelect = useCallback((result: SearchResult) => {
    if (result.boundingBox) {
      const [south, north, west, east] = result.boundingBox
      const centerLat = (south + north) / 2
      const centerLon = (west + east) / 2
      const latDiff = Math.abs(north - south)
      const lonDiff = Math.abs(east - west)
      const maxDiff = Math.max(latDiff, lonDiff)
      const zoom = Math.max(2, Math.min(18, Math.floor(9 - Math.log2(maxDiff))))
      setViewState({ longitude: centerLon, latitude: centerLat, zoom })
    } else {
      setViewState({
        longitude: result.longitude,
        latitude: result.latitude,
        zoom: 10,
      })
    }
  }, [])

  const handleSelectSite = useCallback((siteId: string) => {
    setSelectedSiteId(siteId)
    setPanelMode('view')
  }, [])

  const handleMapClick = useCallback((coords: LatLon) => {
    if (panelMode === null) {
      setCreateCoords(coords)
      setPanelMode('create')
    }
  }, [panelMode])

  const handleAddSite = useCallback(() => {
    setSelectedSiteId(null)
    setCreateCoords(null)
    setPanelMode('create')
  }, [])

  const handleClosePanel = useCallback(() => {
    setSelectedSiteId(null)
    setPanelMode(null)
    setCreateCoords(null)
  }, [])

  const handleCreateSite = useCallback(async (data: SiteCreate) => {
    const newSite = await createSite(data)
    setSites((prev) => [...prev, newSite])
    setPanelMode(null)
    setCreateCoords(null)
  }, [])

  const selectedSite = sites.find((s) => s.id === selectedSiteId) ?? null

  return (
    <div className="app">
      <SearchBar onSelect={handleSearchSelect} />
      <Toolbar onAddSite={handleAddSite} />
      <MapView
        viewState={viewState}
        onViewStateChange={setViewState}
        sites={sites}
        siteScores={siteScores}
        onSelectSite={handleSelectSite}
        onMapClick={handleMapClick}
      />
      {panelMode && (
        <SitePanel
          mode={panelMode}
          site={selectedSite}
          createCoords={createCoords}
          onClose={handleClosePanel}
          onCreateSite={handleCreateSite}
        />
      )}
    </div>
  )
}

export default App
