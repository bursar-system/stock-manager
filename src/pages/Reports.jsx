import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { money, qty, startOfDay, dayKey } from '../utils/formatters'
import RecentSales from '../components/RecentSales'
import ExportButtons from '../components/ExportButtons'

const PERIODS = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
]

export default function Reports() {
  const [days, setDays] = useState(7)

  const data = useLiveQuery(async () => {
    const since = startOfDay().getTime() - (days - 1) * 86400000
    const sales = (await db.sales.toArray()).filter(
      (s) => !s.deleted_at && new Date(s.created_at).getTime() >= since
    )
    const ids = sales.map((s) => s.id)
    const items = ids.length ? await db.sale_items.where('sale_id').anyOf(ids).toArray() : []
    const prods = await db.products.toArray()
    const names = Object.fromEntries(prods.map((p) => [p.id, p.name]))

    const revenue = sales.reduce((t, s) => t + Number(s.total_amount), 0)
    const profit = items.reduce((t, i) => t + Number(i.quantity) * (Number(i.unit_price) - Number(i.unit_cost)), 0)

    const byMethod = {}
    const byDay = {}
    for (const s of sales) {
      byMethod[s.payment_method] = (byMethod[s.payment_method] || 0) + Number(s.total_amount)
      const k = dayKey(s.created_at)
      byDay[k] = (byDay[k] || 0) + Number(s.total_amount)
    }

    const top = {}
    for (const i of items) {
      top[i.product_id] = top[i.product_id] || { name: names[i.product_id] || 'Deleted product', q: 0, amt: 0 }
      top[i.product_id].q += Number(i.quantity)
      top[i.product_id].amt += Number(i.quantity) * Number(i.unit_price)
    }

    return {
      count: sales.length, revenue, profit, byMethod,
      days: Object.entries(byDay).sort((a, b) => b[0].localeCompare(a[0])),
      top: Object.values(top).sort((a, b) => b.amt - a.amt).slice(0, 8),
    }
  }, [days])

  if (!data) return <div className="page muted">Loading...</div>

  return (
    <div className="page">
      <h2>Reports</h2>
      <div className="tabs">
        {PERIODS.map((p) => (
          <button key={p.days} className={days === p.days ? 'on' : ''} onClick={() => setDays(p.days)}>{p.label}</button>
        ))}
      </div>

      <div className="grid">
        <div className="stat"><div className="label">Total sales</div><div className="value">{money(data.revenue)}</div></div>
        <div className="stat"><div className="label">Estimated profit</div><div className="value">{money(data.profit)}</div></div>
        <div className="stat"><div className="label">Number of sales</div><div className="value">{data.count}</div></div>
        <div className="stat"><div className="label">Sold on credit</div><div className="value">{money(data.byMethod.credit)}</div></div>
      </div>

      <h3>By payment</h3>
      <div className="card">
        {['cash', 'mpesa', 'credit'].map((m) => (
          <div className="item" key={m}>
            <div className="name" style={{ textTransform: 'capitalize' }}>{m}</div>
            <div>{money(data.byMethod[m])}</div>
          </div>
        ))}
      </div>

      <h3>Best sellers</h3>
      <div className="card">
        {data.top.length === 0 && <p className="muted center">No sales in this period.</p>}
        {data.top.map((t) => (
          <div className="item" key={t.name}>
            <div><div className="name">{t.name}</div><div className="sub">{qty(t.q)} sold</div></div>
            <div>{money(t.amt)}</div>
          </div>
        ))}
      </div>

      <RecentSales />

      <ExportButtons />

      {days > 1 && (
        <>
          <h3>Day by day</h3>
          <div className="card">
            {data.days.map(([d, amt]) => (
              <div className="item" key={d}><div>{d}</div><div>{money(amt)}</div></div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}