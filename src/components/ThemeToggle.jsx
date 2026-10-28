import { useState } from 'react'
import { currentTheme, setTheme } from '../utils/theme'

export default function ThemeToggle() {
  const [theme, setT] = useState(currentTheme())

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setT(next)
  }

  return (
    <button
      type="button"
      className="small"
      style={{ background: 'rgba(255,255,255,.2)' }}
      onClick={toggle}
      aria-label="Switch light or dark mode"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}