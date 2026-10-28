import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { useStockAlerts } from '../hooks/useStockAlerts'
import { Link } from 'react-router-dom'
import AlertBanner from '../components/AlertBanner'
import { loadCreditGroups } from '../services/paymentService'
import { money, qtyUnit, qty, startOfDay } from '../utils/formatters'

export default function Dashboard() {
  const a = useStockAlerts()

  const today = useLiveQuery(async () => {
    const start = startOfDay().getTime()
    const all = await db.sales.toArray()
    const t = all.filter((s) => !s.deleted_at && new Date(s.created_at).getTime() >= start)
    return { count: t.length, total: t.reduce((s, x) => s + Number(x.total_amount), 0) }
  }, [], { count: 0, total: 0 })

  const owed = useLiveQuery(loadCreditGroups, [], [])
  const owedTotal = owed.reduce((t, g) => t + g.total, 0)

  if (a.loading) return <div className="page muted">Loading...</div>

  const label = (p, extra) => ({ id: p.id, label: `${p.name}: ${extra}` })

  return (
    <div className="page">
      <h2>Today</h2>

      <div className="grid">
        <div className="stat"><div className="label">Sales today</div><div className="value">{money(today.total)}</div></div>
        <div className="stat"><div className="label">Number of sales</div><div className="value">{today.count}</div></div>
        <div className="stat"><div className="label">Products</div><div className="value">{a.products.length}</div></div>
        <div className="stat"><div className="label">Stock value (cost)</div><div className="value">{money(a.stockValue)}</div></div>
      </div>

      {owedTotal > 0 && (
        <Link to="/credit" style={{ textDecoration: 'none' }}>
          <div className="alert amber">
            <strong>Customers owe you {money(owedTotal)}</strong>
            {owed.length} customer(s). Tap to see who and record payments.
          </div>
        </Link>
      )}

      {a.products.length === 0 && (
        <div className="alert blue"><strong>Welcome!</strong>Start by adding your products on the Items tab.</div>
      )}

      <AlertBanner tone="red" title="Out of stock"
        items={a.outOfStock.map((p) => ({ id: p.id, label: p.name }))} />
      <AlertBanner tone="amber" title="Running low"
        items={a.lowStock.map((p) => label(p, `${qtyUnit(p.quantity, p.unit)} left`))} />
      <AlertBanner tone="amber" title="Will run out within a week"
        items={a.runningOut.map((p) => label(p, `about ${Math.max(1, Math.round(p.daysLeft))} day(s) left`))} />
      <AlertBanner tone="red" title="Expiring soon or expired"
        items={a.expiring.map((b) => ({
          id: b.id,
          label: `${b.name}: ${qtyUnit(b.remaining, b.unit)} ${b.when}`,
        }))} />

      {a.fastMovers.length > 0 && (
        <>
          <h3>Fast movers (30 days)</h3>
          <div className="card">
            {a.fastMovers.map((p) => (
              <div className="item" key={p.id}>
                <div><div className="name">{p.name}</div><div className="sub">{qtyUnit(p.quantity, p.unit)} in stock</div></div>
                <div className="plus">{qtyUnit(p.sold30d, p.unit)} sold</div>
              </div>
            ))}
          </div>
        </>
      )}

      {a.slowMovers.length > 0 && (
        <div className="alert blue">
          <strong>{a.slowMovers.length} slow item(s)</strong>
          No sales in 30 days. See the Moves tab. Money may be stuck in these.
        </div>
      )}
    </div>
  )
}