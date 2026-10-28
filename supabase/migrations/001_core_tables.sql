create extension if not exists pgcrypto;

-- Keeps updated_at correct on the server (used by sync)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  currency text not null default 'KES',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  shop_id uuid references public.shops(id) on delete set null,
  full_name text,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  name text not null,
  barcode text,
  unit text not null default 'pcs',
  buying_price numeric(12,2) not null default 0,
  selling_price numeric(12,2) not null default 0,
  reorder_level numeric(12,3) not null default 5,
  expiry_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Same barcode cannot be used twice in one shop
create unique index products_shop_barcode_uq
  on public.products (shop_id, barcode)
  where barcode is not null and deleted_at is null;

create index products_shop_updated_idx on public.products (shop_id, updated_at);
create index categories_shop_updated_idx on public.categories (shop_id, updated_at);
create index suppliers_shop_updated_idx on public.suppliers (shop_id, updated_at);

create trigger trg_shops_updated before insert or update on public.shops
  for each row execute function public.set_updated_at();
create trigger trg_profiles_updated before insert or update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_categories_updated before insert or update on public.categories
  for each row execute function public.set_updated_at();
create trigger trg_suppliers_updated before insert or update on public.suppliers
  for each row execute function public.set_updated_at();
create trigger trg_products_updated before insert or update on public.products
  for each row execute function public.set_updated_at();