import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ResetPassword({ onDone }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (pw !== pw2) return setError('The two passwords do not match')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }
    window.history.replaceState(null, '', window.location.pathname)
    alert('Password changed. Log in with your new password.')
    onDone()
  }

  return (
    <div className="login">
      <h2 className="center">📦 Stock Manager</h2>
      <form className="card" onSubmit={submit} autoComplete="off">
        <h3 style={{ marginTop: 0 }}>Choose a new password</h3>
        <label>New password (6+ characters)</label>
        <input type="password" autoComplete="new-password" minLength={6} value={pw}
          onChange={(e) => setPw(e.target.value)} required />
        <label>Type it again</label>
        <input type="password" autoComplete="new-password" minLength={6} value={pw2}
          onChange={(e) => setPw2(e.target.value)} required />
        {error && <div className="msg err">{error}</div>}
        <button className="full" disabled={busy}>{busy ? 'Saving...' : 'Save new password'}</button>
      </form>
    </div>
  )
}