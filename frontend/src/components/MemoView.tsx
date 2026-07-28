import type { WhatIfReport, SimulationReportView } from '../types'

export default function MemoView({ report }: { report: WhatIfReport }) {
  const r = report.report as SimulationReportView | undefined
  if (!r) return null
  return (
    <div className="whatif-report">
      <h4>Strategy Memo</h4>
      {r.implications_for_target && (
        <div className="whatif-memo"><strong>Implications for target:</strong> {r.implications_for_target}</div>
      )}
      {r.how_market_reshapes && (
        <div className="whatif-memo"><strong>How the market reshapes:</strong> {r.how_market_reshapes}</div>
      )}
      {r.summary && <div className="whatif-memo"><strong>Summary:</strong> {r.summary}</div>}
      {r.strategic_postures && r.strategic_postures.length > 0 && (
        <div className="whatif-section">
          <strong>Strategic postures:</strong>
          <ul>
            {r.strategic_postures.map((p, i) => (
              <li key={i}><em>{p.agent}</em> ({p.stance}): {p.move}</li>
            ))}
          </ul>
        </div>
      )}
      {r.positions && r.positions.length > 0 && (
        <div className="whatif-section">
          <strong>Positions:</strong>
          <ul>
            {r.positions.map((p, i) => (
              <li key={i}>{p.agent} — <em>{p.final_stance}</em>{p.key_point ? `: ${p.key_point}` : ''}</li>
            ))}
          </ul>
        </div>
      )}
      {r.risks && r.risks.length > 0 && (
        <div className="whatif-section"><strong>Risks:</strong><ul>{r.risks.map((x, i) => <li key={i}>[{x.severity}] {x.risk}</li>)}</ul></div>
      )}
      {r.opportunities && r.opportunities.length > 0 && (
        <div className="whatif-section"><strong>Opportunities:</strong><ul>{r.opportunities.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
      )}
      {r.recommended_actions && r.recommended_actions.length > 0 && (
        <div className="whatif-section whatif-actions"><strong>Recommended actions:</strong><ul>{r.recommended_actions.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
      )}
      {r.overall_outcome && <div className="whatif-outcome">Overall: <strong>{r.overall_outcome}</strong></div>}
    </div>
  )
}
