-- Current quantity of every product
create or replace view public.current_stock
with (security_invoker = true) as
select
  p.id as product_id,
  p.shop_id,
  p.name,
  p.unit,
  p.reorder_level,
  p.buying_price,
  p.selling_price,
  coalesce(sum(m.quantity), 0) as quantity
from public.products p
left join public.stock_movements m on m.product_id = p.id
where p.deleted_at is null
group by p.id;

-- Products at or below their reorder level
create or replace view public.low_stock
with (security_invoker = true) as
select * from public.current_stock
where quantity <= reorder_level;

-- How fast things sell and how many days the stock will last
create or replace view public.product_velocity
with (security_invoker = true) as
with sold as (
  select product_id, -sum(quantity) as sold_30d
  from public.stock_movements
  where type = 'sale' and created_at >= now() - interval '30 days'
  group by product_id
)
select
  cs.*,
  coalesce(s.sold_30d, 0) as sold_30d,
  case when coalesce(s.sold_30d, 0) > 0
       then round(cs.quantity / (s.sold_30d / 30.0), 1)
  end as days_left
from public.current_stock cs
left join sold s on s.product_id = cs.product_id;