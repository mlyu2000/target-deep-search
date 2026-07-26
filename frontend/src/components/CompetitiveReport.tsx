import type { CompetitiveReport } from '../types'
import './CompetitiveReport.css'

interface Props {
  report: CompetitiveReport
}

function SectionCard({ title, items, badge }: { title: string; items: { name: string; description?: string; [k: string]: unknown }[]; badge?: (item: Record<string, unknown>) => string }) {
  if (items.length === 0) return null
  return (
    <div className="compete-section">
      <h3 className="compete-section-title">{title} ({items.length})</h3>
      <div className="compete-cards">
        {items.map((item, i) => (
          <div key={i} className="compete-card">
            <div className="compete-card-header">
              <span className="compete-card-name">{item.name}</span>
              {badge && <span className="compete-badge">{badge(item)}</span>}
            </div>
            {item.description && <div className="compete-card-desc">{item.description}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CompetitiveReport({ report }: Props) {
  return (
    <div className="compete-report">
      <div className="compete-summary">{report.summary}</div>

      <div className="compete-grid">
        <SectionCard
          title="Competitors"
          items={report.competitors}
          badge={(i) => `strength ${i.strength}`}
        />
        <SectionCard
          title="Acquisitions"
          items={report.acquisitions}
          badge={(i) => i.type as string}
        />
        <SectionCard
          title="Executives & People"
          items={report.executives}
          badge={(i) => i.role as string}
        />
        <SectionCard
          title="Partners"
          items={report.partners}
          badge={(i) => `strength ${i.strength}`}
        />
        <SectionCard
          title="Products"
          items={report.products}
        />
      </div>
    </div>
  )
}
