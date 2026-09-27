ALTER TABLE public.rental_assets ADD COLUMN IF NOT EXISTS sector text NOT NULL DEFAULT 'aluguer';
ALTER TABLE public.rental_stock_usage ADD COLUMN IF NOT EXISTS sector text NOT NULL DEFAULT 'aluguer';
CREATE INDEX IF NOT EXISTS rental_assets_sector_idx ON public.rental_assets (sector);
CREATE INDEX IF NOT EXISTS rental_stock_usage_sector_idx ON public.rental_stock_usage (sector);