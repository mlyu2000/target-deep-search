import { useMemo } from 'react'
import type { GraphData, EntityType } from '../types'
import { ENTITY_COLORS } from '../types'
import './GraphSummary.css'

interface Props {
  data: GraphData
}

export default function GraphSummary({ data }: Props) {
  const summary = useMemo(() => {
    const typeCounts: Record<string, number> = {}
    for (const n of data.nodes) typeCounts[n.type] = (typeCounts[n.type] ?? 0) + 1

    const degrees: Record<string, number> = {}
    for (const e of data.edges) {
      degrees[e.source] = (degrees[e.source] ?? 0) + 1
      degrees[e.target] = (degrees[e.target] ?? 0) + 1
    }
    const topConnected = [...data.nodes]
      .map((n) => ({ name: n.name, type: n.type, degree: degrees[n.id] ?? 0 }))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 8)

    const relCounts: Record<string, number> = {}
    for (const e of data.edges) relCounts[e.type] = (relCounts[e.type] ?? 0) + 1
    const relTypes = Object.entries(relCounts).sort((a, b) => b[1] - a[1])

    return { typeCounts, topConnected, relTypes }
  }, [data])

  const totalMent = data.nodes.reduce((s, n) => s + n.mention_count, 0)

  return (
    <div className="gsum-report">
      <div className="gsum-summary">
        Network of <b>{data.target}</b> — {data.nodes.length} entities, {data.edges.length} relationships
        (depth {data.depth}, {totalMent} total entity mentions).
      </div>

      {data.foundation_summary ? (
        <div className="gsum-foundation">
          <span className="gsum-foundation-badge">Foundational</span>
          <span className="gsum-foundation-text">{data.foundation_summary}</span>
        </div>
      ) : null}

      <div className="gsum-grid">
        <section className="gsum-section">
          <h3 className="gsum-section-title">Entity Composition</h3>
          <div className="gsum-bars">
            {Object.entries(summary.typeCounts).map(([type, count]) => (
              <div key={type} className="gsum-bar-row">
                <span className="gsum-bar-label">{type}</span>
                <span className="gsum-bar-track">
                  <span
                    className="gsum-bar-fill"
                    style={{
                      width: `${(count / data.nodes.length) * 100}%`,
                      background: ENTITY_COLORS[type as EntityType] || 'var(--hpe-text-weak)',
                    }}
                  />
                </span>
                <span className="gsum-bar-count">{count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="gsum-section">
          <h3 className="gsum-section-title">Most Connected Entities</h3>
          <div className="gsum-cards">
            {summary.topConnected.map((c) => (
              <div key={c.name} className="gsum-card">
                <span
                  className="gsum-card-dot"
                  style={{ background: ENTITY_COLORS[c.type as EntityType] || 'var(--hpe-text-weak)' }}
                />
                <span className="gsum-card-name">{c.name}</span>
                <span className="gsum-card-degree">{c.degree} links</span>
              </div>
            ))}
          </div>
        </section>

        <section className="gsum-section gsum-section-wide">
          <h3 className="gsum-section-title">Relationship Types</h3>
          <div className="gsum-rel-chips">
            {summary.relTypes.map(([type, count]) => (
              <span key={type} className="gsum-rel-chip">
                {type} <b>{count}</b>
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
