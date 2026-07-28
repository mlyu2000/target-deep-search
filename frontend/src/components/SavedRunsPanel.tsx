import { useEffect, useState } from 'react'
import type { SavedSimRunSummary, SavedSimRunFull, WhatIfReport } from '../types'
import { listSavedRuns, getSavedRun, deleteSavedRun, exportSavedRun } from '../api/client'
import MemoView from './MemoView'

export default function SavedRunsPanel() {
  const [runs, setRuns] = useState<SavedSimRunSummary[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [full, setFull] = useState<SavedSimRunFull | null>(null)
  const [compare, setCompare] = useState<string[]>([])
  const [fulls, setFulls] = useState<SavedSimRunFull[]>([])
  const [error, setError] = useState('')

  const refresh = async () => {
    try {
      const { runs } = await listSavedRuns()
      setRuns(runs)
    } catch (e: any) {
      setError(e?.message || 'Failed to load saved runs')
    }
  }

  useEffect(() => { refresh() }, [])

  const openDetail = async (id: string) => {
    setSelected(id)
    const f = await getSavedRun(id)
    setFull(f)
  }

  const toggleCompare = async (id: string) => {
    let next = compare.includes(id) ? compare.filter((c) => c !== id) : [...compare, id].slice(-2)
    setCompare(next)
    const data = await Promise.all(next.map((cid) => getSavedRun(cid)))
    setFulls(data)
  }

  const remove = async (id: string) => {
    await deleteSavedRun(id)
    if (selected === id) { setSelected(null); setFull(null) }
    setCompare(compare.filter((c) => c !== id))
    await refresh()
  }

  return (
    <div className="saved-runs">
      <h3>Saved What-if Runs</h3>
      {error && <div className="saved-error">{error}</div>}
      {runs.length === 0 && <p className="saved-empty">No saved runs yet. Run a What-if scenario to populate this list.</p>}

      <div className="saved-layout">
        <div className="saved-list">
          {runs.map((r) => (
            <div key={r.run_id} className={`saved-item ${selected === r.run_id ? 'active' : ''}`}>
              <div className="saved-item-head" onClick={() => openDetail(r.run_id)}>
                <div className="saved-target">{r.target}</div>
                <div className="saved-scenario">{r.scenario}</div>
                <div className="saved-meta">
                  {r.rounds} rounds · {r.agents_count ?? '?'} agents · {r.enriched_count ?? 0}/{r.agents_count ?? '?'} web · {r.created_at?.slice(0, 10)}
                </div>
              </div>
              <div className="saved-item-actions">
                <button onClick={() => toggleCompare(r.run_id)} className={compare.includes(r.run_id) ? 'cmp-on' : ''}>
                  {compare.includes(r.run_id) ? 'Comparing' : 'Compare'}
                </button>
                <button onClick={() => remove(r.run_id)} className="del">Delete</button>
              </div>
            </div>
          ))}
        </div>

        <div className="saved-detail">
          {compare.length === 2 ? (
            <div className="saved-compare">
              <h4>Side-by-side comparison</h4>
              <div className="compare-cols">
                {fulls.map((f, idx) => (
                  <div key={f.run_id} className="compare-col">
                    <div className="compare-title">{f.target}: {f.scenario.slice(0, 60)}…</div>
                    <MemoView report={f.result as WhatIfReport} />
                  </div>
                ))}
              </div>
            </div>
          ) : selected && full ? (
            <div>
              <div className="saved-detail-head">
                <strong>{full.target}</strong> — {full.scenario}
                <button className="saved-export-btn" onClick={() => exportSavedRun(full.run_id)}>Export memo</button>
              </div>
              <MemoView report={full.result as WhatIfReport} />
            </div>
          ) : (
            <p className="saved-hint">Select a run to view its Strategy Memo, or pick two runs to compare.</p>
          )}
        </div>
      </div>
    </div>
  )
}
