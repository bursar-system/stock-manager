import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { setContext, prepareDeviceFor } from '../lib/session'
import { syncNow } from '../sync/syncEngine'
import InstallButton from '../components/InstallButton'
import ThemeToggle from '../components/ThemeToggle'

export default function Login({ onLoggedIn, onAdminLoggedIn }) {
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ email: '', password: '', shop_name: '', full_name: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function forgot() {
    setError('')
    setInfo('')
    if (!f.email) return setError('Type your email above first')
    if (!navigator.onLine) return setError('You need internet to reset your password.')
    const { error } = await supabase.auth.resetPasswordForEmail(f.email, {
      redirectTo: window.location.origin,
    })
    if (error) return setError(error.message)
    setInfo('If that email has an account, a reset link has been sent. Check your inbox.')
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!navigator.onLine) return setError('You need internet to log in the first time.')
    setBusy(true)
    try {
      let result
      if (mode === 'signup') {
        result = await supabase.auth.signUp({
          email: f.email,
          password: f.password,
          options: { data: { shop_name: f.shop_name || 'My Shop', full_name: f.full_name } },
        })
      } else {
        result = await supabase.auth.signInWithPassword({ email: f.email, password: f.password })
      }
      if (result.error) throw result.error

      const user = result.data.user
      if (!result.data.session) {
        throw new Error('Check your email to confirm your account, then log in.')
      }

                  // Make sure this device holds only THIS user's data
      await prepareDeviceFor(user.id)

      // Super admin? Open the admin panel instead of a shop
      // Start the shop lookup at the same time as the admin check
      const profilePromise = supabase.from('profiles').select('shop_id').eq('id', user.id).single()
      const { data: isAdmin, error: adminErr } = await supabase.rpc('is_super_admin')
      if (adminErr) throw new Error('Admin check failed: ' + adminErr.message)
      if (isAdmin === true) {
        
        await setContext(null, user.id, 'admin')
        onAdminLoggedIn()
        return
      }

      const { data: profile, error: pErr } = await profilePromise
      if (pErr || !profile?.shop_id) throw new Error('Could not load your shop. Try again.')



      await setContext(profile.shop_id, user.id)
      onLoggedIn(profile.shop_id)
      syncNow()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <h2 className="center">📦 Stock Manager</h2>
      <div className="center" style={{ marginBottom: 10, display: 'flex', gap: 8, justifyContent: 'center' }}>
        <InstallButton />
        <ThemeToggle />
      </div>
            <form className="card" onSubmit={submit} autoComplete="off">
        <div className="tabs">
          <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>Log in</button>
          <button type="button" className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>Create account</button>
        </div>

        {mode === 'signup' && (
          <>
            <label>Shop name</label>
            <input value={f.shop_name} onChange={set('shop_name')} required />
            <label>Your name</label>
            <input value={f.full_name} onChange={set('full_name')} />
          </>
        )}

        <label>Email</label>
                <input type="email" name="stock-login-id" autoComplete="off" value={f.email} onChange={set('email')} required />
        <label>Password (6+ characters)</label>
                <input type="password" name="stock-login-key" autoComplete="new-password" minLength={6} value={f.password} onChange={set('password')} required />

        {error && <div className="msg err">{error}</div>}
        {info && <div className="msg ok">{info}</div>}
        <button className="full" disabled={busy}>
          {busy ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
        {mode === 'login' && (
          <button type="button" className="secondary small full" onClick={forgot}>Forgot password?</button>
        )}
        <p className="muted center">Internet is needed only for this step. After that the app works offline.</p>
      </form>
    </div>
  )
}