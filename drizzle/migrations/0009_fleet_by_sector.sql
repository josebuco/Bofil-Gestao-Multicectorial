ALTER TABLE public.rental_assets ADD COLUMN IF NOT EXISTS sector text NOT NULL DEFAULT 'aluguer';
ALTER TABLE public.rental_stock_usage ADD COLUMN IF NOT EXISTS sector text NOT NULL DEFAULT 'aluguer';
ALTER TABLE public.sector_entries ADD COLUMN IF NOT EXISTS students integer;
ALTER TABLE public.sector_entries ADD COLUMN IF NOT EXISTS per_student integer;
DROP POLICY IF EXISTS "Rental access assets" ON public.rental_assets;
CREATE POLICY "Sector access assets" ON public.rental_assets FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), sector)) WITH CHECK (public.can_access(auth.uid(), sector));
DROP POLICY IF EXISTS "Rental access stock usage" ON public.rental_stock_usage;
CREATE POLICY "Sector access stock usage" ON public.rental_stock_usage FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), sector)) WITH CHECK (public.can_access(auth.uid(), sector));
CREATE INDEX IF NOT EXISTS rental_assets_sector_idx ON public.rental_assets(sector);