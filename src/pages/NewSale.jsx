import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { useProducts } from '../hooks/useProducts'
import { createSale } from '../services/salesService'
import { money, qty, qtyUnit } from '../utils/formatters'
import { daysUntil } from '../utils/calculations'

export default function NewSale() {
  const { products } = useProducts()
  const pastCustomers = useLiveQuery(async () => {
    const all = await db.sales.toArray()
    return [...new Set(all.filter((s) => s.customer_name).map((s) => s.customer_name.trim()))]
  }, [], [])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([]) // { product, quantity, unit_price }
  const [method, setMethod] = useState('cash')
  const [customer, setCustomer] = useState('')
  const [msg, setMsg] = useState(null)

  const s = search.toLowerCase()
  const found = search
    ? products.filter((p) => p.name.toLowerCase().includes(s) || (p.barcode || '') === search).slice(0, 6)
    : []

  function add(p) {
    setMsg(null)
    setSearch('')
    setCart((c) => {
      const ex = c.find((i) => i.product.id === p.id)
      if (ex) return c.map((i) => (i.product.id === p.id ? { ...i, quantity: Number(i.quantity) + 1 } : i))
      return [...c, { product: p, quantity: 1, unit_price: p.selling_price }]
    })
  }

  const change = (id, k, v) =>
    setCart((c) => c.map((i) => (i.product.id === id ? { ...i, [k]: v } : i)))
  const remove = (id) => setCart((c) => c.filter((i) => i.product.id !== id))

  const total = cart.reduce((t, i) => t + Number(i.quantity || 0) * Number(i.unit_price || 0), 0)

  async function complete() {
    try {
      const r = await createSale({ items: cart, payment_method: method, customer_name: customer })
      setMsg({ ok: true, text: `Sale saved: ${money(r.total)}` })
      setCart([]); setCustomer(''); setMethod('cash')
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    }
  }

  return (
    <div className="page">
      <h2>New sale</h2>
      <input placeholder="Search product or type barcode..." value={search}
        onChange={(e) => setSearch(e.target.value)} />

      {found.length > 0 && (
        <div className="card" style={{ marginTop: 8 }}>
          {found.map((p) => (
            <div className="item" key={p.id} onClick={() => add(p)} style={{ cursor: 'pointer' }}>
              <div><div className="name">{p.name}</div><div className="sub">{money(p.selling_price)}</div>
{(() => {
  const b = p.batches.find((x) => x.expiry_date && daysUntil(x.expiry_date) <= 7)
  if (!b) return null
  const d = daysUntil(b.expiry_date)
  return (
    <div className="sub" style={{ color: d < 0 ? 'var(--red)' : 'var(--amber)', fontWeight: 600 }}>
      ⚠ {qtyUnit(b.remaining, p.unit)} {d < 0 ? 'EXPIRED' : d === 0 ? 'expires today' : `expire in ${d} day(s)`}
    </div>
  )
})()}</div>
              <span className={`badge ${p.status}`}>{qtyUnit(p.quantity, p.unit)}</span>
            </div>
          ))}
        </div>
      )}

      <h3>Cart</h3>
      <div className="card">
        {cart.length === 0 && <p className="muted center">Search and tap a product to add it.</p>}
        {cart.map((i) => {
          const over = Number(i.quantity) > i.product.quantity
          return (
            <div key={i.product.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <div className="item" style={{ border: 0, padding: 0 }}>
                <div className="name">{i.product.name}</div>
                <button className="small danger" onClick={() => remove(i.product.id)}>✕</button>
              </div>
              <div className="row">
                <div>
                  <label>Qty ({i.product.unit})</label>
                  <input type="number" inputMode="decimal" step="any" min="0" value={i.quantity}
                    onChange={(e) => change(i.product.id, 'quantity', e.target.value)} />
                </div>
                <div>
                  <label>Price</label>
                  <input type="number" inputMode="decimal" step="any" min="0" value={i.unit_price}
                    onChange={(e) => change(i.product.id, 'unit_price', e.target.value)} />
                </div>
              </div>
              {over && <div className="sub" style={{ color: 'var(--red)' }}>
                Only {qty(i.product.quantity)} in stock. You can still sell, but check your count.
              </div>}
            </div>
          )
        })}
        {cart.length > 0 && <div className="total">{money(total)}</div>}
      </div>

      {cart.length > 0 && (
        <div className="card">
          <label>Payment</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="mpesa">M-Pesa</option>
            <option value="credit">Credit (pay later)</option>
          </select>
          {method === 'credit' && (
            <>
<label>Customer name (required for credit)</label>
<input list="customers" value={customer} onChange={(e) => setCustomer(e.target.value)} />
<datalist id="customers">
  {pastCustomers.map((n) => <option key={n} value={n} />)}
</datalist>
            </>
          )}
          <button className="full" onClick={complete}>Complete sale</button>
        </div>
      )}

      {msg && <div className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
    </div>
  )
}