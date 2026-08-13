-- 0010's item_master seed used the SKU itself as a placeholder name (barang
-- had no rows read at seed time in some environments, and there was no other
-- name source). barang already holds the real names/units from years of
-- real uploads, so backfill item_master from it wherever the placeholder
-- (name = sku) is still untouched. This is what the "add item manually"
-- picker searches by, so without this fix searching by real item name always
-- came up empty.

update item_master im
set name = b.name, unit = coalesce(nullif(trim(b.unit), ''), im.unit)
from barang b
where b.sku = im.sku and im.name = im.sku;
