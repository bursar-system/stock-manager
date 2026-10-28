import { db } from './db'

export async function getContext() {
  const [shop, user, role] = await Promise.all([
    db.meta.get('shop_id'),
    db.meta.get('user_id'),
    db.meta.get('role'),
  ])
  return {
    shop_id: shop?.value || null,
    user_id: user?.value || null,
    role: role?.value || 'shop',
  }
}

export async function setContext(shopId, userId, role = 'shop') {
  await db.meta.bulkPut([
    { key: 'shop_id', value: shopId },
    { key: 'user_id', value: userId },
    { key: 'role', value: role },
  ])
}

export async function clearContext() {
  await db.meta.bulkDelete(['shop_id', 'user_id', 'role'])
}

// Used when a DIFFERENT shop logs in on the same device
export async function wipeLocalData() {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear()
  })
}
// Call right after a successful login.
// If the data on this device belongs to someone else (or to nobody known), wipe it.
export async function prepareDeviceFor(userId) {
  const owner = (await db.meta.get('data_owner'))?.value
  if (owner !== userId) await wipeLocalData()
  await db.meta.put({ key: 'data_owner', value: userId })
}