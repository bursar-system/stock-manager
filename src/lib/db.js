import Dexie from 'dexie'

export const db = new Dexie('stock_manager')

db.version(1).stores({
  products: 'id, shop_id, name, barcode, category_id, updated_at',
  categories: 'id, shop_id, name',
  suppliers: 'id, shop_id, name',
  sales: 'id, shop_id, created_at',
  sale_items: 'id, sale_id, product_id',
  stock_movements: 'id, product_id, type, created_at',
  syncQueue: '++seq, table, row_id', // changes waiting to upload
  meta: 'key',                       // shop_id, last sync times
})

// Version 2: batches (keep version 1 above as it is)
db.version(2).stores({
  product_batches: 'id, product_id, expiry_date',
  stock_movements: 'id, product_id, batch_id, type, created_at',
})

// Version 3: credit payments + a way to find a sale's stock movements
db.version(3).stores({
  credit_payments: 'id, sale_id, created_at',
  stock_movements: 'id, product_id, batch_id, sale_id, type, created_at',
})

// Order matters: parents must upload before children
export const SYNC_TABLES = [
  'categories',
  'suppliers',
  'products',
  'product_batches',
  'sales',
  'sale_items',
  'credit_payments',
  'stock_movements',
]

// Generates an id on the device (works offline)
export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// Save several rows in ONE all-or-nothing step and queue them for sync.
// entries = [{ table: 'products', record: {...} }, ...]
export async function saveMany(entries) {
  const now = new Date().toISOString()
  await db.transaction('rw', db.tables, async () => {
    for (const { table, record } of entries) {
      const row = { ...record, updated_at: now }
      await db[table].put(row)
      await db.syncQueue.add({ table, row_id: row.id, queued_at: now })
    }
  })
}

export const saveRecord = (table, record) => saveMany([{ table, record }])

// Shop id is stored locally so the app knows its shop while offline
export async function getLocalShopId() {
  return (await db.meta.get('shop_id'))?.value || null
}
export async function setLocalShopId(id) {
  await db.meta.put({ key: 'shop_id', value: id })
}