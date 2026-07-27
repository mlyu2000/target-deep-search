import type { GraphData } from '../types'
import { buildCompetitiveReport } from '../analysis/competitive'
import { buildSupplyChainReport } from '../analysis/supplychain'
import CompetitiveReport from './CompetitiveReport'
import SupplyChainView from './SupplyChainView'
import './AnalysisTab.css'

export type AnalysisView = 'graph' | 'competitive' | 'supplychain'

interface Props {
  mode: 'competitive' | 'supplychain'
  graphData: GraphData
  onBack: () => void
}

// Derives the report from the ALREADY-built graph (no second crawl).
export default function AnalysisTab({ mode, graphData, onBack }: Props) {
  return (
    <div className="analysis-tab">
      <div className="analysis-tab-header">
        <button className="analysis-tab-back" onClick={onBack}>← Back to Graph</button>
        <h2 className="analysis-tab-title">
          {mode === 'competitive' ? 'Competitive Analysis' : 'Supply Chain Analysis'}
        </h2>
        <span className="analysis-tab-note">computed from current graph</span>
      </div>
      <div className="analysis-tab-body">
        {mode === 'competitive'
          ? <CompetitiveReport report={buildCompetitiveReport(graphData)} />
          : <SupplyChainView report={buildSupplyChainReport(graphData)} />}
      </div>
    </div>
  )
}
