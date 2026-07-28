import type { GraphData } from '../types'
import { buildKolReport } from '../analysis/kol'

/**
 * Business "so what?" strip for the Graph view.
 * Surfaces the top influencers and a one-line narrative derived from the
 * ALREADY-built graph (no extra crawl) so a business reader gets the gist
 * instantly before exploring the chart.
 */
export default function KeyTakeaways({ graph }: { graph: GraphData }) {
  const kol = buildKolReport(graph, 3).ranked
  if (kol.length === 0) return null

  const target = graph.target.trim()
  const top = kol[0]
  // degree of the top entity
  const topDegree = graph.edges.filter(
    (e) => e.source === top.id || e.target === top.id,
  ).length
  const second = kol[1]
  const narrative =
    `${top.name} is the most influential entity in this map` +
    (second ? `, with ${second.name} close behind` : '') +
    ` — ${topDegree} direct relationships make it the natural center of any scenario.`

  const roleLabel: Record<string, string> = {
    person: 'Person',
    organization: 'Org',
    product: 'Product',
    location: 'Location',
    technology: 'Tech',
  }

  return (
    <div className="key-takeaways">
      <div className="key-takeaways-head">
        <span className="key-takeaways-title">Key takeaways</span>
        <span className="key-takeaways-narrative">{narrative}</span>
      </div>
      <div className="key-takeaways-chips">
        {kol.map((k) => (
          <span key={k.id} className="key-takeaway-chip" title={`Influence #${k.rank}`}>
            <span className="key-takeaway-rank">#{k.rank}</span>
            <span className="key-takeaway-name">{k.name}</span>
            <span className="key-takeaway-type">{roleLabel[k.type] || k.type}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
