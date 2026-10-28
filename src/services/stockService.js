import { db, newId, saveMany } from '../lib/db'
import { getContext } from '../lib/session'
import { buildBatchStock, byExpiry, daysUntil } from '../utils/calculations'

const r3 = (n) => Math.round(n * 1000) / 1000

export async function makeMovement(ctx, {
  product_id, type, quantity, unit_cost = null, sale_id = null,
  batch_id = null, note = null, created_at,
}) {
  return {
    id: newId(),
    shop_id: ctx.shop_id,
    product_id,
    batch_id,
    type,
    quantity,
    unit_cost,
    sale_id,
    note: note || null,
    created_by: ctx.user_id,
    created_at: created_at || new Date().toISOString(),
  }
}

// Same expiry date for the same product = same batch. New date = new batch.
export async function findOrCreateBatch(ctx, product_id, expiry_date, unit_cost = null) {
  const exp = expiry_date || null
  const existing = await db.product_batches
    .where('product_id').equals(product_id)
    .filter((b) => !b.deleted_at && (b.expiry_date || null) === exp)
    .first()
  if (existing) return { id: existing.id, entries: [] }

  const id = newId()
  return {
    id,
    entries: [{
      table: 'product_batches',
      record: {
        id, shop_id: ctx.shop_id, product_id, expiry_date: exp,
        unit_cost, created_at: new Date().toISOString(), deleted_at: null,
      },
    }],
  }
}

async function loadBatches(product_id) {
  const [batches, moves] = await Promise.all([
    db.product_batches.where('product_id').equals(product_id).filter((b) => !b.deleted_at).toArray(),
    db.stock_movements.where('product_id').equals(product_id).toArray(),
  ])
  return buildBatchStock(batches, moves)
}

// Selling order: batches that expire soonest first, then no-expiry, expired ones last
function allocOrder(a, b) {
  const rank = (x) => (!x.expiry_date ? 1 : daysUntil(x.expiry_date) < 0 ? 2 : 0)
  return rank(a) - rank(b) || byExpiry(a, b)
}

// Splits a quantity across batches. Returns [{ batch_id, quantity }]
export async function allocateFefo(product_id, quantity) {
  const list = (await loadBatches(product_id)).filter((b) => b.remaining > 0).sort(allocOrder)
  let left = Number(quantity)
  const parts = []
  for (const b of list) {
    if (left <= 0) break
    const take = Math.min(left, b.remaining)
    parts.push({ batch_id: b.id, quantity: r3(take) })
    left = r3(left - take)
  }
  // Anything beyond the batches (older stock with no batch, or overselling)
  if (left > 0) parts.push({ batch_id: null, quantity: left })
  return parts
}

// Stock received from a supplier
export async function addStock({ product_id, quantity, unit_cost, note, updateBuyingPrice, expiry_date }) {
  const q = Number(quantity)
  if (!(q > 0)) throw new Error('Enter a quantity greater than 0')
  const ctx = await getContext()
  const cost = unit_cost === '' || unit_cost == null ? null : Number(unit_cost)

  const batch = await findOrCreateBatch(ctx, product_id, expiry_date, cost)
  const entries = [
    ...batch.entries,
    {
      table: 'stock_movements',
      record: await makeMovement(ctx, {
        product_id, type: 'stock_in', quantity: q, unit_cost: cost,
        batch_id: batch.id, note,
      }),
    },
  ]
  if (updateBuyingPrice && cost !== null) {
    const p = await db.products.get(product_id)
    entries.push({ table: 'products', record: { ...p, buying_price: cost } })
  }
  await saveMany(entries)
}

// Damaged or expired goods (removes stock). batch_id optional.
export async function recordLoss({ product_id, quantity, type, note, batch_id }) {
  const q = Number(quantity)
  if (!(q > 0)) throw new Error('Enter a quantity greater than 0')
  const ctx = await getContext()

  let parts
  if (batch_id) {
    const b = (await loadBatches(product_id)).find((x) => x.id === batch_id)
    if (!b) throw new Error('Batch not found')
    if (q > b.remaining) throw new Error(`That batch only has ${r3(b.remaining)} left`)
    parts = [{ batch_id, quantity: q }]
  } else {
    parts = await allocateFefo(product_id, q)
  }

  const entries = []
  for (const part of parts) {
    entries.push({
      table: 'stock_movements',
      record: await makeMovement(ctx, {
        product_id, type, quantity: -part.quantity, batch_id: part.batch_id, note,
      }),
    })
  }
  await saveMany(entries)
}

// Physical stock count: records the difference as an adjustment
export async function adjustToCount({ product_id, currentQty, countedQty, note }) {
  const diff = r3(Number(countedQty) - Number(currentQty))
  if (Number.isNaN(diff)) throw new Error('Enter the counted quantity')
  if (diff === 0) return { changed: false }
  const ctx = await getContext()

  // Missing stock comes off the earliest-expiry batches. Extra stock is added
  // without a batch (use Stock in if you know its expiry date).
  const parts = diff < 0
    ? await allocateFefo(product_id, -diff)
    : [{ batch_id: null, quantity: diff }]

  const entries = []
  for (const part of parts) {
    entries.push({
      table: 'stock_movements',
      record: await makeMovement(ctx, {
        product_id, type: 'adjustment',
        quantity: diff < 0 ? -part.quantity : part.quantity,
        batch_id: part.batch_id, note: note || 'Stock count',
      }),
    })
  }
  await saveMany(entries)
  return { changed: true, diff }
}