CREATE TABLE public.sector_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_sector text NOT NULL,
  to_sector text NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  kind text NOT NULL DEFAULT 'cedencia',
  parent_id uuid REFERENCES public.sector_transfers(id) ON DELETE CASCADE,
  payment_method text NOT NULL DEFAULT 'Numerário',
  note text,
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sector_transfers TO authenticated;
GRANT ALL ON public.sector_transfers TO service_role;
ALTER TABLE public.sector_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage transfers" ON public.sector_transfers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));