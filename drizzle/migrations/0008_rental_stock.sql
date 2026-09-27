ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS quantity integer;

CREATE TABLE public.rental_stock_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.rental_assets(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  amount integer NOT NULL DEFAULT 0,
  note text,
  created_by uuid,
  used_on date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_stock_usage TO authenticated;
GRANT ALL ON public.rental_stock_usage TO service_role;

ALTER TABLE public.rental_stock_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rental access stock usage" ON public.rental_stock_usage
  FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'aluguer'))
  WITH CHECK (public.can_access(auth.uid(), 'aluguer'));

CREATE INDEX idx_rental_stock_usage_purchase ON public.rental_stock_usage(purchase_id);
CREATE INDEX idx_rental_stock_usage_asset ON public.rental_stock_usage(asset_id);