import { db, newId, saveRecord } from '../lib/db'
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