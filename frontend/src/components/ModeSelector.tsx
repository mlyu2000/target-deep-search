import type { AnalyzerMode } from '../types'
import './ModeSelector.css'

interface ModeSelectorProps {
  mode: AnalyzerMode
  onChange: (mode: AnalyzerMode) => void
  disabled?: boolean
}

const MODES: { value: AnalyzerMode; label: string; desc: string }[] = [
  { value: 'graph', label: 'Graph', desc: 'Relationship graph' },
  { value: 'competitive', label: 'Competitive', desc: 'Competitors, acquisitions, execs' },
  { value: 'supplychain', label: 'Supply Chain', desc: 'Suppliers, tiers, risks' },
]

export default function ModeSelector({ mode, onChange, disabled }: ModeSelectorProps) {
  return (
    <div className="mode-selector">
      {MODES.map((m) => (
        <button
          key={m.value}
          className={`mode-btn ${mode === m.value ? 'mode-btn-active' : ''}`}
          onClick={() => onChange(m.value)}
          disabled={disabled}
          title={m.desc}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
