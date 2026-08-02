-- add-product-image.sql
-- Product photo for the equipment catalog. A plain URL (https), rendered as a
-- thumbnail on the Catalog tab and available to show on proposals later. The app
-- degrades gracefully before this runs (no image = a kind icon placeholder), so
-- it is safe to deploy the UI ahead of the migration. Idempotent.

alter table products add column if not exists image_url text not null default '';

-- verify:
--   select brand, model, image_url from products order by created_at;
