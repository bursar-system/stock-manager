export default function AlertBanner({ tone = 'amber', title, items = [], max = 5 }) {
  if (!items.length) return null
  return (
    <div className={`alert ${tone}`}>
      <strong>{title} ({items.length})</strong>
      <ul>
        {items.slice(0, max).map((i) => <li key={i.id}>{i.label}</li>)}
        {items.length > max && <li>...and {items.length - max} more</li>}
      </ul>
    </div>
  )
}