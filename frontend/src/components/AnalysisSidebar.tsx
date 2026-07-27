import type { GraphData } from '../types'
import './AnalysisSidebar.css'

export type SidebarView = 'competitive' | 'supplychain' | 'kol' | 'whatif'

interface Props {
  graphData: GraphData
  activeView: SidebarView
  onSelect: (view: SidebarView) => void
}

const OPTIONS: { view: SidebarView; label: string; desc: string }[] = [
  { view: 'competitive', label: 'Competitive Analysis', desc: 'Competitors, acquisitions, execs, partners' },
  { view: 'supplychain', label: 'Supply Chain Analysis', desc: 'Suppliers, tiers, geographic risks' },
  { view: 'kol', label: 'KOL Analysis', desc: 'Most impactful entities by influence' },
  { view: 'whatif', label: 'What-if Simulation', desc: 'Agents react to a scenario you define' },
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
