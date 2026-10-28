-- Which shop does the logged-in user belong to?
create or replace function public.current_shop_id()
returns uuid language sql stable security definer set search_path = public as $$
  select shop_id from public.profiles where id = auth.uid()
$$;

-- When someone signs up, automatically create their shop and profile
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_shop_id uuid;
begin
  insert into public.shops (name, owner_id)
  values (coalesce(new.raw_user_meta_data->>'shop_name', 'My Shop'), new.id)
  returning id into new_shop_id;

  insert into public.profiles (id, shop_id, full_name, role)
  values (new.id, new_shop_id, new.raw_user_meta_data->>'full_name', 'owner');

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security: each shop sees only its own data
alter table public.shops enable row level security;
alter table public.profiles enable row level security;
alter table public.stock_movements enable row level security;

create policy "shops_select" on public.shops
  for select to authenticated using (id = public.current_shop_id());
create policy "shops_update" on public.shops
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or shop_id = public.current_shop_id());

-- Movements: read and add only (no update, no delete)
create policy "movements_select" on public.stock_movements
  for select to authenticated using (shop_id = public.current_shop_id());
create policy "movements_insert" on public.stock_movements
  for insert to authenticated with check (shop_id = public.current_shop_id());

-- Everything else: full access to own shop's rows
do $$
declare t text;
begin
  foreach t in array array['categories','suppliers','products','sales','sale_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_select" on public.%I for select to authenticated using (shop_id = public.current_shop_id())', t, t);
    execute format('create policy "%s_insert" on public.%I for insert to authenticated with check (shop_id = public.current_shop_id())', t, t);
    execute format('create policy "%s_update" on public.%I for update to authenticated using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id())', t, t);
  end loop;
end $$;