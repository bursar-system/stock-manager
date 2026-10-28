-- 1. List of super admins. No policies = nobody can read it through the app API.
create table if not exists public.super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.super_admins enable row level security;

-- 2. "Am I a super admin?"
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.super_admins where user_id = auth.uid())
$$;

-- 3. List all shops (admins only)
create or replace function public.admin_list_shops()
returns table (
  shop_id uuid, shop_name text, owner_name text, email text, phone text,
  status text, paid_until date, joined timestamptz, last_sign_in_at timestamptz,
  products bigint, total_sales bigint, sales_30d numeric,
  last_activity timestamptz, admin_notes text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super_admin() then raise exception 'Not allowed'; end if;
  return query
  select
    s.id, s.name, pr.full_name, u.email::text, s.phone,
    s.status, s.paid_until, s.created_at, u.last_sign_in_at,
    (select count(*) from public.products p where p.shop_id = s.id and p.deleted_at is null),
    (select count(*) from public.sales x where x.shop_id = s.id and x.deleted_at is null),
    (select coalesce(sum(x.total_amount), 0) from public.sales x
       where x.shop_id = s.id and x.deleted_at is null
         and x.created_at >= now() - interval '30 days'),
    (select max(m.created_at) from public.stock_movements m where m.shop_id = s.id),
    s.admin_notes
  from public.shops s
  left join auth.users u on u.id = s.owner_id
  left join public.profiles pr on pr.id = s.owner_id
  where s.deleted_at is null
    and not exists (select 1 from public.super_admins a where a.user_id = s.owner_id)
  order by s.created_at desc;
end $$;

-- 4. Suspend / activate / set paid-until / notes (admins only)
create or replace function public.admin_update_shop(
  p_shop_id uuid, p_status text, p_paid_until date, p_notes text
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then raise exception 'Not allowed'; end if;
  if p_status not in ('active', 'suspended') then raise exception 'Bad status'; end if;
  update public.shops
     set status = p_status, paid_until = p_paid_until, admin_notes = p_notes
   where id = p_shop_id;
end $$;

-- 5. Only logged-in users may call these (and each one checks admin itself)
revoke execute on function public.is_super_admin() from public, anon;
revoke execute on function public.admin_list_shops() from public, anon;
revoke execute on function public.admin_update_shop(uuid, text, date, text) from public, anon;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.admin_list_shops() to authenticated;
grant execute on function public.admin_update_shop(uuid, text, date, text) to authenticated;

-- 6. SECURITY FIX for file 006: without this, a shopkeeper could edit his own
--    status / paid_until through the API and un-suspend himself.
create or replace function public.protect_shop_control_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() is null when you work in the Supabase dashboard, so you stay allowed
  if auth.uid() is not null and not public.is_super_admin() then
    if new.status is distinct from old.status
       or new.paid_until is distinct from old.paid_until
       or new.admin_notes is distinct from old.admin_notes
       or new.owner_id is distinct from old.owner_id then
      raise exception 'Only the system admin can change these fields';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_shops_protect on public.shops;
create trigger trg_shops_protect before update on public.shops
  for each row execute function public.protect_shop_control_fields();