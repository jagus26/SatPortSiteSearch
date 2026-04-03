import { useEffect, useState } from 'react'
import type { Site, SiteCreate, CompositeScore } from '../../types/site'
import type { LatLon } from '../../types/map'
import { fetchSiteScores, enrichSite } from '../../services/api'
import { SiteDetail } from './SiteDetail'
import { SiteForm } from './SiteForm'
import './SitePanel.css'

interface SitePanelProps {
  mode: 'view' | 'create'
  site?: Site | null
  createCoords?: LatLon | null
  onClose: () => void
  onCreateSite: (data: SiteCreate) => Promise<void>
  onScoresUpdated?: (siteId: string, composite: number | null) => void
}

export function SitePanel({ mode, site, createCoords, onClose, onCreateSite, onScoresUpdated }: SitePanelProps) {
  const [scores, setScores] = useState<CompositeScore | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isEnriching, setIsEnriching] = useState(false)

  useEffect(() => {
    if (mode === 'view' && site) {
      fetchSiteScores(site.id).then(setScores)
    }
  }, [mode, site])

  const handleEnrich = async () => {
    if (!site) return
    setIsEnriching(true)
    try {
      const result = await enrichSite(site.id)
      setScores(result)
      if (onScoresUpdated) {
        onScoresUpdated(site.id, result.composite)
      }
    } catch {
      // Scores stay as they were
    } finally {
      setIsEnriching(false)
    }
  }

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
        <SiteDetail
          site={site}
          scores={scores}
          onClose={onClose}
          onEnrich={handleEnrich}
          isEnriching={isEnriching}
        />
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
