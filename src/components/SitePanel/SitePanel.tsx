import { useEffect, useState } from 'react'
import type { Site, SiteCreate, CompositeScore } from '../../types/site'
import type { LatLon } from '../../types/map'
import { fetchSiteScores } from '../../services/api'
import { SiteDetail } from './SiteDetail'
import { SiteForm } from './SiteForm'
import './SitePanel.css'

interface SitePanelProps {
  mode: 'view' | 'create'
  site?: Site | null
  createCoords?: LatLon | null
  onClose: () => void
  onCreateSite: (data: SiteCreate) => Promise<void>
}

export function SitePanel({ mode, site, createCoords, onClose, onCreateSite }: SitePanelProps) {
  const [scores, setScores] = useState<CompositeScore | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (mode === 'view' && site) {
      fetchSiteScores(site.id).then(setScores)
    }
  }, [mode, site])

  const handleCreate = async (data: SiteCreate) => {
    try {
      setCreateError(null)
      await onCreateSite(data)
    } catch {
      setCreateError('Failed to create site. Please try again.')
    }
  }

  return (
    <div className="site-panel">
      {mode === 'view' && site && scores && (
        <SiteDetail site={site} scores={scores} onClose={onClose} />
      )}
      {mode === 'create' && (
        <SiteForm
          onSubmit={handleCreate}
          onClose={onClose}
          initialCoords={createCoords}
          error={createError}
        />
      )}
    </div>
  )
}
