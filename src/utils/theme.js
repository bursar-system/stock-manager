const KEY = 'theme'
const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches

function saved() {
  try { return localStorage.getItem(KEY) } catch { return null }
}

export function currentTheme() {
  const s = saved()
  if (s === 'dark' || s === 'light') return s
  return systemDark() ? 'dark' : 'light'
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = theme === 'dark' ? '#0b3b37' : '#0f766e'
}

export function setTheme(theme) {
  try { localStorage.setItem(KEY, theme) } catch { /* ignore */ }
  applyTheme(theme)
}

// Call once at startup. Follows the phone's setting until the user picks one.
export function initTheme() {
  applyTheme(currentTheme())
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!saved()) applyTheme(systemDark() ? 'dark' : 'light')
  })
}