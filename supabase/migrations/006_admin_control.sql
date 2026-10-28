-- 1. Control columns on shops
alter table public.shops
  add column if not exists status text not null default 'active'
    check (status in ('active', 'suspended')),
  add column if not exists phone text,
  add column if not exists paid_until date,   -- leave empty = no expiry
  add column if not exists admin_notes text;

-- 2. The shop's own owner can always read their shop row,
--    even when suspended (so the app can show a proper message)
create policy "shops_select_own" on public.shops
  for select to authenticated using (owner_id = auth.uid());

-- 3. Enforcement: a suspended or expired shop gets NO access to its data
create or replace function public.current_shop_id()
returns uuid language sql stable security definer set search_path = public as $$
  select p.shop_id
  from public.profiles p
  join public.shops s on s.id = p.shop_id
  where p.id = auth.uid()
    and s.deleted_at is null
    and s.status = 'active'
    and (s.paid_until is null or s.paid_until >= current_date)
$$;

-- 4. Admin overview, in a private schema that the app cannot reach
create schema if not exists admin;
revoke all on schema admin from anon, authenticated;

create or replace view admin.shop_overview as
select
  s.id as shop_id,
  s.name as shop_name,
  pr.full_name as owner_name,
  u.email,
  s.phone,
  s.status,
  s.paid_until,
  s.created_at as joined,
  u.last_sign_in_at,
  (select count(*) from public.products p
     where p.shop_id = s.id and p.deleted_at is null) as products,
  (select count(*) from public.sales x
     where x.shop_id = s.id and x.deleted_at is null) as total_sales,
  (select coalesce(sum(x.total_amount), 0) from public.sales x
     where x.shop_id = s.id and x.deleted_at is null
       and x.created_at >= now() - interval '30 days') as sales_30d,
  (select max(m.created_at) from public.stock_movements m
     where m.shop_id = s.id) as last_activity,
  s.admin_notes
from public.shops s
left join auth.users u on u.id = s.owner_id
left join public.profiles pr on pr.id = s.owner_id
where s.deleted_at is null;