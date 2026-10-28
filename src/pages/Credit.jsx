import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { loadCreditGroups, recordPayment } from '../services/paymentService'
import { money, dateTime } from '../utils/formatters'

function SaleRow({ s }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(s.balance)
  const [method, setMethod] = useState('cash')
  const [err, setErr] = useState('')

  async function pay() {
    setErr('')
    try {
      await recordPayment({ sale_id: s.id, amount, method })
      setOpen(false)
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <div style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
      <div className="item" style={{ border: 0, padding: 0 }}>
        <div>
          <div className="name">{money(s.balance)} owed</div>
          <div className="sub">
            {dateTime(s.created_at)}
            {s.balance < Number(s.total_amount) ? ` · sale was ${money(s.total_amount)}` : ''}
          </div>
        </div>
        <button className="small" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Receive payment'}</button>
      </div>

      {open && (
        <div>
          <div className="row">
            <div>
              <label>Amount received</label>
              <input type="number" inputMode="decimal" step="any" min="0" value={amount}
                onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label>Paid by</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
              </select>
            </div>
          </div>
          {err && <div className="msg err">{err}</div>}
          <button className="full" onClick={pay}>Save payment</button>
        </div>
      )}
    </div>
  )
}

export default function Credit() {
  const groups = useLiveQuery(loadCreditGroups, [], null)
  if (!groups) return <div className="page muted">Loading...</div>

  const total = groups.reduce((t, g) => t + g.total, 0)

  return (
    <div className="page">
      <h2>Customers who owe</h2>
      <div className="stat" style={{ marginBottom: 12 }}>
        <div className="label">Total owed to you</div>
        <div className="value">{money(total)}</div>
      </div>

      {groups.length === 0 && <p className="muted center">Nobody owes you anything. 🎉</p>}

      {groups.map((g) => (
        <div className="card" key={g.name.toLowerCase()}>
          <div className="item" style={{ border: 0, padding: '0 0 6px' }}>
            <div className="name">{g.name}</div>
            <span className="badge low">{money(g.total)}</span>
          </div>
          {g.sales.map((s) => <SaleRow key={`${s.id}-${s.balance}`} s={s} />)}
        </div>
      ))}
    </div>
  )
}