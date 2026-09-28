ALTER TABLE public.water_sales ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES public.rental_assets(id) ON DELETE SET NULL;
ALTER TABLE public.water_sales ADD COLUMN IF NOT EXISTS description text;
CREATE INDEX IF NOT EXISTS water_sales_asset_idx ON public.water_sales(asset_id);