import { useState } from 'react'
import { useProducts } from '../hooks/useProducts'
import ProductForm from '../components/ProductForm'
import { addProduct, updateProduct, deleteProduct } from '../services/productService'
import { money, qtyUnit, expiryText } from '../utils/formatters'
import { daysUntil } from '../utils/calculations'
import { EXPIRY_WARN_DAYS } from '../lib/config'

export default function Products() {
  const { products, loading } = useProducts()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null) // null | 'new' | product

  async function save(data, openingQty) {
    if (editing === 'new') await addProduct(data, openingQty)
    else await updateProduct(editing.id, data)
    setEditing(null)
  }

  async function remove(p) {
    if (confirm(`Delete "${p.name}"? Its history is kept.`)) {
      await deleteProduct(p.id)
      setEditing(null)
    }
  }

  const s = search.toLowerCase()
  const shown = products.filter(
    (p) => p.name.toLowerCase().includes(s) || (p.barcode || '').includes(search)
  )

  if (editing) {
    return (
      <div className="page">
        <ProductForm
          key={editing === 'new' ? 'new' : editing.id}
          product={editing === 'new' ? null : editing}
          onSubmit={save}
          onCancel={() => setEditing(null)}
        />
        {editing !== 'new' && (
          <button className="danger full" onClick={() => remove(editing)}>Delete this product</button>
        )}
      </div>
    )
  }

  return (
    <div className="page">
      <div className="row" style={{ alignItems: 'center' }}>
        <h2 style={{ flex: 2 }}>Items</h2>
        <button onClick={() => setEditing('new')}>+ Add</button>
      </div>
      <input placeholder="Search name or barcode" value={search} onChange={(e) => setSearch(e.target.value)} />

      <div className="card" style={{ marginTop: 12 }}>
        {loading && <p className="muted">Loading...</p>}
        {!loading && shown.length === 0 && <p className="muted center">No products yet.</p>}
        {shown.map((p) => (
          <div className="item" key={p.id} onClick={() => setEditing(p)} style={{ cursor: 'pointer' }}>
            <div>
              <div className="name">{p.name}</div>
<div className="sub">
  Sells at {money(p.selling_price)}
  {p.nextExpiry ? ` · next expiry ${expiryText(p.nextExpiry)}` : ''}
</div>
{p.batches
  .filter((b) => b.expiry_date && daysUntil(b.expiry_date) <= EXPIRY_WARN_DAYS)
  .map((b) => {
    const d = daysUntil(b.expiry_date)
    return (
      <div key={b.id} className="sub"
        style={{ color: d < 0 ? 'var(--red)' : 'var(--amber)', fontWeight: 600 }}>
        ⚠ {qtyUnit(b.remaining, p.unit)}{' '}
        {d < 0 ? `expired ${-d} day(s) ago` : d === 0 ? 'expires today' : `expire in ${d} day(s)`}
      </div>
    )
  })}
            </div>
            <span className={`badge ${p.status}`}>{qtyUnit(p.quantity, p.unit)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}