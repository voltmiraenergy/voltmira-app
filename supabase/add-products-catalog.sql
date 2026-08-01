-- add-products-catalog.sql
-- Product catalog: the installer's own equipment library (panels, inverters,
-- batteries, mounting, extras) with real prices. Reused across quotes to build a
-- bill of materials that drives the real cost. Company-scoped via RLS like every
-- other table. Idempotent.

create table if not exists products (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  kind        text not null default 'panel'
              check (kind in ('panel','inverter','battery','mounting','other')),
  brand       text not null default '',
  model       text not null default '',
  spec        text not null default '',          -- e.g. "550 W", "8 kW", "10 kWh"
  unit_price  numeric not null default 0,         -- EUR per unit
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists products_company_idx on products(company_id, kind, created_at);

alter table products enable row level security;
drop policy if exists products_all on products;
create policy products_all on products for all
  using (company_id = my_company_id())
  with check (company_id = my_company_id());
