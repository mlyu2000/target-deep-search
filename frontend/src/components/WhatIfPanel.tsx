import { useState } from 'react'
import type { GraphData, WhatIfReport } from '../types'
import { startSimulate, connectSimulateStream, getSimulateResult } from '../api/client'
import './WhatIfPanel.css'

interface Props {
  graph: GraphData
}

const TEMPLATES = (target: string) => [
  `What if ${target} is acquired by a larger competitor?`,
  `What if ${target}'s key supplier fails?`,
  `What if ${target} launches a major new product?`,
  `What if a major customer switches to a rival?`,
]

const REACTION_COLORS: Record<string, string> = {
  support: 'var(--hpe-accent)',
  oppose: '#e8632c',
  neutral: 'var(--hpe-text-secondary)',
  observe: 'var(--hpe-text-secondary)',
}

export default function WhatIfPanel({ graph }: Props) {
  const [scenario, setScenario] = useState('')
  const [rounds, setRounds] = useState(3)
  const [autoStable, setAutoStable] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState('')
  const [roundLabel, setRoundLabel] = useState('')
  const [result, setResult] = useState<WhatIfReport | null>(null)
  const [error, setError] = useState('')

  const target = graph.target || 'the target'

  async function run() {
    if (!scenario.trim() || running) return
    setRunning(true)
    setError('')
    setResult(null)
    setProgress('Starting simulation...')
    setRoundLabel('')
    try {
      const { task_id } = await startSimulate({
        graph,
        scenario,
        top_k: 6,
        rounds: autoStable ? 5 : rounds,
        until_stable: autoStable,
        enrich: true,
      })
      connectSimulateStream(
        task_id,
        (u) => {
          setProgress(u.message)
          if (u.round) setRoundLabel(`Round ${u.round}`)
        },
        (e) => { setError(e.message); setRunning(false) },
        async () => {
          const r = await getSimulateResult(task_id)
          setResult(r)
          setRunning(false)
        },
      )
    } catch (e: any) {
      setError(e?.message || 'Simulation failed')
      setRunning(false)
    }
  }

  return (
    <div className="whatif-panel">
      <h3>What-if Simulation</h3>
      <p className="whatif-sub">
        Top-K influential entities from the graph become persona-grounded agents
        (enriched via web search) and react to your scenario over {autoStable ? 'adaptive' : rounds} round(s).
      </p>

      <label className="whatif-label">Scenario</label>
      <textarea
        className="whatif-textarea"
        value={scenario}
        onChange={(e) => setScenario(e.target.value)}
        placeholder={`e.g. What if ${target} is acquired by a competitor?`}
        rows={3}
      />

      <div className="whatif-templates">
        {TEMPLATES(target).map((t, i) => (
          <button key={i} className="whatif-chip" onClick={() => setScenario(t)} disabled={running}>
            {t}
          </button>
        ))}
      </div>

      <div className="whatif-controls">
        <div className="whatif-rounds">
          <span className="whatif-label">Rounds</span>
          <div className="whatif-round-chips">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                className={`whatif-round-chip ${!autoStable && rounds === n ? 'active' : ''}`}
                onClick={() => { setRounds(n); setAutoStable(false) }}
                disabled={running}
              >
                {n}
              </button>
            ))}
            <button
              className={`whatif-round-chip auto ${autoStable ? 'active' : ''}`}
              onClick={() => setAutoStable(true)}
              disabled={running}
            >
              auto
            </button>
          </div>
        </div>
        <button className="whatif-run" onClick={run} disabled={running || !scenario.trim()}>
          {running ? 'Running…' : 'Run Simulation'}
        </button>
      </div>

      {running && (
        <div className="whatif-progress">
          <span className="whatif-spinner" /> {progress} {roundLabel && <em>({roundLabel})</em>}
        </div>
      )}
      {error && <div className="whatif-error">{error}</div>}

      {result && <WhatIfResult report={result} />}
    </div>
  )
}

function WhatIfResult({ report }: { report: WhatIfReport }) {
  const r = report.report
  return (
    <div className="whatif-result">
      <h4>Agents ({report.agents.length})</h4>
      <div className="whatif-agents">
        {report.agents.map((a) => (
          <div key={a.id} className="whatif-agent" title={a.bio}>
            <span className="whatif-agent-name">{a.name}</span>
            <span className="whatif-agent-type">{a.type}</span>
            {a.enriched && <span className="whatif-enriched">web</span>}
          </div>
        ))}
      </div>

      <h4>Transcript</h4>
      <div className="whatif-transcript">
        {report.rounds.map((round) => (
          <div key={round.round} className="whatif-round">
            <div className="whatif-round-head">Round {round.round}</div>
            {round.statements.map((s, i) => (
              <div key={i} className="whatif-statement">
                <span className="whatif-reaction" style={{ color: REACTION_COLORS[s.reaction] || 'var(--hpe-text-secondary)' }}>
                  {s.reaction}
                </span>
                <span className="whatif-agent-name">{s.agent_name}:</span>{' '}
                <span className="whatif-statement-text">{s.statement}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {r && (
        <div className="whatif-report">
          <h4>Report</h4>
          {r.summary && <p className="whatif-summary">{r.summary}</p>}
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
          {r.agreement && r.agreement.length > 0 && (
            <div className="whatif-section"><strong>Agreement:</strong><ul>{r.agreement.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          )}
          {r.conflict && r.conflict.length > 0 && (
            <div className="whatif-section"><strong>Conflict:</strong><ul>{r.conflict.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          )}
          {r.risks && r.risks.length > 0 && (
            <div className="whatif-section"><strong>Risks:</strong><ul>{r.risks.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          )}
          {r.overall_outcome && <div className="whatif-outcome">Overall: <strong>{r.overall_outcome}</strong></div>}
        </div>
      )}
    </div>
  )
}
