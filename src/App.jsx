import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './lib/db'
import { supabase } from './lib/supabase'
import { getContext } from './lib/session'
import { startAutoSync } from './sync/syncEngine'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import StockIn from './pages/StockIn'
import NewSale from './pages/NewSale'
import StockMovement from './pages/StockMovement'
import Reports from './pages/Reports'
import Credit from './pages/Credit'
import AdminPanel from './pages/AdminPanel'
import Suspended from './pages/Suspended'
import ResetPassword from './pages/ResetPassword'

// Read once, before Supabase cleans the address bar
const openedFromResetLink = window.location.hash.includes('type=recovery')

export default function App() {
  const [ready, setReady] = useState(false)
  const [shopId, setShopId] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [recovering, setRecovering] = useState(openedFromResetLink)
  const blocked = useLiveQuery(async () => (await db.meta.get('blocked'))?.value || null, [], null)

  // Decide from LOCAL storage, so the app opens even with no internet
  useEffect(() => {
    getContext().then((c) => {
      const admin = c.role === 'admin'
      setIsAdmin(admin)
      setShopId(admin ? null : c.shop_id || null)
      setReady(true)
    })
  }, [])

  // Opened from a "reset password" email link
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!shopId) return
    return startAutoSync()
  }, [shopId])

  if (recovering) return <ResetPassword onDone={() => setRecovering(false)} />
  if (!ready) return <p className="center muted" style={{ marginTop: 60 }}>Loading...</p>
  if (isAdmin) return <AdminPanel onLogout={() => setIsAdmin(false)} />
  if (!shopId) return <Login onLoggedIn={setShopId} onAdminLoggedIn={() => setIsAdmin(true)} />
  if (blocked) return <Suspended reason={blocked} />

  return (
    <Routes>
      <Route element={<Layout onLogout={() => setShopId(null)} />}>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="stock" element={<StockIn />} />
        <Route path="sell" element={<NewSale />} />
        <Route path="movement" element={<StockMovement />} />
        <Route path="reports" element={<Reports />} />
        <Route path="credit" element={<Credit />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}