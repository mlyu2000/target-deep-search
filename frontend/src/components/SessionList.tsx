import type { Session } from '../types'
import './SessionList.css'

interface SessionListProps {
  sessions: Session[]
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return dateStr
  }
}

export default function SessionList({ sessions, onSelect, onDelete }: SessionListProps) {
  return (
    <aside className="session-list">
      <h3 className="session-list-title">Saved</h3>
      {sessions.length === 0 ? (
        <p className="session-list-empty">No saved sessions yet</p>
      ) : (
        <ul className="session-items">
          {sessions.map((s) => (
            <li key={s.id} className="session-item" onClick={() => onSelect(s.id)}>
              <div className="session-item-info">
                <span className="session-item-target">{s.target}</span>
                <span className="session-item-meta">
                  D:{s.depth} · {s.status} · {formatDate(s.created_at)}
                </span>
              </div>
              <button
                className="session-item-delete"
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm('Delete this session?')) onDelete(s.id)
                }}
                title="Delete session"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
