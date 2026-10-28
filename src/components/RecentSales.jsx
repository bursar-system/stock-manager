import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { cancelSale } from '../services/salesService'
import { money, qty, dateTime } from '../utils/formatters'

export default function RecentSales() {
  const [msg, setMsg] = useState(null)

  const sales = useLiveQuery(async () => {
    const all = await db.sales.toArray()
    all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const recent = all.slice(0, 30)
    const ids = recent.map((s) => s.id)
    const items = ids.length ? await db.sale_items.where('sale_id').anyOf(ids).toArray() : []
    const prods = await db.products.toArray()
    const names = Object.fromEntries(prods.map((p) => [p.id, p.name]))
    return recent.map((s) => ({
      ...s,
      lines: items
        .filter((i) => i.sale_id === s.id)
        .map((i) => `${qty(i.quantity)} × ${names[i.product_id] || 'Deleted product'}`),
    }))
  }, [], [])

  async function cancel(s) {
    if (!confirm(`Cancel this sale of ${money(s.total_amount)}? The stock will be put back.`)) return
    setMsg(null)
    try {
      await cancelSale(s.id)
      setMsg({ ok: true, text: 'Sale cancelled and stock returned.' })
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    }
  }

  return (
    <>
      <h3>Recent sales</h3>
      {msg && <div className={`msg ${msg.ok ? 'ok' : 'err'}`} style={{ marginBottom: 10 }}>{msg.text}</div>}
      <div className="card">
        {sales.length === 0 && <p className="muted center">No sales yet.</p>}
        {sales.map((s) => (
          <div className="item" key={s.id} style={{ opacity: s.deleted_at ? 0.55 : 1 }}>
            <div>
              <div className="name" style={{ textDecoration: s.deleted_at ? 'line-through' : 'none' }}>
                {money(s.total_amount)}
                {s.payment_method !== 'cash' ? ` · ${s.payment_method}` : ''}
                {s.customer_name ? ` · ${s.customer_name}` : ''}
              </div>
              <div className="sub">{dateTime(s.created_at)} · {s.lines.join(', ')}</div>
            </div>
            {s.deleted_at
              ? <span className="badge out">Cancelled</span>
              : <button className="small danger" onClick={() => cancel(s)}>Cancel</button>}
          </div>
        ))}
      </div>
    </>
  )
}