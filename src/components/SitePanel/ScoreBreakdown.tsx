import { SCORE_METADATA } from '../../config/scoreMetadata'

interface ScoreBreakdownProps {
  category: string
  dataJson: Record<string, number | string | null>
}

export function ScoreBreakdown({ category, dataJson }: ScoreBreakdownProps) {
  const metadata = SCORE_METADATA[category]
  if (!metadata) return null

  return (
    <div className="score-breakdown">
      {metadata.metrics.map((metric) => {
        const rawValue = dataJson[metric.key]
        if (rawValue === undefined || rawValue === null) return null
        const numValue = Number(rawValue)
        const subScore = Math.round(metric.computeSubScore(numValue))
        const displayValue = Number.isInteger(numValue) ? numValue.toString() : numValue.toFixed(1)
        const weightPct = `${Math.round(metric.weight * 100)}%`

        return (
          <div key={metric.key} className="breakdown-row">
            <div className="breakdown-main">
              <span className="breakdown-label">{metric.label}</span>
              <span className="breakdown-value">{displayValue}{metric.unit}</span>
              <span className="breakdown-subscore">{subScore}</span>
              <span className="breakdown-weight">{weightPct}</span>
            </div>
            <div className="breakdown-explanation">{metric.explanation}</div>
          </div>
        )
      })}
      <div className="breakdown-source">Source: {category}</div>
    </div>
  )
}
