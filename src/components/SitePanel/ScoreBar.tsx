import { useState } from 'react'
import { ScoreBreakdown } from './ScoreBreakdown'
import type { ScoreDetail } from '../../types/site'

interface ScoreBarProps {
  label: string
  score: number
  category?: string
  detail?: ScoreDetail
}

function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

export function ScoreBar({ label, score, category, detail }: ScoreBarProps) {
  const [expanded, setExpanded] = useState(false)
  const canExpand = !!detail && !!category

  return (
    <div className={`score-bar-wrapper${expanded ? ' expanded' : ''}`}>
      <div
        className={`score-bar${canExpand ? ' expandable' : ''}`}
        onClick={() => canExpand && setExpanded(!expanded)}
      >
        <span className="score-bar-label">{label}</span>
        <div className="score-bar-track">
          <div
            className="score-bar-fill"
            style={{ width: `${score}%`, backgroundColor: scoreColor(score) }}
          />
        </div>
        <span className="score-bar-value">{score}</span>
        {canExpand && <span className="score-bar-chevron">{expanded ? '▴' : '▾'}</span>}
      </div>
      {expanded && detail && category && (
        <ScoreBreakdown category={category} dataJson={detail.data_json} />
      )}
    </div>
  )
}
