import type { Site, CompositeScore } from '../../types/site'
import { ScoreBar } from './ScoreBar'

interface SiteDetailProps {
  site: Site
  scores: CompositeScore
  onClose: () => void
  onEnrich: () => Promise<void>
  isEnriching: boolean
}

function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

const CATEGORY_LABELS: Record<string, string> = {
  connectivity: 'Connectivity',
  environmental: 'Environmental',
  infrastructure: 'Infrastructure',
  regulatory: 'Regulatory',
  rf_satellite: 'RF / Satellite',
  geopolitical: 'Geopolitical',
}

export function SiteDetail({ site, scores, onClose, onEnrich, isEnriching }: SiteDetailProps) {
  const composite = scores.composite !== null ? Math.round(scores.composite) : null

  return (
    <div className="site-detail">
      <div className="panel-header">
        <h2 className="panel-title">{site.name}</h2>
        <button className="panel-close" onClick={onClose} aria-label="Close panel">
          &times;
        </button>
      </div>

      <div className="panel-badges">
        <span className={`badge badge-status badge-${site.status}`}>{site.status}</span>
        {site.country && <span className="badge badge-country">{site.country}</span>}
      </div>

      {composite !== null ? (
        <div className="composite-score">
          <span className="composite-value" style={{ color: scoreColor(composite) }}>
            {composite}
          </span>
          <span className="composite-label">composite score</span>
        </div>
      ) : (
        <div className="composite-score">
          <span className="composite-value" style={{ color: '#64748b' }}>–</span>
          <span className="composite-label">No scores yet</span>
        </div>
      )}

      <div className="enrich-section">
        <button
          className={`enrich-btn${isEnriching ? ' loading' : ''}`}
          onClick={onEnrich}
          disabled={isEnriching}
        >
          {isEnriching ? 'Fetching...' : 'Fetch Scores'}
        </button>
      </div>

      <div className={`score-bars${isEnriching ? ' enriching' : ''}`}>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
          const value = scores.scores[key]
          const detail = scores.details?.[key]
          return value !== undefined ? (
            <ScoreBar key={key} label={label} score={value} category={key} detail={detail} />
          ) : null
        })}
      </div>

      <div className="panel-footer">
        {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
        {site.region && <> &middot; {site.region}</>}
      </div>
    </div>
  )
}
