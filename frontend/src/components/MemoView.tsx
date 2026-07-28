import type { WhatIfReport, SimulationReportView } from '../types'

const TIER_COLOR: Record<string, string> = {
  strong: 'var(--hpe-accent)',
  moderate: '#d6a700',
  weak: '#e8632c',
  unknown: 'var(--hpe-text-secondary)',
}

export default function MemoView({ report, onSource, compact }: {
  report: WhatIfReport
  onSource?: (agent: string) => void
  compact?: boolean
}) {
  const r = report.report as SimulationReportView | undefined
  if (!r) return null
  return (
    <div className="whatif-report">
      {/* Evidence + confidence header */}
      <div className="whatif-evidence-bar">
        {r.evidence_tier && (
          <span className="whatif-tier" style={{ color: TIER_COLOR[r.evidence_tier] || 'var(--hpe-text-secondary)' }}>
            Evidence: {r.evidence_tier}
          </span>
        )}
        {r.enrichment_summary && <span className="whatif-ev-meta">{r.enrichment_summary}</span>}
        {r.confidence?.overall && (
          <span className="whatif-confidence">Confidence: {r.confidence.overall}</span>
        )}
      </div>

      {/* Guardrail flags */}
      {r.guardrail_flags && r.guardrail_flags.length > 0 && (
        <div className="whatif-guardrail">
          ⚠ Review recommended: {r.guardrail_flags.map((g, i) => (
            <span key={i} className="whatif-guardrail-item">“{g.action}” — {g.reason}</span>
          ))}
        </div>
      )}

      <h4>Strategy Memo</h4>
      {r.implications_for_target && (
        <div className="whatif-memo"><strong>Implications for target:</strong> {r.implications_for_target}</div>
      )}
      {!compact && r.how_market_reshapes && (
        <div className="whatif-memo"><strong>How the market reshapes:</strong> {r.how_market_reshapes}</div>
      )}
      {r.summary && <div className="whatif-memo"><strong>Summary:</strong> {r.summary}</div>}
      {!compact && r.strategic_postures && r.strategic_postures.length > 0 && (
        <div className="whatif-section">
          <strong>Strategic postures:</strong>
          <ul>
            {r.strategic_postures.map((p, i) => (
              <li key={i}>
                <em>{p.agent}</em> ({p.stance}): {p.move}
                {onSource && (
                  <button className="whatif-source-chip" onClick={() => onSource(p.agent)} title="Jump to transcript">↩ {p.agent}</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!compact && r.positions && r.positions.length > 0 && (
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
        <div className="whatif-section">
          <strong>Risks:</strong>
          <ul>
            {r.risks.map((x, i) => (
              <li key={i}>[{x.severity}] {x.risk}{r.confidence?.risks ? '' : ''}</li>
            ))}
          </ul>
        </div>
      )}
      {!compact && r.opportunities && r.opportunities.length > 0 && (
        <div className="whatif-section"><strong>Opportunities:</strong><ul>{r.opportunities.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
      )}
      {r.recommended_actions && r.recommended_actions.length > 0 && (
        <div className="whatif-section whatif-actions"><strong>Recommended actions:</strong><ul>{r.recommended_actions.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
      )}
      {r.overall_outcome && <div className="whatif-outcome">Overall: <strong>{r.overall_outcome}</strong></div>}
    </div>
  )
}
