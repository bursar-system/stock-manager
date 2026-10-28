import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'

export default function ProductForm({ product, onSubmit, onCancel }) {
  const isNew = !product
  const categories = useLiveQuery(() => db.categories.filter((c) => !c.deleted_at).toArray(), [], [])
  const currentCat = product?.category_id
    ? categories.find((c) => c.id === product.category_id)?.name || ''
    : ''

  const [f, setF] = useState({
    name: product?.name || '',
    barcode: product?.barcode || '',
    category_name: '',
    unit: product?.unit || 'pcs',
    buying_price: product?.buying_price ?? '',
    selling_price: product?.selling_price ?? '',
    reorder_level: product?.reorder_level ?? 5,
    expiry_date: product?.expiry_date || '',
    opening_qty: '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const catValue = f.category_name !== '' ? f.category_name : currentCat

  async function submit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await onSubmit({ ...f, category_name: catValue }, f.opening_qty)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3 style={{ marginTop: 0 }}>{isNew ? 'New product' : 'Edit product'}</h3>

      <label>Name *</label>
      <input value={f.name} onChange={set('name')} required />

      <div className="row">
        <div>
          <label>Category</label>
          <input list="cats" value={catValue} onChange={set('category_name')} placeholder="e.g. Drinks" />
          <datalist id="cats">{categories.map((c) => <option key={c.id} value={c.name} />)}</datalist>
        </div>
        <div>
          <label>Unit</label>
          <select value={f.unit} onChange={set('unit')}>
            {['pcs', 'kg', 'g', 'litre', 'ml', 'pack', 'box', 'dozen'].map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div className="row">
        <div>
          <label>Buying price</label>
          <input type="number" inputMode="decimal" step="any" min="0" value={f.buying_price} onChange={set('buying_price')} />
        </div>
        <div>
          <label>Selling price</label>
          <input type="number" inputMode="decimal" step="any" min="0" value={f.selling_price} onChange={set('selling_price')} />
        </div>
      </div>

      <div className="row">
        <div>
          <label>Alert me when stock is at or below</label>
          <input type="number" inputMode="decimal" step="any" min="0" value={f.reorder_level} onChange={set('reorder_level')} />
        </div>
        {isNew && (
          <div>
            <label>Stock I have now</label>
            <input type="number" inputMode="decimal" step="any" min="0" value={f.opening_qty} onChange={set('opening_qty')} />
          </div>
        )}
      </div>

      <label>Barcode (optional)</label>
      <input value={f.barcode} onChange={set('barcode')} />

      {isNew && (
        <>
          <label>Expiry date of the stock I have now (optional)</label>
          <input type="date" value={f.expiry_date} onChange={set('expiry_date')} />
        </>
      )}

      {error && <div className="msg err">{error}</div>}

      <div className="row" style={{ marginTop: 14 }}>
        <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </form>
  )
}