-- backfill-product-images.sql
-- Fill in photos for starter-catalog products that were seeded before every item
-- had an image. Matches by brand+model and only touches rows whose image is still
-- blank, so it never overwrites a photo you set yourself. Safe to re-run.

update products set image_url = 'https://upload.wikimedia.org/wikipedia/commons/1/1c/SolarEdge-Inverter.jpg'
  where brand = 'Huawei' and model = 'SUN2000-8KTL-M1' and coalesce(image_url,'') = '';

update products set image_url = 'https://upload.wikimedia.org/wikipedia/commons/6/68/Onduleur_pour_photovolta%C3%AFque.jpg'
  where brand = 'Deye' and model = 'SUN-6K-SG04LP3' and coalesce(image_url,'') = '';

update products set image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Inverter_Fronius_%3D_Sunways_NT_6000-01ASD.jpg/500px-Inverter_Fronius_%3D_Sunways_NT_6000-01ASD.jpg'
  where brand = 'Fronius' and model = 'Symo GEN24 10.0 Plus' and coalesce(image_url,'') = '';

update products set image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Household_battery_storage.png/500px-Household_battery_storage.png'
  where brand = 'Pylontech' and model = 'US5000' and coalesce(image_url,'') = '';

update products set image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Household_solar_energy_storage_system.jpg/500px-Household_solar_energy_storage_system.jpg'
  where brand = 'Huawei' and model = 'LUNA2000-5-S0' and coalesce(image_url,'') = '';

update products set image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Photovoltaic_mounting_system.jpg/500px-Photovoltaic_mounting_system.jpg'
  where brand = 'Renusol' and model = 'VarioSole+ end clamp set' and coalesce(image_url,'') = '';

update products set image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/MC4_Connector_Front_and_Top_View.jpg/500px-MC4_Connector_Front_and_Top_View.jpg'
  where brand = 'Generic' and model = 'DC cable + MC4 connectors' and coalesce(image_url,'') = '';

-- verify: every product should now have an image
--   select kind, brand, model, (image_url <> '') as has_image from products order by kind, brand;
