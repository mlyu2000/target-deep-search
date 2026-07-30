import { useState } from 'react'
import './AdvancedSettings.css'

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'Web' },
  { value: 'news', label: 'News' },
  { value: 'blogs', label: 'Blogs' },
  { value: 'images', label: 'Images' },
  { value: 'videos', label: 'Video' },
  { value: 'social_media', label: 'Social' },
  { value: 'it', label: 'IT' },
  { value: 'science', label: 'Science' },
  { value: 'files', label: 'Files' },
]

const DEPTH_LABELS: Record<number, string> = {
  1: 'Shallow',
  2: 'Moderate',
  3: 'Deep',
  4: 'Comprehensive',
  5: 'Full network',
}

interface AdvancedSettingsProps {
  depth: number
  onDepthChange: (v: number) => void
  maxPages: number
  onMaxPagesChange: (v: number) => void
  categories: string[]
  onCategoriesChange: (v: string[]) => void
}

export default function AdvancedSettings({
  depth, onDepthChange,
  maxPages, onMaxPagesChange,
  categories, onCategoriesChange,
}: AdvancedSettingsProps) {
  const [open, setOpen] = useState(false)

  const toggleCategory = (val: string) => {
    if (categories.includes(val)) {
      onCategoriesChange(categories.filter(c => c !== val))
    } else {
      onCategoriesChange([...categories, val])
    }
  }

  return (
    <div className="advanced-settings">
      <button
        className="advanced-toggle"
        onClick={() => setOpen(!open)}
        type="button"
      >
        {open ? '▲' : '▼'} Advanced
      </button>

      {open && (
        <div className="advanced-body">
          <div className="advanced-field">
            <label>Depth</label>
            <div className="advanced-depth-row">
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={depth}
                onChange={e => onDepthChange(Number(e.target.value))}
                className="advanced-slider"
              />
              <span className="advanced-depth-value">
                {depth} — {DEPTH_LABELS[depth]}
              </span>
            </div>
          </div>

          <div className="advanced-field">
            <label>Max Pages (per search)</label>
            <input
              type="number"
              min={1}
              max={30}
              value={maxPages}
              onChange={e => onMaxPagesChange(Math.max(1, Math.min(30, Number(e.target.value) || 10)))}
            />
          </div>

          <div className="advanced-field">
            <label>Search Categories</label>
            <div className="advanced-categories">
              {CATEGORY_OPTIONS.map(opt => (
                <label key={opt.value} className="advanced-category-label">
                  <input
                    type="checkbox"
                    checked={categories.includes(opt.value)}
                    onChange={() => toggleCategory(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
