import { useEffect, useState } from 'react'

// Captured at module level so the browser event isn't missed before the button mounts
let deferred = null
const listeners = new Set()
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e
  listeners.forEach((f) => f())
})
window.addEventListener('appinstalled', () => {
  deferred = null
  listeners.forEach((f) => f())
})

export default function InstallButton() {
  const [, force] = useState(0)

  useEffect(() => {
    const f = () => force((n) => n + 1)
    listeners.add(f)
    return () => listeners.delete(f)
  }, [])

  const standalone = window.matchMedia('(display-mode: standalone)').matches
  if (standalone || !deferred) return null

  async function install() {
    deferred.prompt()
    await deferred.userChoice
    deferred = null
    force((n) => n + 1)
  }

  return <button className="small secondary" onClick={install}>⬇ Install app</button>
}