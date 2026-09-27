CREATE TABLE public.bank_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector text NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_deposits TO authenticated;
GRANT ALL ON public.bank_deposits TO service_role;
ALTER TABLE public.bank_deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage deposits" ON public.bank_deposits FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));