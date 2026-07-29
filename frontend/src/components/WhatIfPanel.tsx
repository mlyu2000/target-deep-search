import { useState, useEffect } from 'react'
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
  memoExpanded?: boolean
  onMemoExpanded?: () => void
  displayResult?: WhatIfReport | null
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

// Short business role of an agent relative to the target (from graph edges).
function roleOf(graph: GraphData, id: string): string {
  const target = graph.target.trim().toLowerCase()
  const tId = graph.nodes.find((n) => n.name.trim().toLowerCase() === target)?.id
  if (!tId) return ''
  const COMPETE = new Set(['competes', 'rivals', 'competitor'])
  const SUPPLY = new Set(['supplies', 'supplier', 'owns', 'uses', 'used_by', 'located_in', 'partnered', 'partner'])
  for (const e of graph.edges) {
    const other = e.source === id ? e.target : e.target === id ? e.source : null
    if (other !== tId) continue
    const t = (e.type || '').toLowerCase()
    if (COMPETE.has(t)) return 'Competitor'
    if (SUPPLY.has(t)) return 'Partner / supply'
  }
  return 'Connected entity'
}

export default function WhatIfPanel({ graph, state, setState, onRunComplete, memoExpanded, onMemoExpanded, displayResult }: Props) {
  const { scenario, rounds, autoStable, fastMode, running, progress, roundLabel, result, error } = state
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [showAdvanced, setShowAdvanced] = useState(false)
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
        fast_mode: fastMode,
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
            <div className="whatif-agent-role">{roleOf(graph, a.id)}</div>
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

      <div className="whatif-advanced">
        <button className="whatif-advanced-toggle" onClick={() => setShowAdvanced((v) => !v)}>
          <span className="whatif-chevron">{showAdvanced ? '▾' : '▸'}</span> Advanced options
        </button>
        {showAdvanced && (
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
            <label className="whatif-fastmode">
              <input
                type="checkbox"
                checked={fastMode}
                onChange={(e) => set({ fastMode: e.target.checked })}
                disabled={running}
              />
              Fast demo mode (skip web enrichment)
            </label>
          </div>
        )}
      </div>

      <button className="whatif-run" onClick={run} disabled={running || !scenario.trim()}>
        {running ? 'Running…' : (result ? 'Re-run Simulation' : 'Run Simulation')}
      </button>

      {running && (
        <div className="whatif-progress">
          <span className="whatif-spinner" /> {progress} {roundLabel && <em>({roundLabel})</em>}
        </div>
      )}
      {error && <div className="whatif-error">{error}</div>}

      {(result || displayResult) && (
        <WhatIfResult
          report={(result || displayResult) as WhatIfReport}
          rankById={rankById}
          expanded={expanded}
          setExpanded={setExpanded}
          memoExpanded={memoExpanded}
          onMemoExpanded={onMemoExpanded}
        />
      )}
    </div>
  )
}

function WhatIfResult({
  report,
  rankById,
  expanded,
  setExpanded,
  memoExpanded,
  onMemoExpanded,
}: {
  report: WhatIfReport
  rankById: Map<string, number>
  expanded: Record<string, boolean>
  setExpanded: (u: Record<string, boolean>) => void
  memoExpanded?: boolean
  onMemoExpanded?: () => void
}) {
  const r = report.report
  const toggle = (id: string) => setExpanded({ ...expanded, [id]: !expanded[id] })
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [execView, setExecView] = useState(false)
  const [memoOpen, setMemoOpen] = useState(memoExpanded ?? false)

  // Auto-open the strategy Memo when a run completes; keep transcript collapsed.
  useEffect(() => {
    if (!report) return
    setMemoOpen(true)
    setTranscriptOpen(false)
    onMemoExpanded?.()
  }, [report.scenario])

  // When the parent forces expansion (e.g. a saved run is selected), open the memo.
  useEffect(() => {
    if (memoExpanded) setMemoOpen(true)
  }, [memoExpanded])

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
      <div className="whatif-result-head">
        <h4>Agents ({report.agents.length})</h4>
        <button className="whatif-view-toggle" onClick={() => setExecView((v) => !v)}>
          {execView ? 'Full memo' : 'Exec view'}
        </button>
      </div>
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

      <div className="whatif-exec-card">
        <span className={`whatif-exec-outcome whatif-outcome-${r.overall_outcome}`}>
          {String(r.overall_outcome).charAt(0).toUpperCase() + String(r.overall_outcome).slice(1)}
        </span>
        <p className="whatif-exec-summary">{r.summary}</p>
        {r.conflict && r.conflict.length > 0 && (
          <div className="whatif-exec-conflict">Key conflict: {r.conflict.join(', ')}</div>
        )}
      </div>

      <div className={`whatif-memo-block ${memoOpen ? 'open' : 'collapsed'}`}>
        <button className="whatif-section-header" onClick={() => setMemoOpen(true)}>
          <span className="whatif-chevron">{memoOpen ? '▾' : '▸'}</span>
          Strategy Memo
          {!memoOpen && <span className="whatif-memo-hint">click to expand</span>}
        </button>
        {memoOpen && <MemoView report={report} onSource={(agent) => scrollToAgent(agent)} compact={execView} />}
      </div>

      {!execView && (
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
      )}
    </div>
  )
}
