-- 1. Credit payments
create table public.credit_payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  sale_id uuid not null references public.sales(id),
  amount numeric(12,2) not null check (amount > 0),
  method text not null default 'cash' check (method in ('cash','mpesa')),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index payments_shop_updated_idx on public.credit_payments (shop_id, updated_at);
create index payments_sale_idx on public.credit_payments (sale_id);

create trigger trg_payments_updated before insert or update on public.credit_payments
  for each row execute function public.set_updated_at();

alter table public.credit_payments enable row level security;

create policy "payments_select" on public.credit_payments
  for select to authenticated using (shop_id = public.current_shop_id());
create policy "payments_insert" on public.credit_payments
  for insert to authenticated with check (shop_id = public.current_shop_id());
create policy "payments_update" on public.credit_payments
  for update to authenticated
  using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id());

-- 2. New shops get a 14-day free trial
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_shop_id uuid;
begin
  insert into public.shops (name, owner_id, paid_until)
  values (coalesce(new.raw_user_meta_data->>'shop_name', 'My Shop'), new.id, current_date + 14)
  returning id into new_shop_id;

  insert into public.profiles (id, shop_id, full_name, role)
  values (new.id, new_shop_id, new.raw_user_meta_data->>'full_name', 'owner');

  return new;
end $$;