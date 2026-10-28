import { useState } from 'react'
import { syncNow } from '../sync/syncEngine'
import { SUPPORT_NAME, SUPPORT_PHONE } from '../lib/config'

export default function Suspended({ reason }) {
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function recheck() {
    setMsg('')
    if (!navigator.onLine) return setMsg('Connect to the internet first.')
    setBusy(true)
    const r = await syncNow()
    setBusy(false)
    if (r.reason === 'suspended' || r.reason === 'expired') {
      setMsg('Your account is still not active.')
    }
  }

  return (
    <div className="login">
      <h2 className="center">📦 Stock Manager</h2>
      <div className="card center">
        <h3 style={{ textTransform: 'none', fontSize: 18, color: 'var(--text)' }}>
          {reason === 'expired' ? 'Your access has ended' : 'Your account is suspended'}
        </h3>
        <p className="muted">
          {reason === 'expired'
            ? 'Your trial or payment period is over.'
            : 'Please contact support to get it reactivated.'}
          {' '}Your records are safe on this phone and in the cloud.
        </p>
        <p><b>{SUPPORT_NAME}</b></p>
        <a href={`tel:${SUPPORT_PHONE}`}>
          <button className="full">📞 Call {SUPPORT_PHONE}</button>
        </a>
        <button className="secondary full" onClick={recheck} disabled={busy}>
          {busy ? 'Checking...' : 'I have been reactivated, check again'}
        </button>
        {msg && <div className="msg err">{msg}</div>}
      </div>
    </div>
  )
}