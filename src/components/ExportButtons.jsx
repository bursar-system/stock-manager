import { db } from '../lib/db'
import { downloadCsv } from '../utils/exportCsv'
import { buildStock } from '../utils/calculations'

const when = (iso) => new Date(iso).toLocaleString('en-GB')
const today = () => new Date().toISOString().slice(0, 10)

export default function ExportButtons() {
  async function sales() {
    const [list, items, prods] = await Promise.all([
      db.sales.toArray(), db.sale_items.toArray(), db.products.toArray(),
    ])
    const names = Object.fromEntries(prods.map((p) => [p.id, p.name]))
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const rows = [['Date', 'Customer', 'Payment', 'Total', 'Status', 'Items']]
    for (const s of list) {
      const lines = items
        .filter((i) => i.sale_id === s.id)
        .map((i) => `${i.quantity} x ${names[i.product_id] || 'Deleted product'}`)
        .join('; ')
      rows.push([when(s.created_at), s.customer_name || '', s.payment_method,
        s.total_amount, s.deleted_at ? 'Cancelled' : 'OK', lines])
    }
    downloadCsv(`sales-${today()}.csv`, rows)
  }

  async function stock() {
    const [prods, moves] = await Promise.all([
      db.products.filter((p) => !p.deleted_at).toArray(), db.stock_movements.toArray(),
    ])
    const list = buildStock(prods, moves).sort((a, b) => a.name.localeCompare(b.name))
    const rows = [['Product', 'Unit', 'In stock', 'Buying price', 'Selling price', 'Stock value (cost)']]
    for (const p of list) {
      rows.push([p.name, p.unit, p.quantity, p.buying_price, p.selling_price,
        Math.max(p.quantity, 0) * Number(p.buying_price)])
    }
    downloadCsv(`stock-${today()}.csv`, rows)
  }

  async function movements() {
    const [moves, prods] = await Promise.all([db.stock_movements.toArray(), db.products.toArray()])
    const names = Object.fromEntries(prods.map((p) => [p.id, p.name]))
    moves.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const rows = [['Date', 'Product', 'Type', 'Quantity', 'Note']]
    for (const m of moves) {
      rows.push([when(m.created_at), names[m.product_id] || 'Deleted product', m.type, m.quantity, m.note || ''])
    }
    downloadCsv(`movements-${today()}.csv`, rows)
  }

  return (
    <>
      <h3>Backup / export</h3>
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>Download a copy that opens in Excel or Google Sheets.</p>
        <div className="row">
          <button className="secondary" onClick={sales}>Sales</button>
          <button className="secondary" onClick={stock}>Stock</button>
          <button className="secondary" onClick={movements}>Movements</button>
        </div>
      </div>
    </>
  )
}