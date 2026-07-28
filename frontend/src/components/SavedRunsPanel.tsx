import { useEffect, useRef, useState } from 'react'
import type { SavedSimRunSummary, SavedSimRunFull, WhatIfReport } from '../types'
import { listSavedRuns, getSavedRun, deleteSavedRun, exportSavedRun } from '../api/client'
import MemoView from './MemoView'
import CompareMemo from './CompareMemo'

export default function SavedRunsPanel({ onClose, onSelectRun }: { onClose?: () => void; onSelectRun?: (full: SavedSimRunFull) => void }) {
  const [runs, setRuns] = useState<SavedSimRunSummary[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [full, setFull] = useState<SavedSimRunFull | null>(null)
  const [compare, setCompare] = useState<string[]>([])
  const compareRef = useRef<string[]>([])
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
    onSelectRun?.(f)
  }

  const backToList = () => {
    setSelected(null)
    setFull(null)
    compareRef.current = []
    setCompare([])
    setFulls([])
    refresh()
  }

  const toggleCompare = async (id: string) => {
    const next = compareRef.current.includes(id)
      ? compareRef.current.filter((c) => c !== id)
      : [...compareRef.current, id].slice(-2)
    compareRef.current = next
    setCompare(next)
    const data = await Promise.all(next.map((cid) => getSavedRun(cid)))
    setFulls(data)
  }

  const remove = async (id: string) => {
    await deleteSavedRun(id)
    if (selected === id) { setSelected(null); setFull(null) }
    compareRef.current = compareRef.current.filter((c) => c !== id)
    setCompare(compareRef.current)
    await refresh()
  }

  return (
    <div className="saved-runs">
      <div className="saved-header">
        <h3>Saved What-if Runs</h3>
        {onClose && <button className="saved-close" onClick={onClose} aria-label="Close saved runs">✕ Close</button>}
      </div>
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
                <button onClick={() => toggleCompare(r.run_id)} className={`btn-ghost ${compare.includes(r.run_id) ? 'cmp-on' : ''}`}>
                  {compare.includes(r.run_id) ? 'Comparing' : 'Compare'}
                </button>
                <button onClick={() => remove(r.run_id)} className="btn-danger">Delete</button>
              </div>
            </div>
          ))}
        </div>

        <div className="saved-detail">
          {compare.length === 2 && fulls.length === 2 && fulls[0] && fulls[1] ? (
            <div className="saved-compare">
              <div className="saved-subhead">
                <button className="btn-back" onClick={backToList}>← Back to list</button>
                <button className="btn-ghost" onClick={() => { compareRef.current = []; setCompare([]); setFulls([]) }}>Clear compare</button>
              </div>
              <CompareMemo a={fulls[0]} b={fulls[1]} />
            </div>
          ) : selected && full ? (
            <div>
              <div className="saved-subhead">
                <button className="btn-back" onClick={backToList}>← Back to list</button>
                <button className="saved-export-btn" onClick={() => exportSavedRun(full.run_id)}>Export memo</button>
              </div>
              <div className="saved-detail-head">
                <strong>{full.target}</strong> — {full.scenario}
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
