DROP POLICY IF EXISTS "Rental access assets" ON public.rental_assets;
DROP POLICY IF EXISTS "Sector access assets" ON public.rental_assets;
CREATE POLICY "Sector access assets" ON public.rental_assets FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), sector)) WITH CHECK (public.can_access(auth.uid(), sector));
DROP POLICY IF EXISTS "Rental access stock usage" ON public.rental_stock_usage;
DROP POLICY IF EXISTS "Sector access stock usage" ON public.rental_stock_usage;
CREATE POLICY "Sector access stock usage" ON public.rental_stock_usage FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), sector)) WITH CHECK (public.can_access(auth.uid(), sector));