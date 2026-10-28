import { supabase } from '../lib/supabase'

export async function listShops() {
  const { data, error } = await supabase.rpc('admin_list_shops')
  if (error) throw new Error(error.message)
  return data
}

export async function updateShop(shopId, { status, paid_until, notes }) {
  const { error } = await supabase.rpc('admin_update_shop', {
    p_shop_id: shopId,
    p_status: status,
    p_paid_until: paid_until || null,
    p_notes: notes || null,
  })
  if (error) throw new Error(error.message)
}