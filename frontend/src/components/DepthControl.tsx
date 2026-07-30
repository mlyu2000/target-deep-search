import './DepthControl.css'

interface DepthControlProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}

const DEPTH_LABELS: Record<number, string> = {
  1: 'Shallow',
  2: 'Moderate',
  3: 'Deep',
  4: 'Comprehensive',
  5: 'Full network',
}

export default function DepthControl({ value, onChange, disabled }: DepthControlProps) {
  return (
    <div className="depth-control">
      <label className="depth-label">
        Depth: <strong>{value}</strong> — {DEPTH_LABELS[value] || 'Deep'}
      </label>
      <div className="depth-slider-container">
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="depth-slider"
        />
        <div className="depth-marks">
          {Array.from({ length: 5 }, (_, i) => i + 1).map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
