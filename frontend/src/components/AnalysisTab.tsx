import type { GraphData } from '../types'
import { buildCompetitiveReport } from '../analysis/competitive'
import { buildSupplyChainReport } from '../analysis/supplychain'
import { buildKolReport } from '../analysis/kol'
import CompetitiveReport from './CompetitiveReport'
import SupplyChainView from './SupplyChainView'
import KolReport from './KolReport'
import './AnalysisTab.css'

export type AnalysisView = 'graph' | 'competitive' | 'supplychain' | 'kol'

interface Props {
  mode: 'competitive' | 'supplychain' | 'kol'
  graphData: GraphData
  onBack: () => void
}

// Derives the report from the ALREADY-built graph (no second crawl).
export default function AnalysisTab({ mode, graphData, onBack }: Props) {
  const title =
    mode === 'competitive' ? 'Competitive Analysis'
      : mode === 'supplychain' ? 'Supply Chain Analysis'
        : 'KOL / Influence Analysis'

  // Surface each report's synthesized summary as a "Read this first" callout.
  const summary =
    mode === 'competitive' ? buildCompetitiveReport(graphData).summary
      : mode === 'supplychain' ? buildSupplyChainReport(graphData).summary
        : buildKolReport(graphData).summary

  return (
    <div className="analysis-tab">
      <div className="analysis-tab-header">
        <button className="analysis-tab-back" onClick={onBack}>← Back to Graph</button>
        <h2 className="analysis-tab-title">{title}</h2>
        <span className="analysis-tab-note">computed from current graph</span>
      </div>
      <p className="analysis-tab-hook">
        {mode === 'competitive'
          ? 'Who can help or hurt the target — and how.'
          : mode === 'supplychain'
            ? 'Where the target is exposed along its supply chain.'
            : 'The few entities whose moves move the target most.'}
      </p>
      {summary && <div className="analysis-tab-readfirst">📌 {summary}</div>}
      <div className="analysis-tab-body">
        {mode === 'competitive' ? (
          <CompetitiveReport report={buildCompetitiveReport(graphData)} />
        ) : mode === 'supplychain' ? (
          <SupplyChainView report={buildSupplyChainReport(graphData)} />
        ) : (
          <KolReport report={buildKolReport(graphData)} />
        )}
      </div>
    </div>
  )
}
