import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { wipeLocalData } from '../lib/session'
import { listShops, updateShop } from '../services/adminService'
import { money, dateTime, dayKey } from '../utils/formatters'

function effectiveStatus(s) {
  if (s.status === 'suspended') return 'suspended'
  if (s.paid_until && s.paid_until < dayKey(new Date())) return 'expired'
  return 'active'
}
const BADGE = { active: 'ok', expired: 'low', suspended: 'out' }

function lastSeen(iso) {
  if (!iso) return 'never'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'today'
  return days === 1 ? 'yesterday' : `${days} days ago`
}

function ShopCard({ shop, onChanged }) {
  const [open, setOpen] = useState(false)
  const [paid, setPaid] = useState(shop.paid_until || '')
  const [notes, setNotes] = useState(shop.admin_notes || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const eff = effectiveStatus(shop)

  // Adds 30 days to the current paid-until date (or to today if it already passed)
  function addDays() {
    const base = paid && paid > dayKey(new Date()) ? new Date(paid + 'T00:00:00') : new Date()
    base.setDate(base.getDate() + 30)
    setPaid(dayKey(base))
  }

  async function save(status) {
    setBusy(true)
    setErr('')
    try {
      await updateShop(shop.shop_id, { status, paid_until: paid, notes })
      await onChanged()
    } catch (e) {
      setErr(e.message)
    }
    setBusy(false)
  }

  return (
    <div className="card">
      <div className="item" style={{ cursor: 'pointer', border: 0, padding: 0 }} onClick={() => setOpen(!open)}>
        <div>
          <div className="name">{shop.shop_name}</div>
          <div className="sub">{shop.owner_name || 'No name'} · {shop.email}</div>
        </div>
        <span className={`badge ${BADGE[eff]}`}>{eff}</span>
      </div>

      <div className="sub" style={{ marginTop: 8 }}>
        {shop.products} products · {money(shop.sales_30d)} sales (30 days) · active {lastSeen(shop.last_activity)}
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          <div className="sub">
            Joined {dateTime(shop.joined)}
            {shop.last_sign_in_at ? ` · last login ${dateTime(shop.last_sign_in_at)}` : ''}
            {' · '}{shop.total_sales} sales in total
          </div>

          <label>Paid until (empty = no expiry)</label>
          <div className="row">
            <input type="date" value={paid} onChange={(e) => setPaid(e.target.value)} />
            <button type="button" className="secondary" onClick={addDays}>+30 days</button>
          </div>
          <label>Your private notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. pays monthly via M-Pesa" />

          {err && <div className="msg err">{err}</div>}

          <div className="row" style={{ marginTop: 12 }}>
            <button className="secondary" disabled={busy} onClick={() => save(shop.status)}>Save details</button>
            {shop.status === 'active'
              ? <button className="danger" disabled={busy} onClick={() => confirm(`Suspend ${shop.shop_name}?`) && save('suspended')}>Suspend</button>
              : <button disabled={busy} onClick={() => save('active')}>Activate</button>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminPanel({ onLogout }) {
  const [shops, setShops] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  async function load() {
    setError('')
    try {
      setShops(await listShops())
    } catch (e) {
      setError(navigator.onLine ? e.message : 'You are offline. The admin panel needs internet.')
    }
  }
  useEffect(() => { load() }, [])

  async function logout() {
    try { await supabase.auth.signOut() } catch { /* offline: still log out locally */ }
    await wipeLocalData()
    onLogout()
  }

  const counts = useMemo(() => {
    const c = { all: 0, active: 0, expired: 0, suspended: 0 }
    for (const s of shops || []) { c.all++; c[effectiveStatus(s)]++ }
    return c
  }, [shops])

  const s = search.toLowerCase()
  const shown = (shops || []).filter(
    (x) =>
      (filter === 'all' || effectiveStatus(x) === filter) &&
      (x.shop_name.toLowerCase().includes(s) ||
        (x.email || '').toLowerCase().includes(s) ||
        (x.owner_name || '').toLowerCase().includes(s))
  )

  return (
    <>
      <header className="app-header">
        <h1>Stock Manager · Admin</h1>
        <button className="small" style={{ background: 'rgba(255,255,255,.2)' }} onClick={logout}>Logout</button>
      </header>

      <div className="page" style={{ paddingBottom: 30 }}>
        <div className="grid">
          <div className="stat"><div className="label">Total shops</div><div className="value">{counts.all}</div></div>
          <div className="stat"><div className="label">Active</div><div className="value">{counts.active}</div></div>
          <div className="stat"><div className="label">Suspended</div><div className="value">{counts.suspended}</div></div>
          <div className="stat"><div className="label">Payment expired</div><div className="value">{counts.expired}</div></div>
        </div>

        <div className="tabs">
          {['all', 'active', 'expired', 'suspended'].map((f) => (
            <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}
              style={{ textTransform: 'capitalize' }}>{f}</button>
          ))}
          <button onClick={load}>↻ Refresh</button>
        </div>

        <input placeholder="Search shop, owner or email" value={search} onChange={(e) => setSearch(e.target.value)} />

        {error && (
          <div className="msg err">
            {error}{' '}
            {error.includes('Not allowed') && 'This account is not a super admin.'}
          </div>
        )}
        {!shops && !error && <p className="muted center" style={{ marginTop: 20 }}>Loading...</p>}
        {shops && shown.length === 0 && <p className="muted center" style={{ marginTop: 20 }}>No shops found.</p>}

        <div style={{ marginTop: 12 }}>
          {shown.map((x) => <ShopCard key={x.shop_id} shop={x} onChanged={load} />)}
        </div>
      </div>
    </>
  )
}