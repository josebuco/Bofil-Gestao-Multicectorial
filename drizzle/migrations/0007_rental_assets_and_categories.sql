CREATE TABLE public.rental_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'Veículo',
  plate text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_assets TO authenticated;
GRANT ALL ON public.rental_assets TO service_role;
ALTER TABLE public.rental_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rental access assets" ON public.rental_assets FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'aluguer')) WITH CHECK (public.can_access(auth.uid(), 'aluguer'));

ALTER TABLE public.sector_entries ADD COLUMN asset_id uuid REFERENCES public.rental_assets(id) ON DELETE SET NULL;
ALTER TABLE public.expenses ADD COLUMN asset_id uuid REFERENCES public.rental_assets(id) ON DELETE SET NULL;

CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read categories" ON public.expense_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Cost staff add categories" ON public.expense_categories FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.can_access(auth.uid(), 'custos'));
CREATE POLICY "Admin delete categories" ON public.expense_categories FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));