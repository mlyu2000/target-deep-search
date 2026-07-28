import { useState, useRef, useEffect } from 'react'
import type { StageInfo } from '../types'
import './ProcessPanel.css'

export interface LogEntry {
  time: string
  text: string
  type: 'info' | 'error'
}

interface ProcessPanelProps {
  stages: StageInfo[]
  message: string
  logs: LogEntry[]
  active: boolean
}

const STAGE_LABELS: Record<string, string> = {
  search: 'Mapping the landscape',
  fetch: 'Gathering sources',
  extract: 'Reading & structuring',
  expand: 'Deepening the map',
  build: 'Assembling the graph',
  done: 'Complete',
}

export default function ProcessPanel({ stages, message, logs, active }: ProcessPanelProps) {
  const [collapsed, setCollapsed] = useState(true)
  const consoleRef = useRef<HTMLDivElement>(null)
  const hasError = logs.some(l => l.type === 'error')
  const errorCount = logs.filter(l => l.type === 'error').length
  const wasActive = useRef(active)

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight
    }
  }, [logs])

  useEffect(() => {
    if (active && !wasActive.current) {
      setCollapsed(false)
    }
    wasActive.current = active
  }, [active])

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight
    }
  }, [logs])

  const activeStages = stages.filter(s => s.name !== 'done')

  return (
    <div className={`process-panel ${collapsed ? 'collapsed' : ''} ${hasError ? 'process-panel-error' : ''}`}>
      <button className="process-toggle" onClick={() => setCollapsed(!collapsed)}>
        <span className="process-toggle-icon">{collapsed ? '▶' : '▼'}</span>
        <span className="process-toggle-label">
          {active ? 'Build Progress' : hasError ? 'Build Failed' : 'Build Log'}
        </span>
        {active && <span className="process-pulse" />}
        {hasError && <span className="process-error-badge">{errorCount}</span>}
      </button>

      {!collapsed && (
        <div className="process-stages">
          {active && <div className="process-message">{message}</div>}

          <div className="process-steps">
            {activeStages.map((s) => (
              <div key={s.name} className={`process-step process-step-${s.status}`}>
                <span className="process-step-indicator">
                  {s.status === 'done' ? '✓' : s.status === 'active' ? '●' : s.status === 'error' ? '✗' : '○'}
                </span>
                <span className="process-step-name">{STAGE_LABELS[s.name] || s.name}</span>
                {s.elapsed != null && (
                  <span className="process-step-time">{s.elapsed.toFixed(1)}s</span>
                )}
              </div>
            ))}
          </div>

          <div className="process-console" ref={consoleRef}>
            {logs.length === 0 && (
              <div className="process-console-empty">Waiting for updates...</div>
            )}
            {logs.map((log, i) => (
              <div key={i} className={`process-console-line process-console-line-${log.type}`}>
                <span className="process-console-time">{log.time}</span>
                <span className="process-console-icon">{log.type === 'error' ? '✗' : '›'}</span>
                <span className="process-console-text">{log.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
