-- The heart of the app. quantity is SIGNED:
--   positive = stock added (stock_in, return, positive adjustment)
--   negative = stock removed (sale, damage, expired, negative adjustment)
-- Current stock of a product = SUM(quantity) of its movements.
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id uuid not null references public.products(id),
  type text not null check (type in ('stock_in','sale','damage','expired','adjustment','return')),
  quantity numeric(12,3) not null check (quantity <> 0),
  unit_cost numeric(12,2),
  sale_id uuid,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index movements_shop_updated_idx on public.stock_movements (shop_id, updated_at);
create index movements_product_idx on public.stock_movements (product_id, created_at);

create trigger trg_movements_updated before insert or update on public.stock_movements
  for each row execute function public.set_updated_at();

-- Append-only: no edits, no deletes, ever
create or replace function public.block_movement_changes()
returns trigger language plpgsql as $$
begin
  raise exception 'stock_movements is append-only. Add a new adjustment instead.';
end $$;

create trigger trg_movements_append_only
  before update or delete on public.stock_movements
  for each row execute function public.block_movement_changes();