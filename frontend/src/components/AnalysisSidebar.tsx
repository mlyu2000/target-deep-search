import type { GraphData } from '../types'
import type { AnalysisView } from './AnalysisTab'
import './AnalysisSidebar.css'

interface Props {
  graphData: GraphData
  activeView: AnalysisView
  onSelect: (view: AnalysisView) => void
}

const OPTIONS: { view: Exclude<AnalysisView, 'graph'>; label: string; desc: string }[] = [
  { view: 'competitive', label: 'Competitive Analysis', desc: 'Competitors, acquisitions, execs, partners' },
  { view: 'supplychain', label: 'Supply Chain Analysis', desc: 'Suppliers, tiers, geographic risks' },
]

export default function AnalysisSidebar({ graphData, activeView, onSelect }: Props) {
  return (
    <aside className="analysis-sidebar">
      <h3 className="analysis-sidebar-title">Targeted Analysis</h3>
      <p className="analysis-sidebar-sub">
        Build reports from the {graphData.nodes.length} entities already mapped.
      </p>
      {OPTIONS.map((opt) => (
        <button
          key={opt.view}
          className={`analysis-sidebar-btn ${activeView === opt.view ? 'active' : ''}`}
          onClick={() => onSelect(opt.view)}
        >
          <span className="analysis-sidebar-btn-label">{opt.label}</span>
          <span className="analysis-sidebar-btn-desc">{opt.desc}</span>
        </button>
      ))}
    </aside>
  )
}
