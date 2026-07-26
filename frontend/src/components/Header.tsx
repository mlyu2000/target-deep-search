import { useEffect, useState } from 'react'
import './Header.css'

export default function Header() {
  const [dark, setDark] = useState(() => {
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('theme') : null
      if (saved) return saved === 'dark'
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches
      }
    } catch {
      /* ignore storage/access errors */
    }
    return false
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('theme', dark ? 'dark' : 'light')
      }
    } catch {
      /* ignore storage errors */
    }
  }, [dark])

  return (
    <header className="header">
      <div className="header-content">
        <h1 className="header-title">
          <span className="header-icon">◈</span>
          Target Deep Search
        </h1>
        <button
          className="theme-toggle"
          onClick={() => setDark(!dark)}
          aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {dark ? '☀' : '☾'}
        </button>
      </div>
      <div className="header-accent" />
    </header>
  )
}
