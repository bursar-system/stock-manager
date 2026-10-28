import { startOfDay } from './formatters'

const DAY = 86400000

// Turns products + movements into products with live stock info
export function buildStock(products, movements) {
  const since = Date.now() - 30 * DAY
  const map = new Map()
  for (const p of products) map.set(p.id, { quantity: 0, sold30d: 0, lastSale: null })

  for (const m of movements) {
    const e = map.get(m.product_id)
    if (!e) continue
    e.quantity += Number(m.quantity)
    if (m.type === 'sale') {
      const t = new Date(m.created_at).getTime()
      if (t >= since) e.sold30d += -Number(m.quantity)
      if (!e.lastSale || t > e.lastSale) e.lastSale = t
    }
  }

  return products.map((p) => {
    const e = map.get(p.id)
    const reorder = Number(p.reorder_level) || 0
    return {
      ...p,
      quantity: e.quantity,
      sold30d: e.sold30d,
      lastSale: e.lastSale,
      daysLeft: e.sold30d > 0 && e.quantity > 0 ? e.quantity / (e.sold30d / 30) : null,
      status: e.quantity <= 0 ? 'out' : e.quantity <= reorder ? 'low' : 'ok',
    }
  })
}

export function daysUntil(dateStr) {
  return Math.round(
    (new Date(dateStr + 'T00:00:00').getTime() - startOfDay().getTime()) / DAY
  )
}

// Remaining quantity of every batch = sum of the movements that point to it
export function buildBatchStock(batches, movements) {
  const used = new Map()
  for (const m of movements) {
    if (m.batch_id) used.set(m.batch_id, (used.get(m.batch_id) || 0) + Number(m.quantity))
  }
  return batches
    .filter((b) => !b.deleted_at)
    .map((b) => ({ ...b, remaining: Math.round((used.get(b.id) || 0) * 1000) / 1000 }))
}

// Earliest expiry first; batches with no expiry go last
export function byExpiry(a, b) {
  if (!a.expiry_date && !b.expiry_date) return new Date(a.created_at) - new Date(b.created_at)
  if (!a.expiry_date) return 1
  if (!b.expiry_date) return -1
  return a.expiry_date.localeCompare(b.expiry_date)
}