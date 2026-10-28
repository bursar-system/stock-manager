import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { buildStock, buildBatchStock, byExpiry } from '../utils/calculations'

export function useProducts() {
  const products = useLiveQuery(() => db.products.filter((p) => !p.deleted_at).toArray(), [])
  const movements = useLiveQuery(() => db.stock_movements.toArray(), [])
  const batchRows = useLiveQuery(() => db.product_batches.filter((b) => !b.deleted_at).toArray(), [])

  return useMemo(() => {
    if (!products || !movements || !batchRows) return { loading: true, products: [] }

    const stock = buildStock(products, movements)
    const byProduct = new Map()
    for (const b of buildBatchStock(batchRows, movements)) {
      if (!byProduct.has(b.product_id)) byProduct.set(b.product_id, [])
      byProduct.get(b.product_id).push(b)
    }

    const list = stock
      .map((p) => {
        const all = byProduct.get(p.id) || []
        const batches = all.filter((b) => b.remaining > 0).sort(byExpiry)
        const batchedTotal = all.reduce((s, b) => s + b.remaining, 0)
        return {
          ...p,
          batches, // batches still in stock, soonest expiry first
          unbatched: Math.round((p.quantity - batchedTotal) * 1000) / 1000, // older stock with no expiry info
          nextExpiry: batches.find((b) => b.expiry_date)?.expiry_date || null,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    return { loading: false, products: list }
  }, [products, movements, batchRows])
}