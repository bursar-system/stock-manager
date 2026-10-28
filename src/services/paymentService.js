import { db, newId, saveRecord, saveMany } from '../lib/db'
import { getContext } from '../lib/session'

const r2 = (n) => Math.round(n * 100) / 100

// Everyone who still owes money, grouped by customer name
export async function loadCreditGroups() {
  const sales = (await db.sales.toArray()).filter(
    (s) => !s.deleted_at && s.payment_method === 'credit'
  )
  const pays = (await db.credit_payments.toArray()).filter((p) => !p.deleted_at)
  const paid = {}
  for (const p of pays) paid[p.sale_id] = (paid[p.sale_id] || 0) + Number(p.amount)

  const groups = {}
  for (const s of sales) {
    const balance = r2(Number(s.total_amount) - (paid[s.id] || 0))
    if (balance <= 0) continue
    const name = (s.customer_name || 'No name').trim()
    const key = name.toLowerCase()
    if (!groups[key]) groups[key] = { name, total: 0, sales: [] }
    groups[key].total += balance
    groups[key].sales.push({ ...s, balance })
  }

  return Object.values(groups)
    .map((g) => ({
      ...g,
      total: r2(g.total),
      sales: g.sales.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    }))
    .sort((a, b) => b.total - a.total)
}

export async function recordPayment({ sale_id, amount, method, note }) {
  const amt = Number(amount)
  if (!(amt > 0)) throw new Error('Enter an amount greater than 0')

  const sale = await db.sales.get(sale_id)
  if (!sale || sale.deleted_at) throw new Error('Sale not found')

  const pays = await db.credit_payments
    .where('sale_id').equals(sale_id).filter((p) => !p.deleted_at).toArray()
  const paid = pays.reduce((t, p) => t + Number(p.amount), 0)
  const balance = r2(Number(sale.total_amount) - paid)
  if (amt > balance + 0.001) throw new Error(`Only ${balance} is still owed on this sale`)

  const ctx = await getContext()
  await saveRecord('credit_payments', {
    id: newId(),
    shop_id: ctx.shop_id,
    sale_id,
    amount: amt,
    method: method || 'cash',
    note: note || null,
    created_by: ctx.user_id,
    created_at: new Date().toISOString(),
    deleted_at: null,
  })
}
// A customer pays one amount. It clears their oldest debts first.
// sales = the group's sales, oldest first (each has .balance)
export async function payCustomer({ sales, amount, method }) {
  let left = Number(amount)
  if (!(left > 0)) throw new Error('Enter an amount greater than 0')
  const total = r2(sales.reduce((t, s) => t + s.balance, 0))
  if (left > total + 0.001) throw new Error(`This customer only owes ${total}`)

  const ctx = await getContext()
  const now = new Date().toISOString()
  const entries = []
  for (const s of sales) {
    if (left <= 0) break
    const part = r2(Math.min(left, s.balance))
    entries.push({
      table: 'credit_payments',
      record: {
        id: newId(), shop_id: ctx.shop_id, sale_id: s.id, amount: part,
        method: method || 'cash', note: 'Customer payment',
        created_by: ctx.user_id, created_at: now, deleted_at: null,
      },
    })
    left = r2(left - part)
  }
  await saveMany(entries) // all saved together or not at all
}