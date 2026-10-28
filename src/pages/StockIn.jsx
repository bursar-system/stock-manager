import { useState } from 'react'
import { useProducts } from '../hooks/useProducts'
import { addStock, recordLoss, adjustToCount } from '../services/stockService'
import { daysUntil } from '../utils/calculations'
import { qty, qtyUnit, expiryText } from '../utils/formatters'

const MODES = [
  { key: 'in', label: '📦 Stock in' },
  { key: 'damage', label: '💔 Damaged' },
  { key: 'expired', label: '⌛ Expired' },
  { key: 'count', label: '🔢 Count' },
]

function batchLabel(b, unit) {
  let when = 'No expiry'
  if (b.expiry_date) {
    const d = daysUntil(b.expiry_date)
    when = `${expiryText(b.expiry_date)} (${d < 0 ? 'EXPIRED' : d === 0 ? 'today' : `in ${d} days`})`
  }
  return `${qtyUnit(b.remaining, unit)} · ${when}`
}

export default function StockIn() {
  const { products } = useProducts()
  const [mode, setMode] = useState('in')
  const [search, setSearch] = useState('')
  const [productId, setProductId] = useState('')
  const [amount, setAmount] = useState('')
  const [cost, setCost] = useState('')
  const [note, setNote] = useState('')
  const [expiry, setExpiry] = useState('')
  const [batchId, setBatchId] = useState('')
  const [updatePrice, setUpdatePrice] = useState(false)
  const [msg, setMsg] = useState(null)

  const s = search.toLowerCase()
  const options = products.filter((p) => p.name.toLowerCase().includes(s))
  const product = products.find((p) => p.id === productId)

  function pick(id) {
    setProductId(id)
    setBatchId('')
    setExpiry('')
    const p = products.find((x) => x.id === id)
    setCost(p ? p.buying_price : '')
  }

  async function submit(e) {
    e.preventDefault()
    setMsg(null)
    if (!product) return setMsg({ ok: false, text: 'Choose a product first' })
    try {
      if (mode === 'in') {
        await addStock({
          product_id: product.id, quantity: amount, unit_cost: cost, note,
          updateBuyingPrice: updatePrice, expiry_date: expiry,
        })
        setMsg({
          ok: true,
          text: `Added ${qtyUnit(amount, product.unit)} to ${product.name}` +
            (expiry ? ` (expires ${expiryText(expiry)})` : ''),
        })
      } else if (mode === 'count') {
        const r = await adjustToCount({ product_id: product.id, currentQty: product.quantity, countedQty: amount, note })
        setMsg({ ok: true, text: r.changed ? `Adjusted by ${qty(r.diff)}. Stock now ${amount}.` : 'Count matches. No change.' })
      } else {
        if (mode === 'expired' && product.batches.length > 0 && !batchId) {
          return setMsg({ ok: false, text: 'Choose which batch expired' })
        }
        await recordLoss({ product_id: product.id, quantity: amount, type: mode, note, batch_id: batchId })
        setMsg({ ok: true, text: `Removed ${qtyUnit(amount, product.unit)} (${mode})` })
      }
      setAmount(''); setNote(''); setExpiry(''); setBatchId('')
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    }
  }

  return (
    <div className="page">
      <h2>Stock</h2>
      <div className="tabs">
        {MODES.map((m) => (
          <button key={m.key} className={mode === m.key ? 'on' : ''}
            onClick={() => { setMode(m.key); setMsg(null); setBatchId('') }}>{m.label}</button>
        ))}
      </div>

      <form className="card" onSubmit={submit}>
        <label>Find product</label>
        <input placeholder="Type to filter..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <label>Product</label>
        <select value={productId} onChange={(e) => pick(e.target.value)} size={Math.min(5, options.length + 1) || 2}>
          <option value="">-- choose --</option>
          {options.map((p) => <option key={p.id} value={p.id}>{p.name} ({qtyUnit(p.quantity, p.unit)})</option>)}
        </select>

        {product && (
          <>
            <p className="muted">Now in stock: <b>{qtyUnit(product.quantity, product.unit)}</b></p>
            {(product.batches.length > 0 || product.unbatched > 0) && (
              <div style={{ background: 'var(--soft)', borderRadius: 10, padding: '4px 12px', marginBottom: 6 }}>
                {product.batches.map((b) => (
                  <div className="item" key={b.id}>
                    <div className="sub" style={{ margin: 0 }}>{batchLabel(b, product.unit)}</div>
                  </div>
                ))}
                {product.unbatched > 0 && (
                  <div className="item">
                    <div className="sub" style={{ margin: 0 }}>
                      {qtyUnit(product.unbatched, product.unit)} · earlier stock (no expiry recorded)
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <label>{mode === 'count' ? 'Counted quantity (what is really on the shelf)' : 'Quantity'}</label>
        <input type="number" inputMode="decimal" step="any" min="0" value={amount}
          onChange={(e) => setAmount(e.target.value)} required />

        {mode === 'in' && (
          <>
            <label>Expiry date of this delivery (leave empty if none)</label>
            <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            <p className="sub">A new date creates a new batch. The same date as an existing batch joins it.</p>

            <label>Buying price per unit</label>
            <input type="number" inputMode="decimal" step="any" min="0" value={cost}
              onChange={(e) => setCost(e.target.value)} />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={updatePrice}
                onChange={(e) => setUpdatePrice(e.target.checked)} />
              Update the product's buying price
            </label>
          </>
        )}

        {(mode === 'damage' || mode === 'expired') && product && product.batches.length > 0 && (
          <>
            <label>Which batch?{mode === 'damage' ? ' (optional)' : ''}</label>
            <select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">{mode === 'damage' ? 'Any (earliest expiry first)' : '-- choose batch --'}</option>
              {product.batches.map((b) => (
                <option key={b.id} value={b.id}>{batchLabel(b, product.unit)}</option>
              ))}
            </select>
          </>
        )}

        <label>Note (optional)</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} />

        {msg && <div className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
        <button className="full">Save</button>
      </form>
    </div>
  )
}