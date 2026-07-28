import { useState, useCallback } from 'react'
import './SearchInput.css'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  disabled?: boolean
}

const EXAMPLES = ['Nvidia', 'OpenAI', 'Sam Altman']

export default function SearchInput({ value, onChange, onSubmit, disabled }: SearchInputProps) {
  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (trimmed && !disabled) {
      onSubmit(trimmed)
    }
  }, [value, disabled, onSubmit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSubmit()
    },
    [handleSubmit],
  )

  return (
    <div className="search-input-container">
      <div className="search-input-row">
        <input
          className="search-input"
          type="text"
          placeholder="Enter a person, company, or concept..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          maxLength={200}
        />
        <button
          className="search-button"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
        >
          Search
        </button>
      </div>
      <div className="search-examples">
        <span className="search-examples-label">Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            className="search-example-chip"
            onClick={() => { onChange(ex); onSubmit(ex) }}
            disabled={disabled}
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  )
}
