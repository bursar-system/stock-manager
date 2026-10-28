create table public.product_batches (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id uuid not null references public.products(id),
  expiry_date date,
  unit_cost numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index batches_shop_updated_idx on public.product_batches (shop_id, updated_at);
create index batches_product_idx on public.product_batches (product_id);

create trigger trg_batches_updated before insert or update on public.product_batches
  for each row execute function public.set_updated_at();

alter table public.product_batches enable row level security;

create policy "batches_select" on public.product_batches
  for select to authenticated using (shop_id = public.current_shop_id());
create policy "batches_insert" on public.product_batches
  for insert to authenticated with check (shop_id = public.current_shop_id());
create policy "batches_update" on public.product_batches
  for update to authenticated
  using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id());

-- Each movement can now say which batch it touched
alter table public.stock_movements
  add column batch_id uuid references public.product_batches(id);
create index movements_batch_idx on public.stock_movements (batch_id);