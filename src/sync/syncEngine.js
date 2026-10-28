import { supabase } from '../lib/supabase'
import { db, SYNC_TABLES } from '../lib/db'

let running = false

async function pushChanges() {
  const queue = await db.syncQueue.orderBy('seq').toArray()
  if (!queue.length) return

  for (const table of SYNC_TABLES) {
    const entries = queue.filter((q) => q.table === table)
    if (!entries.length) continue

    const ids = [...new Set(entries.map((e) => e.row_id))]
    const rows = (await db[table].bulkGet(ids)).filter(Boolean)

    if (rows.length) {
      // Movements are append-only, so never try to update an existing one
      const options =
        table === 'stock_movements'
          ? { onConflict: 'id', ignoreDuplicates: true }
          : { onConflict: 'id' }

      const { error } = await supabase.from(table).upsert(rows, options)
      if (error) throw new Error(`Push ${table}: ${error.message}`)
    }

    await db.syncQueue.bulkDelete(entries.map((e) => e.seq))
  }
}

async function pullChanges() {
  const PAGE = 1000

  for (const table of SYNC_TABLES) {
    const metaKey = `last_pull_${table}`
    const last = (await db.meta.get(metaKey))?.value || '1970-01-01T00:00:00Z'
    let newest = last
    let from = 0

    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .gt('updated_at', last)
        .order('updated_at', { ascending: true })
        .range(from, from + PAGE - 1)

      if (error) throw new Error(`Pull ${table}: ${error.message}`)
      if (!data.length) break

      const pending = new Set(
        (await db.syncQueue.where('table').equals(table).toArray()).map((q) => q.row_id)
      )
      await db[table].bulkPut(data.filter((r) => !pending.has(r.id)))

      newest = data[data.length - 1].updated_at
      if (data.length < PAGE) break
      from += PAGE
    }

    await db.meta.put({ key: metaKey, value: newest })
  }
}

// Asks Supabase if this shop is still allowed to use the app.
// Saves the answer on the device so the app can react even when offline.
async function checkAccount(shopId) {
  const { data, error } = await supabase
    .from('shops').select('status, paid_until').eq('id', shopId).maybeSingle()
  if (error || !data) return null // could not find out: change nothing

  const today = new Date().toISOString().slice(0, 10)
  let reason = null
  if (data.status === 'suspended') reason = 'suspended'
  else if (data.paid_until && data.paid_until < today) reason = 'expired'

  if (reason) await db.meta.put({ key: 'blocked', value: reason })
  else await db.meta.delete('blocked')
  await db.meta.put({ key: 'paid_until', value: data.paid_until || null })
  return reason
}

export async function syncNow() {
  if (running || !navigator.onLine) return { ok: false, reason: 'busy-or-offline' }
  running = true
  try {
    const { data } = await supabase.auth.getSession()
    if (!data.session) return { ok: false, reason: 'not-logged-in' }

    const shopId = (await db.meta.get('shop_id'))?.value
    if (shopId) {
      const blocked = await checkAccount(shopId)
      if (blocked) return { ok: false, reason: blocked }
    }

    await pushChanges()
    await pullChanges()
    await db.meta.put({ key: 'last_sync', value: new Date().toISOString() })
    return { ok: true }
  } catch (err) {
    console.error('Sync failed:', err)
    return { ok: false, error: err.message }
  } finally {
    running = false
  }
}

// Call once when the app starts. Returns a cleanup function.
export function startAutoSync() {
  const run = () => syncNow()
  window.addEventListener('online', run)
  const timer = setInterval(run, 30000)
  run()
  return () => {
    window.removeEventListener('online', run)
    clearInterval(timer)
  }
}