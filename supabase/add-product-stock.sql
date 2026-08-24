-- add-product-stock.sql
-- Inventory tracking for catalog products. `track_stock` is the per-item toggle
-- (off = the product is a pure price-list entry, no stock counting); `stock` is
-- the physical units on hand in the warehouse. Available = stock minus the units
-- committed across WON quotes (computed live from each quote's bill of materials,
-- so it self-corrects when a deal is deleted or marked lost — nothing to reverse).
-- Idempotent; degrades gracefully (product writes retry without these columns).

alter table products add column if not exists track_stock boolean not null default false;
alter table products add column if not exists stock       integer not null default 0;
