import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { wipeLocalData } from '../lib/session'
import { db } from '../lib/db'
import { syncNow } from '../sync/syncEngine'
import SyncStatus from './SyncStatus'
import InstallButton from './InstallButton'
import ThemeToggle from './ThemeToggle'
import { useLiveQuery } from 'dexie-react-hooks'
import { daysUntil } from '../utils/calculations'
import { SUPPORT_PHONE } from '../lib/config'

const links = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/sell', label: 'Sell', icon: '🛒' },
  { to: '/credit', label: 'Debts', icon: '💳' },
  { to: '/stock', label: 'Stock', icon: '📦' },
  { to: '/products', label: 'Items', icon: '🏷️' },
  { to: '/movement', label: 'Moves', icon: '📈' },
  { to: '/reports', label: 'Reports', icon: '🧾' },
]

export default function Layout({ onLogout }) {
  const paidUntil = useLiveQuery(async () => (await db.meta.get('paid_until'))?.value || null, [], null)
  const daysLeft = paidUntil ? daysUntil(paidUntil) : null
  async function logout() {
    if (!navigator.onLine) {
      alert('Connect to the internet before logging out, otherwise you cannot log back in.')
      return
    }
    await syncNow() // upload anything waiting, before the data is removed
    const pending = await db.syncQueue.count()
    const ok = pending > 0
      ? confirm(`${pending} record(s) are NOT uploaded yet and will be lost if you log out. Log out anyway?`)
      : confirm('Log out?')
    if (!ok) return
    await supabase.auth.signOut()
    await wipeLocalData() // the data is safe in Supabase; this device is now clean
    onLogout()
  }

  return (
    <>
      <header className="app-header">
        <h1>Stock Manager</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <InstallButton />
          <SyncStatus />
          <ThemeToggle />
          <button className="small" style={{ background: 'rgba(255,255,255,.2)' }} onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      {daysLeft !== null && daysLeft <= 5 && (
        <div className="alert amber" style={{ margin: '10px 14px 0' }}>
          <strong>Your access ends {daysLeft <= 0 ? 'today' : `in ${daysLeft} day(s)`}</strong>
          Call {SUPPORT_PHONE} to renew.
        </div>
      )}

      <Outlet />

      <nav className="bottom-nav">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.to === '/'}>
            <span>{l.icon}</span>{l.label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}