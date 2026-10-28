create table public.sales (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  total_amount numeric(12,2) not null default 0,
  payment_method text not null default 'cash' check (payment_method in ('cash','mpesa','credit')),
  customer_name text,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  unit_cost numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stock_movements
  add constraint stock_movements_sale_fk
  foreign key (sale_id) references public.sales(id);

create index sales_shop_updated_idx on public.sales (shop_id, updated_at);
create index sale_items_shop_updated_idx on public.sale_items (shop_id, updated_at);

create trigger trg_sales_updated before insert or update on public.sales
  for each row execute function public.set_updated_at();
create trigger trg_sale_items_updated before insert or update on public.sale_items
  for each row execute function public.set_updated_at();