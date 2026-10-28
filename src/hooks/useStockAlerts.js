import { useMemo } from 'react'
import { useProducts } from './useProducts'
import { daysUntil } from '../utils/calculations'
import { EXPIRY_WARN_DAYS } from '../lib/config'

const DAY = 86400000

function whenText(days) {
  if (days < 0) return `expired ${-days} day(s) ago`
  if (days === 0) return 'expires today'
  return `expires in ${days} day(s)`
}

export function useStockAlerts() {
  const { products, loading } = useProducts()

  return useMemo(() => {
    const outOfStock = products.filter((p) => p.status === 'out')
    const lowStock = products.filter((p) => p.status === 'low')
    const runningOut = products
      .filter((p) => p.daysLeft !== null && p.daysLeft <= 7)
      .sort((a, b) => a.daysLeft - b.daysLeft)

    // One alert per BATCH that is expired or expires within 14 days
    const expiring = []
    for (const p of products) {
      for (const b of p.batches) {
        if (!b.expiry_date) continue
        const days = daysUntil(b.expiry_date)
        if (days <= EXPIRY_WARN_DAYS) {
          expiring.push({
            id: b.id, name: p.name, unit: p.unit, remaining: b.remaining,
            expiry_date: b.expiry_date, days, when: whenText(days),
          })
        }
      }
    }
    expiring.sort((a, b) => a.days - b.days)
    const expiredBatches = expiring.filter((b) => b.days < 0)
    const expiringSoon = expiring.filter((b) => b.days >= 0)

    const fastMovers = products
      .filter((p) => p.sold30d > 0)
      .sort((a, b) => b.sold30d - a.sold30d)
      .slice(0, 5)
    const slowMovers = products.filter(
      (p) =>
        p.quantity > 0 &&
        p.sold30d === 0 &&
        Date.now() - new Date(p.created_at).getTime() > 30 * DAY
    )
    const stockValue = products.reduce(
      (s, p) => s + Math.max(p.quantity, 0) * Number(p.buying_price), 0
    )
    return { loading, products, outOfStock, lowStock, runningOut, expiring, expiredBatches, expiringSoon, fastMovers, slowMovers, stockValue }
  }, [products, loading])
}