import { useState, useCallback } from 'react'
import './SearchInput.css'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  disabled?: boolean
}

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
  )
}
