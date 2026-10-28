import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { syncNow } from '../sync/syncEngine'
import { useOnlineStatus } from '../sync/useOnlineStatus'

export default function SyncStatus() {
  const online = useOnlineStatus()
  const pending = useLiveQuery(() => db.syncQueue.count(), [], 0)
  const last = useLiveQuery(() => db.meta.get('last_sync'), [])

  return (
    <div className="sync">
      <span className={`dot ${online ? 'on' : 'off'}`} />
      <span>
        {online ? 'Online' : 'Offline'}
        {pending > 0 ? ` · ${pending} waiting` : ' · all saved'}
      </span>
      {online && pending > 0 && <button onClick={() => syncNow()}>Sync</button>}
    </div>
  )
}