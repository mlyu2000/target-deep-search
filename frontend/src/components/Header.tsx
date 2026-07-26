import { useEffect, useState } from 'react'
import './Header.css'

export default function Header() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches }
    catch { return false }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('theme', dark ? 'dark' : 'light')
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
