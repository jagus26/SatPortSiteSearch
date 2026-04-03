interface ScoreBarProps {
  label: string
  score: number
}

function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

export function ScoreBar({ label, score }: ScoreBarProps) {
  return (
    <div className="score-bar">
      <span className="score-bar-label">{label}</span>
      <div className="score-bar-track">
        <div
          className="score-bar-fill"
          style={{ width: `${score}%`, backgroundColor: scoreColor(score) }}
        />
      </div>
      <span className="score-bar-value">{score}</span>
    </div>
  )
}
