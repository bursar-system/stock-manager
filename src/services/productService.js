import { db, newId, saveMany } from '../lib/db'
import { getContext } from '../lib/session'
import { makeMovement, findOrCreateBatch } from './stockService'

const clean = (d) => ({
  name: d.name.trim(),
  barcode: d.barcode?.trim() || null,
  unit: d.unit || 'pcs',
  buying_price: Number(d.buying_price) || 0,
  selling_price: Number(d.selling_price) || 0,
  reorder_level: Number(d.reorder_level) || 0,
  
})

async function checkBarcode(barcode, exceptId) {
  if (!barcode) return
  const dup = await db.products
    .where('barcode').equals(barcode)
    .filter((p) => !p.deleted_at && p.id !== exceptId)
    .first()
  if (dup) throw new Error(`Barcode already used by "${dup.name}"`)
}

// Finds a category by name or creates it
async function resolveCategory(ctx, name) {
  const n = name?.trim()
  if (!n) return { id: null, entries: [] }
  const existing = await db.categories
    .filter((c) => !c.deleted_at && c.name.toLowerCase() === n.toLowerCase())
    .first()
  if (existing) return { id: existing.id, entries: [] }
  const id = newId()
  return {
    id,
    entries: [{
      table: 'categories',
      record: { id, shop_id: ctx.shop_id, name: n, created_at: new Date().toISOString(), deleted_at: null },
    }],
  }
}

export async function addProduct(data, openingQty = 0) {
  if (!data.name?.trim()) throw new Error('Product name is required')
  const ctx = await getContext()
  const fields = clean(data)
  await checkBarcode(fields.barcode)

  const cat = await resolveCategory(ctx, data.category_name)
  const id = newId()
  const entries = [
    ...cat.entries,
    {
      table: 'products',
      record: {
        id, shop_id: ctx.shop_id, category_id: cat.id, supplier_id: null,
        ...fields, created_at: new Date().toISOString(), deleted_at: null,
      },
    },
  ]
  if (Number(openingQty) > 0) {
    const batch = await findOrCreateBatch(ctx, id, data.expiry_date, fields.buying_price)
    entries.push(...batch.entries)
    entries.push({
      table: 'stock_movements',
      record: await makeMovement(ctx, {
        product_id: id, type: 'stock_in', quantity: Number(openingQty),
        unit_cost: fields.buying_price, batch_id: batch.id, note: 'Opening stock',
      }),
    })
  }
  await saveMany(entries)
  return id
}

export async function updateProduct(id, data) {
  if (!data.name?.trim()) throw new Error('Product name is required')
  const ctx = await getContext()
  const old = await db.products.get(id)
  const fields = clean(data)
  await checkBarcode(fields.barcode, id)
  const cat = await resolveCategory(ctx, data.category_name)
  await saveMany([
    ...cat.entries,
    { table: 'products', record: { ...old, ...fields, category_id: cat.id } },
  ])
}

// "Delete" = mark as deleted, so it syncs properly and history stays intact
export async function deleteProduct(id) {
  const old = await db.products.get(id)
  await saveMany([
    { table: 'products', record: { ...old, deleted_at: new Date().toISOString() } },
  ])
}