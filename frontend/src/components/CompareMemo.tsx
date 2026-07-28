import type { SavedSimRunFull, SimulationReportView } from '../types'

function view(run: SavedSimRunFull): SimulationReportView | undefined {
  return run.result?.report as SimulationReportView | undefined
}

function posturesByAgent(a?: SimulationReportView, b?: SimulationReportView) {
  const aMap = new Map((a?.strategic_postures || []).map((p) => [p.agent, p]))
  const bMap = new Map((b?.strategic_postures || []).map((p) => [p.agent, p]))
  const agents = Array.from(new Set([...aMap.keys(), ...bMap.keys()]))
  return agents.map((name) => {
    const pa = aMap.get(name)
    const pb = bMap.get(name)
    const changed = JSON.stringify(pa) !== JSON.stringify(pb) && (pa || pb)
    return { name, a: pa, b: pb, changed: !!changed }
  })
}

export default function CompareMemo({ a, b }: { a: SavedSimRunFull; b: SavedSimRunFull }) {
  const va = view(a)
  const vb = view(b)
  if (!va || !vb) return null

  const sections: Array<{ key: string; label: string; av: string | undefined; bv: string | undefined }> = [
    { key: 'implications', label: 'Implications for target', av: va.implications_for_target, bv: vb.implications_for_target },
    { key: 'market', label: 'How the market reshapes', av: va.how_market_reshapes, bv: vb.how_market_reshapes },
  ]

  return (
    <div className="compare-wrap">
      <div className="compare-head">
        <span>Comparing: <strong>{a.target}</strong> vs <strong>{b.target}</strong></span>
        <span className="compare-sub">{a.scenario.slice(0, 38)}… &nbsp;vs&nbsp; {b.scenario.slice(0, 38)}…</span>
      </div>
      <div className="compare-cols">
        {[a, b].map((run, idx) => {
          const v = idx === 0 ? va : vb
          return (
            <div key={run.run_id} className="compare-col">
              <div className="compare-col-title">{run.target} — {run.scenario.slice(0, 50)}…</div>
              <div className="compare-col-body">
                {sections.map((s) => {
                  const val = idx === 0 ? s.av : s.bv
                  const other = idx === 0 ? s.bv : s.av
                  const differs = !!val !== !!other || (val || '').trim() !== (other || '').trim()
                  return (
                    <div key={s.key} className={`compare-section ${differs ? 'differs' : ''}`}>
                      <div className="compare-section-head">
                        {s.label}
                        {differs && <span className="diff-badge">Δ differs</span>}
                      </div>
                      <div className="compare-section-body">{val || <em className="compare-empty">—</em>}</div>
                    </div>
                  )
                })}
                <div className="compare-section">
                  <div className="compare-section-head">Strategic postures</div>
                  <div className="compare-postures">
                    {posturesByAgent(va, vb).map((p) => (
                      <div key={p.name} className={`compare-posture-row ${p.changed ? 'differs' : ''}`}>
                        <div className="cp-name">{p.name}{p.changed && <span className="diff-badge">Δ</span>}</div>
                        <div className="cp-a">{p.a ? `${p.a.stance}: ${p.a.move}` : <em className="compare-empty">—</em>}</div>
                        <div className="cp-b">{p.b ? `${p.b.stance}: ${p.b.move}` : <em className="compare-empty">—</em>}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="compare-section">
                  <div className="compare-section-head">Risks</div>
                  <ul className="compare-list">
                    {(idx === 0 ? (va.risks || []) : (vb.risks || [])).map((x, i) => <li key={i}>[{x.severity}] {x.risk}</li>)}
                  </ul>
                </div>
                <div className="compare-section">
                  <div className="compare-section-head">Recommended actions</div>
                  <ul className="compare-list">
                    {(idx === 0 ? (va.recommended_actions || []) : (vb.recommended_actions || [])).map((x, i) => <li key={i}>{x}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
