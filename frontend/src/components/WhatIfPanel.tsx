import { useState } from 'react'
import type { GraphData, WhatIfReport, WhatIfState, AgentPersonaView } from '../types'
import { startSimulate, connectSimulateStream, getSimulateResult } from '../api/client'
import { buildKolReport } from '../analysis/kol'
import MemoView from './MemoView'
import './WhatIfPanel.css'

interface Props {
  graph: GraphData
  state: WhatIfState
  setState: (updater: (prev: WhatIfState) => WhatIfState) => void
  onRunComplete?: () => void
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

// Agents used by the simulation = top-6 by KOL influence (matches backend selection).
function previewAgents(graph: GraphData) {
  return buildKolReport(graph, 6).ranked
}

export default function WhatIfPanel({ graph, state, setState, onRunComplete }: Props) {
  const { scenario, rounds, autoStable, running, progress, roundLabel, result, error } = state
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const target = graph.target || 'the target'
  const preview = previewAgents(graph)

  // Rank lookup for result agents (id -> kol rank)
  const rankById = new Map(preview.map((p) => [p.id, p.rank]))

  async function run() {
    if (!scenario.trim() || running) return
    setState((prev) => ({ ...prev, running: true, error: '', result: null, progress: 'Starting simulation...', roundLabel: '' }))
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
          setState((prev) => ({ ...prev, progress: u.message, roundLabel: u.round ? `Round ${u.round}` : prev.roundLabel }))
        },
        (e) => { setState((prev) => ({ ...prev, error: e.message, running: false })) },
        async () => {
          const r = await getSimulateResult(task_id)
          setState((prev) => ({ ...prev, result: r, running: false }))
          if (onRunComplete) onRunComplete()
        },
      )
    } catch (e: any) {
      setState((prev) => ({ ...prev, error: e?.message || 'Simulation failed', running: false }))
    }
  }

  function set(patch: Partial<WhatIfState>) {
    setState((prev) => ({ ...prev, ...patch }))
  }

  return (
    <div className="whatif-panel">
      <h3>What-if Simulation</h3>
      <p className="whatif-sub">
        The top {preview.length} influential entities from your graph (by KOL ranking) become
        persona-grounded agents and react to your scenario over {autoStable ? 'adaptive' : rounds} round(s).
      </p>

      <label className="whatif-label">Who will react (top-K agents)</label>
      <div className="whatif-agents-preview">
        {preview.map((a) => (
          <div key={a.id} className="whatif-agent-card">
            <div className="whatif-agent-card-head">
              <span className="whatif-agent-rank">#{a.rank}</span>
              <span className="whatif-agent-name">{a.name}</span>
              <span className="whatif-agent-type">{a.type}</span>
            </div>
          </div>
        ))}
      </div>

      <label className="whatif-label">Scenario</label>
      <textarea
        className="whatif-textarea"
        value={scenario}
        onChange={(e) => set({ scenario: e.target.value })}
        placeholder={`e.g. What if ${target} is acquired by a competitor?`}
        rows={3}
      />

      <div className="whatif-templates">
        {TEMPLATES(target).map((t, i) => (
          <button key={i} className="whatif-chip" onClick={() => set({ scenario: t })} disabled={running}>
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
                onClick={() => set({ rounds: n, autoStable: false })}
                disabled={running}
              >
                {n}
              </button>
            ))}
            <button
              className={`whatif-round-chip auto ${autoStable ? 'active' : ''}`}
              onClick={() => set({ autoStable: true })}
              disabled={running}
            >
              auto
            </button>
          </div>
        </div>
        <button className="whatif-run" onClick={run} disabled={running || !scenario.trim()}>
          {running ? 'Running…' : (result ? 'Re-run Simulation' : 'Run Simulation')}
        </button>
      </div>

      {running && (
        <div className="whatif-progress">
          <span className="whatif-spinner" /> {progress} {roundLabel && <em>({roundLabel})</em>}
        </div>
      )}
      {error && <div className="whatif-error">{error}</div>}

      {result && <WhatIfResult report={result} rankById={rankById} expanded={expanded} setExpanded={setExpanded} />}
    </div>
  )
}

function WhatIfResult({
  report,
  rankById,
  expanded,
  setExpanded,
}: {
  report: WhatIfReport
  rankById: Map<string, number>
  expanded: Record<string, boolean>
  setExpanded: (u: Record<string, boolean>) => void
}) {
  const r = report.report
  const toggle = (id: string) => setExpanded({ ...expanded, [id]: !expanded[id] })
  const [transcriptOpen, setTranscriptOpen] = useState(true)
  function scrollToAgent(agentName: string) {
    setTranscriptOpen(true)
    setTimeout(() => {
      const all = Array.from(document.querySelectorAll('.whatif-transcript .whatif-statement')) as HTMLElement[]
      const match = all.find((n) => n.querySelector('.whatif-agent-name')?.textContent === agentName)
        || all.find((n) => n.textContent?.includes(agentName))
      match?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      match?.classList.add('whatif-statement-flash')
      setTimeout(() => match?.classList.remove('whatif-statement-flash'), 1200)
    }, 50)
  }
  return (
    <div className="whatif-result">
      <h4>Agents ({report.agents.length})</h4>
      <div className="whatif-agents">
        {report.agents.map((a: AgentPersonaView) => (
          <div key={a.id} className="whatif-agent-row">
            <button className="whatif-agent-toggle" onClick={() => toggle(a.id)}>
              <span className="whatif-agent-rank">#{rankById.get(a.id) ?? '?'}</span>
              <span className="whatif-agent-name">{a.name}</span>
              <span className="whatif-agent-type">{a.type}</span>
              {a.enriched && <span className="whatif-enriched">web</span>}
              <span className="whatif-chevron">{expanded[a.id] ? '▾' : '▸'}</span>
            </button>
            {expanded[a.id] && (
              <div className="whatif-agent-detail">
                <div><strong>Bio:</strong> {a.bio}</div>
                <div><strong>Persona:</strong> {a.persona}</div>
                <div><strong>Influence:</strong> {a.influence_weight.toFixed(2)}</div>
                {a.traits_sourced.length > 0 && (
                  <div><strong>From web:</strong> {a.traits_sourced.join(', ')}</div>
                )}
                {a.inferred.length > 0 && (
                  <div><strong>Inferred:</strong> {a.inferred.join(', ')}</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <MemoView report={report} onSource={(agent) => scrollToAgent(agent)} />

      <div className="whatif-transcript-block">
        <button className="whatif-collapse-toggle" onClick={() => setTranscriptOpen((o) => !o)}>
          <span className="whatif-chevron">{transcriptOpen ? '▾' : '▸'}</span> Transcript ({report.rounds.length} rounds)
        </button>
        {transcriptOpen && (
          <div className="whatif-transcript">
            {report.rounds.map((round) => (
              <div key={round.round} className="whatif-round">
                <div className="whatif-round-head">Round {round.round}</div>
                {round.statements.map((s, i) => (
                  <div key={i} id={`stmt-${round.round}-${s.agent_id}`} className="whatif-statement">
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
        )}
      </div>
    </div>
  )
}
