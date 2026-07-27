import type { KolReport } from '../types'
import { ENTITY_COLORS } from '../types'
import './KolReport.css'

interface Props {
  report: KolReport
}

// Deterministic color for the influence bar.
function barColor(influence: number): string {
  if (influence >= 0.66) return '#ff5c8a'
  if (influence >= 0.33) return '#ffb020'
  return '#62e5f6'
}

export default function KolReport({ report }: Props) {
  return (
    <div className="kol-report">
      <p className="kol-summary">{report.summary}</p>
      <ol className="kol-list">
        {report.ranked.map((k) => (
          <li key={k.id} className="kol-item">
            <div className="kol-item-head">
              <span className="kol-rank">#{k.rank}</span>
              <span className="kol-dot" style={{ backgroundColor: ENTITY_COLORS[k.type] }} />
              <span className="kol-name">{k.name}</span>
              <span className="kol-type">{k.type}</span>
              <span className="kol-score" style={{ color: barColor(k.influence) }}>
                {k.influence.toFixed(2)}
              </span>
            </div>
            <div className="kol-bar-track">
              <div
                className="kol-bar-fill"
                style={{ width: `${Math.max(4, k.influence * 100)}%`, backgroundColor: barColor(k.influence) }}
              />
            </div>
            <div className="kol-metrics">
              <span title="Sum of edge strengths">deg {k.weightedDegree}</span>
              <span title="PageRank (reputation flow)">pr {k.pagerank.toFixed(3)}</span>
              <span title="Betweenness (bridge role)">btw {k.betweenness.toFixed(2)}</span>
              <span title="Mentions in crawl">mnt {k.mentions}</span>
            </div>
            <p className="kol-reason">{k.reason}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
