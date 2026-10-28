import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { useStockAlerts } from '../hooks/useStockAlerts'
import { dateTime, qty, qtyUnit } from '../utils/formatters'

const TYPE_LABEL = {
  stock_in: 'Stock in', sale: 'Sale', damage: 'Damaged',
  expired: 'Expired', adjustment: 'Count adjust', return: 'Return',
}

export default function StockMovement() {
  const a = useStockAlerts()
  const [filter, setFilter] = useState('all')

  const moves = useLiveQuery(async () => {
    const all = await db.stock_movements.toArray()
    all.sort((x, y) => new Date(y.created_at) - new Date(x.created_at))
    return all.slice(0, 200)
  }, [], [])

  const names = Object.fromEntries(a.products.map((p) => [p.id, p.name]))
  const shown = filter === 'all' ? moves : moves.filter((m) => m.type === filter)

  return (
    <div className="page">
      <h2>How stock is moving</h2>

      <h3>Days of stock left</h3>
      <div className="card">
        {a.products.filter((p) => p.daysLeft !== null).length === 0 && (
          <p className="muted center">Appears after you record some sales.</p>
        )}
        {a.products
          .filter((p) => p.daysLeft !== null)
          .sort((x, y) => x.daysLeft - y.daysLeft)
          .slice(0, 8)
          .map((p) => (
            <div className="item" key={p.id}>
              <div>
                <div className="name">{p.name}</div>
                <div className="sub">{qty(p.sold30d)} sold in 30 days · {qtyUnit(p.quantity, p.unit)} left</div>
              </div>
              <span className={`badge ${p.daysLeft <= 7 ? 'low' : 'ok'}`}>~{Math.round(p.daysLeft)} days</span>
            </div>
          ))}
      </div>

      {a.slowMovers.length > 0 && (
        <>
          <h3>Slow / not selling (30 days)</h3>
          <div className="card">
            {a.slowMovers.map((p) => (
              <div className="item" key={p.id}>
                <div className="name">{p.name}</div>
                <span className="badge low">{qtyUnit(p.quantity, p.unit)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h3>History</h3>
      <div className="tabs">
        {['all', 'sale', 'stock_in', 'damage', 'expired', 'adjustment'].map((t) => (
          <button key={t} className={filter === t ? 'on' : ''} onClick={() => setFilter(t)}>
            {t === 'all' ? 'All' : TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <div className="card">
        {shown.length === 0 && <p className="muted center">Nothing yet.</p>}
        {shown.map((m) => (
          <div className="item" key={m.id}>
            <div>
              <div className="name">{names[m.product_id] || 'Deleted product'}</div>
              <div className="sub">{TYPE_LABEL[m.type]} · {dateTime(m.created_at)}{m.note ? ` · ${m.note}` : ''}</div>
            </div>
            <span className={Number(m.quantity) > 0 ? 'plus' : 'minus'}>
              {Number(m.quantity) > 0 ? '+' : ''}{qty(m.quantity)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}