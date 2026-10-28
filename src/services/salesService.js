import { db, newId, saveMany } from '../lib/db'
import { getContext } from '../lib/session'
import { makeMovement, allocateFefo } from './stockService'

// items = [{ product, quantity, unit_price }]
export async function createSale({ items, payment_method, customer_name }) {
  if (!items.length) throw new Error('Cart is empty')
  if (payment_method === 'credit' && !customer_name?.trim()) {
    throw new Error('Enter the customer name for a credit sale')
  }
  for (const i of items) {
    if (!(Number(i.quantity) > 0)) throw new Error(`Check quantity for ${i.product.name}`)
  }

  const ctx = await getContext()
  const now = new Date().toISOString()
  const saleId = newId()
  const total = Math.round(
    items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0) * 100
  ) / 100

  const entries = [{
    table: 'sales',
    record: {
      id: saleId, shop_id: ctx.shop_id, total_amount: total, payment_method,
      customer_name: customer_name?.trim() || null, note: null,
      created_by: ctx.user_id, created_at: now, deleted_at: null,
    },
  }]

  for (const i of items) {
    const q = Number(i.quantity)
    entries.push({
      table: 'sale_items',
      record: {
        id: newId(), shop_id: ctx.shop_id, sale_id: saleId, product_id: i.product.id,
        quantity: q, unit_price: Number(i.unit_price),
        unit_cost: Number(i.product.buying_price) || 0, created_at: now,
      },
    })
    // Take from the batch that expires first (a sale may span several batches)
    const parts = await allocateFefo(i.product.id, q)
    for (const part of parts) {
      entries.push({
        table: 'stock_movements',
        record: await makeMovement(ctx, {
          product_id: i.product.id, type: 'sale', quantity: -part.quantity,
          unit_cost: Number(i.product.buying_price) || 0, sale_id: saleId,
          batch_id: part.batch_id, created_at: now,
        }),
      })
    }
  }

  await saveMany(entries) // sale + items + stock changes saved together or not at all
  return { saleId, total }
}
// Cancels a sale: marks it cancelled and puts the stock back
// (stock movements are never edited, so we add "return" movements)
export async function cancelSale(saleId) {
  const sale = await db.sales.get(saleId)
  if (!sale) throw new Error('Sale not found')
  if (sale.deleted_at) throw new Error('This sale is already cancelled')

  const payments = await db.credit_payments
    .where('sale_id').equals(saleId).filter((p) => !p.deleted_at).count()
  if (payments > 0) {
    throw new Error('This credit sale already has payments recorded, so it cannot be cancelled.')
  }

  const ctx = await getContext()
  const now = new Date().toISOString()
  const sold = await db.stock_movements
    .where('sale_id').equals(saleId).filter((m) => m.type === 'sale').toArray()

  const entries = [{ table: 'sales', record: { ...sale, deleted_at: now } }]
  for (const m of sold) {
    entries.push({
      table: 'stock_movements',
      record: await makeMovement(ctx, {
        product_id: m.product_id,
        type: 'return',
        quantity: -Number(m.quantity), // sale was negative, so this is positive
        unit_cost: m.unit_cost,
        sale_id: saleId,
        batch_id: m.batch_id,
        note: 'Sale cancelled',
        created_at: now,
      }),
    })
  }
  await saveMany(entries)
}