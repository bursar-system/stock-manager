export const money = (n) =>
  'KES ' + Number(n || 0).toLocaleString('en-KE', { maximumFractionDigits: 2 })

export const qty = (n) => Number(Number(n || 0).toFixed(3)).toString()

export const dateTime = (iso) =>
  new Date(iso).toLocaleString('en-KE', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

export const startOfDay = (d = new Date()) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export const dayKey = (iso) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const PLURALS = {
  litre: 'litres',
  pack: 'packs',
  box: 'boxes',
  dozen: 'dozens',
}

// unitLabel('litre', 15) -> 'litres',  unitLabel('litre', 1) -> 'litre'
export const unitLabel = (unit, n) => {
  if (Number(n) === 1) return unit === 'pcs' ? 'pc' : unit
  return PLURALS[unit] || unit
}

// qtyUnit(15, 'litre') -> '15 litres'
export const qtyUnit = (n, unit) => `${qty(n)} ${unitLabel(unit, n)}`
// expiryText('2026-11-12') -> '12 Nov 2026'
export const expiryText = (dateStr) =>
  dateStr
    ? new Date(dateStr + 'T00:00:00').toLocaleDateString('en-KE', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : 'No expiry'